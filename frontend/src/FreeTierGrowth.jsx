/**
 * Corvus — Free Tier Growth Kit
 * ─────────────────────────────────────────────────────────────────
 * Three small, self-contained pieces addressing the "empty dashboard,
 * invisible limit, no upgrade path" gap on the Free (standard) tier:
 *
 *  1. <SessionUsageBar>   — "Used X of 5 this month" progress bar,
 *     shown on the Free-tier dashboard so the monthly cap is no
 *     longer invisible marketing copy.
 *  2. <DemoSessionModal>  — "Watch a Demo Session" — a canned, fully
 *     narrated 45-minute result screen, no camera required. Lets a
 *     brand-new user see the score reveal + AI coaching before they
 *     commit to sitting in front of their webcam.
 *  3. <UpgradeTeaser>     — a single-line nudge shown once, right
 *     after a Free-tier user's first real completed session, pointing
 *     at the Predictive AI feature they don't have yet.
 *
 * All three are presentational + local-state only — no new network
 * calls, no new Firestore fields required beyond the one boolean the
 * caller already persists (see onDismiss in UpgradeTeaser).
 */
import { useState } from "react";

const FREE_MONTHLY_SESSION_LIMIT = 5;

/* ────────────────────────────────────────────────────────────────
   1. SessionUsageBar
   ──────────────────────────────────────────────────────────────── */
