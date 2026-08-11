/**
 * /api/notify — notifications + support router
 * POST /api/notify?action=dispatch | reply | inbound
 */
import dispatchHandler from "./notify/dispatch.js";
import replyHandler    from "./support/reply.js";
import inboundHandler  from "./support/whatsapp-inbound.js";
export default async function handler(req, res) {
  const action = req.query.action || req.body?.action || "dispatch";
  if (action === "reply")   return replyHandler(req, res);
  if (action === "inbound") return inboundHandler(req, res);
  return dispatchHandler(req, res);
}
