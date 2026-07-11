const CACHE_NAME = "mockverse-cache-v1";
const urlsToCache = [
  "/",
  "/index.html",
  "/manifest.json",
  "/img1.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener("fetch", (event) => {
  // Skip caching API network operations
  if (event.request.url.includes("/api/") || event.request.url.includes("openrouter.ai")) {
    return;
  }
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
