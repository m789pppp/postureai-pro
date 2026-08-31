// Router: /api/support/* → 2 handlers
import reply           from "./_handlers/support/reply.js";
import whatsappInbound from "./_handlers/support/whatsapp-inbound.js";
import { withConfigGuard } from "./_lib/routerGuard.js";

async function route(req, res) {
  const path = req.url.split("?")[0];
  if (path.endsWith("/reply"))             return reply(req, res);
  if (path.endsWith("/whatsapp-inbound"))  return whatsappInbound(req, res);
  res.status(404).json({ error: "Not found" });
}

// Unhandled throws become a JSON 503/500 instead of a Vercel
// FUNCTION_INVOCATION_FAILED page — see api/_lib/routerGuard.js.
export default withConfigGuard(route);
