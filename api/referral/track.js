/**
 * POST /api/referral/track
 * Records a referral click — called when a user visits /?ref=CODE
 * Body: { ref_code, visitor_id? }
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

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","POST,OPTIONS");
  if (req.method==="OPTIONS") return res.status(200).end();
  if (req.method!=="POST") return res.status(405).json({error:"POST only"});

  const { ref_code } = req.body||{};
  if (!ref_code) return res.status(400).json({error:"ref_code required"});

  const db = getAdmin();

  // Find user with this referral code
  const snap = await db.collection("users")
    .where("referral_code","==",ref_code)
    .limit(1).get();

  // Also try uid prefix match
  let ownerUid = null;
  if (!snap.empty) {
    ownerUid = snap.docs[0].id;
  } else {
    // ref_code might be uid prefix
    const userSnap = await db.collection("users")
      .where("__name__",">=",ref_code)
      .where("__name__","<",ref_code+"~")
      .limit(1).get();
    if (!userSnap.empty) ownerUid = userSnap.docs[0].id;
  }

  if (!ownerUid) return res.status(404).json({error:"Unknown referral code"});

  // Increment click count
  await db.collection("affiliate_stats").doc(ownerUid).set({
    clicks: FieldValue.increment(1),
    ref_code,
    updated_at: new Date().toISOString(),
  }, { merge: true });

  return res.status(200).json({ ok: true });
}
