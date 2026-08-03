/**
 * Corvus Posture API — /api/posture-api/keys
 * POST { action: "create"|"list"|"revoke", uid, key_id? }
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

const PLANS = {
  basic:      { monthly_limit: 1000,  price_egp: 299 },
  pro:        { monthly_limit: 10000, price_egp: 999 },
  enterprise: { monthly_limit: null,  price_egp: null }, // custom
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  // Verify Firebase auth token
  const token = (req.headers.authorization||"").replace("Bearer ","");
  if (!token) return res.status(401).json({ error: "Missing auth token" });

  const { db, auth } = getAdmin();
  let uid;
  try { uid = (await auth.verifyIdToken(token)).uid; }
  catch { return res.status(401).json({ error: "Invalid token" }); }

  const { action, plan = "basic", key_id, label } = req.body || {};

  if (action === "create") {
    // Check existing key count
    const existing = await db.collection("api_keys")
      .where("uid", "==", uid).where("status", "==", "active").get();
    if (existing.size >= 5) return res.status(400).json({ error: "Max 5 active keys" });

    const planConfig = PLANS[plan] || PLANS.basic;
    const key = "crv_live_" + randomBytes(16).toString("hex");
    const keyDoc = {
      uid, plan, status: "active",
      label: label || `Key ${existing.size + 1}`,
      monthly_limit: planConfig.monthly_limit,
      calls_this_month: 0,
      created_at: FieldValue.serverTimestamp(),
      expires_at: null,
    };
    await db.collection("api_keys").doc(key).set(keyDoc);
    return res.status(200).json({ ok: true, key, plan, monthly_limit: planConfig.monthly_limit });
  }

  if (action === "list") {
    const snap = await db.collection("api_keys").where("uid","==",uid).get();
    const keys = snap.docs.map(d => {
      const { uid: _, ...rest } = d.data();
      return { key_id: d.id.slice(0,20)+"...", ...rest }; // mask key
    });
    return res.status(200).json({ ok: true, keys });
  }

  if (action === "revoke") {
    if (!key_id) return res.status(400).json({ error: "key_id required" });
    const keyDoc = await db.collection("api_keys").doc(key_id).get();
    if (!keyDoc.exists || keyDoc.data().uid !== uid)
      return res.status(403).json({ error: "Not your key" });
    await keyDoc.ref.update({ status: "revoked", revoked_at: FieldValue.serverTimestamp() });
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: "Invalid action" });
}
