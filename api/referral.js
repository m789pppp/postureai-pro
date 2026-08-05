// Router: /api/referral/* → 2 handlers
import stats from "./_handlers/referral/stats.js";
import track from "./_handlers/referral/track.js";

export default async function handler(req, res) {
  const path = req.url.split("?")[0];
  if (path.endsWith("/stats")) return stats(req, res);
  if (path.endsWith("/track")) return track(req, res);
  res.status(404).json({ error: "Not found" });
}
