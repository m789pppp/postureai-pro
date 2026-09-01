// Router: /api/posture-api/* → 3 handlers
// Must be the first import: fills the Firebase vars from the service-account
// JSON before any handler module is evaluated. See api/_lib/env.js.
import "./_lib/env.js";
import analyze from "./_handlers/posture-api/analyze.js";
import keys    from "./_handlers/posture-api/keys.js";
import usage   from "./_handlers/posture-api/usage.js";
import { withConfigGuard } from "./_lib/routerGuard.js";

async function route(req, res) {
  const path = req.url.split("?")[0];
  if (path.endsWith("/analyze")) return analyze(req, res);
  if (path.endsWith("/keys"))    return keys(req, res);
  if (path.endsWith("/usage"))   return usage(req, res);
  res.status(404).json({ error: "Not found" });
}

// Unhandled throws become a JSON 503/500 instead of a Vercel
// FUNCTION_INVOCATION_FAILED page — see api/_lib/routerGuard.js.
export default withConfigGuard(route);
