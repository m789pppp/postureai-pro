// Router: /api/session/* → 3 handlers
import start    from "./_handlers/session/start.js";
import health   from "./_handlers/session/health.js";
import snapshot from "./_handlers/session/snapshot.js";

export default async function handler(req, res) {
  const path = req.url.split("?")[0];
  if (path.endsWith("/start"))    return start(req, res);
  if (path.endsWith("/health"))   return health(req, res);
  if (path.endsWith("/snapshot")) return snapshot(req, res);
  res.status(404).json({ error: "Not found" });
}
