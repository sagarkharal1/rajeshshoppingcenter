const CACHE_NAME = "rajesh-shopping-center-v2";
const APP_SHELL = ["/", "/manifest.webmanifest", "/app-icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

   const url = new URL(request.url);
   const isDocument = request.mode === "navigate" || request.destination === "document";
   const isApi = url.pathname.startsWith("/api/");
   const isAsset =
     request.destination === "script" ||
     request.destination === "style" ||
     request.destination === "image" ||
     request.destination === "font";

   if (isApi || isDocument) {
     event.respondWith(
       fetch(request).catch(() => caches.match(request)).then((response) => response || caches.match("/")),
     );
     return;
   }

   if (!isAsset) {
     return;
   }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            if (request.url.startsWith(self.location.origin)) {
              cache.put(request, copy).catch(() => {});
            }
          });
          return response;
        })
        .catch(() => caches.match("/"));
    }),
  );
});
