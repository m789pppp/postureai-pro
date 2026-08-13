// Corvus — Service Worker v8 — guards against non-http(s) cache.put() errors
const CACHE_VER = "corvus-v8";
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

// Activate — delete old caches
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

  // Cache API only accepts http(s) — a page can trigger fetches with other
  // schemes (chrome-extension://, etc, e.g. from an installed browser
  // extension's own content scripts) which this listener was intercepting
  // and then crashing on when it reached cache.put() further down.
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // CRITICAL: Never intercept POST/PUT/PATCH/DELETE — body already consumed
  // This fixes "Response body is already used" error on /api/llm
  if (e.request.method !== "GET") return;

  // The Cache API only supports http(s) requests — browser extensions can
  // inject chrome-extension:// (or other non-http) requests into the page's
  // fetch activity, and caches.put() throws a TypeError on those, which was
  // an uncaught promise rejection every time it happened.
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // Never intercept Firebase / Google / payment APIs
  if (
    url.hostname.includes("firebase") ||
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("firestore") ||
    url.hostname.includes("stripe.com") ||
    url.hostname.includes("paymob.com") ||
    url.hostname.includes("llm7.io")
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

  // API GET requests — always network, never cache
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(fetch(e.request));
    return;
  }

  // HTML (SPA routes) — network first, cache as fallback
  if (
    e.request.mode === "navigate" ||
    e.request.headers.get("accept")?.includes("text/html")
  ) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_VER).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Static assets (JS/CSS/images with hashed names) — cache first
  e.respondWith(
    caches.match(e.request).then(cached =>
      cached || fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_VER).then(c => c.put(e.request, clone));
        }
        return res;
      })
    )
  );
});

// Force activate
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
