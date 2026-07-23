import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "./ErrorBoundary.jsx";
import "./index.css";

// ── Stale-deployment recovery ──────────────────────────────────────
// Vite fires this event whenever a dynamic import() (PDF export, a
// lazy-loaded standalone page, etc.) fails to fetch its chunk because
// the tab was left open across a newer deployment — the old hashed
// filename the running page still references no longer exists on the
// server. A single forced reload fetches the current index.html with
// correct references and fully resolves it, instead of surfacing a
// raw "Failed to fetch dynamically imported module" error to the user.
// Guarded with a timestamp (not just a one-shot flag) so a *genuinely*
// broken/offline case can't reload-loop forever, while still allowing
// recovery from more than one stale chunk per session if needed.
window.addEventListener("vite:preloadError", (e) => {
  e.preventDefault();
  const key = "corvus_chunk_reload_at";
  const last = Number(sessionStorage.getItem(key) || 0);
  if (Date.now() - last > 10000) {
    sessionStorage.setItem(key, String(Date.now()));
    window.location.reload();
  }
});

// ── Apply dark class immediately to prevent flash ─────────────────
try {
  const dark = localStorage.getItem("darkMode");
  const isDark = dark !== null ? dark === "true" : true;
  document.body.classList.add(isDark ? "dark" : "light");
} catch {}

// ── Sentry: init before render ────────────────────────────────────
import { initSentry } from "./Observability.jsx";
initSentry().catch(() => {});

// ── PWA: Service Worker ───────────────────────────────────────────
// Force clear old SW + caches when CSP or SW version changes
(async function clearOldAssets() {
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(r => r.unregister()));
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
  } catch {}
})();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js")
      .then(reg => {
        // Check for updates immediately on load
        reg.update().catch(() => {});
        reg.addEventListener("updatefound", () => {
          const worker = reg.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed") {
              // New SW ready — force activate immediately (skip waiting)
              worker.postMessage({ type: "SKIP_WAITING" });
              window.dispatchEvent(new CustomEvent("sw-update-available"));
            }
          });
        });
      })
      .catch(() => {});
    // Reload when new SW takes control
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.location.reload();
    });
  });
}

// ── Desktop notification permission (on first user interaction) ───
if ("Notification" in window && Notification.permission === "default") {
  document.addEventListener("click", () => {
    Notification.requestPermission().catch(() => {});
  }, { once: true });
}

// ── Render ────────────────────────────────────────────────────────
// Route /report/:token → SharedReportPage (public, no login)
// All other paths → normal App
const path = window.location.pathname;

// ── Preload hints for faster navigation ──────────────────────────
function preloadChunk(href) {
  const link = document.createElement('link');
  link.rel = 'modulepreload';
  link.href = href;
  document.head.appendChild(link);
}

// Prefetch firebase-auth on all pages (always needed after login)
// Use requestIdleCallback to not block initial render
if ('requestIdleCallback' in window) {
  requestIdleCallback(() => {
    // Preconnect to Firebase
    ['https://firestore.googleapis.com',
     'https://identitytoolkit.googleapis.com',
     'https://securetoken.googleapis.com'].forEach(url => {
      const l = document.createElement('link');
      l.rel = 'preconnect';
      l.href = url;
      document.head.appendChild(l);
    });
  }, { timeout: 2000 });
}

const STANDALONE_ROUTES = {
  "/product":     () => import("./ProductPage.jsx"),
  "/solutions":   () => import("./SolutionsPage.jsx"),
  "/pricing":     () => import("./PricingPageLP.jsx"),
  "/how-it-works":() => import("./HowItWorksPage.jsx"),
  "/faq":         () => import("./FAQPage.jsx"),
};

const standaloneLoader = STANDALONE_ROUTES[path];

