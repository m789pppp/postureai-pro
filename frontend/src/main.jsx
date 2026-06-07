import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { ErrorBoundary } from "./ErrorBoundary.jsx";
import "./index.css";

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
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js")
      .then(reg => {
        reg.addEventListener("updatefound", () => {
          const worker = reg.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              // Show in-app update banner — dispatched to App.jsx
              window.dispatchEvent(new CustomEvent("sw-update-available"));
            }
          });
        });
      })
      .catch(() => {}); // Silent fail — app works without SW
  });
}

// ── Desktop notification permission (on first user interaction) ───
if ("Notification" in window && Notification.permission === "default") {
  document.addEventListener("click", () => {
    Notification.requestPermission().catch(() => {});
  }, { once: true });
}

// ── Render ────────────────────────────────────────────────────────
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);

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
