/**
 * SharedReportPage — Public interactive posture report
 * Route: /report/:token  (no login required)
 * Data: Firestore "shared_reports" collection (public read, no write)
 * Expires: 30 days after creation
 */
import { useEffect, useState, useRef } from "react";
import { ZONE_METRICS } from "./lib/clinicalMetrics.js";
import { getSharedReport } from "./firebase.js";

const METRIC_LABELS = {
  neck_lean:"Neck Lean", neck_lean_side:"Neck Lean (Side)", head_tilt:"Head Tilt",
  head_yaw:"Head Rotation", shoulder:"Shoulder Balance", spine_lean:"Spine Lean",
  spine_align:"Spine Alignment", fhp:"Forward Head Posture", fhp_side:"Forward Head (Side)",
  rounded:"Rounded Shoulders", elbow:"Elbow Angle", monitor:"Monitor Height",
  distance:"Viewing Distance", trunk_lean:"Trunk Lean", hip_angle:"Hip Angle", knee_angle:"Knee Angle",
};

/* ── Styles ── */
const SRP_TOKENS = {
  page: {
    minHeight:"100dvh", background:"#030b14", color:"#f1f5f9",
    fontFamily:"'IBM Plex Sans Arabic', 'DM Sans', system-ui, sans-serif",
  },
  center: {
    display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
    minHeight:"80dvh", padding:24,
  },
  spinner: {
    width:40, height:40, borderRadius:"50%",
    border:"3px solid #1e293b", borderTopColor:"#3b82f6",
    animation:"spin 0.8s linear infinite",
  },
  header: {
    background:"#0a1628", borderBottom:"1px solid #1e293b",
    padding:"0 24px",
  },
  headerInner: {
    maxWidth:720, margin:"0 auto", height:56,
    display:"flex", alignItems:"center", justifyContent:"space-between",
  },
  logo: {
    display:"flex", alignItems:"center", gap:8,
  },
  logoIcon: {
    width:30, height:30, background:"#1a56db", borderRadius:6,
    display:"flex", alignItems:"center", justifyContent:"center",
    fontSize:16, color:"#fff",
  },
  logoText: { fontSize:16, fontWeight:800, color:"#f1f5f9" },
  logoBadge: {
    fontSize:10, fontWeight:700, background:"#10b981", color:"#fff",
    padding:"2px 7px", borderRadius:99,
  },
  main: { maxWidth:720, margin:"0 auto", padding:"32px 20px" },
  titleBlock: { marginBottom:24 },
  title: { fontSize:22, fontWeight:800, color:"#f1f5f9", margin:0 },
  subtitle: { fontSize:13, color:"#64748b", marginTop:6 },
  card: {
    background:"#0f1e2e", border:"1px solid #1e293b",
    borderRadius:14, padding:"20px 22px",
  },
  scoreRing: {
    width:80, height:80, borderRadius:"50%", flexShrink:0,
    display:"flex", flexDirection:"column",
    alignItems:"center", justifyContent:"center",
  },
  sectionTitle: {
    fontSize:15, fontWeight:700, color:"#f1f5f9",
    marginBottom:12, marginTop:0,
  },
  btn: {
    background:"#1a56db", color:"#fff",
    padding:"10px 24px", borderRadius:10,
    fontSize:13, fontWeight:600, border:"none",
    cursor:"pointer",
  },
};


