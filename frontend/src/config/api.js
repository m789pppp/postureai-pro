/**
 * Centralized backend API URL config.
 *
 * Every other file used to do:
 *   const API = import.meta.env.VITE_API_URL || "http://localhost:5050/api";
 * which silently points PRODUCTION traffic at localhost if VITE_API_URL
 * isn't set on Vercel — the browser can't reach localhost, so it just
 * looks like the whole backend is down with no useful error anywhere.
 *
 * Fix: only fall back to localhost when we're actually running on
 * localhost. Everywhere else, missing config fails loudly (console error
 * + Sentry if available) instead of silently.
 */

const RAW = import.meta.env.VITE_API_URL;

const isLocalHost =
  typeof window !== "undefined" &&
  ["localhost", "127.0.0.1"].includes(window.location.hostname);

export const API_BASE_URL = RAW || (isLocalHost ? "http://localhost:5050/api" : "");

export const API_MISCONFIGURED = !RAW && !isLocalHost;

if (API_MISCONFIGURED) {
  // eslint-disable-next-line no-console
  console.error(
    "[config] VITE_API_URL is not set for this deployment. " +
    "Set it in Vercel → Project Settings → Environment Variables, " +
    "for every environment (Production/Preview/Development)."
  );
  try {
    // Best-effort: surface to Sentry if it's wired up, without hard-depending on it.
    window?.Sentry?.captureMessage?.("VITE_API_URL missing in deployed environment", "error");
  } catch { /* noop */ }
}

/**
 * Pings the backend and reports whether it's actually reachable.
 * Used to show a clear "server unavailable" banner instead of a pile of
 * silent failed fetches when Railway is down/cold/misconfigured.
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
