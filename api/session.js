// Router: /api/session/* → 3 handlers
// Must be the first import: fills the Firebase vars from the service-account
// JSON before any handler module is evaluated. See api/_lib/env.js.
import "./_lib/env.js";
import start    from "./_handlers/session/start.js";
import health   from "./_handlers/session/health.js";
import snapshot from "./_handlers/session/snapshot.js";
import { withConfigGuard } from "./_lib/routerGuard.js";

async function route(req, res) {
  const path = req.url.split("?")[0];
  if (path.endsWith("/start"))    return start(req, res);
  if (path.endsWith("/health"))   return health(req, res);
  if (path.endsWith("/snapshot")) return snapshot(req, res);
  res.status(404).json({ error: "Not found" });
}

// Unhandled throws become a JSON 503/500 instead of a Vercel
// FUNCTION_INVOCATION_FAILED page — see api/_lib/routerGuard.js.
export default withConfigGuard(route);
