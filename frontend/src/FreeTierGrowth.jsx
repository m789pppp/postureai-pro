/**
 * Corvus — Free Tier Growth Kit
 * ─────────────────────────────────────────────────────────────────
 * Small, self-contained pieces addressing the "empty dashboard,
 * invisible limit, no upgrade path, no early habit hook" gaps on the
 * Free (standard) tier:
 *
 *  1. <SessionUsageBar>     — "Used X of 5 this month" progress bar,
 *     shown on the Free-tier dashboard so the monthly cap is no
 *     longer invisible marketing copy.
 *  2. <DemoSessionModal>    — "Watch a Demo Session" — an animated,
 *     live-feeling simulation (based on an anonymized similar-user
 *     score curve) with the score counting up in real time and the
 *     AI coach's notes appearing one at a time, like it's talking.
 *     No camera required.
 *  3. <UpgradeTeaser>       — a single-line nudge shown once, right
 *     after a Free-tier user's first real completed session, pointing
 *     at the Predictive AI feature they don't have yet.
 *  4. <FirstSessionBadge>   — small "First Session" badge shown once
 *     on the dashboard right after the user's first real session.
 *  5. <PainAreaSelfReport>  — quick "where does it hurt?" body-area
 *     picker, saved to the profile so the product visibly cares.
 *
 * All are presentational + local-state only — no new network calls
 * beyond the one profile-field write each caller already wires up
 * (onDismiss in UpgradeTeaser, onSave in PainAreaSelfReport).
 */
import { useState, useEffect, useRef } from "react";
import { useBodyScrollLock } from "./lib/useBodyScrollLock.js";

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
   2. DemoSessionModal — animated, "live" simulation
   ──────────────────────────────────────────────────────────────── */
const DEMO_DURATION_MIN = 45;

// A compressed 45-minute score curve from an anonymized similar user —
// starts strong, drifts down mid-session (the classic slump), no name/
// PII attached. Played back over ~9 real seconds (200ms/point) so it
// visibly moves instead of just appearing.
const DEMO_CURVE = [82, 85, 84, 87, 83, 80, 78, 75, 71, 68, 65, 63, 66, 70, 69, 72, 74, 73, 74];

function demoCoachLines(isAr) {
  return isAr ? [
    { t: "٠٠:٠٢", text: "بداية قوية — وضعيتك ممتازة أول ١٥ دقيقة." },
    { t: "٠٠:١٨", text: "لاحظنا انحناء تدريجي في الكتفين بعد الدقيقة الثلاثين." },
    { t: "٠٠:٣٤", text: "الرأس كان متقدماً ٣.٢ سم عن المعتاد خلال المكالمات — جرّب رفع الشاشة." },
  ] : [
    { t: "00:02", text: "Strong start — excellent posture through the first 15 minutes." },
    { t: "00:18", text: "Caught a gradual shoulder slump setting in after the 30-minute mark." },
    { t: "00:34", text: "Forward head averaged 3.2cm above baseline during calls — try raising your monitor." },
  ];
}

