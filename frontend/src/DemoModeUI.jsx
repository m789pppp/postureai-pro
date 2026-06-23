/**
 * DemoModeUI.jsx — Standalone demo experience for Corvus
 *
 * Entry point: page === "demo" in App.jsx, reached only via an explicit
 * "Try without signing up" link on the landing page. Never auto-triggered,
 * never mixed into the real signed-in product flow.
 *
 * Flow:
 *   1. Welcome screen — collect a first name only (or pick the permanent
 *      showcase account), no email/password.
 *   2. Hands off to the SAME live tracking page the real product uses
 *      (App.jsx page==="live") — this reuses the already-tested MediaPipe
 *      analysis engine instead of forking it. App.jsx detects `window.__demoMode`
 *      and routes session saves to localStorage via DemoMode.js instead of
 *      Firestore.
 *   3. Dashboard — shows demo session history from localStorage, with a
 *      persistent banner explaining this is a demo and inviting signup.
 */
import { useState, useEffect } from "react";
import {
  getDemoProfile, startDemoProfile, startShowcaseProfile, endDemoSession,
  getDemoSessions, deleteDemoSession, DEMO_SHOWCASE_NAME,
} from "./DemoMode.js";

const C = {
  bg: "#030b14", card: "#05101f", border: "rgba(148,163,184,.12)",
  text: "#f0f4f8", muted: "#64748b", blue: "#1a56db", green: "#10b981",
  amber: "#f59e0b", red: "#ef4444",
};

function gradeColor(s) { return s >= 75 ? C.green : s >= 50 ? C.amber : C.red; }
function gradeLabel(s, ar) {
  return s >= 85 ? (ar ? "ممتاز" : "Excellent")
       : s >= 70 ? (ar ? "جيد" : "Good")
       : s >= 50 ? (ar ? "مقبول" : "Fair")
       : (ar ? "ضعيف" : "Poor");
}

// ── Persistent demo banner — shown on every demo screen ────────────
function DemoBanner({ isAr, onExit }) {
  return (
    <div style={{
      background: "linear-gradient(135deg,rgba(26,86,219,.16),rgba(8,145,178,.10))",
      border: "1px solid rgba(26,86,219,.3)", borderRadius: 12,
      padding: "10px 16px", display: "flex", alignItems: "center",
      justifyContent: "space-between", gap: 12, marginBottom: 18, flexWrap: "wrap",
    }}>
      <div style={{ fontSize: 12.5, color: C.text, fontWeight: 600 }}>
        🎬 {isAr ? "وضع العرض التجريبي — البيانات محفوظة على هذا الجهاز فقط، غير مرتبطة بأي حساب"
                  : "Demo Mode — data is saved on this device only, not linked to any account"}
      </div>
      <button onClick={onExit} style={{
        background: "rgba(255,255,255,.06)", border: `1px solid ${C.border}`,
        borderRadius: 8, padding: "6px 14px", color: C.text, fontSize: 12,
        fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
      }}>
        {isAr ? "إنهاء العرض" : "Exit Demo"}
      </button>
    </div>
  );
}

