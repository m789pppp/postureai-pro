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

// ── 2b. An invalid token must be rejected ────────────────────────────────
//
// The check that would have caught the worst thing this script ever missed.
//
// backend/auth/middleware.py returns a fixed "dev-user-local" for ANY token
// string when Firebase Admin is unconfigured and FLASK_ENV is not exactly
// "production". Both were true on the live deployment, so this was real:
//
//   GET /api/user/activity
//   Authorization: Bearer obviously-not-a-valid-jwt
//   -> 200 {"events":[],"ok":true}
//
// Every previous run of this script passed 9/9 against that deployment.
// A 401 is the only acceptable answer here.
try {
  const res = await get("/api/user/activity", {
    headers: { Authorization: "Bearer preflight-not-a-real-token" },
  });
  const body = (await res.text()).slice(0, 200);
  if (res.status === 401 || res.status === 403) {
    record("pass", "Invalid token rejected", `HTTP ${res.status}`);
  } else if (res.ok) {
    record("fail", "Invalid token rejected",
      `HTTP ${res.status} — AUTHENTICATION IS BYPASSED. Any bearer string is accepted. ` +
      `Set FIREBASE_SERVICE_ACCOUNT_JSON and FLASK_ENV=production. Body: ${body}`);
  } else {
    // A 500 here still means the request got PAST authentication.
    record("fail", "Invalid token rejected",
      `HTTP ${res.status} — expected 401. A non-401 means the token was accepted ` +
      `and the failure happened later. Body: ${body}`);
  }
} catch (e) {
  record("fail", "Invalid token rejected", e.message);
}

// ── 2c. The deployment knows it is a deployment ──────────────────────────
// FLASK_ENV gates error verbosity, webhook signature validation and the auth
// fallback above. Unset means the lenient branch of each.
try {
  const res = await get("/api/health");
  const j = await res.json().catch(() => ({}));
  const env = String(j.env || "");
  if (env === "production") record("pass", "FLASK_ENV", "production");
  else record("fail", "FLASK_ENV",
    `reported as "${env || "(absent from /api/health)"}" — set FLASK_ENV=production. ` +
    `Until then error responses include full Python tracebacks and the payment ` +
    `webhooks skip signature validation.`);

  // /api/health reports which required variables are missing, by name.
  const cfg = j.config;
  if (!cfg) {
    record("warn", "Server env vars", "/api/health has no config block — older build deployed");
  } else if (cfg.ok) {
    record("pass", "Server env vars", "all required variables set");
  } else {
    const miss = cfg.missing_env || [];
    // The three FIREBASE_* fields are derived from the service-account JSON
    // by api/_lib/env.js, so say what to actually set rather than listing
    // four names an operator would then paste separately.
    const derived = ["FIREBASE_PROJECT_ID","FIREBASE_CLIENT_EMAIL","FIREBASE_PRIVATE_KEY"];
    const shown = miss.filter(m => !derived.includes(m));
    const needsJson = miss.some(m => derived.includes(m)) || miss.includes("FIREBASE_SERVICE_ACCOUNT_JSON");
    const parts = [...new Set([...shown, ...(needsJson ? ["FIREBASE_SERVICE_ACCOUNT_JSON"] : [])])];
    record("fail", "Server env vars", `set these: ${parts.join(", ")}`);
  }

  // Not failures — but each one silently switches off something the UI
  // still offers, which is how "no payment method works" went unnoticed.
  for (const d of (cfg?.degraded || [])) {
    record("warn", `${d.name} not set`, d.disables);
  }
} catch (e) {
  record("warn", "FLASK_ENV", e.message);
}

// ── 2d. Readiness ────────────────────────────────────────────────────────
try {
  const res = await get("/api/ready");
  const j = await res.json().catch(() => ({}));
  const checks = j.checks || {};
  if (j.status === "ready") record("pass", "Readiness probe", JSON.stringify(checks));
  else record("fail", "Readiness probe", `${j.status} — ${JSON.stringify(checks)}`);
} catch (e) {
  record("warn", "Readiness probe", e.message);
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
console.log("  1. firestore.rules reached the pilot project. deploy.yml now");
console.log("     pushes it, but only once FIREBASE_SERVICE_ACCOUNT_JSON and");
console.log("     FIREBASE_PROJECT_ID are set as repository secrets — check");
console.log("     the Actions run, do not assume.");
console.log("  2. The build writes to the Firebase project you think it does.");
console.log("     firebase.js has a hardcoded config fallback that a missing");
console.log("     env var silently falls through to.");
console.log("  3. VITE_SENTRY_DSN is set, or you are blind for the whole pilot.");
console.log("  4. aggregate_only is set on the pilot organisation");
console.log("     (node scripts/set-pilot-privacy.mjs <company_id>)");
console.log("─".repeat(64));

process.exit(fails.length ? 1 : 0);
