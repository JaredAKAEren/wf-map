import { Capacitor, registerPlugin } from "@capacitor/core";

import { webPhotos } from "./web-photos";

export interface Photo {
  uri: string;
  boothId: string;
  createdAt: number;
}
export interface PhotoService {
  pick(): Promise<{ uris: string[]; failed: number }>;
  stageFiles(files: readonly File[]): Promise<{ uris: string[]; failed: number }>;
  list(options: { boothId: string }): Promise<{ photos: Photo[] }>;
  listBooths(): Promise<{ boothIds: string[] }>;
  assign(options: {
    uri: string;
    boothId: string;
    replace: boolean;
  }): Promise<{ conflict?: string }>;
  thumbnail(options: { uri: string }): Promise<{ dataUrl: string }>;
  open(options: { uri: string }): Promise<void>;
  original(options: { uri: string }): Promise<Blob>;
  remove(options: { uri: string }): Promise<void>;
  releaseUnlinked(options: { uris: string[] }): Promise<void>;
}

export const nativePhotos = Capacitor.getPlatform() === "android";
const nativePlugin = registerPlugin<PhotoService>("ExhibitionPhotos");
const service = nativePhotos ? nativePlugin : webPhotos;
const changeListeners = new Set<() => void>();

export function onPhotosChanged(listener: () => void) {
  changeListeners.add(listener);

  return () => {
    changeListeners.delete(listener);
  };
}

function notifyChange() {
  for (const listener of changeListeners) {
    listener();
  }
}

export const photos: PhotoService = {
  pick: () => {
    return service.pick();
  },
  stageFiles: (files) => {
    return service.stageFiles(files);
  },
  list: (options) => {
    return service.list(options);
  },
  listBooths: () => {
    return service.listBooths();
  },
  assign: async (options) => {
    const result = await service.assign(options);
    if (!result.conflict) {
      notifyChange();
    }

    return result;
  },
  thumbnail: (options) => {
    return service.thumbnail(options);
  },
  open: (options) => {
    return service.open(options);
  },
  original: (options) => {
    return service.original(options);
  },
  remove: async (options) => {
    await service.remove(options);
    notifyChange();
  },
  releaseUnlinked: (options) => {
    return service.releaseUnlinked(options);
  },
};