// ── Welcome / gate screen ───────────────────────────────────────────
export function DemoWelcome({ isAr, onStart, onBack }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  function go(useShowcase) {
    setBusy(true);
    const profile = useShowcase ? startShowcaseProfile() : startDemoProfile(name);
    onStart(profile, useShowcase);
  }

  return (
    <div style={{
      minHeight: "100vh", background: C.bg, color: C.text,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px", fontFamily: "'DM Sans',system-ui,sans-serif",
      direction: isAr ? "rtl" : "ltr",
    }}>
      <div style={{ maxWidth: 440, width: "100%" }}>
        {onBack && (
          <button onClick={onBack} style={{
            background: "none", border: "none", color: C.muted, cursor: "pointer",
            fontSize: 13, fontWeight: 600, marginBottom: 24, display: "flex",
            alignItems: "center", gap: 6,
          }}>
            {isAr ? "→" : "←"} {isAr ? "رجوع" : "Back"}
          </button>
        )}

        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em",
          textTransform: "uppercase", color: C.blue, marginBottom: 10 }}>
          {isAr ? "عرض تجريبي · بدون تسجيل" : "DEMO · NO SIGNUP REQUIRED"}
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 10px", letterSpacing: "-0.02em" }}>
          {isAr ? "جرّب Corvus الآن" : "Try Corvus right now"}
        </h1>
        <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.7, margin: "0 0 28px" }}>
          {isAr
            ? "تتبّع وضعيتك الحية بالكاميرا فوراً. بياناتك تُحفظ على جهازك فقط — مفيش إيميل، مفيش حساب."
            : "Live posture tracking from your camera, instantly. Your data stays on this device only — no email, no account."}
        </p>

        <div style={{ background: C.card, border: `1px solid ${C.border}`,
          borderRadius: 16, padding: 24, marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: C.muted,
            display: "block", marginBottom: 8 }}>
            {isAr ? "اسمك (اختياري)" : "Your name (optional)"}
          </label>
          <input
            value={name} onChange={e => setName(e.target.value)}
            placeholder={isAr ? "مثال: محمد" : "e.g. Sam"}
            onKeyDown={e => e.key === "Enter" && !busy && go(false)}
            style={{
              width: "100%", padding: "12px 14px", background: "rgba(255,255,255,.04)",
              border: `1px solid ${C.border}`, borderRadius: 10, color: C.text,
              fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 14,
            }}
          />
          <button onClick={() => go(false)} disabled={busy} style={{
            width: "100%", padding: "13px 0", borderRadius: 10, border: "none",
            background: "linear-gradient(135deg,#1a56db,#0891b2)", color: "#fff",
            fontSize: 14, fontWeight: 700, cursor: busy ? "wait" : "pointer",
          }}>
            {isAr ? "ابدأ جلسة تجريبية مباشرة ←" : "Start Live Demo Session →"}
          </button>
        </div>

        <button onClick={() => go(true)} disabled={busy} style={{
          width: "100%", background: "rgba(255,255,255,.03)", border: `1px solid ${C.border}`,
          borderRadius: 14, padding: "14px 16px", color: C.text, cursor: busy ? "wait" : "pointer",
          display: "flex", alignItems: "center", gap: 12, textAlign: isAr ? "right" : "left",
        }}>
          <span style={{ fontSize: 22 }}>🎓</span>
          <span style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{DEMO_SHOWCASE_NAME}</div>
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>
              {isAr ? "شاهد البيانات والتقارير فوراً بدون كاميرا" : "See sample data & reports instantly, no camera needed"}
            </div>
          </span>
          <span style={{ color: C.muted }}>{isAr ? "←" : "→"}</span>
        </button>
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────
export function DemoDashboard({ isAr, onStartSession, onExit, onUpgrade }) {
  const [profile, setProfile] = useState(null);
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    setProfile(getDemoProfile());
    setSessions(getDemoSessions());
  }, []);

  function refresh() { setSessions(getDemoSessions()); }

  function handleDelete(id) {
    deleteDemoSession(id);
    refresh();
  }

  const avg = sessions.length
    ? Math.round(sessions.reduce((a, s) => a + (s.avg_score || 0), 0) / sessions.length)
    : 0;
  const best = sessions.length ? Math.max(...sessions.map(s => s.avg_score || 0)) : 0;

  return (
    <div style={{
      minHeight: "100vh", background: C.bg, color: C.text,
      padding: "32px 5vw 60px", fontFamily: "'DM Sans',system-ui,sans-serif",
      direction: isAr ? "rtl" : "ltr",
    }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <DemoBanner isAr={isAr} onExit={onExit} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>
              {isAr ? "أهلاً" : "Hey"}, {profile?.name || "Guest"}
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: "4px 0 0" }}>
              {isAr ? "لوحة العرض التجريبي" : "Demo Dashboard"}
            </h1>
          </div>
          <button onClick={onStartSession} style={{
            background: "linear-gradient(135deg,#1a56db,#0891b2)", border: "none",
            borderRadius: 10, padding: "11px 20px", color: "#fff", fontSize: 13,
            fontWeight: 700, cursor: "pointer",
          }}>
            ▶ {isAr ? "ابدأ جلسة جديدة" : "Start New Session"}
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 24 }}>
          {[
            { label: isAr ? "الجلسات" : "Sessions", val: sessions.length, color: "#a855f7" },
            { label: isAr ? "المتوسط" : "Avg Score", val: avg || "—", color: "#3b82f6" },
            { label: isAr ? "الأفضل" : "Best", val: best || "—", color: "#10b981" },
          ].map(m => (
            <div key={m.label} style={{ background: C.card, border: `1px solid ${C.border}`,
              borderRadius: 12, padding: "14px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: m.color }}>{m.val}</div>
              <div style={{ fontSize: 10.5, color: C.muted, marginTop: 3 }}>{m.label}</div>
            </div>
          ))}
        </div>

        {sessions.length === 0 ? (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
            padding: "48px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
              {isAr ? "لا توجد جلسات بعد" : "No sessions yet"}
            </div>
            <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 20 }}>
              {isAr ? "ابدأ جلستك الأولى لترى نتائج حقيقية من الكاميرا" : "Start your first session to see real camera-based results"}
            </div>
            <button onClick={onStartSession} style={{
              background: "linear-gradient(135deg,#1a56db,#0891b2)", border: "none",
              borderRadius: 10, padding: "11px 22px", color: "#fff", fontSize: 13,
              fontWeight: 700, cursor: "pointer",
            }}>
              {isAr ? "ابدأ الآن" : "Start Now"}
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sessions.map((s, i) => {
              const d = new Date(s.created_at || Date.now());
              const sc = s.avg_score || 0;
              const col = gradeColor(sc);
              const dur = s.duration_s || s.duration_sec || 0;
              const durStr = dur >= 60 ? `${Math.floor(dur / 60)}m ${dur % 60}s` : dur > 0 ? `${dur}s` : "";
              return (
                <div key={s.id || i} style={{
                  background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
                  padding: "13px 16px", display: "flex", gap: 12, alignItems: "center",
                }}>
                  <div style={{ width: 42, height: 42, borderRadius: 8, flexShrink: 0,
                    background: `${col}18`, display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: 15, fontWeight: 800, color: col }}>
                    {sc || "—"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      {isAr ? `جلسة #${sessions.length - i}` : `Session #${sessions.length - i}`}
                      {s.isShowcaseSample && (
                        <span style={{ fontSize: 9, color: C.muted, background: "rgba(255,255,255,.06)",
                          padding: "1px 7px", borderRadius: 99 }}>
                          {isAr ? "نموذج" : "sample"}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                      {d.toLocaleDateString(isAr ? "ar-EG" : "en-US", { month: "short", day: "numeric" })}
                      {durStr && ` · ${durStr}`}
                      {s.good_pct > 0 && ` · ${s.good_pct}% ${isAr ? "جيدة" : "good"}`}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 99,
                    background: `${col}18`, color: col }}>
                    {gradeLabel(sc, isAr)}
                  </span>
                  <button onClick={() => handleDelete(s.id)} title={isAr ? "حذف" : "Delete"} style={{
                    background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.2)",
                    borderRadius: 7, padding: "5px 9px", color: "#f87171", fontSize: 12, cursor: "pointer",
                  }}>
                    🗑️
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: 32, background: "linear-gradient(135deg,rgba(26,86,219,.1),rgba(8,145,178,.06))",
          border: "1px solid rgba(26,86,219,.2)", borderRadius: 16, padding: "24px 28px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
              {isAr ? "عجبك العرض؟" : "Liked what you saw?"}
            </div>
            <div style={{ fontSize: 12.5, color: C.muted }}>
              {isAr ? "أنشئ حساب مجاني واحتفظ بسجلك الحقيقي إلى الأبد" : "Create a free account and keep your real history forever"}
            </div>
          </div>
          <button onClick={onUpgrade} style={{
            background: "linear-gradient(135deg,#1a56db,#0891b2)", border: "none",
            borderRadius: 10, padding: "12px 22px", color: "#fff", fontSize: 13,
            fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
          }}>
            {isAr ? "إنشاء حساب مجاني" : "Create Free Account"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function clearDemoOnExit(setPage) {
  endDemoSession();
  if (typeof window !== "undefined") window.__demoMode = false;
  setPage("landing");
}
