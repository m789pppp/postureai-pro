/**
 * Normalises the Firebase Admin environment before any handler reads it.
 *
 * There were five variables to set on the deployment, and three of them —
 * FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY — are just
 * fields copied out of the service-account JSON that FIREBASE_SERVICE_ACCOUNT_JSON
 * already holds for the Python side. Asking an operator to paste the same
 * credential twice, once whole and once shredded into three, is how you end up
 * with a deployment that is half configured.
 *
 * The private key is the worst of the three: it is a multi-line PEM, and
 * pasting it into a dashboard field mangles the newlines in a way that fails
 * at runtime with an opaque "Invalid PEM formatted message" rather than at
 * configuration time. Deriving it from the JSON removes that failure mode
 * entirely.
 *
 * So: if the whole JSON is present and any of the three are missing, fill them
 * in from it. Anything already set explicitly is left alone — an operator who
 * deliberately points the JS handlers at a different project keeps that.
 *
 * Imported first by every router in api/*.js. All 32 handler files read
 * process.env inside their functions rather than at module scope, so this runs
 * comfortably before the first read, and none of them needed changing.
 */

let applied = null;

export function normaliseFirebaseEnv() {
  if (applied) return applied;
  applied = { filled: [], source: null, error: null };

  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim();
  if (!raw.startsWith("{")) return applied;

  let sa;
  try {
    sa = JSON.parse(raw);
  } catch (e) {
    // Never include the raw value in the message — it is a private key.
    applied.error = `FIREBASE_SERVICE_ACCOUNT_JSON is set but is not valid JSON (${e.message})`;
    console.error("[env] " + applied.error);
    return applied;
  }

  const map = {
    FIREBASE_PROJECT_ID:   sa.project_id,
    FIREBASE_CLIENT_EMAIL: sa.client_email,
    FIREBASE_PRIVATE_KEY:  sa.private_key,
  };
  for (const [name, value] of Object.entries(map)) {
    if (!(process.env[name] || "").trim() && typeof value === "string" && value) {
      process.env[name] = value;
      applied.filled.push(name);
    }
  }
  applied.source = "FIREBASE_SERVICE_ACCOUNT_JSON";
  if (applied.filled.length) {
    // Names only. Never the values.
    console.log(`[env] derived ${applied.filled.join(", ")} from FIREBASE_SERVICE_ACCOUNT_JSON`);
  }
  return applied;
}

normaliseFirebaseEnv();
