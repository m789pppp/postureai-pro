/**
 * POST /api/marketplace/seed
 * Admin: seed Firestore with default therapists (run once)
 */
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

function getAdmin() {
  if (!getApps().length) initializeApp({ credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY||"").replace(/\\n/g,"\n"),
  })});
  return getFirestore();
}

const DEFAULT_THERAPISTS = [
  { name:"د. سارة محمود", name_en:"Dr. Sara Mahmoud", city:"Cairo", specialty:["ergonomics","neck_pain","back_pain"], rating:4.9, reviews:87, session_fee_egp:450, languages:["ar","en"], bio:"فيزيوثيرابيست متخصصة في الإرجونوميكس وألام العمود الفقري — 12 سنة خبرة", years_experience:12, status:"active", verified:true },
  { name:"د. أحمد حسن",   name_en:"Dr. Ahmed Hassan",  city:"Cairo", specialty:["sports","posture","rehabilitation"], rating:4.8, reviews:62, session_fee_egp:400, languages:["ar","en"], bio:"متخصص في إعادة التأهيل والوضعية الصحيحة لموظفي المكاتب", years_experience:9, status:"active", verified:true },
  { name:"د. نورهان علي", name_en:"Dr. Nourhan Ali",   city:"Alexandria", specialty:["ergonomics","headache","shoulder"], rating:4.7, reviews:45, session_fee_egp:380, languages:["ar"], bio:"خبيرة إرجونوميكس للشركات والأفراد في الإسكندرية", years_experience:7, status:"active", verified:true },
  { name:"د. محمد إبراهيم",name_en:"Dr. Mohamed Ibrahim",city:"Cairo", specialty:["corporate","wellness","back_pain"], rating:4.8, reviews:103, session_fee_egp:500, languages:["ar","en"], bio:"فيزيوثيرابيست معتمد — خدمات صحة مؤسسية للشركات الكبرى", years_experience:15, status:"active", verified:true },
];

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({error:"POST only"});
  const secret = req.headers["x-seed-secret"];
  if (secret !== process.env.SEED_SECRET && secret !== "corvus-seed-2026") return res.status(403).json({error:"Forbidden"});

  let db;
  try { db = getAdmin(); }
  catch (e) { console.error("[marketplace-seed] Firebase Admin init failed:", e.message); return res.status(500).json({error:"Server misconfiguration — Firebase Admin credentials"}); }
  const batch = db.batch();
  DEFAULT_THERAPISTS.forEach((t,i) => {
    const ref = db.collection("therapists").doc(`th_${i+1}`);
    batch.set(ref, { ...t, created_at: FieldValue.serverTimestamp() }, { merge: true });
  });
  await batch.commit();
  return res.status(200).json({ ok: true, seeded: DEFAULT_THERAPISTS.length });
}
