/**
 * POST /api/session/snapshot
 * Saves a worst-posture snapshot for elite PDF reports
 * Replaces Railway /session/{id}/snapshot
 * Body: { session_id, frame (base64 JPEG), score, timestamp }
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
  res.setHeader("Access-Control-Allow-Methods","POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type,Authorization");
  if (req.method==="OPTIONS") return res.status(200).end();
  if (req.method!=="POST") return res.status(405).json({error:"POST only"});

  const token = (req.headers.authorization||"").replace("Bearer ","");
  if (!token) return res.status(401).json({error:"Auth required"});

  const { db, auth } = getAdmin();
  let uid;
  try { uid = (await auth.verifyIdToken(token)).uid; }
  catch { return res.status(401).json({error:"Invalid token"}); }

  const { session_id, frame, score, timestamp } = req.body||{};
  if (!session_id || !frame) return res.status(400).json({error:"session_id and frame required"});

  // Store snapshot in Firestore (truncate frame to ~20KB for safety)
  const truncFrame = frame.length > 40000 ? frame.slice(0, 40000) : frame;
  await db.collection("users").doc(uid)
    .collection("sessions").doc(session_id)
    .collection("snapshots").add({
      score: score||0,
      timestamp: timestamp||new Date().toISOString(),
      frame: truncFrame,
      created_at: FieldValue.serverTimestamp(),
    });

  return res.status(200).json({ ok: true });
}
