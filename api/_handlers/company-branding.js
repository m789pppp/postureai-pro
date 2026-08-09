/**
 * GET  /api/company/branding  — load saved branding config
 * POST /api/company/branding  — save branding config
 * Auth: Firebase ID token (hr_admin or org_owner only)
 */
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
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
  res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type,Authorization");
  if (req.method==="OPTIONS") return res.status(200).end();

  const token = (req.headers.authorization||"").replace("Bearer ","");
  let db, auth;
  try {
    ({ db, auth } = getAdmin());
  } catch (e) {
    console.error("[company-branding] Firebase Admin init failed:", e.message);
    return res.status(500).json({ error: "Server misconfiguration — Firebase Admin credentials" });
  }
  let uid;
  try { uid = (await auth.verifyIdToken(token)).uid; }
  catch { return res.status(401).json({error:"Unauthorized"}); }

  let user;
  try {
    const userSnap = await db.collection("users").doc(uid).get();
    user = userSnap.data()||{};
  } catch (e) {
    console.error("[company-branding] Firestore read failed:", e.message);
    return res.status(500).json({ error: "Server error — could not load user profile" });
  }
  const companyId = user.company_id || user.companyId;
  const isAdmin = ["platform_admin","hr_admin"].includes(user.user_type) || user.is_org_owner || user.is_admin;
  if (!isAdmin) return res.status(403).json({error:"Admin only"});

  const docRef = companyId
    ? db.collection("companies").doc(companyId).collection("settings").doc("branding")
    : db.collection("users").doc(uid).collection("settings").doc("branding");

  if (req.method==="GET") {
    const snap = await docRef.get();
    return res.status(200).json({ branding: snap.exists ? snap.data() : {} });
  }

  if (req.method==="POST") {
    const { primaryColor, accentColor, bgColor, logoUrl, faviconUrl,
            companyName, customDomain, loginMessage, fontFamily } = req.body||{};

    const branding = {
      primaryColor:  primaryColor  || null,
      accentColor:   accentColor   || null,
      bgColor:       bgColor       || null,
      logoUrl:       logoUrl       || null,
      faviconUrl:    faviconUrl    || null,
      companyName:   companyName   || null,
      customDomain:  customDomain  || null,
      loginMessage:  loginMessage  || null,
      fontFamily:    fontFamily    || null,
      updated_at:    new Date().toISOString(),
      updated_by:    uid,
    };

    await docRef.set(branding, { merge: true });

    // Also update company doc with branding ref
    if (companyId) {
      await db.collection("companies").doc(companyId).update({
        has_branding: true,
        branding_updated_at: FieldValue.serverTimestamp(),
      }).catch(()=>{});
    }

    return res.status(200).json({ ok: true, branding });
  }

  return res.status(405).json({error:"Method not allowed"});
}
