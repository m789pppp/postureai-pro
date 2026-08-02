/**
 * GET /api/cert/verify?id=CRV-2026-XXXXXX
 * Public — no auth required. Verifies a certificate + increments view count.
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
  if (req.method!=="GET") return res.status(405).json({error:"Method not allowed"});
  const cert_id = req.query.id;
  if (!cert_id) return res.status(400).json({error:"id required"});

  const db = getAdmin();
  const snap = await db.collection("certificates").doc(cert_id).get();
  if (!snap.exists) return res.status(404).json({valid:false, error:"Certificate not found"});

  const data = snap.data();
  if (data.expires_at && new Date(data.expires_at)<new Date())
    return res.status(200).json({valid:false, reason:"expired", cert_id, name:data.name});
  if (data.status!=="active")
    return res.status(200).json({valid:false, reason:"revoked", cert_id});

  snap.ref.update({verify_count:FieldValue.increment(1)}).catch(()=>{});

  return res.status(200).json({
    valid:true, cert_id, type:data.type, name:data.name,
    company_name:data.company_name||null, issued_at:data.issued_at,
    expires_at:data.expires_at||null,
    issuer:"Corvus Health Intelligence",
    standard:"ISO 9241-110 Ergonomics of Human-System Interaction",
  });
}
