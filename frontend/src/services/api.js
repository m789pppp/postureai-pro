/**
 * Corvus — API Service Layer v3
 * - Automatic token injection on every request
 * - 401 auto-refresh
 * - Timeout + AbortController

 * - Complete PaymentAPI + AIAPI surface
 */
import { auth } from "../firebase.js";
import { API_BASE_URL } from "../config/api.js";

const BASE_URL      = API_BASE_URL;
const DEFAULT_TIMEOUT = 20000; // 20s

// ── Token cache ────────────────────────────────────────────────────
let _cachedToken    = null;
let _tokenExp       = 0;
const TOKEN_BUFFER  = 60; // refresh 60s before expiry

export async function getAuthToken() {
  const user = auth.currentUser;
  if (!user) return null;
  const now = Date.now() / 1000;
  if (_cachedToken && _tokenExp > now + TOKEN_BUFFER) return _cachedToken;
  try {
    const token   = await user.getIdToken(false);
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g,"+").replace(/_/g,"/")));
    _cachedToken  = token;
    _tokenExp     = payload.exp || (now + 3600);
    return token;
  } catch {
    const token   = await user.getIdToken(true);
    _cachedToken  = token;
    _tokenExp     = Date.now() / 1000 + 3600;
    return token;
  }
}

export function clearTokenCache() {
  _cachedToken = null;
  _tokenExp    = 0;
}

// ── Core fetch wrapper ─────────────────────────────────────────────
export async function apiFetch(path, options = {}) {
  const { timeout = DEFAULT_TIMEOUT, skipAuth = false, ...rest } = options;
  const controller = new AbortController();
  const timerId    = setTimeout(() => controller.abort(), timeout);

  const headers = { "Content-Type": "application/json", ...(rest.headers || {}) };

  if (!skipAuth) {
    const token = await getAuthToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...rest,
      headers,
      signal: controller.signal,
      body:   rest.body ? JSON.stringify(rest.body) : undefined,
    });
    clearTimeout(timerId);

    // Auto-refresh on 401
    if (response.status === 401 && !skipAuth) {
      clearTokenCache();
      const newToken = await getAuthToken();
      if (newToken) {
        headers["Authorization"] = `Bearer ${newToken}`;
        const retry = await fetch(`${BASE_URL}${path}`, {
          ...rest, headers,
          body: rest.body ? JSON.stringify(rest.body) : undefined,
        });
        if (!retry.ok) {
          const err = await retry.json().catch(() => ({}));
          throw Object.assign(new Error(err.error || `HTTP ${retry.status}`), { status: retry.status, upgrade: err.upgrade });
        }
        return _parseJsonOrThrow(retry);
      }
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw Object.assign(new Error(err.error || `HTTP ${response.status}`), {
        status:   response.status,
        upgrade:  err.upgrade,
        required: err.required,
      });
    }

    return _parseJsonOrThrow(response);
  } catch (e) {
    clearTimeout(timerId);
    if (e.name === "AbortError") throw Object.assign(new Error("Backend request timed out — analysis will use local engine"), { isBackendDown: true });
    if (e instanceof TypeError && e.message.includes("fetch")) throw Object.assign(new Error("Backend unreachable — using local posture engine"), { isBackendDown: true });
    throw e;
  }
}

// A 200-status response that isn't actually JSON almost always means the
// request never reached the backend at all — e.g. VITE_API_URL is empty/
// misconfigured so the fetch hit the frontend's own origin, and Vercel's
// SPA rewrite served index.html (starts with "<!doctype html>") with a
// 200 status instead of a 404. response.json() on that throws a raw,
// user-facing "Unexpected token '<' ... is not valid JSON" SyntaxError —
// this normalizes it to the same friendly isBackendDown error used for
// network failures above, instead of leaking a JS parse error to the UI.
async function _parseJsonOrThrow(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw Object.assign(new Error("Backend unreachable — using local posture engine"), { isBackendDown: true });
  }
}

