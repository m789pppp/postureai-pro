/**
 * GET /api/auth/whoami
 * Returns the calling user's tier from Firestore.
 * Used by App.jsx to cross-check tier after login.
 */
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore }                 from "firebase-admin/firestore";
import { getAuth }                      from "firebase-admin/auth";

function getAdmin() {
  if (!getApps().length) {
    initializeApp({ credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    })});
  }
  return { db: getFirestore(), auth: getAuth() };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const { db, auth } = getAdmin();
    const decoded = await auth.verifyIdToken(token);
    const snap = await db.collection("users").doc(decoded.uid).get();
    const data = snap.data() || {};
    return res.status(200).json({
      uid:   decoded.uid,
      email: decoded.email,
      tier:  data.tier || "standard",
      is_trial: data.is_trial || false,
      trial_tier: data.trial_tier || null,
    });
  } catch (e) {
    return res.status(401).json({ error: "Invalid token: " + e.message });
  }
}
