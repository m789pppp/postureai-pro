// Corvus — Service Worker v4 — Full PWA + Offline Support
const CACHE_VER   = "corvus-v4";
const MP_CACHE    = "mediapipe-v3";
const DATA_CACHE  = "corvus-data-v2";

const SHELL = [
  "/", "/index.html", "/manifest.json",
  "/icon-192.png", "/icon-512.png",
];

const MP_ASSETS = [
  "https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.min.js",
  "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.min.js",
];

// Install — cache shell
self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_VER).then(c => c.addAll(SHELL).catch(() => {}))
  );
});

// Activate — clean old caches
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => ![CACHE_VER, MP_CACHE, DATA_CACHE].includes(k)).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy: Cache First for assets, Network First for API
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  // Never intercept Firebase / Gemini
  if (url.hostname.includes("firebase") || url.hostname.includes("googleapis.com")) return;

  // MediaPipe CDN — cache forever
  if (url.hostname.includes("jsdelivr.net") || url.hostname.includes("mediapipe")) {
    e.respondWith(
      caches.open(MP_CACHE).then(c =>
        c.match(e.request).then(cached =>
          cached || fetch(e.request).then(res => { if (res.ok) c.put(e.request, res.clone()); return res; })
        )
      )
    );
    return;
  }

  // API calls — network first, fallback to offline response
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(
      fetch(e.request.clone()).catch(() =>
        new Response(JSON.stringify({ error: "Offline — request queued", offline: true }), {
          headers: { "Content-Type": "application/json" }
        })
      )
    );
    return;
  }

  // App shell — cache first, fallback to network
  e.respondWith(
    caches.match(e.request).then(cached =>
      cached || fetch(e.request).then(res => {
        if (res && res.ok && e.request.method === "GET") {
          caches.open(CACHE_VER).then(c => c.put(e.request, res.clone()));
        }
        return res;
      }).catch(() => caches.match("/index.html"))
    )
  );
});

// Background sync for offline session data
self.addEventListener("sync", e => {
  if (e.tag === "sync-sessions") {
    e.waitUntil(syncOfflineSessions());
  }
});

async function syncOfflineSessions() {
  try {
    const cache = await caches.open(DATA_CACHE);
    const keys  = await cache.keys();
    for (const req of keys) {
      const res  = await cache.match(req);
      const data = await res.json();
      const r    = await fetch("/api/session/sync", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (r.ok) await cache.delete(req);
    }
  } catch {}
}

// Push notifications
self.addEventListener("push", e => {
  const data = e.data?.json() || {};
  e.waitUntil(
    self.registration.showNotification(data.title || "Corvus", {
      body:    data.body || "Time to check your posture!",
      icon:    "/icon-192.png",
      badge:   "/icon-192.png",
      tag:     data.tag || "corvus",
      data:    { url: data.url || "/" },
      actions: [
        { action: "open",   title: "Open app" },
        { action: "dismiss",title: "Dismiss" },
      ],
    })
  );
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  if (e.action !== "dismiss") {
    e.waitUntil(clients.openWindow(e.notification.data?.url || "/"));
  }
});