// ── Analysis API ───────────────────────────────────────────────────
export const AnalysisAPI = {
  analyze:      (data) => apiFetch("/analyze",          { method: "POST", body: data }),
  snapshot:     (data) => apiFetch("/session/snapshot", { method: "POST", body: data }),
  addSnapshot:  (sid, frame, score, timestamp) =>
    apiFetch("/session/snapshot", { method: "POST", body: { session_id: sid, frame, score, timestamp } }),
  startSession: (data) => apiFetch("/session/start",    { method: "POST", body: data }),
  getSession:   (sid)  => apiFetch(`/session/${sid}`),
  deleteSession:(sid)  => apiFetch("/session/delete",   { method: "POST", body: { session_id: sid } }),
  syncOffline:  (data) => apiFetch("/session/sync",     { method: "POST", body: data }),
};

// ── Report API ─────────────────────────────────────────────────────
export const ReportAPI = {
  downloadPDF: async (data) => {
    const token = await getAuthToken();
    const resp  = await fetch(`${BASE_URL}/pdf`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body:    JSON.stringify(data),
    });
    if (!resp.ok) throw new Error(`PDF error: ${resp.status}`);
    return resp.blob();
  },
  getUserReports:   (data) => apiFetch("/reports/user", { method: "POST", body: data || {} }),
  getMonthlyReport: (data) => apiFetch("/hr/monthly-report", { method: "POST", body: data, timeout: 60000 }),
};

// ── AI API ──────────────────────────────────────────────────────
// NOTE: AI chat/analysis runs offline (rule-based engine in localAI.js) —
// no server calls, no API keys, no downloads. These endpoints
// remain only for analytics-style server processing (KPIs, risk
// scoring) that needs access to stored session data.

export const AIAPI = {
  // ── Phase 4: AI Intelligence Layer ───────────────────────────
  /** Executive summary + KPIs + risk for current user */
  executiveSummary:  (data) => apiFetch("/ai/executive-summary", { method:"POST", body:data, timeout:25000 }),
  /** Burnout prediction + anomaly detection + 7-day forecast */
  predictive:        (data) => apiFetch("/ai/predictive",        { method:"POST", body:data, timeout:20000 }),
  /** Weekly insights: headline, vs-last-week, action item */
  weeklyInsights:    (data) => apiFetch("/ai/weekly-insights",   { method:"POST", body:data, timeout:20000 }),
  /** Department comparison + manager insights (HR tier) */
  departmentReport:  (data) => apiFetch("/ai/department-report", { method:"POST", body:data, timeout:30000 }),
  /** Fatigue analysis: hourly breakdown + break schedule */
  fatigueAnalysis:   (data) => apiFetch("/ai/fatigue-analysis",  { method:"POST", body:data, timeout:20000 }),
  // ─────────────────────────────────────────────────────────────
  coach:   (data) => apiFetch("/coach/chat",  { method: "POST", body: data, timeout: 30000 }),
  insight: (data) => apiFetch("/ai/insight",  { method: "POST", body: data, timeout: 30000 }),
};

// ── Payment API ────────────────────────────────────────────────────
export const PaymentAPI = {
  /** Create a PayMob payment intent (card or mobile wallet). */
  createPayMobPayment: (data) => apiFetch("/paymob/create-payment", { method: "POST", body: data }),

  /** Stripe checkout session. */
  createStripe:    (data) => apiFetch("/stripe/create-session",  { method: "POST", body: data }),

  /** Stripe billing portal. */
  stripePortal:    (data) => apiFetch("/stripe/portal",          { method: "POST", body: data }),

  /** Admin: confirm manual payment. */
  confirmManual:   (data) => apiFetch("/admin/confirm-payment",  { method: "POST", body: data }),

  /** Notify admin of new pending payment. */
  notifyPayment:   (data) => apiFetch("/notify/payment",         { method: "POST", body: data }),

  /** Notify user that their payment was confirmed. */
  notifyConfirmed: (data) => apiFetch("/notify/confirmed",       { method: "POST", body: data }),

  /** Validate coupon code. Returns { valid, discount, label }. */
  validateCoupon:  (data) => apiFetch("/coupon/validate",        { method: "POST", body: data }),

  /** Mark coupon as used after successful payment. */
  useCoupon:       (data) => apiFetch("/coupon/use",             { method: "POST", body: data }),
};

