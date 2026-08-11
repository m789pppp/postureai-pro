/**
 * /api/kashier — payment router
 * POST /api/kashier?action=create-order | webhook
 */
import createOrder from "./kashier/create-order.js";
import webhook     from "./kashier/webhook.js";
export default async function handler(req, res) {
  const action = req.query.action || req.body?.action;
  if (action === "webhook" || req.headers["x-kashier-signature"]) return webhook(req, res);
  return createOrder(req, res);
}
