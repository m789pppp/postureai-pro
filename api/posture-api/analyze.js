/**
 * Corvus Posture API — /api/posture-api/analyze
 * 
 * POST — Analyzes posture metrics and returns score + insights
 * Headers: x-api-key: crv_live_xxxxxxxxxxxx
 * Body: { metrics: { neck_tilt, shoulder_tilt, head_forward, back_curve, ear_shoulder_offset } }
 * 
 * Revenue: per-call billing tracked in Firestore
 * Plans: Starter (1k calls/mo), Pro (10k), Enterprise (unlimited)
 */
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

function getAdmin() {
  if (!getApps().length) {
    initializeApp({ credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  (process.env.FIREBASE_PRIVATE_KEY||"").replace(/\\n/g,"\n"),
    })});
  }
  return getFirestore();
}

// ── API Key validation ───────────────────────────────────────────
async function validateApiKey(db, apiKey) {
  if (!apiKey?.startsWith("crv_")) return null;
  const snap = await db.collection("api_keys").doc(apiKey).get();
  if (!snap.exists) return null;
  const data = snap.data();
  if (data.status !== "active") return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
  return data; // { uid, plan, calls_this_month, monthly_limit, ... }
}

// ── Posture scoring engine (mirrors frontend PostureUtils) ───────
function scorePosture(metrics) {
  const {
    neck_tilt = 0,          // degrees — 0 = perfect
    shoulder_tilt = 0,      // degrees — 0 = level
    head_forward = 0,       // cm — forward head position
    back_curve = 0,         // degrees — lumbar curve
    ear_shoulder_offset = 0,// cm — ear vs shoulder alignment
  } = metrics;

  let score = 100;
  const alerts = [];
  const insights = [];

  // Neck tilt penalty
  if (Math.abs(neck_tilt) > 15) {
    const pen = Math.min(25, (Math.abs(neck_tilt) - 15) * 1.2);
    score -= pen;
    alerts.push({ type: "neck_tilt", severity: Math.abs(neck_tilt) > 25 ? "high" : "medium",
      message: `Neck tilted ${neck_tilt.toFixed(1)}° — target < 15°` });
  }

  // Shoulder imbalance
  if (Math.abs(shoulder_tilt) > 8) {
    const pen = Math.min(20, (Math.abs(shoulder_tilt) - 8) * 1.5);
    score -= pen;
    alerts.push({ type: "shoulder_imbalance", severity: "medium",
      message: `Shoulder tilt ${shoulder_tilt.toFixed(1)}° — risk of trapezius strain` });
  }

  // Forward head posture
  if (head_forward > 3) {
    const pen = Math.min(25, (head_forward - 3) * 4);
    score -= pen;
    alerts.push({ type: "forward_head", severity: head_forward > 6 ? "high" : "medium",
      message: `Head ${head_forward.toFixed(1)}cm forward — increases neck load by ${Math.round(head_forward * 4.5)}kg` });
    insights.push("Forward head posture is the #1 cause of neck pain in desk workers.");
  }

  // Back curve
  if (back_curve > 40 || back_curve < 20) {
    const pen = 10;
    score -= pen;
    alerts.push({ type: "back_curve", severity: "low",
      message: `Lumbar curve ${back_curve.toFixed(1)}° — optimal range: 20–40°` });
  }

  // Ear-shoulder alignment
  if (ear_shoulder_offset > 4) {
    const pen = Math.min(15, ear_shoulder_offset * 2);
    score -= pen;
    insights.push("Ear-shoulder misalignment detected. Adjust monitor height to reduce strain.");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const grade = score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : score >= 40 ? "D" : "F";
  const risk = score < 55 ? "high" : score < 70 ? "moderate" : "low";

  const recommendations = [];
  if (alerts.some(a => a.type === "neck_tilt"))
    recommendations.push("Perform chin tucks: gently pull chin back 10 reps every hour.");
  if (alerts.some(a => a.type === "forward_head"))
    recommendations.push("Position monitor at eye level — top of screen at eye height.");
  if (alerts.some(a => a.type === "shoulder_imbalance"))
    recommendations.push("Check chair armrest height — both arms should rest symmetrically.");
  if (!recommendations.length)
    recommendations.push("Excellent posture! Maintain this position and take a 5-min break every 45 min.");

  return { score, grade, risk, alerts, insights, recommendations,
    iso_standard: "ISO 9241-110", analyzed_at: new Date().toISOString() };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,x-api-key");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const apiKey = req.headers["x-api-key"];
  if (!apiKey) return res.status(401).json({ error: "Missing x-api-key header" });

  const db = getAdmin();
  const keyData = await validateApiKey(db, apiKey);
  if (!keyData) return res.status(401).json({ error: "Invalid or expired API key" });

  // Rate limiting check
  const callsThisMonth = keyData.calls_this_month || 0;
  const monthlyLimit   = keyData.monthly_limit || 1000;
  if (callsThisMonth >= monthlyLimit) {
    return res.status(429).json({
      error: "Monthly call limit reached",
      limit: monthlyLimit, used: callsThisMonth,
      upgrade_url: "https://corvus.io/api-pricing",
    });
  }

  const { metrics } = req.body || {};
  if (!metrics || typeof metrics !== "object") {
    return res.status(400).json({ error: "Body must include metrics object" });
  }

  const result = scorePosture(metrics);

  // Track usage (async — don't await)
  const month = new Date().toISOString().slice(0, 7);
  db.collection("api_keys").doc(apiKey).update({
    calls_this_month: FieldValue.increment(1),
    [`calls_${month}`]: FieldValue.increment(1),
    last_used_at: new Date().toISOString(),
  }).catch(() => {});
  db.collection("api_usage").add({
    api_key: apiKey, uid: keyData.uid,
    endpoint: "analyze", called_at: FieldValue.serverTimestamp(),
    score: result.score,
  }).catch(() => {});

  return res.status(200).json({
    ok: true,
    result,
    usage: { calls_used: callsThisMonth + 1, monthly_limit: monthlyLimit,
      remaining: monthlyLimit - callsThisMonth - 1 },
    powered_by: "Corvus Health Intelligence API v1",
  });
}