// ── Notify API ─────────────────────────────────────────────────────
export const NotifyAPI = {
  slack:    (text, score, employee) => apiFetch("/notify/slack",    { method: "POST", body: { text, score, employee } }),
  teams:    (text, score, employee) => apiFetch("/notify/teams",    { method: "POST", body: { text, score, employee } }),
  whatsapp: (text, phone)           => apiFetch("/notify/whatsapp", { method: "POST", body: { text, phone } }),
};

// ── Email API ──────────────────────────────────────────────────────
export const EmailAPI = {
  sequence: (data) => apiFetch("/email/sequence",       { method: "POST", body: data }),
  weekly:   (data) => apiFetch("/email/weekly-report",  { method: "POST", body: data }),
  invoice:  (data) => apiFetch("/email/invoice",        { method: "POST", body: data }),
  welcome:  (data) => apiFetch("/email/welcome",        { method: "POST", body: data }),
  weeklyProgress: (data) => apiFetch("/email/weekly-progress", { method: "POST", body: data }),
};

// ── Enterprise API ─────────────────────────────────────────────────
export const EnterpriseAPI = {
  importCSV: async (file, companyId) => {
    const token = await getAuthToken();
    const fd    = new FormData();
    fd.append("file",       file);
    fd.append("company_id", companyId);
    const resp = await fetch(`${BASE_URL}/hr/import-employees`, {
      method:  "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body:    fd,
    });
    if (!resp.ok) throw new Error(`Import error: ${resp.status}`);
    return resp.json();
  },
  parseCSV:      (data) => apiFetch("/hr/parse-csv",         { method: "POST", body: data }),
  monthlyReport: (data) => apiFetch("/hr/monthly-report",    { method: "POST", body: data, timeout: 60000 }),
  webhookTest:   (data) => apiFetch("/webhooks/test",         { method: "POST", body: data }),
  seatCheck:     (data) => apiFetch("/enterprise/seat-check", { method: "POST", body: data }),
};

// ── Admin API ──────────────────────────────────────────────────────
// ── Billing Maturity API (Phase 8) ──────────────────────────────
export const BillingAPI = {
  /** Calculate proration for mid-cycle plan change */
  prorate:        (data) => apiFetch("/billing/prorate",            { method:"POST", body:data }),
  /** Current usage vs plan limits */
  usage:          ()     => apiFetch("/billing/usage"),
  /** Increment a usage counter */
  incrementUsage: (data) => apiFetch("/billing/usage/increment",    { method:"POST", body:data }),
  /** Change plan mid-cycle (upgrade/downgrade) */
  changePlan:     (data) => apiFetch("/billing/change-plan",        { method:"POST", body:data }),
  /** Admin: full billing analytics MRR/ARR/ARPU */
  analytics:      ()     => apiFetch("/billing/analytics"),
  /** Admin: send dunning email for failed payment */
  dunning:        (data) => apiFetch("/billing/dunning/send",       { method:"POST", body:data }),
  /** Download invoice PDF for a payment */
  invoicePdf: async (payment) => {
    const tok  = await getAuthToken();
    const resp = await fetch(`${BASE_URL}/billing/invoice/pdf`, {
      method:  "POST",
      headers: { "Content-Type":"application/json", ...(tok?{Authorization:`Bearer ${tok}`}:{}) },
      body:    JSON.stringify({ payment }),
    });
    if (!resp.ok) throw new Error(`Invoice PDF error: ${resp.status}`);
    return resp.blob();
  },
};

// ── Push Notifications API (register/unregister handled in push.js directly) ─
export const PushAPI = {
  /** Send a test push to the current user's registered devices. */
  test: () => apiFetch("/push/test", { method: "POST" }),
  /** Get category preferences + the auto-computed smart reminder hour. */
  getPreferences: () => apiFetch("/push/preferences"),
  /** Set category preferences and/or override the smart reminder hour. */
  setPreferences: (data) => apiFetch("/push/preferences", { method: "POST", body: data }),
};

