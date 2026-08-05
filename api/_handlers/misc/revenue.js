/**
 * GET /api/metrics/revenue
 * Returns real MRR/ARR/ARPU/churn computed from Firestore users collection
 * Auth: Firebase ID token (admin or platform_admin only)
 */
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

function getAdmin() {
  if (!getApps().length) {
    initializeApp({ credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  (process.env.FIREBASE_PRIVATE_KEY||"").replace(/\\n/g,"\n"),
    })});
  }
  return { db: getFirestore(), auth: getAuth() };
}

// EGP price per tier per month
const TIER_PRICE = {
  basic: 199, professional: 499, pro: 499, elite: 999,
  b2b_starter: 1499, b2b_growth: 3499, b2b_enterprise: 8999,
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Headers","Authorization");
  if (req.method !== "GET") return res.status(405).json({error:"GET only"});

  const token = (req.headers.authorization||"").replace("Bearer ","");
  const { db, auth } = getAdmin();

  // Verify caller is admin
  let callerUid;
  try { callerUid = (await auth.verifyIdToken(token)).uid; }
  catch { return res.status(401).json({error:"Unauthorized"}); }

  const callerDoc = await db.collection("users").doc(callerUid).get();
  const callerData = callerDoc.data()||{};
  if (!["platform_admin","admin"].includes(callerData.user_type) && !callerData.is_admin) {
    return res.status(403).json({error:"Admin only"});
  }

  // Fetch all paid users
  const snap = await db.collection("users")
    .where("tier", "!=", "free")
    .where("tier", "!=", "standard")
    .limit(2000)
    .get();

  const users = snap.docs.map(d => d.data()).filter(u => u.tier);

  // Compute MRR
  let mrr = 0;
  const plan_distribution = {};
  const churn_candidates = [];

  users.forEach(u => {
    const price = TIER_PRICE[u.tier] || 0;
    if (!u.is_trial && price > 0) {
      mrr += price;
      plan_distribution[u.tier] = (plan_distribution[u.tier]||0) + 1;
    }
    // Churn candidate: no login in 30+ days
    if (u.last_login_at) {
      const daysSince = (Date.now() - new Date(u.last_login_at).getTime()) / 86400000;
      if (daysSince > 30) churn_candidates.push(u.uid);
    }
  });

  // Monthly revenue last 6 months (from Kashier webhook logs if available)
  const now = new Date();
  const monthly_revenue = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toISOString().slice(0,7);
    monthly_revenue[key] = 0; // init
  }

  try {
    const paymentsSnap = await db.collection("payments")
      .where("status","==","paid")
      .orderBy("paid_at","desc")
      .limit(500)
      .get();
    paymentsSnap.docs.forEach(d => {
      const { amount_egp, paid_at } = d.data();
      const month = paid_at?.slice?.(0,7);
      if (month && monthly_revenue[month] !== undefined) {
        monthly_revenue[month] += (amount_egp || 0);
      }
    });
  } catch {} // payments collection might not exist yet

  const paid_users = Object.values(plan_distribution).reduce((a,b)=>a+b, 0);
  const trial_users = users.filter(u => u.is_trial).length;
  const arr = mrr * 12;
  const arpu = paid_users > 0 ? Math.round(mrr / paid_users) : 0;
  const churn_rate = paid_users > 0
    ? Math.round((churn_candidates.length / paid_users) * 100 * 10) / 10
    : 0;

  return res.status(200).json({
    mrr, arr, arpu, churn_rate,
    paid_users, trial_users,
    total_users: users.length,
    plan_distribution,
    monthly_revenue,
    churn_count: churn_candidates.length,
    computed_at: new Date().toISOString(),
  });
}
