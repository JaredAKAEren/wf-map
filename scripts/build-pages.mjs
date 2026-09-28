import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

const root = new URL("../dist/", import.meta.url);
const base = "/wf-map/";

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await filesIn(path)));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }

  return files;
}

const manifest = {
  name: "WF 逛展地图",
  short_name: "WF MAP",
  description: "可离线使用的 WF 展馆地图与展位贴图",
  start_url: base,
  scope: base,
  display: "standalone",
  background_color: "#f0ede7",
  theme_color: "#f0ede7",
  icons: [
    { src: `${base}icons/icon-192.png`, sizes: "192x192", type: "image/png" },
    { src: `${base}icons/icon-512.png`, sizes: "512x512", type: "image/png" },
  ],
};

await writeFile(new URL("manifest.webmanifest", root), JSON.stringify(manifest, null, 2));

const htmlPath = new URL("index.html", root);
const html = await readFile(htmlPath, "utf8");
await writeFile(
  htmlPath,
  html.replace(
    "</head>",
    `    <link rel="manifest" href="${base}manifest.webmanifest" />\n    <link rel="apple-touch-icon" href="${base}icons/icon-192.png" />\n  </head>`,
  ),
);

const paths = (await filesIn(root.pathname))
  .map((path) => {
    return relative(root.pathname, path).replaceAll("\\", "/");
  })
  .filter((path) => {
    return path !== "sw.js";
  })
  .toSorted();

for (const hall of ["W1", "W2", "W3", "W4", "W5"]) {
  if (!paths.includes(`maps/${hall}.png`)) {
    throw new Error(`Pages 构建缺少 ${hall} 底图`);
  }
}

const hash = createHash("sha256");
for (const path of paths) {
  hash.update(path);
  hash.update(await readFile(new URL(path, root)));
}

const cacheName = `wf-map-pages-${hash.digest("hex").slice(0, 16)}`;
const serviceWorker = `const cacheName = ${JSON.stringify(cacheName)};
const precache = ${JSON.stringify(paths)};
const base = ${JSON.stringify(base)};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(cacheName).then((cache) => {
      return cache.addAll(precache.map((path) => new URL(path, self.registration.scope)));
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(async (names) => {
      await Promise.all(names.filter((name) => name.startsWith("wf-map-pages-") && name !== cacheName).map((name) => caches.delete(name)));
      await self.clients.claim();
    }),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || !url.pathname.startsWith(base)) {
    return;
  }

  event.respondWith(
    caches.open(cacheName).then(async (cache) => {
      if (request.mode === "navigate") {
        return (await cache.match(new URL("index.html", self.registration.scope))) ?? fetch(request);
      }

      return (await cache.match(request.url, { ignoreVary: true })) ?? fetch(request);
    }),
  );
});
`;

await writeFile(new URL("sw.js", root), serviceWorker);
