// Router: /api/habits/* → 2 handlers
import whatsappCron from "./_handlers/habits/whatsapp-cron.js";
import whatsappTest from "./_handlers/habits/whatsapp-test.js";

export default async function handler(req, res) {
  const path = req.url.split("?")[0];
  if (path.endsWith("/whatsapp-cron")) return whatsappCron(req, res);
  if (path.endsWith("/whatsapp-test")) return whatsappTest(req, res);
  res.status(404).json({ error: "Not found" });
}