export function SessionUsageBar({ used = 0, limit = FREE_MONTHLY_SESSION_LIMIT, isAr, cs, onUpgrade }) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const atLimit = used >= limit;
  const nearLimit = !atLimit && used >= limit - 1;
  const barColor = atLimit ? "#ef4444" : nearLimit ? "#f59e0b" : "#1a56db";

  return (
    <div style={{
      background: cs.card, border: `1px solid ${cs.border}`, borderRadius: 12,
      padding: "14px 16px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: cs.text }}>
          {isAr ? "جلسات هذا الشهر" : "Sessions this month"}
        </span>
        <span style={{ fontSize: 12, fontWeight: 800, color: barColor }}>
          {used} {isAr ? "من" : "of"} {limit}
        </span>
      </div>
      <div style={{ height: 7, borderRadius: 99, background: "rgba(148,163,184,.15)", overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`, background: barColor, borderRadius: 99,
          transition: "width 400ms cubic-bezier(0.16,1,0.3,1)",
        }} />
      </div>
      {(atLimit || nearLimit) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 10 }}>
          <span style={{ fontSize: 11.5, color: atLimit ? "#f87171" : "#fbbf24", lineHeight: 1.4 }}>
            {atLimit
              ? (isAr ? "وصلت للحد الشهري المجاني" : "You've hit your free monthly limit")
              : (isAr ? "جلسة واحدة متبقية هذا الشهر" : "1 session left this month")}
          </span>
          <button onClick={onUpgrade} style={{
            flexShrink: 0, background: "rgba(26,86,219,.15)", border: "1px solid rgba(26,86,219,.35)",
            borderRadius: 8, padding: "5px 11px", fontSize: 11, fontWeight: 700, color: "#93c5fd", cursor: "pointer",
          }}>
            {isAr ? "ترقية" : "Upgrade"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   2. DemoSessionModal
   ──────────────────────────────────────────────────────────────── */
const DEMO_SCORE = 74;
const DEMO_DURATION_MIN = 45;

function demoCoachLines(isAr) {
  return isAr ? [
    "بعد ٤٥ دقيقة، وضعيتك كانت جيدة في معظم الوقت — لكن لاحظنا انحناء تدريجي في الكتفين بعد الدقيقة الثلاثين.",
    "الرأس كان متقدماً بمعدل ٣.٢ سم عن المعتاد خلال المكالمات — جرّب رفع الشاشة قليلاً.",
    "أفضل فترة كانت أول ١٥ دقيقة (متوسط ٨٤/١٠٠) — يبدو إنك تبدأ الجلسة بوضعية ممتازة.",
  ] : [
    "Over 45 minutes, your posture held up well overall — but we caught a gradual shoulder slump setting in after the 30-minute mark.",
    "Forward head position averaged 3.2cm above baseline during calls — try raising your monitor slightly.",
    "Your best stretch was the first 15 minutes (avg 84/100) — you start sessions in great form.",
  ];
}

export function DemoSessionModal({ isAr, cs, onClose, onStartReal }) {
  const [revealed, setRevealed] = useState(false);
  const lines = demoCoachLines(isAr);

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.72)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10001, padding: 20,
    }} onClick={onClose}>
      <div style={{
        background: cs.card, border: `1px solid ${cs.border}`, borderRadius: 20, maxWidth: 440, width: "100%",
        overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,.45)",
      }} onClick={e => e.stopPropagation()}>
        <div style={{
          background: "linear-gradient(135deg,#1a56db,#0891b2)", padding: "20px 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ color: "rgba(255,255,255,.8)", fontSize: 10.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase" }}>
              {isAr ? "جلسة تجريبية" : "Demo Session"}
            </div>
            <div style={{ color: "#fff", fontSize: 16, fontWeight: 800, marginTop: 2 }}>
              {isAr ? `نتيجة ${DEMO_DURATION_MIN} دقيقة من العمل` : `${DEMO_DURATION_MIN} minutes of work, analysed`}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,.15)", border: "none", borderRadius: 8, width: 28, height: 28,
            color: "#fff", cursor: "pointer", fontSize: 14, flexShrink: 0,
          }}>✕</button>
        </div>

        <div style={{ padding: "24px" }}>
          {!revealed ? (
            <div style={{ textAlign: "center" }}>
              <p style={{ color: cs.muted, fontSize: 13, lineHeight: 1.6, margin: "0 0 20px" }}>
                {isAr
                  ? "هنعرضلك نتيجة جلسة عمل حقيقية بدون ما تفتح الكاميرا — بس عشان تشوف شكل التحليل."
                  : "See what a real 45-minute session looks like — no camera required, just a preview."}
              </p>
              <button onClick={() => setRevealed(true)} style={{
                padding: "12px 24px", background: "linear-gradient(135deg,#1a56db,#0891b2)", color: "#fff",
                border: "none", borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: "pointer",
              }}>
                {isAr ? "▶ عرض النتيجة" : "▶ Reveal the result"}
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }}>
                <div style={{
                  width: 72, height: 72, borderRadius: "50%", flexShrink: 0,
                  background: "conic-gradient(#10b981 0% 74%, rgba(148,163,184,.15) 74% 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: "50%", background: cs.card,
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: "#10b981", lineHeight: 1 }}>{DEMO_SCORE}</div>
                    <div style={{ fontSize: 8, color: cs.muted }}>/100</div>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: cs.text }}>
                    {isAr ? "جيد" : "Good"}
                  </div>
                  <div style={{ fontSize: 11.5, color: cs.muted, marginTop: 2 }}>
                    {isAr ? `${DEMO_DURATION_MIN} دقيقة · ٣ ملاحظات` : `${DEMO_DURATION_MIN} min · 3 insights`}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                {lines.map((l, i) => (
                  <div key={i} style={{
                    background: "rgba(99,102,241,.07)", border: "1px solid rgba(99,102,241,.18)",
                    borderRadius: 10, padding: "10px 12px", fontSize: 12, color: cs.text, lineHeight: 1.55,
                  }}>
                    💡 {l}
                  </div>
                ))}
              </div>

              <button onClick={onStartReal} style={{
                width: "100%", padding: "12px", background: "linear-gradient(135deg,#1a56db,#0891b2)", color: "#fff",
                border: "none", borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: "pointer", marginBottom: 8,
              }}>
                {isAr ? "▶ جرّب جلستك الحقيقية دلوقتي" : "▶ Try your real session now"}
              </button>
              <button onClick={onClose} style={{
                width: "100%", padding: "10px", background: "none", border: "none",
                fontSize: 12, color: cs.muted, cursor: "pointer",
              }}>
                {isAr ? "إغلاق" : "Close"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   3. UpgradeTeaser — shown once, after the user's first real session
   ──────────────────────────────────────────────────────────────── */
export function UpgradeTeaser({ isAr, onUpgrade, onDismiss }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      background: "rgba(99,102,241,.08)", border: "1px solid rgba(99,102,241,.22)",
      borderRadius: 10, padding: "10px 14px", marginBottom: 12,
    }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>🔮</span>
      <div style={{ flex: 1, fontSize: 12, color: "#c7d2fe", lineHeight: 1.5 }}>
        {isAr
          ? "لو كنت على خطة أعلى، كنت هتعرف إمتى ألمك هيجي قبله بيومين — بدل ما تكتشفه وقت حدوثه."
          : "On a higher plan, you'd know two days ahead when discomfort is coming — not just after it starts."}
      </div>
      <button onClick={onUpgrade} style={{
        flexShrink: 0, background: "rgba(99,102,241,.18)", border: "1px solid rgba(99,102,241,.4)",
        borderRadius: 8, padding: "5px 11px", fontSize: 11, fontWeight: 700, color: "#c7d2fe", cursor: "pointer",
      }}>
        {isAr ? "شوف التفاصيل" : "See how"}
      </button>
      <button onClick={onDismiss} style={{
        flexShrink: 0, background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 13, padding: 2,
      }}>✕</button>
    </div>
  );
}

export { FREE_MONTHLY_SESSION_LIMIT };
