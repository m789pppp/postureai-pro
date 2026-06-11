/**
 * PostureAI Pro — HomePage v4
 * Complete rewrite: proper role separation, working tools, real data, tier gates
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { getUserSessions, getAllUsers, updateUserProfile } from "./firebase.js";

// ─── Role detection ────────────────────────────────────────────────
function role(profile, isAdmin, isHRAdmin) {
  if (isAdmin) return "platform_admin";
  if (isHRAdmin || profile?.is_org_owner || profile?.is_hr || profile?.user_type === "hr_admin") return "hr_admin";
  if (profile?.company_id && profile?.user_type !== "hr_admin") return "employee";
  return "individual";
}

// ─── Tier helpers ──────────────────────────────────────────────────
const PRO_TIERS  = ["professional","elite","business"];
const ELITE_TIERS= ["elite","business"];
function isPro(tier)   { return PRO_TIERS.includes(tier);   }
function isElite(tier) { return ELITE_TIERS.includes(tier); }

// ─── Avatar (photo or initial + color) ────────────────────────────
function Avatar({ name, photo, size = 36, style = {} }) {
  const label = (name||"User");
  const ch    = label[0].toUpperCase();
  const hue   = label.split("").reduce((a,c)=>a+c.charCodeAt(0),0) % 360;
  if(photo) return (
    <img src={photo} alt={label}
      style={{ width:size, height:size, borderRadius:"50%", flexShrink:0,
        objectFit:"cover", border:"2px solid rgba(255,255,255,.08)", ...style }}/>
  );
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: `hsl(${hue},55%,32%)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontWeight: 700, color: "#fff",
      border: "2px solid rgba(255,255,255,.08)",
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
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth={6}/>
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

// ─── Week bar chart ────────────────────────────────────────────────
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
        const c=d.score>=80?"#10b981":d.score>=60?"#f59e0b":d.has?"#ef4444":"rgba(255,255,255,.07)";
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

// ══════════════════════════════════════════════════════════════════
// INDIVIDUAL DASHBOARD
// ══════════════════════════════════════════════════════════════════
function DashIndividual({ profile, userSessions, tier, cs, isAr, setPage, startCamera,
  onCoach, onBilling, onAnalytics, onCalib, onReports, onCompare, onTrend, addToast }) {

  const last   = userSessions[0]?.avg_score||0;
  const avg    = userSessions.length ? Math.round(userSessions.reduce((a,s)=>a+(s.avg_score||0),0)/userSessions.length) : 0;
  const month  = userSessions.filter(s=>{ const d=s.created_at?.toDate?.()??new Date(s.created_at||0); const n=new Date(); return d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear(); }).length;
  const streak = profile?.streak_days||0;
  const pro    = isPro(tier);
  const elite  = isElite(tier);

  const grade = s => s>=80?(isAr?"ممتاز":"Excellent"):s>=60?(isAr?"جيد":"Good"):s>0?(isAr?"ضعيف":"Poor"):"—";
  const gradeColor = s => s>=80?"#10b981":s>=60?"#f59e0b":"#ef4444";

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

      {/* Hero card */}
      <div style={{ background:cs.card, border:`1px solid ${cs.border}`, borderRadius:14,
        padding:"22px", display:"flex", gap:20, alignItems:"center", flexWrap:"wrap" }}>
        <Ring score={last||avg} size={104}/>
        <div style={{ flex:1, minWidth:180 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
            <Avatar name={profile?.name||profile?.email} photo={profile?.photoURL} size={36}/>
            <div>
              <div style={{ fontSize:18, fontWeight:800, color:cs.text, lineHeight:1.1 }}>
                {isAr?`أهلاً, ${profile?.name?.split(" ")[0] || profile?.email?.split("@")[0] || ""}!`:`Hey, ${profile?.name?.split(" ")[0] || profile?.email?.split("@")[0] || "there"}!`}
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
          <button onClick={()=>{setPage("live");setTimeout(()=>startCamera?.(),200)}}
            style={{ padding:"10px 22px", background:"linear-gradient(135deg,#1a56db,#0891b2)",
              color:"#fff", border:"none", borderRadius:8, fontSize:13, fontWeight:700,
              cursor:"pointer", boxShadow:"0 4px 14px rgba(26,86,219,.4)" }}>
            {isAr?"▶ ابدأ جلسة":"▶ Start Session"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))", gap:10 }}>
        <StatCard label={isAr?"آخر جلسة":"Last Session"} value={last||"—"} color={gradeColor(last)} cs={cs}/>
        <StatCard label={isAr?"المتوسط":"Average"} value={avg||"—"} color="#3b82f6" cs={cs}/>
        <StatCard label={isAr?"هذا الشهر":"This Month"} value={month||"—"} sub={isAr?"جلسة":"sessions"} color="#f59e0b" cs={cs}/>
        <StatCard label={isAr?"الإجمالي":"Total"} value={userSessions.length||"—"} sub={isAr?"جلسة":"sessions"} color="#a855f7" cs={cs}/>
      </div>

      {/* Week chart */}
      {userSessions.length>0&&(
        <div style={{ background:cs.card, border:`1px solid ${cs.border}`, borderRadius:12, padding:"16px 18px" }}>
          <SectionHead title={isAr?"آخر 7 أيام":"Last 7 days"} cs={cs}/>
          <WeekChart sessions={userSessions} cs={cs}/>
        </div>
      )}

      {/* Free tier notice */}
      {!pro&&(
        <div style={{ background:"linear-gradient(135deg,rgba(26,86,219,.08),rgba(8,145,178,.05))",
          border:"1px solid rgba(59,130,246,.2)", borderRadius:12, padding:"16px 18px",
          display:"flex", gap:14, alignItems:"center" }}>
          <span style={{ fontSize:28 }}>⭐</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:700, color:"#60a5fa", marginBottom:3 }}>
              {isAr?"ترقّ إلى Pro":"Upgrade to Pro"}
            </div>
            <div style={{ fontSize:12, color:"rgba(255,255,255,.45)" }}>
              {isAr?"AI Coach، تقارير PDF، تحليلات متقدمة، بلا حد لعدد الجلسات":"AI Coach, PDF reports, advanced analytics, unlimited sessions"}
            </div>
          </div>
          <button onClick={onBilling}
            style={{ padding:"8px 18px", background:"#1a56db", color:"#fff",
              border:"none", borderRadius:8, fontSize:12, fontWeight:700,
              cursor:"pointer", whiteSpace:"nowrap" }}>
            {isAr?"ترقّ الآن":"Upgrade"}
          </button>
        </div>
      )}

      {/* Tools */}
      <div>
        <SectionHead title={isAr?"الأدوات":"Tools"} cs={cs}/>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))", gap:10 }}>
          {/* ── Core tools — all tiers ── */}
          <ToolBtn icon="🎯" label={isAr?"معايرة":"Calibrate"} color="16,185,129"
            desc={isAr?"اضبط الكاميرا":"Setup camera"}
            onClick={()=>setShowCalibWizard(true)} cs={cs}/>
          <ToolBtn icon="📊" label={isAr?"تحليلات":"Analytics"} color="26,86,219"
            desc={isAr?"إحصائيات تفصيلية":"Detailed stats"}
            onClick={()=>{getUserSessions(user.uid).then(setUserSessions);setShowDashboard(true);}} cs={cs}/>
          <ToolBtn icon="🏆" label={isAr?"التقدم":"Progress"} color="245,158,11"
            desc={isAr?"الإنجازات والمكافآت":"Achievements & streaks"}
            onClick={()=>setShowGamification?.(true)} cs={cs}/>
          <ToolBtn icon="🚀" label={isAr?"النمو":"Growth"} color="245,158,11"
            desc={isAr?"أدوات النمو":"Growth tools"}
            onClick={()=>setShowGrowthHub?.(true)} cs={cs}/>
          <ToolBtn icon="🔒" label={isAr?"الأمان":"Security"} color="99,102,241"
            desc={isAr?"إعدادات الأمان":"Security settings"}
            onClick={()=>setShowSecurityCenter?.(true)} cs={cs}/>

          {/* ── Pro tools ── */}
          <ToolBtn icon="🤖" label="AI Coach" color="16,185,129"
            desc={isAr?"نصائح AI":"AI posture tips"}
            onClick={()=>{getUserSessions(user.uid).then(setUserSessions);setShowCoach(true);}}
            locked={!(tier==="professional"||tier==="elite"||tier==="business")}
            lockLabel="PRO" onLock={()=>setShowBilling(true)} cs={cs}/>
          <ToolBtn icon="📋" label={isAr?"تقارير":"Reports"} color="124,58,237"
            desc={isAr?"PDF تفصيلي":"Detailed PDF"}
            onClick={()=>{getUserSessions(user.uid).then(setUserSessions);setShowAIReports(true);}}
            locked={!(tier==="professional"||tier==="elite"||tier==="business")}
            lockLabel="PRO" onLock={()=>setShowBilling(true)} cs={cs}/>
          <ToolBtn icon="🧠" label={isAr?"رؤى AI":"AI Insights"} color="8,145,178"
            desc={isAr?"تحليل عميق":"Deep analysis"}
            onClick={()=>{getUserSessions(user.uid).then(setUserSessions);setShowAIInsights?.(true);}}
            locked={!(tier==="elite"||tier==="business")}
            lockLabel="ELITE" onLock={()=>setShowBilling(true)} cs={cs}/>
          <ToolBtn icon="🔮" label={isAr?"AI تنبؤي":"Predictive AI"} color="8,145,178"
            desc={isAr?"توقع الأداء":"Predict performance"}
            onClick={()=>{getUserSessions(user.uid).then(setUserSessions);setShowPredictiveAI?.(true);}}
            locked={!(tier==="elite"||tier==="business")}
            lockLabel="ELITE" onLock={()=>setShowBilling(true)} cs={cs}/>

          {/* ── Compare / Trend — unlocked by sessions ── */}
          {userSessions.length>=2&&(
            <ToolBtn icon="📊" label={isAr?"مقارنة":"Compare"} color="168,85,247"
              desc={isAr?"قارن الجلسات":"Compare sessions"}
              onClick={()=>{getUserSessions(user.uid).then(setUserSessions);setShowSessionComparison(true);}} cs={cs}/>
          )}
          {userSessions.length>=3&&(
            <ToolBtn icon="📈" label={isAr?"الاتجاه":"Trend"} color="8,145,178"
              desc={isAr?"مسار التحسن":"Progress trend"}
              onClick={()=>{getUserSessions(user.uid).then(setUserSessions);setShowTrendChart(true);}} cs={cs}/>
          )}

          {/* ── HR / Admin tools ── */}
          {(isHRAdmin||isAdmin)&&(
            <ToolBtn icon="🏭" label={isAr?"قوى العمل":"Workforce"} color="8,145,178"
              desc={isAr?"تحليل الفريق":"Team analytics"}
              onClick={()=>{getUserSessions(user.uid).then(setUserSessions);getAllUsers().then(setAllUsers);setShowWorkforceAnalytics(true);}} cs={cs}/>
          )}
          {(isHRAdmin||isAdmin)&&(
            <ToolBtn icon="💡" label={isAr?"نجاح العملاء":"Success"} color="8,145,178"
              desc={isAr?"متابعة العملاء":"Customer success"}
              onClick={()=>setShowCustomerSuccess?.(true)} cs={cs}/>
          )}
          {(isHRAdmin||isAdmin)&&(
            <ToolBtn icon="📉" label={isAr?"توقع التسرب":"Churn AI"} color="239,68,68"
              desc={isAr?"منع التسرب":"Predict churn"}
              onClick={()=>setShowChurnPrediction?.(true)} cs={cs}/>
          )}
          {(isHRAdmin||isAdmin)&&(
            <ToolBtn icon="📜" label={isAr?"سجل المراجعة":"Audit Log"} color="100,116,139"
              desc={isAr?"سجل النشاط":"Activity log"}
              onClick={()=>setShowAuditSystem?.(true)} cs={cs}/>
          )}

          {/* ── Elite / Business ── */}
          <ToolBtn icon="🔌" label={isAr?"سوق API":"API Market"} color="16,185,129"
            desc={isAr?"تكاملات API":"API integrations"}
            onClick={()=>setShowAPIMarketplace?.(true)}
            locked={!(tier==="elite"||tier==="business")}
            lockLabel="ELITE" onLock={()=>setShowBilling(true)} cs={cs}/>
          <ToolBtn icon="🏷️" label={isAr?"علامتي":"White-label"} color="168,85,247"
            desc={isAr?"علامة مخصصة":"Custom branding"}
            onClick={()=>setShowWhiteLabel?.(true)}
            locked={!(tier==="elite"||tier==="business")}
            lockLabel="ELITE" onLock={()=>setShowBilling(true)} cs={cs}/>
          {(isAdmin||(tier==="elite"||tier==="business"))&&(
            <ToolBtn icon="🏢" label={isAr?"متعدد":"Multi-tenant"} color="8,145,178"
              desc={isAr?"إدارة المستأجرين":"Tenant management"}
              onClick={()=>setShowMultiTenant?.(true)} cs={cs}/>
          )}
        </div>
      </div>

      {/* Session history */}
      {userSessions.length>0 ? (
        <div style={{ background:cs.card, border:`1px solid ${cs.border}`, borderRadius:12, padding:"16px 18px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
            <SectionHead title={isAr?"آخر الجلسات":"Recent Sessions"} cs={cs} noMargin/>
            <div style={{ display:"flex", gap:6 }}>
              {userSessions.length>=2&&onCompare&&(
                <button onClick={onCompare}
                  style={{ fontSize:11, fontWeight:600, padding:"5px 11px",
                    background:"rgba(168,85,247,.1)", color:"#c084fc",
                    border:"1px solid rgba(168,85,247,.25)", borderRadius:7, cursor:"pointer" }}>
                  📊 {isAr?"مقارنة":"Compare"}
                </button>
              )}
              {userSessions.length>=3&&onTrend&&(
                <button onClick={onTrend}
                  style={{ fontSize:11, fontWeight:600, padding:"5px 11px",
                    background:"rgba(8,145,178,.1)", color:"#67e8f9",
                    border:"1px solid rgba(8,145,178,.25)", borderRadius:7, cursor:"pointer" }}>
                  📈 {isAr?"الاتجاه":"Trend"}
                </button>
              )}
            </div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {userSessions.slice(0,6).map((s,i)=>{
              const d=s.created_at?.toDate?.()??new Date(s.created_at||0);
              const sc=s.avg_score||0;
              const col=gradeColor(sc);
              const dur=s.duration_sec?` · ${Math.round(s.duration_sec/60)}m`:"";
              return (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:12,
                  padding:"10px 12px", background:"rgba(255,255,255,.025)",
                  borderRadius:8, border:`1px solid ${cs.border}` }}>
                  <div style={{ width:38, height:38, borderRadius:8, flexShrink:0,
                    background:`${col}18`, display:"flex", alignItems:"center",
                    justifyContent:"center", fontSize:16, fontWeight:800, color:col }}>{sc||"—"}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:cs.text }}>
                      {isAr?`جلسة #${userSessions.length-i}`:`Session #${userSessions.length-i}`}
                    </div>
                    <div style={{ fontSize:11, color:cs.muted }}>
                      {d.toLocaleDateString(isAr?"ar-EG":"en-US",{weekday:"short",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}{dur}
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
function DashEmployee({ profile, userSessions, allUsers, cs, isAr, setPage, startCamera, onCoach }) {
  const last   = userSessions[0]?.avg_score||0;
  const avg    = userSessions.length ? Math.round(userSessions.reduce((a,s)=>a+(s.avg_score||0),0)/userSessions.length) : 0;
  const streak = profile?.streak_days||0;
  const rank   = useMemo(()=>{
    if(!allUsers?.length) return null;
    const sorted=[...allUsers].sort((a,b)=>(b.avg_score||0)-(a.avg_score||0));
    const i=sorted.findIndex(u=>u.uid===profile?.uid||u.id===profile?.uid);
    return i>=0?{pos:i+1,total:sorted.length}:null;
  },[allUsers,profile]);
  const gradeColor = s => s>=80?"#10b981":s>=60?"#f59e0b":"#ef4444";

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      {/* Hero */}
      <div style={{ background:cs.card, border:`1px solid ${cs.border}`, borderRadius:14,
        padding:"22px", display:"flex", gap:20, alignItems:"center", flexWrap:"wrap" }}>
        <Ring score={last||avg} size={104}/>
        <div style={{ flex:1, minWidth:180 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
            <Avatar name={profile?.name||profile?.email} photo={profile?.photoURL} size={36}/>
            <div>
              <div style={{ fontSize:18, fontWeight:800, color:cs.text }}>
                {isAr?`أهلاً, ${profile?.name?.split(" ")[0] || profile?.email?.split("@")[0] || ""}!`:`Hey, ${profile?.name?.split(" ")[0] || profile?.email?.split("@")[0] || "there"}!`}
              </div>
              <div style={{ fontSize:11, color:"#60a5fa", fontWeight:500, marginTop:2 }}>
                {profile?.department||profile?.company||(isAr?"موظف":"Employee")}
              </div>
            </div>
          </div>
          <div style={{ fontSize:13, color:cs.muted, marginBottom:14 }}>
            {last>=80?`💪 ${isAr?"وضعيتك ممتازة اليوم":"Great posture today"}`
            :last>=60?`📈 ${isAr?"وضعيتك تتحسن":"Your posture is improving"}`
            :`⚠️ ${isAr?"ابدأ جلسة لتحسين وضعيتك":"Start a session to improve"}`}
          </div>
          <button onClick={()=>{setPage("live");setTimeout(()=>startCamera?.(),200)}}
            style={{ padding:"10px 22px", background:"linear-gradient(135deg,#1a56db,#0891b2)",
              color:"#fff", border:"none", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer" }}>
            {isAr?"▶ ابدأ جلسة":"▶ Start Session"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))", gap:10 }}>
        <StatCard label={isAr?"متوسطك":"Your Avg"} value={avg||"—"} color="#3b82f6" cs={cs}/>
        <StatCard label={isAr?"التواصل":"Streak"} value={streak?`${streak}d`:"—"} color="#10b981" cs={cs}/>
        {rank&&<StatCard label={isAr?"ترتيبك":"Rank"} value={`#${rank.pos}`} sub={`of ${rank.total}`} color="#f59e0b" cs={cs}/>}
        <StatCard label={isAr?"الجلسات":"Sessions"} value={userSessions.length||"—"} color="#a855f7" cs={cs}/>
      </div>

      {userSessions.length>0&&(
        <div style={{ background:cs.card, border:`1px solid ${cs.border}`, borderRadius:12, padding:"16px 18px" }}>
          <SectionHead title={isAr?"آخر 7 أيام":"Last 7 days"} cs={cs}/>
          <WeekChart sessions={userSessions} cs={cs}/>
        </div>
      )}

      {/* Team leaderboard */}
      {allUsers?.length>1&&(
        <div style={{ background:cs.card, border:`1px solid ${cs.border}`, borderRadius:12, padding:"16px 18px" }}>
          <SectionHead title={isAr?"لوحة الفريق":"Team Leaderboard"} cs={cs}/>
          <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
            {[...allUsers].sort((a,b)=>(b.avg_score||0)-(a.avg_score||0)).slice(0,7).map((u,i)=>{
              const isMe=u.uid===profile?.uid||u.id===profile?.uid;
              const sc=u.avg_score||0;
              const col=gradeColor(sc);
              return (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:10,
                  padding:"9px 12px", borderRadius:8,
                  background:isMe?"rgba(59,130,246,.08)":"rgba(255,255,255,.02)",
                  border:`1px solid ${isMe?"rgba(59,130,246,.35)":cs.border}` }}>
                  <div style={{ width:22, textAlign:"center", fontSize:13, color:cs.muted, fontWeight:700 }}>
                    {i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`}
                  </div>
                  <Avatar name={u.name||u.email} photo={u.photoURL} size={28}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:isMe?700:500,
                      color:isMe?"#60a5fa":cs.text,
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {u.name||u.email?.split("@")[0]}
                      {isMe&&<span style={{ marginLeft:6, fontSize:10, color:"#60a5fa" }}>{isAr?"(أنت)":"(you)"}</span>}
                    </div>
                    {u.department&&<div style={{ fontSize:10, color:cs.muted }}>{u.department}</div>}
                  </div>
                  <div style={{ fontSize:17, fontWeight:800, color:col }}>{sc||"—"}</div>
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
  onAnalytics, onWorkforce, onReports }) {
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
  const gradeColor = s => s>=80?"#10b981":s>=60?"#f59e0b":s>0?"#ef4444":"rgba(255,255,255,.25)";

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
          <div style={{ fontSize:12, color:"rgba(255,255,255,.4)", marginTop:2 }}>
            {users.length} {isAr?"موظف":"employees"} · <TierBadge tier={profile?.tier||"standard"}/>
          </div>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <button onClick={onInvite} style={{ padding:"9px 16px", background:"#1a56db", color:"#fff",
            border:"none", borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer" }}>
            {isAr?"+ دعوة موظفين":"+ Invite Employees"}
          </button>
          <button onClick={onBilling} style={{ padding:"9px 16px",
            background:"rgba(255,255,255,.06)", color:"rgba(255,255,255,.75)",
            border:"1px solid rgba(255,255,255,.1)", borderRadius:8, fontSize:12,
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
          <ToolBtn icon="🔔" label={isAr?"تنبيهات":"Alerts"} color="245,158,11"
            desc={isAr?`${atRisk} في خطر`:`${atRisk} at risk`}
            onClick={()=>addToast(isAr?"تم إرسال تنبيهات لكل المعرضين للخطر":"Alerts sent to at-risk employees","success")} cs={cs}/>
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
            <div style={{ fontSize:11, color:"rgba(255,255,255,.4)" }}>
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
            style={{ padding:"7px 11px", background:"rgba(255,255,255,.05)",
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
function PanelSessions({ userSessions, cs, isAr, setPage, startCamera }) {
  if(!userSessions.length) return <EmptyBlock icon="📋" cs={cs}
    title={isAr?"لا توجد جلسات":"No sessions yet"}
    desc={isAr?"ابدأ جلستك الأولى":"Start your first session"}
    action={isAr?"ابدأ جلسة":"Start Session"}
    onAction={()=>{setPage("live");setTimeout(()=>startCamera?.(),200)}}/>;

  const gradeColor = s => s>=80?"#10b981":s>=60?"#f59e0b":"#ef4444";
  const grade = (s,ar) => s>=80?(ar?"ممتاز":"Excellent"):s>=60?(ar?"جيد":"Good"):(ar?"ضعيف":"Poor");

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {userSessions.map((s,i)=>{
        const d=s.created_at?.toDate?.()??new Date(s.created_at||0);
        const sc=s.avg_score||0;
        const col=gradeColor(sc);
        const dur=s.duration_sec?`${Math.round(s.duration_sec/60)}m`:"";
        return (
          <div key={i} style={{ background:cs.card, border:`1px solid ${cs.border}`,
            borderRadius:10, padding:"13px 16px", display:"flex", gap:12, alignItems:"center" }}>
            <div style={{ width:40, height:40, borderRadius:8, flexShrink:0,
              background:`${col}15`, display:"flex", alignItems:"center",
              justifyContent:"center", fontSize:15, fontWeight:800, color:col }}>{sc||"—"}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:600, color:cs.text }}>
                {isAr?`جلسة #${userSessions.length-i}`:`Session #${userSessions.length-i}`}
              </div>
              <div style={{ fontSize:11, color:cs.muted }}>
                {d.toLocaleDateString(isAr?"ar-EG":"en-US",{weekday:"short",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}
                {dur&&<span> · {dur}</span>}
              </div>
            </div>
            <span style={{ fontSize:11, fontWeight:600, padding:"3px 9px", borderRadius:99,
              background:`${col}12`, color:col }}>{grade(sc,isAr)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// SETTINGS PANEL (inline)
// ══════════════════════════════════════════════════════════════════
function PanelSettings({ user, profile, setProfile, cs, isAr, addToast, onSignOut, tier, onBilling }) {
  const [name,    setName]    = useState(profile?.name||"");
  const [company, setCompany] = useState(profile?.company||"");
  const [dept,    setDept]    = useState(profile?.department||"");
  const [saving,  setSaving]  = useState(false);
  const [tab,     setTab]     = useState("profile"); // profile | security | billing

  // Sync when profile changes
  useEffect(()=>{
    setName(profile?.name||"");
    setCompany(profile?.company||"");
    setDept(profile?.department||"");
  },[profile]);

  async function save() {
    if(!user?.uid){ addToast(isAr?"خطأ: لم يتم التعرف على المستخدم":"Error: user not identified","error"); return; }
    setSaving(true);
    try {
      const updates = {
        name:     name.trim()    || profile?.name    || "",
        company:  company.trim() || "",
        department: dept.trim()  || "",
      };
      await updateUserProfile(user.uid, updates);
      setProfile(p=>({...(p||{}), ...updates}));
      // Force local state sync
      setName(updates.name);
      setCompany(updates.company);
      setDept(updates.department);
      addToast(isAr?"✅ تم الحفظ بنجاح":"✅ Saved successfully","success");
    } catch(err) {
      console.error("Save error:", err);
      addToast(isAr?`خطأ: ${err?.message||"مجهول"}`:`Error: ${err?.message||"unknown"}`,"error");
    }
    setSaving(false);
  }

  const inp = (val,onChange,placeholder) => (
    <input value={val} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
      style={{ width:"100%", padding:"10px 12px", background:"rgba(255,255,255,.05)",
        border:`1px solid ${cs.border}`, borderRadius:8, color:cs.text,
        fontSize:13, outline:"none", boxSizing:"border-box",
        transition:"border-color .15s" }}
      onFocus={e=>e.target.style.borderColor="#3b82f6"}
      onBlur={e=>e.target.style.borderColor=cs.border}/>
  );

  const tabs = [
    { id:"profile",  en:"Profile",       ar:"الملف الشخصي" },
    { id:"billing",  en:"Subscription",  ar:"الاشتراك" },
    { id:"security", en:"Security",      ar:"الأمان" },
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
                    objectFit:"cover", border:"2px solid rgba(255,255,255,.1)" }}/>
              : <Avatar name={profile?.name||profile?.email} photo={profile?.photoURL} size={72}/>}
            <label title={isAr?"تغيير الصورة":"Change photo"}
              style={{ position:"absolute", bottom:0, right:0, width:24, height:24,
                background:"#1a56db", borderRadius:"50%", cursor:"pointer",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:12, border:"2px solid rgba(4,9,20,1)", boxShadow:"0 2px 8px rgba(0,0,0,.4)" }}>
              📷
            <input type="file" accept="image/*" style={{ display:"none" }}
              onChange={async e=>{
                const file=e.target.files[0]; if(!file) return;
                if(file.size>5*1024*1024){ addToast(isAr?"الصورة أكبر من 5MB":"Image too large (max 5MB)","error"); return; }
                // Resize to 120x120 before saving (Firestore 1MB doc limit)
                const img=new Image();
                const url=URL.createObjectURL(file);
                img.onload=async ()=>{
                  const canvas=document.createElement("canvas");
                  const S=120; canvas.width=S; canvas.height=S;
                  const ctx=canvas.getContext("2d");
                  // center-crop
                  const minDim=Math.min(img.width,img.height);
                  const sx=(img.width-minDim)/2, sy=(img.height-minDim)/2;
                  ctx.drawImage(img,sx,sy,minDim,minDim,0,0,S,S);
                  URL.revokeObjectURL(url);
                  const dataUrl=canvas.toDataURL("image/jpeg",0.8);
                  try{
                    await updateUserProfile(user.uid,{photoURL:dataUrl});
                    setProfile(p=>({...p,photoURL:dataUrl}));
                    addToast(isAr?"تم تحديث الصورة ✓":"Photo updated ✓","success");
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
          <div style={{ fontSize:17, fontWeight:800, color:cs.text }}>{profile?.name||"—"}</div>
          <div style={{ fontSize:12, color:cs.muted, marginTop:2 }}>{user?.email||"—"}</div>
          <div style={{ marginTop:6, display:"flex", gap:8, alignItems:"center" }}>
            <TierBadge tier={tier}/>
            {profile?.company&&<span style={{ fontSize:11, color:cs.muted }}>· {profile.company}</span>}
          </div>
        </div>
        <button onClick={onSignOut}
          style={{ padding:"8px 14px", background:"rgba(239,68,68,.1)",
            border:"1px solid rgba(239,68,68,.2)", borderRadius:8,
            color:"#f87171", fontSize:12, fontWeight:700, cursor:"pointer" }}>
          {isAr?"⏻ خروج":"⏻ Sign Out"}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:4, background:cs.card,
        border:`1px solid ${cs.border}`, borderRadius:10, padding:4 }}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{ flex:1, padding:"8px", border:"none", borderRadius:7, cursor:"pointer",
              background:tab===t.id?"rgba(59,130,246,.15)":"transparent",
              color:tab===t.id?"#60a5fa":cs.muted,
              fontSize:12, fontWeight:tab===t.id?700:500, transition:"all .12s" }}>
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
              {inp(name, setName, isAr?"أدخل اسمك الكامل":"Enter full name")}
            </div>
            {/* Company field hidden for personal accounts - managed by HR admin */}
            <div>
              <div style={{ fontSize:11, color:cs.muted, fontWeight:600, marginBottom:6,
                textTransform:"uppercase", letterSpacing:".06em" }}>
                {isAr?"القسم":"Department"}
              </div>
              {inp(dept, setDept, isAr?"مثال: هندسة، تصميم":"e.g. Engineering, Design")}
            </div>
            <div>
              <div style={{ fontSize:11, color:cs.muted, fontWeight:600, marginBottom:6,
                textTransform:"uppercase", letterSpacing:".06em" }}>
                {isAr?"البريد الإلكتروني":"Email"}
              </div>
              <input value={user?.email||""} disabled
                style={{ width:"100%", padding:"10px 12px", background:"rgba(255,255,255,.02)",
                  border:`1px solid ${cs.border}`, borderRadius:8, color:cs.muted,
                  fontSize:13, outline:"none", cursor:"not-allowed", boxSizing:"border-box" }}/>
            </div>
            <button onClick={save} disabled={saving}
              style={{ marginTop:4, padding:"11px", background:saving?"rgba(26,86,219,.5)":"#1a56db",
                color:"#fff", border:"none", borderRadius:8, fontSize:13,
                fontWeight:700, cursor:saving?"not-allowed":"pointer", transition:"all .15s" }}>
              {saving?(isAr?"جاري الحفظ...":"Saving..."):(isAr?"حفظ التغييرات":"Save Changes")}
            </button>
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
            background:"rgba(255,255,255,.03)", borderRadius:10,
            border:`1px solid ${cs.border}`, marginBottom:16 }}>
            <div style={{ fontSize:32 }}>
              {tier==="elite"?"✦":tier==="professional"?"⭐":tier==="business"?"🏢":"🆓"}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:16, fontWeight:800, color:cs.text }}>
                {tier==="elite"?"Elite":tier==="professional"?"Professional":tier==="business"?"Business":"Free"}
              </div>
              <div style={{ fontSize:12, color:cs.muted, marginTop:3 }}>
                {tier==="elite"?(isAr?"كل المميزات + تحليل AI متقدم":"All features + Advanced AI analysis")
                :tier==="professional"?(isAr?"AI Coach + تقارير PDF + تحليلات":"AI Coach + PDF reports + Analytics")
                :tier==="business"?(isAr?"كل مميزات Pro + لوحة إدارة المجموعة":"All Pro features + Group management")
                :(isAr?"جلسات يومية محدودة":"Limited daily sessions")}
              </div>
            </div>
            <TierBadge tier={tier}/>
          </div>
          {!isPro(tier)&&(
            <>
              <div style={{ fontSize:12, color:cs.muted, marginBottom:12 }}>
                {isAr?"ترقّ للحصول على:":"Upgrade to unlock:"}
              </div>
              {[
                isAr?"🤖 AI Coach — نصائح مخصصة بالذكاء الاصطناعي":"🤖 AI Coach — Personalized AI coaching",
                isAr?"📊 تحليلات متقدمة — رسوم بيانية تفصيلية":"📊 Advanced Analytics — Detailed charts",
                isAr?"📋 تقارير PDF — ملخص شهري كامل":"📋 PDF Reports — Full monthly summary",
                isAr?"📅 جلسات غير محدودة":"📅 Unlimited sessions",
              ].map((f,i)=>(
                <div key={i} style={{ display:"flex", gap:10, alignItems:"center",
                  padding:"8px 0", borderBottom:i<3?`1px solid ${cs.border}`:"none",
                  fontSize:13, color:cs.text }}>{f}</div>
              ))}
              <button onClick={onBilling}
                style={{ marginTop:16, width:"100%", padding:"11px",
                  background:"linear-gradient(135deg,#1a56db,#0891b2)", color:"#fff",
                  border:"none", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer" }}>
                {isAr?"ترقّ الآن — ابدأ بـ 7 أيام مجاناً":"Upgrade Now — Start 7-day free trial"}
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
          <div style={{ fontSize:13, fontWeight:700, color:cs.text, marginBottom:16 }}>
            {isAr?"إعدادات الأمان":"Security Settings"}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {/* Linked accounts */}
            {(user?.providerData||[]).map((p,i)=>(
              <div key={i} style={{ padding:"12px 14px", background:"rgba(255,255,255,.03)",
                borderRadius:9, border:`1px solid ${cs.border}`,
                display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                  <span style={{ fontSize:18 }}>{p.providerId==="google.com"?"🔵":"📧"}</span>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:cs.text }}>
                      {p.providerId==="google.com"?(isAr?"حساب Google":"Google Account"):(isAr?"بريد إلكتروني":"Email/Password")}
                    </div>
                    <div style={{ fontSize:11, color:cs.muted, marginTop:2 }}>{p.email||user?.email||"—"}</div>
                  </div>
                </div>
                <span style={{ fontSize:10, fontWeight:700, color:"#10b981",
                  background:"rgba(16,185,129,.1)", padding:"3px 8px", borderRadius:99 }}>
                  {isAr?"مرتبط":"Linked"}
                </span>
              </div>
            ))}
            {/* Add Google account link */}
            {!(user?.providerData||[]).some(p=>p.providerId==="google.com")&&(
              <button onClick={async ()=>{
                try{
                  const { GoogleAuthProvider, linkWithPopup } = await import("firebase/auth");
                  const { auth } = await import("./firebase.js");
                  await linkWithPopup(auth.currentUser, new GoogleAuthProvider());
                  addToast(isAr?"✅ تم ربط حساب Google":"✅ Google account linked","success");
                }catch(e){ addToast(e.message||"Error","error"); }
              }} style={{ padding:"11px 14px", background:"rgba(59,130,246,.08)",
                border:"1px solid rgba(59,130,246,.2)", borderRadius:9, cursor:"pointer",
                display:"flex", alignItems:"center", gap:10, width:"100%", color:"#60a5fa",
                fontSize:13, fontWeight:600 }}>
                <span style={{ fontSize:16 }}>🔵</span>
                {isAr?"+ ربط حساب Google":"+ Link Google Account"}
              </button>
            )}
            {/* Add email/password */}
            {!(user?.providerData||[]).some(p=>p.providerId==="password")&&(
              <div style={{ fontSize:12, color:cs.muted, padding:"8px 0", textAlign:"center" }}>
                {isAr?"تسجيل دخولك عبر Google فقط. يمكنك إضافة كلمة مرور من إعدادات Firebase.":"You sign in via Google only."}
              </div>
            )}
            <button onClick={onSignOut}
              style={{ marginTop:4, padding:"11px", background:"rgba(239,68,68,.1)",
                color:"#f87171", border:"1px solid rgba(239,68,68,.2)",
                borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer" }}>
              {isAr?"⏻ تسجيل الخروج":"⏻ Sign Out"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// SIDEBAR (desktop)
// ══════════════════════════════════════════════════════════════════
function Sidebar({ userRole, tab, setTab, profile, isAr, cs, setPage, startCamera,
  logOut, setUser, setProfile, isAdmin, darkMode, setDarkMode, setLang, lang, tier, atRisk }) {

  const nav = useMemo(()=>{
    if(userRole==="hr_admin"||userRole==="platform_admin") return [
      { id:"home",      icon:"⊞",  en:"Overview",   ar:"النظرة العامة" },
      { id:"employees", icon:"👥", en:"Employees",  ar:"الموظفون" },
      { id:"analytics", icon:"📊", en:"Analytics",  ar:"التحليلات" },
      { id:"alerts",    icon:"🔔", en:"Alerts",      ar:"التنبيهات", badge:atRisk },
      { id:"settings",  icon:"⚙️", en:"Settings",   ar:"الإعدادات" },
    ];
    if(userRole==="employee") return [
      { id:"home",     icon:"⊞",  en:"Dashboard",  ar:"الرئيسية" },
      { id:"sessions", icon:"📋", en:"Sessions",   ar:"جلساتي" },
      { id:"team",     icon:"👥", en:"Team",        ar:"الفريق" },
      { id:"settings", icon:"⚙️", en:"Settings",   ar:"الإعدادات" },
    ];
    return [
      { id:"home",     icon:"⊞",  en:"Dashboard",    ar:"الرئيسية" },
      { id:"sessions", icon:"📋", en:"Sessions",     ar:"جلساتي" },
      { id:"settings", icon:"⚙️", en:"Settings",    ar:"الإعدادات" },
    ];
  },[userRole,atRisk]);

  const [hov,setHov]=useState(null);

  return (
    <aside style={{ width:230, flexShrink:0, height:"100vh", position:"sticky", top:0,
      background:"rgba(4,9,20,.98)", borderRight:`1px solid ${cs.border}`,
      display:"flex", flexDirection:"column" }}>

      {/* Logo */}
      <div style={{ padding:"16px 14px 12px", borderBottom:`1px solid ${cs.border}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:30, height:30, background:"linear-gradient(135deg,#1a56db,#0891b2)",
            borderRadius:7, display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:16, flexShrink:0 }}>◈</div>
          <div>
            <div style={{ fontSize:13, fontWeight:800, color:"#f0f6ff", letterSpacing:"-.01em" }}>
              PostureAI
            </div>
            <div style={{ fontSize:9, color:"#3b82f6", fontWeight:600, textTransform:"uppercase",
              letterSpacing:".06em" }}>
              {tier==="elite"?"Elite ✦":tier==="professional"?"Pro":tier==="business"?"Business":"Free"}
              {" · "}{userRole==="hr_admin"?"Admin":userRole==="employee"?"Employee":"Personal"}
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex:1, padding:"8px 8px", display:"flex", flexDirection:"column",
        gap:2, overflowY:"auto" }}>
        {nav.map(item=>(
          <button key={item.id}
            onClick={()=>setTab(item.id)}
            onMouseEnter={()=>setHov(item.id)}
            onMouseLeave={()=>setHov(null)}
            style={{ display:"flex", alignItems:"center", gap:9, width:"100%",
              padding:"8px 11px", border:"none", borderRadius:7, cursor:"pointer",
              borderLeft:tab===item.id?"2px solid #3b82f6":"2px solid transparent",
              background:tab===item.id?"rgba(59,130,246,.1)":hov===item.id?"rgba(255,255,255,.04)":"transparent",
              color:tab===item.id?"#3b82f6":"rgba(255,255,255,.65)",
              fontSize:12.5, fontWeight:tab===item.id?700:400,
              textAlign:"left", transition:"all .1s", position:"relative" }}>
            <span style={{ fontSize:14, width:18, textAlign:"center" }}>{item.icon}</span>
            <span style={{ flex:1 }}>{isAr?item.ar:item.en}</span>
            {item.badge>0&&<span style={{ background:"#ef4444", color:"#fff", fontSize:9,
              fontWeight:700, borderRadius:99, padding:"1px 5px", minWidth:16,
              textAlign:"center" }}>{item.badge}</span>}
          </button>
        ))}

        {isAdmin&&(
          <button onClick={()=>setPage("admin")}
            style={{ display:"flex", alignItems:"center", gap:9, width:"100%",
              padding:"8px 11px", border:"none", borderRadius:7, cursor:"pointer",
              background:"transparent", color:"rgba(255,255,255,.4)",
              fontSize:12.5, textAlign:"left" }}>
            <span style={{ fontSize:14, width:18, textAlign:"center" }}>🔧</span>
            {isAr?"منصة المشرف":"Platform Admin"}
          </button>
        )}

        {/* Start session */}
        <div style={{ marginTop:10, paddingTop:10, borderTop:`1px solid ${cs.border}` }}>
          <button onClick={()=>{setPage("live");setTimeout(()=>startCamera?.(),200)}}
            style={{ width:"100%", padding:"9px", border:"none", borderRadius:8,
              background:"linear-gradient(135deg,#1a56db,#0891b2)", color:"#fff",
              fontSize:12.5, fontWeight:700, cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center", gap:8,
              boxShadow:"0 4px 12px rgba(26,86,219,.35)" }}>
            ▶ {isAr?"ابدأ جلسة":"Start Session"}
          </button>
        </div>
      </nav>

      {/* User footer */}
      <div style={{ padding:"8px 8px 12px", borderTop:`1px solid ${cs.border}` }}>
        {/* Lang/dark toggle */}
        <div style={{ display:"flex", gap:5, marginBottom:8 }}>
          <button onClick={()=>setLang(lang==="ar"?"en":"ar")}
            style={{ flex:1, padding:"5px", background:"rgba(255,255,255,.04)",
              border:`1px solid ${cs.border}`, borderRadius:6,
              color:cs.muted, fontSize:11, cursor:"pointer" }}>
            {lang==="ar"?"🇬🇧 EN":"🇪🇬 عربي"}
          </button>
          <button onClick={()=>setDarkMode(!darkMode)}
            style={{ padding:"5px 9px", background:"rgba(255,255,255,.04)",
              border:`1px solid ${cs.border}`, borderRadius:6,
              color:cs.muted, fontSize:11, cursor:"pointer" }}>
            {darkMode?"☀️":"🌙"}
          </button>
        </div>

        {/* User + logout */}
        <div style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 8px",
          background:"rgba(255,255,255,.03)", borderRadius:8 }}>
          <Avatar name={profile?.name||profile?.email} photo={profile?.photoURL} size={28}/>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:11, fontWeight:600, color:"#f0f6ff",
              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {profile?.name||profile?.email?.split("@")[0]||"—"}
            </div>
            <div style={{ fontSize:9.5, color:cs.muted,
              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {profile?.email||""}
            </div>
          </div>
          <button onClick={()=>{ logOut?.(); setUser?.(null); setProfile?.(null); }}
            title={isAr?"تسجيل الخروج":"Sign out"}
            style={{ padding:"4px 7px", background:"rgba(239,68,68,.1)",
              border:"1px solid rgba(239,68,68,.2)", borderRadius:5,
              color:"#f87171", fontSize:10, fontWeight:700, cursor:"pointer",
              whiteSpace:"nowrap" }}>
            {isAr?"خروج":"Out"}
          </button>
        </div>
      </div>
    </aside>
  );
}

// ── Mobile nav ────────────────────────────────────────────────────
function MobileNav({ userRole, tab, setTab, setPage, startCamera, isAr, cs, atRisk }) {
  const tabs = userRole==="hr_admin"||userRole==="platform_admin" ? [
    { id:"home",      icon:"⊞", en:"Overview",  ar:"نظرة" },
    { id:"employees", icon:"👥",en:"Team",       ar:"فريق" },
    { id:"live",      icon:"▶",  en:"Session",   ar:"جلسة",   special:true },
    { id:"alerts",    icon:"🔔",en:"Alerts",     ar:"تنبيهات", badge:atRisk },
    { id:"settings",  icon:"⚙️",en:"Settings",  ar:"إعدادات" },
  ] : userRole==="employee" ? [
    { id:"home",     icon:"⊞", en:"Home",     ar:"الرئيسية" },
    { id:"team",     icon:"👥",en:"Team",      ar:"الفريق" },
    { id:"live",     icon:"▶",  en:"Session",  ar:"جلسة",   special:true },
    { id:"sessions", icon:"📋",en:"History",   ar:"السجل" },
    { id:"settings", icon:"⚙️",en:"Settings", ar:"إعدادات" },
  ] : [
    { id:"home",     icon:"⊞", en:"Home",    ar:"الرئيسية" },
    { id:"sessions", icon:"📋",en:"History", ar:"السجل" },
    { id:"live",     icon:"▶",  en:"Session", ar:"جلسة",   special:true },
    { id:"settings", icon:"⚙️",en:"Settings",ar:"إعدادات" },
  ];

  return (
    <nav style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:200,
      background:"rgba(4,9,20,.97)", borderTop:`1px solid ${cs.border}`,
      backdropFilter:"blur(20px)", display:"flex",
      padding:`6px 0 max(6px,env(safe-area-inset-bottom))` }}>
      {tabs.map(t=>(
        <button key={t.id}
          onClick={()=>t.id==="live"?( setPage("live"),setTimeout(()=>startCamera?.(),200) ):setTab(t.id)}
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
              <span style={{ fontSize:17, color:tab===t.id?"#3b82f6":"rgba(255,255,255,.3)" }}>
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
              color:tab===t.id?"#3b82f6":"rgba(255,255,255,.3)" }}>
              {isAr?t.ar:t.en}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}

// ══════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ══════════════════════════════════════════════════════════════════
export default function HomePage({
  user, profile, setProfile, cs, lang, isAr, dir,
  userSessions, setUserSessions, allUsers, setAllUsers,
  tier, setTier, mode, setMode,
  setPage, startCamera, addToast,
  setShowCoach, setShowBilling, setShowCompanyOnboard,
  setShowDashboard, setShowWorkforceAnalytics, setShowAIReports,
  setShowCalibWizard, setShowGamification,
  setShowSessionComparison, setShowTrendChart,
  setShowAIInsights, setShowGrowthHub, setShowSecurityCenter,
  setShowCustomerSuccess, setShowChurnPrediction,
  setShowAPIMarketplace, setShowWhiteLabel,
  setShowMultiTenant, setShowAuditSystem,
  setShowPredictiveAI, setShowMRR, setShowChangelog,
  setShowNotificationsHub, setShowEnterpriseRBAC,
  isAdmin, isHRAdmin, companyId,
  darkMode, setDarkMode, setLang,
  t, logOut, setUser,
}) {
  const [tab,    setTab]    = useState("home");
  const [mobile, setMobile] = useState(()=>typeof window!=="undefined"&&window.innerWidth<1024);

  useEffect(()=>{
    const fn=()=>setMobile(window.innerWidth<1024);
    window.addEventListener("resize",fn); return ()=>window.removeEventListener("resize",fn);
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

  const tabLabels = { en:{ home:"Dashboard",employees:"Employees",analytics:"Analytics",
    alerts:"Alerts",sessions:"Sessions",team:"Team",settings:"Settings" },
    ar:{ home:"الرئيسية",employees:"الموظفون",analytics:"التحليلات",
    alerts:"التنبيهات",sessions:"الجلسات",team:"الفريق",settings:"الإعدادات" }};

  // ── Render tab content ─────────────────────────────────────────
  // Settings NOT in useMemo so profile updates re-render immediately
  const settingsContent = tab==="settings" ? (
    <PanelSettings user={user} profile={profile} setProfile={setProfile}
      cs={cs} isAr={isAr} addToast={addToast} onSignOut={handleSignOut}
      tier={tier} onBilling={openBilling}/>
  ) : null;

  const content = useMemo(()=>{
    if(tab==="settings") return null; // rendered separately above

    if(userRole==="hr_admin"||userRole==="platform_admin") {
      if(tab==="home"||tab==="employees") return (
        <DashHR profile={profile} allUsers={allUsers} cs={cs} isAr={isAr}
          addToast={addToast} onBilling={openBilling} onInvite={openInvite}
          onAnalytics={openAnalytics} onWorkforce={openWorkforce} onReports={openReports}/>
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
                  <div style={{ fontSize:12, color:"rgba(255,255,255,.4)" }}>
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
      if(tab==="home"||tab==="team") return (
        <DashEmployee profile={profile} userSessions={userSessions} allUsers={allUsers}
          cs={cs} isAr={isAr} setPage={setPage} startCamera={startCamera} onCoach={openCoach}/>
      );
      if(tab==="sessions") return (
        <PanelSessions userSessions={userSessions} cs={cs} isAr={isAr}
          setPage={setPage} startCamera={startCamera}/>
      );
    }

    // Individual
    if(tab==="sessions") return (
      <PanelSessions userSessions={userSessions} cs={cs} isAr={isAr}
        setPage={setPage} startCamera={startCamera}/>
    );

    return (
      <DashIndividual profile={profile} userSessions={userSessions} tier={tier}
        cs={cs} isAr={isAr} setPage={setPage} startCamera={startCamera}
        onCoach={openCoach} onBilling={openBilling} onAnalytics={openAnalytics}
        onCalib={openCalib} onReports={openReports} addToast={addToast}
        onCompare={()=>setShowSessionComparison?.(true)} onTrend={()=>setShowTrendChart?.(true)}/>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[tab, userRole, profile, userSessions, allUsers, tier, isAr, cs, atRisk]);

  return (
    <div dir={dir} style={{ display:"flex", minHeight:"100vh",
      background:cs.bg||"#030b14", color:cs.text||"#f0f6ff",
      fontFamily:"system-ui,-apple-system,'Segoe UI',sans-serif" }}>

      {!mobile&&(
        <Sidebar userRole={userRole} tab={tab} setTab={setTab} profile={profile}
          isAr={isAr} cs={cs} setPage={setPage} startCamera={startCamera}
          logOut={logOut} setUser={setUser} setProfile={setProfile}
          isAdmin={isAdmin} darkMode={darkMode} setDarkMode={setDarkMode}
          setLang={setLang} lang={lang} tier={tier} atRisk={atRisk}/>
      )}

      <main style={{ flex:1, minWidth:0, overflowY:"auto", paddingBottom:mobile?80:0 }}>
        {/* Topbar */}
        <header style={{ position:"sticky", top:0, zIndex:100,
          background:"rgba(4,9,20,.96)", borderBottom:`1px solid ${cs.border}`,
          backdropFilter:"blur(20px)", padding:"0 20px", height:50,
          display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
          {mobile&&(
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:26, height:26, background:"linear-gradient(135deg,#1a56db,#0891b2)",
                borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:14 }}>◈</div>
              <span style={{ fontSize:13, fontWeight:800, color:"#f0f6ff" }}>PostureAI</span>
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
            <button onClick={()=>setTab("settings")}
              style={{ background:"none", border:"none", cursor:"pointer", padding:0 }}>
              <Avatar name={profile?.name||profile?.email} photo={profile?.photoURL} size={30}/>
            </button>
          </div>
        </header>

        <div style={{ padding:"14px 16px", maxWidth:1060, margin:"0 auto" }}>
          {settingsContent || content}
        </div>
      </main>

      {mobile&&(
        <MobileNav userRole={userRole} tab={tab} setTab={setTab}
          setPage={setPage} startCamera={startCamera}
          isAr={isAr} cs={cs} atRisk={atRisk}/>
      )}
    </div>
  );
}

