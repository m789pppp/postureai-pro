/**
 * /api/habits — WhatsApp reminders router
 * POST /api/habits?action=test | cron
 */
import testHandler from "./habits/whatsapp-test.js";
import cronHandler from "./habits/whatsapp-cron.js";
export default async function handler(req, res) {
  const action = req.query.action || req.body?.action || "test";
  if (action === "cron") return cronHandler(req, res);
  return testHandler(req, res);
}
