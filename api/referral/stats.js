/**
 * GET /api/referral/stats
 * Returns real referral stats from Firestore for current user
 * Auth: Bearer Firebase ID token
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

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Headers","Authorization");
  if (req.method !== "GET") return res.status(405).json({error:"GET only"});

  const token = (req.headers.authorization||"").replace("Bearer ","");
  const { db, auth } = getAdmin();
  let uid;
  try { uid = (await auth.verifyIdToken(token)).uid; }
  catch { return res.status(401).json({error:"Unauthorized"}); }

  // Get user's referral code (first 8 chars of uid by default)
  const userSnap = await db.collection("users").doc(uid).get();
  const userData = userSnap.data()||{};
  const ref_code = userData.referral_code || uid.slice(0,8);

  // Get all users who signed up with this referral code
  const refSnap = await db.collection("users")
    .where("referred_by","==",ref_code)
    .limit(100)
    .get();

  const referrals = refSnap.docs.map(d => {
    const u = d.data();
    const isActive = !["free","standard"].includes(u.tier||"free") && !u.is_trial;
    return {
      uid: d.id,
      name: u.name||u.email||"User",
      email: u.email||"",
      status: isActive ? "active" : "pending",
      tier: u.tier||"free",
      joined_at: u.created_at?.toDate?.()?.toISOString() || null,
    };
  });

  const active = referrals.filter(r=>r.status==="active").length;
  const pending = referrals.filter(r=>r.status==="pending").length;

  // EGP credit: 50 EGP per active referral (1 month of Basic plan value)
  const credits_egp = active * 50;
  const total_earned_egp = (userData.referral_total_earned_egp || 0);

  return res.status(200).json({
    ok: true,
    ref_code,
    ref_url: `${process.env.VITE_APP_URL||"https://corvus.io"}?ref=${ref_code}`,
    count: referrals.length,
    converted: active,
    pending,
    credits: credits_egp,
    total_earned: total_earned_egp,
    referrals,
  });
}