function scoreColor(s) {
  if (s >= 80) return "#10b981";
  if (s >= 60) return "#f59e0b";
  return "#ef4444";
}
function scoreGrade(s) {
  if (s >= 80) return "Excellent";
  if (s >= 60) return "Good";
  return "Needs Work";
}
function riskColor(v) {
  if (v < 20) return "#10b981";
  if (v < 45) return "#f59e0b";
  if (v < 70) return "#f97316";
  return "#ef4444";
}
function riskLabel(v) {
  if (v < 20) return "Low";
  if (v < 45) return "Moderate";
  if (v < 70) return "High";
  return "Very High";
}
/**
 * Spinal zone risk for the shared report — the page a patient hands to their
 * physiotherapist.
 *
 * WHAT WAS WRONG. Every zone averaged metric names the engine does not emit,
 * and `sc()` defaulted a missing key to a PERFECT 100:
 *
 *   cervical: neck_lean, neck_lean_side, head_tilt, head_yaw, fhp, fhp_side
 *   thoracic: shoulder, rounded, spine_lean, trunk_lean
 *   lumbar:   spine_align, hip_angle, spine_lean
 *
 * The real keys are neck_lean, head_tilt, shoulder_level, spine_lean, head_yaw,
 * screen_distance, fhp_index, rounded_shoulders, torso_flexion, trunk_rotation,
 * shoulder_elevation, elbow_angle, monitor_height. So `neck_lean_side`, `fhp`,
 * `fhp_side`, `shoulder`, `rounded`, `trunk_lean`, `spine_align` and `hip_angle`
 * — eight of thirteen names — never matched anything and each contributed a
 * silent 100.
 *
 * The arithmetic consequence: with 3 of 6 cervical, 1 of 4 thoracic and 1 of 3
 * lumbar names real, the maximum attainable risk was 50%, 25% and 33%. Against
 * riskLabel's bands (<20 Low, <45 Moderate, <70 High) THORACIC AND LUMBAR COULD
 * NEVER READ ABOVE "Moderate" AND CERVICAL COULD NEVER READ "Very High", for
 * any patient at any severity. A patient with rounded_shoulders scoring 15
 * (severe) got thoracic = 100 - (100+100+85+100)/4 = 4 — printed as "4% — Low"
 * in a green ring on a clinical document. The one metric that caused the bad
 * score was the one silently excluded.
 *
 * Now: real keys only, unreadable metrics dropped rather than defaulted, and a
 * zone with no readings returns null so the UI can say so instead of drawing a
 * reassuring green ring. `from`/`of` lets the report disclose how much of each
 * zone was actually observed.
 */
function zonalRisk(metrics) {
  const read = k => {
    const v = metrics?.[k];
    if (typeof v === "number") return v;
    if (!v || typeof v !== "object") return null;
    // Reliability is measured per metric and was dropped at share time; see
    // the metricSnap fix in firebase.js. Honour it when it survived.
    if (v.reliable === false) return null;
    return Number.isFinite(v.score) ? v.score : null;
  };
  const out = {};
  for (const [zone, keys] of Object.entries(ZONE_METRICS)) {
    const vals = keys.map(read).filter(v => v != null);
    out[zone] = vals.length
      ? { risk: Math.round(100 - vals.reduce((a, b) => a + b, 0) / vals.length), from: vals.length, of: keys.length }
      : null;
  }
  return out;
}
function fmtDur(s) {
  if (!s) return "—";
  const m = Math.floor(s/60);
  return m > 0 ? `${m}m ${s%60}s` : `${s}s`;
}

// Sparkline canvas component
function Sparkline({ data, color, height=48 }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !data?.length) return;
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0,0,W,H);
    const min = Math.max(0, Math.min(...data) - 5);
    const max = Math.min(100, Math.max(...data) + 5);
    const rng = Math.max(max - min, 10);
    const pts = data.map((v,i) => ({
      x: (i/(data.length-1))*W,
      y: H - ((v-min)/rng)*(H-4) - 2,
    }));
    // Fill
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length-1].x, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0,0,0,H);
    grad.addColorStop(0, color+"44");
    grad.addColorStop(1, color+"00");
    ctx.fillStyle = grad;
    ctx.fill();
    // Line
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.moveTo(pts[0].x, pts[0].y);
    pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
    ctx.stroke();
    // End dot
    const last = pts[pts.length-1];
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(last.x, last.y, 3, 0, Math.PI*2);
    ctx.fill();
  }, [data, color]);

  return (
    <canvas
      ref={ref}
      width={400}
      height={height}
      style={{ width:"100%", height, display:"block" }}
    />
  );
}

