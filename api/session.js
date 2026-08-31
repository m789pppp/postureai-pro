// Router: /api/session/* → 3 handlers
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
