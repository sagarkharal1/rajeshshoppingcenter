const CACHE_NAME = "rajesh-shopping-center-v3";
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

   // API calls must never fall back to the cached homepage: returning HTML for
   // a JSON request turns a network failure into a confusing parse error, and
   // the app renders it as "no data" instead of "you are offline".
   if (isApi) {
     event.respondWith(
       fetch(request).catch(
         () =>
           new Response(JSON.stringify({ error: "offline" }), {
             status: 503,
             headers: { "Content-Type": "application/json" },
           }),
       ),
     );
     return;
   }

   if (isDocument) {
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
