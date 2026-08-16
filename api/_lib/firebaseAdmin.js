import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

export function initFirebaseAdmin() {
  try {
    if (!getApps().length) {
      const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
      if (!process.env.FIREBASE_PROJECT_ID || !privateKey) {
        throw new Error("Firebase env vars missing");
      }
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey,
        }),
      });
    }
    return { db: getFirestore(), auth: getAuth() };
  } catch (e) {
    throw Object.assign(new Error("Firebase Admin init failed: " + e.message), { isFirebaseInitError: true });
  }
}
