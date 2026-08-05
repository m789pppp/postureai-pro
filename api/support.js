// Router: /api/support/* → 2 handlers
import reply           from "./_handlers/support/reply.js";
import whatsappInbound from "./_handlers/support/whatsapp-inbound.js";

export default async function handler(req, res) {
  const path = req.url.split("?")[0];
  if (path.endsWith("/reply"))             return reply(req, res);
  if (path.endsWith("/whatsapp-inbound"))  return whatsappInbound(req, res);
  res.status(404).json({ error: "Not found" });
}