// ── Symptom Correlation API ─────────────────────────────────────────
export const SymptomAPI = {
  /** Log (or overwrite) a day's symptom check-in. symptoms: [{type, severity(1-5)}] */
  log:         (data)   => apiFetch("/symptoms/log",              { method: "POST", body: data }),
  /** History of the user's own check-ins. period: 7d|30d|90d */
  history:     (period="30d") => apiFetch(`/symptoms/log?period=${period}`),
  /** The correlation engine — posture metrics on symptom days vs. other days. */
  correlation: (period="90d") => apiFetch(`/analytics/symptom-correlation?period=${period}`),
};

// ── Marketplace API (Physiotherapist directory + booking) ──────────
export const MarketplaceAPI = {
  /** Patient-facing: browse active therapists, optional ?city=&specialty= filters. */
  listTherapists: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/marketplace/therapists${qs ? `?${qs}` : ""}`);
  },
  /** Patient-facing: single therapist profile. */
  getTherapist:   (id)   => apiFetch(`/marketplace/therapists/${id}`),
  /** Patient-facing: create a booking request (opens a PayMob payment). */
  createBooking:  (data) => apiFetch("/marketplace/bookings",        { method: "POST", body: data }),
  /** Patient-facing: my own booking history. */
  myBookings:     ()     => apiFetch("/marketplace/bookings"),

  /** Admin: full therapist list (including paused). */
  adminListTherapists:  ()     => apiFetch("/admin/marketplace/therapists"),
  /** Admin: add a new curated therapist profile. */
  adminCreateTherapist: (data) => apiFetch("/admin/marketplace/therapists",        { method: "POST", body: data }),
  /** Admin: edit or pause/activate a therapist. */
  adminUpdateTherapist: (id, data) => apiFetch(`/admin/marketplace/therapists/${id}`, { method: "PATCH", body: data }),
  /** Admin: all bookings across all patients. */
  adminListBookings:    ()     => apiFetch("/admin/marketplace/bookings"),

  /** Booking-scoped chat: patient (owner) or admin can read/post. */
  getMessages:  (bookingId)       => apiFetch(`/marketplace/bookings/${bookingId}/messages`),
  sendMessage:  (bookingId, text) => apiFetch(`/marketplace/bookings/${bookingId}/messages`, { method: "POST", body: { text } }),

  /** Patient cancels their own booking. */
  cancelBooking: (bookingId) => apiFetch(`/marketplace/bookings/${bookingId}/cancel`, { method: "POST" }),
  /** Rate a completed session (1-5 stars + optional comment). */
  reviewBooking: (bookingId, data) => apiFetch(`/marketplace/bookings/${bookingId}/review`, { method: "POST", body: data }),
  /** Written reviews for a therapist's profile. */
  therapistReviews: (therapistId) => apiFetch(`/marketplace/therapists/${therapistId}/reviews`),
};

export const AdminAPI = {
  health:         ()     => apiFetch("/health",                   { skipAuth: true }),
  users:          ()     => apiFetch("/admin/users"),
  payments:       ()     => apiFetch("/admin/payments"),
  confirmPayment: (data) => apiFetch("/admin/confirm-payment",    { method: "POST", body: data }),
  rejectPayment:  (data) => apiFetch("/admin/reject-payment",     { method: "POST", body: data }),
  setTier:        (data) => apiFetch("/admin/set-tier",           { method: "POST", body: data }),
  exportUser:     (data) => apiFetch("/user/export",              { method: "POST", body: data }),
  coupons:        ()     => apiFetch("/admin/coupons"),
  createCoupon:   (data) => apiFetch("/admin/coupons",            { method: "POST", body: data }),
  deleteCoupon:   (code) => apiFetch(`/admin/coupons/${code}`,    { method: "DELETE" }),
  webhooks:       ()     => apiFetch("/admin/webhooks"),
  saveWebhook:    (data) => apiFetch("/admin/webhooks",           { method: "POST", body: data }),
  deleteWebhook:  (id)   => apiFetch(`/admin/webhooks/${id}`,     { method: "DELETE" }),
};
