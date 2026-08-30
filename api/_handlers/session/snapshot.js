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

  // CLOSED. This endpoint accepted a raw webcam frame and wrote it to
  // Firestore with no blurring of any kind. Its frontend caller was removed
  // some time ago but the route stayed live and authenticated, so any signed-
  // in user could still POST unblurred images of themselves into storage —
  // directly contradicting the product's "no video or images leave your
  // device" claim, and leaving image data in a collection that account
  // deletion does not recurse into.
  //
  // Nothing calls this. Returning 410 rather than deleting the file so the
  // route fails loudly and traceably if some client still tries.
  return res.status(410).json({
    error: "endpoint_removed",
    message: "Snapshot upload has been removed. Posture analysis runs on-device; no images are transmitted.",
  });
}
