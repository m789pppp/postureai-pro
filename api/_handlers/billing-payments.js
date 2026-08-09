/**
 * GET /api/billing/payments
 * Returns real payment history for the authenticated user from Firestore
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

  // Fetch payments for this user
  const snap = await db.collection("payments")
    .where("uid","==",uid)
    .orderBy("paid_at","desc")
    .limit(50)
    .get();

  const payments = snap.docs.map(d => {
    const p = d.data();
    return {
      id:         d.id,
      ref_code:   p.ref_code || d.id,
      amount:     p.amount_egp || p.amount || 0,
      currency:   p.currency || "EGP",
      plan:       p.plan || p.tier || "unknown",
      status:     p.status || "paid",
      paid_at:    p.paid_at || p.created_at || null,
      description:p.description || `Corvus ${p.plan || "Plan"}`,
      invoice_url:p.invoice_url || null,
    };
  });

  return res.status(200).json({ payments });
}
