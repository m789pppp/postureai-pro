#!/usr/bin/env node
/**
 * Pre-pilot deployment check.
 *
 *   node scripts/preflight.mjs https://your-deployment.vercel.app
 *
 * Every check here corresponds to something that was actually broken and got
 * fixed, or to a configuration step that nothing in CI enforces. The point is
 * to catch "the fix is in the repo but not in production" before a cohort of
 * students finds out for you.
 *
 * Exit code is 0 only if no check FAILED. Warnings do not fail the run.
 *
 * What this CANNOT check, and you must verify by hand:
 *   - that firestore.rules is deployed (needs admin credentials; nothing in
 *     CI deploys it, and two security fixes live in that file)
 *   - which Firebase project the bundle actually writes to (firebase.js has a
 *     hardcoded config fallback, so a missing env var silently redirects
 *     student data to another project)
 *   - anything behind authentication
 */

const BASE = (process.argv[2] || process.env.PREFLIGHT_URL || "").replace(/\/+$/, "");
if (!BASE) {
  console.error("Usage: node scripts/preflight.mjs https://your-deployment.example.app");
  process.exit(2);
}

const results = [];
const record = (level, name, detail) => {
  results.push({ level, name, detail });
  const mark = level === "pass" ? "  ok  " : level === "warn" ? " warn " : " FAIL ";
  console.log(`[${mark}] ${name}${detail ? " — " + detail : ""}`);
};

async function get(path, opts = {}) {
  const url = BASE + path;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, { redirect: "follow", signal: ctrl.signal, ...opts });
    return res;
  } finally {
    clearTimeout(t);
  }
}

// ── 1. The site is up ────────────────────────────────────────────────────
let indexHtml = "";
try {
  const res = await get("/");
  indexHtml = await res.text();
  res.ok ? record("pass", "Site responds", `HTTP ${res.status}`)
         : record("fail", "Site responds", `HTTP ${res.status}`);
} catch (e) {
  record("fail", "Site responds", e.message);
}

// ── 2. Backend is alive ──────────────────────────────────────────────────
// A 500 here is the signature of the Redis boot failure: backend.py used to
// sys.exit(1) at import time when FLASK_ENV=production and REDIS_URL was
// unset, which surfaces as a function crash on every Flask route.
try {
  const res = await get("/api/health");
  const body = (await res.text()).slice(0, 200);
  if (res.ok) record("pass", "Backend /api/health", `HTTP ${res.status}`);
  else if (res.status >= 500)
    record("fail", "Backend /api/health", `HTTP ${res.status} — check REDIS_URL / FLASK_ENV. Body: ${body}`);
  else record("warn", "Backend /api/health", `HTTP ${res.status} — ${body}`);
} catch (e) {
  record("fail", "Backend /api/health", e.message);
}

// ── 3. MediaPipe is self-hosted ──────────────────────────────────────────
// If these 404, the prebuild step did not run and the app falls back to the
// CDN — which is exactly what freezes the score on a filtered campus network.
for (const [path, minBytes, label] of [
  ["/mediapipe/vision_bundle.mjs", 50_000, "MediaPipe bundle"],
  ["/mediapipe/wasm/vision_wasm_internal.wasm", 1_000_000, "MediaPipe wasm"],
  ["/mediapipe/pose_landmarker_full.task", 5_000_000, "Pose model"],
]) {
  try {
    const res = await get(path);
    const len = Number(res.headers.get("content-length") || 0);
    if (!res.ok) {
      record("fail", `${label} self-hosted`, `HTTP ${res.status} at ${path} — prebuild did not run`);
    } else if (len && len < minBytes) {
      record("fail", `${label} self-hosted`, `only ${len} bytes — looks truncated or an HTML error page`);
    } else {
      record("pass", `${label} self-hosted`, len ? `${(len / 1e6).toFixed(1)}MB` : `HTTP ${res.status}`);
    }
  } catch (e) {
    record("fail", `${label} self-hosted`, e.message);
  }
}

