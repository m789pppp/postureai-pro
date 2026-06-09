/**
 * PostureAI Pro — HomePage v3
 * Full SaaS dashboard: sidebar + role-based content + working nav
 */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import ProfilePage from "./ProfilePage.jsx";

// ─── Role resolver ─────────────────────────────────────────────────
function resolveRole(profile, isAdmin, isHRAdmin) {
  if (isAdmin)                                                      return "platform_admin";
  if (isHRAdmin || profile?.is_org_owner || profile?.is_hr
      || profile?.user_type === "hr_admin")                         return "hr_admin";
  if (profile?.company_id && profile?.user_type !== "hr_admin")     return "employee";
  return "individual";
}

// ─── Design ───────────────────────────────────────────────────────
const SB = 240; // sidebar width

// ─── Helpers ──────────────────────────────────────────────────────
function ScoreRing({ score = 0, size = 110 }) {
  const r = (size - 14) / 2;
  const circ = 2 * Math.PI * r;
  const pct  = Math.min(100, Math.max(0, score));
  const col  = pct >= 80 ? "#10b981" : pct >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth={7}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={7}
        strokeDasharray={`${(pct/100)*circ} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)" }}/>
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="middle"
        fill={col} fontSize={size/3.8} fontWeight={800} fontFamily="system-ui"
        style={{ transform:`rotate(90deg)`,transformOrigin:`${size/2}px ${size/2}px` }}>
        {pct || "—"}
      </text>
    </svg>
  );
}

function Stat({ label, value, sub, color = "#3b82f6", cs }) {
  return (
    <div style={{ background: cs.card, border:`1px solid ${cs.border}`, borderRadius: 12,
      padding: "16px 18px" }}>
      <div style={{ fontSize:10, color:cs.muted, textTransform:"uppercase", letterSpacing:".07em",
        fontWeight:600, marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:26, fontWeight:800, color, lineHeight:1.1,
        fontFamily:"system-ui,-apple-system" }}>{value ?? "—"}</div>
      {sub && <div style={{ fontSize:11, color:cs.muted, marginTop:2 }}>{sub}</div>}
    </div>
  );
}

function WeekBars({ sessions, cs }) {
  const days = useMemo(() => {
    const arr = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds = d.toDateString();
      const ss = sessions.filter(s =>
        (s.created_at?.toDate?.() ?? new Date(s.created_at || 0)).toDateString() === ds);
      const avg = ss.length ? Math.round(ss.reduce((a,s)=>a+(s.avg_score||0),0)/ss.length) : 0;
      arr.push({ label:["Su","Mo","Tu","We","Th","Fr","Sa"][d.getDay()], score:avg, has:ss.length>0 });
    }
    return arr;
  }, [sessions]);
  return (
    <div style={{ display:"flex", gap:8, alignItems:"flex-end", height:60 }}>
      {days.map((d,i) => {
        const h = d.has ? Math.max(6,(d.score/100)*52) : 4;
        const c = d.score>=80?"#10b981":d.score>=60?"#f59e0b":d.has?"#ef4444":"rgba(255,255,255,.07)";
        return (
          <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
            <div style={{ width:"100%", height:h, borderRadius:4, background:c,
              transition:"height .6s cubic-bezier(.4,0,.2,1)" }} title={d.has?`${d.score}`:"no session"}/>
            <span style={{ fontSize:9, color:cs.muted, fontWeight:500 }}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function Empty({ icon, title, desc, action, onAction, cs }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
      justifyContent:"center", gap:12, padding:"56px 24px", textAlign:"center" }}>
      <span style={{ fontSize:44 }}>{icon}</span>
      <div style={{ fontSize:17, fontWeight:700, color:cs.text }}>{title}</div>
      <div style={{ fontSize:13, color:cs.muted, maxWidth:340, lineHeight:1.6 }}>{desc}</div>
      {action && onAction && (
        <button onClick={onAction} style={{ marginTop:8, padding:"10px 22px",
          background:"#3b82f6", color:"#fff", border:"none", borderRadius:8,
          fontSize:13, fontWeight:600, cursor:"pointer" }}>{action}</button>
      )}
    </div>
  );
}

function NavBtn({ icon, label, active, onClick, badge, cs }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ display:"flex", alignItems:"center", gap:10, width:"100%",
        padding:"9px 12px", border:"none", borderRadius:8,
        borderLeft: active ? "2px solid #3b82f6" : "2px solid transparent",
        background: active ? "rgba(59,130,246,.12)" : hov ? "rgba(255,255,255,.04)" : "transparent",
        color: active ? "#3b82f6" : "rgba(255,255,255,.7)",
        cursor:"pointer", fontSize:13, fontWeight: active ? 600 : 400,
        textAlign:"left", transition:"all .12s" }}>
      <span style={{ fontSize:15, width:20, textAlign:"center" }}>{icon}</span>
      <span style={{ flex:1 }}>{label}</span>
      {badge && <span style={{ background:"#ef4444", color:"#fff", fontSize:10, fontWeight:700,
        borderRadius:99, padding:"1px 5px" }}>{badge}</span>}
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════
// CONTENT PANELS
// ══════════════════════════════════════════════════════════════════

// Individual
function PanelIndividual({ profile, userSessions, tier, cs, isAr, setPage, startCamera, openCoach, openBilling, addToast }) {
  const last  = userSessions[0]?.avg_score || 0;
  const avg   = userSessions.length ? Math.round(userSessions.reduce((a,s)=>a+(s.avg_score||0),0)/userSessions.length) : 0;
  const month = userSessions.filter(s=>{ const d=s.created_at?.toDate?.()??new Date(s.created_at||0); const n=new Date(); return d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear(); }).length;
  const streak = profile?.streak_days || 0;
  const isPro  = ["professional","elite","business"].includes(tier);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      {/* Hero */}
      <div style={{ background:cs.card, border:`1px solid ${cs.border}`, borderRadius:12,
        padding:"24px", display:"flex", gap:24, alignItems:"center", flexWrap:"wrap" }}>
        <ScoreRing score={last||avg}/>
        <div style={{ flex:1, minWidth:180 }}>
          <div style={{ fontSize:20, fontWeight:800, color:cs.text, marginBottom:4 }}>
            {isAr ? `أهلاً، ${profile?.name?.split(" ")[0]||""}` : `Hey, ${profile?.name?.split(" ")[0]||""}!`}
          </div>
          <div style={{ fontSize:13, color:cs.muted, marginBottom:14, lineHeight:1.5 }}>
            {userSessions.length===0
              ? (isAr?"ابدأ جلستك الأولى لتتبع وضعيتك":"Start your first session to track posture")
              : last>=80 ? (isAr?"وضعيتك ممتازة 💪":"Great posture! Keep it up 💪")
              : last>=60 ? (isAr?"وضعيتك جيدة، استمر!":"Decent — keep going!")
              : (isAr?"وضعيتك تحتاج انتباه ⚠️":"Posture needs attention ⚠️")}
          </div>
          <button onClick={()=>{setPage("live");setTimeout(()=>startCamera?.(),200)}}
            style={{ padding:"10px 22px", background:"linear-gradient(135deg,#1a56db,#0891b2)",
              color:"#fff", border:"none", borderRadius:8, fontSize:13,
              fontWeight:700, cursor:"pointer", boxShadow:"0 4px 14px rgba(26,86,219,.4)" }}>
            {isAr ? "▶ ابدأ جلسة" : "▶ Start Session"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:12 }}>
        <Stat label={isAr?"متوسط النقاط":"Avg Score"} value={avg||"—"} color="#3b82f6" cs={cs}/>
        <Stat label={isAr?"التواصل":"Streak"} value={streak?`${streak}d`:"—"} sub={isAr?"أيام":"days"} color="#10b981" cs={cs}/>
        <Stat label={isAr?"هذا الشهر":"This Month"} value={month||"—"} sub={isAr?"جلسة":"sessions"} color="#f59e0b" cs={cs}/>
        <Stat label={isAr?"الخطة":"Plan"}
          value={isPro ? tier.charAt(0).toUpperCase()+tier.slice(1) : "Free"}
          color={isPro?"#10b981":"#f59e0b"} cs={cs}/>
      </div>

      {/* Week chart */}
      {userSessions.length > 0 && (
        <div style={{ background:cs.card, border:`1px solid ${cs.border}`, borderRadius:12, padding:"18px 20px" }}>
          <div style={{ fontSize:11, fontWeight:600, color:cs.muted, textTransform:"uppercase",
            letterSpacing:".07em", marginBottom:12 }}>{isAr?"آخر 7 أيام":"Last 7 days"}</div>
          <WeekBars sessions={userSessions} cs={cs}/>
        </div>
      )}

      {/* Actions */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:12 }}>
        {[
          { icon:"🤖", en:"AI Coach",      ar:"AI Coach",    desc:isAr?"نصائح بالذكاء الاصطناعي":"AI posture coaching",    onClick:openCoach,   pro:true },
          { icon:"📊", en:"PDF Report",    ar:"تقرير PDF",   desc:isAr?"تقرير وضعيتك الكامل":"Download full report",      onClick:()=>addToast(isAr?"قريباً...":"Coming soon…","info"), pro:true },
          { icon:"💳", en:"Subscription",  ar:"الاشتراك",    desc:isAr?"إدارة خطتك":"Upgrade or manage plan",             onClick:openBilling, pro:false },
        ].map((a,i)=>(
          <button key={i} onClick={a.onClick}
            onMouseEnter={e=>e.currentTarget.style.borderColor="#3b82f6"}
            onMouseLeave={e=>e.currentTarget.style.borderColor=cs.border}
            style={{ background:cs.card, border:`1px solid ${cs.border}`, borderRadius:12,
              padding:"16px", cursor:"pointer", textAlign:"left",
              display:"flex", gap:12, alignItems:"flex-start", transition:"border-color .15s" }}>
            <span style={{ fontSize:22 }}>{a.icon}</span>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:cs.text, marginBottom:2 }}>
                {isAr?a.ar:a.en}
                {a.pro&&!isPro&&<span style={{ marginLeft:6, fontSize:10, background:"#f59e0b22",
                  color:"#f59e0b", padding:"1px 6px", borderRadius:4 }}>PRO</span>}
              </div>
              <div style={{ fontSize:11, color:cs.muted }}>{a.desc}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Session history */}
      {userSessions.length > 0 ? (
        <div style={{ background:cs.card, border:`1px solid ${cs.border}`, borderRadius:12, padding:"18px 20px" }}>
          <div style={{ fontSize:11, fontWeight:600, color:cs.muted, textTransform:"uppercase",
            letterSpacing:".07em", marginBottom:12 }}>{isAr?"آخر الجلسات":"Recent Sessions"}</div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {userSessions.slice(0,5).map((s,i)=>{
              const d=s.created_at?.toDate?.()??new Date(s.created_at||0);
              const sc=s.avg_score||0;
              const col=sc>=80?"#10b981":sc>=60?"#f59e0b":"#ef4444";
              return (
                <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                  padding:"10px 12px", background:"rgba(255,255,255,.025)",
                  borderRadius:8, border:`1px solid ${cs.border}` }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:cs.text }}>
                      {isAr?`جلسة #${userSessions.length-i}`:`Session #${userSessions.length-i}`}
                    </div>
                    <div style={{ fontSize:11, color:cs.muted }}>
                      {d.toLocaleDateString(isAr?"ar-EG":"en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}
                    </div>
                  </div>
                  <div style={{ fontSize:20, fontWeight:800, color:col }}>{sc}</div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <Empty icon="🎯" cs={cs}
          title={isAr?"لم تبدأ أي جلسة":"No sessions yet"}
          desc={isAr?"اضغط ابدأ جلسة وتأكد من تشغيل الكاميرا":"Click Start Session and allow camera access"}
          action={isAr?"ابدأ الآن":"Start Now"}
          onAction={()=>{setPage("live");setTimeout(()=>startCamera?.(),200)}}/>
      )}
    </div>
  );
}

