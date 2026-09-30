// Offline support for the customer Studio (studio.html registers ./sw.js and asks CHECK_OFFLINE).
// Scope is the site root, so only studio.html is intercepted; every other request goes straight to the network.
const CACHE = "modernite-studio-v1";
const STUDIO = new URL("studio.html", self.registration.scope).pathname;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(STUDIO)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("modernite-studio-") && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || url.pathname !== STUDIO) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(STUDIO, copy));
        }
        return response;
      })
      .catch(() => caches.match(STUDIO).then((cached) => cached || Response.error())),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CHECK_OFFLINE" || !event.ports[0]) return;
  caches.match(STUDIO).then((cached) => event.ports[0].postMessage({ ready: Boolean(cached) }));
});