// ── 4. The closed snapshot route stays closed ────────────────────────────
// This used to accept a raw webcam frame and store it unblurred.
try {
  const res = await get("/api/session/snapshot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: "preflight", frame: "data:," }),
  });
  if (res.status === 410) record("pass", "Snapshot upload route closed", "HTTP 410");
  else if (res.status === 401) record("pass", "Snapshot upload route rejects", "HTTP 401 (auth first)");
  else if (res.status === 200) record("fail", "Snapshot upload route closed", "HTTP 200 — old build still deployed");
  else record("warn", "Snapshot upload route closed", `HTTP ${res.status}`);
} catch (e) {
  record("warn", "Snapshot upload route closed", e.message);
}

// ── 5. Export requires authentication ────────────────────────────────────
// It used to return every user's sessions to any caller.
try {
  const res = await get("/api/user/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uid: "someone-else" }),
  });
  const body = (await res.text()).slice(0, 300);
  if (res.status === 401 || res.status === 403) {
    record("pass", "Export requires auth", `HTTP ${res.status}`);
  } else if (res.ok && /"sessions"/.test(body)) {
    record("fail", "Export requires auth", "returned session data without a token — OLD BUILD, rotate nothing and redeploy now");
  } else {
    record("warn", "Export requires auth", `HTTP ${res.status} — ${body.slice(0, 120)}`);
  }
} catch (e) {
  record("warn", "Export requires auth", e.message);
}

// ── 6. No MediaPipe CDN references left in the shipped bundle ────────────
try {
  const scripts = [...indexHtml.matchAll(/src="([^"]+\.js)"/g)].map(m => m[1]);
  let cdnHits = 0, scanned = 0;
  for (const src of scripts.slice(0, 6)) {
    const res = await get(src.startsWith("http") ? src.replace(BASE, "") : src);
    if (!res.ok) continue;
    const js = await res.text();
    scanned++;
    if (/cdn\.jsdelivr\.net[^"']*tasks-vision/.test(js)) cdnHits++;
  }
  if (!scanned) record("warn", "Bundle scan", "could not read any bundle script");
  else if (cdnHits) record("warn", "MediaPipe CDN fallback present", `${cdnHits} bundle(s) reference jsdelivr — expected, it is the fallback. Self-hosted assets above are what matters.`);
  else record("pass", "Bundle scan", `${scanned} bundle(s) scanned`);
} catch (e) {
  record("warn", "Bundle scan", e.message);
}

// ── 7. Transport security ────────────────────────────────────────────────
if (!BASE.startsWith("https://")) {
  record("fail", "HTTPS", "the deployment URL is not https");
} else {
  try {
    const res = await get("/");
    const hsts = res.headers.get("strict-transport-security");
    hsts ? record("pass", "HSTS header", hsts)
         : record("warn", "HSTS header", "absent — set Strict-Transport-Security");
  } catch { /* covered by check 1 */ }
}

// ── Summary ──────────────────────────────────────────────────────────────
const fails = results.filter(r => r.level === "fail");
const warns = results.filter(r => r.level === "warn");
console.log("\n" + "─".repeat(64));
console.log(`${results.length} checks · ${results.length - fails.length - warns.length} passed · ${warns.length} warnings · ${fails.length} failed`);
console.log("\nStill to verify BY HAND — this script cannot see them:");
console.log("  1. firestore.rules is deployed to the pilot project");
console.log("     (nothing in CI deploys it; two security fixes live there)");
console.log("     firebase deploy --only firestore:rules");
console.log("  2. The build writes to the Firebase project you think it does.");
console.log("     firebase.js has a hardcoded config fallback that a missing");
console.log("     env var silently falls through to.");
console.log("  3. VITE_SENTRY_DSN is set, or you are blind for the whole pilot.");
console.log("  4. aggregate_only is set on the pilot organisation");
console.log("     (node scripts/set-pilot-privacy.mjs <company_id>)");
console.log("─".repeat(64));

process.exit(fails.length ? 1 : 0);
