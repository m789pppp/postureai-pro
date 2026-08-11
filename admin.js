/**
 * /api/admin — admin + cron router
 * POST /api/admin?action=seed | cron-alerts
 */
import seedHandler   from "./admin/seed-flags.js";
import alertsHandler from "./cron/symptom-pattern-alerts.js";
export default async function handler(req, res) {
  const action = req.query.action || req.body?.action || "seed";
  if (action === "cron-alerts") return alertsHandler(req, res);
  return seedHandler(req, res);
}
