/**
 * /api/org — org + referral router
 * POST /api/org?action=invite | referral-stats | referral-track
 */
import inviteHandler  from "./org/invite.js";
import statsHandler   from "./referral/stats.js";
import trackHandler   from "./referral/track.js";
export default async function handler(req, res) {
  const action = req.query.action || req.body?.action;
  if (action === "referral-stats" || action === "stats") return statsHandler(req, res);
  if (action === "referral-track" || action === "track") return trackHandler(req, res);
  return inviteHandler(req, res);
}
