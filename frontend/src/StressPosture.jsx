/**
 * Corvus — Stress x Posture (Pro tier)
 * ─────────────────────────────────────────────────────────────────
 * Two small dashboard pieces:
 *  1. <StressCheckIn>          — quick 1-5 "how stressed was work
 *     today?" picker. One tap, once a day (gated client-side via
 *     localStorage date-key so it doesn't nag after submission).
 *  2. <StressCorrelationCard>  — once there's enough logged data
 *     (min 5 overlapping days, enforced server-side), shows the
 *     Pearson correlation between daily stress and posture score.
 *     Before that threshold, shows a progress nudge instead of a
 *     misleading/empty chart.
 */
import { useState, useEffect } from "react";
import { StressAPI } from "./services/api.js";

const LEVELS = [
  { level: 1, emoji: "😌", en: "Calm",     ar: "هادي" },
  { level: 2, emoji: "🙂", en: "Fine",     ar: "تمام" },
  { level: 3, emoji: "😐", en: "Okay",     ar: "عادي" },
  { level: 4, emoji: "😣", en: "Stressed", ar: "متوتر" },
  { level: 5, emoji: "🤯", en: "Overwhelmed", ar: "مرهق جدًا" },
];

function todayKey() { return new Date().toISOString().slice(0, 10); }
const LS_KEY = "corvus_stress_checkin_date";

export function StressCheckIn({ isAr, cs }) {
  const [submittedToday, setSubmittedToday] = useState(() => {
    try { return localStorage.getItem(LS_KEY) === todayKey(); } catch { return false; }
  });
  const [picked, setPicked] = useState(null);
  const [saving, setSaving] = useState(false);

  if (submittedToday) {
    return (
      <div style={{
        background: cs.card, border: `1px solid ${cs.border}`, borderRadius: 12,
        padding: "12px 16px", display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{ fontSize: 14 }}>✓</span>
        <span style={{ fontSize: 12, color: cs.muted }}>
          {isAr ? "سجّلت مستوى التوتر النهاردة — يرجع بكرة" : "Logged today's stress — check back tomorrow"}
        </span>
      </div>
    );
  }

  const submit = async (level) => {
    if (saving) return;
    setPicked(level);
    setSaving(true);
    try {
      await StressAPI.log(level);
      try { localStorage.setItem(LS_KEY, todayKey()); } catch {}
      setSubmittedToday(true);
    } catch {
      setPicked(null); // let them retry
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ background: cs.card, border: `1px solid ${cs.border}`, borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: cs.text, marginBottom: 10 }}>
        {isAr ? "الشغل كان متوتر أد إيه النهاردة؟" : "How stressful was work today?"}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
        {LEVELS.map(l => (
          <button key={l.level} disabled={saving} onClick={() => submit(l.level)} style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            padding: "8px 4px", borderRadius: 10, cursor: saving ? "default" : "pointer",
            background: picked === l.level ? "rgba(124,58,237,.14)" : "rgba(148,163,184,.05)",
            border: `1px solid ${picked === l.level ? "rgba(124,58,237,.4)" : cs.border}`,
            opacity: saving && picked !== l.level ? 0.4 : 1,
          }}>
            <span style={{ fontSize: 20 }}>{l.emoji}</span>
            <span style={{ fontSize: 9.5, color: cs.muted, fontWeight: 600 }}>{isAr ? l.ar : l.en}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function StressCorrelationCard({ isAr, cs }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let cancelled = false;
    StressAPI.correlation(30).then(res => { if (!cancelled) setData(res); }).catch(() => { if (!cancelled) setErr(true); });
    return () => { cancelled = true; };
  }, []);

  if (err) return null; // fail quiet — this is a bonus insight, not core functionality
  if (!data) return null; // loading — avoid a layout-shifting skeleton for a nice-to-have card

  if (!data.enough_data) {
    const left = Math.max(0, (data.min_required || 5) - (data.days_logged || 0));
    return (
      <div style={{ background: cs.card, border: `1px solid ${cs.border}`, borderRadius: 12, padding: "14px 16px" }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: cs.text, marginBottom: 4 }}>
          🔮 {isAr ? "علاقة التوتر بالوضعية" : "Stress x Posture Link"}
        </div>
        <div style={{ fontSize: 11.5, color: cs.muted, lineHeight: 1.5 }}>
          {isAr
            ? `سجّل التوتر ${left} يوم كمان (مع جلسة وضعية في نفس اليوم) عشان نوريك العلاقة.`
            : `Log stress for ${left} more day${left===1?"":"s"} (with a posture session that day) to unlock this.`}
        </div>
      </div>
    );
  }

  const strong = data.correlation <= -0.3;
  return (
    <div style={{
      background: strong ? "rgba(124,58,237,.06)" : cs.card,
      border: `1px solid ${strong ? "rgba(124,58,237,.25)" : cs.border}`,
      borderRadius: 12, padding: "14px 16px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: cs.text }}>
          🔮 {isAr ? "علاقة التوتر بالوضعية" : "Stress x Posture Link"}
        </div>
        <div style={{ fontSize: 11, fontWeight: 800, color: strong ? "#c4b5fd" : cs.muted }}>
          r = {data.correlation}
        </div>
      </div>
      <div style={{ fontSize: 11.5, color: cs.muted, lineHeight: 1.55 }}>
        {strong
          ? (isAr
              ? "لما التوتر بيعلى، درجة وضعيتك بتقل — علاقة عكسية واضحة. جرّب استراحات أطول في أيام الضغط."
              : "On higher-stress days, your posture score tends to drop — a clear inverse link. Try longer breaks on high-pressure days.")
          : (isAr
              ? "لسه مفيش علاقة واضحة بين التوتر ووضعيتك في البيانات دي."
              : "No clear link between stress and posture in the data yet.")}
      </div>
      <div style={{ fontSize: 10, color: cs.muted, marginTop: 8, opacity: 0.7 }}>
        {isAr ? `مبني على ${data.days_logged} يوم مسجّل` : `Based on ${data.days_logged} logged days`}
      </div>
    </div>
  );
}
