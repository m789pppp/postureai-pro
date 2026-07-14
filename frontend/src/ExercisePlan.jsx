/**
 * ExercisePlan.jsx — Elite weekly corrective exercise programme
 * ──────────────────────────────────────────────────────────────
 * Builds a personalised 7-day exercise plan from the user's WORST posture
 * metrics over the last 7 days of sessions (deterministic, evidence-based
 * library — no AI call needed, works offline and never fails).
 *
 * Stored on the user profile as `exercise_plan` (users can update their own
 * doc under existing Firestore rules — no rules change required). The plan
 * auto-expires: a new ISO week shows the "generate" state again.
 */
import { useMemo, useState } from "react";
import { tierAtLeast } from "./lib/tierQuality.js";
import { updateUserProfile } from "./firebase.js";

// ── Evidence-based exercise library keyed by problem area ─────────
const LIB = {
  neck: {
    label: { en: "Neck / Forward head", ar: "الرقبة / تقدم الرأس" },
    icon: "🦴",
    exercises: [
      { id: "chin_tuck",   en: "Chin tucks — 2×10 (hold 5s)",            ar: "إدخال الذقن — 2×10 (ثبات 5 ثواني)" },
      { id: "neck_stretch",en: "Upper-trap side stretch — 30s each side", ar: "إطالة جانبية للرقبة — 30 ثانية لكل جانب" },
      { id: "wall_tuck",   en: "Wall chin tuck + head press — 2×8",       ar: "إدخال الذقن على الحائط — 2×8" },
    ],
  },
  shoulders: {
    label: { en: "Rounded shoulders / chest", ar: "الأكتاف المدورة / الصدر" },
    icon: "💪",
    exercises: [
      { id: "scap_squeeze", en: "Scapular squeezes — 2×12 (hold 5s)",     ar: "ضم لوحي الكتف — 2×12 (ثبات 5 ثواني)" },
      { id: "doorway",      en: "Doorway pec stretch — 30s each arm",     ar: "إطالة الصدر على الباب — 30 ثانية لكل ذراع" },
      { id: "wall_angels",  en: "Wall angels — 2×10 slow",                ar: "ملاك الحائط — 2×10 ببطء" },
    ],
  },
  spine: {
    label: { en: "Spine / trunk", ar: "العمود الفقري / الجذع" },
    icon: "🧘",
    exercises: [
      { id: "cat_cow",   en: "Cat-cow mobilisation — 2×8",                ar: "تمرين القطة والجمل — 2×8" },
      { id: "bridge",    en: "Glute bridge — 2×12",                       ar: "رفع الحوض — 2×12" },
      { id: "thoracic",  en: "Thoracic extension over chair — 2×8",       ar: "مدّ الظهر العلوي على الكرسي — 2×8" },
    ],
  },
  recovery: {
    label: { en: "Recovery & habits", ar: "استشفاء وعادات" },
    icon: "🌿",
    exercises: [
      { id: "walk",   en: "5-min walk every hour of sitting",             ar: "مشي 5 دقايق كل ساعة جلوس" },
      { id: "rule20", en: "20-20-20: every 20min look 6m away for 20s",   ar: "قاعدة 20-20-20: كل 20 دقيقة بص لمسافة 6 متر لمدة 20 ثانية" },
      { id: "hip_flexor", en: "Standing hip-flexor stretch — 30s/side",   ar: "إطالة مثنية الورك واقفاً — 30 ثانية لكل جانب" },
    ],
  },
};

// Map engine metric keys → library area
const METRIC_AREA = {
  neck_lean: "neck", neck_lean_side: "neck", fhp_index: "neck", fhp_side: "neck",
  head_yaw: "neck", head_tilt: "neck", monitor_height: "neck",
  rounded_shoulders: "shoulders", shoulder_level: "shoulders", elbow_angle: "shoulders",
  spine_lean: "spine", spine_align: "spine", trunk_lean: "spine", hip_angle: "spine", knee_angle: "spine",
};

const _toMs = (s) => { try { return s.created_at?.toDate?.()?.getTime?.() || new Date(s.created_at || 0).getTime(); } catch { return 0; } };

/** ISO week key, e.g. "2026-W29" */
function weekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  const w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  return `${y}-W${String(w).padStart(2, "0")}`;
}

