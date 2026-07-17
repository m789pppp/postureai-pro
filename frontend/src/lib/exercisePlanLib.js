/**
 * exercisePlanLib.js — shared Elite exercise-plan logic
 * ──────────────────────────────────────────────────────
 * Single source of truth used by BOTH ExercisePlan.jsx (dashboard card)
 * and pdfReports.js (Elite Insights page), so the PDF can auto-build a
 * suggested plan for users who never pressed "build" in the app.
 */

// ── Evidence-based exercise library keyed by problem area ─────────
export const EX_LIB = {
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
export const METRIC_AREA = {
  neck_lean: "neck", neck_lean_side: "neck", fhp_index: "neck", fhp_side: "neck",
  head_yaw: "neck", head_tilt: "neck", monitor_height: "neck",
  rounded_shoulders: "shoulders", shoulder_level: "shoulders", elbow_angle: "shoulders",
  spine_lean: "spine", spine_align: "spine", trunk_lean: "spine", hip_angle: "spine", knee_angle: "spine",
};

export const sessionToMs = (s) => {
  try { return s.created_at?.toDate?.()?.getTime?.() || new Date(s.created_at || 0).getTime(); }
  catch { return 0; }
};

/** ISO week key, e.g. "2026-W29" */
export function weekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  const w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  return `${y}-W${String(w).padStart(2, "0")}`;
}

/** Worst 2 problem areas from the last 7 days of session metrics */
export function worstAreas(sessions) {
  const cutoff = Date.now() - 7 * 86400000;
  const areaScores = {};
  (sessions || []).filter(s => sessionToMs(s) >= cutoff && s.metrics).forEach(s => {
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
export function buildPlan(sessions) {
  const [a1, a2] = worstAreas(sessions);
  const pattern = [a1, a2, a1, "recovery", a2, a1, "recovery"];
  return {
    week: weekKey(),
    focus: [a1, a2],
    created_at: new Date().toISOString(),
    days: pattern.map((area, i) => ({
      day: i + 1,
      area,
      exercises: EX_LIB[area].exercises.map(e => ({ id: `${i}_${e.id}`, en: e.en, ar: e.ar, done: false })),
    })),
  };
}
