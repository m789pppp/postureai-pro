/**
 * EliteGoals.jsx — Elite weekly score goal + smart ETA prediction
 * ────────────────────────────────────────────────────────────────
 * - Weekly target score stored on the user profile (goal_score) via
 *   updateUserProfile (field is not tier-protected, safe to write).
 * - Progress = current 7-day average vs goal, with week-over-week delta.
 * - Prediction: linear regression of avg_score over the last 30 days of
 *   sessions → pts/day slope → estimated days until the goal is reached.
 * - Non-Elite users see a locked teaser card with an upgrade CTA.
 */
import { useMemo, useState } from "react";
import { tierAtLeast } from "./lib/tierQuality.js";
import { updateUserProfile } from "./firebase.js";

const _toMs = (s) => {
  try { return s.created_at?.toDate?.()?.getTime?.() || new Date(s.created_at || 0).getTime(); }
  catch { return 0; }
};

/** avg score of sessions inside [from, to) ms window */
function _windowAvg(sessions, fromMs, toMs) {
  const scores = sessions
    .filter(s => { const m = _toMs(s); return m >= fromMs && m < toMs && (s.avg_score || 0) > 0; })
    .map(s => s.avg_score);
  return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
}

/** pts/day slope via least squares over the last `days` days */
function _slopePerDay(sessions, days = 30) {
  const cutoff = Date.now() - days * 86400000;
  const pts = sessions
    .map(s => ({ t: _toMs(s), y: s.avg_score || 0 }))
    .filter(p => p.t >= cutoff && p.y > 0)
    .sort((a, b) => a.t - b.t);
  if (pts.length < 4) return null;
  const xs = pts.map(p => (p.t - pts[0].t) / 86400000);
  const ys = pts.map(p => p.y);
  const n = xs.length;
  const sx = xs.reduce((a, b) => a + b, 0), sy = ys.reduce((a, b) => a + b, 0);
  const sxy = xs.reduce((a, x, i) => a + x * ys[i], 0);
  const sx2 = xs.reduce((a, x) => a + x * x, 0);
  const denom = n * sx2 - sx * sx;
  if (Math.abs(denom) < 1e-6) return null;
  return (n * sxy - sx * sy) / denom;
}

