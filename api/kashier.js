// Router: /api/kashier/* → 2 handlers
import createOrder from "./_handlers/kashier/create-order.js";
import webhook     from "./_handlers/kashier/webhook.js";

export default async function handler(req, res) {
  const path = req.url.split("?")[0];
  if (path.endsWith("/create-order")) return createOrder(req, res);
  if (path.endsWith("/webhook"))      return webhook(req, res);
  res.status(404).json({ error: "Not found" });
}
