/**
 * POST /api/session/start
 * Replaces Railway /session/start — creates session record in Firestore
 * Body: { mode, uid? }
 * Auth: Firebase ID token in Authorization header
 */
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { randomBytes } from "crypto";

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
  res.setHeader("Access-Control-Allow-Methods","POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type,Authorization");
  if (req.method==="OPTIONS") return res.status(200).end();
  if (req.method!=="POST") return res.status(405).json({error:"POST only"});

  const token = (req.headers.authorization||"").replace("Bearer ","");

  // Return local session immediately if Firebase not configured
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_PRIVATE_KEY) {
    return res.status(200).json({ session_id: "local_" + randomBytes(4).toString("hex"), tier: "standard", source: "local" });
  }

  let db, auth;
  try { ({ db, auth } = getAdmin()); } catch(e) {
    return res.status(200).json({ session_id: "local_" + randomBytes(4).toString("hex"), tier: "standard", source: "local_firebase_error" });
  }
  let uid = req.body?.uid;
  let tier = "standard";
  let db_available = false;

  // Try to get UID from token
  if (token) {
    try {
      const { db: _db, auth: _auth } = getAdmin();
      const decoded = await _auth.verifyIdToken(token);
      uid = decoded.uid;
      // Get user tier from Firestore
      const userSnap = await _db.collection("users").doc(uid).get();
      tier = userSnap.data()?.tier || "standard";
      db_available = true;
    } catch(e) {
      // Firebase unavailable (missing env vars) — continue with local session
      console.warn("[session/start] Firebase unavailable:", e.message?.slice(0,80));
    }
  }

  if (!uid || !db_available) {
    // Anonymous/demo/firebase-down — just return a local ID immediately
    return res.status(200).json({ session_id: "local_" + randomBytes(4).toString("hex"), tier });
  }

  // Check session limits for free tier — skip if Firebase unavailable
  if (["free","standard"].includes(tier)) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const dayStart   = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    const [monthSnap, daySnap] = await Promise.all([
      db.collection("users").doc(uid).collection("sessions")
        .where("created_at",">=",monthStart).count().get(),
      db.collection("users").doc(uid).collection("sessions")
        .where("created_at",">=",dayStart).count().get(),
    ]);

    const monthCount = monthSnap.data().count;
    const dayCount   = daySnap.data().count;

    if (monthCount >= 5) {
      return res.status(403).json({
        error:"session_limit_reached",
        upgrade: true,
        used_monthly: monthCount, limit_monthly: 5,
        used_daily: dayCount, limit_daily: 3,
        message:"Free plan: 5 sessions/month. Upgrade to continue.",
      });
    }
    if (dayCount >= 3) {
      return res.status(403).json({
        error:"session_limit_reached",
        upgrade: true,
        used_monthly: monthCount, limit_monthly: 5,
        used_daily: dayCount, limit_daily: 3,
        message:"Free plan: 3 sessions/day. Try again tomorrow.",
      });
    }
  }

  const session_id = "sess_" + randomBytes(6).toString("hex");
  const mode = req.body?.mode || "laptop";

  // Create session doc
  await db.collection("users").doc(uid).collection("sessions").doc(session_id).set({
    session_id, uid, mode, tier, status:"active",
    created_at: new Date().toISOString(),
    server_ts: FieldValue.serverTimestamp(),
  });

  return res.status(200).json({ session_id, tier, mode });
}