export default function EliteGoals({ profile, setProfile, sessions = [], uid, isAr, effTier, addToast, onUpgrade }) {
  const isElite = tierAtLeast(effTier || profile?.tier, "elite");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const now = Date.now(), WEEK = 7 * 86400000;
  const cur7 = useMemo(() => _windowAvg(sessions, now - WEEK, now + 1), [sessions]);
  const prev7 = useMemo(() => _windowAvg(sessions, now - 2 * WEEK, now - WEEK), [sessions]);
  const slope = useMemo(() => _slopePerDay(sessions), [sessions]);

  const goal = Number(profile?.goal_score) || null;
  const suggested = Math.min(95, Math.max(60, (cur7 || 70) + 5));
  const [draft, setDraft] = useState(goal || suggested);

  const delta = cur7 != null && prev7 != null ? cur7 - prev7 : null;
  const reached = goal && cur7 != null && cur7 >= goal;

  // ETA prediction
  let etaText = null;
  if (goal && cur7 != null && !reached) {
    if (slope != null && slope > 0.05) {
      const days = Math.ceil((goal - cur7) / slope);
      if (days <= 90) etaText = isAr
        ? `📈 بمعدل تحسّنك الحالي (+${slope.toFixed(1)} نقطة/يوم) هتوصل لهدفك خلال ~${days} يوم`
        : `📈 At your current pace (+${slope.toFixed(1)} pts/day) you'll reach your goal in ~${days} days`;
      else etaText = isAr
        ? "التحسّن بطيء — زوّد عدد الجلسات الأسبوعية عشان توصل أسرع"
        : "Progress is slow — add more weekly sessions to get there faster";
    } else if (slope != null && slope < -0.05) {
      etaText = isAr
        ? "📉 متوسطك بينزل الأسبوعين دول — راجع خطة التمارين وقلّل ساعات الجلوس المتواصل"
        : "📉 Your average is trending down — revisit your exercise plan and take more breaks";
    } else {
      etaText = isAr
        ? "متوسطك ثابت — جرّب جلسة إضافية يومياً لتحريك المؤشر"
        : "Your average is flat — try one extra daily session to move the needle";
    }
  }

  const saveGoal = async (g) => {
    if (!uid) return;
    setSaving(true);
    try {
      await updateUserProfile(uid, { goal_score: g, goal_set_at: new Date().toISOString() });
      setProfile?.(p => p ? { ...p, goal_score: g } : p);
      setEditing(false);
      addToast?.(isAr ? `🎯 تم تحديد هدفك: ${g}/100` : `🎯 Goal set: ${g}/100`, "success");
    } catch (e) {
      addToast?.(isAr ? "تعذر حفظ الهدف" : "Couldn't save goal", "error");
    } finally { setSaving(false); }
  };

  const card = {
    background: "rgba(16,185,129,.05)", border: "1px solid rgba(16,185,129,.2)",
    borderRadius: 14, padding: "16px 18px", marginBottom: 12,
  };
  const eliteBadge = (
    <span style={{ fontSize: 8, background: "rgba(16,185,129,.12)", border: "1px solid rgba(16,185,129,.3)", borderRadius: 99, padding: "1px 7px", color: "#10b981", fontWeight: 700 }}>ELITE</span>
  );

  // ── Locked teaser for non-Elite ────────────────────────────────
  if (!isElite) {
    return (
      <div style={{ ...card, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)", cursor: "pointer" }} onClick={onUpgrade}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}>🎯</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", display: "flex", gap: 6, alignItems: "center" }}>
                {isAr ? "أهداف وتوقعات ذكية" : "Goals & smart predictions"} {eliteBadge}
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                {isAr ? "حدّد هدف سكور واعرف هتوصله إمتى — لباقة Elite" : "Set a score goal and see when you'll reach it — Elite only"}
              </div>
            </div>
          </div>
          <span style={{ fontSize: 14 }}>🔒</span>
        </div>
      </div>
    );
  }

  const pct = goal && cur7 != null ? Math.min(100, Math.round((cur7 / goal) * 100)) : 0;

  return (
    <div className="ds-fade-3" style={card}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#e2e8f0", display: "flex", gap: 7, alignItems: "center" }}>
          🎯 {isAr ? "هدفك الأسبوعي" : "Weekly goal"} {eliteBadge}
        </div>
        {goal && !editing && (
          <button onClick={() => { setDraft(goal); setEditing(true); }}
            style={{ background: "transparent", border: "none", color: "#64748b", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
            {isAr ? "تعديل ✎" : "Edit ✎"}
          </button>
        )}
      </div>

      {/* No goal yet OR editing → picker */}
      {(!goal || editing) ? (
        <div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 10 }}>
            {isAr ? `متوسطك آخر 7 أيام: ${cur7 ?? "—"} — اختار هدف واقعي:` : `Your 7-day average: ${cur7 ?? "—"} — pick a realistic target:`}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <button onClick={() => setDraft(d => Math.max(50, d - 1))} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", color: "#e2e8f0", fontSize: 16, cursor: "pointer" }}>−</button>
            <div style={{ flex: 1, textAlign: "center" }}>
              <span style={{ fontSize: 28, fontWeight: 900, color: "#10b981" }}>{draft}</span>
              <span style={{ fontSize: 12, color: "#64748b" }}>/100</span>
            </div>
            <button onClick={() => setDraft(d => Math.min(95, d + 1))} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", color: "#e2e8f0", fontSize: 16, cursor: "pointer" }}>+</button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button disabled={saving} onClick={() => saveGoal(draft)}
              style={{ flex: 1, background: "linear-gradient(135deg,#059669,#0891b2)", border: "none", borderRadius: 9, padding: "9px 0", fontSize: 12, fontWeight: 700, color: "#fff", cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
              {saving ? "..." : (isAr ? "حفظ الهدف" : "Save goal")}
            </button>
            {editing && (
              <button onClick={() => setEditing(false)}
                style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 9, padding: "9px 14px", fontSize: 12, color: "#94a3b8", cursor: "pointer" }}>
                {isAr ? "إلغاء" : "Cancel"}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div>
          {/* Progress */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <div>
              <span style={{ fontSize: 26, fontWeight: 900, color: reached ? "#10b981" : "#e2e8f0" }}>{cur7 ?? "—"}</span>
              <span style={{ fontSize: 12, color: "#64748b" }}> / {goal}</span>
            </div>
            {delta != null && (
              <span style={{ fontSize: 11, fontWeight: 700, color: delta > 0 ? "#10b981" : delta < 0 ? "#ef4444" : "#64748b" }}>
                {delta > 0 ? "▲" : delta < 0 ? "▼" : "•"} {Math.abs(delta)} {isAr ? "عن الأسبوع الماضي" : "vs last week"}
              </span>
            )}
          </div>
          <div style={{ background: "rgba(255,255,255,.06)", borderRadius: 99, height: 8, overflow: "hidden", marginBottom: 10 }}>
            <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: reached ? "linear-gradient(90deg,#10b981,#34d399)" : "linear-gradient(90deg,#059669,#0891b2)", transition: "width 600ms ease" }} />
          </div>

          {reached ? (
            <div style={{ fontSize: 12, color: "#10b981", fontWeight: 700 }}>
              🏆 {isAr ? "وصلت لهدفك! ارفعه شوية وكمّل 💪" : "Goal reached! Raise it and keep going 💪"}
            </div>
          ) : etaText ? (
            <div style={{ fontSize: 11.5, color: "#94a3b8", lineHeight: 1.6 }}>{etaText}</div>
          ) : cur7 == null ? (
            <div style={{ fontSize: 11.5, color: "#64748b" }}>
              {isAr ? "ابدأ جلسات هذا الأسبوع عشان نتابع تقدمك" : "Run sessions this week to track progress"}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
