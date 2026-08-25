import { useState, useMemo } from "react";
import { useBodyScrollLock } from "./lib/useBodyScrollLock.js";

/**
 * Weekly Intelligence Report (Professional tier)
 * Was listed on the pricing page with zero implementation anywhere in
 * the codebase. Built as a real week-over-week comparison from actual
 * session history — not a templated summary.
 */

const METRIC_LABEL = {
  fhp_index:        { en: "forward head posture", ar: "انحناء الرقبة للأمام" },
  neck_lean:        { en: "neck lean",             ar: "ميل الرقبة" },
  rounded_shoulders:{ en: "rounded shoulders",      ar: "انحناء الكتفين" },
  shoulder_level:   { en: "shoulder level",         ar: "مستوى الكتفين" },
  spine_lean:       { en: "lower back lean",        ar: "ميل أسفل الظهر" },
  spine_align:      { en: "spine alignment",        ar: "استقامة العمود الفقري" },
  trunk_lean:       { en: "trunk lean",              ar: "ميل الجذع" },
  hip_angle:        { en: "hip angle",               ar: "زاوية الحوض" },
  screen_distance:  { en: "screen distance",         ar: "مسافة الشاشة" },
};

function computeWeeklyIntelligence(sessions) {
  const now = Date.now();
  const dayMs = 86400000;
  const getMins = s => s.duration_min ?? (s.duration_s || s.duration_sec || 0) / 60;
  const getTime = s => (s.created_at?.toDate?.() ?? new Date(s.created_at || 0)).getTime();

  const thisWeek = (sessions || []).filter(s => { const t = getTime(s); return t >= now - 7*dayMs && t <= now; });
  const lastWeek = (sessions || []).filter(s => { const t = getTime(s); return t >= now - 14*dayMs && t < now - 7*dayMs; });

  // BUG FIX: this only required 1 session in each week, but the not-ready
  // screen tells the user they need "at least 3 sessions in each of the
  // last two weeks" — either the copy was wrong, or (worse) a single
  // session per week was enough to produce a confident-sounding "declined
  // by N points" verdict, presenting a statistically meaningless
  // comparison as clinical insight. Raised the threshold to match what's
  // actually promised, since a real per-week average is what makes the
  // week-over-week comparison meaningful in the first place.
  if (thisWeek.length < 3 || lastWeek.length < 3) {
    return { ready: false, thisWeekCount: thisWeek.length, lastWeekCount: lastWeek.length };
  }

  const avg = arr => arr.length ? arr.reduce((a,s)=>a+(s.avg_score||0),0) / arr.length : 0;
  const totalMin = arr => arr.reduce((a,s)=>a+getMins(s), 0);

  const scoreThis = avg(thisWeek), scoreLast = avg(lastWeek);
  const scoreDelta = Math.round(scoreThis - scoreLast);
  const minutesThis = Math.round(totalMin(thisWeek)), minutesLast = Math.round(totalMin(lastWeek));

  // Per-metric week-over-week delta, to find what actually moved
  const metricAvg = (arr, key) => {
    const vals = arr.map(s => {
      const v = s.metrics?.[key];
      return typeof v === "number" ? v : (v?.score ?? null);
    }).filter(v => v != null);
    return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
  };
  const metricDeltas = Object.keys(METRIC_LABEL)
    .map(key => {
      const t = metricAvg(thisWeek, key), l = metricAvg(lastWeek, key);
      if (t == null || l == null) return null;
      return { key, delta: t - l, thisVal: t };
    })
    .filter(Boolean);

  const improved = metricDeltas.filter(m => m.delta > 3).sort((a,b)=>b.delta-a.delta)[0] || null;
  const declined = metricDeltas.filter(m => m.delta < -3).sort((a,b)=>a.delta-b.delta)[0] || null;

  return {
    ready: true,
    scoreThis: Math.round(scoreThis), scoreLast: Math.round(scoreLast), scoreDelta,
    sessionsThis: thisWeek.length, sessionsLast: lastWeek.length,
    minutesThis, minutesLast,
    improved, declined,
  };
}

