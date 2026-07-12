const CACHE_NAME = "mockverse-cache-v2";

// Only pre-cache static manifest and icons (DO NOT pre-cache dynamic index.html or hashed files under /assets/)
const STATIC_ASSETS = [
  "/manifest.json",
  "/img1.png",
  "/favicon.ico"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("[SW] Pre-caching failed:", err);
      });
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("[SW] Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. Bypass non-GET requests and API/OAuth/payment calls
  if (
    request.method !== "GET" ||
    url.pathname.includes("/api/") ||
    url.hostname.includes("openrouter.ai") ||
    url.hostname.includes("firebase") ||
    url.hostname.includes("razorpay") ||
    url.hostname.includes("google")
  ) {
    return;
  }

  // 2. Navigation requests (HTML pages) -> Network First
  const isNavigation = request.mode === "navigate" || 
                       (request.headers.get("accept")?.includes("text/html"));

  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              // Cache index.html under the original request URL
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback: try to serve the cached page, fallback to cached '/index.html'
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            return caches.match("/index.html") || caches.match("/");
          });
        })
    );
    return;
  }

  // 3. Static & Hashed Assets (JS, CSS, images) -> Cache First with Network Fallback
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Asynchronously revalidate static assets (non-hashed) to keep them fresh
        if (!url.pathname.includes("/assets/")) {
          fetch(request).then((networkResponse) => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
            }
          }).catch(() => {});
        }
        return cachedResponse;
      }

      return fetch(request).then((networkResponse) => {
        if (networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        }
        return networkResponse;
      });
    })
  );
});