/** Worst 2 problem areas from the last 7 days of session metrics */
function worstAreas(sessions) {
  const cutoff = Date.now() - 7 * 86400000;
  const areaScores = {};
  sessions.filter(s => _toMs(s) >= cutoff && s.metrics).forEach(s => {
    Object.entries(s.metrics).forEach(([k, v]) => {
      const area = METRIC_AREA[k];
      if (!area || typeof v?.score !== "number" || v?.reliable === false) return;
      (areaScores[area] = areaScores[area] || []).push(v.score);
    });
  });
  const ranked = Object.entries(areaScores)
    .map(([a, arr]) => [a, arr.reduce((x, y) => x + y, 0) / arr.length])
    .sort(([, x], [, y]) => x - y)
    .map(([a]) => a);
  const top = ranked.slice(0, 2);
  while (top.length < 2) top.push(top[0] === "neck" ? "shoulders" : "neck");
  return top;
}

/** Build the 7-day plan: alternate the two worst areas, recovery mid+end */
function buildPlan(sessions, isAr) {
  const [a1, a2] = worstAreas(sessions);
  const pattern = [a1, a2, a1, "recovery", a2, a1, "recovery"];
  return {
    week: weekKey(),
    focus: [a1, a2],
    created_at: new Date().toISOString(),
    days: pattern.map((area, i) => ({
      day: i + 1,
      area,
      exercises: LIB[area].exercises.map(e => ({ id: `${i}_${e.id}`, en: e.en, ar: e.ar, done: false })),
    })),
  };
}