// If a top-level entry chunk resolves but its default export is missing
// (stale CDN chunk after a new deploy — same class of bug as the
// vite:preloadError case above, just caught one step later since the
// fetch itself succeeded), force one guarded reload instead of calling
// createRoot().render(<undefined/>), which is what threw the minified
// React error #306 in production.
function reloadOnceForStaleChunk() {
  const key = "corvus_stale_entry_reload";
  if (!sessionStorage.getItem(key)) {
    sessionStorage.setItem(key, "1");
    window.location.reload();
    return true;
  }
  return false;
}

if (path.startsWith("/report/")) {
  import("./SharedReportPage.jsx").then(({ default: SharedReportPage }) => {
    if (!SharedReportPage) { if (reloadOnceForStaleChunk()) return; }
    createRoot(document.getElementById("root")).render(
      <StrictMode><ErrorBoundary><SharedReportPage /></ErrorBoundary></StrictMode>
    );
  });
} else if (standaloneLoader) {
  standaloneLoader().then(({ default: Page }) => {
    if (!Page) { if (reloadOnceForStaleChunk()) return; }
    createRoot(document.getElementById("root")).render(
      <StrictMode><ErrorBoundary><Page /></ErrorBoundary></StrictMode>
    );
  });
} else {
  import("./App.jsx").then(({ default: App }) => {
    if (!App) { if (reloadOnceForStaleChunk()) return; }
    createRoot(document.getElementById("root")).render(
      <StrictMode>
        <ErrorBoundary>
          <Suspense fallback={
            <div style={{ position:"fixed", inset:0, display:"flex", alignItems:"center",
              justifyContent:"center", background:"#030b14", color:"#64748b", fontSize:14 }}>
              Loading…
            </div>
          }>
            <App />
          </Suspense>
        </ErrorBoundary>
      </StrictMode>
    );
  });
}

// ── PostHog Product Analytics ─────────────────────────────────────
// Install: npm install posthog-js
// Set VITE_POSTHOG_KEY in .env.local
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
if (POSTHOG_KEY && typeof window !== "undefined") {
  import("posthog-js").then(({ default: posthog }) => {
    posthog.init(POSTHOG_KEY, {
      api_host:              import.meta.env.VITE_POSTHOG_HOST || "https://app.posthog.com",
      capture_pageview:      true,
      capture_pageleave:     true,
      autocapture:           false,   // manual capture for GDPR
      persistence:           "localStorage",
      session_recording:     { maskAllInputs: true, maskTextSelector: "input, .sensitive" },
      loaded: (ph) => {
        if (import.meta.env.DEV) ph.opt_out_capturing();
      },
    });
    window._posthog = posthog;
  }).catch(() => {});
}

// Usage helper — call from any component:
// window._posthog?.capture("session_started", { mode: "laptop", plan: "pro" });
// window._posthog?.identify(uid, { email, plan });

// ── Crisp In-App Chat Support ──────────────────────────────────────
// Crisp is GDPR-compliant, supports Arabic RTL, and has a generous free tier
// Set VITE_CRISP_WEBSITE_ID in .env.local to activate
const CRISP_ID = import.meta.env.VITE_CRISP_WEBSITE_ID;
if (CRISP_ID && typeof window !== "undefined") {
  window.$crisp = [];
  window.CRISP_WEBSITE_ID = CRISP_ID;
  const d = document;
  const s = d.createElement("script");
  s.src = "https://client.crisp.chat/l.js";
  s.async = true;
  d.getElementsByTagName("head")[0].appendChild(s);

  // Helper to identify user when logged in (call from App.jsx after auth)
  window._crispIdentify = (user) => {
    if (!window.$crisp || !user) return;
    window.$crisp.push(["set", "user:email",    [user.email]]);
    window.$crisp.push(["set", "user:nickname",  [user.name || user.email]]);
    window.$crisp.push(["set", "session:data",  [[
      ["plan",      user.plan || "starter"],
      ["org",       user.orgName || ""],
      ["avg_score", user.avgScore || 0],
      ["streak",    user.streak || 0],
    ]]]);
  };
}