export function WeeklyIntelligenceButton({ sessions, cs, isAr, onOpen }) {
  return (
    <button onClick={onOpen} style={{ padding:"9px 14px", background:"rgba(59,130,246,.1)",
      border:"1px solid rgba(59,130,246,.25)", borderRadius:9, color:"#93c5fd",
      fontSize:12, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
      📊 {isAr ? "تقرير الأسبوع" : "Weekly Report"}
    </button>
  );
}

export function WeeklyIntelligenceModal({ sessions, cs, isAr, onClose }) {
  useBodyScrollLock();
  const data = useMemo(() => computeWeeklyIntelligence(sessions), [sessions]);
  const dir = isAr ? "rtl" : "ltr";

  const lbl = (key) => METRIC_LABEL[key] ? (isAr ? METRIC_LABEL[key].ar : METRIC_LABEL[key].en) : key;

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.75)", zIndex:9200,
      display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div dir={dir} style={{ width:"100%", maxWidth:440, maxHeight:"85vh", overflowY:"auto",
        background: cs?.card || "#111827", border:`1px solid ${cs?.border || "rgba(255,255,255,.1)"}`,
        borderRadius:18, padding:24 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ fontSize:15, fontWeight:800, color: cs?.text || "#e2e8f0" }}>
            📊 {isAr ? "تقرير الذكاء الأسبوعي" : "Weekly Intelligence Report"}
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color: cs?.muted || "#64748b", fontSize:18, cursor:"pointer" }}>✕</button>
        </div>

        {!data.ready ? (
          <div style={{ textAlign:"center", padding:"30px 10px" }}>
            <div style={{ fontSize:28, marginBottom:10 }}>📅</div>
            <div style={{ fontSize:13, color: cs?.text || "#e2e8f0", marginBottom:6 }}>
              {isAr ? "محتاجين على الأقل 3 جلسات في كل من آخر أسبوعين للمقارنة" : "Need at least 3 sessions in each of the last two weeks to compare"}
            </div>
            <div style={{ fontSize:11.5, color: cs?.muted || "#64748b" }}>
              {isAr
                ? `هذا الأسبوع: ${data.thisWeekCount} جلسة · الأسبوع الماضي: ${data.lastWeekCount} جلسة`
                : `This week: ${data.thisWeekCount} sessions · Last week: ${data.lastWeekCount} sessions`}
            </div>
          </div>
        ) : (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
              <div style={{ background:"rgba(255,255,255,.03)", borderRadius:12, padding:14, textAlign:"center" }}>
                <div style={{ fontSize:20, fontWeight:800, color: data.scoreDelta >= 0 ? "#10b981" : "#ef4444" }}>
                  {data.scoreThis} <span style={{ fontSize:11, fontWeight:600 }}>{data.scoreDelta >= 0 ? `▲${data.scoreDelta}` : `▼${Math.abs(data.scoreDelta)}`}</span>
                </div>
                <div style={{ fontSize:10.5, color: cs?.muted || "#64748b", marginTop:3 }}>{isAr ? "متوسط الدرجة" : "Avg score"}</div>
              </div>
              <div style={{ background:"rgba(255,255,255,.03)", borderRadius:12, padding:14, textAlign:"center" }}>
                <div style={{ fontSize:20, fontWeight:800, color: cs?.text || "#e2e8f0" }}>{data.sessionsThis}</div>
                <div style={{ fontSize:10.5, color: cs?.muted || "#64748b", marginTop:3 }}>
                  {isAr ? `جلسة (${data.minutesThis} دقيقة)` : `sessions (${data.minutesThis} min)`}
                </div>
              </div>
            </div>

            {data.improved && (
              <div style={{ background:"rgba(16,185,129,.08)", border:"1px solid rgba(16,185,129,.2)", borderRadius:12, padding:14, marginBottom:10 }}>
                <div style={{ fontSize:11, fontWeight:700, color:"#10b981", marginBottom:4 }}>
                  {isAr ? "📈 أكتر حاجة اتحسنت" : "📈 Biggest improvement"}
                </div>
                <div style={{ fontSize:12.5, color: cs?.text || "#e2e8f0" }}>
                  {isAr ? `${lbl(data.improved.key)} تحسّن بـ ${Math.round(data.improved.delta)} نقطة عن الأسبوع الماضي` : `${lbl(data.improved.key)} improved by ${Math.round(data.improved.delta)} points vs last week`}
                </div>
              </div>
            )}

            {data.declined && (
              <div style={{ background:"rgba(239,68,68,.08)", border:"1px solid rgba(239,68,68,.2)", borderRadius:12, padding:14, marginBottom:10 }}>
                <div style={{ fontSize:11, fontWeight:700, color:"#ef4444", marginBottom:4 }}>
                  {isAr ? "📉 محتاج انتباه" : "📉 Needs attention"}
                </div>
                <div style={{ fontSize:12.5, color: cs?.text || "#e2e8f0" }}>
                  {isAr ? `${lbl(data.declined.key)} ساء بـ ${Math.round(Math.abs(data.declined.delta))} نقطة عن الأسبوع الماضي` : `${lbl(data.declined.key)} declined by ${Math.round(Math.abs(data.declined.delta))} points vs last week`}
                </div>
              </div>
            )}

            {!data.improved && !data.declined && (
              <div style={{ fontSize:12.5, color: cs?.muted || "#64748b", textAlign:"center", padding:"10px 0" }}>
                {isAr ? "وضعيتك ثابتة نسبيًا عن الأسبوع الماضي — مفيش تغيير كبير في أي منطقة." : "Your posture stayed fairly consistent vs last week — no big shift in any one area."}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
