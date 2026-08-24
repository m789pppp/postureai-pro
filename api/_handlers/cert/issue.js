/**
 * POST /api/cert/issue
 * Issues a Corvus Ergonomist Certificate
 * Body: { uid, type: "individual"|"company", name, company_name?, payment_ref, lang }
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
  if (req.method==="OPTIONS") return res.status(200).end();
  if (req.method!=="POST") return res.status(405).json({error:"Method not allowed"});

  const { uid, type="individual", name, company_name, payment_ref, lang="en" } = req.body||{};
  if (!uid || !name) return res.status(400).json({error:"uid and name required"});

  const { db, auth } = getAdmin();
  // Was unauthenticated — only checked that `uid` belonged to SOME real
  // Firebase user via auth.getUser(uid), never that the CALLER was that
  // user. Anyone who knew (or guessed/enumerated) any uid could POST here
  // directly and get a certificate issued in that person's name for free,
  // bypassing payment_ref entirely (it was stored but never verified
  // against anything). Now requires a valid ID token whose own uid matches
  // the uid being issued a cert, same pattern as org-invite.js's
  // requireAuth().
  const idToken = (req.headers.authorization || "").replace("Bearer ", "").trim();
  if (!idToken) return res.status(401).json({error:"Authentication required"});
  let decoded;
  try { decoded = await auth.verifyIdToken(idToken); }
  catch { return res.status(401).json({error:"Invalid or expired token"}); }
  if (decoded.uid !== uid) return res.status(403).json({error:"Cannot issue a certificate for another user"});

  // Check existing active cert
  const existing = await db.collection("certificates")
    .where("uid","==",uid).where("type","==",type).where("status","==","active")
    .limit(1).get();

  if (!existing.empty) {
    const d = existing.docs[0].data();
    return res.status(200).json({
      cert_id: existing.docs[0].id, issued_at: d.issued_at,
      expires_at: d.expires_at, already_exists: true,
      verify_url: `${process.env.VITE_APP_URL||"https://corvus.io"}/verify/${existing.docs[0].id}`,
    });
  }

  const suffix = randomBytes(3).toString("hex").toUpperCase();
  const cert_id = `CRV-${new Date().getFullYear()}-${suffix}`;
  const issued_at = new Date().toISOString();
  const expires_at = type==="individual" ? null : new Date(Date.now()+365*24*3600000).toISOString();

  await db.collection("certificates").doc(cert_id).set({
    cert_id, uid, type, name, company_name:company_name||null,
    payment_ref:payment_ref||null, issued_at, expires_at,
    status:"active", lang, verify_count:0,
    created_at: FieldValue.serverTimestamp(),
  });

  await db.collection("users").doc(uid).update({
    has_cert:true, cert_id, cert_type:type,
    cert_issued_at:issued_at, updated_at:FieldValue.serverTimestamp(),
  });

  return res.status(200).json({
    cert_id, issued_at, expires_at,
    verify_url:`${process.env.VITE_APP_URL||"https://corvus.io"}/verify/${cert_id}`,
  });
}
