/**
 * Vercel Serverless — GDPR Account Deletion
 * DELETE /api/account/delete
 * Headers: Authorization: Bearer <firebase_id_token>
 */
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getAdmin() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey:  (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
      }),
    });
  }
  return { auth: getAuth(), db: getFirestore() };
}

async function deleteCollection(db, collRef) {
  const snap = await collRef.limit(100).get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  if (snap.size === 100) await deleteCollection(db, collRef);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.VITE_APP_URL || "https://postureai-pro-omega-nine.vercel.app");
  res.setHeader("Access-Control-Allow-Methods", "DELETE, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "DELETE" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const idToken = (req.headers.authorization || "").replace("Bearer ", "").trim();
  if (!idToken) return res.status(401).json({ error: "Authorization required" });

  try {
    const { auth, db } = getAdmin();
    const decoded = await auth.verifyIdToken(idToken);
    const uid = decoded.uid;

    console.log(`[Delete] Starting deletion for uid: ${uid}`);

    const userRef = db.collection("users").doc(uid);

    // Delete all subcollections
    await Promise.all([
      "sessions","payments","ai_insights",
      "notifications","calibration","reports"
    ].map(col => deleteCollection(db, userRef.collection(col))));

    await userRef.delete();
    await auth.deleteUser(uid);

    console.log(`[Delete] Account fully deleted: ${uid}`);
    return res.json({
      success: true,
      message: "Account and all data permanently deleted.",
      deleted_at: new Date().toISOString(),
    });

  } catch (err) {
    console.error("[Delete]", err);
    if (err.code === "auth/id-token-expired") return res.status(401).json({ error: "Session expired" });
    if (err.code === "auth/user-not-found")   return res.status(404).json({ error: "User not found" });
    return res.status(500).json({ error: err.message || "Deletion failed" });
  }
}
