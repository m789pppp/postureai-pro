/**
 * Wraps a router so an unhandled throw becomes a JSON response instead of a
 * Vercel FUNCTION_INVOCATION_FAILED page.
 *
 * Why this exists. The serverless JS handlers authenticate and read Firestore
 * through firebase-admin, which needs FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL
 * and FIREBASE_PRIVATE_KEY. Those are not set on the production deployment, and
 * the failure was invisible in two different ways at once:
 *
 *   GET /api/referral/stats      -> 500 "A server error has occurred
 *                                   FUNCTION_INVOCATION_FAILED", no clue why
 *   GET /api/metrics/revenue     -> same
 *   POST /api/org/invite/accept  -> same, so invite links are dead
 *   GET /api/announcements       -> 200 {"announcements":[]} forever, because
 *                                   its catch returns an empty list
 *   POST /api/stress/correlation -> 200 {"correlation":"firebase_not_configured"}
 *
 * Neither shape tells an operator that three environment variables are missing.
 * This turns the crashes into a 503 that names the cause, and /api/health now
 * reports the same thing before anyone has to trip over it.
 *
 * It deliberately does not swallow real bugs: anything that is not a
 * configuration problem still surfaces as a 500, just as JSON with a request
 * id rather than an opaque platform page.
 */

const FIREBASE_ADMIN_VARS = [
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
];

export function missingFirebaseAdminVars() {
  return FIREBASE_ADMIN_VARS.filter((v) => !(process.env[v] || "").trim());
}

export function withConfigGuard(route) {
  return async function handler(req, res) {
    try {
      return await route(req, res);
    } catch (e) {
      // Headers already flushed — nothing useful left to say.
      if (res.headersSent) throw e;

      const missing = missingFirebaseAdminVars();
      if (e?.isFirebaseInitError || missing.length) {
        console.error(`[config] ${req.url} failed; missing env: ${missing.join(", ") || "(none — init failed for another reason)"}`, e);
        return res.status(503).json({
          error: "Server not configured",
          detail: missing.length
            ? `Firebase Admin credentials are not set on this deployment: ${missing.join(", ")}`
            : "Firebase Admin failed to initialise",
          missing_env: missing,
        });
      }

      console.error(`[error] ${req.url}`, e);
      return res.status(500).json({ error: "Internal server error" });
    }
  };
}
