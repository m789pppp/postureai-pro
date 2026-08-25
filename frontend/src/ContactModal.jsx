import { useState } from "react";
import { useBodyScrollLock } from "./lib/useBodyScrollLock.js";

const TOPICS_EN = ["General question", "Billing", "Technical issue", "Enterprise / Sales", "Other"];
const TOPICS_AR = ["سؤال عام", "الفواتير", "مشكلة تقنية", "مؤسسات / مبيعات", "أخرى"];

/**
 * In-app Contact Us modal. Posts to /api/email/send/contact (public,
 * no auth required — logged-out landing-page visitors need to reach
 * this too). Falls back to a mailto: link if the request fails, so a
 * network hiccup never leaves the user with no way to reach support.
 */
export function ContactModal({ cs, isAr = false, supportEmail = "m789pppp@gmail.com", supportPhone = "01210271841", onClose }) {
  useBodyScrollLock();
  const t = isAr ? TOPICS_AR : TOPICS_EN;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState(t[0]);
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const [errMsg, setErrMsg] = useState("");

  const bg = cs?.card || "#0b1420";
  const border = cs?.border || "rgba(148,163,184,.15)";
  const text = cs?.text || "#e6edf3";
  const muted = cs?.muted || "#94a3b8";
  const inputBg = cs?.inp || "rgba(148,163,184,.06)";

  const valid = name.trim().length > 0 && email.includes("@") && message.trim().length >= 5;

  async function submit(e) {
    e.preventDefault();
    if (!valid || status === "sending") return;
    setStatus("sending"); setErrMsg("");
    try {
      const res = await fetch("/api/email/send/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), topic, message: message.trim(), website }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setErrMsg(err.message || String(err));
    }
  }

  const mailtoFallback = `mailto:${supportEmail}?subject=${encodeURIComponent(`[${topic}] ${name || "Contact form"}`)}&body=${encodeURIComponent(message)}`;

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 99000, background: "rgba(2,6,12,.72)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        dir={isAr ? "rtl" : "ltr"}
        style={{ width: "100%", maxWidth: 460, maxHeight: "90vh", overflowY: "auto", background: bg, border: `1px solid ${border}`, borderRadius: 16, padding: 28, fontFamily: "'Inter',system-ui,sans-serif" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: text }}>
            {isAr ? "تواصل معنا" : "Contact us"}
          </h2>
          <button onClick={onClose} aria-label={isAr ? "إغلاق" : "Close"} style={{ background: "none", border: "none", color: muted, fontSize: 20, cursor: "pointer", lineHeight: 1, padding: 4 }}>×</button>
        </div>

        {status === "sent" ? (
          <div style={{ padding: "28px 0", textAlign: "center" }}>
            <div style={{ fontSize: 34, marginBottom: 10 }}>✅</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: text, marginBottom: 6 }}>
              {isAr ? "اتبعتت رسالتك!" : "Message sent!"}
            </div>
            <div style={{ fontSize: 13, color: muted, marginBottom: 20 }}>
              {isAr ? "هنرد عليك على إيميلك في أقرب وقت." : "We'll get back to you at your email soon."}
            </div>
            <DirectContactInfo isAr={isAr} email={supportEmail} phone={supportPhone} border={border} muted={muted} text={text} />
            <button onClick={onClose} style={{ marginTop: 18, background: "rgba(56,139,253,.15)", border: "1px solid rgba(56,139,253,.35)", color: "#60a5fa", borderRadius: 10, padding: "9px 22px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              {isAr ? "تمام" : "Done"}
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <p style={{ fontSize: 12.5, color: muted, margin: "6px 0 18px", lineHeight: 1.6 }}>
              {isAr ? "ابعتلنا رسالة وهنرد عليك على الإيميل بتاعك." : "Send us a message and we'll reply to your email."}
            </p>

            {/* Honeypot — hidden from real users, bots fill every field */}
            <input
              type="text" tabIndex={-1} autoComplete="off"
              value={website} onChange={(e) => setWebsite(e.target.value)}
              style={{ position: "absolute", left: -9999, width: 1, height: 1, opacity: 0 }}
              aria-hidden="true"
            />

            <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: muted, marginBottom: 5 }}>
              {isAr ? "الاسم" : "Name"}
            </label>
            <input
              value={name} onChange={(e) => setName(e.target.value)} required maxLength={120}
              style={fieldStyle(inputBg, border, text)}
            />

            <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: muted, margin: "14px 0 5px" }}>
              {isAr ? "الإيميل" : "Email"}
            </label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={200}
              style={fieldStyle(inputBg, border, text)}
            />

            <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: muted, margin: "14px 0 5px" }}>
              {isAr ? "الموضوع" : "Topic"}
            </label>
            <select
              value={topic} onChange={(e) => setTopic(e.target.value)}
              style={{ ...fieldStyle(inputBg, border, text), cursor: "pointer" }}
            >
              {t.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>

            <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: muted, margin: "14px 0 5px" }}>
              {isAr ? "الرسالة" : "Message"}
            </label>
            <textarea
              value={message} onChange={(e) => setMessage(e.target.value)} required maxLength={4000} rows={5}
              style={{ ...fieldStyle(inputBg, border, text), resize: "vertical", fontFamily: "inherit" }}
            />

            {status === "error" && (
              <div style={{ marginTop: 12, padding: "10px 12px", background: "rgba(248,81,73,.1)", border: "1px solid rgba(248,81,73,.3)", borderRadius: 8, fontSize: 12, color: "#f87171" }}>
                {isAr ? "حصل خطأ وإحنا بنبعت رسالتك. " : "Something went wrong sending your message. "}
                <a href={mailtoFallback} style={{ color: "#f87171", textDecoration: "underline" }}>
                  {isAr ? `ابعتلنا مباشرة على ${supportEmail}` : `Email us directly at ${supportEmail}`}
                </a>
              </div>
            )}

            <button
              type="submit" disabled={!valid || status === "sending"}
              style={{
                marginTop: 18, width: "100%", padding: "11px 0", borderRadius: 10, border: "none",
                background: valid ? "linear-gradient(135deg,#1158c7,#0891b2)" : "rgba(148,163,184,.15)",
                color: valid ? "#fff" : muted, fontWeight: 700, fontSize: 14,
                cursor: valid && status !== "sending" ? "pointer" : "not-allowed",
              }}
            >
              {status === "sending" ? (isAr ? "بيتبعت..." : "Sending...") : (isAr ? "ابعت الرسالة" : "Send message")}
            </button>

            <DirectContactInfo isAr={isAr} email={supportEmail} phone={supportPhone} border={border} muted={muted} text={text} />
          </form>
        )}
      </div>
    </div>
  );
}

function DirectContactInfo({ isAr, email, phone, border, muted, text }) {
  return (
    <div style={{ marginTop: 22, paddingTop: 18, borderTop: `1px solid ${border}` }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>
        {isAr ? "أو تواصل مباشرة" : "Or reach us directly"}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <a href={`tel:${phone.replace(/\s+/g, "")}`} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, color: text, textDecoration: "none", fontWeight: 600 }}>
          <span style={{ fontSize: 15 }}>📞</span>
          <span dir="ltr">{phone}</span>
        </a>
        <a href={`mailto:${email}`} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, color: text, textDecoration: "none", fontWeight: 600 }}>
          <span style={{ fontSize: 15 }}>✉️</span>
          <span dir="ltr">{email}</span>
        </a>
      </div>
    </div>
  );
}

function fieldStyle(inputBg, border, text) {
  return {
    width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 8,
    background: inputBg, border: `1px solid ${border}`, color: text, fontSize: 13.5,
  };
}
