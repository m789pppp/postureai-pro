/**
 * withConfigGuard must turn a throw into a response, and must not change
 * anything about a route that behaves.
 */
import { withConfigGuard, missingFirebaseAdminVars } from "./routerGuard.js";

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); console.log(`  ok    ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}\n          ${e.message}`); fail++; }
};
const eq = (a, b, what) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${what}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
};

// Minimal res double with the surface the routers use.
const mkRes = () => {
  const r = { code: null, body: null, headersSent: false, headers: {} };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; r.headersSent = true; return r; };
  r.end = () => { r.headersSent = true; return r; };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  return r;
};
const call = async (route, url = "/api/x") => {
  const res = mkRes();
  await withConfigGuard(route)({ url, method: "GET", headers: {} }, res);
  return res;
};

const withEnv = async (vars, fn) => {
  const saved = {};
  for (const [k, v] of Object.entries(vars)) { saved[k] = process.env[k]; if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  try { return await fn(); }
  finally { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
};

const NO_FIREBASE = { FIREBASE_PROJECT_ID: undefined, FIREBASE_CLIENT_EMAIL: undefined, FIREBASE_PRIVATE_KEY: undefined };
const FIREBASE_OK = { FIREBASE_PROJECT_ID: "p", FIREBASE_CLIENT_EMAIL: "c@d.e", FIREBASE_PRIVATE_KEY: "k" };

console.log("\nrouterGuard");

// A route that works is untouched.
const okRes = await call(async (req, res) => res.status(200).json({ ok: true }));
t("passes a successful response through", () => { eq(okRes.code, 200, "status"); eq(okRes.body, { ok: true }, "body"); });

// A route that 404s is untouched.
const nf = await call(async (req, res) => res.status(404).json({ error: "Not found" }));
t("passes a 404 through", () => eq(nf.code, 404, "status"));

// Missing Firebase config -> 503 naming the variables.
await withEnv(NO_FIREBASE, async () => {
  const res = await call(async () => { throw Object.assign(new Error("Firebase Admin init failed"), { isFirebaseInitError: true }); });
  t("missing Firebase config becomes a 503", () => eq(res.code, 503, "status"));
  t("503 names every missing variable", () => eq(res.body.missing_env,
      ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"], "missing_env"));
  t("503 body is not a stack trace", () => {
    if (JSON.stringify(res.body).includes("at ")) throw new Error("leaked a stack");
  });
});

// A genuine bug, with config present, is a plain 500 — not disguised as config.
await withEnv(FIREBASE_OK, async () => {
  const res = await call(async () => { throw new TypeError("x.map is not a function"); });
  t("a real bug is a 500, not a 503", () => eq(res.code, 500, "status"));
  t("500 does not leak the message", () => eq(res.body, { error: "Internal server error" }, "body"));
  t("no missing vars reported when config is present", () => eq(missingFirebaseAdminVars(), [], "missing"));
});

// Once the response has gone out, the guard must not try to write again.
await withEnv(NO_FIREBASE, async () => {
  let rethrown = false;
  const res = mkRes();
  try {
    await withConfigGuard(async (req, r) => { r.status(200).json({ sent: true }); throw new Error("late"); })({ url: "/api/x", headers: {} }, res);
  } catch { rethrown = true; }
  t("does not double-respond after headers are sent", () => {
    eq(res.code, 200, "status"); if (!rethrown) throw new Error("should rethrow");
  });
});

console.log(`\n${"─".repeat(48)}\n${pass} passed · ${fail} failed`);
process.exit(fail ? 1 : 0);
