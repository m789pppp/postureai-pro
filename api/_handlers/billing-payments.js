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
  let db, auth;
  try { ({ db, auth } = getAdmin()); }
  catch (e) { console.error("[billing-payments] Firebase Admin init failed:", e.message); return res.status(500).json({error:"Server misconfiguration — Firebase Admin credentials"}); }
  let uid;
  try { uid = (await auth.verifyIdToken(token)).uid; }
  catch { return res.status(401).json({error:"Unauthorized"}); }

  // Fetch payments for this user.
  //
  // where(uid) + orderBy(paid_at) needs a composite index. It's declared in
  // firestore.indexes.json, but — same as every other composite index in
  // this project — the CLI deploy for it never actually landed on live
  // Firestore, so this query threw FAILED_PRECONDITION on every call. There
  // was no try/catch around it, so the whole handler crashed with an
  // unhandled 500 and the Invoices page just showed a dead, broken-looking
  // screen instead of a user's actual billing history — someone's real
  // money with no visible record of it. Fall back to an unindexed
  // where-only query (single-field, always indexed automatically) and sort
  // in memory, the same degrade-instead-of-crash pattern used everywhere
  // else in this backend, rather than losing the whole page over one index.
  let snap;
  try {
    snap = await db.collection("payments")
      .where("uid","==",uid)
      .orderBy("paid_at","desc")
      .limit(50)
      .get();
  } catch (e) {
    console.error("[billing-payments] composite query failed, falling back to unindexed:", e.message);
    try {
      snap = await db.collection("payments")
        .where("uid","==",uid)
        .limit(100)
        .get();
    } catch (e2) {
      // Both attempts failed for a reason that isn't the missing index —
      // an actual connectivity problem. Someone's invoice history failing
      // to load is not the same failure as someone having none; say so.
      console.error("[billing-payments] fallback query also failed:", e2.message);
      return res.status(200).json({ payments: [], error: "temporarily_unavailable" });
    }
  }

  const toMillis = v => {
    if (!v) return 0;
    if (typeof v.toMillis === "function") return v.toMillis();
    if (typeof v._seconds === "number") return v._seconds * 1000;
    const t = new Date(v).getTime();
    return Number.isFinite(t) ? t : 0;
  };

  let payments = snap.docs.map(d => {
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
  // The fallback query above has no orderBy, so sort here — needed every
  // time that path is taken, harmless no-op when the indexed query already
  // came back sorted.
  payments.sort((a,b) => toMillis(b.paid_at) - toMillis(a.paid_at));
  payments = payments.slice(0, 50);

  return res.status(200).json({ payments });
}
