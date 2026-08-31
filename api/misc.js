// Router: /api/* misc → 9 handlers (account, admin, email, metrics, notify, org, cron, whoami, gamification)
import accountDelete    from "./_handlers/misc/account-delete.js";
import seedFlags        from "./_handlers/misc/seed-flags.js";
import emailSend        from "./_handlers/misc/email-send.js";
import revenue          from "./_handlers/misc/revenue.js";
import notifyDispatch   from "./_handlers/misc/notify-dispatch.js";
import orgInvite        from "./_handlers/misc/org-invite.js";
import symptomAlerts    from "./_handlers/misc/symptom-alerts.js";
import whoami           from "./_handlers/misc/whoami.js";
import gamificationCompute from "./_handlers/misc/gamification-compute.js";
import announcements     from "./_handlers/misc/announcements.js";
import stressCorrelation from "./_handlers/misc/stress-correlation.js";
import { withConfigGuard } from "./_lib/routerGuard.js";

async function route(req, res) {
  const path = req.url.split("?")[0];
  if (path.includes("/account/delete"))              return accountDelete(req, res);
  if (path.includes("/admin/seed-flags"))            return seedFlags(req, res);
  if (path.includes("/email/send"))                  return emailSend(req, res);
  if (path.includes("/metrics/revenue"))             return revenue(req, res);
  if (path.includes("/notify/dispatch"))             return notifyDispatch(req, res);
  if (path.includes("/org/invite"))                  return orgInvite(req, res);
  if (path.includes("/cron/symptom-pattern-alerts")) return symptomAlerts(req, res);
  if (path.includes("/auth/whoami"))                 return whoami(req, res);
  if (path.includes("/gamification/compute"))        return gamificationCompute(req, res);
  if (path.includes("/announcements"))               return announcements(req, res);
  if (path.includes("/stress/correlation"))          return stressCorrelation(req, res);
  // /api/analyze — legacy Railway endpoint, now handled locally
  // The frontend's local MediaPipe engine does all posture analysis;
  // this endpoint is only called as a fire-and-forget background sync.
  // Return 200 with empty result so the client doesn't retry endlessly.
  if (path.includes("/analyze")) {
    res.setHeader("Access-Control-Allow-Origin","*");
    if (req.method === "OPTIONS") return res.status(200).end();
    return res.status(200).json({ ok: true, overall: null, metrics: {}, source: "local" });
  }
  res.status(404).json({ error: "Not found" });
}

// Unhandled throws become a JSON 503/500 instead of a Vercel
// FUNCTION_INVOCATION_FAILED page — see api/_lib/routerGuard.js.
export default withConfigGuard(route);
