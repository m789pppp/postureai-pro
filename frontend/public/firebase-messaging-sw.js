/**
 * Firebase Cloud Messaging Service Worker
 * Handles background push notifications for Corvus PostureAI
 *
 * SETUP: Add VITE_FIREBASE_VAPID_KEY to Vercel env vars
 * Get VAPID key: Firebase Console → Project Settings → Cloud Messaging → Web Push certificates
 */
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

// These are replaced at build time via env — for SW they must be hardcoded
// or passed via postMessage from the main app
const firebaseConfig = {
  apiKey:            self.__FIREBASE_CONFIG?.apiKey            || "",
  authDomain:        self.__FIREBASE_CONFIG?.authDomain        || "",
  projectId:         self.__FIREBASE_CONFIG?.projectId         || "",
  storageBucket:     self.__FIREBASE_CONFIG?.storageBucket     || "",
  messagingSenderId: self.__FIREBASE_CONFIG?.messagingSenderId || "",
  appId:             self.__FIREBASE_CONFIG?.appId             || "",
};

if (firebaseConfig.apiKey) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage(payload => {
    const { title, body, icon, badge, data } = payload.notification || {};
    const notifType = data?.type || "notification";

    const icons = {
      burnout_alert:   "/icons/icon-fire.png",
      risk_alert:      "/icons/icon-alert.png",
      achievement:     "/icons/icon-trophy.png",
      weekly_digest:   "/icons/icon-chart.png",
      ai_insight:      "/icons/icon-brain.png",
      session_reminder:"/icons/icon-clock.png",
    };

    self.registration.showNotification(title || "Corvus PostureAI", {
      body:    body || "You have a new notification",
      icon:    icons[notifType] || "/icons/icon-192.png",
      badge:   "/icons/badge-72.png",
      data:    data || {},
      actions: [
        { action: "open",    title: "Open",    icon: "/icons/icon-open.png" },
        { action: "dismiss", title: "Dismiss", icon: "/icons/icon-dismiss.png" },
      ],
      vibrate:   [200, 100, 200],
      timestamp: Date.now(),
      tag:       notifType,
      requireInteraction: notifType === "burnout_alert" || notifType === "risk_alert",
    });
  });
}

// Handle notification click
self.addEventListener("notificationclick", event => {
  event.notification.close();
  if (event.action === "dismiss") return;
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client)
          return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});

// Pass Firebase config from main app to SW
self.addEventListener("message", event => {
  if (event.data?.type === "FIREBASE_CONFIG") {
    self.__FIREBASE_CONFIG = event.data.config;
  }
});
