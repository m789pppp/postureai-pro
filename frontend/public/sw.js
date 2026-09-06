// Corvus — Service Worker v10
//
// v10 fixes a cache-poisoning bug that made static files permanently
// unreachable in a browser that had once asked for them before they existed.
//
// The chain: this app is served by Vercel with a catch-all SPA rewrite, so a
// request for a file that is NOT in the deployment does not 404 — it returns
// index.html with **200 OK**. The static-asset branch below then saw res.ok,
// cached that HTML under the file's URL, and served it cache-first from then
// on. Because these paths are not content-hashed (/exercises/*.webp,
// /icon-192.png, /manifest.json …), the poisoned entry was never invalidated:
// the file could ship in a later deploy and that browser would still be handed
// the old HTML forever. An <img> pointed at it keeps its layout box and paints
// nothing — a blank white rectangle where the picture should be, which is
// exactly how it surfaced on the break screen's sitting reference.
//
// Three changes:
//   1. Never store a response whose type does not match the request (an HTML
//      body answering an image/font/script request is the SPA fallback, not
//      the asset).
//   2. Never serve such an entry either, so browsers already carrying a
//      poisoned cache heal on the next load instead of waiting for the version
//      bump to reach them.
//   3. Unhashed paths use stale-while-revalidate rather than cache-first, so a
//      deploy actually reaches them. Content-hashed /assets/ files keep the
//      immutable cache-first path — their URL changes when they do.
const CACHE_VER = "corvus-v10";
const MP_CACHE  = "mediapipe-v3";

// True when a response is an HTML document. For a non-navigation request that
// means the server answered with the SPA shell instead of the file.
function isHtml(res) {
  const t = res && res.headers && res.headers.get("content-type");
  return !!t && t.includes("text/html");
}

// Content-hashed by the bundler: the URL changes whenever the bytes do, so
// these are safe to keep forever. Everything else is a stable path.
function isImmutable(url) {
  return url.pathname.startsWith("/assets/");
}

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

  // Static assets.
  //
  // Only a response that is actually the asset gets stored: an HTML body for a
  // .webp/.woff2/.js request is the SPA fallback for a path this deployment
  // does not have, and caching it is what made a missing file stay missing
  // forever. A cached entry that is HTML is likewise ignored on read, which is
  // what heals a browser whose cache was poisoned by an earlier version.
  const storable = res => res && res.ok && res.status === 200 &&
                          res.type !== "opaque" && !isHtml(res);

  e.respondWith(
    caches.match(e.request).then(cached => {
      const usable = cached && !isHtml(cached) ? cached : null;

      const network = fetch(e.request).then(res => {
        if (storable(res)) {
          const clone = res.clone();
          caches.open(CACHE_VER).then(c => c.put(e.request, clone)).catch(() => {});
        } else if (cached) {
          // The path no longer serves the asset (or serves the SPA shell).
          // Drop the stale entry rather than keeping it alive indefinitely.
          if (isHtml(res)) caches.open(CACHE_VER).then(c => c.delete(e.request)).catch(() => {});
        }
        return res;
      });

      // Hashed filenames can never go stale, so a hit is the whole answer.
      // Stable paths revalidate in the background: the user still gets the
      // instant cached response, and the next load has the new bytes.
      if (usable && isImmutable(url)) return usable;
      if (usable) { network.catch(() => {}); return usable; }
      return network;
    })
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
