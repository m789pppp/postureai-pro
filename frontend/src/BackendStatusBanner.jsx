/**
 * Corvus — Backend Status Banner
 *
 * Mounted once at the root (main.jsx), independent of whatever page App.jsx
 * is currently rendering. Pings /api/health on load and periodically; shows
 * a persistent top banner if the backend (Railway) is unreachable, cold,
 * misconfigured, or timing out — instead of the previous behavior where a
 * dead/misconfigured backend just produced silent failed fetches all over
 * the app with no explanation to the user.
 */
import { useEffect, useState, useRef } from "react";
import { API_BASE_URL, API_MISCONFIGURED, apiHealthCheck } from "./config/api.js";

const RETRY_MS = 30000;

export default function BackendStatusBanner() {
  const [status, setStatus] = useState("checking"); // checking | ok | down
  const [lang, setLang] = useState(() => (document.documentElement.lang === "ar" ? "ar" : "en"));
  const timerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (API_MISCONFIGURED) {
        if (!cancelled) setStatus("down");
        return;
      }
      const { ok } = await apiHealthCheck();
      if (!cancelled) setStatus(ok ? "ok" : "down");
    }

    check();
    timerRef.current = setInterval(check, RETRY_MS);
    return () => { cancelled = true; clearInterval(timerRef.current); };
  }, []);

  if (status !== "down") return null;

  const isAr = lang === "ar";

  return (
    <div
      role="alert"
      style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 99999,
        background: "#7f1d1d", color: "#fff",
        fontSize: 12.5, fontWeight: 600, textAlign: "center",
        padding: "8px 14px", boxShadow: "0 2px 12px rgba(0,0,0,.3)",
        fontFamily: "'Inter',system-ui,sans-serif",
      }}
    >
      {API_MISCONFIGURED
        ? (isAr
            ? "⚠️ الخادم غير مهيأ لهذا الإصدار (VITE_API_URL غير موجود). بعض الميزات لن تعمل."
            : "⚠️ Backend URL isn't configured for this deployment (VITE_API_URL missing). Some features won't work.")
        : (isAr
            ? "⚠️ تعذّر الوصول إلى الخادم حالياً. بعض الميزات (الحفظ، تسجيل الدخول، التقارير) قد لا تعمل — جاري إعادة المحاولة تلقائياً."
            : "⚠️ Can't reach the server right now. Some features (saving, sign-in, reports) may not work — retrying automatically.")}
    </div>
  );
}
