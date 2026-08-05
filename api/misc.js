// Router: /api/* misc → 7 handlers (account, admin, email, metrics, notify, org, cron)
import accountDelete    from "./_handlers/misc/account-delete.js";
import seedFlags        from "./_handlers/misc/seed-flags.js";
import emailSend        from "./_handlers/misc/email-send.js";
import revenue          from "./_handlers/misc/revenue.js";
import notifyDispatch   from "./_handlers/misc/notify-dispatch.js";
import orgInvite        from "./_handlers/misc/org-invite.js";
import symptomAlerts    from "./_handlers/misc/symptom-alerts.js";

export default async function handler(req, res) {
  const path = req.url.split("?")[0];
  if (path.includes("/account/delete"))              return accountDelete(req, res);
  if (path.includes("/admin/seed-flags"))            return seedFlags(req, res);
  if (path.includes("/email/send"))                  return emailSend(req, res);
  if (path.includes("/metrics/revenue"))             return revenue(req, res);
  if (path.includes("/notify/dispatch"))             return notifyDispatch(req, res);
  if (path.includes("/org/invite"))                  return orgInvite(req, res);
  if (path.includes("/cron/symptom-pattern-alerts")) return symptomAlerts(req, res);
  res.status(404).json({ error: "Not found" });
}
