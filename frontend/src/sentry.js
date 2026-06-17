/**
 * sentry.js — Corvus ULTIMATE v12
 * Frontend Sentry initialization. Import once in main.jsx.
 * Set VITE_SENTRY_DSN in Vercel environment variables.
 */
import * as Sentry from "@sentry/react";

const DSN = import.meta.env.VITE_SENTRY_DSN;
const ENV = import.meta.env.VITE_APP_ENV || import.meta.env.MODE;

export function initSentry() {
  if (!DSN) {
    console.info("[Sentry] No DSN configured — skipping (set VITE_SENTRY_DSN in Vercel)");
    return;
  }
  Sentry.init({
    dsn:         DSN,
    environment: ENV,
    release:     `corvus@${import.meta.env.__APP_VERSION__ || "unknown"}`,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText:   true,   // GDPR: mask PII
        blockAllMedia: false,
      }),
    ],
    tracesSampleRate:   ENV === "production" ? 0.1 : 1.0,
    replaysSessionSampleRate:   0.05,  // 5% of sessions
    replaysOnErrorSampleRate:   1.0,   // 100% on error
    beforeSend(event) {
      // Strip any auth tokens from breadcrumbs
      if (event.request?.headers?.Authorization) {
        event.request.headers.Authorization = "[REDACTED]";
      }
      return event;
    },
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "Network request failed",
      "ChunkLoadError",
    ],
  });
  console.info(`[Sentry] Initialized — env: ${ENV}`);
}

export function identifyUser(uid, email, plan) {
  if (!DSN) return;
  Sentry.setUser({ id: uid, email, plan });
}

export function captureError(err, context = {}) {
  if (!DSN) { console.error("[App Error]", err, context); return; }
  Sentry.withScope(scope => {
    scope.setExtras(context);
    Sentry.captureException(err);
  });
}
