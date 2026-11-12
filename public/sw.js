const CACHE_NAME = "kcc-pwa-static-v1";
const PRECACHE_ASSETS = [
  "/offline.html",
  "/logo_brand.png",
  "/pwa-192x192.png",
  "/pwa-512x512.png",
  "/pwa-maskable-512x512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(PRECACHE_ASSETS);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheKeys = await caches.keys();
      await Promise.all(
        cacheKeys
          .filter(
            (key) => key.startsWith("kcc-pwa-") && key !== CACHE_NAME,
          )
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // Dokumen HTML selalu diminta ke server. Jika offline, hanya tampilkan
  // halaman offline generik; jangan menyimpan halaman akun atau halaman kelas.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const offlinePage = await caches.match("/offline.html");
        return offlinePage || Response.error();
      }),
    );
    return;
  }

  // Jangan cache API, autentikasi, data RSC halaman privat, atau workspace.
  const privatePaths = [
    /^\/api(?:\/|$)/,
    /^\/admin(?:\/|$)/,
    /^\/mentor(?:\/|$)/,
    /^\/dashboard(?:\/|$)/,
    /^\/checkout(?:\/|$)/,
    /^\/auth(?:\/|$)/,
    /^\/login(?:\/|$)/,
    /^\/register(?:\/|$)/,
    /^\/reset-password(?:\/|$)/,
    /^\/kelas\/[^/]+\/belajar(?:\/|$)/,
  ];

  if (privatePaths.some((pattern) => pattern.test(url.pathname))) {
    return;
  }

  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    /\.(?:css|js|mjs|woff2?|png|jpe?g|gif|svg|webp|ico)$/i.test(
      url.pathname,
    );

  if (!isStaticAsset) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(request);

      if (cachedResponse) return cachedResponse;

      const networkResponse = await fetch(request);

      if (networkResponse.ok && networkResponse.type === "basic") {
        await cache.put(request, networkResponse.clone());
      }

      return networkResponse;
    })(),
  );
});
