// Corvus — Service Worker v5 — Network First for HTML (fixes stale deploy issue)
const CACHE_VER = "corvus-v5-__DEPLOY_TIME__";
const MP_CACHE  = "mediapipe-v3";

const MP_ASSETS = [
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs",
];

// Install
self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(MP_CACHE).then(c => c.addAll(MP_ASSETS).catch(() => {}))
  );
});

// Activate — delete ALL old caches
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== MP_CACHE && k !== CACHE_VER)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  // Never intercept Firebase / Google APIs
  if (
    url.hostname.includes("firebase") ||
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("groq.com") ||
    url.hostname.includes("stripe.com") ||
    url.hostname.includes("paymob.com")
  ) return;

  // MediaPipe CDN — cache forever (large files, never change)
  if (url.hostname.includes("jsdelivr.net") || url.hostname.includes("mediapipe")) {
    e.respondWith(
      caches.open(MP_CACHE).then(c =>
        c.match(e.request).then(cached =>
          cached || fetch(e.request).then(res => {
            if (res.ok) c.put(e.request, res.clone());
            return res;
          })
        )
      )
    );
    return;
  }

  // API — always network, never cache
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ error: "Offline", offline: true }), {
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    return;
  }

  // HTML (index.html + SPA routes) — NETWORK FIRST, cache as fallback only
  // This ensures new deploys are always visible immediately
  if (
    e.request.mode === "navigate" ||
    e.request.headers.get("accept")?.includes("text/html")
  ) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          // Update cache with fresh version
          if (res.ok) {
            caches.open(CACHE_VER).then(c => c.put(e.request, res.clone()));
          }
          return res;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Static assets (JS/CSS/images) — cache first (they have hashed filenames)
  e.respondWith(
    caches.match(e.request).then(cached =>
      cached || fetch(e.request).then(res => {
        if (res.ok && e.request.method === "GET") {
          caches.open(CACHE_VER).then(c => c.put(e.request, res.clone()));
        }
        return res;
      })
    )
  );
});

// Force activate when main thread requests it
self.addEventListener("message", e => {
  if (e.data?.type === "SKIP_WAITING") self.skipWaiting();
});

// Push notifications
self.addEventListener("push", e => {
  const data = e.data?.json() || {};
  e.waitUntil(
    self.registration.showNotification(data.title || "Corvus", {
      body:  data.body || "Time to check your posture!",
      icon:  "/icon-192.png",
      badge: "/icon-192.png",
      tag:   data.tag || "corvus",
      data:  { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data?.url || "/"));
});
