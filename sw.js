// TerraLens service worker. Bump CACHE_VERSION to force clients to update.
const CACHE_VERSION = "terralens-v2";
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

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { try { data = { title: event.data ? String(event.data.text() || "") : "" }; } catch { data = {}; } }
  const title = String(data.title || "TerraLens: new notification");
  const body = String(data.body || "");
  const url = String(data.url || data.link || "/notifications.html");
  event.waitUntil((async () => {
    await self.registration.showNotification(title, {
      body,
      icon: "/assets/icon-192.png",
      badge: "/assets/icon-192.png",
      data: { url: url.startsWith("/") ? url : "/" + url },
      tag: String(data.tag || "terralens-notif"),
      renotify: true
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = (event.notification && event.notification.data && event.notification.data.url) || "/notifications.html";
  const target = new URL(String(raw).startsWith("/") ? String(raw) : "/" + String(raw), self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) {
      try {
        const u = new URL(w.url);
        if (u.origin === self.location.origin) { try { await w.navigate(target); } catch {} w.focus(); return; }
      } catch {}
    }
    self.clients.openWindow(target);
  })());
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
  // admin.html is never served stale: always try the network first and never
  // store it, so a fixed guard ships the moment it is deployed.
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        if (!url.pathname.endsWith("/admin.html") && url.pathname !== "/admin.html") {
          const copy = fresh.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy)).catch(() => {});
        }
        return fresh;
      } catch {
        if (url.pathname.endsWith("admin.html")) throw new Error("offline admin");
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
