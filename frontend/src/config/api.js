/**
 * Centralized backend API URL config.
 *
 * Historically this required VITE_API_URL to be set in Vercel, or every
 * API call silently broke in production. As of this change, vercel.json
 * proxies /api/* on this same domain straight through to the Railway
 * backend (see the "routes" entry for "/api/(.*)"). That means the
 * frontend never needs to know Railway's URL at all — it just calls
 * /api/... on its own origin, and Vercel forwards it server-side.
 *
 * VITE_API_URL still works as an explicit override (e.g. pointing a
 * preview deploy at a staging backend), but it is no longer required.
 */

const RAW = import.meta.env.VITE_API_URL;

const isLocalHost =
  typeof window !== "undefined" &&
  ["localhost", "127.0.0.1"].includes(window.location.hostname);

// Local dev: hit Railway (or a local Flask instance) directly on :5050.
// Everywhere else (Vercel prod/preview): same-origin "/api", proxied to
// Railway by vercel.json — no env var required.
export const API_BASE_URL = RAW || (isLocalHost ? "http://localhost:5050/api" : "/api");

// Kept for backward compatibility with anything still importing this,
// but it's structurally impossible to be true now — same-origin "/api"
// always resolves to *something* (the proxy), even if Railway itself is
// down, which apiHealthCheck() below is what actually detects.
export const API_MISCONFIGURED = false;

/**
 * Pings the backend and reports whether it's actually reachable.
 * Used to show a clear "server unavailable" banner instead of a pile of
 * silent failed fetches when Railway is down/cold, or the proxy itself
 * is misconfigured.
 */
export async function apiHealthCheck(timeoutMs = 6000) {
  if (!API_BASE_URL) return { ok: false, reason: "not_configured" };
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE_URL}/health`, { signal: controller.signal });
    clearTimeout(id);
    return { ok: res.ok, reason: res.ok ? null : `status_${res.status}` };
  } catch (e) {
    clearTimeout(id);
    return { ok: false, reason: e.name === "AbortError" ? "timeout" : "network_error" };
  }
}
