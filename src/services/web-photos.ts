import type { Photo, PhotoService } from "./photos";

interface StoredPhoto extends Photo {
  original: Blob;
  preview: Blob;
}

interface StagedPhoto {
  original: File;
  preview: Blob;
}

const databaseName = "wf-map-photos";
const storeName = "photos";
const staged = new Map<string, StagedPhoto>();
let databasePromise: Promise<IDBDatabase> | undefined;
let persistenceRequested = false;

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => {
      resolve(request.result);
    });
    request.addEventListener("error", () => {
      reject(request.error);
    });
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => {
      resolve();
    });
    transaction.addEventListener("abort", () => {
      reject(transaction.error ?? new Error("贴图写入中断"));
    });
    transaction.addEventListener("error", () => {
      reject(transaction.error ?? new Error("贴图写入失败"));
    });
  });
}

function openDatabase(): Promise<IDBDatabase> {
  databasePromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);

    request.addEventListener("upgradeneeded", () => {
      const store = request.result.createObjectStore(storeName, { keyPath: "uri" });
      store.createIndex("boothId", "boothId");
    });
    request.addEventListener("success", () => {
      const database = request.result;
      database.addEventListener("versionchange", () => {
        database.close();
        databasePromise = undefined;
      });
      resolve(database);
    });
    request.addEventListener("error", () => {
      databasePromise = undefined;
      reject(request.error);
    });
    request.addEventListener("blocked", () => {
      databasePromise = undefined;
      reject(new Error("贴图数据库被其他页面占用"));
    });
  });

  return databasePromise;
}

async function readPhoto(uri: string): Promise<StoredPhoto | undefined> {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, "readonly");

  return requestResult<StoredPhoto | undefined>(transaction.objectStore(storeName).get(uri));
}

async function fileHash(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());

  return [...new Uint8Array(digest)]
    .map((byte) => {
      return byte.toString(16).padStart(2, "0");
    })
    .join("");
}

async function createPreview(file: File): Promise<Blob> {
  const image = new Image();
  const url = URL.createObjectURL(file);

  try {
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 640 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("无法处理贴图预览");
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("无法生成贴图预览"));
          }
        },
        "image/jpeg",
        0.85,
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function stageFiles(files: readonly File[]): Promise<{ uris: string[]; failed: number }> {
  const uris: string[] = [];
  let failed = Math.max(0, files.length - 50);

  for (const file of files.slice(0, 50)) {
    if (!file.type.startsWith("image/")) {
      failed++;
      continue;
    }

    try {
      const uri = `sha256:${await fileHash(file)}`;
      staged.set(uri, { original: file, preview: await createPreview(file) });
      if (!uris.includes(uri)) {
        uris.push(uri);
      }
    } catch {
      failed++;
    }
  }

  return { uris, failed };
}

async function list({ boothId }: { boothId: string }): Promise<{ photos: Photo[] }> {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, "readonly");
  const records = await requestResult<StoredPhoto[]>(
    transaction.objectStore(storeName).index("boothId").getAll(boothId),
  );

  return {
    photos: records.map(({ uri, createdAt }) => {
      return { uri, boothId, createdAt };
    }),
  };
}

async function assign({
  uri,
  boothId,
  replace,
}: {
  uri: string;
  boothId: string;
  replace: boolean;
}): Promise<{ conflict?: string }> {
  if (!boothId.startsWith("wf2026/") || !uri.startsWith("sha256:")) {
    throw new Error("无效的展位或贴图");
  }

  const database = await openDatabase();
  const transaction = database.transaction(storeName, "readwrite");
  const done = transactionDone(transaction);
  void done.catch(() => {});
  const store = transaction.objectStore(storeName);
  const previous = await requestResult<StoredPhoto | undefined>(store.get(uri));
  if (previous?.boothId === boothId) {
    await done;

    return {};
  }
  if (previous && !replace) {
    await done;

    return { conflict: previous.boothId };
  }

  const pending = staged.get(uri);
  if (!previous && !pending) {
    await done;

    throw new Error("待关联的贴图已失效");
  }

  store.put({
    uri,
    boothId,
    createdAt: Date.now(),
    original: previous?.original ?? pending!.original,
    preview: previous?.preview ?? pending!.preview,
  } satisfies StoredPhoto);
  await done;
  if (!persistenceRequested) {
    persistenceRequested = true;
    void navigator.storage?.persist?.().catch(() => {});
  }

  return {};
}

async function thumbnail({ uri }: { uri: string }): Promise<{ dataUrl: string }> {
  const record = await readPhoto(uri);
  if (!record) {
    throw new Error("贴图不可访问");
  }

  return { dataUrl: await blobDataUrl(record.preview) };
}

function blobDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("缩略图格式无效"));
      }
    });
    reader.addEventListener("error", () => {
      reject(reader.error);
    });
    reader.readAsDataURL(blob);
  });
}

async function original({ uri }: { uri: string }): Promise<Blob> {
  const record = await readPhoto(uri);
  if (!record) {
    throw new Error("贴图不可访问");
  }

  return record.original;
}

async function remove({ uri }: { uri: string }): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, "readwrite");
  const done = transactionDone(transaction);
  transaction.objectStore(storeName).delete(uri);
  await done;
}

async function releaseUnlinked({ uris }: { uris: string[] }): Promise<void> {
  for (const uri of uris) {
    staged.delete(uri);
  }
}

export const webPhotos: PhotoService = {
  pick: async () => {
    throw new Error("浏览器需使用文件选择器");
  },
  stageFiles,
  list,
  assign,
  thumbnail,
  open: async () => {
    throw new Error("浏览器需使用页面内预览");
  },
  original,
  remove,
  releaseUnlinked,
};
