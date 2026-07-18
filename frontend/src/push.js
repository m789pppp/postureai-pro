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
import { auth } from "./firebase.js";
import { apiFetch } from "./services/api.js";

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
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    if (!token) return { ok: false, reason: "no_token" };

    await apiFetch("/push/register", { method: "POST", body: { token, platform: "web", lang } });
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
      await apiFetch("/push/unregister", { method: "POST", body: { token } }).catch(() => {});
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
