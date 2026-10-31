// TerraLens service worker. Bump CACHE_VERSION to force clients to update.
const CACHE_VERSION = "terralens-v1";
const CORE = [
  "/index.html",
  "/manifest.webmanifest",
  "/assets/icon-192.png",
  "/assets/icon-512.png",
  "/assets/apple-touch-icon.png",
  "/src/styles/tailwind.css",
  "/src/styles/app.css"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Live backends are network-only and never cached.
function isLiveBackend(url) {
  return url.pathname.startsWith("/api/")
    || url.hostname.includes("supabase")
    || url.hostname === "esm.sh"
    || url.hostname.endsWith(".esm.sh");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (isLiveBackend(url)) {
    event.respondWith(fetch(req));
    return;
  }
  if (url.origin !== self.location.origin) return;
  // Navigations: network first, fall back to cache, then the offline page.
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const copy = fresh.clone();
        caches.open(CACHE_VERSION).then((c) => c.put(req, copy)).catch(() => {});
        return fresh;
      } catch {
        return (await caches.match(req)) || (await caches.match("/index.html"));
      }
    })());
    return;
  }
  // Static app shell (assets, styles, scripts): cache first.
  event.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    const fresh = await fetch(req);
    if (fresh && fresh.status === 200) {
      const copy = fresh.clone();
      caches.open(CACHE_VERSION).then((c) => c.put(req, copy)).catch(() => {});
    }
    return fresh;
  })());
});
