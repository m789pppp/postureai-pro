// Firebase Cloud Messaging — background message handler.
// This file MUST live at the site root (public/firebase-messaging-sw.js →
// served at /firebase-messaging-sw.js) so the browser can register it with
// the correct scope for push notifications.
//
// NOTE: service workers can't use import.meta.env, so this config is
// duplicated from src/firebase.js rather than imported. If you rotate the
// Firebase project, update both places.
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey:            "AIzaSyADLL_muc6ooQnfr1cKDCZFX3FKYknTxiI",
  authDomain:        "postureai-prod.firebaseapp.com",
  projectId:         "postureai-prod",
  storageBucket:     "postureai-prod.firebasestorage.app",
  messagingSenderId: "1055930005121",
  appId:             "1:1055930005121:web:0964a6e53cd590988a3f80",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "PostureAI Pro";
  const body  = payload.notification?.body  || "";
  self.registration.showNotification(title, {
    body,
    icon: "/og-image.png",
    badge: "/og-image.png",
    data: payload.data || {},
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/#home";
  event.waitUntil(clients.openWindow(url));
});