// Employee
function PanelEmployee({ profile, userSessions, allUsers, cs, isAr, setPage, startCamera }) {
  const last   = userSessions[0]?.avg_score||0;
  const avg    = userSessions.length ? Math.round(userSessions.reduce((a,s)=>a+(s.avg_score||0),0)/userSessions.length) : 0;
  const streak = profile?.streak_days||0;
  const rank   = useMemo(()=>{
    if(!allUsers?.length) return null;
    const sorted=[...allUsers].sort((a,b)=>(b.avg_score||0)-(a.avg_score||0));
    const i=sorted.findIndex(u=>u.uid===profile?.uid||u.id===profile?.uid);
    return i>=0?{pos:i+1,total:sorted.length}:null;
  },[allUsers,profile]);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      <div style={{ background:cs.card, border:`1px solid ${cs.border}`, borderRadius:12,
        padding:"24px", display:"flex", gap:24, alignItems:"center", flexWrap:"wrap" }}>
        <ScoreRing score={last||avg}/>
        <div style={{ flex:1, minWidth:180 }}>
          <div style={{ fontSize:20, fontWeight:800, color:cs.text, marginBottom:2 }}>
            {isAr?`أهلاً، ${profile?.name?.split(" ")[0]||""}`:`Hey, ${profile?.name?.split(" ")[0]||""}!`}
          </div>
          <div style={{ fontSize:12, color:"#60a5fa", marginBottom:8, fontWeight:500 }}>
            {profile?.department||profile?.company||(isAr?"موظف":"Employee")}
          </div>
          <div style={{ fontSize:13, color:cs.muted, marginBottom:14 }}>
            {last>=80?(isAr?"وضعيتك ممتازة اليوم 💪":"Great posture today 💪")
             :last>=60?(isAr?"وضعيتك تتحسن 📈":"Your posture is improving 📈")
             :(isAr?"ابدأ جلسة لتحسين وضعيتك":"Start a session to improve")}
          </div>
          <button onClick={()=>{setPage("live");setTimeout(()=>startCamera?.(),200)}}
            style={{ padding:"10px 22px", background:"linear-gradient(135deg,#1a56db,#0891b2)",
              color:"#fff", border:"none", borderRadius:8, fontSize:13,
              fontWeight:700, cursor:"pointer" }}>
            {isAr?"▶ ابدأ جلسة":"▶ Start Session"}
          </button>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:12 }}>
        <Stat label={isAr?"متوسط نقاطك":"Your Avg"} value={avg||"—"} color="#3b82f6" cs={cs}/>
        <Stat label={isAr?"التواصل":"Streak"} value={streak?`${streak}d`:"—"} color="#10b981" cs={cs}/>
        {rank&&<Stat label={isAr?"ترتيبك":"Team Rank"} value={`#${rank.pos}`}
          sub={`${isAr?"من":"of"} ${rank.total}`} color="#f59e0b" cs={cs}/>}
        <Stat label={isAr?"الجلسات":"Sessions"} value={userSessions.length||"—"} color="#a855f7" cs={cs}/>
      </div>

      {userSessions.length>0&&(
        <div style={{ background:cs.card, border:`1px solid ${cs.border}`, borderRadius:12, padding:"18px 20px" }}>
          <div style={{ fontSize:11, fontWeight:600, color:cs.muted, textTransform:"uppercase",
            letterSpacing:".07em", marginBottom:12 }}>{isAr?"آخر 7 أيام":"Last 7 days"}</div>
          <WeekBars sessions={userSessions} cs={cs}/>
        </div>
      )}

      {allUsers?.length>1&&(
        <div style={{ background:cs.card, border:`1px solid ${cs.border}`, borderRadius:12, padding:"18px 20px" }}>
          <div style={{ fontSize:11, fontWeight:600, color:cs.muted, textTransform:"uppercase",
            letterSpacing:".07em", marginBottom:12 }}>{isAr?"لوحة الفريق":"Team Leaderboard"}</div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {[...allUsers].sort((a,b)=>(b.avg_score||0)-(a.avg_score||0)).slice(0,7).map((u,i)=>{
              const isMe=u.uid===profile?.uid||u.id===profile?.uid;
              const sc=u.avg_score||0;
              const col=sc>=80?"#10b981":sc>=60?"#f59e0b":"#ef4444";
              return (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:12,
                  padding:"10px 12px",
                  background:isMe?"rgba(59,130,246,.08)":"rgba(255,255,255,.025)",
                  borderRadius:8, border:`1px solid ${isMe?"rgba(59,130,246,.4)":cs.border}` }}>
                  <div style={{ fontSize:13, fontWeight:700, color:cs.muted, width:22, textAlign:"center" }}>
                    {i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:isMe?700:500,
                      color:isMe?"#60a5fa":cs.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                      {u.name||u.email?.split("@")[0]}
                      {isMe&&<span style={{ marginLeft:6, fontSize:10, color:"#60a5fa" }}>
                        {isAr?"(أنت)":"(you)"}</span>}
                    </div>
                    <div style={{ fontSize:11, color:cs.muted }}>{u.department||""}</div>
                  </div>
                  <div style={{ fontSize:18, fontWeight:800, color:col }}>{sc||"—"}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// HR Admin
function PanelHR({ profile, allUsers, cs, isAr, addToast, openBilling, openInvite }) {
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("all");
  const users = allUsers||[];
  const depts = ["all",...new Set(users.map(u=>u.department||"").filter(Boolean))];
  const filtered = users.filter(u=>{
    const ms=!search||u.name?.toLowerCase().includes(search.toLowerCase())||u.email?.toLowerCase().includes(search.toLowerCase());
    const md=dept==="all"||(u.department||"")===dept;
    return ms&&md;
  });
  const avg     = users.length?Math.round(users.reduce((a,u)=>a+(u.avg_score||0),0)/users.length):0;
  const healthy = users.filter(u=>(u.avg_score||0)>=80).length;
  const atRisk  = users.filter(u=>(u.avg_score||0)>0&&(u.avg_score||0)<50).length;
  const active  = users.filter(u=>u.last_session_at).length;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      {/* Header */}
      <div style={{ background:"linear-gradient(135deg,rgba(26,86,219,.12),rgba(8,145,178,.06))",
        border:"1px solid rgba(59,130,246,.2)", borderRadius:12, padding:"22px",
        display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:14 }}>
        <div>
          <div style={{ fontSize:11, color:"#60a5fa", fontWeight:600, marginBottom:4,
            textTransform:"uppercase", letterSpacing:".07em" }}>
            {isAr?"لوحة إدارة الشركة":"Company Admin"}
          </div>
          <div style={{ fontSize:20, fontWeight:800, color:"#f0f6ff" }}>
            {profile?.company||(isAr?"شركتي":"My Company")}
          </div>
          <div style={{ fontSize:12, color:"rgba(255,255,255,.45)", marginTop:4 }}>
            {users.length} {isAr?"موظف":"employees"}
          </div>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={openInvite}
            style={{ padding:"9px 18px", background:"#1a56db", color:"#fff",
              border:"none", borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer" }}>
            {isAr?"+ دعوة موظفين":"+ Invite Employees"}
          </button>
          <button onClick={openBilling}
            style={{ padding:"9px 18px", background:"rgba(255,255,255,.06)", color:"#f0f6ff",
              border:"1px solid rgba(255,255,255,.12)", borderRadius:8, fontSize:13,
              fontWeight:600, cursor:"pointer" }}>
            {isAr?"الاشتراك":"Billing"}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:12 }}>
        <Stat label={isAr?"متوسط الفريق":"Team Avg"} value={avg||"—"} color="#3b82f6" cs={cs}/>
        <Stat label={isAr?"صحة ممتازة":"Healthy"} value={healthy}
          sub={`${users.length?Math.round(healthy/users.length*100):0}%`} color="#10b981" cs={cs}/>
        <Stat label={isAr?"خطر عالي":"High Risk"} value={atRisk}
          color={atRisk>0?"#ef4444":"#10b981"} cs={cs}/>
        <Stat label={isAr?"نشطون":"Active"} value={active} color="#f59e0b" cs={cs}/>
      </div>

      {/* Risk alert */}
      {atRisk>0&&(
        <div style={{ background:"rgba(239,68,68,.07)", border:"1px solid rgba(239,68,68,.2)",
          borderRadius:12, padding:"14px 18px", display:"flex", gap:14, alignItems:"center" }}>
          <span style={{ fontSize:22 }}>⚠️</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:700, color:"#f87171", marginBottom:2 }}>
              {isAr?`${atRisk} موظف في خطر`:`${atRisk} employees at risk`}
            </div>
            <div style={{ fontSize:12, color:"rgba(255,255,255,.45)" }}>
              {isAr?"نقاط وضعيتهم أقل من 50":"Posture scores below 50"}
            </div>
          </div>
          <button onClick={()=>addToast(isAr?"تم إرسال تنبيهات":"Alerts sent ✓","success")}
            style={{ padding:"8px 14px", background:"#ef4444", color:"#fff",
              border:"none", borderRadius:7, fontSize:12, fontWeight:600, cursor:"pointer",
              whiteSpace:"nowrap" }}>
            {isAr?"أرسل تنبيه":"Send Alert"}
          </button>
        </div>
      )}

      {/* Employee table */}
      <div style={{ background:cs.card, border:`1px solid ${cs.border}`, borderRadius:12, overflow:"hidden" }}>
        <div style={{ padding:"14px 18px", borderBottom:`1px solid ${cs.border}`,
          display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
          <div style={{ fontSize:14, fontWeight:700, color:cs.text, flex:1 }}>
            {isAr?"الموظفون":"Employees"}
          </div>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder={isAr?"بحث...":"Search..."}
            style={{ padding:"7px 12px", background:"rgba(255,255,255,.05)",
              border:`1px solid ${cs.border}`, borderRadius:7, color:cs.text,
              fontSize:13, outline:"none", width:170 }}/>
          {depts.length>1&&(
            <select value={dept} onChange={e=>setDept(e.target.value)}
              style={{ padding:"7px 12px", background:cs.card, border:`1px solid ${cs.border}`,
                borderRadius:7, color:cs.text, fontSize:13, outline:"none" }}>
              {depts.map(d=><option key={d} value={d}>{d==="all"?(isAr?"الكل":"All"):d}</option>)}
            </select>
          )}
        </div>
        <div style={{ maxHeight:400, overflowY:"auto" }}>
          {filtered.length===0?(
            <Empty icon="👥" cs={cs}
              title={isAr?"لا يوجد موظفون":"No employees yet"}
              desc={isAr?"أرسل دعوات لموظفيك":"Invite your team to get started"}
              action={isAr?"دعوة الآن":"Invite Now"} onAction={openInvite}/>
          ):filtered.map((u,i)=>{
            const sc=u.avg_score||0;
            const col=sc>=80?"#10b981":sc>=60?"#f59e0b":sc>0?"#ef4444":"rgba(255,255,255,.3)";
            const risk=sc>0&&sc<50;
            return (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:12,
                padding:"11px 18px", borderBottom:`1px solid ${cs.border}`,
                background:risk?"rgba(239,68,68,.04)":"transparent" }}>
                <div style={{ width:34, height:34, borderRadius:"50%", flexShrink:0,
                  background:`hsl(${(u.name||"A").charCodeAt(0)*17%360},55%,32%)`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:13, fontWeight:700, color:"#fff" }}>
                  {(u.name||u.email||"?")[0].toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:cs.text,
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {u.name||u.email?.split("@")[0]}
                    {risk&&<span style={{ marginLeft:7, fontSize:10, background:"#ef444420",
                      color:"#ef4444", padding:"1px 5px", borderRadius:4, fontWeight:700 }}>
                      ⚠ RISK</span>}
                  </div>
                  <div style={{ fontSize:11, color:cs.muted,
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {u.department||u.email||"—"}
                  </div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:18, fontWeight:800, color:col }}>{sc||"—"}</div>
                  <div style={{ fontSize:10, color:cs.muted }}>{u.sessions_count||0} sess</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Analytics stub
function PanelAnalytics({ cs, isAr }) {
  return <Empty icon="📊" cs={cs}
    title={isAr?"التحليلات المتقدمة":"Advanced Analytics"}
    desc={isAr?"قريباً — تحليل بيومتري كامل للفريق":"Coming soon — full team biometric analytics with AI insights"}/>;
}

// Alerts panel
function PanelAlerts({ allUsers, cs, isAr, addToast }) {
  const atRisk=(allUsers||[]).filter(u=>(u.avg_score||0)>0&&(u.avg_score||0)<50);
  if(!atRisk.length) return <Empty icon="✅" cs={cs}
    title={isAr?"لا توجد تنبيهات":"No alerts"}
    desc={isAr?"كل الموظفين بوضعية جيدة":"All employees have healthy posture scores"}/>;
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ fontSize:15, fontWeight:700, color:"#f0f6ff", marginBottom:4 }}>
        {isAr?`${atRisk.length} موظف في خطر`:`${atRisk.length} at-risk employees`}
      </div>
      {atRisk.map((u,i)=>(
        <div key={i} style={{ background:"rgba(239,68,68,.06)", border:"1px solid rgba(239,68,68,.18)",
          borderRadius:12, padding:"14px 18px", display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ width:36, height:36, borderRadius:"50%", background:"#ef444428",
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>⚠️</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:600, color:"#f0f6ff" }}>{u.name||u.email}</div>
            <div style={{ fontSize:12, color:"rgba(255,255,255,.4)" }}>
              {isAr?"وضعية:":"Score:"} {u.avg_score||0} · {u.department||""}
            </div>
          </div>
          <button onClick={()=>addToast(`${isAr?"تم إرسال تنبيه لـ":"Alert sent to"} ${u.name||u.email}`,"success")}
            style={{ padding:"7px 14px", background:"#ef4444", color:"#fff",
              border:"none", borderRadius:7, fontSize:12, fontWeight:600, cursor:"pointer" }}>
            {isAr?"أرسل تنبيه":"Send Alert"}
          </button>
        </div>
      ))}
    </div>
  );
}

// My Sessions
function PanelSessions({ userSessions, cs, isAr, setPage, startCamera }) {
  if(!userSessions.length) return <Empty icon="📋" cs={cs}
    title={isAr?"لا توجد جلسات":"No sessions yet"}
    desc={isAr?"ابدأ جلستك الأولى الآن":"Start your first session now"}
    action={isAr?"ابدأ جلسة":"Start Session"}
    onAction={()=>{setPage("live");setTimeout(()=>startCamera?.(),200)}}/>;
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      {userSessions.map((s,i)=>{
        const d=s.created_at?.toDate?.()??new Date(s.created_at||0);
        const sc=s.avg_score||0;
        const col=sc>=80?"#10b981":sc>=60?"#f59e0b":"#ef4444";
        const dur=s.duration_sec?`${Math.round(s.duration_sec/60)}min`:"";
        return (
          <div key={i} style={{ background:cs.card, border:`1px solid ${cs.border}`,
            borderRadius:10, padding:"14px 18px", display:"flex", alignItems:"center", gap:14 }}>
            <div style={{ width:44, height:44, borderRadius:8, background:`${col}18`,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:18, fontWeight:800, color:col, flexShrink:0 }}>{sc||"—"}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:600, color:cs.text }}>
                {isAr?`جلسة #${userSessions.length-i}`:`Session #${userSessions.length-i}`}
              </div>
              <div style={{ fontSize:11, color:cs.muted }}>
                {d.toLocaleDateString(isAr?"ar-EG":"en-US",{weekday:"short",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}
                {dur&&` · ${dur}`}
              </div>
            </div>
            <div style={{ fontSize:11, fontWeight:600, padding:"4px 10px", borderRadius:99,
              background:sc>=80?"rgba(16,185,129,.12)":sc>=60?"rgba(245,158,11,.12)":"rgba(239,68,68,.12)",
              color:col }}>
              {sc>=80?(isAr?"ممتاز":"Great"):sc>=60?(isAr?"جيد":"Good"):(isAr?"ضعيف":"Poor")}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// SIDEBAR
// ══════════════════════════════════════════════════════════════════
function Sidebar({ role, tab, setTab, profile, isAr, cs, setPage, startCamera,
  logOut, setUser, setProfile, isAdmin, darkMode, setDarkMode, setLang, lang, tier,
  atRiskCount }) {

  const nav = useMemo(()=>{
    if(role==="hr_admin"||role==="platform_admin") return [
      { id:"home",      icon:"⊞",  en:"Overview",   ar:"النظرة العامة" },
      { id:"employees", icon:"👥", en:"Employees",  ar:"الموظفون" },
      { id:"analytics", icon:"📊", en:"Analytics",  ar:"التحليلات" },
      { id:"alerts",    icon:"🔔", en:"Alerts",      ar:"التنبيهات", badge:atRiskCount||0 },
      { id:"profile",   icon:"⚙️", en:"Settings",   ar:"الإعدادات" },
    ];
    if(role==="employee") return [
      { id:"home",     icon:"⊞",  en:"Dashboard",  ar:"الرئيسية" },
      { id:"sessions", icon:"📋", en:"Sessions",   ar:"جلساتي" },
      { id:"team",     icon:"👥", en:"Team",        ar:"الفريق" },
      { id:"profile",  icon:"⚙️", en:"Settings",   ar:"الإعدادات" },
    ];
    return [
      { id:"home",     icon:"⊞",  en:"Dashboard",     ar:"الرئيسية" },
      { id:"sessions", icon:"📋", en:"Sessions",      ar:"جلساتي" },
      { id:"coach",    icon:"🤖", en:"AI Coach",      ar:"AI Coach" },
      { id:"billing",  icon:"💳", en:"Subscription",  ar:"الاشتراك" },
      { id:"profile",  icon:"⚙️", en:"Settings",      ar:"الإعدادات" },
    ];
  },[role,atRiskCount]);

  return (
    <aside style={{ width:SB, flexShrink:0, height:"100vh", position:"sticky", top:0,
      background:"rgba(5,11,22,.98)", borderRight:`1px solid ${cs.border}`,
      display:"flex", flexDirection:"column", overflow:"hidden" }}>

      {/* Logo */}
      <div style={{ padding:"18px 14px 14px", borderBottom:`1px solid ${cs.border}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:32, height:32, background:"linear-gradient(135deg,#1a56db,#0891b2)",
            borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:18, flexShrink:0 }}>◈</div>
          <div>
            <div style={{ fontSize:13, fontWeight:800, color:"#f0f6ff", letterSpacing:"-.01em" }}>PostureAI</div>
            <div style={{ fontSize:9.5, color:"#3b82f6", fontWeight:600, textTransform:"uppercase", letterSpacing:".06em" }}>
              {tier==="elite"?"Elite":tier==="professional"?"Pro":tier==="business"?"Business":"Free"}
              {" · "}{role==="hr_admin"?"Admin":role==="employee"?"Employee":"Personal"}
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex:1, padding:"10px 8px", display:"flex", flexDirection:"column", gap:2, overflowY:"auto" }}>
        {nav.map(item=>(
          <NavBtn key={item.id} icon={item.icon} label={isAr?item.ar:item.en}
            active={tab===item.id} badge={item.badge||0}
            onClick={()=>setTab(item.id)} cs={cs}/>
        ))}

        {isAdmin&&<NavBtn icon="🔧" label={isAr?"منصة المشرف":"Platform Admin"}
          active={false} onClick={()=>setPage("admin")} cs={cs}/>}

        {/* Start session */}
        <div style={{ marginTop:12, paddingTop:12, borderTop:`1px solid ${cs.border}` }}>
          <button onClick={()=>{setPage("live");setTimeout(()=>startCamera?.(),200)}}
            style={{ width:"100%", padding:"10px", border:"none", borderRadius:8,
              background:"linear-gradient(135deg,#1a56db,#0891b2)", color:"#fff",
              fontSize:13, fontWeight:700, cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center", gap:8,
              boxShadow:"0 4px 12px rgba(26,86,219,.35)" }}>
            ▶ {isAr?"ابدأ جلسة":"Start Session"}
          </button>
        </div>
      </nav>

      {/* User footer */}
      <div style={{ padding:"10px 8px", borderTop:`1px solid ${cs.border}` }}>
        <div style={{ display:"flex", gap:6, marginBottom:8 }}>
          <button onClick={()=>setLang(lang==="ar"?"en":"ar")}
            style={{ flex:1, padding:"6px", background:"rgba(255,255,255,.05)",
              border:`1px solid ${cs.border}`, borderRadius:6,
              color:cs.muted, fontSize:11, cursor:"pointer", fontWeight:500 }}>
            {lang==="ar"?"🇬🇧 EN":"🇪🇬 عربي"}
          </button>
          <button onClick={()=>setDarkMode(!darkMode)}
            style={{ padding:"6px 10px", background:"rgba(255,255,255,.05)",
              border:`1px solid ${cs.border}`, borderRadius:6,
              color:cs.muted, fontSize:12, cursor:"pointer" }}>
            {darkMode?"☀️":"🌙"}
          </button>
        </div>

        {/* User row + logout */}
        <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 6px",
          background:"rgba(255,255,255,.03)", borderRadius:8, cursor:"pointer" }}
          onClick={()=>setTab("profile")}>
          <div style={{ width:30, height:30, borderRadius:"50%", flexShrink:0,
            background:"linear-gradient(135deg,#1a56db,#0891b2)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:13, fontWeight:700, color:"#fff" }}>
            {(profile?.name||"?")[0].toUpperCase()}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:12, fontWeight:600, color:"#f0f6ff",
              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {profile?.name||profile?.email?.split("@")[0]||"—"}
            </div>
            <div style={{ fontSize:10, color:cs.muted,
              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {profile?.email||""}
            </div>
          </div>
          <button
            title={isAr?"تسجيل الخروج":"Sign out"}
            onClick={e=>{
              e.stopPropagation();
              logOut?.();
              setUser?.(null);
              setProfile?.(null);
            }}
            style={{ padding:"4px 8px", background:"rgba(239,68,68,.12)",
              border:"1px solid rgba(239,68,68,.2)", borderRadius:6,
              color:"#f87171", fontSize:10, fontWeight:600, cursor:"pointer",
              whiteSpace:"nowrap" }}>
            {isAr?"خروج":"Sign out"}
          </button>
        </div>
      </div>
    </aside>
  );
}

// ── Mobile bottom nav ─────────────────────────────────────────────
function MobileNav({ role, tab, setTab, setPage, startCamera, isAr, cs, atRiskCount }) {
  const tabs = role==="hr_admin"||role==="platform_admin" ? [
    { id:"home",      icon:"⊞", en:"Overview",  ar:"نظرة" },
    { id:"employees", icon:"👥", en:"Team",      ar:"الفريق" },
    { id:"live",      icon:"▶",  en:"Session",   ar:"جلسة",  special:true },
    { id:"alerts",    icon:"🔔", en:"Alerts",    ar:"تنبيهات", badge:atRiskCount },
    { id:"profile",   icon:"⚙️", en:"Settings",  ar:"إعدادات" },
  ] : role==="employee" ? [
    { id:"home",     icon:"⊞", en:"Home",     ar:"الرئيسية" },
    { id:"team",     icon:"👥", en:"Team",     ar:"الفريق" },
    { id:"live",     icon:"▶",  en:"Session",  ar:"جلسة", special:true },
    { id:"sessions", icon:"📋", en:"History",  ar:"السجل" },
    { id:"profile",  icon:"⚙️", en:"Profile",  ar:"حسابي" },
  ] : [
    { id:"home",     icon:"⊞", en:"Home",    ar:"الرئيسية" },
    { id:"sessions", icon:"📋", en:"History", ar:"السجل" },
    { id:"live",     icon:"▶",  en:"Session", ar:"جلسة", special:true },
    { id:"coach",    icon:"🤖", en:"Coach",  ar:"Coach" },
    { id:"profile",  icon:"⚙️", en:"Profile", ar:"حسابي" },
  ];

  return (
    <nav style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:200,
      background:"rgba(5,11,22,.97)", borderTop:`1px solid ${cs.border}`,
      backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)",
      display:"flex", alignItems:"center",
      padding:`8px 0 max(8px,env(safe-area-inset-bottom))` }}>
      {tabs.map(t=>(
        <button key={t.id}
          onClick={()=>{
            if(t.id==="live"){setPage("live");setTimeout(()=>startCamera?.(),200);}
            else setTab(t.id);
          }}
          style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center",
            gap:3, padding:"4px 0", background:"none", border:"none", cursor:"pointer",
            position:"relative" }}>
          {t.special ? (
            <div style={{ width:44, height:44, borderRadius:"50%",
              background:"linear-gradient(135deg,#1a56db,#0891b2)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:18, color:"#fff", marginTop:-16,
              boxShadow:"0 4px 14px rgba(26,86,219,.5)" }}>▶</div>
          ) : (
            <>
              <span style={{ fontSize:18, color:tab===t.id?"#3b82f6":"rgba(255,255,255,.3)" }}>
                {t.icon}
              </span>
              {t.badge>0&&<span style={{ position:"absolute", top:2, right:"20%",
                background:"#ef4444", color:"#fff", fontSize:9, fontWeight:700,
                borderRadius:99, padding:"0 4px", minWidth:14, textAlign:"center" }}>
                {t.badge}</span>}
            </>
          )}
          {!t.special&&(
            <span style={{ fontSize:9.5, fontWeight:tab===t.id?700:400,
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
  user, profile, cs, lang, isAr, dir,
  userSessions, allUsers,
  tier, mode, setMode,
  setPage, startCamera, addToast,
  setShowCoach, setShowBilling, setShowCompanyOnboard, setShowAdmin,
  isAdmin, isHRAdmin, companyId,
  darkMode, setDarkMode, setLang,
  t, logOut, setUser, setProfile,
}) {
  const [tab, setTab]       = useState("home");
  const [mobile, setMobile] = useState(()=>typeof window!=="undefined"&&window.innerWidth<1024);

  useEffect(()=>{
    const fn=()=>setMobile(window.innerWidth<1024);
    window.addEventListener("resize",fn);
    return ()=>window.removeEventListener("resize",fn);
  },[]);

  const role      = resolveRole(profile, isAdmin, isHRAdmin);
  const atRisk    = (allUsers||[]).filter(u=>(u.avg_score||0)>0&&(u.avg_score||0)<50).length;
  const openCoach = useCallback(()=>setShowCoach?.(true),[setShowCoach]);
  const openBill  = useCallback(()=>setShowBilling?.(true),[setShowBilling]);
  const openInvite= useCallback(()=>setShowCompanyOnboard?.(true),[setShowCompanyOnboard]);

  // ── Render active tab ─────────────────────────────────────────
  const renderTab = () => {
    // Profile / Settings — inline (no page redirect)
    if(tab==="profile") return (
      <ProfilePage
        user={user} profile={profile} cs={cs} lang={lang}
        isAr={isAr} dir={dir} t={t||{}} addToast={addToast}
        onBack={()=>setTab("home")}
        onSignOut={()=>{ logOut?.(); setUser?.(null); setProfile?.(null); }}
      />
    );

    // HR Admin
    if(role==="hr_admin"||role==="platform_admin"){
      if(tab==="home"||tab==="employees")
        return <PanelHR profile={profile} allUsers={allUsers} cs={cs} isAr={isAr}
          addToast={addToast} openBilling={openBill} openInvite={openInvite}/>;
      if(tab==="analytics") return <PanelAnalytics cs={cs} isAr={isAr}/>;
      if(tab==="alerts")    return <PanelAlerts allUsers={allUsers} cs={cs} isAr={isAr} addToast={addToast}/>;
      if(tab==="coach")     { openCoach(); setTab("home"); return null; }
      if(tab==="billing")   { openBill();  setTab("home"); return null; }
    }

    // Employee
    if(role==="employee"){
      if(tab==="home"||tab==="team")
        return <PanelEmployee profile={profile} userSessions={userSessions}
          allUsers={allUsers} cs={cs} isAr={isAr} setPage={setPage} startCamera={startCamera}/>;
      if(tab==="sessions")
        return <PanelSessions userSessions={userSessions} cs={cs} isAr={isAr}
          setPage={setPage} startCamera={startCamera}/>;
    }

    // Individual (default)
    if(tab==="sessions")
      return <PanelSessions userSessions={userSessions} cs={cs} isAr={isAr}
        setPage={setPage} startCamera={startCamera}/>;
    if(tab==="coach")   { openCoach(); setTab("home"); return null; }
    if(tab==="billing") { openBill();  setTab("home"); return null; }

    return <PanelIndividual profile={profile} userSessions={userSessions} tier={tier}
      cs={cs} isAr={isAr} setPage={setPage} startCamera={startCamera}
      openCoach={openCoach} openBilling={openBill} addToast={addToast}/>;
  };

  const tabLabel = {
    home:"Dashboard", employees:"Employees", analytics:"Analytics",
    alerts:"Alerts", sessions:"Sessions", team:"Team",
    profile:"Settings", coach:"AI Coach", billing:"Billing",
  };
  const tabLabelAr = {
    home:"الرئيسية", employees:"الموظفون", analytics:"التحليلات",
    alerts:"التنبيهات", sessions:"الجلسات", team:"الفريق",
    profile:"الإعدادات", coach:"AI Coach", billing:"الاشتراك",
  };

  const content = renderTab();

  return (
    <div dir={dir} style={{ display:"flex", minHeight:"100vh",
      background:cs.bg||"#030b14", color:cs.text||"#f0f6ff",
      fontFamily:"system-ui,-apple-system,'Segoe UI',sans-serif" }}>

      {/* Sidebar */}
      {!mobile&&(
        <Sidebar role={role} tab={tab} setTab={setTab} profile={profile}
          isAr={isAr} cs={cs} setPage={setPage} startCamera={startCamera}
          logOut={logOut} setUser={setUser} setProfile={setProfile}
          isAdmin={isAdmin} darkMode={darkMode} setDarkMode={setDarkMode}
          setLang={setLang} lang={lang} tier={tier} atRiskCount={atRisk}/>
      )}

      {/* Main */}
      <main style={{ flex:1, minWidth:0, overflowY:"auto",
        paddingBottom:mobile?80:0 }}>

        {/* Topbar */}
        <header style={{ position:"sticky", top:0, zIndex:100,
          background:"rgba(5,11,22,.96)", borderBottom:`1px solid ${cs.border}`,
          backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)",
          padding:"0 20px", height:52,
          display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>

          {/* Mobile: hamburger logo */}
          {mobile&&(
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:28, height:28, background:"linear-gradient(135deg,#1a56db,#0891b2)",
                borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:16 }}>◈</div>
              <span style={{ fontSize:13, fontWeight:800, color:"#f0f6ff" }}>PostureAI</span>
            </div>
          )}

          <div style={{ fontSize:14, fontWeight:700, color:"#f0f6ff" }}>
            {isAr?tabLabelAr[tab]:tabLabel[tab]||"Dashboard"}
          </div>

          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <button onClick={()=>{setPage("live");setTimeout(()=>startCamera?.(),200)}}
              style={{ padding:"6px 14px", background:"rgba(26,86,219,.15)",
                border:"1px solid rgba(59,130,246,.3)", borderRadius:7,
                color:"#60a5fa", fontSize:12, fontWeight:600, cursor:"pointer" }}>
              ▶ {isAr?"جلسة":"Session"}
            </button>
            <button onClick={()=>setTab("profile")}
              style={{ width:30, height:30, borderRadius:"50%", border:"none",
                background:"linear-gradient(135deg,#1a56db,#0891b2)",
                color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>
              {(profile?.name||"?")[0].toUpperCase()}
            </button>
          </div>
        </header>

        {/* Content */}
        <div style={{ padding:"20px", maxWidth:1080, margin:"0 auto" }}>
          {content}
        </div>
      </main>

      {/* Mobile nav */}
      {mobile&&(
        <MobileNav role={role} tab={tab} setTab={setTab}
          setPage={setPage} startCamera={startCamera}
          isAr={isAr} cs={cs} atRiskCount={atRisk}/>
      )}
    </div>
  );
}
