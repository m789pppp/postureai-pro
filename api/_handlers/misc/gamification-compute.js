// UNROUTED. Kept only so api/misc.js's import does not break.
//
// This shipped as /api/gamification/compute but returns a different shape from
// the one the Progress panel reads: {xp, level, xp_to_next, achievements} vs
// the {xp_current, level_label, achievements_list, weekly_challenge,
// daily_goal} the UI is written against. Every mismatched read was undefined,
// so the XP bar rendered width:"NaN%" and sat permanently full, the
// achievements grid was blank, and the weekly challenge never appeared. It also
// has no auth check, and its XP formula disagrees with the Python one on both
// the terms and the level curve.
//
// The route was removed; /api/gamification/compute now falls through to
// api/main.py. Do not re-route to this file.
/**
 * POST /api/gamification/compute
 * Computes achievements + XP from session stats.
 * Stateless — no Firestore write, just returns computed data.
 */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const {
    sessions_count = 0,
    avg_score = 0,
    streak = 0,
    referral_count = 0,
    has_calibration = false,
    earned_achievements = [],
  } = req.body || {};

  // XP calculation
  const xp = Math.round(
    sessions_count * 10 +
    avg_score * 2 +
    streak * 15 +
    referral_count * 50 +
    (has_calibration ? 100 : 0)
  );

  const level = Math.floor(xp / 500) + 1;

  // Achievement logic
  const all = [
    { id: "first_session",  name: "First Step",        icon: "🎯", xp: 50,  earned: sessions_count >= 1 },
    { id: "session_5",      name: "Getting Warmed Up", icon: "🔥", xp: 100, earned: sessions_count >= 5 },
    { id: "session_25",     name: "Committed",         icon: "💪", xp: 250, earned: sessions_count >= 25 },
    { id: "session_100",    name: "Centurion",         icon: "🏆", xp: 500, earned: sessions_count >= 100 },
    { id: "score_80",       name: "Good Posture",      icon: "⭐", xp: 150, earned: avg_score >= 80 },
    { id: "score_90",       name: "Excellent Posture", icon: "🌟", xp: 300, earned: avg_score >= 90 },
    { id: "streak_7",       name: "Week Warrior",      icon: "📅", xp: 200, earned: streak >= 7 },
    { id: "streak_30",      name: "Monthly Master",    icon: "🗓️", xp: 500, earned: streak >= 30 },
    { id: "calibrated",     name: "Perfectly Tuned",   icon: "🎛️", xp: 100, earned: has_calibration },
    { id: "referral",       name: "Spread the Word",   icon: "📣", xp: 150, earned: referral_count >= 1 },
  ];

  const new_achievements = all
    .filter(a => a.earned && !earned_achievements.includes(a.id))
    .map(a => a.id);

  return res.status(200).json({
    xp,
    level,
    xp_to_next: (level * 500) - xp,
    achievements: all,
    new_achievements,
  });
}
