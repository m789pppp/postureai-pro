/**
 * Corvus — AnalyticsDashboard v3
 * AI Intelligence Layer: Executive Summary · Predictive AI · Fatigue · Reports
 */
import { useState, useEffect, useCallback } from "react";
import { getUserSessions, getReferralStats } from "./firebase.js";
import { AIAPI } from "./services/api.js";
import { COLORS as C, TYPE as TY, RADIUS as R, SPACE as SP,
         scoreColor, scoreGrade, GLOBAL_CSS } from "./DesignSystem.js";
import { Skeleton, Spinner, EmptyState, ErrorState,
         ProgressBar, Badge, Btn, Divider } from "./ui/index.jsx";

// ─── helpers ────────────────────────────────────────────────────
const sc = scoreColor;
const fmt = d => d?.toDate?.()?.toLocaleDateString?.() || d?.split?.("T")[0] || "—";
const dur = s => { const m=Math.floor((s.duration_s||0)/60),sec=(s.duration_s||0)%60; return m?`${m}m ${sec}s`:`${sec}s`; };

// ─── Design tokens (local) ───────────────────────────────────────
const T = {
  bg: C.bg, surf: C.bgElevated, card: C.surface,
  border: C.border, text: C.text, muted: C.muted,
  blue: C.blue, green: C.green, amber: C.amber, red: C.red,
};

// ─── Micro components ────────────────────────────────────────────
function Card({ children, style, title, sub, action, noPad }) {
  return (
    <div style={{ background:T.card, borderRadius:R.lg, border:`1px solid ${T.border}`,
      overflow:"hidden", ...style }}>
      {(title||sub||action)&&(
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:`${SP[4]}px ${SP[5]}px`, borderBottom:`1px solid ${T.border}` }}>
          <div>
            {title&&<div style={{ fontSize:TY.md, fontWeight:700, color:T.text }}>{title}</div>}
            {sub&&<div style={{ fontSize:TY.sm, color:T.muted, marginTop:2 }}>{sub}</div>}
          </div>
          {action&&<div>{action}</div>}
        </div>
      )}
      <div style={{ padding: noPad ? 0 : `${SP[4]}px ${SP[5]}px` }}>{children}</div>
    </div>
  );
}

function ScoreLine({ scores, color="#6366f1", h=70 }) {
  if (!scores || scores.length < 2) return (
    <div style={{ height:h, display:"flex", alignItems:"center",
      justifyContent:"center", fontSize:11, color:T.muted }}>
      Not enough data yet
    </div>
  );
  const max = Math.max(...scores, 100);
  const pts = scores.map((s,i) => {
    const x=(i/(scores.length-1))*100, y=((max-s)/max)*h;
    return `${x},${y}`;
  }).join(" ");
  const fill = `0,${h} ${pts} 100,${h}`;
  return (
    <svg viewBox={`0 0 100 ${h}`} preserveAspectRatio="none"
      style={{ width:"100%", height:h, display:"block" }}>
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity=".25"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <polygon points={fill} fill="url(#lg)"/>
      <polyline points={pts} fill="none" stroke={color}
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function HourlyHeatmap({ hourly }) {
  if (!hourly || !Object.keys(hourly).length) return (
    <div style={{ fontSize:11, color:T.muted, padding:"8px 0" }}>No hourly data yet</div>
  );
  const hours = Array.from({length:24},(_,i)=>i);
  const vals  = Object.values(hourly);
  const max   = Math.max(...vals, 1);
  return (
    <div style={{ display:"flex", gap:3, flexWrap:"wrap" }}>
      {hours.map(h => {
        const v = hourly[h];
        const col = v ? sc(v) : "rgba(255,255,255,.04)";
        const opacity = v ? .3 + (v/max)*.7 : 1;
        return (
          <div key={h} title={v?`${h}:00 — ${v}/100`:`${h}:00 — no data`}
            style={{ width:26, height:26, borderRadius:5, background:col,
              opacity, display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:8, color:"rgba(255,255,255,.5)", fontWeight:700 }}>
            {h}
          </div>
        );
      })}
    </div>
  );
}

function RiskGauge({ value, label }) {
  const col = value>=60?T.red:value>=30?T.amber:T.green;
  const r=28, circ=2*Math.PI*r, dash=circ*(value/100);
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
      <svg width={72} height={72} style={{ transform:"rotate(-90deg)" }}>
        <circle cx={36} cy={36} r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth={6}/>
        <circle cx={36} cy={36} r={r} fill="none" stroke={col} strokeWidth={6}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition:"stroke-dasharray .8s ease" }}/>
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
          style={{ transform:"rotate(90deg)", transformOrigin:"center",
            fontFamily:TY.fontSans, fontSize:14, fontWeight:800, fill:col }}>
          {value}
        </text>
      </svg>
      <span style={{ fontSize:10, fontWeight:700, color:col }}>{label}</span>
    </div>
  );
}