export function DemoSessionModal({ isAr, cs, onClose, onStartReal }) {
  useBodyScrollLock();
  const [step, setStep] = useState("idle"); // idle -> playing -> done
  const [idx, setIdx] = useState(0);
  const [visibleLines, setVisibleLines] = useState(0);
  const timerRef = useRef(null);
  const lines = demoCoachLines(isAr);
  const liveScore = DEMO_CURVE[Math.min(idx, DEMO_CURVE.length - 1)];

  useEffect(() => {
    if (step !== "playing") return;
    timerRef.current = setInterval(() => {
      setIdx(i => {
        const next = i + 1;
        if (next >= DEMO_CURVE.length) {
          clearInterval(timerRef.current);
          setStep("done");
          return i;
        }
        // Reveal a coaching line roughly a third of the way through playback.
        if (next === Math.round(DEMO_CURVE.length * 0.3)) setVisibleLines(1);
        if (next === Math.round(DEMO_CURVE.length * 0.65)) setVisibleLines(2);
        return next;
      });
    }, 220);
    return () => clearInterval(timerRef.current);
  }, [step]);

  useEffect(() => () => clearInterval(timerRef.current), []);

  const scoreColor = s => s >= 80 ? "#10b981" : s >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.72)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10001, padding: 20,
    }} onClick={step === "idle" ? onClose : undefined}>
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
              {isAr ? `محاكاة ${DEMO_DURATION_MIN} دقيقة عمل حقيقية` : `Simulating ${DEMO_DURATION_MIN} real minutes of work`}
            </div>
          </div>
          {step !== "playing" && (
            <button onClick={onClose} style={{
              background: "rgba(255,255,255,.15)", border: "none", borderRadius: 8, width: 28, height: 28,
              color: "#fff", cursor: "pointer", fontSize: 14, flexShrink: 0,
            }}>✕</button>
          )}
        </div>

        <div style={{ padding: "24px" }}>
          {step === "idle" ? (
            <div style={{ textAlign: "center" }}>
              <p style={{ color: cs.muted, fontSize: 13, lineHeight: 1.6, margin: "0 0 20px" }}>
                {isAr
                  ? "هنشغّلك محاكاة حية من بيانات مستخدم شبيه بيك — تشوف السكور بيتحرك ومدرب الـ AI بيتكلم، من غير ما تفتح الكاميرا."
                  : "We'll play back a live simulation from an anonymized similar user — watch the score move and the AI coach talk, no camera needed."}
              </p>
              <button onClick={() => { setStep("playing"); setIdx(0); setVisibleLines(0); }} style={{
                padding: "12px 24px", background: "linear-gradient(135deg,#1a56db,#0891b2)", color: "#fff",
                border: "none", borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: "pointer",
              }}>
                {isAr ? "▶ شغّل المحاكاة" : "▶ Play the simulation"}
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 8 }}>
                <div style={{
                  width: 72, height: 72, borderRadius: "50%", flexShrink: 0,
                  background: `conic-gradient(${scoreColor(liveScore)} 0% ${liveScore}%, rgba(148,163,184,.15) ${liveScore}% 100%)`,
                  transition: "background 200ms linear",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: "50%", background: cs.card,
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: scoreColor(liveScore), lineHeight: 1, transition: "color 200ms linear" }}>{liveScore}</div>
                    <div style={{ fontSize: 8, color: cs.muted }}>/100</div>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: cs.muted, marginBottom: 4 }}>
                    {step === "playing"
                      ? (isAr ? "جاري تحليل الجلسة..." : "Analysing session...")
                      : (isAr ? "اكتملت المحاكاة" : "Simulation complete")}
                  </div>
                  {/* Mini live score trail */}
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 24 }}>
                    {DEMO_CURVE.slice(0, idx + 1).map((v, i) => (
                      <div key={i} style={{
                        width: 4, height: `${Math.max(4, (v / 100) * 24)}px`,
                        background: scoreColor(v), borderRadius: 1, opacity: 0.4 + (i / DEMO_CURVE.length) * 0.6,
                      }} />
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20, minHeight: 96 }}>
                {lines.slice(0, visibleLines).map((l, i) => (
                  <div key={i} style={{
                    background: "rgba(99,102,241,.07)", border: "1px solid rgba(99,102,241,.18)",
                    borderRadius: 10, padding: "10px 12px", fontSize: 12, color: cs.text, lineHeight: 1.55,
                    animation: "ftg-fade-in 300ms ease-out",
                  }}>
                    <span style={{ color: "#818cf8", fontWeight: 700, marginInlineEnd: 6 }}>{l.t}</span>
                    💡 {l.text}
                  </div>
                ))}
              </div>

              {step === "done" && (
                <>
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
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes ftg-fade-in { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }`}</style>
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

/* ────────────────────────────────────────────────────────────────
   4. FirstSessionBadge — shown once, right on the dashboard
   ──────────────────────────────────────────────────────────────── */
export function FirstSessionBadge({ isAr, cs }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      background: "rgba(16,185,129,.1)", border: "1px solid rgba(16,185,129,.3)",
      borderRadius: 99, padding: "6px 14px", marginBottom: 4,
    }}>
      <span style={{ fontSize: 15 }}>🏅</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: "#34d399" }}>
        {isAr ? "أول جلسة — بداية موفقة!" : "First Session — off to a great start!"}
      </span>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   5. PainAreaSelfReport — quick "where does it hurt?" picker
   ──────────────────────────────────────────────────────────────── */
const PAIN_AREAS = [
  { id: "neck",      en: "Neck",          ar: "الرقبة",        icon: "🟠" },
  { id: "shoulders", en: "Shoulders",     ar: "الكتفين",       icon: "🟡" },
  { id: "upper_back",en: "Upper back",    ar: "أعلى الظهر",    icon: "🔵" },
  { id: "lower_back",en: "Lower back",    ar: "أسفل الظهر",    icon: "🟣" },
  { id: "wrists",    en: "Wrists",        ar: "المعصمين",      icon: "🟢" },
  { id: "eyes",      en: "Eyes / screen", ar: "العين/الشاشة",  icon: "🔴" },
  { id: "none",      en: "No pain",       ar: "من غير ألم",    icon: "✅" },
];

export function PainAreaSelfReport({ isAr, cs, initial = null, onSave }) {
  const [selected, setSelected] = useState(initial);
  const [saved, setSaved] = useState(!!initial);

  const choose = (id) => {
    setSelected(id);
    setSaved(true);
    onSave?.(id);
  };

  return (
    <div style={{ background: cs.card, border: `1px solid ${cs.border}`, borderRadius: 12, padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 16 }}>🧍</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: cs.text }}>
          {isAr ? "فين بيتألم؟" : "Where does it hurt?"}
        </span>
      </div>
      <div style={{ fontSize: 11.5, color: cs.muted, marginBottom: 12 }}>
        {isAr ? "بيساعدنا نخصص التوصيات ليك — ثانية واحدة بس" : "Helps us tailor your tips — takes one second"}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {PAIN_AREAS.map(a => {
          const active = selected === a.id;
          return (
            <button key={a.id} onClick={() => choose(a.id)} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 12px", borderRadius: 99,
              background: active ? "rgba(26,86,219,.16)" : "rgba(148,163,184,.06)",
              border: `1px solid ${active ? "rgba(26,86,219,.5)" : cs.border}`,
              color: active ? "#93c5fd" : cs.text,
              fontSize: 12, fontWeight: active ? 700 : 500, cursor: "pointer",
            }}>
              <span>{a.icon}</span>{isAr ? a.ar : a.en}
            </button>
          );
        })}
      </div>
      {saved && (
        <div style={{ fontSize: 11, color: "#34d399", marginTop: 10 }}>
          {isAr ? "✓ تم الحفظ — هنراعي ده في نصايحنا" : "✓ Saved — we'll factor this into your tips"}
        </div>
      )}
    </div>
  );
}
