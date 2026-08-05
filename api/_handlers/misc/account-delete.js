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

// Delete all documents in a top-level collection where uid == targetUid
async function deleteByUid(db, collectionName, uid) {
  let deleted = 0;
  let query = db.collection(collectionName).where("uid", "==", uid).limit(100);
  let snap;
  do {
    snap = await query.get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    deleted += snap.size;
  } while (snap.size === 100);
  return deleted;
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

    // 1. Delete user subcollections
    await Promise.all([
      "sessions","payments","ai_insights",
      "notifications","calibration","reports"
    ].map(col => deleteCollection(db, userRef.collection(col))));

    // 2. Delete top-level collections with uid field (GDPR: all personal data)
    await Promise.all([
      deleteByUid(db, "sessions",      uid),
      deleteByUid(db, "payments",      uid),
      deleteByUid(db, "notifications", uid),
      deleteByUid(db, "reports",       uid),
    ]);

    // 3. If user is org_owner, mark company as owner_deleted (don't orphan silently)
    try {
      const userSnap = await userRef.get();
      const userData = userSnap.exists ? userSnap.data() : {};
      if (userData.is_org_owner && userData.company_id) {
        await db.collection("companies").doc(userData.company_id).update({
          owner_uid:     null,
          owner_deleted: true,
          owner_deleted_at: new Date().toISOString(),
        }).catch(() => {});
      }
    } catch (_) {}

    // 4. Delete user doc and Firebase Auth account
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
