// Service Worker for Coco Squad PWA
const CACHE_NAME = "coco-squad-v1.0.2";
const PRECACHE_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/favicon.ico"
];

// 1. Install Event: Skip waiting to activate immediately without waiting for old tabs to close
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn("[SW] Precaching warning:", err);
      });
    })
  );
});

// 2. Activate Event: Claim all clients immediately and purge old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              console.log("[SW] Deleting old cache:", key);
              return caches.delete(key);
            }
          })
        );
      })
    ])
  );
});

// 3. Fetch Event: Exclude /api/* and /version.json from persistent cache
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // STRICT EXCLUSION:
  // - All /api/* endpoints (live backend data, webhooks, chat, agents)
  // - /version.json (and any URL containing version.json or timestamp queries)
  // - Non-GET requests (POST, PUT, DELETE)
  // - External backend endpoints (Oracle Staging 150.136.59.173)
  if (
    request.method !== "GET" ||
    url.pathname.startsWith("/api/") ||
    url.pathname === "/version.json" ||
    url.pathname.endsWith("/version.json") ||
    url.searchParams.has("t") ||
    url.hostname !== self.location.hostname
  ) {
    // Direct network pass-through, completely bypassing the cache
    return;
  }

  // Network-first for HTML pages to ensure updates are served, Cache-first / Stale-while-revalidate for assets
  const isHtml = request.headers.get("accept")?.includes("text/html");

  if (isHtml) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/index.html")))
    );
    return;
  }

  // Stale-while-revalidate for static scripts, styles and assets
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === "basic") {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
