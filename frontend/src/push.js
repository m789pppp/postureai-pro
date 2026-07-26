/**
 * Corvus — Push Notifications (Firebase Cloud Messaging)
 * Wraps FCM's getToken/permission flow and registers the resulting device
 * token with the existing backend endpoints (/api/push/register|unregister).
 *
 * Requires VITE_FIREBASE_VAPID_KEY — generate this in:
 *   Firebase Console → Project Settings → Cloud Messaging → Web Push
 *   certificates → Generate key pair
 * Without it, requestPushPermission() resolves with { ok:false, reason:"no_vapid_key" }
 * rather than throwing, so the rest of the app keeps working.
 */
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import { auth, db } from "./firebase.js";
import { doc, setDoc, deleteField, updateDoc } from "firebase/firestore";

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || "";

let _messaging = null;
async function getMessagingInstance(fbApp) {
  if (_messaging) return _messaging;
  if (!(await isSupported())) return null; // Safari/older browsers, or no SW support
  _messaging = getMessaging(fbApp || auth.app);
  return _messaging;
}

/**
 * Requests browser notification permission, gets an FCM token, and registers
 * it with the backend. Call this from an explicit user action (a button
 * click), not automatically on page load — browsers ignore/penalize
 * permission prompts that aren't user-initiated.
 */
export async function enablePushNotifications(lang = "en") {
  try {
    if (!("Notification" in window)) return { ok: false, reason: "unsupported" };
    if (!VAPID_KEY) return { ok: false, reason: "no_vapid_key" };

    const messaging = await getMessagingInstance();
    if (!messaging) return { ok: false, reason: "unsupported" };

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { ok: false, reason: "permission_denied" };

    const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    // Pass Firebase config to SW (SW can't access import.meta.env directly)
    await navigator.serviceWorker.ready.then(registration => {
      const sw = registration.active;
      if (sw) {
        sw.postMessage({
          type: "FIREBASE_CONFIG",
          config: {
            apiKey:            import.meta.env.VITE_FIREBASE_API_KEY             || "",
            authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN         || "",
            projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID          || "",
            storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET      || "",
            messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
            appId:             import.meta.env.VITE_FIREBASE_APP_ID              || "",
          },
        });
      }
    });
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    if (!token) return { ok: false, reason: "no_token" };

    // Store push token in Firestore (no Railway needed)
    const uid = auth.currentUser?.uid;
    if (uid) {
      await setDoc(doc(db, "users", uid), {
        push_token: token, push_platform: "web", push_lang: lang,
        push_registered_at: new Date().toISOString(),
      }, { merge: true });
    }
    localStorage.setItem("push_token", token);
    return { ok: true, token };
  } catch (e) {
    console.warn("enablePushNotifications:", e?.message || e);
    return { ok: false, reason: "error", error: e?.message };
  }
}

export async function disablePushNotifications() {
  try {
    const token = localStorage.getItem("push_token");
    if (token) {
      const uid = auth.currentUser?.uid;
      if (uid) {
        await updateDoc(doc(db, "users", uid), { push_token: deleteField(), push_registered_at: deleteField() }).catch(() => {});
      }
      localStorage.removeItem("push_token");
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message };
  }
}

export function isPushEnabled() {
  try { return !!localStorage.getItem("push_token"); } catch { return false; }
}

/** Listen for foreground push messages (app open in an active tab). */
export async function onForegroundPush(callback) {
  const messaging = await getMessagingInstance();
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
}