function InsightCard({ icon, title, body, priority }) {
  const colMap = { high:T.red, medium:T.amber, low:T.green };
  const col = colMap[priority] || T.blue;
  return (
    <div style={{ display:"flex", gap:12, padding:`${SP[3]}px`, background:"rgba(255,255,255,.025)",
      border:`1px solid rgba(255,255,255,.05)`, borderRadius:R.sm, alignItems:"flex-start",
      borderLeft:`3px solid ${col}` }}>
      <span style={{ fontSize:20, flexShrink:0 }}>{icon}</span>
      <div>
        <div style={{ fontSize:12, fontWeight:700, color:T.text, marginBottom:3 }}>{title}</div>
        <div style={{ fontSize:11, color:T.muted, lineHeight:1.6 }}>{body}</div>
      </div>
      <Badge label={priority||"info"} color={col} bg={`${col}15`}
        style={{ marginLeft:"auto", flexShrink:0 }}/>
    </div>
  );
}

function ForecastBar({ day, score, confidence }) {
  const col = sc(score);
  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
      <div style={{ fontSize:10, color:T.muted, fontFamily:"DM Mono,monospace" }}>{score}</div>
      <div style={{ width:"100%", borderRadius:"3px 3px 0 0",
        background:col, opacity:.6+confidence*.004,
        height:Math.max(4,Math.round(score/100*52)), transition:"height .5s ease" }}/>
      <div style={{ fontSize:9, color:T.muted }}>D{day}</div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────
export function AnalyticsDashboard({ uid, profile, cs, lang="en", onBack, sessions:propSessions }) {
  const [sessions, setSessions]   = useState(propSessions||[]);
  const [loading, setLoading]     = useState(!propSessions);
  const [tab, setTab]             = useState("overview");
  const [dateRange, setDateRange] = useState("30d");
  const [referral, setReferral]   = useState(null);

  const isAr = lang === "ar";

  // Individual vs Company — same as Billing.jsx detection
  const isCompany = profile?.user_type === "hr_admin"
    || profile?.user_type === "employee"
    || !!profile?.is_org_owner
    || !!profile?.company_id
    || profile?.acct_type === "company";

  // ── Tab Content Renderer ──────────────────────────────────────────
  // Extracted from ternary chain to fix esbuild Arabic RTL parse error
  function renderTabContent() {
    if (tab === "overview") return (<>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:SP[2] }}>
              <KpiBox label={t.totalSessions} value={filtered.length} icon="📊" color={T.text}/>
              <KpiBox label={t.avgScore}       value={avgScore}   icon="🎯" color={sc(avgScore)} sub={scoreGrade(avgScore,isAr)} trend={delta||undefined}/>
              <KpiBox label={t.goodPosture}    value={`${goodPct}%`} icon="✅" color={T.green}/>
              <KpiBox label={t.totalTime}      value={`${totalMin}m`} icon="⏱" color={T.text}/>
            </div>

            <Card title={isAr?"اتجاه مؤشر الصحة":"Health Intelligence Trend"}
              sub={isAr?`${filtered.length} جلسة`:`${filtered.length} sessions`}
              action={
                <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                  <div style={{ width:8, height:8, borderRadius:"50%",
                    background: delta>=0?T.green:T.red,
                    boxShadow:`0 0 6px ${delta>=0?T.green:T.red}` }}/>
                  <span style={{ fontSize:11, fontWeight:700,
                    color:delta>=0?T.green:T.red }}>
                    {delta>=0?`+${delta}`:delta} vs last week
                  </span>
                </div>
              }>
              <ScoreLine scores={scoreHist} color={T.blue} h={80}/>
            </Card>

            {/* Session history */}
            <Card title={isAr?"سجل جلسات الذكاء":"Intelligence Session Log"} noPad>
              {filtered.slice(0,15).map((s,i)=>(
                <div key={s.id||i} className="ds-row-hov" style={{
                  display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr",
                  padding:`${SP[3]}px ${SP[5]}px`, alignItems:"center",
                  borderBottom: i<filtered.length-1 ? `1px solid ${T.border}` : "none",
                }}>
                  <div>
                    <div style={{ fontSize:12, fontWeight:600, color:T.text }}>
                      {fmt(s.created_at)}
                    </div>
                    <div style={{ fontSize:10, color:T.muted, marginTop:1 }}>
                      {s.mode||"laptop"} · {dur(s)}
                    </div>
                  </div>
                  <div style={{ fontSize:14, fontWeight:800,
                    color:sc(s.avg_score||0) }}>{s.avg_score||"—"}</div>
                  <div style={{ fontSize:10, color:T.muted }}>
                    {scoreGrade(s.avg_score||0,isAr)}
                  </div>
                  <div>
                    <div style={{ height:4, width:"80%",
                      background:`${sc(s.avg_score||0)}30`, borderRadius:99, overflow:"hidden" }}>
                      <div style={{ height:"100%",
                        width:`${s.avg_score||0}%`, background:sc(s.avg_score||0),
                        borderRadius:99, transition:"width .5s" }}/>
                    </div>
                  </div>
                </div>
              ))}
            </Card>
    </>);
    if (tab === "trends") return (<>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:SP[2] }}>
              <KpiBox label={isAr?"أفضل جلسة":"Best Session"}
                value={bestScore} color={T.green}/>
              <KpiBox label={isAr?"هذا الأسبوع":"This Week"}
                value={thisWeek.length} color={T.blue}
                sub={`avg ${twAvg}/100`}/>
              <KpiBox label={isAr?"أيام متتالية":"Streak"}
                value={streak} color={T.amber} icon="🔥"/>
            </div>

            <Card title={isAr?"توزيع مؤشرات الصحة":"Health Score Distribution"}>
              <div style={{ display:"flex", gap:SP[3] }}>
                {[["Excellent",85,100,T.green],["Good",70,85,T.blue],
                  ["Fair",50,70,T.amber],["Poor",0,50,T.red]].map(([l,min,max,col])=>{
                  const cnt  = filtered.filter(s=>s.avg_score>=min&&s.avg_score<max).length;
                  const pct  = filtered.length?Math.round(cnt/filtered.length*100):0;
                  return (
                    <div key={l} style={{ flex:1, textAlign:"center" }}>
                      <div style={{ fontSize:22, fontWeight:800, color:col }}>{pct}%</div>
                      <div style={{ fontSize:9, color:T.muted, marginTop:2 }}>{l}</div>
                      <ProgressBar value={pct} max={100} color={col} h={4}
                        style={{ marginTop:6 }}/>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card title={isAr?"تحليل وقت المراقبة":"Monitoring Time Analysis"}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:SP[3] }}>
                {[
                  [isAr?"إجمالي الوقت":"Total time",     `${totalMin}m`],
                  [isAr?"متوسط الجلسة":"Avg session",    filtered.length?`${Math.round(totalMin/filtered.length)}m`:"—"],
                  [isAr?"وضعية جيدة":"Good posture",     `${goodPct}%`],
                  [isAr?"هذا الشهر":"This month",        sessions.filter(s=>(Date.now()-(s.created_at?.toDate?.()?.getTime()||0))<30*86400000).length],
                ].map(([l,v])=>(
                  <div key={l} style={{ background:"rgba(255,255,255,.025)",
                    borderRadius:R.sm, padding:SP[3] }}>
                    <div style={{ fontSize:10, color:T.muted, marginBottom:4 }}>{l}</div>
                    <div style={{ fontSize:20, fontWeight:800, color:T.text }}>{v}</div>
                  </div>
                ))}
              </div>
            </Card>
    </>);
    if (tab === "achievements") return (
            <div style={{ display:"grid",
              gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:SP[3] }}>
              {achievements.map(a=>(
                <div key={a.label} style={{
                  background:T.card, border:`1px solid ${a.done?"rgba(16,185,129,.3)":T.border}`,
                  borderRadius:R.md, padding:`${SP[5]}px ${SP[4]}px`,
                  textAlign:"center", opacity:a.done?1:.45,
                  transition:"all .3s ease",
                }}>
                  <div style={{ fontSize:36, marginBottom:SP[2],
                    filter:a.done?"none":"grayscale(1)" }}>{a.icon}</div>
                  <div style={{ fontSize:12, fontWeight:600,
                    color:a.done?T.green:T.muted }}>{a.label}</div>
                  {a.done && (
                    <div style={{ fontSize:9, color:T.green,
                      marginTop:4, fontWeight:700 }}>✓ {isAr?"محقق":"Achieved"}</div>
                  )}
                </div>
              ))}
            </div>
    );
    if (tab === "referral") return (
            <Card title={isAr?"دعوة واكسب":"Refer & Earn"}
              sub={isAr?"شارك رابطك - أصدقاؤك يحصلون على خصم":"Share your link — friends get 20% off"}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr",
                gap:SP[2], marginBottom:SP[4] }}>
                <KpiBox label={isAr?"محالون":"Referred"}
                  value={referral?.total||0} icon="👥" color={T.text}/>
                <KpiBox label={isAr?"محوّل":"Converted"}
                  value={referral?.converted||0} icon="✅" color={T.green}/>
                <KpiBox label={isAr?"مكتسب":"Earned"}
                  value={`${referral?.earned||0} EGP`} icon="💰" color={T.amber}/>
              </div>
              <div style={{ fontSize:11, color:T.muted, marginBottom:6, fontWeight:600 }}>
                {isAr?"كود الإحالة":"Referral Code"}
              </div>
              <div style={{ display:"flex", gap:8, marginBottom:SP[4] }}>
                <div style={{ flex:1, background:"rgba(255,255,255,.04)",
                  border:`1px solid ${T.border}`, borderRadius:R.sm,
                  padding:`${SP[2]+1}px ${SP[3]}px`, fontSize:13,
                  fontFamily:"DM Mono,monospace", color:T.text, letterSpacing:".05em" }}>
                  {profile?.referral_code||"—"}
                </div>
                <button onClick={copyReferral} style={{
                  background:"linear-gradient(135deg,#6366f1,#0891b2)",
                  border:"none", borderRadius:R.sm,
                  padding:`${SP[2]+1}px ${SP[4]}px`,
                  fontSize:12, fontWeight:600, color:"white", cursor:"pointer",
                }}>{copied?(isAr?"تم النسخ ✓":"Copied ✓"):(isAr?"نسخ":"Copy Link")}</button>
              </div>
            </Card>
    );
    return null;
  }

  // Arabic string constants — extracted to avoid esbuild RTL parse errors
  const S = {
    noSessions:      isAr ? "لا توجد جلسات" : "No sessions yet",
    noSessionsDesc:  isAr ? "ابدأ جلستك الأولى لترى تحليلاتك" : "Start your first session to see analytics",
  };

