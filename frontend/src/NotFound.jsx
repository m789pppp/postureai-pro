/**
 * Corvus — 404 Not Found
 * Clean, branded, bilingual
 */
import React from "react";

export default function NotFound({ onNavigate }) {
  const isAr = document.documentElement.lang === "ar";

  return (
    <div style={{
      minHeight: "100vh",
      background: "#030b14",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      padding: 24,
    }}>
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        {/* Animated number */}
        <div style={{
          fontSize: "clamp(80px,15vw,140px)",
          fontWeight: 900,
          letterSpacing: "-.05em",
          lineHeight: 1,
          background: "linear-gradient(135deg,#4f7cf9,#22d3ee)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          marginBottom: 16,
        }}>404</div>

        <div style={{ fontSize: 24, fontWeight: 700, color: "#e8f0ff", marginBottom: 12 }}>
          {isAr ? "الصفحة غير موجودة" : "Page not found"}
        </div>

        <p style={{ fontSize: 16, color: "#8fa3c0", lineHeight: 1.6, marginBottom: 32 }}>
          {isAr
            ? "يبدو أن هذه الصفحة غير موجودة أو تم نقلها."
            : "This page doesn't exist or may have been moved."}
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => onNavigate ? onNavigate("landing") : (window.location.href = "/")}
            style={{
              background: "linear-gradient(135deg,#4f7cf9,#22d3ee)",
              color: "#fff", border: "none", borderRadius: 10,
              padding: "13px 26px", fontSize: 15, fontWeight: 600,
              cursor: "pointer",
            }}>
            {isAr ? "← العودة للرئيسية" : "← Back to Home"}
          </button>
          <button
            onClick={() => onNavigate ? onNavigate("auth") : (window.location.href = "/auth")}
            style={{
              background: "rgba(255,255,255,.06)",
              border: "1px solid rgba(148,163,184,.12)",
              color: "#8fa3c0", borderRadius: 10,
              padding: "13px 26px", fontSize: 15, fontWeight: 500,
              cursor: "pointer",
            }}>
            {isAr ? "تسجيل الدخول" : "Sign In"}
          </button>
        </div>

        {/* Decorative posture icon */}
        <div style={{ marginTop: 48, fontSize: 48, opacity: 0.15 }}>🧘</div>
      </div>
    </div>
  );
}
