// Router: /api/habits/* → 2 handlers
import whatsappCron from "./_handlers/habits/whatsapp-cron.js";
import whatsappTest from "./_handlers/habits/whatsapp-test.js";
import { withConfigGuard } from "./_lib/routerGuard.js";

async function route(req, res) {
  const path = req.url.split("?")[0];
  if (path.endsWith("/whatsapp-cron")) return whatsappCron(req, res);
  if (path.endsWith("/whatsapp-test")) return whatsappTest(req, res);
  res.status(404).json({ error: "Not found" });
}

// Unhandled throws become a JSON 503/500 instead of a Vercel
// FUNCTION_INVOCATION_FAILED page — see api/_lib/routerGuard.js.
export default withConfigGuard(route);
