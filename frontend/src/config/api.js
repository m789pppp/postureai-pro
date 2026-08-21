/**
 * Centralized backend API URL config.
 *
 * The Python backend (backend/backend.py, via the main.py entrypoint)
 * now deploys as a Vercel Function in this same project — vercel.json's
 * "/api/(.*)" catch-all route sends unmatched /api/* requests straight
 * to it (specific paths already covered by the smaller api/*.js Vercel
 * functions — kashier, billing, session, etc. — still take priority;
 * see vercel.json's "routes" array). That means the frontend never
 * needs a separate backend host/URL at all — it just calls /api/... on
 * its own origin. (Previously this proxied to an external Railway
 * deployment; that's gone — everything is same-origin on Vercel now.)
 *
 * VITE_API_URL still works as an explicit override (e.g. pointing a
 * preview deploy at a staging backend), but it is no longer required.
 */

const RAW = import.meta.env.VITE_API_URL;

const isLocalHost =
  typeof window !== "undefined" &&
  ["localhost", "127.0.0.1"].includes(window.location.hostname);

// Local dev: hit a local Flask instance directly on :5050 (run
// `python backend/app.py`, or `python backend/backend.py`, from the
// repo). Everywhere else (Vercel prod/preview): same-origin "/api",
// routed to the Python function by vercel.json — no env var required.
export const API_BASE_URL = RAW || (isLocalHost ? "http://localhost:5050/api" : "/api");

// Kept for backward compatibility with anything still importing this,
// but it's structurally impossible to be true now — same-origin "/api"
// always resolves to *something* (the Vercel Function), even if it's
// erroring internally, which apiHealthCheck() below is what actually
// detects.
export const API_MISCONFIGURED = false;

/**
 * Pings the backend and reports whether it's actually reachable.
 * Used to show a clear "server unavailable" banner instead of a pile of
 * silent failed fetches when the backend function is down/cold-starting,
 * or misconfigured.
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
