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

/**
 * Delete every document in a collection, and — with `recurse` — everything
 * beneath each of those documents too.
 *
 * BUG: Firestore does NOT cascade. This used to delete the documents in
 * users/{uid}/sessions without touching their subcollections, so the JPEG
 * frames written to users/{uid}/sessions/{sid}/snapshots survived a
 * "permanent" account deletion as orphans — image data belonging to a user
 * who had exercised their right to erasure. (Snapshot capture is now removed
 * entirely, but historical documents still exist and must go.)
 */
async function deleteCollection(db, collRef, recurse = false) {
  // Re-query each pass rather than paginating with a cursor: deleted docs
  // drop out of the result set, so the next get() returns the next batch.
  for (;;) {
    const snap = await collRef.limit(100).get();
    if (snap.empty) return;
    if (recurse) {
      for (const d of snap.docs) {
        const subs = await d.ref.listCollections();
        for (const sub of subs) await deleteCollection(db, sub, true);
      }
    }
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    if (snap.size < 100) return;
  }
}

// Delete all documents in a top-level collection where uid == targetUid
async function deleteByUid(db, collectionName, uid) {
  // The query is deliberately re-run rather than advanced with a cursor —
  // deleted documents leave the result set, so each pass returns the next
  // batch. (Previously the same `query` object was reused inside a do/while
  // that could not terminate if a delete ever failed; the explicit
  // `snap.size < 100` exit below is the safe form of the same idea.)
  let deleted = 0;
  const query = db.collection(collectionName).where("uid", "==", uid).limit(100);
  for (;;) {
    const snap = await query.get();
    if (snap.empty) return deleted;
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    deleted += snap.size;
    if (snap.size < 100) return deleted;
  }
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

    // 1. Delete user subcollections.
    //    `sessions` recurses because session documents have their own
    //    subcollections (snapshots) that Firestore will not cascade.
    //    api_keys and ai_usage were missed here and deleted only by the
    //    parallel Flask implementation, so which of your personal data
    //    survived erasure depended on which endpoint happened to run.
    await deleteCollection(db, userRef.collection("sessions"), true);
    await Promise.all([
      "payments","ai_insights","notifications",
      "calibration","reports","api_keys","ai_usage"
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

    // 4. Delete the consent record. Neither implementation removed it, so a
    //    "fully deleted" account left a document keyed by uid recording when
    //    that person consented and from what device — personal data about a
    //    subject who has asked to be erased.
    await db.collection("user_consent").doc(uid).delete().catch(() => {});

    // 5. Delete user doc and Firebase Auth account
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