export default function SharedReportPage() {
  const token = window.location.pathname.split("/report/")[1]?.split("?")[0];
  const [data, setData]   = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeZone, setActiveZone] = useState(null);

  // isAr must be declared BEFORE the early returns that use it
  // data?.lang is null during loading — defaults to false (LTR) until data loads
  const isAr = data?.lang === "ar";

  // Inject spinner keyframe once
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `@keyframes spin{to{transform:rotate(360deg)}} @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&family=DM+Sans:wght@400;600;700;800&display=swap');`;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    if (!token) { setError("Invalid report link."); setLoading(false); return; }
    getSharedReport(token)
      .then(d => {
        setData(d);
        setLoading(false);
        // Apply RTL to document if Arabic
        if (d?.lang === "ar") {
          document.documentElement.dir = "rtl";
          document.documentElement.lang = "ar";
        }
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [token]);

  if (loading) return (
    <div style={{ ...SRP_TOKENS.page, direction: isAr ? 'rtl' : 'ltr' }}>
      <div style={SRP_TOKENS.center}>
        <div style={SRP_TOKENS.spinner} />
        <p style={{ color:"#94a3b8", marginTop:16 }}>Loading report…</p>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ ...SRP_TOKENS.page, direction: isAr ? 'rtl' : 'ltr' }}>
      <div style={SRP_TOKENS.center}>
        <div style={{ fontSize:48, marginBottom:16 }}>🔒</div>
        <h2 style={{ color:"#f1f5f9", marginBottom:8 }}>Report Unavailable</h2>
        <p style={{ color:"#94a3b8" }}>{error}</p>
        <a href="/" style={{ ...SRP_TOKENS.btn, marginTop:24, display:"inline-block", textDecoration:"none" }}>
          Open Corvus →
        </a>
      </div>
    </div>
  );

  const avg     = data.avg_score || 0;
  const col     = scoreColor(avg);
  const hist    = data.score_history || [];
  const metrics = data.metrics || {};
  const zonal   = zonalRisk(metrics);
  // isAr already declared above (before early returns)
  const T = {
    score:     isAr ? "نقاط الوضعية الكلية" : "Overall Posture Score",
    good:      isAr ? "وضعية جيدة" : "Good Posture",
    duration:  isAr ? "المدة" : "Duration",
    alerts:    isAr ? "تنبيهات" : "Alerts",
    timeline:  isAr ? "مسار النقاط" : "Score Timeline",
    aiLabel:   isAr ? "🤖 تحليل Corvus AI" : "🤖 CORVUS AI ANALYSIS",
    zoneTitle: isAr ? "خريطة مناطق العمود الفقري" : "Spinal Zone Risk Map",
    zoneNote:  isAr ? "اضغط على المنطقة للتفاصيل. ليس تشخيصاً طبياً." : "Click a zone to see details. Not a medical diagnosis.",
    metricsTitle: isAr ? "تفاصيل المقاييس" : "Posture Metrics Breakdown",
    ctaBtn:    isAr ? "جرّب Corvus مجاناً ←" : "Try Corvus Free →",
    expired:   isAr ? "الرابط غير متاح" : "Report Unavailable",
    poweredBy: isAr ? "مشغّل بواسطة Corvus Health Intelligence · ليس تشخيصاً طبياً" : "Powered by Corvus Health Intelligence · Not a medical diagnosis",
    sessionStart: isAr ? "بداية الجلسة" : "Session start",
    final:     isAr ? "النهاية" : "Final",
  };

  const METRIC_LABELS_AR = {
    // Re-keyed onto the names postureEngine actually emits. The previous table
    // used shoulder/spine_align/fhp/rounded/trunk_lean/hip_angle/knee_angle,
    // none of which exist, so every Arabic label fell through to the raw key.
    neck_lean:"ميل الرقبة", head_tilt:"إمالة الرأس", head_yaw:"دوران الرأس",
    shoulder_level:"توازن الكتفين", spine_lean:"ميل العمود الفقري",
    fhp_index:"تقدم الرأس للأمام", rounded_shoulders:"تقوّس الأكتاف",
    torso_flexion:"انحناء الجذع للأمام", trunk_rotation:"دوران الجذع",
    shoulder_elevation:"رفع الأكتاف", elbow_angle:"زاوية الكوع",
    monitor_height:"ارتفاع الشاشة", screen_distance:"مسافة الشاشة",
  };

  const ZONES_AR = {
    // "عنق الرحم" is the machine translation of "cervical" as in the uterine
    // cervix — printed as the neck-zone heading on a clinical document.
    cervical: {title:"الفقرات العنقية (الرقبة)", region:"C1–C7", detail:"ميل الرقبة، إمالة الرأس، دوران الرأس، تقدم الرأس للأمام"},
    thoracic: {title:"الفقرات الصدرية (أعلى الظهر)", region:"T1–T12", detail:"توازن الأكتاف، تقوّس الأكتاف، رفع الأكتاف"},
    lumbar:   {title:"الفقرات القطنية (أسفل الظهر)", region:"L1–S1", detail:"ميل العمود، انحناء الجذع، دوران الجذع (الكاميرا بتشوف الجزء العلوي بس — الحوض مش متقاس)"},
  };
  // `position_penalty` was not filtered out alongside session_fatigue and
  // confidence_val, so an internal scoring deduction — value = penalty points,
  // score = 100 - penalty — rendered on a clinical document as a full posture
  // metric with a progress bar and a grade.
  const INTERNAL = new Set(["session_fatigue", "confidence_val", "position_penalty"]);
  const metricEntries = Object.entries(metrics)
    .filter(([k,v]) => v !== null && v !== undefined && !INTERNAL.has(k))
    .map(([k,v]) => ({
      k,
      // firebase.js already writes a resolved `label` into each metric snapshot;
      // this ignored it and fell through to the raw key, so a clinician saw
      // "fhp_index", "torso_flexion", "rounded_shoulders" — the METRIC_LABELS
      // tables are keyed on names the engine does not emit.
      lbl: (isAr ? METRIC_LABELS_AR[k] : null) || (typeof v === "object" && v?.label) || METRIC_LABELS[k] || k,
      sc:   typeof v === "number" ? v : (v?.score ?? 100),
      val:  typeof v === "number" ? null : v?.value,
      unit: typeof v === "number" ? "" : (v?.unit || ""),
      // The engine marks a metric unreliable when the measurement is
      // geometrically invalid (e.g. FHP with the head turned returns a
      // placeholder score of 90 with reliable:false). That flag was dropped at
      // share time, so an unmeasurable reading printed as "Forward Head
      // Posture — 90 — Excellent" to a clinician.
      unreliable: typeof v === "object" && v?.reliable === false,
    }))
    .sort((a,b) => a.sc - b.sc);

  const zones = [
    { k:"cervical",
      title: isAr ? ZONES_AR.cervical.title : "Cervical (Neck)",
      region: "C1–C7",
      detail: isAr ? ZONES_AR.cervical.detail : "Neck lean, head tilt, head rotation, forward-head posture" },
    { k:"thoracic",
      title: isAr ? ZONES_AR.thoracic.title : "Thoracic (Upper Back)",
      region: "T1–T12",
      detail: isAr ? ZONES_AR.thoracic.detail : "Shoulder level, rounded shoulders, shoulder elevation" },
    { k:"lumbar",
      title: isAr ? ZONES_AR.lumbar.title : "Lumbar (Lower Back)",
      region: "L1–S1",
      detail: isAr ? ZONES_AR.lumbar.detail : "Spine lean, forward slouch, trunk rotation (seated upper-body view — the hips and pelvis are not observed)" },
  ];

  const sharedAt  = data.shared_at?.toDate?.() || new Date(data.shared_at || Date.now());
  const expiresAt = data.expires_at?.toDate?.() || new Date(data.expires_at);
  const daysLeft  = Math.max(0, Math.ceil((expiresAt - new Date()) / 86400000));
  const fmtDate   = (d) => {
    if (!d) return "—";
    return new Date(d?.toDate?.() || d).toLocaleDateString(
      isAr ? "ar-EG" : "en-US",
      { year:"numeric", month:"long", day:"numeric" }
    );
  };

  return (
    <div style={{ ...SRP_TOKENS.page, direction: isAr ? "rtl" : "ltr", fontFamily: isAr ? "'Cairo', 'DM Sans', system-ui" : "'DM Sans', system-ui" }}>
      {/* Header */}
      <header style={SRP_TOKENS.header}>
        <div style={SRP_TOKENS.headerInner}>
          <div style={SRP_TOKENS.logo}>
            <div style={SRP_TOKENS.logoIcon}>◈</div>
            <span style={SRP_TOKENS.logoText}>Corvus</span>
            {/* Was a hardcoded "Elite" on every shared report — a claim about
                the account, rendered to a third party, that no data backs. */}
            {data.tier_label && <span style={SRP_TOKENS.logoBadge}>{data.tier_label}</span>}
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:11, color:"#64748b" }}>{isAr ? "تقرير الوضعية المشترك" : "Shared Posture Report"}</div>
            <div style={{ fontSize:11, color:"#64748b" }}>{isAr ? `ينتهي خلال ${daysLeft} يوم` : `Expires in ${daysLeft} days`}</div>
          </div>
        </div>
      </header>

      <main style={SRP_TOKENS.main}>
        {/* Title */}
        <div style={SRP_TOKENS.titleBlock}>
          <h1 style={SRP_TOKENS.title}>
            {data.display_name}'s Posture Analysis
            {data.session_num ? ` — Session #${data.session_num}` : ""}
          </h1>
          <p style={SRP_TOKENS.subtitle}>
            {data.mode === "side" ? "Side camera" : "Front camera"} ·{" "}
            {fmtDate(data.created_at?.toDate?.() || data.created_at)} ·{" "}
            Shared {fmtDate(sharedAt)}
          </p>
        </div>

        {/* Score card */}
        <div style={{ ...SRP_TOKENS.card, border:`1.5px solid ${col}44`, marginBottom:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:24 }}>
            <div style={{ ...SRP_TOKENS.scoreRing, background:`${col}22`, border:`3px solid ${col}` }}>
              <span style={{ fontSize:28, fontWeight:800, color:col }}>{avg}</span>
              <span style={{ fontSize:11, color:col }}>/100</span>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:22, fontWeight:700, color:col }}>{scoreGrade(avg)}</div>
              <div style={{ fontSize:13, color:"#94a3b8", marginTop:4 }}>Overall Posture Score</div>
              <div style={{ display:"flex", gap:20, marginTop:12 }}>
                {[
                  [`${data.good_pct||0}%`, T.good],
                  [fmtDur(data.duration_s), T.duration],
                  [String(data.alerts_count||0), T.alerts],
                ].map(([v,l]) => (
                  <div key={l}>
                    <div style={{ fontSize:18, fontWeight:700, color:"#f1f5f9" }}>{v}</div>
                    <div style={{ fontSize:10, color:"#64748b" }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sparkline */}
        {hist.length > 2 && (
          <div style={{ ...SRP_TOKENS.card, marginBottom:20 }}>
            <h2 style={SRP_TOKENS.sectionTitle}>Score Timeline</h2>
            <div style={{ background:"#0c1528", borderRadius:8, padding:"12px 8px 4px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                {/* Was a hardcoded [50,65,80,95] row laid out above the chart,
                    reading as gridline labels — but Sparkline auto-scales to
                    [min-5, max+5], so a session ranging 40-55 still showed
                    "50 65 80 95". Real endpoints of the plotted range instead. */}
                {(() => {
                  const lo = Math.max(0, Math.min(...hist) - 5), hi = Math.min(100, Math.max(...hist) + 5);
                  return [lo, Math.round((lo + hi) / 2), hi].map((v, i) => (
                    <span key={i} style={{ fontSize:9, color:"#334155" }}>{Math.round(v)}</span>
                  ));
                })()}
              </div>
              <Sparkline data={hist} color={col} height={56} />
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
                <span style={{ fontSize:10, color:"#64748b" }}>{isAr ? `بداية → ${hist[0]}` : `Session start → ${hist[0]}`}</span>
                <span style={{ fontSize:10, color:col, fontWeight:700 }}>
                  Final → {hist[hist.length-1]}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* AI tip */}
        {data.ai_tip && (
          <div style={{ ...SRP_TOKENS.card, border:"1px solid #1e3a5f", background:"#0c1929", marginBottom:20 }}>
            <div style={{ fontSize:10, fontWeight:700, color:"#3b82f6", letterSpacing:"0.06em", marginBottom:10 }}>
              🤖 CORVUS AI ANALYSIS
            </div>
            <p style={{ fontSize:13.5, color:"#cbd5e1", lineHeight:1.7 }}>{data.ai_tip}</p>
          </div>
        )}

        {/* Zonal risk map — interactive */}
        <div style={{ ...SRP_TOKENS.card, marginBottom:20 }}>
          <h2 style={SRP_TOKENS.sectionTitle}>Spinal Zone Risk Map</h2>
          <p style={{ fontSize:11, color:"#64748b", marginBottom:16 }}>
            Click a zone to see contributing metrics. Not a medical diagnosis.
          </p>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {zones.map(({k,title,region,detail}) => {
              // `zonal[k] || 0` rendered an unmeasured zone as a confident
              // green "0% — Low" ring on a document a clinician reads.
              const z    = zonal[k];
              const risk = z?.risk ?? null;
              const rc   = risk == null ? "#64748b" : riskColor(risk);
              const open = activeZone === k;
              return (
                <div
                  key={k}
                  onClick={() => setActiveZone(open ? null : k)}
                  style={{
                    background: open?"#0c1528":"#1e293b",
                    border:`1px solid ${open?rc+"66":"#334155"}`,
                    borderRadius:10, padding:"14px 16px",
                    cursor:"pointer", transition:"all .2s",
                  }}
                >
                  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                    {/* Risk ring */}
                    <div style={{
                      width:48, height:48, borderRadius:"50%",
                      border:`3px solid ${rc}`,
                      display:"flex", flexDirection:"column",
                      alignItems:"center", justifyContent:"center",
                      background:`${rc}15`, flexShrink:0,
                    }}>
                      <span style={{ fontSize:risk==null?16:14, fontWeight:800, color:rc }}>{risk==null?"—":`${risk}%`}</span>
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", justifyContent:"space-between" }}>
                        <span style={{ fontSize:13, fontWeight:600, color:"#f1f5f9" }}>{title}</span>
                        <span style={{ fontSize:11, fontWeight:600, color:rc }}>{risk==null?(isAr?"مش متقاس":"Not measured"):riskLabel(risk)}</span>
                      </div>
                      <div style={{ fontSize:11, color:"#64748b", marginTop:2 }}>{region}{z?` · ${isAr?`${z.from} من ${z.of} قياسات`:`${z.from} of ${z.of} metrics read`}`:""}</div>
                      {/* Bar */}
                      <div style={{ height:4, background:"#334155", borderRadius:99, marginTop:8 }}>
                        <div style={{
                          height:"100%", borderRadius:99, width:`${risk??0}%`,
                          background:rc, transition:"width .4s",
                        }} />
                      </div>
                    </div>
                    <span style={{ color:"#64748b", fontSize:16 }}>{open?"▲":"▼"}</span>
                  </div>
                  {open && (
                    <div style={{ marginTop:12, paddingTop:12, borderTop:"1px solid #334155" }}>
                      <p style={{ fontSize:12, color:"#94a3b8" }}>{detail}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Metrics breakdown */}
        <div style={{ ...SRP_TOKENS.card, marginBottom:20 }}>
          <h2 style={SRP_TOKENS.sectionTitle}>Posture Metrics Breakdown</h2>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {metricEntries.map(({k,lbl,sc,val,unit,unreliable}) => {
              // An unreliable reading gets no score, no grade and no colour —
              // it was printing the engine's placeholder (e.g. FHP returns 90
              // when the head is turned) as "90 — Excellent" to a clinician.
              const mc = unreliable ? "#64748b" : scoreColor(sc);
              return (
                <div key={k} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0",
                  borderBottom:"1px solid #1e293b" }}>
                  {/* Score badge */}
                  <div style={{
                    width:36, height:36, borderRadius:8, flexShrink:0,
                    background:`${mc}22`, display:"flex", alignItems:"center",
                    justifyContent:"center",
                  }}>
                    <span style={{ fontSize:unreliable?15:13, fontWeight:700, color:mc }}>{unreliable?"—":Math.round(sc)}</span>
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, color:"#f1f5f9", marginBottom:4 }}>{lbl}</div>
                    <div style={{ height:3, background:"#1e293b", borderRadius:99 }}>
                      <div style={{ height:"100%", width:`${unreliable?0:sc}%`, borderRadius:99, background:mc }} />
                    </div>
                  </div>
                  {val != null && !unreliable && (
                    <div style={{ fontSize:12, fontWeight:600, color:mc, minWidth:40, textAlign:"right" }}>
                      {typeof val==="number"?Math.round(val*10)/10:val}{unit}
                    </div>
                  )}
                  <div style={{ fontSize:11, color:mc, minWidth:64, textAlign:"right" }}>
                    {unreliable ? (isAr ? "قراءة غير موثوقة" : "Not reliable") : scoreGrade(sc)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Improvement tip */}
        {(data.improvement_tip || data.pain_summary) && (
          <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:20 }}>
            {data.pain_summary && (
              <div style={{ ...SRP_TOKENS.card, background:"#1c1208", border:"1px solid #92400e" }}>
                <p style={{ fontSize:13, color:"#fbbf24" }}>{data.pain_summary}</p>
              </div>
            )}
            {data.improvement_tip && (
              <div style={{ ...SRP_TOKENS.card, background:"#0a1f12", border:"1px solid #166534" }}>
                <p style={{ fontSize:13, color:"#86efac" }}>{data.improvement_tip}</p>
              </div>
            )}
          </div>
        )}

        {/* Footer CTA */}
        <div style={{ ...SRP_TOKENS.card, textAlign:"center", background:"#0f1729" }}>
          <div style={{ fontSize:13, color:"#64748b", marginBottom:4 }}>
            This report was generated by Corvus PostureAI Pro
          </div>
          <div style={{ fontSize:11, color:"#475569" }}>
            Link expires {fmtDate(expiresAt)} · Views: {(data.view_count||0)+1}
          </div>
          <a href="https://postureai-pro-omega-nine.vercel.app" target="_blank" rel="noopener noreferrer"
            style={{ ...SRP_TOKENS.btn, display:"inline-block", marginTop:16, textDecoration:"none" }}>
            Try Corvus Free →
          </a>
        </div>
      </main>

      {/* Powered by footer */}
      <footer style={{ textAlign:"center", padding:"24px 0 40px", color:"#334155", fontSize:11 }}>
        Powered by Corvus Health Intelligence · Not a medical diagnosis
      </footer>
    </div>
  );
}
