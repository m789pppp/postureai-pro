/**
 * GET /api/posture-api/usage
 * Returns API usage stats for the authenticated developer
 * Auth: x-api-key header
 */
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Headers","x-api-key");
  if (req.method !== "GET") return res.status(405).json({error:"GET only"});

  const apiKey = req.headers["x-api-key"];
  if (!apiKey) return res.status(401).json({error:"Missing x-api-key"});

  const db = getAdmin();
  const snap = await db.collection("api_keys").doc(apiKey).get();
  if (!snap.exists || snap.data().status !== "active")
    return res.status(401).json({error:"Invalid API key"});

  const data = snap.data();
  const month = new Date().toISOString().slice(0,7);

  // Last 7 days usage
  const usageSnap = await db.collection("api_usage")
    .where("api_key","==",apiKey)
    .orderBy("called_at","desc").limit(100).get();

  const daily = {};
  usageSnap.docs.forEach(d => {
    const day = d.data().called_at?.toDate?.()?.toISOString?.()?.slice(0,10) || "unknown";
    daily[day] = (daily[day]||0) + 1;
  });

  return res.status(200).json({
    ok: true,
    plan: data.plan,
    monthly_limit: data.monthly_limit,
    calls_this_month: data.calls_this_month || 0,
    remaining: data.monthly_limit ? data.monthly_limit - (data.calls_this_month||0) : null,
    last_used_at: data.last_used_at,
    daily_breakdown: daily,
  });
}