export default function ExercisePlan({ profile, setProfile, sessions = [], uid, isAr, effTier, addToast, onUpgrade }) {
  const isElite = tierAtLeast(effTier || profile?.tier, "elite");
  const [busy, setBusy] = useState(false);
  const [openDay, setOpenDay] = useState(() => Math.min(7, Math.max(1, new Date().getDay() || 7)));

  const curWeek = weekKey();
  const plan = profile?.exercise_plan?.week === curWeek ? profile.exercise_plan : null;

  const totals = useMemo(() => {
    if (!plan) return { done: 0, total: 0 };
    let done = 0, total = 0;
    plan.days.forEach(d => d.exercises.forEach(e => { total++; if (e.done) done++; }));
    return { done, total };
  }, [plan]);

  const savePlan = async (p, msg) => {
    if (!uid) return;
    setBusy(true);
    try {
      await updateUserProfile(uid, { exercise_plan: p });
      setProfile?.(prev => prev ? { ...prev, exercise_plan: p } : prev);
      if (msg) addToast?.(msg, "success");
    } catch { addToast?.(isAr ? "تعذر الحفظ" : "Couldn't save", "error"); }
    finally { setBusy(false); }
  };

  const generate = () => {
    if (!sessions.length) { addToast?.(isAr ? "اعمل جلسة الأولاً عشان نبني الخطة من بياناتك" : "Run a session first so the plan is built from your data", "warn"); return; }
    const p = buildPlan(sessions, isAr);
    const names = p.focus.map(a => LIB[a].label[isAr ? "ar" : "en"]).join(" + ");
    savePlan(p, isAr ? `🏋️ خطة الأسبوع جاهزة — تركيز: ${names}` : `🏋️ Weekly plan ready — focus: ${names}`);
  };

  const toggle = (dayIdx, exIdx) => {
    if (!plan) return;
    const p = JSON.parse(JSON.stringify(plan));
    p.days[dayIdx].exercises[exIdx].done = !p.days[dayIdx].exercises[exIdx].done;
    savePlan(p);
  };

  const card = { background: "rgba(99,102,241,.05)", border: "1px solid rgba(99,102,241,.2)", borderRadius: 14, padding: "16px 18px", marginBottom: 12 };
  const eliteBadge = <span style={{ fontSize: 8, background: "rgba(16,185,129,.12)", border: "1px solid rgba(16,185,129,.3)", borderRadius: 99, padding: "1px 7px", color: "#10b981", fontWeight: 700 }}>ELITE</span>;

  if (!isElite) {
    return (
      <div style={{ ...card, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)", cursor: "pointer" }} onClick={onUpgrade}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}>🏋️</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", display: "flex", gap: 6, alignItems: "center" }}>
                {isAr ? "خطة تمارين أسبوعية مخصصة" : "Personalised weekly exercise plan"} {eliteBadge}
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                {isAr ? "برنامج تصحيحي مبني على أسوأ مقاييسك — لباقة Elite" : "Corrective programme built from your worst metrics — Elite only"}
              </div>
            </div>
          </div>
          <span style={{ fontSize: 14 }}>🔒</span>
        </div>
      </div>
    );
  }

  return (
    <div className="ds-fade-3" style={card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#e2e8f0", display: "flex", gap: 7, alignItems: "center" }}>
          🏋️ {isAr ? "خطة تمارين الأسبوع" : "This week's exercises"} {eliteBadge}
        </div>
        {plan && (
          <span style={{ fontSize: 11, fontWeight: 700, color: totals.done === totals.total ? "#10b981" : "#a5b4fc" }}>
            {totals.done}/{totals.total} ✓
          </span>
        )}
      </div>

      {!plan ? (
        <div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12, lineHeight: 1.6 }}>
            {isAr
              ? "هنبني برنامج 7 أيام من أضعف مقاييسك في آخر أسبوع — تمارين تصحيحية مثبتة علمياً، 3 تمارين يومياً (~5 دقايق)."
              : "We'll build a 7-day programme from your weakest metrics this week — evidence-based corrective exercises, 3 a day (~5 min)."}
          </div>
          <button disabled={busy} onClick={generate}
            style={{ width: "100%", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", borderRadius: 9, padding: "10px 0", fontSize: 12.5, fontWeight: 700, color: "#fff", cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
            {busy ? "..." : (isAr ? "⚡ ابني خطتي الأسبوعية" : "⚡ Build my weekly plan")}
          </button>
        </div>
      ) : (
        <div>
          {/* Focus areas */}
          <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
            {plan.focus.map(a => (
              <span key={a} style={{ fontSize: 10, background: "rgba(99,102,241,.12)", border: "1px solid rgba(99,102,241,.3)", borderRadius: 99, padding: "2px 9px", color: "#a5b4fc", fontWeight: 600 }}>
                {LIB[a].icon} {LIB[a].label[isAr ? "ar" : "en"]}
              </span>
            ))}
          </div>
          {/* Day tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
            {plan.days.map((d, i) => {
              const allDone = d.exercises.every(e => e.done);
              const active = openDay === d.day;
              return (
                <button key={i} onClick={() => setOpenDay(d.day)} style={{
                  flex: 1, padding: "6px 0", borderRadius: 8, fontSize: 10.5, fontWeight: 700, cursor: "pointer",
                  background: active ? "rgba(99,102,241,.25)" : allDone ? "rgba(16,185,129,.12)" : "rgba(255,255,255,.04)",
                  border: `1px solid ${active ? "rgba(99,102,241,.5)" : allDone ? "rgba(16,185,129,.3)" : "rgba(255,255,255,.08)"}`,
                  color: allDone ? "#34d399" : active ? "#c7d2fe" : "#64748b",
                }}>
                  {allDone ? "✓" : d.day}
                </button>
              );
            })}
          </div>
          {/* Exercises of the open day */}
          {plan.days.filter(d => d.day === openDay).map((d, _) => {
            const dayIdx = d.day - 1;
            return (
              <div key={d.day}>
                <div style={{ fontSize: 11, color: "#818cf8", fontWeight: 700, marginBottom: 7 }}>
                  {LIB[d.area].icon} {isAr ? `اليوم ${d.day} — ${LIB[d.area].label.ar}` : `Day ${d.day} — ${LIB[d.area].label.en}`}
                </div>
                {d.exercises.map((e, exIdx) => (
                  <button key={e.id} disabled={busy} onClick={() => toggle(dayIdx, exIdx)} style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 10, textAlign: "start",
                    background: e.done ? "rgba(16,185,129,.07)" : "rgba(255,255,255,.03)",
                    border: `1px solid ${e.done ? "rgba(16,185,129,.25)" : "rgba(255,255,255,.07)"}`,
                    borderRadius: 9, padding: "9px 12px", marginBottom: 6, cursor: "pointer",
                  }}>
                    <span style={{
                      width: 18, height: 18, borderRadius: 5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                      background: e.done ? "#10b981" : "rgba(255,255,255,.06)", border: e.done ? "none" : "1px solid rgba(255,255,255,.15)",
                      fontSize: 11, color: "#fff", fontWeight: 800,
                    }}>{e.done ? "✓" : ""}</span>
                    <span style={{ fontSize: 12, color: e.done ? "#64748b" : "#e2e8f0", textDecoration: e.done ? "line-through" : "none", lineHeight: 1.5 }}>
                      {isAr ? e.ar : e.en}
                    </span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
