// Router: /api/referral/* → 2 handlers
// Must be the first import: fills the Firebase vars from the service-account
// JSON before any handler module is evaluated. See api/_lib/env.js.
import "./_lib/env.js";
import stats from "./_handlers/referral/stats.js";
import track from "./_handlers/referral/track.js";
import { withConfigGuard } from "./_lib/routerGuard.js";

async function route(req, res) {
  const path = req.url.split("?")[0];
  if (path.endsWith("/stats")) return stats(req, res);
  if (path.endsWith("/track")) return track(req, res);
  res.status(404).json({ error: "Not found" });
}

// Unhandled throws become a JSON 503/500 instead of a Vercel
// FUNCTION_INVOCATION_FAILED page — see api/_lib/routerGuard.js.
export default withConfigGuard(route);
