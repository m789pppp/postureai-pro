/**
 * SharedReportPage — Public interactive posture report
 * Route: /report/:token  (no login required)
 * Data: Firestore "shared_reports" collection (public read, no write)
 * Expires: 30 days after creation
 */
import { useEffect, useState, useRef } from "react";
import { getSharedReport } from "./firebase.js";

const METRIC_LABELS = {
  neck_lean:"Neck Lean", neck_lean_side:"Neck Lean (Side)", head_tilt:"Head Tilt",
  head_yaw:"Head Rotation", shoulder:"Shoulder Balance", spine_lean:"Spine Lean",
  spine_align:"Spine Alignment", fhp:"Forward Head Posture", fhp_side:"Forward Head (Side)",
  rounded:"Rounded Shoulders", elbow:"Elbow Angle", monitor:"Monitor Height",
  distance:"Viewing Distance", trunk_lean:"Trunk Lean", hip_angle:"Hip Angle", knee_angle:"Knee Angle",
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
function zonalRisk(metrics) {
  const sc = k => {
    const v = metrics?.[k];
    return typeof v === "number" ? v : (v?.score ?? 100);
  };
  return {
    cervical: Math.round((100 - (sc("neck_lean")+sc("neck_lean_side")+sc("head_tilt")+sc("head_yaw")+sc("fhp")+sc("fhp_side"))/6)),
    thoracic: Math.round((100 - (sc("shoulder")+sc("rounded")+sc("spine_lean")+sc("trunk_lean"))/4)),
    lumbar:   Math.round((100 - (sc("spine_align")+sc("hip_angle")+sc("spine_lean"))/3)),
  };
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
    <div style={{ ...S.page, direction: isAr ? 'rtl' : 'ltr' }}>
      <div style={S.center}>
        <div style={S.spinner} />
        <p style={{ color:"#94a3b8", marginTop:16 }}>Loading report…</p>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ ...S.page, direction: isAr ? 'rtl' : 'ltr' }}>
      <div style={S.center}>
        <div style={{ fontSize:48, marginBottom:16 }}>🔒</div>
        <h2 style={{ color:"#f1f5f9", marginBottom:8 }}>Report Unavailable</h2>
        <p style={{ color:"#94a3b8" }}>{error}</p>
        <a href="/" style={{ ...S.btn, marginTop:24, display:"inline-block", textDecoration:"none" }}>
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
  const isAr    = data.lang === "ar";
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
    neck_lean:"ميل الرقبة", neck_lean_side:"ميل الرقبة (جانبي)", head_tilt:"انحناء الرأس",
    head_yaw:"دوران الرأس", shoulder:"توازن الكتفين", spine_lean:"ميل العمود الفقري",
    spine_align:"محاذاة العمود الفقري", fhp:"تقدم الرأس للأمام", fhp_side:"تقدم الرأس (جانبي)",
    rounded:"تقريس الأكتاف", elbow:"زاوية الكوع", monitor:"ارتفاع الشاشة",
    distance:"مسافة المشاهدة", trunk_lean:"ميل الجذع", hip_angle:"زاوية الورك", knee_angle:"زاوية الركبة",
  };

  const ZONES_AR = {
    cervical: {title:"عنق الرحم (الرقبة)", region:"C1–C7", detail:"وضع الرأس، ميل الرقبة، تقدم الرأس والدوران"},
    thoracic: {title:"الصدر (أعلى الظهر)", region:"T1–T12", detail:"توازن الأكتاف، تقريس الأكتاف، انحناء العمود العلوي"},
    lumbar:   {title:"القطن (أسفل الظهر)", region:"L1–S1", detail:"محاذاة العمود، زاوية الورك، ميل الجذع"},
  };
  const metricEntries = Object.entries(metrics)
    .filter(([,v]) => v !== null && v !== undefined)
    .map(([k,v]) => ({
      k,
      lbl: isAr ? (METRIC_LABELS_AR[k] || METRIC_LABELS[k] || k) : (METRIC_LABELS[k] || k),
      sc:   typeof v === "number" ? v : (v?.score ?? 100),
      val:  typeof v === "number" ? null : v?.value,
      unit: typeof v === "number" ? "" : (v?.unit || ""),
    }))
    .sort((a,b) => a.sc - b.sc);

  const zones = [
    { k:"cervical",
      title: isAr ? ZONES_AR.cervical.title : "Cervical (Neck)",
      region: "C1–C7",
      detail: isAr ? ZONES_AR.cervical.detail : "Head position, neck lean, FHP & rotation" },
    { k:"thoracic",
      title: isAr ? ZONES_AR.thoracic.title : "Thoracic (Upper Back)",
      region: "T1–T12",
      detail: isAr ? ZONES_AR.thoracic.detail : "Shoulder balance, rounded shoulders, spine lean" },
    { k:"lumbar",
      title: isAr ? ZONES_AR.lumbar.title : "Lumbar (Lower Back)",
      region: "L1–S1",
      detail: isAr ? ZONES_AR.lumbar.detail : "Spine alignment, hip angle, trunk lean" },
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
    <div style={{ ...S.page, direction: isAr ? "rtl" : "ltr", fontFamily: isAr ? "'Cairo', 'DM Sans', system-ui" : "'DM Sans', system-ui" }}>
      {/* Header */}
      <header style={S.header}>
        <div style={S.headerInner}>
          <div style={S.logo}>
            <div style={S.logoIcon}>◈</div>
            <span style={S.logoText}>Corvus</span>
            <span style={S.logoBadge}>Elite</span>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:11, color:"#64748b" }}>{isAr ? "تقرير الوضعية المشترك" : "Shared Posture Report"}</div>
            <div style={{ fontSize:11, color:"#64748b" }}>{isAr ? `ينتهي خلال ${daysLeft} يوم` : `Expires in ${daysLeft} days`}</div>
          </div>
        </div>
      </header>

      <main style={S.main}>
        {/* Title */}
        <div style={S.titleBlock}>
          <h1 style={S.title}>
            {data.display_name}'s Posture Analysis
            {data.session_num ? ` — Session #${data.session_num}` : ""}
          </h1>
          <p style={S.subtitle}>
            {data.mode === "side" ? "Side camera" : "Front camera"} ·{" "}
            {fmtDate(data.created_at?.toDate?.() || data.created_at)} ·{" "}
            Shared {fmtDate(sharedAt)}
          </p>
        </div>

        {/* Score card */}
        <div style={{ ...S.card, border:`1.5px solid ${col}44`, marginBottom:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:24 }}>
            <div style={{ ...S.scoreRing, background:`${col}22`, border:`3px solid ${col}` }}>
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
          <div style={{ ...S.card, marginBottom:20 }}>
            <h2 style={S.sectionTitle}>Score Timeline</h2>
            <div style={{ background:"#0f172a", borderRadius:8, padding:"12px 8px 4px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                {[50,65,80,95].map(v => (
                  <span key={v} style={{ fontSize:9, color:"#334155" }}>{v}</span>
                ))}
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
          <div style={{ ...S.card, border:"1px solid #1e3a5f", background:"#0c1929", marginBottom:20 }}>
            <div style={{ fontSize:10, fontWeight:700, color:"#3b82f6", letterSpacing:"0.06em", marginBottom:10 }}>
              🤖 CORVUS AI ANALYSIS
            </div>
            <p style={{ fontSize:13.5, color:"#cbd5e1", lineHeight:1.7 }}>{data.ai_tip}</p>
          </div>
        )}

        {/* Zonal risk map — interactive */}
        <div style={{ ...S.card, marginBottom:20 }}>
          <h2 style={S.sectionTitle}>Spinal Zone Risk Map</h2>
          <p style={{ fontSize:11, color:"#64748b", marginBottom:16 }}>
            Click a zone to see contributing metrics. Not a medical diagnosis.
          </p>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {zones.map(({k,title,region,detail}) => {
              const risk = zonal[k]||0;
              const rc   = riskColor(risk);
              const open = activeZone === k;
              return (
                <div
                  key={k}
                  onClick={() => setActiveZone(open ? null : k)}
                  style={{
                    background: open?"#0f172a":"#1e293b",
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
                      <span style={{ fontSize:14, fontWeight:800, color:rc }}>{risk}%</span>
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", justifyContent:"space-between" }}>
                        <span style={{ fontSize:13, fontWeight:600, color:"#f1f5f9" }}>{title}</span>
                        <span style={{ fontSize:11, fontWeight:600, color:rc }}>{riskLabel(risk)}</span>
                      </div>
                      <div style={{ fontSize:11, color:"#64748b", marginTop:2 }}>{region}</div>
                      {/* Bar */}
                      <div style={{ height:4, background:"#334155", borderRadius:99, marginTop:8 }}>
                        <div style={{
                          height:"100%", borderRadius:99, width:`${risk}%`,
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
        <div style={{ ...S.card, marginBottom:20 }}>
          <h2 style={S.sectionTitle}>Posture Metrics Breakdown</h2>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {metricEntries.map(({k,lbl,sc,val,unit}) => {
              const mc = scoreColor(sc);
              return (
                <div key={k} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0",
                  borderBottom:"1px solid #1e293b" }}>
                  {/* Score badge */}
                  <div style={{
                    width:36, height:36, borderRadius:8, flexShrink:0,
                    background:`${mc}22`, display:"flex", alignItems:"center",
                    justifyContent:"center",
                  }}>
                    <span style={{ fontSize:13, fontWeight:700, color:mc }}>{Math.round(sc)}</span>
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, color:"#f1f5f9", marginBottom:4 }}>{lbl}</div>
                    <div style={{ height:3, background:"#1e293b", borderRadius:99 }}>
                      <div style={{ height:"100%", width:`${sc}%`, borderRadius:99, background:mc }} />
                    </div>
                  </div>
                  {val != null && (
                    <div style={{ fontSize:12, fontWeight:600, color:mc, minWidth:40, textAlign:"right" }}>
                      {typeof val==="number"?Math.round(val*10)/10:val}{unit}
                    </div>
                  )}
                  <div style={{ fontSize:11, color:mc, minWidth:64, textAlign:"right" }}>
                    {scoreGrade(sc)}
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
              <div style={{ ...S.card, background:"#1c1208", border:"1px solid #92400e" }}>
                <p style={{ fontSize:13, color:"#fbbf24" }}>{data.pain_summary}</p>
              </div>
            )}
            {data.improvement_tip && (
              <div style={{ ...S.card, background:"#0a1f12", border:"1px solid #166534" }}>
                <p style={{ fontSize:13, color:"#86efac" }}>{data.improvement_tip}</p>
              </div>
            )}
          </div>
        )}

        {/* Footer CTA */}
        <div style={{ ...S.card, textAlign:"center", background:"#0f1729" }}>
          <div style={{ fontSize:13, color:"#64748b", marginBottom:4 }}>
            This report was generated by Corvus PostureAI Pro
          </div>
          <div style={{ fontSize:11, color:"#475569" }}>
            Link expires {fmtDate(expiresAt)} · Views: {(data.view_count||0)+1}
          </div>
          <a href="https://postureai-pro-omega-nine.vercel.app" target="_blank" rel="noopener noreferrer"
            style={{ ...S.btn, display:"inline-block", marginTop:16, textDecoration:"none" }}>
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

/* ── Styles ── */
const S = {
  page: {
    minHeight:"100vh", background:"#030b14", color:"#f1f5f9",
    fontFamily:"'DM Sans', system-ui, sans-serif",
  },
  center: {
    display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
    minHeight:"80vh", padding:24,
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
