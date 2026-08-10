/**
 * GET /api/billing/analytics
 * Admin-only: MRR, ARR, ARPU from Firestore
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

const PRICES = { basic:199, professional:499, pro:499, elite:999, b2b_starter:1499, b2b_growth:3499, b2b_enterprise:8999 };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Headers","Authorization");
  if (req.method !== "GET") return res.status(405).json({error:"GET only"});

  const token = (req.headers.authorization||"").replace("Bearer ","");
  let db, auth;
  try { ({ db, auth } = getAdmin()); }
  catch (e) { console.error("[billing-analytics] Firebase Admin init failed:", e.message); return res.status(500).json({error:"Server misconfiguration — Firebase Admin credentials"}); }
  let uid;
  try { uid = (await auth.verifyIdToken(token)).uid; }
  catch { return res.status(401).json({error:"Unauthorized"}); }

  const caller = await db.collection("users").doc(uid).get();
  if (!["platform_admin","admin"].includes(caller.data()?.user_type) && !caller.data()?.is_admin)
    return res.status(403).json({error:"Admin only"});

  const usersSnap = await db.collection("users")
    .where("tier","not-in",["free","standard"]).limit(2000).get();

  let mrr = 0; const dist = {};
  usersSnap.docs.forEach(d => {
    const t = d.data().tier;
    const p = PRICES[t] || 0;
    if (p && !d.data().is_trial) { mrr += p; dist[t] = (dist[t]||0)+1; }
  });

  const paid = Object.values(dist).reduce((a,b)=>a+b,0);
  return res.status(200).json({
    mrr, arr: mrr*12,
    arpu: paid ? Math.round(mrr/paid) : 0,
    paid_users: paid,
    plan_distribution: dist,
    total_users: usersSnap.size,
  });
}