function KpiBox({ label, value, sub, color, icon, trend, accent }) {
  const col = color || T.text;
  return (
    <div style={{ background:T.card, border:`1px solid ${T.border}`,
      borderRadius:R.md, padding:`${SP[4]}px`, position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", top:0, left:0, right:0, height:2,
        background:`linear-gradient(90deg,${col}60,transparent)` }}/>
      <div style={{ fontSize:10, fontWeight:700, color:T.muted, letterSpacing:".08em",
        textTransform:"uppercase", marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
        {icon && <span>{icon}</span>}{label}
      </div>
      <div style={{ fontSize:28, fontWeight:800, color:col, letterSpacing:"-1.5px", lineHeight:1, marginBottom:4 }}>
        {value ?? "—"}
      </div>
      {sub && <div style={{ fontSize:10.5, color:col, fontWeight:500 }}>{sub}</div>}
      {trend !== undefined && (
        <div style={{ fontSize:10, marginTop:4, color:trend>0?T.green:trend<0?T.red:T.muted }}>
          {trend>0?`↑ +${trend}`:`↓ ${trend}`} pts vs last week
        </div>
      )}
    </div>
  );
}


  // Labels
  const L = {
    en:{ overview:"Health Overview", ai:"AI Insights", trends:"Trends",
         achievements:"Milestones", referral:"Referrals",
         totalSessions:"Total Sessions", avgScore:"Avg Score",
         goodPosture:"Good Posture", totalTime:"Total Time",
         loading:"Analyzing with AI…", noData:"No sessions yet",
         back:"← Back", burnout:"Burnout Risk", posture:"Posture Risk",
         executive:"Executive Summary", weekly:"Weekly Insights",
         fatigue:"Fatigue Analysis", predictive:"Predictive AI" },
    ar:{ overview:"نظرة عامة", ai:"رؤى الذكاء الاصطناعي", trends:"الاتجاهات",
         achievements:"الإنجازات", referral:"الإحالات",
         totalSessions:"إجمالي الجلسات", avgScore:"متوسط النقاط",
         goodPosture:"وضعية جيدة", totalTime:"الوقت الكلي",
         loading:"جارٍ التحليل…", noData:"لا توجد جلسات",
         back:"رجوع ←", burnout:"خطر الإرهاق", posture:"خطر الوضعية",
         executive:"ملخص تنفيذي", weekly:"رؤى الأسبوع",
         fatigue:"تحليل الإجهاد", predictive:"الذكاء التنبؤي" },
  };
  const t = L[lang]||L.en;

  useEffect(() => {
    if (propSessions) { setSessions(propSessions); setLoading(false); return; }
    if (!uid) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      getUserSessions(uid).catch(()=>[]),
      getReferralStats(uid).catch(()=>null),
    ]).then(([sess,ref]) => {
      setSessions(sess||[]);
      setReferral(ref);
    }).catch(()=>{
      setSessions([]);
    }).finally(()=>setLoading(false));
  }, [uid, propSessions]);
  // AI Insights tab removed for individuals — loadAI() and related state removed.

  // Filtered sessions
  const filtered = sessions.filter(s => {
    const ms = s.created_at?.toDate?.()?.getTime() || 0;
    const age = Date.now() - ms;
    if (dateRange==="7d")  return age < 7*86400000;
    if (dateRange==="30d") return age < 30*86400000;
    return true;
  });

  const avgScore  = filtered.length ? Math.round(filtered.reduce((a,s)=>a+(s.avg_score||0),0)/filtered.length) : 0;
  const goodPct   = filtered.length ? Math.round(filtered.reduce((a,s)=>a+(s.good_pct||0),0)/filtered.length) : 0;
  const totalMin  = Math.round(filtered.reduce((a,s)=>a+(s.duration_s||0),0)/60);
  const scoreHist = filtered.slice(0,30).reverse().map(s=>s.avg_score||0);

  const bestScore = filtered.length ? Math.max(...filtered.map(s=>s.avg_score||0)) : 0;
  const streak    = profile?.streak_days || 0;

  // Week-over-week
  const thisWeek  = filtered.filter(s=>(Date.now()-(s.created_at?.toDate?.()?.getTime()||0))<7*86400000);
  const lastWeek  = filtered.filter(s=>{const a=Date.now()-(s.created_at?.toDate?.()?.getTime()||0);return a>=7*86400000&&a<14*86400000;});
  const twAvg     = thisWeek.length  ? Math.round(thisWeek.reduce((a,s)=>a+(s.avg_score||0),0)/thisWeek.length) : 0;
  const lwAvg     = lastWeek.length  ? Math.round(lastWeek.reduce((a,s)=>a+(s.avg_score||0),0)/lastWeek.length) : 0;
  const delta     = twAvg - lwAvg;

  const achievements = [
    { icon:"🎯", label:isAr?"أول جلسة":"First session",      done:sessions.length>=1 },
    { icon:"🔥", label:isAr?"7 أيام متتالية":"7-day streak",   done:streak>=7 },
    { icon:"⭐", label:isAr?"نقاط 85+":"Score 85+",            done:avgScore>=85 },
    { icon:"📊", label:isAr?"10 جلسات":"10 sessions",         done:sessions.length>=10 },
    { icon:"💎", label:isAr?"30 جلسة":"30 sessions",          done:sessions.length>=30 },
    { icon:"🏆", label:isAr?"نقاط 90+":"Score 90+",           done:avgScore>=90 },
  ];

  const TABS = [
    { id:"overview", label:t.overview, icon:"▦" },
    { id:"trends",   label:t.trends,   icon:"⟳" },
    { id:"achievements", label:t.achievements, icon:"🏆" },
    { id:"referral", label:t.referral, icon:"◈" },
  ];

  const [copied, setCopied] = useState(false);
  const copyReferral = () => {
    const url=`${window.location.origin}?ref=${profile?.referral_code||""}`;
    navigator.clipboard.writeText(url).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);});
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:2000, overflowY:"auto",
      background:T.bg, color:T.text,
      fontFamily:"'DM Sans',system-ui,sans-serif", direction:isAr?"rtl":"ltr" }}>
      <style>{GLOBAL_CSS}</style>

      {/* HEADER */}
      <div style={{ position:"sticky", top:0, zIndex:30, background:"rgba(7,11,18,.95)",
        borderBottom:`1px solid ${T.border}`, backdropFilter:"blur(16px)" }}>
        <div style={{ padding:`${SP[4]}px ${SP[5]}px`, display:"flex",
          alignItems:"center", gap:12 }}>
          <button onClick={onBack} style={{ background:"none",
            border:`1px solid ${T.border}`, borderRadius:R.xs,
            padding:`${SP[1]+2}px ${SP[3]}px`, fontSize:11, color:T.muted, cursor:"pointer" }}>
            {t.back}
          </button>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:16, fontWeight:800, color:T.text, letterSpacing:"-.03em" }}>
              {isCompany
                ? (isAr ? "لوحة ذكاء القوى العاملة" : "Workforce Intelligence Dashboard")
                : (isAr ? "لوحة التحليلات الشخصية"  : "Personal Analytics Dashboard")}
            </div>
            <div style={{ fontSize:10, color:T.muted, marginTop:1 }}>
              {profile?.name||profile?.email}
            </div>
          </div>
          <div style={{ display:"flex", gap:6 }}>
            {["7d","30d","all"].map(r=>(
              <button key={r} onClick={()=>setDateRange(r)} style={{
                background: dateRange===r ? T.blue : "none",
                border:`1px solid ${dateRange===r?T.blue:T.border}`,
                borderRadius:R.xs, padding:`${SP[1]}px ${SP[2]+2}px`,
                fontSize:10, fontWeight:600,
                color:dateRange===r?"white":T.muted, cursor:"pointer",
              }}>{r==="all"?(isAr?"الكل":"All"):r}</button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", padding:`0 ${SP[5]}px`,
          borderTop:`1px solid ${T.border}`, overflowX:"auto" }}>
          {TABS.map(tb=>(
            <button key={tb.id} onClick={()=>setTab(tb.id)} style={{
              background:"none", border:"none",
              borderBottom: tab===tb.id ? `2px solid ${T.blue}` : "2px solid transparent",
              padding:`${SP[3]}px ${SP[4]}px`,
              fontSize:11, fontWeight:600,
              color: tab===tb.id ? T.blue : T.muted,
              cursor:"pointer", whiteSpace:"nowrap",
              display:"flex", alignItems:"center", gap:5,
            }}>
              <span>{tb.icon}</span>
              <span>{tb.label}</span>
              {tb.badge && (
                <span style={{ fontSize:8, fontWeight:800, padding:"1px 5px",
                  borderRadius:99, background:"linear-gradient(135deg,#6366f1,#0891b2)",
                  color:"white" }}>{tb.badge}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ padding:`${SP[5]}px`, maxWidth:980, margin:"0 auto",
        display:"flex", flexDirection:"column", gap:SP[4] }}>

        {(() => {
          if (loading) return (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {[1,2,3].map(i=><Skeleton key={i} h={i===1?100:i===2?200:160} r={14}/>)}
            </div>
          );
          if (filtered.length===0) return (
            <EmptyState icon="📊"
              title={S.noSessions}
              desc={S.noSessionsDesc}/>
          );
          return renderTabContent();
        })()}
      </div>
    </div>
  );
}
