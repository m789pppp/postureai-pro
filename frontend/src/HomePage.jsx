/**
 * Corvus — HomePage v4
 * Complete rewrite: proper role separation, working tools, real data, tier gates
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { getUserSessions, getAllUsers, updateUserProfile, auth, deleteSession, getAuthToken, deleteAuthUser, logOut } from "./firebase.js";
import { API_BASE_URL } from "./config/api.js";
import { updateProfile as fbUpdateProfile } from "firebase/auth";
import { tierAtLeast } from "./lib/tierQuality.js";
import { enablePushNotifications, disablePushNotifications, isPushEnabled } from "./push.js";
import { PushAPI, dispatchNotification, FeatureFlagsAPI, BillingAPI, FamilyAPI } from "./services/api.js";
import { getAvailableVoices, getVoicePrefs, setVoicePrefs, speakCoach, LOCALE_OPTIONS } from "./lib/voiceCoach.js";
import { SessionUsageBar, DemoSessionModal, UpgradeTeaser, FirstSessionBadge, PainAreaSelfReport, FREE_MONTHLY_SESSION_LIMIT } from "./FreeTierGrowth.jsx";
import { StressCheckIn, StressCorrelationCard } from "./StressPosture.jsx";
import { BasicDashboard } from "./BasicFeatures.jsx";
import { WeeklyIntelligenceButton, WeeklyIntelligenceModal } from "./WeeklyIntelligence.jsx";

// ─── Role detection ────────────────────────────────────────────────
function role(profile, isAdmin, isHRAdmin) {
  if (isAdmin) return "platform_admin";
  // HR/Company: prop OR profile fields
  if (isHRAdmin
    || profile?.user_type === "hr_admin"
    || profile?.acct_type === "company"
    || profile?.is_org_owner === true
  ) return "hr_admin";
  // Employee: belongs to a company but is NOT hr_admin
  if (profile?.company_id) return "employee";
  // Default: individual user
  return "individual";
}

// ─── Tier helpers ──────────────────────────────────────────────────
// Delegates to the canonical feature-tier ladder (frontend/src/lib/tierQuality.js)
// so B2B plans (b2b_growth/b2b_enterprise) correctly count as Pro/Elite here too —
// previously these only matched literal "professional"/"elite"/"business" strings.
function isPro(tier)   { return tierAtLeast(tier, "professional"); }
function isElite(tier) { return tierAtLeast(tier, "elite"); }

// ─── Avatar (photo or initial + color) ────────────────────────────
function Avatar({ name, photo, size = 36, style = {} }) {
  const label = (name||"User");
  const ch    = label[0].toUpperCase();
  const hue   = label.split("").reduce((a,c)=>a+c.charCodeAt(0),0) % 360;
  if(photo) return (
    <img src={photo} alt={label}
      style={{ width:size, height:size, borderRadius:"50%", flexShrink:0,
        objectFit:"cover", border:`2px solid ${cs.border}`, ...style }}/>
  );
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: `hsl(${hue},55%,32%)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontWeight: 700, color: "#fff",
      border: `2px solid ${cs.border}`,
      ...style,
    }}>{ch}</div>
  );
}

// ─── Score ring ────────────────────────────────────────────────────
function Ring({ score = 0, size = 100 }) {
  const r    = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const pct  = Math.min(100, Math.max(0, score));
  const col  = pct >= 80 ? "#10b981" : pct >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <svg width={size} height={size} style={{ transform:"rotate(-90deg)", flexShrink:0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={cs.border} strokeWidth={6}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={6}
        strokeDasharray={`${(pct/100)*circ} ${circ}`} strokeLinecap="round"
        style={{ transition:"stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)" }}/>
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="middle"
        fill={col} fontSize={size/3.5} fontWeight={800} fontFamily="system-ui"
        style={{ transform:`rotate(90deg)`,transformOrigin:`${size/2}px ${size/2}px` }}>
        {pct||"—"}
      </text>
    </svg>
  );
}

// ─── Stat card ─────────────────────────────────────────────────────
function StatCard({ label, value, sub, color="#3b82f6", cs }) {
  return (
    <div style={{ background:cs.card, border:`1px solid ${cs.border}`, borderRadius:10,
      padding:"14px 16px" }}>
      <div style={{ fontSize:10, color:cs.muted, textTransform:"uppercase",
        letterSpacing:".07em", fontWeight:600, marginBottom:3 }}>{label}</div>
      <div style={{ fontSize:24, fontWeight:800, color, lineHeight:1,
        fontFamily:"system-ui,-apple-system" }}>{value??"—"}</div>
      {sub&&<div style={{ fontSize:11, color:cs.muted, marginTop:3 }}>{sub}</div>}
    </div>
  );
}

// ─── Pain Risk forecast card ───────────────────────────────────────
// "Pain prediction" was listed as a Basic-tier feature but had zero
// presence on the dashboard — the only pain-prediction UI in the app is
// buried inside the live camera sidebar and only fires mid-session
// (App.jsx usePainPrediction). This is a separate, longer-horizon view:
// a prominent forward-looking card built from the last 48h of actual
// sessions, visible the moment the dashboard loads — no camera needed.
// Heuristic, not a clinical prediction (same disclaimer spirit as the
// live in-session estimate) — based on how much of the recent window was
// spent in poor posture and which body region came up most in alerts.
const REGION_LABEL = {
  neck:    { en: "neck",     ar: "رقبتك" },
  yaw:     { en: "neck",     ar: "رقبتك" },
  dist:    { en: "neck/eyes", ar: "رقبتك وعينيك" },
  posture: { en: "back",     ar: "ظهرك" },
  shoulder:{ en: "shoulder", ar: "كتفك" },
};

function computePainRisk(sessions) {
  const cutoff = Date.now() - 48 * 3600 * 1000;
  const recent = (sessions || []).filter(s => {
    const t = (s.created_at?.toDate?.() ?? new Date(s.created_at || 0)).getTime();
    return t >= cutoff;
  });
  if (!recent.length) return null;

  let poorMin = 0, totalMin = 0;
  const causeCounts = {};
  recent.forEach(s => {
    const mins = s.duration_min ?? (s.duration_s || s.duration_sec || 0) / 60;
    totalMin += mins;
    if ((s.avg_score || 0) < 65) poorMin += mins;
    (s.alert_causes || []).forEach(a => {
      const c = a.cause || "posture";
      causeCounts[c] = (causeCounts[c] || 0) + 1;
    });
  });
  if (totalMin < 5) return null; // not enough signal to say anything meaningful

  const poorRatio = poorMin / totalMin;
  const riskPct = Math.round(Math.min(92, poorRatio * 130));
  const topCause = Object.entries(causeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "posture";
  const region = REGION_LABEL[topCause] || REGION_LABEL.posture;

  return { riskPct, region, poorMin: Math.round(poorMin), hours: 48 };
}

function PainRiskCard({ sessions, cs, isAr }) {
  const risk = useMemo(() => computePainRisk(sessions), [sessions]);
  if (!risk) return null;

  const { riskPct, region } = risk;
  const level = riskPct >= 55 ? "high" : riskPct >= 25 ? "moderate" : "low";
  const col   = level === "high" ? "#ef4444" : level === "moderate" ? "#f59e0b" : "#10b981";
  const icon  = level === "high" ? "🔴" : level === "moderate" ? "🟠" : "🟢";

  const msgEn = level === "low"
    ? `Low pain risk right now — your posture the last 48h has stayed mostly healthy. Keep it up.`
    : `Based on your posture the last 48h, ~${riskPct}% chance of ${region.en} discomfort within 48 hours if it doesn't change.`;
  const msgAr = level === "low"
    ? `احتمال ألم منخفض حاليًا — وضعيتك في آخر 48 ساعة كانت صحية في الغالب. استمر كده.`
    : `بناءً على وضعيتك آخر 48 ساعة، احتمال ${riskPct}% تحس بألم في ${region.ar} خلال 48 ساعة إذا ما بدّلتش وضعيتك.`;

  return (
    <div style={{
      background: `${col}12`, border: `1px solid ${col}44`, borderLeft: `4px solid ${col}`,
      borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "flex-start", gap: 12,
    }}>
      <span style={{ fontSize: 22, lineHeight: 1 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: col, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>
          {isAr ? "توقع الألم" : "Pain Prediction"}
        </div>
        <div style={{ fontSize: 13, color: cs.text, lineHeight: 1.5 }}>
          {isAr ? msgAr : msgEn}
        </div>
        <div style={{ fontSize: 10, color: cs.muted, marginTop: 5 }}>
          {isAr ? "تقدير توعوي مبني على جلساتك الأخيرة — ليس تشخيصاً طبياً"
                : "Awareness estimate based on your recent sessions — not a medical diagnosis"}
        </div>
      </div>
    </div>
  );
}


function WeekChart({ sessions, cs }) {
  const days = useMemo(()=>{
    return Array.from({length:7},(_,i)=>{
      const d=new Date(); d.setDate(d.getDate()-(6-i));
      const ds=d.toDateString();
      const ss=sessions.filter(s=>(s.created_at?.toDate?.()??new Date(s.created_at||0)).toDateString()===ds);
      const avg=ss.length?Math.round(ss.reduce((a,s)=>a+(s.avg_score||0),0)/ss.length):0;
      return { label:["Su","Mo","Tu","We","Th","Fr","Sa"][d.getDay()], score:avg, has:ss.length>0 };
    });
  },[sessions]);
  return (
    <div style={{ display:"flex", gap:8, alignItems:"flex-end", height:56 }}>
      {days.map((d,i)=>{
        const h=d.has?Math.max(6,(d.score/100)*50):4;
        const c=d.score>=80?"#10b981":d.score>=60?"#f59e0b":d.has?"#ef4444":cs.border;
        return (
          <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
            <div style={{ width:"100%", height:h, borderRadius:4, background:c,
              transition:"height .6s cubic-bezier(.4,0,.2,1)" }}/>
            <span style={{ fontSize:9, color:cs.muted, fontWeight:500 }}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Empty state ───────────────────────────────────────────────────
function EmptyBlock({ icon, title, desc, action, onAction, cs }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
      gap:12, padding:"48px 24px", textAlign:"center" }}>
      <span style={{ fontSize:42 }}>{icon}</span>
      <div style={{ fontSize:16, fontWeight:700, color:cs.text }}>{title}</div>
      <div style={{ fontSize:13, color:cs.muted, maxWidth:320, lineHeight:1.6 }}>{desc}</div>
      {action&&onAction&&(
        <button onClick={onAction} style={{ marginTop:8, padding:"9px 20px",
          background:"#3b82f6", color:"#fff", border:"none", borderRadius:8,
          fontSize:13, fontWeight:600, cursor:"pointer" }}>{action}</button>
      )}
    </div>
  );
}

// ─── Section heading ───────────────────────────────────────────────
function SectionHead({ title, cs }) {
  return <div style={{ fontSize:11, fontWeight:700, color:cs.muted, textTransform:"uppercase",
    letterSpacing:".08em", marginBottom:12, marginTop:4 }}>{title}</div>;
}

// ─── Tool button (for the grid) ────────────────────────────────────
function ToolBtn({ icon, label, desc, color, onClick, locked, lockLabel="PRO", onLock, cs }) {
  const [hov,setHov]=useState(false);
  return (
    <button onClick={locked?undefined:onClick}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ background:hov&&!locked?`rgba(${color},0.08)`:cs.card,
        border:`1px solid ${hov&&!locked?`rgba(${color},.35)`:cs.border}`,
        borderRadius:12, padding:"14px 12px", cursor:locked?"not-allowed":"pointer",
        textAlign:"center", display:"flex", flexDirection:"column", alignItems:"center",
        gap:8, transition:"all .15s", opacity:locked?.5:1, position:"relative" }}>
      <span style={{ fontSize:24 }}>{icon}</span>
      <span style={{ fontSize:12, fontWeight:700, color:`rgb(${color})` }}>{label}</span>
      <span style={{ fontSize:10, color:cs.muted, lineHeight:1.4 }}>{desc}</span>
      {locked&&<span style={{ position:"absolute", top:8, right:8, fontSize:9,
        background:"rgba(245,158,11,.15)", color:"#f59e0b",
        padding:"2px 6px", borderRadius:4, fontWeight:700 }}>{lockLabel}</span>}
    </button>
  );
}

// ─── Tier badge ────────────────────────────────────────────────────
function TierBadge({ tier }) {
  const map = { elite:["#10b981","Elite ✦"], business:["#a855f7","Business"],
    professional:["#3b82f6","Pro"], standard:["#64748b","Free"] };
  const [col,label]=map[tier]||map.standard;
  return <span style={{ fontSize:10, fontWeight:700, color:col,
    background:`${col}18`, padding:"2px 8px", borderRadius:99,
    border:`1px solid ${col}40` }}>{label}</span>;
}

// ─── Analytics Inline Section ─────────────────────────────────────
function AnalyticsInline({ userSessions = [], profile, cs, isAr, tier, onOpenFull, onCompare, onTrend }) {
  const hasData = userSessions.length > 0;

  // Compute per-day averages for last 14 days
  const days14 = useMemo(()=>{
    return Array.from({length:14},(_,i)=>{
      const d=new Date(); d.setDate(d.getDate()-(13-i));
      const ds=d.toDateString();
      const ss=userSessions.filter(s=>(s.created_at?.toDate?.()??new Date(s.created_at||0)).toDateString()===ds);
      const avg=ss.length?Math.round(ss.reduce((a,s)=>a+(s.avg_score||0),0)/ss.length):null;
      return { label:["Su","Mo","Tu","We","Th","Fr","Sa"][d.getDay()], score:avg, count:ss.length };
    });
  },[userSessions]);

  // Score distribution
  const dist = useMemo(()=>{
    const ex=userSessions.filter(s=>(s.avg_score||0)>=80).length;
    const gd=userSessions.filter(s=>(s.avg_score||0)>=60&&(s.avg_score||0)<80).length;
    const pr=userSessions.filter(s=>(s.avg_score||0)>0&&(s.avg_score||0)<60).length;
    const total=ex+gd+pr||1;
    return { ex, gd, pr, total };
  },[userSessions]);

  // Best/worst scores
  const scores = (userSessions||[]).map(s=>s.avg_score||0).filter(Boolean);
  const best  = scores.length ? Math.max(...scores) : 0;
  const worst = scores.length ? Math.min(...scores) : 0;
  const trend = scores.length>=2 ? scores[0]-scores[1] : 0; // positive = improving

  const maxBar = Math.max(...days14.map(d=>d.score||0),1);

  return (
    <div style={{ background:cs.card, border:`1px solid ${cs.border}`, borderRadius:14, overflow:"hidden" }}>
      {/* Header */}
      <div style={{ padding:"16px 18px 0", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:cs.text }}>
            {isAr?"تحليلات الوضعية":"Posture Analytics"}
          </div>
          <div style={{ fontSize:11, color:cs.muted, marginTop:2 }}>
            {isAr?"آخر 14 يوم":"Last 14 days"}
          </div>
        </div>
        <div style={{ display:"flex", gap:6 }}>
          {onCompare&&(
            <button onClick={onCompare}
              style={{ fontSize:11, fontWeight:600, padding:"5px 10px",
                background:"rgba(168,85,247,.1)", color:"#c084fc",
                border:"1px solid rgba(168,85,247,.25)", borderRadius:7, cursor:"pointer" }}>
              📊 {isAr?"مقارنة":"Compare"}
            </button>
          )}
          {onTrend&&(
            <button onClick={onTrend}
              style={{ fontSize:11, fontWeight:600, padding:"5px 10px",
                background:"rgba(8,145,178,.1)", color:"#67e8f9",
                border:"1px solid rgba(8,145,178,.25)", borderRadius:7, cursor:"pointer" }}>
              📈 {isAr?"اتجاه":"Trend"}
            </button>
          )}
          <button onClick={onOpenFull}
            style={{ fontSize:11, fontWeight:600, padding:"5px 10px",
              background:"rgba(59,130,246,.1)", color:"#60a5fa",
              border:"1px solid rgba(59,130,246,.25)", borderRadius:7, cursor:"pointer" }}>
            {isAr?"تفاصيل كاملة":"Full Report"}
          </button>
        </div>
      </div>

      {!hasData ? (
        <div style={{ padding:"32px 18px", textAlign:"center", color:cs.muted, fontSize:13 }}>
          {isAr?"ابدأ جلستك الأولى لعرض التحليلات":"Start your first session to see analytics"}
        </div>
      ) : (
        <>
          {/* Quick KPIs */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:0,
            borderTop:`1px solid ${cs.border}`, marginTop:14 }}>
            {[
              { label:isAr?"أفضل نتيجة":"Best Score", val:best||"—", col:"#10b981" },
              { label:isAr?"أسوأ نتيجة":"Worst Score", val:worst||"—", col:"#ef4444" },
              { label:isAr?"الاتجاه":"Trend", val:trend>0?`+${trend}`:trend===0?"—":trend, col:trend>0?"#10b981":trend<0?"#ef4444":"#64748b" },
              { label:isAr?"إجمالي الجلسات":"Sessions", val:profile?.sessions_count||userSessions.length, col:"#a855f7" },
            ].map((k,i)=>(
              <div key={i} style={{ padding:"12px 14px",
                borderRight:i<3?`1px solid ${cs.border}`:"none",
                borderTop:`1px solid ${cs.border}` }}>
                <div style={{ fontSize:9, color:cs.muted, textTransform:"uppercase",
                  letterSpacing:".07em", fontWeight:600, marginBottom:4 }}>{k.label}</div>
                <div style={{ fontSize:20, fontWeight:800, color:k.col, lineHeight:1 }}>{k.val}</div>
              </div>
            ))}
          </div>

          {/* 14-day bar chart */}
          <div style={{ padding:"16px 18px" }}>
            <div style={{ fontSize:10, color:cs.muted, fontWeight:600, marginBottom:10,
              textTransform:"uppercase", letterSpacing:".07em" }}>
              {isAr?"متوسط النتيجة يومياً":"Daily Average Score"}
            </div>
            <div style={{ display:"flex", gap:4, alignItems:"flex-end", height:64 }}>
              {days14.map((d,i)=>{
                const h = d.score ? Math.max(6,(d.score/maxBar)*60) : 3;
                const col = !d.score?cs.border:d.score>=80?"#10b981":d.score>=60?"#f59e0b":"#ef4444";
                return (
                  <div key={i} style={{ flex:1, display:"flex", flexDirection:"column",
                    alignItems:"center", gap:4 }}>
                    <div title={d.score?`${d.score} — ${d.count} session${d.count!==1?"s":""}`:isAr?"لا توجد جلسات":"No sessions"}
                      style={{ width:"100%", height:h, borderRadius:3, background:col,
                        transition:"height .5s cubic-bezier(.4,0,.2,1)", cursor:d.score?"pointer":"default" }}/>
                    {(i===0||i===6||i===13||d.count>0)&&(
                      <span style={{ fontSize:8, color:cs.muted, fontWeight:500 }}>{d.label}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Score distribution */}
          <div style={{ padding:"0 18px 16px" }}>
            <div style={{ fontSize:10, color:cs.muted, fontWeight:600, marginBottom:10,
              textTransform:"uppercase", letterSpacing:".07em" }}>
              {isAr?"توزيع النتائج":"Score Distribution"}
            </div>
            <div style={{ display:"flex", gap:0, borderRadius:8, overflow:"hidden", height:8, marginBottom:8 }}>
              {dist.ex>0&&<div style={{ flex:dist.ex, background:"#10b981" }}/>}
              {dist.gd>0&&<div style={{ flex:dist.gd, background:"#f59e0b" }}/>}
              {dist.pr>0&&<div style={{ flex:dist.pr, background:"#ef4444" }}/>}
            </div>
            <div style={{ display:"flex", gap:16 }}>
              {[
                { label:isAr?"ممتاز (80+)":"Excellent (80+)", val:dist.ex, col:"#10b981" },
                { label:isAr?"جيد (60-79)":"Good (60-79)", val:dist.gd, col:"#f59e0b" },
                { label:isAr?"ضعيف (<60)":"Poor (<60)", val:dist.pr, col:"#ef4444" },
              ].map((d,i)=>(
                <div key={i} style={{ display:"flex", alignItems:"center", gap:5 }}>
                  <div style={{ width:8, height:8, borderRadius:2, background:d.col, flexShrink:0 }}/>
                  <span style={{ fontSize:10, color:cs.muted }}>{d.label}</span>
                  <span style={{ fontSize:10, fontWeight:700, color:d.col }}>{d.val}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// INDIVIDUAL DASHBOARD
// ══════════════════════════════════════════════════════════════════
function DashIndividual({ user, profile, userSessions, setUserSessions, tier, cs, isAr, setPage, startCamera,
  onCoach, onBilling, onAnalytics, onCalib, onReports, onCompare, onTrend, addToast,
  setShowGamification, setShowGrowthHub, setShowSecurityCenter, setShowAIInsights,
  setShowPredictiveAI, setShowCustomerSuccess, setShowChurnPrediction,
  setShowAPIMarketplace, setShowWhiteLabel, setShowMultiTenant, setShowAuditSystem,
  setShowDashboard, setShowCoach, setShowCalibWizard, setShowBilling,
  setShowAIReports, setShowSessionComparison, setShowTrendChart,
  isAdmin, isHRAdmin = false, getAllUsers, setAllUsers, setShowWorkforceAnalytics,
  setShowMRR, setShowChangelog, setShowNotificationsHub, setShowEnterpriseRBAC, setShowCertModal,
  onDevPortal, onInsurance }) {

  const last   = userSessions[0]?.avg_score||0;
  const avg    = profile?.avg_score || (userSessions.length ? Math.round(userSessions.reduce((a,s)=>a+(s.avg_score||0),0)/userSessions.length) : 0);
  const month  = userSessions.filter(s=>{ const d=s.created_at?.toDate?.()??new Date(s.created_at||0); const n=new Date(); return d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear(); }).length;
  const streak = profile?.streak_days||0;
  const pro    = isPro(tier);
  const elite  = isElite(tier);
  const isFreeTier = !pro && !elite;
  const [showDemoSession, setShowDemoSession] = useState(false);
  const [teaserDismissed, setTeaserDismissed] = useState(false);
  // The client-computed `month` above (filtering userSessions by date) can
  // drift from the actual enforcement counter: /api/session/start counts
  // against a server-side Redis key, incremented independently of whether
  // the session doc later saved successfully to Firestore. Fetch the real
  // number so the bar can never show "3 of 5" while the user is actually
  // already blocked at 5/5 (or vice versa). Falls back to the client count
  // instantly (no loading flash) and swaps in the authoritative number
  // once it arrives.
  const [realMonthUsage, setRealMonthUsage] = useState(null);
  useEffect(() => {
    if (!isFreeTier) return;
    let cancelled = false;
    BillingAPI.usage().then(res => {
      const n = res?.usage?.sessions_this_month;
      if (!cancelled && typeof n === "number") setRealMonthUsage(n);
    }).catch(() => {}); // fail quiet — client-computed count is still shown
    return () => { cancelled = true; };
  }, [isFreeTier, userSessions.length]);
  // Upgrade teaser: Free-tier only, shown once right after the user's
  // first-ever real session, dismissed permanently via profile flag.
  const showTeaser = isFreeTier && userSessions.length===1 && !profile?.upgrade_teaser_seen && !teaserDismissed;

  const grade = s => s>=80?(isAr?"ممتاز":"Excellent"):s>=60?(isAr?"جيد":"Good"):s>0?(isAr?"ضعيف":"Poor"):"—";
  const gradeColor = s => s>=80?"#10b981":s>=60?"#f59e0b":"#ef4444";

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

      {isFreeTier && userSessions.length===1 && (
        <FirstSessionBadge isAr={isAr} cs={cs}/>
      )}

      {/* Hero card */}
      <div style={{ background:cs.card, border:`1px solid ${cs.border}`, borderRadius:14,
        padding:"22px", display:"flex", gap:20, alignItems:"center", flexWrap:"wrap" }}>
        {/* BUG FIX: Ring alone never shows the actual number — it's a pure
            SVG arc with no text. The one other place Ring is used in this
            app (App.jsx live-session view) always pairs it with an adjacent
            number; these two HomePage hero cards were missing that, so the
            main "at a glance" gauge showed a colored arc with no indication
            of what score it represented. */}
        <div style={{ position:"relative", width:104, height:104, flexShrink:0 }}>
          <Ring score={last||avg} size={104}/>
          <div style={{ position:"absolute", inset:0, display:"flex",
            flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
            <div style={{ fontSize:26, fontWeight:900, color:(last||avg)?gradeColor(last||avg):cs.muted, lineHeight:1 }}>
              {(last||avg) || "—"}
            </div>
            {(last||avg) > 0 && <div style={{ fontSize:9, color:cs.muted, fontWeight:600 }}>/100</div>}
          </div>
        </div>
        <div style={{ flex:1, minWidth:180 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
            <Avatar name={profile?.name||profile?.email} photo={profile?.photoURL} size={36}/>
            <div>
              <div style={{ fontSize:18, fontWeight:800, color:cs.text, lineHeight:1.1 }}>
                {isAr?`أهلاً, ${profile?.name?.split(" ")[0] || user?.displayName?.split(" ")[0] || profile?.email?.split("@")[0] || ""}!`:`Hey, ${profile?.name?.split(" ")[0] || user?.displayName?.split(" ")[0] || profile?.email?.split("@")[0] || "there"}!`}
              </div>
              <div style={{ display:"flex", gap:6, alignItems:"center", marginTop:3 }}>
                <TierBadge tier={tier}/>
                {streak>0&&<span style={{ fontSize:10, color:"#f59e0b", fontWeight:600 }}>🔥 {streak}d</span>}
              </div>
            </div>
          </div>
          <div style={{ fontSize:13, color:cs.muted, marginBottom:14, lineHeight:1.5 }}>
            {userSessions.length===0
              ? (isAr?"ابدأ جلستك الأولى لتتبع وضعيتك":"Start your first session to track your posture")
              : last>=80 ? `💪 ${isAr?"وضعيتك ممتازة — استمر!":"Great posture — keep it up!"}`
              : last>=60 ? `📈 ${isAr?"وضعيتك جيدة، في تحسن":"Decent posture, improving!"}`
              : `⚠️ ${isAr?"وضعيتك تحتاج انتباه":"Posture needs attention"}`}
          </div>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            <button onClick={()=>{setPage("live");setTimeout(()=>startCamera?.(),200)}}
              style={{ padding:"10px 22px", background:"linear-gradient(135deg,#1a56db,#0891b2)",
                color:"#fff", border:"none", borderRadius:8, fontSize:13, fontWeight:700,
                cursor:"pointer", boxShadow:"0 4px 14px rgba(26,86,219,.4)" }}>
              {isAr?"▶ ابدأ جلسة":"▶ Start Session"}
            </button>
            {userSessions.length===0 && (
              <button onClick={()=>setShowDemoSession(true)}
                style={{ padding:"10px 18px", background:"rgba(148,163,184,.08)",
                  border:`1px solid ${cs.border}`, color:cs.text, borderRadius:8, fontSize:13, fontWeight:600,
                  cursor:"pointer" }}>
                {isAr?"👀 شاهد جلسة تجريبية":"👀 Watch a Demo Session"}
              </button>
            )}
          </div>
        </div>
      </div>

      {tierAtLeast(tier,"basic") && <PainRiskCard sessions={userSessions} cs={cs} isAr={isAr} />}

      {showTeaser && createPortal(
        <UpgradeTeaser isAr={isAr}
          onUpgrade={onBilling}
          onDismiss={()=>{
            setTeaserDismissed(true);
            if (user?.uid) updateUserProfile(user.uid,{upgrade_teaser_seen:true}).catch(()=>{});
          }}/>
      , document.body)}

      {isFreeTier && (
        <SessionUsageBar used={realMonthUsage ?? month} limit={FREE_MONTHLY_SESSION_LIMIT} isAr={isAr} cs={cs} onUpgrade={onBilling}/>
      )}

      {isFreeTier && (
        <PainAreaSelfReport isAr={isAr} cs={cs} initial={profile?.pain_area||null}
          onSave={(areaId)=>{ if (user?.uid) updateUserProfile(user.uid,{pain_area:areaId}).catch(()=>{}); }}/>
      )}

      {pro && (
        <>
          <StressCheckIn isAr={isAr} cs={cs}/>
          <StressCorrelationCard isAr={isAr} cs={cs}/>
        </>
      )}

      {showDemoSession && createPortal(
        <DemoSessionModal isAr={isAr} cs={cs}
          onClose={()=>setShowDemoSession(false)}
          onStartReal={()=>{ setShowDemoSession(false); setPage("live"); setTimeout(()=>startCamera?.(),200); }}/>
      , document.body)}

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))", gap:10 }}>
        <StatCard label={isAr?"آخر جلسة":"Last Session"} value={last||"—"} color={gradeColor(last)} cs={cs}/>
        <StatCard label={isAr?"المتوسط":"Average"} value={avg||"—"} color="#3b82f6" cs={cs}/>
        <StatCard label={isAr?"هذا الشهر":"This Month"} value={month||"—"} sub={isAr?"جلسة":"sessions"} color="#f59e0b" cs={cs}/>
        <StatCard label={isAr?"الإجمالي":"Total"} value={(profile?.sessions_count ?? userSessions.length)||"—"} sub={isAr?"جلسة":"sessions"} color="#a855f7" cs={cs}/>
      </div>

      {/* Week chart */}
      {userSessions.length>0&&(
        <div style={{ background:cs.card, border:`1px solid ${cs.border}`, borderRadius:12, padding:"16px 18px" }}>
          <SectionHead title={isAr?"آخر 7 أيام":"Last 7 days"} cs={cs}/>
          <WeekChart sessions={userSessions} cs={cs}/>
        </div>
      )}

      {/* Calibrate — always visible quick action */}
      <div style={{ background:cs.card, border:`1px solid ${cs.border}`, borderRadius:12,
        padding:"16px 18px", display:"flex", alignItems:"center", gap:16 }}>
        <div style={{ width:46, height:46, borderRadius:10, flexShrink:0,
          background:"rgba(16,185,129,.12)", display:"flex", alignItems:"center",
          justifyContent:"center", fontSize:22 }}>🎯</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:14, fontWeight:700, color:cs.text }}>
            {isAr?"معايرة الكاميرا":"Camera Calibration"}
          </div>
          <div style={{ fontSize:12, color:cs.muted, marginTop:2 }}>
            {isAr?"اضبط موضع الكاميرا للحصول على دقة أعلى":"Align your camera for accurate posture tracking"}
          </div>
        </div>
        <button onClick={()=>setShowCalibWizard(true)}
          style={{ padding:"8px 16px", background:"rgba(16,185,129,.15)",
            border:"1px solid rgba(16,185,129,.3)", borderRadius:8,
            color:"#10b981", fontSize:12, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>
          {isAr?"ابدأ المعايرة":"Calibrate"}
        </button>
      </div>

      {/* Analytics section — inline rich view */}
      <AnalyticsInline
        userSessions={userSessions} profile={profile} cs={cs} isAr={isAr} tier={tier}
        onOpenFull={()=>{getUserSessions(user.uid).then(setUserSessions);setShowDashboard(true);}}
        onCompare={userSessions.length>=2?()=>{getUserSessions(user.uid).then(setUserSessions);setShowSessionComparison(true);}:null}
        onTrend={userSessions.length>=3?()=>{getUserSessions(user.uid).then(setUserSessions);setShowTrendChart(true);}:null}
      />

      {/* Basic Plan extras — streak freeze, habit score, WhatsApp reminder
          (daily check-in / weekly challenge / pain prediction render
          elsewhere on this page as the AI-backed, server-verified versions) */}
      {/* Corvus Certificate Badge card */}
      <div style={{ background:cs.card, border:profile?.has_cert?"1px solid rgba(245,158,11,.3)":"1px dashed rgba(245,158,11,.25)",
        borderRadius:14, padding:"16px 20px", display:"flex", alignItems:"center", gap:14 }}>
        <span style={{fontSize:26}}>🏅</span>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:700,color:cs.text}}>
            {isAr?"شهادة إرجونوميكس Corvus":"Corvus Ergonomist Certificate"}
          </div>
          <div style={{fontSize:11,color:cs.muted,marginTop:2}}>
            {profile?.has_cert
              ?(isAr?"✅ شهادتك صالحة · "+profile.cert_id:"✅ Valid · "+profile.cert_id)
              :(isAr?"أثبت بيئة عملك الصحية على LinkedIn · ١٥٠ جنيه مرة واحدة":"Prove healthy workspace on LinkedIn · 150 EGP one-time")}
          </div>
        </div>
        <button onClick={()=>setShowCertModal?.(true)}
          style={{padding:"8px 16px",background:"linear-gradient(135deg,#f59e0b,#d97706)",
            border:"none",borderRadius:9,color:"#fff",fontSize:12,fontWeight:700,
            cursor:"pointer",flexShrink:0,whiteSpace:"nowrap"}}>
          {profile?.has_cert?(isAr?"تحميل":"Download"):(isAr?"احصل عليها":"Get Badge")}
        </button>
      </div>

      {/* Developer API + Insurance Partnership entry cards */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <div style={{ background:cs.card, border:"1px dashed rgba(26,86,219,.3)",
          borderRadius:14, padding:"14px 16px", display:"flex", flexDirection:"column", gap:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{fontSize:18}}>⚡</span>
            <div style={{fontSize:12,fontWeight:700,color:cs.text}}>Posture API</div>
          </div>
          <div style={{fontSize:10.5,color:cs.muted,lineHeight:1.5}}>
            {isAr?"ادمج تحليل الوضعية في أي تطبيق":"Integrate posture analysis into any app"}
          </div>
          <button onClick={()=>onDevPortal?.()}
            style={{padding:"7px 0",background:"rgba(26,86,219,.12)",border:"1px solid rgba(26,86,219,.25)",
              borderRadius:8,color:"#60a5fa",fontSize:11,fontWeight:700,cursor:"pointer",marginTop:"auto"}}>
            {isAr?"عرض التوثيق":"View Docs"}
          </button>
        </div>
        <div style={{ background:cs.card, border:"1px dashed rgba(16,185,129,.25)",
          borderRadius:14, padding:"14px 16px", display:"flex", flexDirection:"column", gap:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{fontSize:18}}>🤝</span>
            <div style={{fontSize:12,fontWeight:700,color:cs.text}}>
              {isAr?"خصم التأمين":"Insurance Discount"}
            </div>
          </div>
          <div style={{fontSize:10.5,color:cs.muted,lineHeight:1.5}}>
            {isAr?"وضعيتك الجيدة = خصم في تأمينك الصحي":"Good posture = health insurance discount"}
          </div>
          <button onClick={()=>onInsurance?.()}
            style={{padding:"7px 0",background:"rgba(16,185,129,.1)",border:"1px solid rgba(16,185,129,.25)",
              borderRadius:8,color:"#10b981",fontSize:11,fontWeight:700,cursor:"pointer",marginTop:"auto"}}>
            {isAr?"اعرف أكتر":"Learn More"}
          </button>
        </div>
      </div>

      <BasicDashboard
        profile={profile}
        userSessions={userSessions}
        cs={cs}
        isAr={isAr}
        addToast={addToast}
      />

      {/* Session history */}
      {userSessions.length>0 ? (
        <div style={{ background:cs.card, border:`1px solid ${cs.border}`, borderRadius:12, padding:"16px 18px" }}>
          <SectionHead title={isAr?"آخر الجلسات":"Recent Sessions"} cs={cs}/>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {userSessions.slice(0,6).map((s,i)=>{
              const d=s.created_at?.toDate?.()??new Date(s.created_at||0);
              const sc=s.avg_score||0;
              const col=gradeColor(sc);
              const dur=s.duration_sec?`${Math.round(s.duration_sec/60)}m`:"";
              return (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:12,
                  padding:"10px 12px", background:cs.inp,
                  borderRadius:8, border:`1px solid ${cs.border}` }}>
                  <div style={{ width:38, height:38, borderRadius:8, flexShrink:0,
                    background:`${col}18`, display:"flex", alignItems:"center",
                    justifyContent:"center", fontSize:16, fontWeight:800, color:col }}>{sc||"—"}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:cs.text }}>
                      {isAr?`جلسة #${s.session_number||(userSessions.length-i)}`:`Session #${s.session_number||(userSessions.length-i)}`}
                    </div>
                    <div style={{ fontSize:11, color:cs.muted }}>
                      {d.toLocaleDateString(isAr?"ar-EG":"en-US",{weekday:"short",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}
                      {dur&&<span> · {dur}</span>}
                    </div>
                  </div>
                  <span style={{ fontSize:11, fontWeight:600, padding:"3px 9px", borderRadius:99,
                    background:`${col}15`, color:col }}>{grade(sc)}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <EmptyBlock icon="🎯" cs={cs}
          title={isAr?"لا توجد جلسات":"No sessions yet"}
          desc={isAr?"اضغط ابدأ جلسة وتأكد من السماح للكاميرا":"Click Start Session and allow camera access"}
          action={isAr?"ابدأ الآن":"Start Now"}
          onAction={()=>{setPage("live");setTimeout(()=>startCamera?.(),200)}}/>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// EMPLOYEE DASHBOARD
// ══════════════════════════════════════════════════════════════════
function DashEmployee({ user, profile, userSessions, allUsers, cs, isAr, setPage, startCamera, onCoach, addToast, tier, tab }) {
  const last    = userSessions[0]?.avg_score || 0;
  const avg     = profile?.avg_score || (userSessions.length ? Math.round(userSessions.reduce((a,s)=>a+(s.avg_score||0),0)/userSessions.length) : 0);
  const streak  = profile?.streak_days || 0;
  const gradeColor = s => s>=80?"#10b981":s>=60?"#f59e0b":"#ef4444";

  // All hooks at top level — no conditional hook calls
  const [deptFilter, setDeptFilter] = useState("all");

  const rank = useMemo(()=>{
    if(!allUsers?.length) return null;
    const sorted=[...allUsers].sort((a,b)=>(b.avg_score||0)-(a.avg_score||0));
    const i=sorted.findIndex(u=>u.uid===profile?.uid||u.id===profile?.uid);
    return i>=0?{pos:i+1,total:sorted.length}:null;
  },[allUsers,profile]);

  // ── AI Coach tab ────────────────────────────────────────────────
  if(tab==="coach"){
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        <div style={{ background:cs.card, border:`1px solid ${cs.border}`, borderRadius:14, padding:"24px",
          background:"linear-gradient(135deg,rgba(99,102,241,.1),rgba(8,145,178,.06))" }}>
          <div style={{ fontSize:28, marginBottom:8 }}>🤖</div>
          <div style={{ fontSize:20, fontWeight:800, color:cs.text, marginBottom:4 }}>
            {isAr?"مدرب AI — د. كورفوس":"AI Coach — Dr. Corvus"}
          </div>
          <div style={{ fontSize:13, color:cs.muted, marginBottom:18 }}>
            {isAr?"اسألني عن وضعيتك، ألمك، أو احصل على تمارين مخصصة لبياناتك"
                 :"Ask me about your posture, pain, or get personalised stretches based on your data"}
          </div>
          <button onClick={()=>onCoach?.()}
            style={{ padding:"12px 28px", background:"linear-gradient(135deg,#6366f1,#4f7cf9)",
              color:"#fff", border:"none", borderRadius:10, fontSize:14, fontWeight:700, cursor:"pointer",
              boxShadow:"0 4px 16px rgba(99,102,241,.4)" }}>
            {isAr?"🤖 افتح مدرب AI":"🤖 Open AI Coach"}
          </button>
        </div>
        {/* coach tips */}
        <div style={{ background:cs.card, border:`1px solid ${cs.border}`, borderRadius:12, padding:"18px 20px" }}>
          <div style={{ fontSize:13, fontWeight:700, color:cs.text, marginBottom:12 }}>
            {isAr?"أسئلة مقترحة لتبدأ بها":"Suggested questions to get started"}
          </div>
          {[
            isAr?"ليه وضعيتي بتنخفض في آخر الأسبوع؟":"Why does my posture drop at end of week?",
            isAr?"اعملي برنامج تمارين لرقبتي":"Make me a neck stretch programme",
            isAr?"قارن درجتي مع الشهر اللي فات":"Compare my score to last month",
            isAr?"ايه أكتر وضعية بتأثر عليا؟":"What posture issue affects me most?",
          ].map((q,i)=>(
            <button key={i} onClick={()=>onCoach?.(q)}
              style={{ display:"block", width:"100%", textAlign:isAr?"right":"left",
                padding:"10px 14px", marginBottom:6, background:"rgba(99,102,241,.08)",
                border:"1px solid rgba(99,102,241,.2)", borderRadius:9,
                color:"#818cf8", fontSize:12.5, cursor:"pointer" }}>
              {q}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Team tab ─────────────────────────────────────────────────────
  if(tab==="team"){
    const teamSorted=[...( allUsers||[])].sort((a,b)=>(b.avg_score||0)-(a.avg_score||0));
    const myRankIdx=teamSorted.findIndex(u=>u.uid===profile?.uid||u.id===profile?.uid);
    const teamAvg=teamSorted.length?Math.round(teamSorted.reduce((a,u)=>a+(u.avg_score||0),0)/teamSorted.length):0;
    const depts=[...new Set(teamSorted.map(u=>u.department||"").filter(Boolean))];
    const filtered=deptFilter==="all"?teamSorted:teamSorted.filter(u=>u.department===deptFilter);
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        {/* My rank hero */}
        <div style={{ background:"linear-gradient(135deg,rgba(59,130,246,.1),rgba(8,145,178,.06))",
          border:"1px solid rgba(59,130,246,.25)", borderRadius:14, padding:"20px 22px",
          display:"flex", alignItems:"center", gap:18, flexWrap:"wrap" }}>
          <div style={{ textAlign:"center", minWidth:80 }}>
            <div style={{ fontSize:36, fontWeight:900, color:"#f59e0b", lineHeight:1 }}>
              {myRankIdx>=0?`#${myRankIdx+1}`:"—"}
            </div>
            <div style={{ fontSize:11, color:cs.muted, marginTop:2 }}>
              {isAr?`من ${teamSorted.length}`:`of ${teamSorted.length}`}
            </div>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:700, color:cs.text }}>
              {isAr?"ترتيبك في الفريق":"Your team rank"}
            </div>
            <div style={{ fontSize:12, color:cs.muted, marginTop:3 }}>
              {isAr?`متوسط الفريق: ${teamAvg}/100`:`Team average: ${teamAvg}/100`}
            </div>
            <div style={{ marginTop:8, height:6, borderRadius:99, background:cs.inp, position:"relative", maxWidth:220 }}>
              <div style={{ height:6, borderRadius:99, background:gradeColor(avg), width:`${avg}%`, maxWidth:"100%" }}/>
            </div>
            <div style={{ fontSize:11, color:cs.muted, marginTop:3 }}>
              {isAr?`درجتك: ${avg}/100`:`Your score: ${avg}/100`}
              {avg>teamAvg
                ?<span style={{ color:"#10b981", marginInlineStart:6 }}>↑ {isAr?"فوق المتوسط":"above avg"}</span>
                :<span style={{ color:"#f59e0b", marginInlineStart:6 }}>↓ {isAr?"تحت المتوسط":"below avg"}</span>}
            </div>
          </div>
        </div>

        {/* Dept filter */}
        {depts.length>1&&(
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {["all",...depts].map(d=>(
              <button key={d} onClick={()=>setDeptFilter(d)}
                style={{ padding:"5px 13px", borderRadius:99, fontSize:12, fontWeight:600,
                  background:deptFilter===d?"#1a56db":cs.inp,
                  border:`1px solid ${deptFilter===d?"#1a56db":cs.border}`,
                  color:deptFilter===d?"#fff":cs.muted, cursor:"pointer" }}>
                {d==="all"?(isAr?"الكل":"All"):d}
              </button>
            ))}
          </div>
        )}

        {/* Full leaderboard */}
        <div style={{ background:cs.card, border:`1px solid ${cs.border}`, borderRadius:12, padding:"16px 18px" }}>
          <div style={{ fontSize:14, fontWeight:700, color:cs.text, marginBottom:12 }}>
            {isAr?"لوحة الفريق":"Team Leaderboard"} · <span style={{ color:cs.muted, fontWeight:400, fontSize:12 }}>{filtered.length} {isAr?"عضو":"members"}</span>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {filtered.map((u,i)=>{
              const isMe=u.uid===profile?.uid||u.id===profile?.uid;
              const sc=u.avg_score||0;
              const col=gradeColor(sc);
              const realIdx=teamSorted.findIndex(x=>x.uid===u.uid||x.id===u.id);
              return (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:10,
                  padding:"10px 12px", borderRadius:9,
                  background:isMe?"rgba(59,130,246,.1)":cs.inp,
                  border:`1px solid ${isMe?"rgba(59,130,246,.35)":cs.border}` }}>
                  <div style={{ width:26, textAlign:"center", fontSize:13, color:cs.muted, fontWeight:700, flexShrink:0 }}>
                    {realIdx===0?"🥇":realIdx===1?"🥈":realIdx===2?"🥉":`#${realIdx+1}`}
                  </div>
                  <Avatar name={u.name||u.email} photo={u.photoURL} size={30}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:isMe?700:500,
                      color:isMe?"#60a5fa":cs.text,
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {u.name||u.email?.split("@")[0]}
                      {isMe&&<span style={{ marginInlineStart:6, fontSize:10, color:"#60a5fa", fontWeight:600 }}>{isAr?"(أنت)":"(you)"}</span>}
                    </div>
                    {u.department&&<div style={{ fontSize:10, color:cs.muted }}>{u.department}</div>}
                  </div>
                  <div style={{ textAlign:"center", minWidth:44 }}>
                    <div style={{ fontSize:18, fontWeight:800, color:col, lineHeight:1 }}>{sc||"—"}</div>
                    <div style={{ fontSize:9, color:cs.muted }}>/100</div>
                  </div>
                </div>
              );
            })}
            {filtered.length===0&&(
              <div style={{ padding:"30px", textAlign:"center", color:cs.muted, fontSize:13 }}>
                {isAr?"لا يوجد أعضاء في هذا القسم":"No members in this department"}
              </div>
            )}
          </div>
        </div>

        {/* Dist: healthy / ok / at-risk */}
        {teamSorted.length>0&&(()=>{
          const healthy=teamSorted.filter(u=>u.avg_score>=80).length;
          const ok=teamSorted.filter(u=>u.avg_score>=60&&u.avg_score<80).length;
          const atRisk=teamSorted.filter(u=>u.avg_score>0&&u.avg_score<60).length;
          return (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
              {[[isAr?"ممتاز":"Excellent",healthy,"#10b981"],[isAr?"جيد":"Good",ok,"#f59e0b"],[isAr?"خطر":"At Risk",atRisk,"#ef4444"]].map(([l,v,c])=>(
                <div key={l} style={{ background:cs.card, border:`1px solid ${cs.border}`, borderRadius:10, padding:"14px", textAlign:"center" }}>
                  <div style={{ fontSize:22, fontWeight:800, color:c }}>{v}</div>
                  <div style={{ fontSize:11, color:cs.muted, marginTop:2 }}>{l}</div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    );
  }

  // ── Home tab (default) ───────────────────────────────────────────
  const greetTime=()=>{
    const h=new Date().getHours();
    if(isAr) return h<12?"صباح الخير":h<17?"مساء الخير":"مساء النور";
    return h<12?"Good morning":h<17?"Good afternoon":"Good evening";
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>

      {/* ── Hero ── */}
      <div style={{ background:"linear-gradient(135deg,rgba(26,86,219,.08),rgba(8,145,178,.04))",
        border:"1px solid rgba(59,130,246,.18)", borderRadius:16, padding:"22px 24px" }}>
        <div style={{ display:"flex", alignItems:"flex-start", gap:14, flexWrap:"wrap" }}>
          <div style={{ position:"relative", width:80, height:80, flexShrink:0 }}>
            <Ring score={last||avg} size={80}/>
            <div style={{ position:"absolute", inset:0, display:"flex",
              flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
              <div style={{ fontSize:20, fontWeight:900, color:(last||avg)?gradeColor(last||avg):cs.muted, lineHeight:1 }}>
                {(last||avg)||"—"}
              </div>
              {(last||avg)>0&&<div style={{ fontSize:8, color:cs.muted, fontWeight:600 }}>/100</div>}
            </div>
          </div>

          <div style={{ flex:1, minWidth:160 }}>
            <div style={{ fontSize:11, color:"#60a5fa", fontWeight:600, marginBottom:3, textTransform:"uppercase", letterSpacing:".05em" }}>
              {greetTime()}
            </div>
            <div style={{ fontSize:20, fontWeight:800, color:cs.text, lineHeight:1.2, marginBottom:4 }}>
              {profile?.name?.split(" ")[0] || user?.displayName?.split(" ")[0] || (isAr?"مرحباً":"Welcome")}
            </div>
            <div style={{ fontSize:12, color:cs.muted, marginBottom:2 }}>
              {profile?.department&&<span style={{ color:"#60a5fa", fontWeight:500 }}>{profile.department} · </span>}
              {profile?.company||(isAr?"موظف":"Employee")}
            </div>
            <div style={{ fontSize:12.5, color: last>=80?"#10b981":last>=60?"#f59e0b":"#8896ac", marginBottom:14, marginTop:4 }}>
              {last>=80?`💪 ${isAr?"وضعيتك ممتازة اليوم":"Excellent posture today"}`
              :last>=60?`📈 ${isAr?"وضعيتك تتحسن":"Your posture is improving"}`
              :last>0?`⚠️ ${isAr?"وضعيتك تحتاج اهتمام":"Your posture needs attention"}`
              :`👋 ${isAr?"ابدأ جلستك الأولى اليوم":"Start your first session today"}`}
            </div>

            {/* Quick actions */}
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              <button onClick={()=>{setPage("live");setTimeout(()=>startCamera?.(),200)}}
                style={{ padding:"9px 18px", background:"linear-gradient(135deg,#1a56db,#0891b2)",
                  color:"#fff", border:"none", borderRadius:8, fontSize:12.5, fontWeight:700, cursor:"pointer" }}>
                ▶ {isAr?"ابدأ جلسة":"Start Session"}
              </button>
              <button onClick={()=>onCoach?.()}
                style={{ padding:"9px 16px", background:"rgba(99,102,241,.12)",
                  border:"1px solid rgba(99,102,241,.3)", borderRadius:8,
                  color:"#818cf8", fontSize:12.5, fontWeight:600, cursor:"pointer" }}>
                🤖 {isAr?"اسأل المدرب":"Ask Coach"}
              </button>
            </div>
          </div>

          {/* Rank badge */}
          {rank&&(
            <div style={{ background:"rgba(245,158,11,.08)", border:"1px solid rgba(245,158,11,.25)",
              borderRadius:12, padding:"12px 16px", textAlign:"center", flexShrink:0 }}>
              <div style={{ fontSize:22, fontWeight:900, color:"#f59e0b" }}>#{rank.pos}</div>
              <div style={{ fontSize:10, color:cs.muted }}>{isAr?`من ${rank.total}`:`of ${rank.total}`}</div>
              <div style={{ fontSize:9.5, color:"#f59e0b", marginTop:2 }}>{isAr?"ترتيبك":"Team rank"}</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Stats row ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(90px,1fr))", gap:10 }}>
        {[
          { label:isAr?"متوسطك":"Avg Score",  value:avg||"—",                                     color:"#3b82f6"  },
          { label:isAr?"السلسلة":"Streak",     value:streak?`${streak}🔥`:"—",                   color:"#10b981"  },
          { label:isAr?"الجلسات":"Sessions",  value:profile?.sessions_count||userSessions.length||"—", color:"#a855f7" },
          { label:isAr?"آخر جلسة":"Last",     value:last||"—",                                    color:last?gradeColor(last):"#8896ac" },
        ].map(c=>(
          <div key={c.label} style={{ background:cs.card, border:`1px solid ${cs.border}`, borderRadius:10, padding:"12px 14px", textAlign:"center" }}>
            <div style={{ fontSize:20, fontWeight:800, color:c.color }}>{c.value}</div>
            <div style={{ fontSize:10.5, color:cs.muted, marginTop:2 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* ── Pain risk card (Basic+) ── */}
      {/* Was tierAtLeast(profile?.tier,...) — raw Firestore tier field,
          not the effective (trial-aware) tier this component already
          receives as its own `tier` prop, and every other tier check in
          DashEmployee already correctly uses. The sibling DashIndividual
          component's identical PainRiskCard gate already uses `tier` —
          this was the one outlier. */}
      {tierAtLeast(tier,"basic")&&<PainRiskCard sessions={userSessions} cs={cs} isAr={isAr}/>}

      {/* ── BasicDashboard: habit score + streak freeze + whatsapp (Basic+) ── */}
      {tierAtLeast(tier,"basic")&&(
        <BasicDashboard profile={profile} userSessions={userSessions} cs={cs} isAr={isAr} addToast={addToast} tier={tier}/>
      )}

      {/* ── 7-day chart ── */}
      {userSessions.length>0&&(
        <div style={{ background:cs.card, border:`1px solid ${cs.border}`, borderRadius:12, padding:"16px 18px" }}>
          <div style={{ fontSize:13, fontWeight:700, color:cs.text, marginBottom:10 }}>
            {isAr?"آخر 7 أيام":"Last 7 days"}
          </div>
          <WeekChart sessions={userSessions} cs={cs}/>
        </div>
      )}

      {/* ── Recent sessions (last 4) ── */}
      {userSessions.length>0&&(
        <div style={{ background:cs.card, border:`1px solid ${cs.border}`, borderRadius:12, padding:"16px 18px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <div style={{ fontSize:13, fontWeight:700, color:cs.text }}>{isAr?"آخر الجلسات":"Recent Sessions"}</div>
            <button onClick={()=>{/* setTab("sessions") handled via sidebar */}}
              style={{ fontSize:11, color:"#60a5fa", background:"none", border:"none", cursor:"pointer", fontWeight:600 }}>
              {isAr?"عرض الكل ←":"View all →"}
            </button>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
            {userSessions.slice(0,4).map((s,i)=>{
              const d=s.created_at?.toDate?.()??new Date(s.created_at||0);
              const sc=s.avg_score||0;
              const col=gradeColor(sc);
              const dur=s.duration_sec?`${Math.round(s.duration_sec/60)}m`:"";
              return (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:12,
                  padding:"9px 12px", background:cs.inp,
                  borderRadius:8, border:`1px solid ${cs.border}` }}>
                  <div style={{ width:36, height:36, borderRadius:8, flexShrink:0,
                    background:`${col}18`, display:"flex", alignItems:"center",
                    justifyContent:"center", fontSize:15, fontWeight:800, color:col }}>{sc||"—"}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12.5, fontWeight:600, color:cs.text }}>
                      {isAr?`جلسة #${s.session_number||(userSessions.length-i)}`:`Session #${s.session_number||(userSessions.length-i)}`}
                    </div>
                    <div style={{ fontSize:11, color:cs.muted }}>
                      {d.toLocaleDateString(isAr?"ar-EG":"en-US",{weekday:"short",month:"short",day:"numeric"})}
                      {dur&&<span> · {dur}</span>}
                    </div>
                  </div>
                  <div style={{ fontSize:10, color:sc>=80?"#10b981":sc>=60?"#f59e0b":"#ef4444",
                    fontWeight:600, background:sc>=80?"rgba(16,185,129,.1)":sc>=60?"rgba(245,158,11,.1)":"rgba(239,68,68,.1)",
                    padding:"3px 9px", borderRadius:99 }}>
                    {sc>=80?(isAr?"ممتاز":"Excellent"):sc>=60?(isAr?"جيد":"Good"):(isAr?"تحسّن":"Improve")}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Mini team leaderboard (home preview — top 5) ── */}
      {allUsers?.length>1&&(
        <div style={{ background:cs.card, border:`1px solid ${cs.border}`, borderRadius:12, padding:"16px 18px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <div style={{ fontSize:13, fontWeight:700, color:cs.text }}>{isAr?"الفريق":"Team"}</div>
            <span style={{ fontSize:11, color:cs.muted }}>{isAr?"أفضل 5":"Top 5"}</span>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {[...allUsers].sort((a,b)=>(b.avg_score||0)-(a.avg_score||0)).slice(0,5).map((u,i)=>{
              const isMe=u.uid===profile?.uid||u.id===profile?.uid;
              const sc=u.avg_score||0;
              return (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:9,
                  padding:"8px 11px", borderRadius:8,
                  background:isMe?"rgba(59,130,246,.08)":cs.inp,
                  border:`1px solid ${isMe?"rgba(59,130,246,.3)":cs.border}` }}>
                  <div style={{ width:20, textAlign:"center", fontSize:12, color:cs.muted, fontWeight:700, flexShrink:0 }}>
                    {i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`}
                  </div>
                  <Avatar name={u.name||u.email} photo={u.photoURL} size={26}/>
                  <div style={{ flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    <span style={{ fontSize:12.5, fontWeight:isMe?700:500, color:isMe?"#60a5fa":cs.text }}>
                      {u.name||u.email?.split("@")[0]}
                    </span>
                    {isMe&&<span style={{ marginInlineStart:5, fontSize:10, color:"#60a5fa" }}>{isAr?"(أنت)":"(you)"}</span>}
                  </div>
                  <div style={{ fontSize:16, fontWeight:800, color:gradeColor(sc), flexShrink:0 }}>{sc||"—"}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}


// ══════════════════════════════════════════════════════════════════
// HR ADMIN DASHBOARD
// ══════════════════════════════════════════════════════════════════
function DashHR({ profile, allUsers, cs, isAr, addToast, onBilling, onInvite,
  onAnalytics, onWorkforce, onReports, onQuarterlyReport, onDevPortal, onInsurance }) {
  const [search, setSearch]   = useState("");
  const [dept,   setDept]     = useState("all");
  const [sortBy, setSortBy]   = useState("score"); // score | name | sessions
  const users = allUsers||[];
  const depts = ["all",...new Set(users.map(u=>u.department||"").filter(Boolean))];

  const filtered = useMemo(()=>{
    let f=users.filter(u=>{
      const ms=!search||u.name?.toLowerCase().includes(search.toLowerCase())||u.email?.toLowerCase().includes(search.toLowerCase());
      const md=dept==="all"||(u.department||"")===dept;
      return ms&&md;
    });
    if(sortBy==="score")    f=[...f].sort((a,b)=>(b.avg_score||0)-(a.avg_score||0));
    if(sortBy==="name")     f=[...f].sort((a,b)=>(a.name||"").localeCompare(b.name||""));
    if(sortBy==="sessions") f=[...f].sort((a,b)=>(b.sessions_count||0)-(a.sessions_count||0));
    return f;
  },[users,search,dept,sortBy]);

  const avg     = users.length?Math.round(users.reduce((a,u)=>a+(u.avg_score||0),0)/users.length):0;
  const healthy = users.filter(u=>(u.avg_score||0)>=80).length;
  const atRisk  = users.filter(u=>(u.avg_score||0)>0&&(u.avg_score||0)<50).length;
  const active  = users.filter(u=>u.last_session_at).length;
  const gradeColor = s => s>=80?"#10b981":s>=60?"#f59e0b":s>0?"#ef4444":cs.muted;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      {/* Company header */}
      <div style={{ background:"linear-gradient(135deg,rgba(26,86,219,.1),rgba(8,145,178,.06))",
        border:"1px solid rgba(59,130,246,.2)", borderRadius:14, padding:"20px 22px",
        display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
        <Avatar name={profile?.company||profile?.name} size={48}/>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:11, color:"#60a5fa", fontWeight:600, textTransform:"uppercase",
            letterSpacing:".07em", marginBottom:3 }}>
            {isAr?"لوحة إدارة الشركة":"Company Admin Dashboard"}
          </div>
          <div style={{ fontSize:20, fontWeight:800, color:"#f0f6ff" }}>
            {profile?.company||(isAr?"شركتي":"My Company")}
          </div>
          <div style={{ fontSize:12, color:cs.muted, marginTop:2 }}>
            {users.length} {isAr?"موظف":"employees"} · <TierBadge tier={profile?.tier||"standard"}/>
          </div>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <button onClick={onInvite} style={{ padding:"9px 16px", background:"#1a56db", color:"#fff",
            border:"none", borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer" }}>
            {isAr?"+ دعوة موظفين":"+ Invite Employees"}
          </button>
          <button onClick={onBilling} style={{ padding:"9px 16px",
            background:cs.inp, color:cs.text,
            border:`1px solid ${cs.border}`, borderRadius:8, fontSize:12,
            fontWeight:600, cursor:"pointer" }}>
            {isAr?"الاشتراك":"Billing"}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))", gap:10 }}>
        <StatCard label={isAr?"متوسط الفريق":"Team Avg"} value={avg||"—"} color="#3b82f6" cs={cs}/>
        <StatCard label={isAr?"صحة ممتازة":"Healthy"} value={healthy}
          sub={`${users.length?Math.round(healthy/users.length*100):0}%`} color="#10b981" cs={cs}/>
        <StatCard label={isAr?"خطر عالي":"High Risk"} value={atRisk}
          color={atRisk>0?"#ef4444":"#10b981"} cs={cs}/>
        <StatCard label={isAr?"نشطون":"Active"} value={active}
          sub={`${users.length?Math.round(active/users.length*100):0}%`} color="#f59e0b" cs={cs}/>
      </div>

      {/* HR Tools */}
      <div>
        <SectionHead title={isAr?"أدوات الإدارة":"Management Tools"} cs={cs}/>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))", gap:10 }}>
          <ToolBtn icon="📊" label={isAr?"التحليلات":"Analytics"} color="8,145,178"
            desc={isAr?"إحصائيات الفريق":"Team stats"} onClick={onAnalytics} cs={cs}/>
          <ToolBtn icon="🏭" label={isAr?"قوى العمل":"Workforce"} color="124,58,237"
            desc={isAr?"إنتاجية وإرهاق":"Productivity"} onClick={onWorkforce} cs={cs}/>
          <ToolBtn icon="📋" label={isAr?"تقارير":"Reports"} color="16,185,129"
            desc={isAr?"PDF تنفيذي":"Executive PDF"} onClick={onReports} cs={cs}/>
          <ToolBtn icon="📈" label={isAr?"ربع سنوي":"Quarterly"} color="212,175,55"
            desc={isAr?"تقرير مؤسسي":"Wellness Report"} onClick={onQuarterlyReport} cs={cs}/>
          <ToolBtn icon="⚡" label="Posture API" color="26,86,219"
            desc={isAr?"للمطورين":"For developers"} onClick={onDevPortal} cs={cs}/>
          <ToolBtn icon="🤝" label={isAr?"تأمين":"Insurance"} color="16,185,129"
            desc={isAr?"خصم تأمين":"Partner discount"} onClick={onInsurance} cs={cs}/>
          <ToolBtn icon="🔔" label={isAr?"تنبيهات":"Alerts"} color="245,158,11"
            desc={isAr?`${atRisk} في خطر`:`${atRisk} at risk`}
            onClick={async()=>{
              const atRiskUsers = users.filter(u=>(u.avg_score||0)>0&&(u.avg_score||0)<50);
              if(!atRiskUsers.length){ addToast(isAr?"مفيش حد في خطر دلوقتي":"No one is currently at risk","info"); return; }
              const results = await Promise.allSettled(atRiskUsers.map(u =>
                dispatchNotification({
                  type: "posture_warning",
                  channels: ["in_app"],
                  payload: {
                    recipients: "uid",
                    uid: u.uid || u.id,
                    body: isAr
                      ? `درجة وضعيتك ${u.avg_score||0}/100 — محتاجة انتباه`
                      : `Your posture score is ${u.avg_score||0}/100 — worth a look`,
                    actions: [{ label: isAr?"عرض":"View", key:"view" }],
                  },
                })
              ));
              const sent = results.filter(r=>r.status==="fulfilled").length;
              const failed = results.length - sent;
              if(failed===0) addToast(isAr?`تم إرسال ${sent} تنبيه`:`Sent ${sent} alert${sent!==1?"s":""}`,"success");
              else addToast(isAr?`اتبعت ${sent} وفشل ${failed}`:`Sent ${sent}, ${failed} failed`, sent>0?"info":"error");
            }} cs={cs}/>
        </div>
      </div>

      {/* Risk alert */}
      {atRisk>0&&(
        <div style={{ background:"rgba(239,68,68,.06)", border:"1px solid rgba(239,68,68,.2)",
          borderRadius:12, padding:"14px 18px", display:"flex", gap:12, alignItems:"center" }}>
          <span style={{ fontSize:20 }}>⚠️</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#f87171" }}>
              {isAr?`${atRisk} موظف في خطر (وضعية < 50)`:`${atRisk} employees at risk (score < 50)`}
            </div>
            <div style={{ fontSize:11, color:cs.muted }}>
              {filtered.filter(u=>(u.avg_score||0)>0&&(u.avg_score||0)<50).map(u=>u.name||u.email?.split("@")[0]).join("، ")||""}
            </div>
          </div>
          <button onClick={()=>addToast(isAr?"تم إرسال تنبيهات":"Alerts sent ✓","success")}
            style={{ padding:"7px 14px", background:"#ef4444", color:"#fff", border:"none",
              borderRadius:7, fontSize:12, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>
            {isAr?"أرسل تنبيه":"Send Alert"}
          </button>
        </div>
      )}

      {/* Employee table */}
      <div style={{ background:cs.card, border:`1px solid ${cs.border}`, borderRadius:12, overflow:"hidden" }}>
        <div style={{ padding:"12px 16px", borderBottom:`1px solid ${cs.border}`,
          display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
          <div style={{ fontSize:13, fontWeight:700, color:cs.text, flex:1 }}>
            {isAr?"الموظفون":"Employees"} <span style={{ fontSize:11, color:cs.muted,fontWeight:400 }}>({filtered.length})</span>
          </div>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder={isAr?"بحث بالاسم أو الإيميل...":"Search by name or email..."}
            style={{ padding:"7px 11px", background:cs.inp,
              border:`1px solid ${cs.border}`, borderRadius:7, color:cs.text,
              fontSize:12, outline:"none", width:180 }}/>
          {depts.length>1&&(
            <select value={dept} onChange={e=>setDept(e.target.value)}
              style={{ padding:"7px 11px", background:cs.card, border:`1px solid ${cs.border}`,
                borderRadius:7, color:cs.text, fontSize:12, outline:"none" }}>
              {depts.map(d=><option key={d} value={d}>{d==="all"?(isAr?"كل الأقسام":"All Depts"):d}</option>)}
            </select>
          )}
          <select value={sortBy} onChange={e=>setSortBy(e.target.value)}
            style={{ padding:"7px 11px", background:cs.card, border:`1px solid ${cs.border}`,
              borderRadius:7, color:cs.text, fontSize:12, outline:"none" }}>
            <option value="score">{isAr?"ترتيب: النقاط":"Sort: Score"}</option>
            <option value="name">{isAr?"ترتيب: الاسم":"Sort: Name"}</option>
            <option value="sessions">{isAr?"ترتيب: الجلسات":"Sort: Sessions"}</option>
          </select>
        </div>
        <div style={{ maxHeight:420, overflowY:"auto" }}>
          {filtered.length===0 ? (
            <EmptyBlock icon="👥" cs={cs}
              title={isAr?"لا يوجد موظفون":"No employees yet"}
              desc={isAr?"أرسل دعوات للموظفين للبدء":"Invite your team to get started"}
              action={isAr?"دعوة الآن":"Invite Now"} onAction={onInvite}/>
          ) : filtered.map((u,i)=>{
            const sc=u.avg_score||0;
            const col=gradeColor(sc);
            const risk=sc>0&&sc<50;
            return (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:10,
                padding:"10px 16px", borderBottom:`1px solid ${cs.border}`,
                background:risk?"rgba(239,68,68,.03)":"transparent" }}>
                <Avatar name={u.name||u.email} photo={u.photoURL} size={32}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:cs.text,
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                    display:"flex", alignItems:"center", gap:6 }}>
                    {u.name||u.email?.split("@")[0]}
                    {risk&&<span style={{ fontSize:9, background:"#ef444420", color:"#ef4444",
                      padding:"1px 5px", borderRadius:4, fontWeight:700 }}>⚠ RISK</span>}
                  </div>
                  <div style={{ fontSize:10, color:cs.muted,
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {u.department||u.email||"—"}
                  </div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ fontSize:17, fontWeight:800, color:col }}>{sc||"—"}</div>
                  <div style={{ fontSize:9, color:cs.muted }}>{u.sessions_count||0} sess</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// SESSIONS PANEL
// ══════════════════════════════════════════════════════════════════
function PanelSessions({ userSessions, profile, cs, isAr, setPage, startCamera, onDownloadPDF, onDownloadClinicalPDF, onComparisonPDF, onTeamPDF, onLongitudinalPDF, onPostureDNA, onShareReport, onDeleteSession, onTrend, tier="standard", isHRAdmin=false }) {
  const [deleting, setDeleting] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(null);
  const [showWeeklyIntel, setShowWeeklyIntel] = useState(false);

  if(!userSessions.length) return <EmptyBlock icon="📋" cs={cs}
    title={isAr?"لا توجد جلسات":"No sessions yet"}
    desc={isAr?"ابدأ جلستك الأولى وستظهر هنا":"Start your first session and it will appear here"}
    action={isAr?"ابدأ جلسة":"Start Session"}
    onAction={()=>{setPage("live");setTimeout(()=>startCamera?.(),200)}}/>;

  const gradeColor = s => s>=80?"#10b981":s>=60?"#f59e0b":"#ef4444";
  const grade = (s,ar) => s>=80?(ar?"ممتاز":"Excellent"):s>=60?(ar?"جيد":"Good"):(ar?"ضعيف":"Poor");
  const totalSessions = profile?.sessions_count || userSessions.length;
  const avgScore  = profile?.avg_score || Math.round(userSessions.reduce((a,s)=>a+(s.avg_score||0),0)/userSessions.length);
  const bestScore = Math.max(...userSessions.map(s=>s.avg_score||0));
  const totalMins = Math.round(userSessions.reduce((a,s)=>a+(s.duration_s||s.duration_sec||0),0)/60);

  const normTier    = (tier||"standard").toLowerCase();
  const isProTier   = ["professional","elite"].includes(normTier);
  const isEliteTier = isElite(tier); // handles b2b_enterprise + trial tiers

  async function handlePDF(s, i, clinical=false) {
    if (!isProTier) { onDownloadPDF?.(null); return; } // triggers billing in App.jsx
    setPdfLoading((s.id||i)+(clinical?"_c":""));
    if (clinical) await onDownloadClinicalPDF?.(s);
    else          await onDownloadPDF?.(s);
    setPdfLoading(null);
  }

  async function handleDelete(s) {
    if(!window.confirm(isAr?"هل تريد حذف هذه الجلسة نهائياً؟":"Delete this session permanently?")) return;
    setDeleting(s.id);
    await onDeleteSession?.(s.id);
    setDeleting(null);
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {/* Summary stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
        {[
          { label:isAr?"الجلسات":"Sessions",   val:totalSessions,    col:"#a855f7" },
          { label:isAr?"المتوسط":"Avg Score",  val:avgScore||"—",    col:"#3b82f6" },
          { label:isAr?"الأفضل":"Best",         val:bestScore||"—",   col:"#10b981" },
          { label:isAr?"الدقائق":"Total Mins",  val:(totalMins||0)+"m", col:"#f59e0b" },
        ].map(m=>(
          <div key={m.label} style={{ background:cs.card, border:`1px solid ${cs.border}`,
            borderRadius:10, padding:"10px 12px", textAlign:"center" }}>
            <div style={{ fontSize:18, fontWeight:800, color:m.col }}>{m.val}</div>
            <div style={{ fontSize:10, color:cs.muted, marginTop:2 }}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* Action buttons row */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        {isProTier ? (
          <button onClick={()=>handlePDF(userSessions[0], totalSessions)}
            style={{ padding:"9px 14px",
              background: isEliteTier?"rgba(16,185,129,.12)":"rgba(26,86,219,.12)",
              border: `1px solid ${isEliteTier?"rgba(16,185,129,.3)":"rgba(26,86,219,.3)"}`,
              borderRadius:9,
              color: isEliteTier?"#6ee7b7":"#60a5fa",
              fontSize:12, fontWeight:600, cursor:"pointer",
              display:"flex", alignItems:"center", gap:6 }}>
            📄 {isEliteTier?(isAr?"تنزيل Elite PDF":"Download Elite PDF"):(isAr?"تنزيل PDF":"Download PDF")}
          </button>
        ) : (
          <button onClick={()=>handlePDF(null, 0)}
            style={{ padding:"9px 14px", background:"rgba(99,102,241,.1)",
              border:"1px solid rgba(99,102,241,.25)", borderRadius:9,
              color:"#a5b4fc", fontSize:12, fontWeight:600, cursor:"pointer",
              display:"flex", alignItems:"center", gap:6 }}>
            🔒 {isAr?"PDF — Pro & Elite فقط":"PDF — Pro & Elite only"}
          </button>
        )}
        {tierAtLeast(tier,"professional") && (
          <WeeklyIntelligenceButton sessions={userSessions} cs={cs} isAr={isAr} onOpen={()=>setShowWeeklyIntel(true)} />
        )}
        {isEliteTier && (
          <button onClick={()=>handlePDF(userSessions[0], totalSessions, true)}
            style={{ padding:"9px 14px", background:"rgba(14,165,233,.1)",
              border:"1px solid rgba(14,165,233,.25)", borderRadius:9,
              color:"#38bdf8", fontSize:12, fontWeight:600, cursor:"pointer",
              display:"flex", alignItems:"center", gap:6 }}>
            🩺 {isAr?"PDF الفيزيوثيرابيست":"Clinical PDF"}
          </button>
        )}
        {onTrend && totalSessions>=3 && (
          <button onClick={onTrend}
            style={{ padding:"9px 14px", background:"rgba(168,85,247,.12)",
              border:"1px solid rgba(168,85,247,.3)", borderRadius:9,
              color:"#c084fc", fontSize:12, fontWeight:600, cursor:"pointer",
              display:"flex", alignItems:"center", gap:6 }}>
            📈 {isAr?"رسم الاتجاه":"Trend Chart"}
          </button>
        )}
        {/* Comparison PDF — Pro+ with 2+ sessions */}
        {isProTier && userSessions.length >= 2 && (
          <button onClick={async ()=>{
              setPdfLoading("compare");
              // Compare latest vs previous session (most meaningful comparison)
              const s1 = userSessions[1]; // previous (older)
              const s2 = userSessions[0]; // latest (newer)
              await onComparisonPDF?.(s1, s2);
              setPdfLoading(null);
            }}
            disabled={pdfLoading==="compare"}
            style={{ padding:"9px 14px", background:"rgba(139,92,246,.1)",
              border:"1px solid rgba(139,92,246,.25)", borderRadius:9,
              color: pdfLoading==="compare"?"#94a3b8":"#c4b5fd",
              fontSize:12, fontWeight:600, cursor: pdfLoading==="compare"?"wait":"pointer",
              display:"flex", alignItems:"center", gap:6 }}
            title={isAr?"مقارنة آخر جلستين":"Compare last 2 sessions"}>
            {pdfLoading==="compare" ? "⏳" : "📊"} {isAr?"مقارنة الجلستين":"Compare Sessions"}
          </button>
        )}
        {/* Longitudinal PDF — Elite + 5+ sessions */}
        {isEliteTier && userSessions.length >= 5 && (
          <button onClick={async ()=>{
              setPdfLoading("longitudinal");
              await onLongitudinalPDF?.();
              setPdfLoading(null);
            }}
            disabled={pdfLoading==="longitudinal"}
            style={{ padding:"9px 14px", background:"rgba(245,158,11,.1)",
              border:"1px solid rgba(245,158,11,.25)", borderRadius:9,
              color: pdfLoading==="longitudinal"?"#94a3b8":"#fcd34d",
              fontSize:12, fontWeight:600, cursor: pdfLoading==="longitudinal"?"wait":"pointer",
              display:"flex", alignItems:"center", gap:6 }}>
            {pdfLoading==="longitudinal" ? "⏳" : "📅"} {isAr?"التقرير الطولي":"Longitudinal PDF"}
          </button>
        )}
        {/* Posture DNA Report — Elite, quarterly comprehensive report */}
        {isEliteTier && (
          <button onClick={async ()=>{
              try {
                setPdfLoading("dna");
                await onPostureDNA?.();
              } catch(e) {
                console.error("[Posture DNA]", e);
              } finally {
                setPdfLoading(null);
              }
            }}
            disabled={pdfLoading==="dna"}
            style={{ padding:"9px 14px", background:"rgba(212,175,55,.1)",
              border:"1px solid rgba(212,175,55,.3)", borderRadius:9,
              color: pdfLoading==="dna"?"#94a3b8":"#d4af37",
              fontSize:12, fontWeight:600, cursor: pdfLoading==="dna"?"wait":"pointer",
              display:"flex", alignItems:"center", gap:6 }}
            title={isAr?"تحليل شامل لآخر 90 يوم + مقارنة بمهنتك":"Comprehensive analysis of your last 90 days + profession benchmark"}>
            {pdfLoading==="dna" ? "⏳" : "🧬"} {isAr?"بصمة الوضعية":"Posture DNA"}
          </button>
        )}
        {/* Share Report — Elite + last session */}
        {isEliteTier && userSessions.length >= 1 && (
          <button onClick={async ()=>{
              setPdfLoading("share");
              await onShareReport?.(userSessions[0]);
              setPdfLoading(null);
            }}
            disabled={pdfLoading==="share"}
            style={{ padding:"9px 14px", background:"rgba(99,102,241,.1)",
              border:"1px solid rgba(99,102,241,.25)", borderRadius:9,
              color: pdfLoading==="share"?"#94a3b8":"#a5b4fc",
              fontSize:12, fontWeight:600, cursor: pdfLoading==="share"?"wait":"pointer",
              display:"flex", alignItems:"center", gap:6 }}>
            {pdfLoading==="share" ? "⏳" : "🔗"} {isAr?"شارك الجلسة":"Share Session"}
          </button>
        )}
        {isHRAdmin && (
          <button onClick={async ()=>{
              setPdfLoading("team");
              await onTeamPDF?.();
              setPdfLoading(null);
            }}
            disabled={pdfLoading==="team"}
            style={{ padding:"9px 14px", background:"rgba(16,185,129,.1)",
              border:"1px solid rgba(16,185,129,.25)", borderRadius:9,
              color: pdfLoading==="team"?"#94a3b8":"#6ee7b7",
              fontSize:12, fontWeight:600, cursor: pdfLoading==="team"?"wait":"pointer",
              display:"flex", alignItems:"center", gap:6 }}>
            {pdfLoading==="team" ? "⏳" : "🏢"} {isAr?"تقرير الفريق":"Team Report PDF"}
          </button>
        )}
      </div>

      {/* Sessions list */}
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {userSessions.map((s,i)=>{
          const d   = s.created_at?.toDate?.() ?? new Date(s.created_at||0);
          const sc  = s.avg_score||0;
          const col = gradeColor(sc);
          const dur = s.duration_s || s.duration_sec || 0;
          const durStr = dur>=60 ? (Math.floor(dur/60)+"m "+(dur%60)+"s") : dur>0 ? (dur+"s") : "";
          const isLoadingPDF = pdfLoading === (s.id||i);
          const isLoadingDel = deleting  === s.id;
          return (
            <div key={s.id||i} style={{ background:cs.card, border:`1px solid ${cs.border}`,
              borderRadius:10, padding:"13px 16px", display:"flex", gap:12, alignItems:"center",
              opacity: isLoadingDel ? 0.4 : 1, transition:"opacity .2s" }}>
              {/* Score circle */}
              <div style={{ width:44, height:44, borderRadius:8, flexShrink:0,
                background:`${col}18`, display:"flex", alignItems:"center",
                justifyContent:"center", fontSize:16, fontWeight:800, color:col }}>
                {sc||"—"}
              </div>
              {/* Info */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600, color:cs.text, display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                  {isAr ? `جلسة #${s.session_number||(totalSessions-i)}` : `Session #${s.session_number||(totalSessions-i)}`}
                  {s.mode && <span style={{ fontSize:10, color:cs.muted,
                    background:cs.inp, padding:"1px 7px", borderRadius:99 }}>
                    {s.mode}
                  </span>}
                </div>
                <div style={{ fontSize:11, color:cs.muted, marginTop:3, display:"flex", gap:8, flexWrap:"wrap" }}>
                  <span>{d.toLocaleDateString(isAr?"ar-EG":"en-US",{weekday:"short",month:"short",day:"numeric"})}</span>
                  <span>{d.toLocaleTimeString(isAr?"ar-EG":"en-US",{hour:"2-digit",minute:"2-digit"})}</span>
                  {durStr && <span>· {durStr}</span>}
                  {s.good_pct>0 && <span style={{color:"#10b981"}}>· {s.good_pct}%{isAr?" جيدة":""}</span>}
                </div>
              </div>
              {/* Actions */}
              <div style={{ display:"flex", gap:6, alignItems:"center", flexShrink:0 }}>
                <span style={{ fontSize:11, fontWeight:700, padding:"4px 10px", borderRadius:99,
                  background:`${col}18`, color:col }}>{grade(sc,isAr)}</span>
                {/* PDF button — Pro+ only */}
                <button onClick={()=>handlePDF(s, totalSessions-i)}
                  disabled={isLoadingPDF===((s.id||i))}
                  title={isProTier?(isAr?"تنزيل PDF":"Download PDF"):(isAr?"PDF — Pro & Elite":"PDF — Pro & Elite")}
                  style={{ padding:"6px 10px",
                    background: isProTier?(isEliteTier?"rgba(16,185,129,.1)":"rgba(26,86,219,.12)"):"rgba(99,102,241,.08)",
                    border:`1px solid ${isProTier?(isEliteTier?"rgba(16,185,129,.25)":"rgba(26,86,219,.25)"):"rgba(99,102,241,.2)"}`,
                    borderRadius:7,
                    color: pdfLoading===((s.id||i))?"#94a3b8":(isProTier?(isEliteTier?"#6ee7b7":"#60a5fa"):"#a5b4fc"),
                    fontSize:13, fontWeight:600,
                    cursor: pdfLoading===((s.id||i))?"wait":"pointer", transition:"all .2s" }}>
                  {pdfLoading===((s.id||i)) ? "⏳" : isProTier ? "📄" : "🔒"}
                </button>
                {/* Clinical PDF — Elite only */}
                {isEliteTier && (
                  <button onClick={()=>handlePDF(s, totalSessions-i, true)}
                    disabled={pdfLoading===((s.id||i)+"_c")}
                    title={isAr?"تقرير الفيزيوثيرابيست":"Clinical PDF"}
                    style={{ padding:"6px 10px", background:"rgba(14,165,233,.08)",
                      border:"1px solid rgba(14,165,233,.2)", borderRadius:7,
                      color: pdfLoading===((s.id||i)+"_c")?"#94a3b8":"#38bdf8",
                      fontSize:13, fontWeight:600,
                      cursor: pdfLoading===((s.id||i)+"_c")?"wait":"pointer", transition:"all .2s" }}>
                    {pdfLoading===((s.id||i)+"_c") ? "⏳" : "🩺"}
                  </button>
                )}
                {/* Delete button */}
                <button onClick={()=>handleDelete(s)}
                  disabled={isLoadingDel}
                  title={isAr?"حذف الجلسة":"Delete session"}
                  style={{ padding:"6px 10px", background:"rgba(239,68,68,.1)",
                    border:"1px solid rgba(239,68,68,.2)", borderRadius:7,
                    color: isLoadingDel?"#94a3b8":"#f87171", fontSize:13, fontWeight:600,
                    cursor: isLoadingDel?"wait":"pointer", transition:"all .2s" }}>
                  {isLoadingDel ? "⏳" : "🗑️"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {showWeeklyIntel && createPortal(
        <WeeklyIntelligenceModal sessions={userSessions} cs={cs} isAr={isAr} onClose={()=>setShowWeeklyIntel(false)} />
      , document.body)}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// SETTINGS PANEL (inline)
// ══════════════════════════════════════════════════════════════════
// ─── Add Password Form ─────────────────────────────────────────────
function AddPasswordForm({ user, isAr, cs, addToast, onSuccess }) {
  const [pw, setPw] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <div style={{ display:"flex", gap:8 }}>
      <input type="password" value={pw} onChange={e=>setPw(e.target.value)}
        placeholder={isAr?"كلمة مرور جديدة (6+ أحرف)":"New password (6+ chars)"}
        style={{ flex:1, padding:"8px 12px", background:cs.inp,
          border:`1px solid ${cs.border}`, borderRadius:7, color:cs.text,
          fontSize:12, outline:"none" }}/>
      <button disabled={pw.length<6||saving} onClick={async ()=>{
        setSaving(true);
        try {
          const { EmailAuthProvider, linkWithCredential } = await import("firebase/auth");
          const { auth } = await import("./firebase.js");
          const cred = EmailAuthProvider.credential(user.email, pw);
          await linkWithCredential(auth.currentUser, cred);
          addToast(isAr?"✅ تمت إضافة كلمة المرور":"✅ Password added","success");
          setPw("");
          onSuccess?.();
        } catch(e) { addToast(e.code==="auth/weak-password"?"Password too weak":e.message||"Error","error"); }
        setSaving(false);
      }} style={{ padding:"8px 14px", background:"#1a56db", color:"#fff",
        border:"none", borderRadius:7, fontSize:12, fontWeight:600,
        cursor:pw.length<6||saving?"not-allowed":"pointer", opacity:pw.length<6?.5:1 }}>
        {saving?"...":"Add"}
      </button>
    </div>
  );
}


function PanelSettings({ user, profile, setProfile, cs, isAr, addToast, onSignOut, tier, onBilling,
  onBillingHistory, onReferral, onIntegrations, onNotifications, onMFA, onChangePassword,
  lang, setLang, darkMode, setDarkMode, AccountSwitcher, onSwitchAccount }) {
  const [name,    setName]    = useState("");
  const [saving,  setSaving]  = useState(false);

  const [tab,     setTab]     = useState("profile");
  const [linkingGoogle, setLinkingGoogle] = useState(false);
  // BUG FIX: this component referenced currency/setCurrency (used below in
  // the upgrade-plans currency toggle) without ever defining them — a
  // ReferenceError that crashed the Settings page for every non-Pro user,
  // the moment the !isPro(tier) upgrade section tried to render. Same
  // timezone-based default used elsewhere in this file (Egypt → EGP via
  // Kashier, everyone else → USD via Stripe).
  const [currency, setCurrency] = useState(()=>{
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return tz === "Africa/Cairo" ? "EGP" : "USD";
    } catch { return "EGP"; }
  });
  const [addPwVisible, setAddPwVisible]   = useState(false);
  const [showDeleteBox, setShowDeleteBox] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Track whether user has started editing (prevents useEffect overriding their input)
  const [nameDirty, setNameDirty] = useState(false);

  async function deleteAccount() {
    if (deleteConfirmText.trim().toUpperCase() !== "DELETE") {
      addToast(isAr ? 'اكتب "DELETE" بالظبط للتأكيد' : 'Type "DELETE" exactly to confirm', "error");
      return;
    }
    setDeleting(true);
    try {
      const tok = await getAuthToken();
      // Use Vercel serverless function — works without Railway
      const res = await fetch("/api/account/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(tok ? { Authorization: "Bearer " + tok } : {}),
        },
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || "delete_failed");
      try { await logOut(); } catch {}
      addToast(isAr ? "تم حذف الحساب وكل بياناتك نهائياً" : "Your account and all data have been permanently deleted", "info");
      onSignOut?.();
    } catch (e) {
      addToast(isAr ? "حصل خطأ أثناء حذف الحساب — حاول تاني أو تواصل مع الدعم" : "Something went wrong deleting your account — try again or contact support", "error");
    }
    setDeleting(false);
  }

  // Sync from profile ONLY on initial load or when not actively editing
  useEffect(()=>{
    if(!nameDirty) {
      setName(profile?.name || user?.displayName || "");
    }
  },[profile?.name, user?.displayName]); // eslint-disable-line

  async function save() {
    const trimmedName = name.trim();
    if(!trimmedName){ addToast(isAr?"الاسم مش يكون فاضي":"Name can't be empty","error"); return; }
    if(!user?.uid){   addToast("Not signed in","error"); return; }
    setSaving(true);
    try {
      // Update Firestore profile (name only)
      await updateUserProfile(user.uid, { name: trimmedName });
      // Update Firebase Auth displayName
      if(auth.currentUser) {
        await fbUpdateProfile(auth.currentUser, { displayName: trimmedName });
      }
      // Update local state immediately so UI reflects change without reload
      setProfile(p=>({...(p||{}), name: trimmedName}));
      setName(trimmedName);
      setNameDirty(false); // Reset dirty flag after successful save
      addToast(isAr?"✅ تم حفظ الاسم":"✅ Name saved","success");
    } catch(err) {
      console.error("Save name error:", err?.code, err?.message, err);
      let msg;
      if(err?.code==="permission-denied") {
        msg = isAr?"خطأ في الصلاحيات — حاول تاني":"Permission denied — try again";
      } else if(err?.code==="not-found") {
        // Doc doesn't exist — try creating it from scratch
        try {
          const { doc: _doc, setDoc: _setDoc, serverTimestamp: _ts } = await import("firebase/firestore");
          const { db: _db } = await import("./firebase.js");
          await _setDoc(_doc(_db,"users",user.uid), {
            name: trimmedName,
            email: user.email||"",
            updated_at: _ts()
          }, { merge: true });
          if(auth.currentUser) await fbUpdateProfile(auth.currentUser, { displayName: trimmedName });
          setProfile(p=>({...(p||{}), name: trimmedName}));
          setName(trimmedName);
          setNameDirty(false);
          addToast(isAr?"✅ تم حفظ الاسم":"✅ Name saved","success");
          setSaving(false);
          return;
        } catch(e2) {
          msg = e2?.message || "Failed to create profile";
        }
      } else {
        msg = err?.message||"Unknown error";
      }
      addToast(isAr?`خطأ: ${msg}`:`Error: ${msg}`,"error");
    }
    setSaving(false);
  }

  async function linkGoogle() {
    setLinkingGoogle(true);
    try {
      const { GoogleAuthProvider, linkWithPopup } = await import("firebase/auth");
      const { auth } = await import("./firebase.js");
      await linkWithPopup(auth.currentUser, new GoogleAuthProvider());
      addToast(isAr?"✅ تم ربط Google":"✅ Google linked","success");
    } catch(e) {
      if(e.code==="auth/credential-already-in-use") addToast(isAr?"هذا الحساب مرتبط بمستخدم آخر":"This Google account is already in use","error");
      else addToast(e.message||"Error","error");
    }
    setLinkingGoogle(false);
  }

  const providers = user?.providerData || [];
  const hasGoogle = providers.some(p=>p.providerId==="google.com");
  const hasEmail  = providers.some(p=>p.providerId==="password");

  const inp = (val, onChange, placeholder, disabled=false) => (
    <input value={val} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
      disabled={disabled}
      style={{ width:"100%", padding:"10px 12px",
        background:disabled?cs.inp:cs.inp,
        border:`1px solid ${cs.border}`, borderRadius:8, color:disabled?cs.muted:cs.text,
        fontSize:13, outline:"none", boxSizing:"border-box", cursor:disabled?"not-allowed":"text",
        transition:"border-color .15s" }}
      onFocus={e=>{ if(!disabled) e.target.style.borderColor="#3b82f6"; }}
      onBlur={e=>e.target.style.borderColor=cs.border}/>
  );

  const tabs = [
    { id:"profile",  en:"Profile",      ar:"الملف الشخصي" },
    { id:"accounts", en:"Accounts",     ar:"الحسابات المرتبطة" },
    { id:"billing",  en:"Subscription", ar:"الاشتراك" },
    { id:"security", en:"Security",     ar:"الأمان" },
    { id:"notifications", en:"Notifications", ar:"الإشعارات" },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16, maxWidth:600 }}>

      {/* User header */}
      <div style={{ background:cs.card, border:`1px solid ${cs.border}`, borderRadius:14,
        padding:"20px 22px", display:"flex", gap:16, alignItems:"center" }}>
        <div style={{ flexShrink:0, display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
          <div style={{ position:"relative" }}>
            {profile?.photoURL
              ? <img src={profile.photoURL} alt="avatar"
                  style={{ width:72, height:72, borderRadius:"50%",
                    objectFit:"cover", border:`2px solid ${cs.border}` }}/>
              : <Avatar name={profile?.name||profile?.email} photo={null} size={72}/>}
            <label title={isAr?"تغيير الصورة":"Change photo"}
              style={{ position:"absolute", bottom:0, right:0, width:24, height:24,
                background:"#1a56db", borderRadius:"50%", cursor:"pointer",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:12, border:"2px solid rgba(4,9,20,1)" }}>
              📷
              <input type="file" accept="image/*" style={{ display:"none" }}
                onChange={async e=>{
                  const file=e.target.files[0]; if(!file) return;
                  if(file.size>5*1024*1024){ addToast(isAr?"الصورة أكبر من 5MB":"Image > 5MB","error"); return; }
                  const img=new Image();
                  const url=URL.createObjectURL(file);
                  img.onload=async()=>{
                    const canvas=document.createElement("canvas");
                    const S=120; canvas.width=S; canvas.height=S;
                    const ctx=canvas.getContext("2d");
                    const minDim=Math.min(img.width,img.height);
                    const sx=(img.width-minDim)/2, sy=(img.height-minDim)/2;
                    ctx.drawImage(img,sx,sy,minDim,minDim,0,0,S,S);
                    URL.revokeObjectURL(url);
                    const dataUrl=canvas.toDataURL("image/jpeg",0.8);
                    try{
                      await updateUserProfile(user.uid,{photoURL:dataUrl});
                      setProfile(p=>({...p,photoURL:dataUrl}));
                      addToast(isAr?"✅ تم تحديث الصورة":"✅ Photo updated","success");
                    }catch(err){ addToast(err?.message||"Upload error","error"); }
                  };
                  img.src=url;
                }}/>
            </label>
          </div>
          <span style={{ fontSize:10, color:"#3b82f6", cursor:"pointer", fontWeight:500 }}
            onClick={()=>document.querySelector('input[type=file]')?.click()}>
            {isAr?"تغيير الصورة":"Change photo"}
          </span>
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:17, fontWeight:800, color:cs.text }}>
            {profile?.name || user?.displayName || profile?.email?.split("@")[0] || "—"}
          </div>
          <div style={{ fontSize:12, color:cs.muted, marginTop:2 }}>{user?.email||"—"}</div>
          <div style={{ marginTop:6, display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
            <TierBadge tier={tier}/>
            {/* Account type badge */}
            {(() => {
              const isCompanyAcct = profile?.user_type==="hr_admin"||profile?.user_type==="employee"||!!profile?.is_org_owner||!!profile?.company_id||profile?.acct_type==="company";
              const label = isCompanyAcct
                ? (profile?.user_type==="hr_admin"||profile?.is_org_owner ? (isAr?"مشرف شركة":"Company Admin") : (isAr?"موظف":"Employee"))
                : (isAr?"حساب شخصي":"Individual");
              const color = isCompanyAcct ? "#a78bfa" : "#60a5fa";
              return <span style={{ fontSize:9, fontWeight:700, padding:"2px 8px", borderRadius:99, background:`${color}15`, color, border:`1px solid ${color}25` }}>{label}</span>;
            })()}
            {hasGoogle&&<span style={{ fontSize:10, color:"#4285f4", fontWeight:600 }}>🔵 Google</span>}
            {hasEmail&&<span style={{ fontSize:10, color:"#10b981", fontWeight:600 }}>📧 Email</span>}
          </div>
        </div>
        <button onClick={onSignOut}
          style={{ padding:"8px 14px", background:"rgba(239,68,68,.1)",
            border:"1px solid rgba(239,68,68,.2)", borderRadius:8,
            color:"#f87171", fontSize:12, fontWeight:700, cursor:"pointer" }}>
          {isAr?"⏻ خروج":"⏻ Sign Out"}
        </button>
        {AccountSwitcher && (
          <AccountSwitcher
            user={user} cs={cs} isAr={isAr}
            addToast={addToast}
            onSwitchAccount={onSwitchAccount}
          />
        )}
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:4, background:cs.card,
        border:`1px solid ${cs.border}`, borderRadius:10, padding:4 }}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{ flex:1, padding:"8px 4px", border:"none", borderRadius:7, cursor:"pointer",
              background:tab===t.id?"rgba(59,130,246,.15)":"transparent",
              color:tab===t.id?"#60a5fa":cs.muted,
              fontSize:11, fontWeight:tab===t.id?700:500, transition:"all .12s" }}>
            {isAr?t.ar:t.en}
          </button>
        ))}
      </div>

      {/* Tab: Profile */}
      {tab==="profile"&&(
        <div style={{ background:cs.card, border:`1px solid ${cs.border}`, borderRadius:12, padding:"20px" }}>
          <div style={{ fontSize:13, fontWeight:700, color:cs.text, marginBottom:16 }}>
            {isAr?"المعلومات الشخصية":"Personal Information"}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div>
              <div style={{ fontSize:11, color:cs.muted, fontWeight:600, marginBottom:6,
                textTransform:"uppercase", letterSpacing:".06em" }}>
                {isAr?"الاسم الكامل":"Full Name"}
              </div>
              <input
                value={name}
                onChange={e=>{ setName(e.target.value); setNameDirty(true); }}
                placeholder={isAr?"أدخل اسمك الكامل":"Enter full name"}
                style={{ width:"100%", padding:"10px 12px", background:cs.inp,
                  border:`1px solid ${cs.border}`, borderRadius:8, color:cs.text,
                  fontSize:13, outline:"none", boxSizing:"border-box" }}
              />
            </div>
            <div>
              <div style={{ fontSize:11, color:cs.muted, fontWeight:600, marginBottom:6,
                textTransform:"uppercase", letterSpacing:".06em" }}>
                {isAr?"المهنة":"Profession"}
              </div>
              <select
                value={profile?.profession || "other"}
                onChange={async e=>{
                  const val = e.target.value;
                  setProfile(p=>({...(p||{}), profession: val}));
                  try {
                    if (user?.uid) await updateUserProfile(user.uid, { profession: val });
                  } catch { addToast(isAr?"تعذر حفظ المهنة":"Couldn't save profession","error"); }
                }}
                style={{ width:"100%", padding:"10px 12px", background:cs.inp,
                  border:`1px solid ${cs.border}`, borderRadius:8, color:cs.text,
                  fontSize:13, outline:"none", boxSizing:"border-box" }}
              >
                <option value="desk_worker">{isAr?"عمل مكتبي / برمجة":"Desk / Software work"}</option>
                <option value="driver">{isAr?"قيادة / نقل":"Driving / Transport"}</option>
                <option value="healthcare">{isAr?"عامل رعاية صحية":"Healthcare worker"}</option>
                <option value="teacher">{isAr?"تدريس / تعليم":"Teaching / Education"}</option>
                <option value="retail_service">{isAr?"مبيعات / خدمة عملاء":"Retail / Customer service"}</option>
                <option value="manual_labor">{isAr?"عمل يدوي / بدني":"Manual / Physical labor"}</option>
                <option value="student">{isAr?"طالب":"Student"}</option>
                <option value="other">{isAr?"عام / أخرى":"General / Other"}</option>
              </select>
              <div style={{ fontSize:10, color:cs.subtle||cs.muted, marginTop:5 }}>
                {isAr?"بيستخدم في تقرير بصمة الوضعية (Elite) للمقارنة بمعايير مهنتك":"Used in your Posture DNA report (Elite) to benchmark against your profession"}
              </div>
            </div>
            <div>
              <div style={{ fontSize:11, color:cs.muted, fontWeight:600, marginBottom:6,
                textTransform:"uppercase", letterSpacing:".06em" }}>
                {isAr?"البريد الإلكتروني":"Email"}
              </div>
              {inp(user?.email||"", ()=>{}, "", true)}
            </div>
            <button onClick={save} disabled={saving}
              style={{ marginTop:4, padding:"11px", background:saving?"rgba(26,86,219,.5)":"#1a56db",
                color:"#fff", border:"none", borderRadius:8, fontSize:13,
                fontWeight:700, cursor:saving?"not-allowed":"pointer" }}>
              {saving?(isAr?"جاري الحفظ...":"Saving..."):(isAr?"حفظ الاسم":"Save Name")}
            </button>

            {/* Preferences */}
            <div style={{ marginTop:8, paddingTop:16, borderTop:`1px solid ${cs.border}` }}>
              <div style={{ fontSize:11, color:cs.muted, fontWeight:600, marginBottom:10,
                textTransform:"uppercase", letterSpacing:".06em" }}>
                {isAr?"التفضيلات":"Preferences"}
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={()=>setLang?.(lang==="ar"?"en":"ar")}
                  style={{ flex:1, padding:"10px", background:cs.inp,
                    border:`1px solid ${cs.border}`, borderRadius:8,
                    color:cs.text, fontSize:12, fontWeight:600, cursor:"pointer",
                    display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                  {lang==="ar"?"🇬🇧 Switch to English":"🇪🇬 التبديل للعربية"}
                </button>
                <button onClick={()=>setDarkMode?.(!darkMode)}
                  style={{ padding:"10px 16px", background:cs.inp,
                    border:`1px solid ${cs.border}`, borderRadius:8,
                    color:cs.text, fontSize:13, cursor:"pointer" }}>
                  {darkMode?"☀️":"🌙"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab==="profile"&&(
        <div style={{ background:cs.card, border:`1px solid ${cs.border}`, borderRadius:12, padding:"20px", marginTop:16 }}>
          <div style={{ fontSize:13, fontWeight:700, color:cs.text, marginBottom:14 }}>
            {isAr?"النمو والتكاملات":"Growth & Integrations"}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <button onClick={onReferral} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:cs.inp, border:`1px solid ${cs.border}`, borderRadius:10, padding:"12px 16px", cursor:"pointer", textAlign:isAr?"right":"left" }}>
              <span style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:18 }}>🤝</span>
                <span>
                  <div style={{ fontSize:13, fontWeight:700, color:cs.text }}>{isAr?"برنامج الإحالة":"Referral Program"}</div>
                  <div style={{ fontSize:11, color:cs.muted }}>{isAr?"اكسب رصيد لما أصحابك يشتركوا":"Earn credit when friends sign up"}</div>
                </span>
              </span>
              <span style={{ color:cs.muted }}>›</span>
            </button>
            <button onClick={onIntegrations} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:cs.inp, border:`1px solid ${cs.border}`, borderRadius:10, padding:"12px 16px", cursor:"pointer", textAlign:isAr?"right":"left" }}>
              <span style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:18 }}>🔌</span>
                <span>
                  <div style={{ fontSize:13, fontWeight:700, color:cs.text }}>{isAr?"التكاملات":"Integrations"}</div>
                  <div style={{ fontSize:11, color:cs.muted }}>Slack, Teams, Zapier, Webhooks…</div>
                </span>
              </span>
              <span style={{ color:cs.muted }}>›</span>
            </button>
            <button onClick={onNotifications} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:cs.inp, border:`1px solid ${cs.border}`, borderRadius:10, padding:"12px 16px", cursor:"pointer", textAlign:isAr?"right":"left" }}>
              <span style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:18 }}>🔔</span>
                <span>
                  <div style={{ fontSize:13, fontWeight:700, color:cs.text }}>{isAr?"الإشعارات":"Notifications"}</div>
                  <div style={{ fontSize:11, color:cs.muted }}>{isAr?"إنجازات، رؤى AI، تنبيهات":"Achievements, AI insights, alerts"}</div>
                </span>
              </span>
              <span style={{ color:cs.muted }}>›</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab: Accounts */}
      {tab==="accounts"&&(
        <div style={{ background:cs.card, border:`1px solid ${cs.border}`, borderRadius:12, padding:"20px" }}>
          <div style={{ fontSize:13, fontWeight:700, color:cs.text, marginBottom:6 }}>
            {isAr?"الحسابات المرتبطة":"Linked Accounts"}
          </div>
          <div style={{ fontSize:12, color:cs.muted, marginBottom:16, lineHeight:1.6 }}>
            {isAr?"يمكنك ربط أكثر من طريقة دخول بحسابك — كل الحسابات المرتبطة تفتح نفس الداشبورد.":"Link multiple sign-in methods to your account — they all open the same dashboard."}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {/* Google */}
            <div style={{ padding:"14px 16px", background:cs.inp,
              borderRadius:10, border:`1px solid ${hasGoogle?"rgba(66,133,244,.3)":cs.border}`,
              display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                <span style={{ fontSize:22 }}>🔵</span>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:cs.text }}>Google</div>
                  <div style={{ fontSize:11, color:cs.muted, marginTop:2 }}>
                    {hasGoogle ? (providers.find(p=>p.providerId==="google.com")?.email||user?.email) : (isAr?"غير مرتبط":"Not linked")}
                  </div>
                </div>
              </div>
              {hasGoogle
                ? <span style={{ fontSize:10, fontWeight:700, color:"#10b981",
                    background:"rgba(16,185,129,.1)", padding:"3px 10px", borderRadius:99 }}>
                    {isAr?"مرتبط ✓":"Linked ✓"}
                  </span>
                : <button onClick={linkGoogle} disabled={linkingGoogle}
                    style={{ padding:"7px 14px", background:"rgba(66,133,244,.15)",
                      border:"1px solid rgba(66,133,244,.3)", borderRadius:7,
                      color:"#4285f4", fontSize:12, fontWeight:600, cursor:"pointer",
                      opacity:linkingGoogle?.6:1 }}>
                    {linkingGoogle?(isAr?"جاري...":"Linking..."):(isAr?"+ ربط":"+ Link")}
                  </button>
              }
            </div>
            {/* Email/Password */}
            <div style={{ padding:"14px 16px", background:cs.inp,
              borderRadius:10, border:`1px solid ${hasEmail?"rgba(16,185,129,.25)":cs.border}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                  <span style={{ fontSize:22 }}>📧</span>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:cs.text }}>
                      {isAr?"بريد إلكتروني + كلمة مرور":"Email + Password"}
                    </div>
                    <div style={{ fontSize:11, color:cs.muted, marginTop:2 }}>
                      {hasEmail ? user?.email : (isAr?"أضف كلمة مرور لتسجيل الدخول بالإيميل":"Add password to sign in with email")}
                    </div>
                  </div>
                </div>
                {hasEmail
                  ? <span style={{ fontSize:10, fontWeight:700, color:"#10b981",
                      background:"rgba(16,185,129,.1)", padding:"3px 10px", borderRadius:99 }}>
                      {isAr?"مرتبط ✓":"Linked ✓"}
                    </span>
                  : <button onClick={()=>setAddPwVisible(v=>!v)}
                      style={{ padding:"7px 14px", background:"rgba(16,185,129,.12)",
                        border:"1px solid rgba(16,185,129,.25)", borderRadius:7,
                        color:"#10b981", fontSize:12, fontWeight:600, cursor:"pointer" }}>
                      {addPwVisible?(isAr?"إلغاء":"Cancel"):(isAr?"+ إضافة":"+ Add")}
                    </button>
                }
              </div>
              {addPwVisible&&!hasEmail&&(
                <div style={{ marginTop:12 }}>
                  <AddPasswordForm user={user} isAr={isAr} cs={cs} addToast={addToast}
                    onSuccess={()=>setAddPwVisible(false)}/>
                </div>
              )}
            </div>
            {/* Info note */}
            <div style={{ padding:"12px 14px", background:"rgba(59,130,246,.05)",
              border:"1px solid rgba(59,130,246,.15)", borderRadius:9 }}>
              <div style={{ fontSize:11, color:"rgba(147,197,253,.8)", lineHeight:1.6 }}>
                {isAr
                  ?"💡 كل الحسابات المرتبطة تستخدم نفس بيانات الوضعية والجلسات. يمكنك تسجيل الدخول بأي منها."
                  :"💡 All linked accounts share the same posture data and sessions. Sign in with any of them."}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Billing */}
      {tab==="billing"&&(
        <div style={{ background:cs.card, border:`1px solid ${cs.border}`, borderRadius:12, padding:"20px" }}>
          <div style={{ fontSize:13, fontWeight:700, color:cs.text, marginBottom:16 }}>
            {isAr?"خطتك الحالية":"Current Plan"}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:16, padding:"16px",
            background:cs.inp, borderRadius:10,
            border:`1px solid ${cs.border}`, marginBottom:16 }}>
            <div style={{ fontSize:32 }}>
              {tier==="elite"?"✦":tier==="professional"?"⭐":tier==="business"?"🏢":"🆓"}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:16, fontWeight:800, color:cs.text }}>
                {tier==="elite"?"Elite":tier==="professional"?"Professional":tier==="business"?"Business":"Free"}
              </div>
              <div style={{ fontSize:12, color:cs.muted, marginTop:3 }}>
                {tier==="elite"?(isAr?"كل المميزات + تحليل AI متقدم":"All features + Advanced AI")
                :tier==="professional"?(isAr?"AI Coach + تقارير PDF + تحليلات":"AI Coach + PDF reports + Analytics")
                :tier==="business"?(isAr?"كل مميزات Pro + إدارة المجموعة":"All Pro + Group management")
                :(isAr?"جلسات يومية محدودة":"Limited daily sessions")}
              </div>
            </div>
            <TierBadge tier={tier}/>
          </div>
          <button onClick={onBillingHistory} style={{ width:"100%", background:cs.inp, border:`1px solid ${cs.border}`, borderRadius:10, padding:"12px 16px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
            <span style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:18 }}>📄</span>
              <span style={{ fontSize:13, fontWeight:700, color:cs.text }}>{isAr?"الفواتير والاستخدام":"Invoices & Usage"}</span>
            </span>
            <span style={{ color:cs.muted }}>›</span>
          </button>
          {!isPro(tier)&&(
            <>
              {/* ── Upgrade Plans ── */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                <div style={{ fontSize:12, color:cs.muted }}>
                  {isAr?"اختر خطتك:":"Choose your plan:"}
                </div>
                <div style={{ display:"flex", border:`1px solid ${cs.border}`, borderRadius:8, overflow:"hidden" }}>
                  {["EGP","USD"].map(c=>(
                    <button key={c} onClick={()=>setCurrency(c)}
                      style={{ background: currency===c ? "#1a56db" : "transparent", border:"none",
                        padding:"4px 10px", fontSize:10, fontWeight:700,
                        color: currency===c ? "#fff" : cs.muted, cursor:"pointer" }}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              {[
                {
                  id:"basic", color:"#3b82f6",
                  name:    isAr?"أساسي":"Basic",
                  priceEGP:199, priceUSD:9.99,
                  tag:     isAr?"للمبتدئين":"Starter",
                  features:isAr
                    ?["جلسات غير محدودة","مدرب AI (10 رسائل/شهر)","سلسلة وأهداف","توقع الألم"]
                    :["Unlimited sessions","AI Coach (10 msgs/mo)","Streak & Goals","Pain prediction"],
                },
                {
                  id:"professional", color:"#8b5cf6",
                  name:    isAr?"احترافي":"Pro",
                  priceEGP:399, priceUSD:19.99,
                  tag:     isAr?"الأكثر طلباً ⭐":"Most Popular ⭐",
                  features:isAr
                    ?["كل Basic","رؤى AI","تقارير","مقارنة الجلسات","تصدير CSV/PDF"]
                    :["Everything in Basic","AI Insights","Reports","Compare sessions","Export CSV/PDF"],
                },
                {
                  id:"elite", color:"#f59e0b",
                  name:    isAr?"إيليت":"Elite",
                  priceEGP:699, priceUSD:39.99,
                  tag:     isAr?"أفضل قيمة":"Best Value",
                  features:isAr
                    ?["كل Pro","مدرب AI غير محدود","AI تنبؤي","تقرير PDF","دعم أولوية"]
                    :["Everything in Pro","AI Coach unlimited","Predictive AI","PDF report","Priority support"],
                },
              ].map((plan)=>(
                <div key={plan.id}
                  style={{ border:`1px solid ${plan.color}44`, borderRadius:10,
                    padding:"12px 14px", marginBottom:10,
                    background:`${plan.color}08`, cursor:"pointer" }}
                  onClick={()=>onBilling?.(plan.id)}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontSize:13, fontWeight:800, color:plan.color }}>{plan.name}</span>
                      <span style={{ fontSize:9, background:`${plan.color}22`, color:plan.color,
                        padding:"2px 7px", borderRadius:20, fontWeight:700 }}>{plan.tag}</span>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <span style={{ fontSize:15, fontWeight:900, color:"#f0f6ff" }}>
                        {currency==="EGP" ? `${plan.priceEGP} EGP` : `$${plan.priceUSD}`}
                      </span>
                      <span style={{ fontSize:10, color:cs.muted }}> /{isAr?"شهر":"mo"}</span>
                    </div>
                  </div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                    {plan.features.slice(0,3).map((f,i)=>(
                      <span key={i} style={{ fontSize:10, color:cs.muted }}>✓ {f}</span>
                    ))}
                  </div>
                </div>
              ))}
              <button onClick={()=>onBilling?.()}
                style={{ marginTop:4, width:"100%", padding:"11px",
                  background:"linear-gradient(135deg,#6366f1,#8b5cf6)", color:"#fff",
                  border:"none", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer" }}>
                {isAr?"مقارنة كل الخطط →":"Compare All Plans →"}
              </button>
            </>
          )}
          {isPro(tier)&&(
            <div style={{ fontSize:13, color:"#10b981", fontWeight:600, textAlign:"center", padding:"8px" }}>
              ✅ {isAr?"أنت على خطة مدفوعة. شكراً!":"You're on a paid plan. Thank you!"}
            </div>
          )}
        </div>
      )}


      {/* Tab: Security */}
      {tab==="security"&&(
        <div style={{ background:cs.card, border:`1px solid ${cs.border}`, borderRadius:12, padding:"20px" }}>
          <div style={{ fontSize:13, fontWeight:700, color:cs.text, marginBottom:6 }}>
            {isAr?"الأمان":"Security"}
          </div>
          <div style={{ fontSize:12, color:cs.muted, marginBottom:16, lineHeight:1.6 }}>
            {isAr?"إدارة أمان حسابك وجلساتك.":"Manage your account security and active sessions."}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {/* MFA / 2FA status — MFASetup.jsx has been a fully working
                TOTP+SMS flow for a while; this row was still a permanently
                dead "Soon" badge with nothing wired to open it. That earlier
                fix called setShowMFASetup directly, but PanelSettings is
                never given that setter (only HomePage itself receives it as
                a prop) — every other action on this same panel goes through
                an onX callback prop (onBillingHistory/onReferral/
                onIntegrations/onNotifications) for exactly this reason.
                setShowMFASetup here was a bare undeclared identifier: not a
                silent no-op, an actual ReferenceError the moment this row
                was clicked. */}
            <div onClick={()=>onMFA?.()} style={{ padding:"14px 16px", background:cs.inp,
              borderRadius:10, border:`1px solid ${cs.border}`, cursor:"pointer",
              display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                <span style={{ fontSize:22 }}>🔐</span>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:cs.text }}>
                    {isAr?"المصادقة الثنائية (2FA)":"Two-Factor Authentication"}
                  </div>
                  <div style={{ fontSize:11, color:cs.muted, marginTop:2 }}>
                    {profile?.mfa_enabled
                      ? (isAr?`مفعّلة عبر ${profile?.mfa_method==="sms"?"SMS":"تطبيق المصادقة"}`:`Enabled via ${profile?.mfa_method==="sms"?"SMS":"authenticator app"}`)
                      : (isAr?"أضف طبقة حماية إضافية لحسابك":"Add an extra layer of protection")}
                  </div>
                </div>
              </div>
              <span style={{ fontSize:10, fontWeight:700,
                background: profile?.mfa_enabled ? "rgba(16,185,129,.12)" : "rgba(99,102,241,.1)",
                color: profile?.mfa_enabled ? "#10b981" : "#a5b4fc",
                padding:"3px 10px", borderRadius:99 }}>
                {profile?.mfa_enabled ? (isAr?"مفعّل ✓":"Enabled ✓") : (isAr?"إعداد":"Set up")}
              </span>
            </div>
            {/* Active sessions */}
            <div style={{ padding:"14px 16px", background:cs.inp,
              borderRadius:10, border:`1px solid ${cs.border}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                  <span style={{ fontSize:22 }}>💻</span>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:cs.text }}>
                      {isAr?"الجلسات النشطة":"Active Sessions"}
                    </div>
                    <div style={{ fontSize:11, color:cs.muted, marginTop:2 }}>
                      {isAr?"الأجهزة المتصلة حالياً":"Currently connected devices"}
                    </div>
                  </div>
                </div>
                <span style={{ fontSize:10, fontWeight:700,
                  background:"rgba(16,185,129,.1)", color:"#10b981",
                  padding:"3px 10px", borderRadius:99 }}>
                  {isAr?"جلسة نشطة":"1 Active"}
                </span>
              </div>
              <div style={{ padding:"10px 12px", background:"rgba(59,130,246,.06)",
                border:"1px solid rgba(59,130,246,.15)", borderRadius:8,
                display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:cs.text }}>
                    {isAr?"هذا الجهاز (الحالي)":"This device (current)"}
                  </div>
                  <div style={{ fontSize:10, color:cs.muted, marginTop:3 }}>
                    {new Date().toLocaleDateString(isAr?"ar-EG":"en-US",{day:"numeric",month:"short",year:"numeric"})}
                  </div>
                </div>
                <span style={{ fontSize:10, color:"#3b82f6", fontWeight:600 }}>
                  {isAr?"نشط الآن":"Active now"}
                </span>
              </div>
            </div>
            {/* Password change */}
            <div style={{ padding:"14px 16px", background:cs.inp,
              borderRadius:10, border:`1px solid ${cs.border}`,
              display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                <span style={{ fontSize:22 }}>🔑</span>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:cs.text }}>
                    {isAr?"تغيير كلمة المرور":"Change Password"}
                  </div>
                  <div style={{ fontSize:11, color:cs.muted, marginTop:2 }}>
                    {isAr?"تحديث كلمة مرور حسابك":"Update your account password"}
                  </div>
                </div>
              </div>
              <button onClick={()=>onChangePassword?.()}
                style={{ padding:"7px 14px", background:"rgba(99,102,241,.12)",
                  border:"1px solid rgba(99,102,241,.25)", borderRadius:7,
                  color:"#a5b4fc", fontSize:12, fontWeight:600, cursor:"pointer" }}>
                {isAr?"تغيير":"Change"}
              </button>
            </div>
            {/* Sign out all */}
            <div style={{ padding:"14px 16px", background:"rgba(239,68,68,.04)",
              borderRadius:10, border:"1px solid rgba(239,68,68,.12)",
              display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                <span style={{ fontSize:22 }}>🚪</span>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:"#f87171" }}>
                    {isAr?"تسجيل الخروج":"Sign Out"}
                  </div>
                  <div style={{ fontSize:11, color:cs.muted, marginTop:2 }}>
                    {isAr?"تسجيل الخروج من جميع الأجهزة":"Sign out from all devices"}
                  </div>
                </div>
              </div>
              <button onClick={onSignOut}
                style={{ padding:"7px 14px", background:"rgba(239,68,68,.12)",
                  border:"1px solid rgba(239,68,68,.25)", borderRadius:7,
                  color:"#f87171", fontSize:12, fontWeight:600, cursor:"pointer" }}>
                {isAr?"خروج":"Sign Out"}
              </button>
            </div>

            {/* Delete account — GDPR right to erasure */}
            <div style={{ padding:"14px 16px", background:"rgba(239,68,68,.04)",
              borderRadius:10, border:"1px solid rgba(239,68,68,.15)" }}>
              <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
                <span style={{ fontSize:22 }}>⚠️</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:"#f87171" }}>
                    {isAr?"حذف الحساب":"Delete Account"}
                  </div>
                  <div style={{ fontSize:11, color:cs.muted, marginTop:2, lineHeight:1.6 }}>
                    {isAr
                      ?"هيتم حذف كل بياناتك نهائياً (الجلسات، المدفوعات، الإشعارات، الملف الشخصي) طبقاً للحق في المحو (GDPR). الإجراء ده لا يمكن التراجع عنه."
                      :"Permanently deletes all your data — sessions, payments, notifications, profile — per your GDPR right to erasure. This cannot be undone."}
                  </div>
                  {!showDeleteBox ? (
                    <button onClick={()=>setShowDeleteBox(true)} style={{ marginTop:10, padding:"7px 14px",
                      background:"rgba(239,68,68,.1)", border:"1px solid rgba(239,68,68,.25)",
                      borderRadius:7, color:"#fca5a5", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                      {isAr?"حذف الحساب نهائياً":"Delete My Account"}
                    </button>
                  ) : (
                    <div style={{ marginTop:12 }}>
                      <div style={{ fontSize:11.5, fontWeight:600, color:"#fca5a5", marginBottom:8 }}>
                        {isAr?'اكتب "DELETE" في الخانة تحت للتأكيد:':'Type "DELETE" below to confirm:'}
                      </div>
                      <input value={deleteConfirmText} onChange={e=>setDeleteConfirmText(e.target.value)} placeholder="DELETE"
                        style={{ width:"100%", maxWidth:220, padding:"8px 10px", background:cs.inp,
                          border:`1px solid ${cs.border}`, borderRadius:7, color:cs.text, fontSize:12,
                          outline:"none", boxSizing:"border-box" }}/>
                      <div style={{ display:"flex", gap:8, marginTop:10 }}>
                        <button onClick={()=>{setShowDeleteBox(false);setDeleteConfirmText("");}} disabled={deleting}
                          style={{ padding:"7px 14px", background:"rgba(148,163,184,.1)",
                            border:"1px solid rgba(148,163,184,.2)", borderRadius:7, color:cs.muted,
                            fontSize:12, fontWeight:600, cursor:"pointer" }}>
                          {isAr?"إلغاء":"Cancel"}
                        </button>
                        <button onClick={deleteAccount} disabled={deleting||deleteConfirmText.trim().toUpperCase()!=="DELETE"}
                          style={{ padding:"7px 14px", background:"rgba(239,68,68,.15)",
                            border:"1px solid rgba(239,68,68,.4)", borderRadius:7, color:"#fca5a5",
                            fontSize:12, fontWeight:700, cursor:"pointer",
                            opacity:(deleting||deleteConfirmText.trim().toUpperCase()!=="DELETE")?.5:1 }}>
                          {deleting?"...":(isAr?"تأكيد الحذف النهائي":"Confirm Permanent Delete")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Notifications */}
      {tab==="notifications"&&(
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <PushNotificationSettings cs={cs} isAr={isAr} addToast={addToast} />
          {tierAtLeast(tier,"elite") ? (
            <VoiceCoachSettings cs={cs} isAr={isAr} lang={lang} addToast={addToast} />
          ) : (
            <VoiceCoachUpsell cs={cs} isAr={isAr} onUpgrade={onBilling} />
          )}
          <EarlyAccessPanel cs={cs} isAr={isAr} tier={tier} onUpgrade={onBilling} />
          <div style={{ marginTop:12 }}>
            <FamilyPartnerSettings cs={cs} isAr={isAr} tier={tier} onUpgrade={onBilling} addToast={addToast} />
          </div>
        </div>
      )}

    </div>
  );
}

// ── Push Notifications settings block ───────────────────────────────
function PushNotificationSettings({ cs, isAr, addToast }) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy]       = useState(false);
  const [prefs, setPrefsState] = useState(null);       // {categories, preferred_hour, computed_hour}
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => {
    setEnabled(isPushEnabled());
    PushAPI.getPreferences().then(setPrefsState).catch(() => {});
  }, []);

  const toggle = async () => {
    setBusy(true);
    try {
      if (enabled) {
        await disablePushNotifications();
        setEnabled(false);
        addToast?.(isAr ? "تم إيقاف الإشعارات" : "Notifications disabled", "success");
      } else {
        const res = await enablePushNotifications(isAr ? "ar" : "en");
        if (res.ok) {
          setEnabled(true);
          addToast?.(isAr ? "تفعّلت الإشعارات ✓" : "Notifications enabled ✓", "success");
        } else {
          const msgs = {
            permission_denied: isAr ? "الإذن اتمنع من إعدادات المتصفح" : "Permission denied in browser settings",
            unsupported:       isAr ? "المتصفح ده مش بيدعم الإشعارات" : "This browser doesn't support push notifications",
            no_vapid_key:      isAr ? "الإشعارات لسه مش متظبطة من ناحيتنا" : "Push isn't fully configured on our end yet",
            no_token: isAr ? "حصل خطأ في التسجيل" : "Registration failed",
            error:    isAr ? "حصل خطأ" : "Something went wrong",
          };
          addToast?.(msgs[res.reason] || msgs.error, "error");
        }
      }
    } finally { setBusy(false); }
  };

  const sendTest = async () => {
    try {
      const r = await PushAPI.test();
      addToast?.(isAr ? `اتبعت لـ ${r.sent||0} جهاز` : `Sent to ${r.sent||0} device(s)`, "success");
    } catch (e) {
      addToast?.(e.message || (isAr?"حصل خطأ":"Something went wrong"), "error");
    }
  };

  const toggleCategory = async (key) => {
    if (!prefs) return;
    const nextCategories = { ...prefs.categories, [key]: !prefs.categories[key] };
    setPrefsState(p => ({ ...p, categories: nextCategories }));
    setSavingPrefs(true);
    try { await PushAPI.setPreferences({ categories: nextCategories }); }
    catch { /* non-critical */ }
    finally { setSavingPrefs(false); }
  };

  const hourLabel = (h) => {
    if (h == null) return "—";
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return isAr ? `الساعة ${h12}:00 ${h>=12?"م":"ص"}` : `${h12}:00 ${period}`;
  };

  const CATEGORY_LABELS = {
    streak:           { en:"Streak reminders",  ar:"تذكير سلسلة الالتزام" },
    symptom_reminder: { en:"Symptom check-in",  ar:"تذكير تسجيل الأعراض" },
    weekly_summary:   { en:"Weekly summary",    ar:"ملخص أسبوعي" },
  };

  return (
    <div style={{ background:cs.card, border:`1px solid ${cs.border}`, borderRadius:12, padding:"20px" }}>
      <div style={{ fontSize:13, fontWeight:700, color:cs.text, marginBottom:6 }}>
        {isAr?"الإشعارات":"Notifications"}
      </div>
      <div style={{ fontSize:12, color:cs.muted, marginBottom:16, lineHeight:1.6 }}>
        {isAr?"استقبل تنبيهات لما سلسلة الالتزام بتاعتك في خطر أو لما نكتشف نمط وضعية محتاج انتباه."
             :"Get notified when your streak is at risk or when we detect a posture pattern worth your attention."}
      </div>
      <div style={{ padding:"14px 16px", background:cs.inp,
        borderRadius:10, border:`1px solid ${cs.border}`,
        display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <div style={{ display:"flex", gap:12, alignItems:"center" }}>
          <span style={{ fontSize:22 }}>🔔</span>
          <div>
            <div style={{ fontSize:13, fontWeight:600, color:cs.text }}>
              {isAr?"إشعارات الدفع":"Push Notifications"}
            </div>
            <div style={{ fontSize:11, color:cs.muted, marginTop:2 }}>
              {enabled ? (isAr?"مفعّلة على الجهاز ده":"Enabled on this device")
                       : (isAr?"مش مفعّلة":"Not enabled")}
            </div>
          </div>
        </div>
        <button onClick={toggle} disabled={busy}
          style={{ padding:"7px 16px", borderRadius:99, border:"none", cursor:"pointer",
            fontSize:12, fontWeight:700,
            background: enabled ? "rgba(239,68,68,.12)" : "rgba(16,185,129,.15)",
            color: enabled ? "#f87171" : "#10b981" }}>
          {busy ? "…" : enabled ? (isAr?"إيقاف":"Disable") : (isAr?"تفعيل":"Enable")}
        </button>
      </div>

      {enabled && prefs && (
        <>
          <div style={{ padding:"12px 14px", background:"rgba(99,102,241,.06)", border:"1px solid rgba(99,102,241,.2)",
            borderRadius:10, marginBottom:12, fontSize:12, color:cs.text, lineHeight:1.6 }}>
            🧠 {isAr
              ? `بنفكرك في ${hourLabel(prefs.preferred_hour ?? prefs.computed_hour)} — الميعاد ده مبني على وقت جلساتك المعتادة.`
              : `We'll remind you around ${hourLabel(prefs.preferred_hour ?? prefs.computed_hour)} — based on when you usually do sessions.`}
          </div>

          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, fontWeight:600, color:cs.muted, marginBottom:8, textTransform:"uppercase", letterSpacing:".04em" }}>
              {isAr?"نوع الإشعارات":"Notification types"}
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <div key={key} onClick={()=>toggleCategory(key)} style={{
                  display:"flex", justifyContent:"space-between", alignItems:"center",
                  padding:"8px 12px", background:cs.inp, borderRadius:8, cursor:"pointer" }}>
                  <span style={{ fontSize:12.5, color:cs.text }}>{isAr?label.ar:label.en}</span>
                  <div style={{ width:36, height:20, borderRadius:99, position:"relative", transition:"background-color .15s",
                    background: prefs.categories?.[key]!==false ? "#10b981" : cs.inp }}>
                    <div style={{ width:16, height:16, borderRadius:"50%", background:"#fff", position:"absolute", top:2,
                      left: prefs.categories?.[key]!==false ? 18 : 2, transition:"left .15s" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {enabled && (
        <button onClick={sendTest} style={{ width:"100%", padding:"9px",
          background:"transparent", border:`1px solid ${cs.border}`, borderRadius:8,
          color:cs.muted, fontSize:12, fontWeight:600, cursor:"pointer" }}>
          {isAr?"بعت إشعار تجريبي":"Send test notification"}
        </button>
      )}
    </div>
  );
}

// ── Family/Partner Mode panel (Professional+) ─────────────────────
// Was a pricing-page promise ("+1 family/partner seat") with zero
// implementation. Backend: /api/family/status,invite,accept,remove
// (backend.py) + tier inheritance in auth/middleware.py.
function FamilyPartnerSettings({ cs, isAr, tier, onUpgrade, addToast }) {
  const [state, setState]   = useState("loading"); // loading | ready | error
  const [data,  setData]    = useState(null);
  const [email, setEmail]   = useState("");
  const [sending, setSending] = useState(false);
  const [removing, setRemoving] = useState(false);

  const load = () => {
    FamilyAPI.status()
      .then(res => { setData(res); setState("ready"); })
      .catch(() => setState("error"));
  };
  useEffect(() => { load(); }, []);

  const sendInvite = async () => {
    if (!email.trim() || sending) return;
    setSending(true);
    try {
      const res = await FamilyAPI.invite(email.trim());
      addToast?.(res.email_sent
        ? (isAr ? "✅ اتبعتت الدعوة" : "✅ Invite sent")
        : (isAr ? "اتسجلت الدعوة لكن الإيميل ما اتبعتش — جرب تاني" : "Invite created but the email didn't send — try again"),
        res.email_sent ? "success" : "warn");
      setEmail("");
      load();
    } catch (e) {
      addToast?.(e?.message || (isAr ? "تعذر إرسال الدعوة" : "Couldn't send the invite"), "error");
    } finally {
      setSending(false);
    }
  };

  const removeLink = async () => {
    if (removing) return;
    setRemoving(true);
    try {
      await FamilyAPI.remove();
      addToast?.(isAr ? "تم إلغاء الربط" : "Link removed", "success");
      load();
    } catch (e) {
      addToast?.(e?.message || (isAr ? "تعذر إلغاء الربط" : "Couldn't remove the link"), "error");
    } finally {
      setRemoving(false);
    }
  };

  if (state === "loading" || state === "error") return null; // fail quiet — same pattern as EarlyAccessPanel

  const isPro = tierAtLeast(tier, "professional");

  return (
    <div style={{ background:cs.card, border:`1px solid ${cs.border}`, borderRadius:12, padding:"20px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
        <span style={{ fontSize:18 }}>👨‍👩‍👧</span>
        <div style={{ fontSize:13, fontWeight:700, color:cs.text }}>
          {isAr?"وضع العائلة/الشريك":"Family/Partner Mode"}
        </div>
      </div>

      {data.is_partner_account ? (
        <div style={{ fontSize:12, color:cs.text, lineHeight:1.6 }}>
          {isAr ? "حسابك مربوط بحساب شخص تاني وبتاخد نفس صلاحيات باقته." : "Your account is linked to someone else's plan and inherits their tier access."}
          <button onClick={removeLink} disabled={removing} style={{ display:"block", marginTop:10, padding:"8px 14px",
            background:"rgba(239,68,68,.1)", border:"1px solid rgba(239,68,68,.25)", borderRadius:8,
            color:"#f87171", fontSize:11.5, fontWeight:600, cursor:"pointer" }}>
            {removing ? "…" : (isAr ? "إلغاء الربط" : "Unlink account")}
          </button>
        </div>
      ) : !isPro ? (
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ flex:1, fontSize:11.5, color:cs.muted, lineHeight:1.5 }}>
            {isAr?"رقّي لـ Pro عشان تشارك باقتك مع شخص واحد (شريك/فرد من العيلة) مجانًا":"Upgrade to Pro to share your plan with one family member or partner, free"}
          </div>
          <button onClick={onUpgrade} style={{ padding:"8px 16px", background:"#1a56db", border:"none",
            borderRadius:8, color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", flexShrink:0 }}>
            {isAr?"Pro":"Pro"}
          </button>
        </div>
      ) : data.partner ? (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ fontSize:12, color:cs.text }}>
            {isAr ? `مربوط بـ ${data.partner.name || data.partner.email}` : `Linked to ${data.partner.name || data.partner.email}`}
          </div>
          <button onClick={removeLink} disabled={removing} style={{ padding:"6px 12px",
            background:"rgba(239,68,68,.1)", border:"1px solid rgba(239,68,68,.25)", borderRadius:8,
            color:"#f87171", fontSize:11, fontWeight:600, cursor:"pointer" }}>
            {removing ? "…" : (isAr ? "إزالة" : "Remove")}
          </button>
        </div>
      ) : data.pending_invite ? (
        <div style={{ fontSize:12, color:cs.muted }}>
          {isAr ? `دعوة معلّقة لـ ${data.pending_invite.email} — في انتظار القبول` : `Pending invite to ${data.pending_invite.email} — waiting on acceptance`}
        </div>
      ) : (
        <div style={{ display:"flex", gap:8 }}>
          <input value={email} onChange={e=>setEmail(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&sendInvite()}
            placeholder={isAr?"إيميل الشريك/فرد العيلة":"Partner/family member's email"}
            style={{ flex:1, padding:"9px 12px", background:cs.inp, border:`1px solid ${cs.border}`,
              borderRadius:8, color:cs.text, fontSize:12.5, outline:"none" }} />
          <button onClick={sendInvite} disabled={sending || !email.trim()} style={{ padding:"9px 16px",
            background: email.trim() ? "#1a56db" : "rgba(26,86,219,.3)", border:"none", borderRadius:8,
            color:"#fff", fontSize:12, fontWeight:700, cursor: email.trim() ? "pointer" : "default" }}>
            {sending ? "…" : (isAr?"ادعُ":"Invite")}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Elite Early Access panel ──────────────────────────────────────
function EarlyAccessPanel({ cs, isAr, tier, onUpgrade }) {
  const [state, setState] = useState("loading"); // loading | ready | error
  const [data,  setData]  = useState(null);

  useEffect(() => {
    let cancelled = false;
    FeatureFlagsAPI.mine()
      .then(res => { if (!cancelled) { setData(res); setState("ready"); } })
      .catch(() => { if (!cancelled) setState("error"); });
    return () => { cancelled = true; };
  }, []);

  if (state === "loading" || state === "error") return null; // fail quiet — this is a perk, not critical UI

  const isElite = tierAtLeast(tier, "elite");

  if (!isElite) {
    return (
      <div style={{ background:cs.card, border:`1px solid ${cs.border}`, borderRadius:12, padding:"20px",
        display:"flex", alignItems:"center", gap:14 }}>
        <div style={{ fontSize:28 }}>🚀</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, fontWeight:700, color:cs.text, marginBottom:3 }}>
            {isAr?"Elite Early Access":"Elite Early Access"}
          </div>
          <div style={{ fontSize:11.5, color:cs.muted, lineHeight:1.5 }}>
            {data.count > 0
              ? (isAr ? `${data.count} فيتشرز جديدة بتتجرب دلوقتي — أعضاء Elite بيوصلولها الأول` : `${data.count} new features being tested right now — Elite members get them first`)
              : (isAr ? "جرّب كل فيتشر جديد قبل الكل بشهر" : "Try every new feature a month before everyone else")}
          </div>
        </div>
        <button onClick={onUpgrade} style={{ padding:"8px 16px", background:"linear-gradient(135deg,#d4af37,#b8860b)",
          border:"none", borderRadius:8, color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", flexShrink:0 }}>
          {isAr?"⭐ Elite":"⭐ Elite"}
        </button>
      </div>
    );
  }

  return (
    <div style={{ background:cs.card, border:`1px solid ${cs.border}`, borderRadius:12, padding:"20px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
        <span style={{ fontSize:18 }}>🚀</span>
        <div style={{ fontSize:13, fontWeight:700, color:cs.text }}>
          {isAr?"Early Access — حصري ليك":"Early Access — exclusive to you"}
        </div>
      </div>
      {data.flags.length === 0 ? (
        <div style={{ fontSize:12, color:cs.muted }}>
          {isAr?"مفيش فيتشرز تجريبية دلوقتي — هنبعتلك أول ما حاجة تتفتح.":"Nothing in testing right now — we'll notify you the moment something opens up."}
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {data.flags.map(f => (
            <div key={f.key} style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
              padding:"9px 12px", background:cs.inp, borderRadius:8 }}>
              <div style={{ fontSize:12, color:cs.text }}>{f.description}</div>
              <span style={{ fontSize:9, fontWeight:700, borderRadius:99, padding:"2px 8px",
                color: f.available_to_me ? "#10b981" : "#f59e0b",
                background: f.available_to_me ? "rgba(16,185,129,.12)" : "rgba(245,158,11,.12)" }}>
                {f.available_to_me
                  ? (isAr?"متاح ليك":"Live for you")
                  : (isAr?"قريب":"Coming soon")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Voice Coach upsell (shown below Elite) ───────────────────────
function VoiceCoachUpsell({ cs, isAr, onUpgrade }) {
  return (
    <div style={{ background:cs.card, border:`1px solid ${cs.border}`, borderRadius:12, padding:"20px",
      display:"flex", alignItems:"center", gap:14 }}>
      <div style={{ fontSize:28 }}>🎙️</div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:13, fontWeight:700, color:cs.text, marginBottom:3 }}>
          {isAr?"مدرب صوتي بلهجات عربية":"Voice Coach with Arabic accents"}
        </div>
        <div style={{ fontSize:11.5, color:cs.muted, lineHeight:1.5 }}>
          {isAr?"مصري، خليجي (سعودي/إماراتي) — حصري لأعضاء Elite":"Egyptian, Gulf (Saudi/Emirati) — exclusive to Elite members"}
        </div>
      </div>
      <button onClick={onUpgrade} style={{ padding:"8px 16px", background:"linear-gradient(135deg,#d4af37,#b8860b)",
        border:"none", borderRadius:8, color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", flexShrink:0 }}>
        {isAr?"⭐ Elite":"⭐ Elite"}
      </button>
    </div>
  );
}

// ── Voice Coach personalization block ───────────────────────────────
function VoiceCoachSettings({ cs, isAr, lang, addToast }) {
  const langKey = isAr ? "ar" : "en";
  const [prefs, setPrefsState] = useState(() => getVoicePrefs());
  const [voices, setVoices]    = useState([]);

  useEffect(() => {
    const load = () => setVoices(getAvailableVoices(langKey));
    load();
    // getVoices() can populate asynchronously in some browsers
    window.speechSynthesis?.addEventListener?.("voiceschanged", load);
    return () => window.speechSynthesis?.removeEventListener?.("voiceschanged", load);
  }, [langKey]);

  const locales = LOCALE_OPTIONS[langKey] || LOCALE_OPTIONS.en;
  const currentLocale = prefs.locale || locales[0].code;

  const update = (partial) => setPrefsState(setVoicePrefs(partial));

  const preview = () => {
    const text = isAr ? "كده صوتي هيبقى وأنت بتستخدم المدرب الصوتي." : "This is how I'll sound during your voice coaching sessions.";
    const ok = speakCoach(text, langKey, { force: true });
    if (!ok) addToast?.(isAr ? "المتصفح ده مش بيدعم الأصوات" : "This browser doesn't support speech voices", "error");
  };

  return (
    <div style={{ background:cs.card, border:`1px solid ${cs.border}`, borderRadius:12, padding:"20px" }}>
      <div style={{ fontSize:13, fontWeight:700, color:cs.text, marginBottom:6 }}>
        {isAr?"صوت المدرب":"Voice Coach"}
      </div>
      <div style={{ fontSize:12, color:cs.muted, marginBottom:16, lineHeight:1.6 }}>
        {isAr?"اختار اللهجة والصوت اللي يناسبك أثناء الجلسات المباشرة (خطة Elite)."
             :"Choose the accent and voice you'd like during live sessions (Elite plan)."}
      </div>

      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:11, fontWeight:600, color:cs.muted, marginBottom:6, textTransform:"uppercase", letterSpacing:".04em" }}>
          {isAr?"اللهجة":"Accent"}
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {locales.map(l => (
            <button key={l.code} onClick={()=>update({ locale:l.code, voiceURI:null })}
              style={{ padding:"7px 14px", borderRadius:99, cursor:"pointer", fontSize:12, fontWeight:600,
                border: currentLocale===l.code ? "1px solid rgba(16,185,129,.4)" : `1px solid ${cs.border}`,
                background: currentLocale===l.code ? "rgba(16,185,129,.12)" : "transparent",
                color: currentLocale===l.code ? "#10b981" : cs.muted }}>
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {voices.length > 0 && (
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:11, fontWeight:600, color:cs.muted, marginBottom:6, textTransform:"uppercase", letterSpacing:".04em" }}>
            {isAr?"الصوت":"Voice"}
          </div>
          <select value={prefs.voiceURI || ""} onChange={e=>update({ voiceURI: e.target.value || null })}
            style={{ width:"100%", background:cs.inp, border:`1px solid ${cs.border}`,
              borderRadius:8, color:cs.text, padding:"8px 10px", fontSize:12.5 }}>
            <option value="">{isAr?"تلقائي (أفضل مطابقة)":"Automatic (best match)"}</option>
            {voices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>)}
          </select>
        </div>
      )}

      <div style={{ display:"flex", gap:16, marginBottom:16 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:11, fontWeight:600, color:cs.muted, marginBottom:6, textTransform:"uppercase", letterSpacing:".04em" }}>
            {isAr?"السرعة":"Speed"}: {(prefs.rate ?? (isAr?0.95:1.0)).toFixed(2)}x
          </div>
          <input type="range" min="0.6" max="1.4" step="0.05"
            value={prefs.rate ?? (isAr?0.95:1.0)}
            onChange={e=>update({ rate: parseFloat(e.target.value) })}
            style={{ width:"100%" }} />
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:11, fontWeight:600, color:cs.muted, marginBottom:6, textTransform:"uppercase", letterSpacing:".04em" }}>
            {isAr?"طبقة الصوت":"Pitch"}: {(prefs.pitch ?? 1.0).toFixed(2)}
          </div>
          <input type="range" min="0.6" max="1.4" step="0.05"
            value={prefs.pitch ?? 1.0}
            onChange={e=>update({ pitch: parseFloat(e.target.value) })}
            style={{ width:"100%" }} />
        </div>
      </div>

      <button onClick={preview} style={{ width:"100%", padding:"9px",
        background:"rgba(16,185,129,.1)", border:"1px solid rgba(16,185,129,.25)", borderRadius:8,
        color:"#10b981", fontSize:12, fontWeight:700, cursor:"pointer" }}>
        🔊 {isAr?"تجربة الصوت":"Preview voice"}
      </button>
    </div>
  );
}


// SIDEBAR (desktop)
// ══════════════════════════════════════════════════════════════════
function Sidebar({ userRole, tab, setTab, profile, isAr, cs, setPage, startCamera,
  logOut, setUser, setProfile, isAdmin, darkMode, setDarkMode, setLang, lang, tier, atRisk,
  user, userSessions, setUserSessions, getAllUsers, setAllUsers,
  setShowCoach, setShowBilling, setShowGamification, setShowGrowthHub, setShowSecurityCenter,
  setShowAIInsights, setShowPredictiveAI, setShowCustomerSuccess, setShowChurnPrediction,
  setShowSymptomCorrelation,
  setShowAPIMarketplace, setShowWhiteLabel, setShowMultiTenant, setShowAuditSystem,
  setShowAIReports, setShowSessionComparison, setShowTrendChart, setShowWorkforceAnalytics,
  setShowCalibWizard, setShowDashboard,
}) {
  const nav = (()=>{
    if(userRole==="hr_admin"||userRole==="platform_admin") return [
      { id:"home",      icon:"⊞",  en:"Overview",   ar:"النظرة العامة" },
      { id:"employees", icon:"👥", en:"Employees",  ar:"الموظفون" },
      { id:"alerts",    icon:"🔔", en:"Alerts",     ar:"التنبيهات", badge:atRisk },
    ];
    if(userRole==="employee") return [
      { id:"home",     icon:"⊞",  en:"Dashboard", ar:"الرئيسية" },
      { id:"sessions", icon:"📋", en:"Sessions",  ar:"جلساتي" },
      { id:"team",     icon:"👥", en:"Team",       ar:"الفريق" },
      { id:"coach",    icon:"🤖", en:"AI Coach",   ar:"مدرب AI" },
    ];
    return [
      { id:"home",     icon:"⊞",  en:"Dashboard",  ar:"الرئيسية" },
      { id:"sessions", icon:"📋", en:"Sessions",   ar:"جلساتي" },
    ];
  })();

  const pro   = isPro(tier);
  const elite = isElite(tier);
  const isHR  = userRole==="hr_admin"||userRole==="platform_admin";
  const uid   = user?.uid;

  // Grouped by purpose instead of one flat list — Track/Improve (everyday,
  // free), Analytics & AI (deeper insight, tier-gated), Care (external
  // booking), Admin (elevated access only). Admin/Marketplace used to be
  // one-off buttons with their own styling wedged between the main nav and
  // Start Session — now they're regular entries in the same list, same style.
  const toolGroups = isHR ? [
    {
      id: "analytics",
      header: { en:"Analytics & AI", ar:"التحليلات والذكاء الاصطناعي" },
      items: [
        { id:"t-workforce", icon:"🏭", en:"Workforce",      ar:"قوى العمل",
          onClick:()=>{ getAllUsers?.().then(setAllUsers); setShowWorkforceAnalytics?.(true); }},
        { id:"t-reports",   icon:"📋", en:"Team Reports",   ar:"تقارير الفريق",
          locked:!pro, lockLabel:"PRO",
          onClick:()=>{ if(pro){ uid&&getUserSessions(uid).then(setUserSessions); setShowAIReports?.(true); } else setShowBilling?.(true); }},
        { id:"t-insights",  icon:"🧠", en:"AI Insights",    ar:"رؤى AI",
          locked:!elite, lockLabel:"ELITE",
          onClick:()=>{ if(elite){ uid&&getUserSessions(uid).then(setUserSessions); setShowAIInsights?.(true); } else setShowBilling?.(true); }},
        { id:"t-predict",   icon:"🔮", en:"Burnout AI",     ar:"AI إرهاق",
          locked:!elite, lockLabel:"ELITE",
          onClick:()=>{ if(elite){ uid&&getUserSessions(uid).then(setUserSessions); setShowPredictiveAI?.(true); } else setShowBilling?.(true); }},
      ],
    },
    {
      id: "enterprise",
      header: { en:"Enterprise", ar:"المؤسسات" },
      items: [
        { id:"t-audit", icon:"📜", en:"Audit Log",   ar:"سجل المراجعة", onClick:()=>setShowAuditSystem?.(true) },
        { id:"t-api",   icon:"🔌", en:"API Market",  ar:"سوق API",      onClick:()=>setShowAPIMarketplace?.(true) },
        { id:"t-wl",    icon:"🏷️", en:"White-label", ar:"علامتي التجارية", onClick:()=>setShowWhiteLabel?.(true) },
      ],
    },
    ...(isAdmin ? [{
      id: "admin",
      header: { en:"Platform Admin", ar:"إدارة المنصة" },
      items: [
        { id:"t-growth",  icon:"🚀", en:"Growth Hub",    ar:"مركز النمو",     onClick:()=>setShowGrowthHub?.(true) },
        { id:"t-success", icon:"💡", en:"Cust. Success", ar:"نجاح العملاء",   onClick:()=>setShowCustomerSuccess?.(true) },
        { id:"t-churn",   icon:"📉", en:"Churn AI",      ar:"توقع التسرب",   onClick:()=>setShowChurnPrediction?.(true) },
        { id:"t-tenant",  icon:"🏢", en:"Multi-tenant",  ar:"متعدد المستأجرين", onClick:()=>setShowMultiTenant?.(true) },
      ],
    }] : []),
  ] : [
    {
      id: "track",
      header: { en:"Track & Improve", ar:"المتابعة والتحسين" },
      items: [
        { id:"t-progress", icon:"🏆", en:"Progress",    ar:"التقدم", onClick:()=>setShowGamification?.(true) },
        { id:"t-symptoms", icon:"🩹", en:"Symptom Log", ar:"سجل الأعراض", onClick:()=>setShowSymptomCorrelation?.(true) },
      ],
    },
    {
      id: "analytics",
      header: { en:"Analytics & AI", ar:"التحليلات والذكاء الاصطناعي" },
      items: [
        { id:"t-coach",    icon:"🤖", en:"AI Coach",      ar:"AI Coach",
          locked:!pro, lockLabel:"PRO",
          onClick:()=>{ if(pro){ uid&&getUserSessions(uid).then(setUserSessions); setShowCoach?.(true); } else setShowBilling?.(true); }},
        { id:"t-reports",  icon:"📋", en:"AI Reports",    ar:"تقارير AI",
          locked:!pro, lockLabel:"PRO",
          onClick:()=>{ if(pro){ uid&&getUserSessions(uid).then(setUserSessions); setShowAIReports?.(true); } else setShowBilling?.(true); }},
        { id:"t-compare",  icon:"📊", en:"Compare",       ar:"مقارنة الجلسات",
          onClick:()=>{ uid&&getUserSessions(uid).then(setUserSessions); setShowSessionComparison?.(true); }},
        { id:"t-trend",    icon:"📈", en:"Trend",         ar:"مسار التحسن",
          onClick:()=>{ uid&&getUserSessions(uid).then(setUserSessions); setShowTrendChart?.(true); }},
        { id:"t-insights", icon:"🧠", en:"AI Insights",   ar:"رؤى AI",
          locked:!elite, lockLabel:"ELITE",
          onClick:()=>{ if(elite){ uid&&getUserSessions(uid).then(setUserSessions); setShowAIInsights?.(true); } else setShowBilling?.(true); }},
        { id:"t-predict",  icon:"🔮", en:"Predictive AI", ar:"AI تنبؤي",
          locked:!elite, lockLabel:"ELITE",
          onClick:()=>{ if(elite){ uid&&getUserSessions(uid).then(setUserSessions); setShowPredictiveAI?.(true); } else setShowBilling?.(true); }},
      ],
    },
    {
      id: "care",
      header: { en:"Care", ar:"الرعاية" },
      items: [
        { id:"t-marketplace", icon:"🩺", en:"Find a Physiotherapist", ar:"أخصائيو العلاج الطبيعي",
          onClick:()=>setPage("marketplace") },
      ],
    },
    ...(isAdmin ? [{
      id: "admin",
      header: { en:"Platform Admin", ar:"إدارة المنصة" },
      items: [
        { id:"t-admin",  icon:"🔧", en:"Platform Admin", ar:"منصة المشرف", onClick:()=>setPage("admin") },
        { id:"t-growth", icon:"🚀", en:"Growth Hub",     ar:"مركز النمو",  onClick:()=>setShowGrowthHub?.(true) },
      ],
    }] : []),
  ];

  const [hov, setHov] = useState(null);

  return (
    <aside style={{ width:236, flexShrink:0, height:"100dvh", position:"fixed", top:0, left:0,
      background:"rgba(4,9,20,.98)", borderRight:`1px solid ${cs.border}`, zIndex:50,
      display:"flex", flexDirection:"column" }}>

      {/* Logo */}
      <div style={{ padding:"16px 14px 12px", borderBottom:`1px solid ${cs.border}`, flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:30, height:30, background:"linear-gradient(135deg,#1a56db,#0891b2)",
            borderRadius:7, display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:16, flexShrink:0 }}>◈</div>
          <div>
            <div style={{ fontSize:13, fontWeight:800, color:"#f0f6ff", letterSpacing:"-.01em" }}>Corvus</div>
            <div style={{ fontSize:9, fontWeight:600, textTransform:"uppercase", letterSpacing:".06em",
              color: userRole==="platform_admin"?"#f87171":
                     userRole==="hr_admin"?"#34d399":
                     userRole==="employee"?"#60a5fa":"#3b82f6" }}>
              {tier==="elite"?"Elite ✦":tier==="professional"?"Pro":tier==="business"?"Business":"Free"}
              {" · "}
              {userRole==="platform_admin"?"🛡 Platform Admin":
               userRole==="hr_admin"?"🏢 Company HR":
               userRole==="employee"?"👤 Employee":"🧑‍💻 Individual"}
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column" }}>
        {/* Main nav */}
        <nav style={{ padding:"8px 8px 4px", display:"flex", flexDirection:"column", gap:2 }}>
          {nav.map(item=>(
            <button key={item.id} onClick={()=>setTab(item.id)}
              onMouseEnter={()=>setHov(item.id)} onMouseLeave={()=>setHov(null)}
              style={{ display:"flex", alignItems:"center", gap:9, width:"100%",
                padding:"8px 11px", border:"none", borderRadius:7, cursor:"pointer",
                borderLeft:tab===item.id?"2px solid #3b82f6":"2px solid transparent",
                background:tab===item.id?"rgba(59,130,246,.1)":hov===item.id?cs.inp:"transparent",
                color:tab===item.id?"#3b82f6":cs.muted,
                fontSize:12.5, fontWeight:tab===item.id?700:400, textAlign:isAr?"right":"left", transition:"all .1s" }}>
              <span style={{ fontSize:14, width:18, textAlign:"center" }}>{item.icon}</span>
              <span style={{ flex:1 }}>{isAr?item.ar:item.en}</span>
              {(item.badge||0)>0&&<span style={{ background:"#ef4444", color:"#fff", fontSize:9,
                fontWeight:700, borderRadius:99, padding:"1px 5px", minWidth:16, textAlign:"center" }}>{item.badge}</span>}
            </button>
          ))}
        </nav>

        {/* Start Session — the primary action, right under the main nav so it's
            never buried behind auxiliary links like Admin or Marketplace */}
        <div style={{ padding:"4px 8px 8px" }}>
          <button onClick={()=>{setPage("live");setTimeout(()=>startCamera?.(),200)}}
            style={{ width:"100%", padding:"9px", border:"none", borderRadius:8,
              background:"linear-gradient(135deg,#1a56db,#0891b2)", color:"#fff",
              fontSize:12.5, fontWeight:700, cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center", gap:8,
              boxShadow:"0 4px 12px rgba(26,86,219,.35)" }}>
            ▶ {isAr?"ابدأ جلسة":"Start Session"}
          </button>
        </div>

        {/* Grouped tool sections — each with its own header, instead of one
            flat undifferentiated list mixing free/Pro/Elite and admin-only
            items together */}
        {toolGroups.map(group=>(
          <div key={group.id}>
            <div style={{ borderTop:`1px solid ${cs.border}`, margin:"0 8px", padding:"8px 3px 4px" }}>
              <div style={{ fontSize:9, fontWeight:700, color:cs.muted,
                textTransform:"uppercase", letterSpacing:".1em", paddingLeft:8 }}>
                {isAr?group.header.ar:group.header.en}
              </div>
            </div>
            <div style={{ padding:"2px 8px 8px", display:"flex", flexDirection:"column", gap:1 }}>
              {group.items.map(tool=>(
                <button key={tool.id} onClick={tool.onClick}
                  onMouseEnter={()=>setHov(tool.id)} onMouseLeave={()=>setHov(null)}
                  style={{ display:"flex", alignItems:"center", gap:9, width:"100%",
                    padding:"7px 11px", border:"none", borderRadius:7, cursor:"pointer",
                    background:hov===tool.id&&!tool.locked?cs.inp:"transparent",
                    color:tool.locked?cs.muted:cs.text,
                    fontSize:12, fontWeight:500, textAlign:isAr?"right":"left", transition:"all .1s" }}>
                  <span style={{ fontSize:13, width:18, textAlign:"center", opacity:tool.locked?.45:1 }}>{tool.icon}</span>
                  <span style={{ flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {isAr&&tool.ar ? tool.ar : tool.en}
                  </span>
                  {tool.locked&&(
                    <span style={{ fontSize:8,
                      background:tool.lockLabel==="ELITE"?"rgba(168,85,247,.18)":"rgba(245,158,11,.18)",
                      color:tool.lockLabel==="ELITE"?"#c084fc":"#f59e0b",
                      padding:"1px 5px", borderRadius:3, fontWeight:700, flexShrink:0 }}>
                      {tool.lockLabel}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer — Settings entry point */}
      <div style={{ padding:"8px 8px 12px", borderTop:`1px solid ${cs.border}`, flexShrink:0 }}>
        {/* Lang + Dark mode row */}
        <div style={{ display:"flex", gap:5, marginBottom:8 }}>
          <button onClick={()=>setLang(lang==="ar"?"en":"ar")}
            style={{ flex:1, padding:"5px", background:cs.inp,
              border:`1px solid ${cs.border}`, borderRadius:6, color:cs.muted, fontSize:11, cursor:"pointer" }}>
            {lang==="ar"?"🇬🇧 EN":"🇪🇬 عربي"}
          </button>
          <button onClick={()=>setDarkMode(!darkMode)}
            style={{ padding:"5px 9px", background:cs.inp,
              border:`1px solid ${cs.border}`, borderRadius:6, color:cs.muted, fontSize:11, cursor:"pointer" }}>
            {darkMode?"☀️":"🌙"}
          </button>
        </div>
        {/* User card — click → Settings */}
        <button onClick={()=>setTab("settings")}
          style={{ width:"100%", display:"flex", alignItems:"center", gap:8,
            padding:"8px 9px", background:cs.inp,
            border:`1px solid ${cs.border}`, borderRadius:9, cursor:"pointer",
            textAlign:isAr?"right":"left", transition:"background .12s" }}
          onMouseEnter={e=>e.currentTarget.style.background="rgba(59,130,246,.08)"}
          onMouseLeave={e=>e.currentTarget.style.background=cs.inp}>
          <Avatar name={profile?.name||profile?.email} photo={profile?.photoURL} size={28}/>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:11, fontWeight:600, color:"#f0f6ff",
              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {profile?.name||user?.displayName||profile?.email?.split("@")[0]||"—"}
            </div>
            <div style={{ fontSize:9.5, color:cs.muted,
              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {isAr?"⚙️ الإعدادات":"⚙️ Settings"}
            </div>
          </div>
          <span style={{ fontSize:11, color:cs.muted, flexShrink:0 }}>›</span>
        </button>
      </div>
    </aside>
  );
}

// ── Mobile nav ────────────────────────────────────────────────────
function MobileNav({ userRole, tab, setTab, setPage, startCamera, isAr, cs, atRisk, profile,
  tools, setShowCoach, setShowBilling }) {
  const [showMore, setShowMore] = useState(false);

  const tabs = userRole==="hr_admin"||userRole==="platform_admin" ? [
    { id:"home",      icon:"⊞", en:"Overview", ar:"نظرة" },
    { id:"employees", icon:"👥",en:"Team",      ar:"فريق" },
    { id:"live",      icon:"▶",  en:"Session",  ar:"جلسة", special:true },
    { id:"alerts",    icon:"🔔",en:"Alerts",    ar:"تنبيهات", badge:atRisk },
    { id:"sessions",  icon:"📋",en:"History",   ar:"السجل" },
  ] : userRole==="employee" ? [
    { id:"home",     icon:"⊞", en:"Home",    ar:"الرئيسية" },
    { id:"team",     icon:"👥",en:"Team",     ar:"الفريق" },
    { id:"live",     icon:"▶",  en:"Session", ar:"جلسة", special:true },
    { id:"sessions", icon:"📋",en:"History",  ar:"السجل" },
  ] : [
    { id:"home",     icon:"⊞", en:"Home",    ar:"الرئيسية" },
    { id:"sessions", icon:"📋",en:"History", ar:"السجل" },
    { id:"live",     icon:"▶",  en:"Session", ar:"جلسة", special:true },
    { id:"analytics",icon:"📊",en:"Analytics",ar:"تحليلات" },
  ];

  return (
    <>
      {/* Tools Drawer */}
      {showMore && (
        <div style={{ position:"fixed", inset:0, zIndex:299 }} onClick={()=>setShowMore(false)}>
          <div onClick={e=>e.stopPropagation()} style={{
            position:"fixed", bottom:64, left:8, right:8, zIndex:300,
            background:"rgba(5,16,31,.98)", border:"1px solid rgba(148,163,184,.12)",
            borderRadius:16, padding:"16px 12px",
            boxShadow:"0 -8px 40px rgba(0,0,0,.5)",
          }}>
            <div style={{ fontSize:10, color:"#64748b", fontWeight:700, textTransform:"uppercase",
              letterSpacing:1, marginBottom:12, paddingLeft:4 }}>
              {isAr ? "الأدوات" : "Tools"}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
              {(tools||[]).map(t=>(
                <button key={t.id} onClick={()=>{ t.onClick?.(); setShowMore(false); }}
                  style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4,
                    padding:"10px 6px", background:cs.inp,
                    border:`1px solid ${cs.border}`, borderRadius:10,
                    cursor:"pointer" }}>
                  <span style={{ fontSize:20 }}>{t.icon}</span>
                  <span style={{ fontSize:9, color:"#94a3b8", fontWeight:600, textAlign:"center",
                    lineHeight:1.2 }}>{isAr?t.ar:t.en}</span>
                </button>
              ))}
              {/* Settings shortcut */}
              <button onClick={()=>{ setTab("settings"); setShowMore(false); }}
                style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4,
                  padding:"10px 6px", background:cs.inp,
                  border:`1px solid ${cs.border}`, borderRadius:10, cursor:"pointer" }}>
                <span style={{ fontSize:20 }}>⚙️</span>
                <span style={{ fontSize:9, color:"#94a3b8", fontWeight:600 }}>{isAr?"إعدادات":"Settings"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <nav style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:200,
        background:"rgba(4,9,20,1)", borderTop:`1px solid ${cs.border}`,
        display:"flex",
        padding:`6px 0 max(6px,env(safe-area-inset-bottom))` }}>
        {tabs.map(t=>(
          <button key={t.id}
            onClick={()=>t.id==="live"?(setPage("live"),setTimeout(()=>startCamera?.(),200)):setTab(t.id)}
            style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center",
              gap:3, padding:"4px 0", background:"none", border:"none", cursor:"pointer",
              position:"relative" }}>
            {t.special ? (
              <div style={{ width:42, height:42, borderRadius:"50%",
                background:"linear-gradient(135deg,#1a56db,#0891b2)",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:17, color:"#fff", marginTop:-14,
                boxShadow:"0 4px 14px rgba(26,86,219,.5)" }}>▶</div>
            ) : (
              <>
                <span style={{ fontSize:17, color:tab===t.id?"#3b82f6":cs.muted }}>
                  {t.icon}
                </span>
                {(t.badge||0)>0&&(
                  <span style={{ position:"absolute", top:0, right:"15%",
                    background:"#ef4444", color:"#fff", fontSize:8, fontWeight:700,
                    borderRadius:99, padding:"0 4px", minWidth:14, textAlign:"center" }}>
                    {t.badge}
                  </span>
                )}
              </>
            )}
            {!t.special&&(
              <span style={{ fontSize:9, fontWeight:tab===t.id?700:400,
                color:tab===t.id?"#3b82f6":cs.muted }}>
                {isAr?t.ar:t.en}
              </span>
            )}
          </button>
        ))}
        {/* More button */}
        <button onClick={()=>setShowMore(o=>!o)}
          style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center",
            gap:3, padding:"4px 0", background:"none", border:"none", cursor:"pointer" }}>
          <span style={{ fontSize:17, color:showMore?"#3b82f6":cs.muted }}>⋯</span>
          <span style={{ fontSize:9, fontWeight:600, color:showMore?"#3b82f6":cs.muted }}>
            {isAr?"المزيد":"More"}
          </span>
        </button>
      </nav>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ══════════════════════════════════════════════════════════════════
export default function HomePage({
  user, profile, setProfile, cs, lang, isAr, dir,
  userSessions, setUserSessions, allUsers, setAllUsers,
  tier, setTier, mode, setMode,
  setPage, startCamera, addToast, goToBreak,
  setShowCoach, setShowBilling, setShowCompanyOnboard,
  setShowDashboard, setShowWorkforceAnalytics, setShowAIReports,
  setShowCalibWizard, setShowGamification,
  setShowSessionComparison, setShowTrendChart,
  setShowAIInsights, setShowGrowthHub, setShowSecurityCenter,
  setShowSymptomCorrelation,
  setShowCustomerSuccess, setShowChurnPrediction,
  setShowAPIMarketplace, setShowWhiteLabel,
  setShowMultiTenant, setShowAuditSystem,
  setShowPredictiveAI, setShowMRR, setShowChangelog,
  setShowNotificationsHub, setShowEnterpriseRBAC,
  setShowBillingDashboard, setShowReferralProgram, setShowIntegrationsHub,
  setShowMFASetup, setShowChangePw, setShowProductTour,
  isAdmin, isHRAdmin, companyId,
  darkMode, setDarkMode, setLang,
  t, logOut, setUser,
  downloadPDF,
  downloadClinicalPDF,
  downloadComparisonPDF,
  downloadTeamPDF,
  downloadLongitudinalPDF,
  downloadPostureDNAReport,
  shareReport,
  AccountSwitcher, onSwitchAccount,
  NavAvatarDropdown,
  onQuarterlyReport,
  onSchools,
  onDevPortal,
  onInsurance,
  setShowCertModal,
}) {
  const [tab,    setTab]    = useState("home");
  const [mobile, setMobile] = useState(()=>typeof window!=="undefined" && window.matchMedia("(max-width:767px)").matches);
  // Default currency by timezone — Egypt → EGP (Kashier), everyone else → USD (Stripe).
  // Matches the same Egypt/Gulf split documented in Billing.jsx. User can still toggle.
  const [currency, setCurrency] = useState(()=>{
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return tz === "Africa/Cairo" ? "EGP" : "USD";
    } catch { return "EGP"; }
  });

  useEffect(()=>{
    const mq = window.matchMedia("(max-width:767px)");
    const fn=(e)=>setMobile(e.matches);
    mq.addEventListener("change",fn);
    return ()=>mq.removeEventListener("change",fn);
  },[]);

  const userRole = role(profile, isAdmin, isHRAdmin);
  const atRisk   = useMemo(()=>(allUsers||[]).filter(u=>(u.avg_score||0)>0&&(u.avg_score||0)<50).length,[allUsers]);

  const openCoach    = useCallback(()=>setShowCoach?.(true),[setShowCoach]);
  const openBilling  = useCallback(()=>setShowBilling?.(true),[setShowBilling]);
  const openInvite   = useCallback(()=>setShowCompanyOnboard?.(true),[setShowCompanyOnboard]);
  const openAnalytics= useCallback(()=>{ getUserSessions(user.uid).then(setUserSessions).catch(()=>{}); setShowDashboard?.(true); },[setShowDashboard,user]);
  const openWorkforce= useCallback(()=>{ getAllUsers().then(setAllUsers).catch(()=>{}); setShowWorkforceAnalytics?.(true); },[setShowWorkforceAnalytics]);
  const openReports  = useCallback(()=>{ getUserSessions(user.uid).then(setUserSessions).catch(()=>{}); setShowAIReports?.(true); },[setShowAIReports,user]);
  const openCalib    = useCallback(()=>setShowCalibWizard?.(true),[setShowCalibWizard]);

  const handleSignOut = useCallback(()=>{ logOut?.(); setUser?.(null); setProfile?.(null); },[logOut,setUser,setProfile]);

  const handleDeleteSession = useCallback(async(id)=>{
    await deleteSession(id);
    setUserSessions(p=>p.filter(s=>s.id!==id));
  },[setUserSessions]);

  const handleTrend = useCallback(()=>setShowTrendChart?.(true),[setShowTrendChart]);

  // ── Tools (for sidebar + mobile nav) ─────────────────────────────
  const isPro_   = tierAtLeast(tier, "professional");
  const tools = [
    { id:"t-progress", icon:"🏆", en:"Progress",    ar:"التقدم",
      onClick:()=>setShowGamification?.(true) },
    ...(isAdmin ? [{ id:"t-growth", icon:"🚀", en:"Growth Hub", ar:"مركز النمو",
      onClick:()=>setShowGrowthHub?.(true) }] : []),
    { id:"t-coach",    icon:"🤖", en:"AI Coach",    ar:"AI Coach",
      onClick:()=>setShowCoach?.(true) },
    { id:"t-insights", icon:"📊", en:"AI Insights", ar:"تحليلات ذكية",
      onClick:()=>setShowAIInsights?.(true) },
    { id:"t-calib",    icon:"🎯", en:"Calibrate",   ar:"معايرة",
      onClick:()=>setShowCalibWizard?.(true) },
    { id:"t-break",    icon:"🧘", en:"Movement Break", ar:"استراحة حركة",
      onClick:()=>goToBreak?.() },
    { id:"t-reports",  icon:"📋", en:"AI Reports",  ar:"تقارير AI",
      locked:!isPro_, lockLabel:"PRO",
      onClick:()=>isPro_&&setShowAIReports?.(true) },
    { id:"t-security", icon:"🔒", en:"Security",    ar:"الأمان",
      onClick:()=>setShowSecurityCenter?.(true) },
    { id:"t-marketplace", icon:"🩺", en:"Find a Physio", ar:"أخصائي علاج طبيعي",
      onClick:()=>setPage("marketplace") },
    { id:"t-symptoms", icon:"🩹", en:"Symptom Log", ar:"سجل الأعراض",
      onClick:()=>setShowSymptomCorrelation?.(true) },
    ...(isAdmin ? [
      { id:"t-mrr",    icon:"💰", en:"Revenue",     ar:"الإيرادات",
        onClick:()=>setShowMRR?.(true) },
      { id:"t-audit",  icon:"📝", en:"Audit Log",   ar:"سجل التدقيق",
        onClick:()=>setShowAuditSystem?.(true) },
    ] : []),
  ];

  const tabLabels = { en:{ home:"Dashboard",employees:"Employees",analytics:"Analytics",
    alerts:"Alerts",sessions:"Sessions",team:"Team",settings:"Settings" },
    ar:{ home:"الرئيسية",employees:"الموظفون",analytics:"التحليلات",
    alerts:"التنبيهات",sessions:"الجلسات",team:"الفريق",settings:"الإعدادات" }};

  // ── Render tab content ─────────────────────────────────────────
  // Settings NOT in useMemo so profile updates re-render immediately
  const settingsContent = tab==="settings" ? (
    <PanelSettings user={user} profile={profile} setProfile={setProfile}
      cs={cs} isAr={isAr} addToast={addToast} onSignOut={handleSignOut}
      tier={tier} onBilling={openBilling}
      onBillingHistory={()=>setShowBillingDashboard?.(true)}
      onReferral={()=>setShowReferralProgram?.(true)}
      onNotifications={()=>setShowNotificationsHub?.(true)}
      onIntegrations={()=>setShowIntegrationsHub?.(true)}
      onMFA={()=>setShowMFASetup?.(true)}
      onChangePassword={()=>setShowChangePw?.(true)}
      lang={lang} setLang={setLang} darkMode={darkMode} setDarkMode={setDarkMode}
      AccountSwitcher={AccountSwitcher} onSwitchAccount={onSwitchAccount}/>
  ) : null;

  const content = useMemo(()=>{
    if(tab==="settings") return null; // rendered separately above

    if(userRole==="hr_admin"||userRole==="platform_admin") {
      if(tab==="home"||tab==="employees") return (
        <DashHR profile={profile} allUsers={allUsers} cs={cs} isAr={isAr}
          addToast={addToast} onBilling={openBilling} onInvite={openInvite}
          onAnalytics={openAnalytics} onWorkforce={openWorkforce} onReports={openReports}
          onQuarterlyReport={onQuarterlyReport}
          onDevPortal={onDevPortal} onInsurance={onInsurance}/>
      );
      if(tab==="analytics") { openAnalytics(); setTab("home"); return null; }
      if(tab==="alerts") return (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {atRisk===0 ? <EmptyBlock icon="✅" cs={cs}
            title={isAr?"لا توجد تنبيهات":"No alerts"}
            desc={isAr?"كل الموظفين بوضعية جيدة":"All employees have healthy posture scores"}/> :
            (allUsers||[]).filter(u=>(u.avg_score||0)>0&&(u.avg_score||0)<50).map((u,i)=>(
              <div key={i} style={{ background:"rgba(239,68,68,.06)", border:"1px solid rgba(239,68,68,.18)",
                borderRadius:12, padding:"14px 18px", display:"flex", gap:12, alignItems:"center" }}>
                <Avatar name={u.name||u.email} photo={u.photoURL} size={40}/>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:"#f0f6ff" }}>{u.name||u.email}</div>
                  <div style={{ fontSize:12, color:cs.muted }}>
                    {isAr?"وضعية:":"Score:"} {u.avg_score||0} · {u.department||""}
                  </div>
                </div>
                <button onClick={()=>addToast(`${isAr?"تم إرسال تنبيه لـ":"Alert sent to"} ${u.name||u.email}`,"success")}
                  style={{ padding:"7px 14px", background:"#ef4444", color:"#fff",
                    border:"none", borderRadius:7, fontSize:12, fontWeight:700, cursor:"pointer" }}>
                  {isAr?"أرسل تنبيه":"Alert"}
                </button>
              </div>
            ))}
        </div>
      );
    }

    if(userRole==="employee") {
      // Strip sensitive fields — employees only see name, avatar, score, department
      const teamData = (allUsers||[]).filter(u=>u.company_id===profile?.company_id).map(u=>({
        uid:u.uid, id:u.id, name:u.name, photoURL:u.photoURL,
        avg_score:u.avg_score, department:u.department,
      }));
      if(tab==="home"||tab==="team"||tab==="coach") return (
        <DashEmployee user={user} profile={profile} userSessions={userSessions} allUsers={teamData}
          cs={cs} isAr={isAr} setPage={setPage} startCamera={startCamera}
          onCoach={openCoach} addToast={addToast} tier={tier} tab={tab}/>
      );
      if(tab==="sessions") return (
        <PanelSessions userSessions={userSessions} profile={profile} cs={cs} isAr={isAr}
          setPage={setPage} startCamera={startCamera}
          onDownloadPDF={downloadPDF} onDownloadClinicalPDF={(s)=>downloadPDF(s,true)} onComparisonPDF={downloadComparisonPDF} onTeamPDF={downloadTeamPDF} onLongitudinalPDF={downloadLongitudinalPDF} onPostureDNA={downloadPostureDNAReport} onShareReport={shareReport} tier={tier} isHRAdmin={isHRAdmin}
          onDeleteSession={handleDeleteSession}
          onTrend={handleTrend}/>
      );
    }

    // Individual
    if(tab==="sessions") return (
      <PanelSessions userSessions={userSessions} profile={profile} cs={cs} isAr={isAr}
        setPage={setPage} startCamera={startCamera}
        onDownloadPDF={downloadPDF} onDownloadClinicalPDF={(s)=>downloadPDF(s,true)} onComparisonPDF={downloadComparisonPDF} onTeamPDF={downloadTeamPDF} onLongitudinalPDF={downloadLongitudinalPDF} onPostureDNA={downloadPostureDNAReport} onShareReport={shareReport} tier={tier} isHRAdmin={isHRAdmin}
        onDeleteSession={handleDeleteSession}
        onTrend={handleTrend}/>
    );

    return (
      <DashIndividual user={user} profile={profile} userSessions={userSessions} setUserSessions={setUserSessions} tier={tier}
        cs={cs} isAr={isAr} setPage={setPage} startCamera={startCamera}
        onCoach={openCoach} onBilling={openBilling} onAnalytics={openAnalytics}
        onCalib={openCalib} onReports={openReports} addToast={addToast}
        onDownloadPDF={downloadPDF} onDownloadClinicalPDF={(s)=>downloadPDF(s,true)} onComparisonPDF={downloadComparisonPDF} onTeamPDF={downloadTeamPDF} onLongitudinalPDF={downloadLongitudinalPDF} onShareReport={shareReport}
        isAdmin={isAdmin} isHRAdmin={isHRAdmin}
        setShowGamification={setShowGamification}
        setShowGrowthHub={setShowGrowthHub}
        setShowSecurityCenter={setShowSecurityCenter}
        setShowAIInsights={setShowAIInsights}
        setShowPredictiveAI={setShowPredictiveAI}
        setShowCustomerSuccess={setShowCustomerSuccess}
        setShowChurnPrediction={setShowChurnPrediction}
        setShowAPIMarketplace={setShowAPIMarketplace}
        setShowWhiteLabel={setShowWhiteLabel}
        setShowMultiTenant={setShowMultiTenant}
        setShowAuditSystem={setShowAuditSystem}
        setShowDashboard={setShowDashboard}
        setShowCoach={setShowCoach}
        setShowCalibWizard={setShowCalibWizard}
        setShowBilling={setShowBilling}
        setShowAIReports={setShowAIReports}
        setShowSessionComparison={setShowSessionComparison}
        setShowTrendChart={setShowTrendChart}
        setShowWorkforceAnalytics={setShowWorkforceAnalytics}
        getAllUsers={getAllUsers} setAllUsers={setAllUsers}
        onCompare={()=>setShowSessionComparison?.(true)} onTrend={()=>setShowTrendChart?.(true)}
        setShowCertModal={setShowCertModal}
        onDevPortal={onDevPortal}
        onInsurance={onInsurance}/>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[tab, userRole, user, profile, userSessions, allUsers, tier, isAr, cs, atRisk, isHRAdmin, isAdmin, downloadPDF, handleDeleteSession, handleTrend, openCoach, openBilling, openAnalytics, openCalib, openReports, currency, setCurrency]);

  return (
    <div dir={dir} style={{ display:"flex", minHeight:"100dvh",
      background:cs.bg||"#0d1a2e", color:cs.text||"#f0f6ff",
      fontFamily:"'IBM Plex Sans Arabic',system-ui,-apple-system,'Segoe UI',sans-serif" }}>

      {!mobile && <Sidebar userRole={userRole} tab={tab} setTab={setTab} profile={profile}
          isAr={isAr} cs={cs} setPage={setPage} startCamera={startCamera}
          logOut={logOut} setUser={setUser} setProfile={setProfile}
          isAdmin={isAdmin} darkMode={darkMode} setDarkMode={setDarkMode}
          setLang={setLang} lang={lang} tier={tier} atRisk={atRisk}
          user={user} userSessions={userSessions} setUserSessions={setUserSessions}
          getAllUsers={getAllUsers} setAllUsers={setAllUsers}
          setShowCoach={setShowCoach} setShowBilling={setShowBilling}
          setShowGamification={setShowGamification} setShowGrowthHub={setShowGrowthHub}
          setShowSecurityCenter={setShowSecurityCenter} setShowAIInsights={setShowAIInsights}
          setShowSymptomCorrelation={setShowSymptomCorrelation}
          setShowPredictiveAI={setShowPredictiveAI} setShowCustomerSuccess={setShowCustomerSuccess}
          setShowChurnPrediction={setShowChurnPrediction} setShowAPIMarketplace={setShowAPIMarketplace}
          setShowWhiteLabel={setShowWhiteLabel} setShowMultiTenant={setShowMultiTenant}
          setShowAuditSystem={setShowAuditSystem} setShowAIReports={setShowAIReports}
          setShowSessionComparison={setShowSessionComparison} setShowTrendChart={setShowTrendChart}
          setShowWorkforceAnalytics={setShowWorkforceAnalytics}
          setShowCalibWizard={setShowCalibWizard} setShowDashboard={setShowDashboard}
        />}

      <main style={{ flex:1, minWidth:0, marginLeft:mobile?0:236, display:"flex", flexDirection:"column" }}>
        <div style={{ flex:1, overflowY:"auto", paddingBottom:mobile?80:0 }}>
        {/* Topbar */}
        <header style={{ position:"sticky", top:0, zIndex:100,
          background:"rgba(4,9,20,1)", borderBottom:`1px solid ${cs.border}`,
          padding:"0 20px", height:50,
          display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
          {mobile&&(
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:26, height:26, background:"linear-gradient(135deg,#1a56db,#0891b2)",
                borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:14 }}>◈</div>
              <span style={{ fontSize:13, fontWeight:800, color:"#f0f6ff" }}>Corvus</span>
            </div>
          )}
          <div style={{ fontSize:14, fontWeight:700, color:"#f0f6ff" }}>
            {isAr?tabLabels.ar[tab]:tabLabels.en[tab]||"Dashboard"}
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <button onClick={()=>{setPage("live");setTimeout(()=>startCamera?.(),200)}}
              style={{ padding:"6px 12px", background:"rgba(26,86,219,.15)",
                border:"1px solid rgba(59,130,246,.3)", borderRadius:7,
                color:"#60a5fa", fontSize:12, fontWeight:600, cursor:"pointer" }}>
              ▶ {isAr?"جلسة":"Session"}
            </button>
            {NavAvatarDropdown ? (
              <NavAvatarDropdown
                user={user} profile={profile} cs={cs} lang={lang} isAr={isAr}
                isAdmin={isAdmin} isHRAdmin={isHRAdmin}
                onProfile={()=>setTab("settings")}
                onLeaderboard={()=>setPage("leaderboard")}
                onHR={()=>setPage("hr")}
                onAdmin={()=>setPage("admin")}
                onSetup={()=>setPage("setup")}
                onOnboarding={openCalib}
                onTour={()=>setShowProductTour?.(true)}
                onSignOut={handleSignOut}
              />
            ) : (
              <button onClick={()=>setTab("settings")}
                style={{ background:"none", border:"none", cursor:"pointer", padding:0 }}>
                <Avatar name={profile?.name||profile?.email} photo={profile?.photoURL} size={30}/>
              </button>
            )}
          </div>
        </header>

        <div style={{ padding:"14px 16px", maxWidth:1060, margin:"0 auto" }}>
          {settingsContent || content}
        </div>
        </div>
      </main>

      {mobile&&(
        <MobileNav userRole={userRole} tab={tab} setTab={setTab}
          setPage={setPage} startCamera={startCamera}
          isAr={isAr} cs={cs} atRisk={atRisk} profile={profile}
          tools={tools}
          setShowCoach={setShowCoach} setShowBilling={setShowBilling}/>
      )}
    </div>
  );
}


