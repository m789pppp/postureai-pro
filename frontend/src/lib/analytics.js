/**
 * Corvus — Analytics & Monitoring
 * PostHog: product analytics, funnels, feature flags
 * Sentry: error tracking, performance monitoring
 */

const POSTHOG_KEY  = import.meta.env.VITE_POSTHOG_KEY  || "";
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || "https://app.posthog.com";
const SENTRY_DSN   = import.meta.env.VITE_SENTRY_DSN   || "";
const ENV          = import.meta.env.MODE || "development";

// ── PostHog ───────────────────────────────────────────────────────
let _ph = null;

export async function initAnalytics() {
  if (!POSTHOG_KEY || ENV === "development") return;
  try {
    const { default: posthog } = await import("posthog-js");
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      persistence: "localStorage+cookie",
      autocapture: true,
      capture_pageview: true,
      capture_pageleave: true,
      loaded: (ph) => {
        _ph = ph;
        window.posthog = ph;
      },
      // GDPR: respect cookie consent
      respect_dnt: true,
      opt_out_capturing_by_default: false,
    });
  } catch (e) {
    console.warn("PostHog init failed:", e);
  }
}

export function identify(userId, traits = {}) {
  if (_ph) {
    _ph.identify(userId, {
      email: traits.email,
      name: traits.name,
      plan: traits.tier || traits.plan,
      org_id: traits.org_id,
      is_trial: traits.is_trial,
      created_at: traits.created_at,
    });
  }
}

export function track(event, props = {}) {
  if (_ph) {
    _ph.capture(event, {
      ...props,
      env: ENV,
      timestamp: new Date().toISOString(),
    });
  }
}

export function trackPage(path) {
  if (_ph) _ph.capture("$pageview", { $current_url: path });
}

export function reset() {
  if (_ph) _ph.reset();
}

export function isFeatureEnabled(flag) {
  if (!_ph) return false;
  return _ph.isFeatureEnabled(flag);
}

// ── Sentry ────────────────────────────────────────────────────────
export async function initSentry() {
  if (!SENTRY_DSN || ENV === "development") return;
  try {
    const Sentry = await import("@sentry/react");
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: ENV,
      release: `corvus@${import.meta.env.VITE_APP_VERSION || "0.0.0"}`,
      tracesSampleRate: ENV === "production" ? 0.1 : 1.0,
      // Don't send PII
      beforeSend(event) {
        if (event.request?.cookies) delete event.request.cookies;
        return event;
      },
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
      ],
      replaysSessionSampleRate: 0.05,
      replaysOnErrorSampleRate: 1.0,
    });
  } catch (e) {
    console.warn("Sentry init failed:", e);
  }
}

export function captureError(error, context = {}) {
  try {
    import("@sentry/react").then(Sentry => {
      Sentry.withScope(scope => {
        Object.entries(context).forEach(([k, v]) => scope.setExtra(k, v));
        Sentry.captureException(error);
      });
    });
  } catch {}
}

export function setSentryUser(user) {
  try {
    import("@sentry/react").then(Sentry => {
      Sentry.setUser(user ? { id: user.uid || user.id, email: user.email } : null);
    });
  } catch {}
}

// ── Conversion tracking ───────────────────────────────────────────
export const events = {
  signupStarted:    (source)   => track("signup_started",     { source }),
  signupCompleted:  (method)   => track("signup_completed",   { method }),
  loginCompleted:   (method)   => track("login_completed",    { method }),
  analysisStarted:  (mode)     => track("analysis_started",   { mode }),
  analysisCompleted:(score)    => track("analysis_completed", { score }),
  upgradeCTAClicked:(plan,from)=> track("upgrade_cta_clicked",{ plan, from_plan:from }),
  checkoutStarted:  (plan,cycle)=>track("checkout_started",   { plan, billing_cycle:cycle }),
  checkoutCompleted:(plan,amt) => track("checkout_completed", { plan, amount:amt }),
  reportGenerated:  (type)     => track("report_generated",   { type }),
  teamMemberInvited:()         => track("team_member_invited"),
  featureUsed:      (feature)  => track("feature_used",       { feature }),
  landingCTAClicked:(cta)      => track("landing_cta_clicked",{ cta }),
};
