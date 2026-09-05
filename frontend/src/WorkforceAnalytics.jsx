/**
 * Corvus — WorkforceAnalytics v1.0
 * Phase 7: Advanced Analytics
 * Workforce Analytics: productivity trends · focus · fatigue · engagement · risk heatmaps
 * Executive KPIs: company wellness - dept comparison - session regularity - posture stability - monthly insights
 * Powered by Corvus AI — runs locally in the browser, free, no API key
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { sessionFatigue } from "./lib/clinicalMetrics.js";
import { geminiAnalysis } from "./gemini.js";
import { useBodyScrollLock } from "./lib/useBodyScrollLock.js";

/* ── helpers ──────────────────────────────────────────────────────── */
const avg  = arr => arr.length ? Math.round(arr.reduce((a,v) => a+v,0) / arr.length) : 0;
const sc   = v => v >= 75 ? "#10b981" : v >= 50 ? "#f59e0b" : "#ef4444";
const grad = (v, alpha=.12) => v >= 75 ? `rgba(16,185,129,${alpha})` : v >= 50 ? `rgba(245,158,11,${alpha})` : `rgba(239,68,68,${alpha})`;
const pct  = (a,b) => b ? Math.round(((a-b)/b)*100) : 0;
const fmtDate = d => { try { return new Date(d?.toDate?.() || d).toLocaleDateString("en-GB",{day:"2-digit",month:"short"}); } catch { return "—"; } };
const SYNE = "'Syne',sans-serif";
const SPRING = "cubic-bezier(0.16,1,0.3,1)";

/* ── Markdown renderer ────────────────────────────────────────────── */
function Md({ text }) {
  const html=(text||"")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>")
    .replace(/\*(.+?)\*/g,"<em>$1</em>")
    .replace(/^### (.+)$/gm,"<h4 style='margin:9px 0 4px;font-size:13px;font-weight:700;color:var(--wa-text)'>$1</h4>")
    .replace(/^## (.+)$/gm,"<h3 style='margin:13px 0 5px;font-size:15px;font-weight:800;color:var(--wa-text);font-family:Syne,sans-serif'>$1</h3>")
    .replace(/^- (.+)$/gm,"<li style='margin:4px 0;line-height:1.65'>$1</li>")
    .replace(/(<li[\s\S]+?<\/li>)/g,"<ul style='padding-left:18px;margin:8px 0'>$1</ul>")
    .replace(/\n\n/g,"<br/><br/>").replace(/\n/g,"<br/>");
  return <span dangerouslySetInnerHTML={{__html:html}} style={{lineHeight:1.75}} />;
}

/* ── Animated counter ─────────────────────────────────────────────── */
function useCounter(target, active) {
  const [val,setVal]=useState(0);
  useEffect(()=>{
    if(!active) return;
    let f=0; const tick=()=>{ f++; setVal(Math.round((1-Math.pow(1-f/60,3))*target)); if(f<60) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  },[target,active]);
  return val;
}

/* ── Loading skeleton ─────────────────────────────────────────────── */
function Skeleton({h=14,w="100%",r=6}) {
  return <div style={{height:h,width:w,borderRadius:r,background:"var(--wa-shimmer)",backgroundSize:"400% 100%",animation:"wa-shimmer 1.6s ease infinite"}} />;
}
function CardSkeleton({h=80}) {
  return (
    <div style={{background:"var(--wa-card)",border:"1px solid var(--wa-border)",borderRadius:14,padding:16}}>
      <Skeleton h={10} w="50%" r={5} /><div style={{height:8}} />
      <Skeleton h={h} r={8} />
    </div>
  );
}

/* ── Spark line ───────────────────────────────────────────────────── */
function Spark({data=[],color="#1a56db",h=40,showFill=true}) {
  if(data.length<2) return null;
  const _data=data||[]; const max=Math.max(..._data,1), pts=_data.map((v,i)=>[i/(data.length-1)*200,((max-v)/max)*h]);
  const poly=pts.map(([x,y])=>`${x},${y}`).join(" ");
  const fill=`M0,${h} ${poly} L200,${h} Z`;
  const id=`sg-${Math.random().toString(36).slice(2)}`;
  return (
    <svg viewBox={`0 0 200 ${h}`} preserveAspectRatio="none" style={{width:"100%",height:h,display:"block"}}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity=".22"/>
        <stop offset="100%" stopColor={color} stopOpacity="0"/>
      </linearGradient></defs>
      {showFill && <path d={fill} fill={`url(#${id})`}/>}
      <polyline points={poly} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="3" fill={color}/>
    </svg>
  );
}

/* ── Bar chart ────────────────────────────────────────────────────── */
function Bars({data=[],h=60,color}) {
  const max=Math.max(...(data||[]).map(d=>d.v||0),1);
  return (
    <div style={{display:"flex",alignItems:"flex-end",gap:4,height:h}}>
      {(data||[]).map((d,i)=>{
        const pct=Math.max(8,Math.round((d.v/max)*100));
        const c=color || sc(d.v||0);
        return (
          <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,height:"100%"}}>
            <div style={{flex:1,width:"100%",display:"flex",alignItems:"flex-end"}}>
              <div style={{width:"100%",height:`${pct}%`,background:c,borderRadius:"3px 3px 0 0",opacity:.85,transition:`height 600ms ${i*40}ms ${SPRING}`}}/>
            </div>
            {d.l && <div style={{fontSize:10.5,color:"var(--wa-muted)",fontWeight:600,letterSpacing:".02em"}}>{d.l}</div>}
          </div>
        );
      })}
    </div>
  );
}

/* ── Heatmap cell ─────────────────────────────────────────────────── */
function HeatCell({v,label,sub}) {
  const color=v==null?"rgba(148,163,184,.08)":v>=80?"rgba(16,185,129,.18)":v>=60?"rgba(245,158,11,.15)":v>=40?"rgba(239,68,68,.12)":"rgba(239,68,68,.22)";
  const tc=v==null?"var(--wa-muted)":v>=80?"#34d399":v>=60?"#fbbf24":v>=40?"#f87171":"#ef4444";
  return (
    <div style={{background:color,borderRadius:10,padding:"11px 12px",textAlign:"center",minHeight:64,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,transition:"transform 200ms",cursor:"default"}}
      onMouseEnter={e=>e.currentTarget.style.transform="scale(1.04)"}
      onMouseLeave={e=>e.currentTarget.style.transform="none"}>
      <div style={{fontFamily:SYNE,fontSize:v!=null?20:12,fontWeight:800,color:tc,lineHeight:1}}>{v!=null?v:"—"}</div>
      <div style={{fontSize:11,fontWeight:700,color:"var(--wa-muted)",textTransform:"uppercase",letterSpacing:".06em"}}>{label}</div>
      {sub && <div style={{fontSize:11,color:tc,fontWeight:600}}>{sub}</div>}
    </div>
  );
}

/* ── Gauge ring ───────────────────────────────────────────────────── */
function Gauge({value,size=90,sw=8,label,sublabel}) {
  const r=(size/2)-sw, circ=2*Math.PI*r, dash=(Math.min(value,100)/100)*circ, c=sc(value);
  return (
    <div style={{position:"relative",width:size,height:size,flexShrink:0}}>
      <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(148,163,184,.1)" strokeWidth={sw}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={c} strokeWidth={sw}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{transition:"stroke-dasharray 700ms cubic-bezier(.4,0,.2,1)"}}/>
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
        <div style={{fontFamily:SYNE,fontSize:size>70?20:15,fontWeight:800,color:c,lineHeight:1}}>{value}</div>
        {label && <div style={{fontSize:10.5,color:"var(--wa-muted)",marginTop:2,fontWeight:600}}>{label}</div>}
      </div>
      {sublabel && <div style={{textAlign:"center",fontSize:10,color:"var(--wa-muted)",marginTop:4,fontWeight:500}}>{sublabel}</div>}
    </div>
  );
}

/* ── Risk progress ────────────────────────────────────────────────── */
// `display` lets a row show a real unit (or "Not measured") instead of forcing
// every quantity into a percentage. `value` is the bar geometry only; null
// means there is nothing to draw and the bar stays empty rather than full.
function RiskRow({label,value,max=100,color,display}) {
  const has=Number.isFinite(value);
  const c=color||(has?sc(value):"#64748b");
  return (
    <div style={{marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
        <span style={{fontSize:12,color:"var(--wa-text2)",fontWeight:500}}>{label}</span>
        <span style={{fontSize:12,fontWeight:700,color:c}}>{display??(has?`${value}%`:"—")}</span>
      </div>
      <div style={{height:5,borderRadius:99,background:"rgba(148,163,184,.1)",overflow:"hidden"}}>
        <div style={{height:"100%",width:`${has?Math.max(0,Math.min(value,100)):0}%`,background:c,borderRadius:99,transition:"width 700ms cubic-bezier(.4,0,.2,1)"}}/>
      </div>
    </div>
  );
}

/* ── Section wrapper ──────────────────────────────────────────────── */
function Sec({title,sub,action,children,accent}) {
  return (
    <div style={{background:"var(--wa-card)",border:`1px solid ${accent||"var(--wa-border)"}`,borderRadius:16,padding:20,position:"relative",overflow:"hidden"}}>
      {accent && <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${accent},transparent)`}}/>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
        <div>
          <div style={{fontFamily:SYNE,fontSize:13,fontWeight:800,color:"var(--wa-text)",letterSpacing:"-.015em"}}>{title}</div>
          {sub && <div style={{fontSize:10,color:"var(--wa-muted)",marginTop:2,fontWeight:500}}>{sub}</div>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

/* ── AI insight block ─────────────────────────────────────────────── */
function AIBlock({loading,data,error,onRetry,accentColor="#1a56db",isAr}) {
  return (
    <div style={{background:`${accentColor}08`,border:`1px solid ${accentColor}18`,borderRadius:14,padding:14,marginTop:16}}>
      <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:10}}>
        <div style={{width:22,height:22,borderRadius:6,background:`linear-gradient(135deg,${accentColor},#0891b2)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10}}>🧠</div>
        <span style={{fontSize:10,fontWeight:700,color:accentColor,letterSpacing:".05em",textTransform:"uppercase"}}>
          {isAr?"تحليل Corvus AI":"Corvus AI Analysis"}
        </span>
        {loading && <span style={{marginLeft:"auto",display:"flex",gap:3}}>
          {[0,1,2].map(i=><span key={i} style={{width:4,height:4,borderRadius:"50%",background:accentColor,display:"inline-block",animation:`waDot 1.2s ${i*.2}s infinite`}}/>)}
        </span>}
      </div>
      {loading && <div style={{display:"flex",flexDirection:"column",gap:7}}>
        {[100,85,70].map((w,i)=><Skeleton key={i} h={11} w={`${w}%`} r={5}/>)}
      </div>}
      {!loading && data && <div style={{fontSize:12.5,color:"var(--wa-text2)",lineHeight:1.75,animation:"wa-fadeIn 300ms both"}}><Md text={data}/></div>}
      {!loading && error && <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
        <span style={{fontSize:12,color:"#f87171"}}>⚠ {error}</span>
        <button onClick={onRetry} style={{background:`${accentColor}18`,border:`1px solid ${accentColor}30`,borderRadius:7,padding:"4px 11px",fontSize:11,fontWeight:700,color:accentColor,cursor:"pointer"}}>
          {isAr?"⟳ أعد":"⟳ Retry"}
        </button>
      </div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   DATA ENGINE
   ═══════════════════════════════════════════════════════════════════ */
function buildAnalytics(sessions=[], allUsers=[], profile={}) {
  const scores = (sessions||[]).map(s=>s.avg_score||0).filter(Boolean);
  const avgScore = avg(scores);

  // time buckets
  const now = Date.now();
  const bucket = (ms) => sessions.filter(s=>(now-(s.created_at?.toDate?.()?.getTime()||0))<ms);
  const week  = bucket(7*86400000);
  const month = bucket(30*86400000);
  const prevMonth = sessions.filter(s=>{const ms=now-(s.created_at?.toDate?.()?.getTime()||0); return ms>=30*86400000&&ms<60*86400000;});

  const weekAvg   = avg(week.map(s=>s.avg_score||0));
  const monthAvg  = avg(month.map(s=>s.avg_score||0));
  const prevAvg   = avg(prevMonth.map(s=>s.avg_score||0));

  // 30-day daily buckets
  const daily30 = Array.from({length:30},(_,i)=>{
    const d=new Date(); d.setDate(d.getDate()-29+i);
    const ds=d.toDateString();
    const ss=sessions.filter(s=>(s.created_at?.toDate?.()??new Date(s.created_at||0)).toDateString()===ds);
    return {label:`${d.getDate()}/${d.getMonth()+1}`, score:ss.length?avg(ss.map(s=>s.avg_score||0)):null, count:ss.length, day:d};
  });

  // Fatigue, measured. Every session stores score_curve — the score sampled
  // across the whole session — so the drop from its first third to its last is
  // an actual observation of posture degrading while the person sat there.
  //
  // What was here: (100 - weekAvg) * 0.55 + (week.length > 6 ? 18 : 0) +
  // (avgScore < 55 ? 22 : 0). The dominant term is the weekly posture average
  // inverted, so "Fatigue Index" was the posture score under another name and
  // could never disagree with it; `week.length > 6` ADDED 18 points for using
  // the product daily; and with no sessions this week avg([]) = 0 floored the
  // whole thing at 55%. This is an HR screen: that number is shown against a
  // named employee.
  const _fatigue = sessionFatigue(sessions);
  const fatigueDecline = _fatigue?.declinePoints ?? null;   // pts, or null

  // "Productivity" was avgScore * 0.65 + regularityScore * 0.35 — a posture
  // score and a session count, rendered to an employer as a productivity
  // percentage next to a person's name. Nothing here observes output, quality,
  // hours or task completion. The two inputs are real, so they are reported as
  // themselves under their own names.
  const sessPerWeekTarget = 4;
  const regularityScore = Math.min(100, Math.round((week.length / sessPerWeekTarget) * 100));

  // Time-of-day averages, computed from the user's own sessions.
  //
  // The "Your best times" tiles used to be the literal array [72,68,81,64],
  // shown as if measured. The data to compute it properly was already here —
  // every session carries created_at — so it is computed, and a slot with too
  // few sessions shows a dash rather than an invented number.
  const _dayPart = (d) => { const h = d.getHours(); return h < 12 ? 0 : h < 15 ? 1 : h < 18 ? 2 : 3; };
  const _pSum = [0,0,0,0], _pCount = [0,0,0,0];
  (sessions||[]).forEach(sess => {
    const v0 = sess.avg_score || 0;
    if (!v0) return;
    const d = sess.created_at?.toDate?.() ?? new Date(sess.created_at || 0);
    if (isNaN(d.getTime())) return;
    const i = _dayPart(d);
    _pSum[i] += v0; _pCount[i] += 1;
  });
  const timeOfDay = _pSum.map((sum, i) => _pCount[i] >= 2 ? Math.round(sum / _pCount[i]) : null);

  // Body-zone risk, derived from the metrics the engine ACTUALLY measures.
  //
  // The heatmap used to compute each zone from the overall average score times
  // an invented coefficient — (100-avgScore)*0.7+10 for neck, *0.4+12 for
  // "Eyes", and so on — and present the result to HR as measured risk. Two
  // things were wrong with that: the numbers were not measurements of anything,
  // and one of the zones (Eyes) is not something this product can observe at
  // all. A buyer asking "how do you measure eye strain?" had no good answer.
  //
  // Every session stores the engine's per-metric scores, so each zone is now
  // the mean of the metrics that genuinely bear on it, and a zone with no data
  // reports null and is not drawn.
  const ZONE_METRICS = {
    neck:     ["neck_lean", "fhp_index", "monitor_height"],
    shoulder: ["shoulder_level", "rounded_shoulders", "shoulder_elevation"],
    spine:    ["spine_lean", "trunk_rotation"],
    lower:    ["torso_flexion", "spine_lean"],
    arms:     ["elbow_angle"],
  };
  const zoneRisk = {};
  for (const [zone, keys] of Object.entries(ZONE_METRICS)) {
    let sum = 0, n = 0;
    (sessions || []).forEach(sess => {
      const m = sess.metrics || {};
      keys.forEach(k => {
        // Skip what was never measured. The `spine` and `lower` zones here are
        // built entirely from spine_lean, trunk_rotation and torso_flexion —
        // all three derived from the hips, all three unmeasurable at laptop
        // framing, all three stored with their module's default score. So an
        // HR dashboard was reporting company-wide lumbar and spinal risk from
        // numbers no camera in the company had ever produced.
        if (m[k]?.reliable === false) return;
        const sc0 = m[k]?.score;
        if (Number.isFinite(sc0)) { sum += sc0; n += 1; }
      });
    });
    zoneRisk[zone] = n >= 3 ? Math.max(0, Math.min(100, Math.round(100 - sum / n))) : null;
  }

  // Focus trend: % sessions >= 70
  const focusSessions = month.filter(s=>(s.avg_score||0)>=70).length;
  const focusTrend = month.length ? Math.round((focusSessions/month.length)*100) : 0;

  // Engagement: streak-based
  const streak = profile?.streak_days || 0;
  const engagementScore = Math.min(100, Math.round(
    (streak >= 7 ? 40 : streak * 5) +
    (week.length >= 4 ? 30 : week.length * 7) +
    Math.min(30, Math.round((sessions.length / 30) * 30))
  ));

  // Burnout is removed, not recalculated. It was 0.45 x (100 - weekAvg) plus a
  // share of a fatigue index that was itself 0.55 x (100 - weekAvg) — the same
  // posture score a third time, presented to an employer as an occupational
  // syndrome with "intervention recommended" attached. A webcam cannot observe
  // hours, workload, sleep or mood, and an employer acting on a fabricated
  // burnout figure about a named employee is the worst outcome this codebase
  // could produce.

  // Weekly heatmap (7×4 grid — last 4 weeks × 7 days)
  const heatmap = Array.from({length:4},(_,week)=>
    Array.from({length:7},(_,day)=>{
      const d=new Date(); d.setDate(d.getDate()-(27-(week*7+day)));
      const ds=d.toDateString();
      const ss=sessions.filter(s=>(s.created_at?.toDate?.()??new Date(s.created_at||0)).toDateString()===ds);
      return {date:d, score:ss.length?avg(ss.map(s=>s.avg_score||0)):null, count:ss.length};
    })
  );

  // Dept simulation from allUsers
  const depts = allUsers.length > 0
    ? Object.entries(
        allUsers.reduce((acc,u)=>{
          const dept = u.department || u.team || "General";
          if(!acc[dept]) acc[dept]={scores:[],count:0};
          acc[dept].scores.push(u.avg_score||0);
          acc[dept].count++;
          return acc;
        },{})
      ).map(([name,{scores,count}])=>({name,avg:avg(scores),count,risk:Math.round((100-avg(scores))*0.6)}))
    : []; // no fabricated fallback — an empty team should show an empty state, not fake numbers

  // Monthly trend (6 months)
  const monthly6 = Array.from({length:6},(_,i)=>{
    const d=new Date(); d.setMonth(d.getMonth()-5+i);
    const m=d.getMonth(), y=d.getFullYear();
    const ss=sessions.filter(s=>{const dt=s.created_at?.toDate?.()??new Date(s.created_at||0); return dt.getMonth()===m&&dt.getFullYear()===y;});
    return {
      label:d.toLocaleString("en-US",{month:"short"}),
      score:ss.length?avg(ss.map(s=>s.avg_score||0)):0,
      count:ss.length,
    };
  });

  return {avgScore,weekAvg,monthAvg,prevAvg,scores,daily30,monthly6,timeOfDay,zoneRisk,
    fatigueDecline,fatigueFrom:_fatigue?.from??0,regularityScore,focusTrend,engagementScore,
    heatmap,depts,streak,week,month,prevMonth};
}

/* ═══════════════════════════════════════════════════════════════════
   SECTION COMPONENTS
   ═══════════════════════════════════════════════════════════════════ */

/* ── Company Wellness Score ─────────────────────────────────────── */
function CompanyScore({data,isAr,loading}) {
  const kpis = [
    {icon:"🎯",label:isAr?"متوسط الصحة":"Wellness Avg",  value:`${data.avgScore}/100`,  color:sc(data.avgScore),  accent:data.avgScore, delay:0},
    {icon:"⚡",label:isAr?"انتظام الجلسات":"Session regularity", value:`${data.regularityScore}%`, color:sc(data.regularityScore), accent:data.regularityScore, delay:70},
    {icon:"🎯",label:isAr?"التركيز":"Focus Rate",        value:`${data.focusTrend}%`,   color:sc(data.focusTrend),  accent:data.focusTrend, delay:140},
    {icon:"💪",label:isAr?"التفاعل":"Engagement",        value:`${data.engagementScore}%`, color:sc(data.engagementScore), accent:data.engagementScore, delay:210},
  ];
  return (
    <div style={{background:"var(--wa-card)",border:"1px solid var(--wa-border)",borderRadius:20,padding:22,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:"linear-gradient(90deg,#1a56db,#0891b2,#10b981)"}}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:16}}>
        <div>
          <div style={{fontFamily:SYNE,fontSize:15,fontWeight:800,color:"var(--wa-text)",letterSpacing:"-.02em",marginBottom:3}}>
            {isAr?"نقاط صحة القوى العاملة":"Company Wellness Score"}
          </div>
          <div style={{fontSize:11,color:"var(--wa-muted)",fontWeight:500}}>
            {isAr?"ملخص تنفيذي — مدعوم بـ Corvus AI":"Executive snapshot — powered by Corvus AI"}
          </div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <Gauge value={loading?0:data.avgScore} size={84} sw={7} label="/100" sublabel={isAr?"الصحة":"Wellness"}/>
          <Gauge value={loading?0:data.regularityScore} size={84} sw={7} label="/100" sublabel={isAr?"الانتظام":"Regularity"}/>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10,marginBottom:16}}>
        {loading ? [1,2,3,4].map(i=><CardSkeleton key={i} h={52}/>) : kpis.map((k,i)=>(
          <div key={i} style={{background:grad(k.accent,.08),border:`1px solid ${grad(k.accent,.25).replace("rgba","rgba").replace(",0.08",",.22")}`,borderRadius:12,padding:"12px 14px",animation:`wa-fadeIn 400ms ${k.delay}ms both`}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}>
              <span style={{fontSize:11,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase",color:"var(--wa-muted)"}}>{k.label}</span>
              <span style={{fontSize:14}}>{k.icon}</span>
            </div>
            <div style={{fontFamily:SYNE,fontSize:22,fontWeight:800,color:k.color,lineHeight:1,letterSpacing:"-.03em"}}>{k.value}</div>
          </div>
        ))}
      </div>
      {/* Monthly 6-month bar */}
      {!loading && data.monthly6?.some(m=>m.score>0) && (
        <div>
          <div style={{fontSize:11,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:"var(--wa-muted)",marginBottom:8}}>
            {isAr?"آخر 6 أشهر":"6-Month Trend"}
          </div>
          <Bars data={(data.monthly6||[]).map(m=>({v:m.score,l:m.label}))} h={48}/>
        </div>
      )}
    </div>
  );
}

/* ── Productivity Trends ────────────────────────────────────────── */
function ProductivityTrends({data,isAr,loading,onAI,aiData,aiLoading,aiError}) {
  const lines = [
    {label:isAr?"نقاط الصحة":"Wellness score", data:(data.daily30||[]).map(d=>d.score||0), color:"#1a56db"},
    {label:isAr?"جلسات/يوم":"Sessions/day",   data:(data.daily30||[]).map(d=>d.count*25),  color:"#10b981"},
  ];
  const weekDays = isAr?["أح","إث","ثل","أر","خم","جم","سب"]:["Su","Mo","Tu","We","Th","Fr","Sa"];
  return (
    <Sec title={isAr?"اتجاهات الإنتاجية":"Productivity Trends"} sub={isAr?"30 يوم | نقاط الصحة والجلسات":"30 days | Wellness score & session frequency"} accent="#1a56db">
      {loading ? <CardSkeleton h={100}/> : (
        <>
          <div style={{marginBottom:14}}>
            {lines.map((l,i)=>(
              <div key={i} style={{marginBottom:i<lines.length-1?16:0}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                  <span style={{fontSize:11,color:"var(--wa-text2)",fontWeight:500}}>{l.label}</span>
                  <span style={{fontSize:11,fontWeight:700,color:l.color}}>{l.data.filter(Boolean).length>0 ? Math.max(...l.data.filter(Boolean)) : "—"}</span>
                </div>
                <Spark data={l.data.filter(Boolean)} color={l.color} h={38}/>
              </div>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
            {[
              {l:isAr?"هذا الأسبوع":"This week",  v:data.weekAvg,  c:sc(data.weekAvg)},
              {l:isAr?"هذا الشهر":"This month",   v:data.monthAvg, c:sc(data.monthAvg)},
              {l:isAr?"التغيير":"Change",          v:`${pct(data.weekAvg,data.prevAvg)>0?"+":""}${pct(data.weekAvg,data.prevAvg)}%`, c:pct(data.weekAvg,data.prevAvg)>=0?"#10b981":"#ef4444"},
            ].map((m,i)=>(
              <div key={i} style={{background:"var(--wa-surf)",border:"1px solid var(--wa-border)",borderRadius:10,padding:"10px 12px",textAlign:"center"}}>
                <div style={{fontSize:11,color:"var(--wa-muted)",fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:5}}>{m.l}</div>
                <div style={{fontFamily:SYNE,fontSize:20,fontWeight:800,color:m.c}}>{m.v||"—"}</div>
              </div>
            ))}
          </div>
        </>
      )}
      <button onClick={onAI} style={{width:"100%",marginTop:12,background:"rgba(26,86,219,.08)",border:"1px solid rgba(26,86,219,.18)",borderRadius:9,padding:"9px 0",fontSize:11,fontWeight:700,color:"#60a5fa",cursor:"pointer"}}>
        🧠 {isAr?"توليد تحليل AI":"Generate AI Analysis"}
      </button>
      {(aiData||aiLoading||aiError) && <AIBlock loading={aiLoading} data={aiData} error={aiError} onRetry={onAI} isAr={isAr}/>}
    </Sec>
  );
}

/* ── Focus Trends ───────────────────────────────────────────────── */
function FocusTrends({data,isAr,loading}) {
  const focusData = (data.daily30||[]).map(d=>{
    if(!d.score) return {v:0,l:d.label};
    return {v:d.score>=70?100:d.score>=50?60:20, l:d.label};
  });
  const levels = [
    {label:isAr?"تركيز عالٍ (≥70)":"High focus (≥70)",   pct:data.focusTrend,      color:"#10b981"},
    {label:isAr?"تركيز متوسط (50-70)":"Mid focus (50-70)",pct:Math.max(0,100-data.focusTrend-Math.round((100-data.focusTrend)/2)), color:"#f59e0b"},
    {label:isAr?"تركيز منخفض (<50)":"Low focus (<50)",    pct:Math.round((100-data.focusTrend)/2), color:"#ef4444"},
  ];
  return (
    <Sec title={isAr?"اتجاهات التركيز":"Focus Trends"} sub={isAr?"توزيع جودة التركيز":"Focus quality distribution"} accent="#0891b2">
      {loading ? <CardSkeleton h={80}/> : (
        <>
          <div style={{marginBottom:14}}>
            <Bars data={focusData.slice(-14)} h={52} color="#0891b2"/>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:0}}>
            {levels.map((l,i)=>(
              <div key={i} style={{padding:"8px 0",borderBottom:i<levels.length-1?"1px solid var(--wa-border)":"none"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:11,color:"var(--wa-text2)",fontWeight:500}}>{l.label}</span>
                  <span style={{fontSize:11,fontWeight:700,color:l.color}}>{l.pct}%</span>
                </div>
                <div style={{height:4,borderRadius:99,background:"rgba(148,163,184,.1)",overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${l.pct}%`,background:l.color,borderRadius:99,transition:"width 700ms cubic-bezier(.4,0,.2,1)"}}/>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Sec>
  );
}

/* ── Fatigue Patterns ───────────────────────────────────────────── */
function FatiguePatterns({data,isAr,loading,onAI,aiData,aiLoading,aiError}) {
  const weekDays = isAr?["أح","إث","ثل","أر","خم","جم","سب"]:["Su","Mo","Tu","We","Th","Fr","Sa"];
  const hourBuckets = [isAr?"صباح":"AM",isAr?"ظهر":"Noon",isAr?"بعد الظهر":"PM",isAr?"مساء":"Eve"];
  const fd = data.fatigueDecline;
  const burnColor = fd==null?"#64748b":fd>=15?"#ef4444":fd>=5?"#f59e0b":"#10b981";
  return (
    <Sec title={isAr?"أنماط الإجهاد":"Fatigue Patterns"} sub={isAr?"تراجع الوضعية خلال الجلسة":"How posture holds up across a session"} accent="#ef4444">
      {loading ? <CardSkeleton h={100}/> : (
        <>
          <div style={{display:"flex",gap:16,alignItems:"flex-start",marginBottom:16,flexWrap:"wrap"}}>
            <div style={{flex:1,minWidth:120}}>
              {/* Gauge arc is scaled for legibility; the figure beneath it is
                  the measured points of decline, not a percentage of anything. */}
              <Gauge value={fd==null?0:Math.max(0,Math.min(100,fd*4))} size={80} sw={7} label={fd==null?(isAr?"—":"—"):`${fd}`} sublabel={isAr?"نقطة/جلسة":"pts/session"}/>
            </div>
            <div style={{flex:2,minWidth:160}}>
              {/* "Fatigue Index", "Burnout Risk" and a "Strain Index" that was
                  their mean were all the weekly posture average rescaled. The one
                  measured quantity is the within-session decline. */}
              <RiskRow label={isAr?"تراجع داخل الجلسة":"Within-session decline"} value={fd==null?null:Math.max(0,Math.min(100,fd*4))}
                       display={fd==null?(isAr?"مش متقاس":"Not measured"):`${fd}${isAr?" نقطة":" pts"}`}/>
              <RiskRow label={isAr?"جلسات اتقاست":"Sessions measured"} value={null} display={`${data.fatigueFrom}`}/>
            </div>
          </div>
          {/* Weekly fatigue heatmap */}
          <div style={{marginBottom:10}}>
            <div style={{fontSize:11,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:"var(--wa-muted)",marginBottom:8}}>
              {isAr?"خريطة حرارة الإرهاق الأسبوعية":"Weekly Fatigue Heatmap"}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
              {weekDays.map(d=><div key={d} style={{textAlign:"center",fontSize:10.5,color:"var(--wa-muted)",paddingBottom:3,fontWeight:600}}>{d}</div>)}
              {data.heatmap.flat().map((cell,i)=>(
                <div key={i} style={{
                  height:18,borderRadius:4,
                  background:cell.score==null?"rgba(148,163,184,.06)":
                    cell.score>=80?"rgba(16,185,129,.25)":
                    cell.score>=60?"rgba(245,158,11,.2)":
                    cell.score>=40?"rgba(239,68,68,.18)":"rgba(239,68,68,.35)",
                  title:cell.score!=null?`${fmtDate(cell.date)}: ${cell.score}`:fmtDate(cell.date),
                }}/>
              ))}
            </div>
            <div style={{display:"flex",gap:8,marginTop:6,alignItems:"center"}}>
              {[["#10b981","≥80"],["#f59e0b","60-79"],["#ef4444","<60"],["rgba(148,163,184,.1)",isAr?"لا بيانات":"No data"]].map(([c,l])=>(
                <div key={l} style={{display:"flex",alignItems:"center",gap:4}}>
                  <div style={{width:10,height:10,borderRadius:2,background:c}}/>
                  <span style={{fontSize:11,color:"var(--wa-muted)"}}>{l}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{background:`${burnColor}10`,border:`1px solid ${burnColor}28`,borderRadius:10,padding:"10px 12px"}}>
            <div style={{fontSize:11,fontWeight:700,color:burnColor,marginBottom:4}}>
              {fd==null?(isAr?"مش متقاس":"Not measured"):
               fd>=15?(isAr?"⚠️ الوضعية بتتراجع بوضوح خلال الجلسة":"⚠️ Posture degrades markedly over a session"):
               fd>=5?(isAr?"⚡ تراجع بسيط خلال الجلسة":"⚡ Mild drift within sessions"):
               (isAr?"✅ الوضعية ثابتة طول الجلسة":"✅ Posture holds through a session")}
            </div>
            <div style={{fontSize:11,color:"var(--wa-text2)",lineHeight:1.6}}>
              {fd==null
                ?(isAr?"محتاج جلسات طويلة كفاية عشان نقارن أولها بآخرها. ملحوظة: التطبيق بيقيس الوضعية بس — مش ساعات الشغل ولا الحِمل، فمينفعش يقيّم الإنهاك المهني.":"Needs sessions long enough to compare their start and end. Note: this measures posture only — not hours worked or workload — so it cannot assess occupational burnout.")
                :fd>=15
                ?(isAr?"الوضعية بتسوء بمقدار "+fd+" نقطة من أول الجلسة لآخرها. ده بيرجّح إن الاستراحات قليلة أو إعداد المكتب محتاج تعديل.":`Posture drops ${fd} points between the start and end of a session, which points to break frequency or workstation setup.`)
                :(isAr?"الوضعية ثابتة خلال الجلسة.":"Posture is holding steady across sessions.")}
            </div>
          </div>
        </>
      )}
      <button onClick={onAI} style={{width:"100%",marginTop:12,background:"rgba(239,68,68,.07)",border:"1px solid rgba(239,68,68,.16)",borderRadius:9,padding:"9px 0",fontSize:11,fontWeight:700,color:"#f87171",cursor:"pointer"}}>
        🧠 {isAr?"تحليل نمط الإرهاق":"Analyze Fatigue Pattern"}
      </button>
      {(aiData||aiLoading||aiError) && <AIBlock loading={aiLoading} data={aiData} error={aiError} onRetry={onAI} isAr={isAr} accentColor="#ef4444"/>}
    </Sec>
  );
}

/* ── Engagement Analytics ───────────────────────────────────────── */
function EngagementAnalytics({data,profile,isAr,loading}) {
  const streakDays = [1,2,3,4,5,6,7];
  const currentStreak = data.streak||0;
  return (
    <Sec title={isAr?"تحليلات التفاعل":"Engagement Analytics"} sub={isAr?"السلاسل والاتساق والحوافز":"Streaks, consistency & motivation"} accent="#f59e0b">
      {loading ? <CardSkeleton h={80}/> : (
        <>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
            <div style={{background:"rgba(245,158,11,.08)",border:"1px solid rgba(245,158,11,.2)",borderRadius:12,padding:"14px",textAlign:"center"}}>
              <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",color:"var(--wa-muted)",marginBottom:6}}>{isAr?"السلسلة الحالية":"Current Streak"}</div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
                <span style={{fontSize:22}}>🔥</span>
                <div style={{fontFamily:SYNE,fontSize:28,fontWeight:800,color:"#f59e0b",lineHeight:1}}>{currentStreak}</div>
              </div>
              <div style={{fontSize:10,color:"#f59e0b",marginTop:4,fontWeight:600}}>{isAr?"أيام":"days"}</div>
            </div>
            <div style={{background:"rgba(16,185,129,.08)",border:"1px solid rgba(16,185,129,.2)",borderRadius:12,padding:"14px",textAlign:"center"}}>
              <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",color:"var(--wa-muted)",marginBottom:6}}>{isAr?"التفاعل الإجمالي":"Overall Engagement"}</div>
              <div style={{fontFamily:SYNE,fontSize:28,fontWeight:800,color:sc(data.engagementScore),lineHeight:1}}>{data.engagementScore}%</div>
              <div style={{fontSize:10,color:sc(data.engagementScore),marginTop:4,fontWeight:600}}>
                {data.engagementScore>=80?(isAr?"ممتاز":"Excellent"):data.engagementScore>=60?(isAr?"جيد":"Good"):(isAr?"يحتاج تحسين":"Needs improvement")}
              </div>
            </div>
          </div>
          {/* Streak dots */}
          <div style={{marginBottom:14}}>
            <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",color:"var(--wa-muted)",marginBottom:8}}>{isAr?"خريطة الأسبوع":"This week"}</div>
            <div style={{display:"flex",gap:6}}>
              {Array.from({length:7},(_,i)=>{
                const active=i<(data.week.length||0);
                return (
                  <div key={i} style={{flex:1,height:28,borderRadius:7,background:active?"rgba(245,158,11,.2)":"rgba(148,163,184,.07)",border:`1px solid ${active?"rgba(245,158,11,.3)":"rgba(148,163,184,.1)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>
                    {active?"🔥":""}
                  </div>
                );
              })}
            </div>
          </div>
          {/* Sessions by time of day — computed from real sessions (was a
              hardcoded array presented as measured data). */}
          <div>
            <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",color:"var(--wa-muted)",marginBottom:8}}>{isAr?"أفضل أوقاتك":"Your best times"}</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
              {(isAr?["صباح","ظهر","بعد الظهر","مساء"]:["Morning","Noon","Afternoon","Evening"]).map((t,i)=>{
                const v = data?.timeOfDay?.[i] ?? null;
                const col = v === null ? "var(--wa-muted)" : sc(v);
                return (
                  <div key={i} style={{background:v===null?"transparent":`${col}10`,border:`1px solid ${v===null?"rgba(148,163,184,.18)":col+"22"}`,borderRadius:9,padding:"9px 8px",textAlign:"center"}}>
                    <div style={{fontSize:10.5,color:"var(--wa-muted)",fontWeight:600,marginBottom:4}}>{t}</div>
                    <div style={{fontFamily:SYNE,fontSize:16,fontWeight:800,color:col}}>{v===null?"—":v}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </Sec>
  );
}

/* ── Posture Risk Heatmap ───────────────────────────────────────── */
function PostureRiskHeatmap({data,isAr,loading}) {
  // Zones are drawn only where the engine has data. "Eyes" is gone: nothing in
  // this product measures eye strain, so there was never a number to show.
  const zr = data?.zoneRisk || {};
  const zones = [
    {id:"neck",    label:isAr?"الرقبة":"Neck",            risk:zr.neck,     icon:"🔴"},
    {id:"shoulder",label:isAr?"الكتف":"Shoulders",        risk:zr.shoulder, icon:"🟡"},
    {id:"spine",   label:isAr?"العمود الفقري":"Spine",     risk:zr.spine,    icon:"🟠"},
    {id:"lower",   label:isAr?"أسفل الظهر":"Lower Back",   risk:zr.lower,    icon:"🔴"},
    {id:"arms",    label:isAr?"الذراع والكوع":"Arms & elbows", risk:zr.arms, icon:"🟢"},
  ].filter(z => Number.isFinite(z.risk));
  return (
    <Sec title={isAr?"خريطة حرارة المخاطر الوضعية":"Posture Risk Heatmap"} sub={isAr?"توزيع المخاطر على مناطق الجسم":"Risk distribution across body zones"} accent="#7c3aed">
      {loading ? <CardSkeleton h={120}/> : zones.length === 0 ? (
        <div style={{padding:"18px 14px",textAlign:"center",fontSize:12,color:"var(--wa-muted)",lineHeight:1.6}}>
          {isAr
            ? "لسه مفيش جلسات كفاية لحساب مخاطر مناطق الجسم."
            : "Not enough sessions yet to calculate body-zone risk."}
        </div>
      ) : (
        <>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14}}>
            {zones.map((z,i)=>(
              <div key={i} style={{background:grad(100-z.risk,.1),border:`1px solid ${grad(100-z.risk,.2).replace("rgba","rgba")}`,borderRadius:11,padding:"11px 10px",textAlign:"center",animation:`wa-fadeIn 300ms ${i*60}ms both`}}>
                <div style={{fontSize:16,marginBottom:5}}>{z.icon}</div>
                <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",color:"var(--wa-muted)",marginBottom:5}}>{z.label}</div>
                <div style={{fontFamily:SYNE,fontSize:18,fontWeight:800,color:sc(100-z.risk),lineHeight:1}}>{z.risk}%</div>
                <div style={{fontSize:11,color:sc(100-z.risk),marginTop:3,fontWeight:600}}>{isAr?"مخاطرة":"risk"}</div>
              </div>
            ))}
          </div>
          {/* Overall risk bar */}
          <div style={{background:"var(--wa-surf)",border:"1px solid var(--wa-border)",borderRadius:12,padding:"12px 14px"}}>
            <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",color:"var(--wa-muted)",marginBottom:10}}>
              {isAr?"المخاطر الإجمالية":"Overall Risk Profile"}
            </div>
            {zones.map((z,i)=>(
              <div key={i} style={{marginBottom:i<zones.length-1?9:0}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                  <span style={{fontSize:11,color:"var(--wa-text2)"}}>{z.label}</span>
                  <span style={{fontSize:11,fontWeight:700,color:sc(100-z.risk)}}>{z.risk}%</span>
                </div>
                <div style={{height:4,borderRadius:99,background:"rgba(148,163,184,.08)",overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${z.risk}%`,background:sc(100-z.risk),borderRadius:99,transition:`width 700ms ${i*60}ms cubic-bezier(.4,0,.2,1)`}}/>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Sec>
  );
}

/* ── Department Comparison ──────────────────────────────────────── */
function DeptComparison({data,isAr,loading,onAI,aiData,aiLoading,aiError}) {
  const sorted=[...data.depts].sort((a,b)=>b.avg-a.avg);
  return (
    <Sec title={isAr?"مقارنة الأقسام":"Department Comparison"} sub={isAr?"صحة وخطر كل قسم":"Health & risk per department"} accent="#0891b2">
      {loading ? [1,2,3].map(i=><CardSkeleton key={i} h={40}/>) : sorted.length===0 ? (
        <div style={{padding:"20px 0",textAlign:"center",fontSize:12,color:"var(--wa-text2)"}}>
          {isAr?"لا يوجد أعضاء فريق محمّلين بعد — ستظهر مقارنة الأقسام هنا بمجرد توفر البيانات":"No team members loaded yet — department comparison will appear once data is available"}
        </div>
      ) : (
        <>
          <div style={{marginBottom:12}}>
            {sorted.map((d,i)=>(
              <div key={d.name} style={{display:"flex",alignItems:"center",gap:12,padding:"9px 0",borderBottom:i<sorted.length-1?"1px solid var(--wa-border)":"none",animation:`wa-fadeIn 300ms ${i*70}ms both`}}>
                <div style={{width:28,height:28,borderRadius:8,background:`${sc(d.avg)}14`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:sc(d.avg),flexShrink:0}}>
                  {i+1}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontSize:12,fontWeight:600,color:"var(--wa-text)"}}>{d.name}</span>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <span style={{fontSize:11,fontWeight:700,color:sc(d.avg),fontFamily:SYNE}}>{d.avg}/100</span>
                      <span style={{fontSize:11,color:d.risk>=50?"#f87171":d.risk>=30?"#fbbf24":"#34d399",fontWeight:700}}>
                        {isAr?"خطر:":"risk:"} {d.risk}%
                      </span>
                    </div>
                  </div>
                  <div style={{height:4,borderRadius:99,background:"rgba(148,163,184,.08)",overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${d.avg}%`,background:sc(d.avg),borderRadius:99,transition:`width 700ms ${i*80}ms cubic-bezier(.4,0,.2,1)`}}/>
                  </div>
                </div>
                <div style={{fontSize:10,color:"var(--wa-muted)",flexShrink:0}}>{d.count} {isAr?"عضو":"members"}</div>
              </div>
            ))}
          </div>
          {/* Best/worst highlight */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <div style={{background:"rgba(16,185,129,.08)",border:"1px solid rgba(16,185,129,.2)",borderRadius:11,padding:"11px 13px"}}>
              <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",color:"var(--wa-muted)",marginBottom:4}}>{isAr?"الأفضل أداءً":"Top Performer"}</div>
              <div style={{fontFamily:SYNE,fontSize:14,fontWeight:800,color:"#10b981",marginBottom:2}}>{sorted[0]?.name}</div>
              <div style={{fontSize:12,fontWeight:700,color:"#10b981"}}>{sorted[0]?.avg}/100</div>
            </div>
            <div style={{background:"rgba(239,68,68,.07)",border:"1px solid rgba(239,68,68,.18)",borderRadius:11,padding:"11px 13px"}}>
              <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",color:"var(--wa-muted)",marginBottom:4}}>{isAr?"يحتاج دعم":"Needs Support"}</div>
              <div style={{fontFamily:SYNE,fontSize:14,fontWeight:800,color:"#ef4444",marginBottom:2}}>{sorted[sorted.length-1]?.name}</div>
              <div style={{fontSize:12,fontWeight:700,color:"#ef4444"}}>{sorted[sorted.length-1]?.avg}/100</div>
            </div>
          </div>
        </>
      )}
      <button onClick={onAI} style={{width:"100%",marginTop:12,background:"rgba(8,145,178,.07)",border:"1px solid rgba(8,145,178,.18)",borderRadius:9,padding:"9px 0",fontSize:11,fontWeight:700,color:"#22d3ee",cursor:"pointer"}}>
        🧠 {isAr?"تحليل مقارنة الأقسام":"Analyze Dept Comparison"}
      </button>
      {(aiData||aiLoading||aiError) && <AIBlock loading={aiLoading} data={aiData} error={aiError} onRetry={onAI} isAr={isAr} accentColor="#0891b2"/>}
    </Sec>
  );
}

/* ── Posture-stability alerts ───────────────────────────────────── */
// Was "Burnout Alerts", banding a fabricated burnout score into "Critical
// fatigue — immediate intervention" against a named employee on an employer's
// screen. The bands now describe the one thing that is measured: whether
// posture holds up across a session.
function BurnoutAlerts({data,isAr,loading}) {
  const fd = data.fatigueDecline;
  const alerts = [
    {level:"high",   color:"#ef4444", icon:"🔴", label:isAr?"تراجع كبير":"Marked decline",  score:fd==null?null:Math.min(100,fd*4), active:fd!=null&&fd>=15, desc:isAr?"الوضعية بتسوء بوضوح خلال الجلسة":"Posture degrades markedly within a session"},
    {level:"medium", color:"#f59e0b", icon:"🟡", label:isAr?"تراجع بسيط":"Mild drift",      score:fd==null?null:Math.min(100,fd*4), active:fd!=null&&fd>=5&&fd<15, desc:isAr?"تراجع محدود — تابع":"Some drift — worth watching"},
    {level:"low",    color:"#10b981", icon:"🟢", label:isAr?"ثابتة":"Steady",               score:fd==null?null:Math.max(0,100-fd*4), active:fd!=null&&fd<5, desc:isAr?"الوضعية ثابتة طول الجلسة":"Posture holds through a session"},
  ];
  return (
    <Sec title={isAr?"ثبات الوضعية":"Posture Stability"} sub={isAr?"التراجع داخل الجلسة — مش تقييم إنهاك مهني":"Within-session decline — not an occupational burnout assessment"} accent="#ef4444">
      {loading ? <CardSkeleton h={100}/> : (
        <>
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
            {alerts.map((a,i)=>(
              <div key={a.level} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:a.active?`${a.color}0e`:"var(--wa-surf)",border:`1px solid ${a.active?`${a.color}30`:"var(--wa-border)"}`,borderRadius:12,animation:`wa-fadeIn 300ms ${i*80}ms both`,position:"relative",overflow:"hidden"}}>
                {a.active && <div style={{position:"absolute",left:0,top:0,bottom:0,width:3,background:a.color,borderRadius:"0 2px 2px 0"}}/>}
                <div style={{width:32,height:32,borderRadius:9,background:`${a.color}14`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0}}>{a.icon}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:700,color:a.active?a.color:"var(--wa-text2)",marginBottom:2}}>{a.label}</div>
                  <div style={{fontSize:10,color:"var(--wa-muted)",lineHeight:1.5}}>{a.desc}</div>
                </div>
                <div style={{fontFamily:SYNE,fontSize:20,fontWeight:800,color:a.active?a.color:"var(--wa-muted)",flexShrink:0}}>{a.score}%</div>
              </div>
            ))}
          </div>
          {/* Trend mini */}
          <div style={{background:"var(--wa-surf)",border:"1px solid var(--wa-border)",borderRadius:11,padding:"12px 14px"}}>
            <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",color:"var(--wa-muted)",marginBottom:8}}>
              {isAr?"اتجاه ثبات الوضعية — آخر 14 يوم":"Posture stability trend — last 14 days"}
            </div>
            <Spark data={data.daily30.slice(16).map(d=>d.score?Math.min(100,100-d.score):0)} color="#ef4444" h={40}/>
          </div>
        </>
      )}
    </Sec>
  );
}

/* ── Monthly Insights ───────────────────────────────────────────── */
function MonthlyInsights({data,profile,isAr,loading,onAI,aiData,aiLoading,aiError}) {
  const improvePct = pct(data.monthAvg,data.prevAvg);
  return (
    <Sec title={isAr?"رؤى الشهر":"Monthly Insights"} sub={isAr?"ملخص الأداء الشهري — AI":"Monthly performance digest — AI"} accent="#10b981">
      {loading ? <CardSkeleton h={120}/> : (
        <>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14}}>
            {[
              {l:isAr?"هذا الشهر":"This month",  v:`${data.monthAvg}/100`, c:sc(data.monthAvg)},
              {l:isAr?"الشهر الماضي":"Last month", v:`${data.prevAvg||"—"}/100`, c:sc(data.prevAvg)},
              {l:isAr?"التغيير":"Change",          v:`${improvePct>0?"+":""}${improvePct}%`, c:improvePct>=0?"#10b981":"#ef4444"},
            ].map((m,i)=>(
              <div key={i} style={{background:"var(--wa-surf)",border:"1px solid var(--wa-border)",borderRadius:11,padding:"11px 13px",textAlign:"center"}}>
                <div style={{fontSize:11,color:"var(--wa-muted)",fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:5}}>{m.l}</div>
                <div style={{fontFamily:SYNE,fontSize:20,fontWeight:800,color:m.c}}>{m.v||"—"}</div>
              </div>
            ))}
          </div>
          {/* 6-month spark */}
          <div style={{marginBottom:14}}>
            <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",color:"var(--wa-muted)",marginBottom:8}}>
              {isAr?"اتجاه 6 أشهر":"6-Month Trend"}
            </div>
            <Spark data={(data.monthly6||[]).map(m=>m.score)} color="#10b981" h={48}/>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
              {(data.monthly6||[]).map(m=>(
                <div key={m.label} style={{fontSize:10.5,color:"var(--wa-muted)",fontWeight:600}}>{m.label}</div>
              ))}
            </div>
          </div>
          {/* Session count bars */}
          <div>
            <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",color:"var(--wa-muted)",marginBottom:8}}>
              {isAr?"جلسات/شهر":"Sessions / month"}
            </div>
            <Bars data={(data.monthly6||[]).map(m=>({v:m.count,l:m.label}))} h={42} color="#1a56db"/>
          </div>
        </>
      )}
      <button onClick={onAI} style={{width:"100%",marginTop:12,background:"rgba(16,185,129,.08)",border:"1px solid rgba(16,185,129,.18)",borderRadius:9,padding:"9px 0",fontSize:11,fontWeight:700,color:"#34d399",cursor:"pointer"}}>
        🧠 {isAr?"توليد رؤى الشهر":"Generate Monthly Insights"}
      </button>
      {(aiData||aiLoading||aiError) && <AIBlock loading={aiLoading} data={aiData} error={aiError} onRetry={onAI} isAr={isAr} accentColor="#10b981"/>}
    </Sec>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN EXPORT
   ═══════════════════════════════════════════════════════════════════ */
export function WorkforceAnalytics({ uid, profile, sessions:initialSessions=[], allUsers=[], cs, lang="en", onClose }) {
  useBodyScrollLock();
  const isAr = lang === "ar";
  const [tab, setTab] = useState("workforce");
  const [loading, setLoading] = useState(!initialSessions.length);
  const [sessions, setSessions] = useState(initialSessions);
  const [aiData, setAiData] = useState({});
  const [aiLoading, setAiLoading] = useState({});
  const [aiError, setAiError] = useState({});

  const data = buildAnalytics(sessions, allUsers, profile);

  const system = `You are Corvus's Workforce Intelligence engine. Generate professional, concise workforce health analytics reports.
Respond in ${isAr?"Arabic":"English"}. Use markdown (** bold, ## sections, - bullets). Max 220 words. Be data-driven, executive-ready.`;

  const AI_PROMPTS = {
    productivity: () =>
      `Analyse posture trends: avg score ${data.avgScore}/100, this week ${data.weekAvg??"no sessions"}, last week ${data.prevAvg??"no sessions"}, monthly ${data.monthAvg}/100, session regularity ${data.regularityScore}% (of a 4-sessions-per-week target), focus rate ${data.focusTrend}%.
This product measures posture and session frequency. It does NOT measure productivity, output, or work quality — do not describe any figure here as a productivity measurement, and do not infer one.
## What the posture data shows
## What's driving it
## Recommendations`,

    fatigue: () =>
      `Analyse posture-stability patterns: ${data.fatigueDecline==null?"within-session decline NOT MEASURED (no session long enough)":`posture declines ${data.fatigueDecline} points from the first third of a session to the last, across ${data.fatigueFrom} sessions`}, avg score ${data.avgScore}/100, sessions this week ${data.week.length}.
This product measures posture from a webcam. It does NOT observe hours worked, workload, sleep or mood, so it cannot assess occupational burnout — do not report a burnout level or risk. This is an employer-facing screen: do not characterise an individual's wellbeing or capacity beyond what the posture data supports.
## What the within-session pattern shows
## What to watch (3 bullets)
## Recommendations`,

    department: () =>
      `Department comparison: ${data.depts.map(d=>`${d.name}: ${d.avg}/100 (${d.count} members, risk ${d.risk}%)`).join(", ")}.
## Department Health Ranking
## Highest Risk Areas
## Targeted Interventions`,

    monthly: () =>
      `Monthly workforce insights: this month ${data.monthAvg}/100, last month ${data.prevAvg}/100, change ${pct(data.monthAvg,data.prevAvg)}%, total sessions this month ${data.month.length}, engagement ${data.engagementScore}%.
## Month-over-Month Analysis
## Highlights & Wins
## Priorities for Next Month`,
  };

  const runAI = useCallback(async (key) => {
    if(aiLoading[key]) return;
    setAiLoading(p=>({...p,[key]:true}));
    setAiError(p=>({...p,[key]:""}));
    try {
      const text = await geminiAnalysis(AI_PROMPTS[key]?.(), { lang, systemPrompt: system, maxTokens:900 });
      setAiData(p=>({...p,[key]:text}));
    } catch(e) { setAiError(p=>({...p,[key]:e.message})); }
    finally { setAiLoading(p=>({...p,[key]:false})); }
  },[data,sessions,lang]);

  const TABS = [
    { id:"workforce", icon:"📊", en:"Workforce",  ar:"القوى العاملة" },
    { id:"executive", icon:"🎯", en:"Executive",  ar:"تنفيذي" },
    { id:"risks",     icon:"⚠️", en:"Risk Map",  ar:"خريطة المخاطر" },
  ];

  return (
    <div style={{
      position:"fixed", inset:0,
      background:"rgba(2,8,20,.92)",
      zIndex:9100, display:"flex", alignItems:"center", justifyContent:"center", padding:16,
    }}>
      <div style={{
        background:"var(--color-background-primary,#0c1528)",
        border:"1px solid rgba(255,255,255,.08)",
        borderRadius:20, width:"min(900px,96vw)", height:"min(800px,96dvh)",
        display:"flex", flexDirection:"column", overflow:"hidden",
        direction:isAr?"rtl":"ltr",
        boxShadow:"0 24px 80px rgba(0,0,0,.6)",
        animation:"wa-slideUp 350ms cubic-bezier(0.16,1,0.3,1) both",
        "--wa-text":"var(--color-text-primary,#e8f0fe)",
        "--wa-text2":"var(--color-text-secondary,#94a3b8)",
        "--wa-muted":"#475569",
        "--wa-card":"rgba(10,20,40,.8)",
        "--wa-surf":"rgba(15,30,54,.6)",
        "--wa-border":"rgba(148,163,184,.09)",
        "--wa-shimmer":"linear-gradient(90deg,rgba(148,163,184,.06) 25%,rgba(148,163,184,.1) 50%,rgba(148,163,184,.06) 75%)",
      }}>

        {/* ── HEADER ── */}
        <div style={{padding:"16px 22px",borderBottom:"1px solid var(--wa-border)",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:11}}>
              <div style={{width:38,height:38,borderRadius:11,background:"linear-gradient(135deg,#1a56db,#0891b2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,boxShadow:"0 4px 16px rgba(26,86,219,.4)"}}>📊</div>
              <div>
                <div style={{fontFamily:SYNE,fontSize:15,fontWeight:800,color:"var(--wa-text)",letterSpacing:"-.02em"}}>
                  {isAr?"تحليلات القوى العاملة المتقدمة":"Advanced Workforce Analytics"}
                </div>
                <div style={{fontSize:10,color:"#0891b2",fontWeight:600,marginTop:1}}>
                  {isAr?"ذكاء اصطناعي · أنماط · مقارنة · تنبؤ":"AI Intelligence · Patterns · Comparison · Forecasting"}
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{width:30,height:30,borderRadius:8,background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.08)",color:"var(--wa-muted)",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}} aria-label="Close">✕</button>
          </div>

          {/* Top KPI strip */}
          <div style={{display:"flex",gap:8,marginTop:14,flexWrap:"wrap"}}>
            {[
              {l:isAr?"متوسط الصحة":"Wellness", v:`${data.avgScore}/100`, c:sc(data.avgScore)},
              {l:isAr?"انتظام الجلسات":"Session regularity", v:`${data.regularityScore}%`, c:sc(data.regularityScore)},
              {l:isAr?"التركيز":"Focus", v:`${data.focusTrend}%`, c:sc(data.focusTrend)},
              {l:isAr?"تراجع داخل الجلسة":"Within-session decline", v:data.fatigueDecline==null?"—":`${data.fatigueDecline}${isAr?" نقطة":" pts"}`, c:data.fatigueDecline==null?"#64748b":data.fatigueDecline>=15?"#ef4444":data.fatigueDecline>=5?"#f59e0b":"#10b981"},
            ].map((m,i)=>(
              <div key={i} style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.06)",borderRadius:9,padding:"7px 13px"}}>
                <div style={{fontSize:11,color:"var(--wa-muted)",fontWeight:700,letterSpacing:".06em",textTransform:"uppercase"}}>{m.l}</div>
                <div style={{fontFamily:SYNE,fontSize:15,fontWeight:800,color:m.c,lineHeight:1.2}}>{m.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── TABS ── */}
        <div style={{display:"flex",borderBottom:"1px solid var(--wa-border)",flexShrink:0,overflowX:"auto"}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              flex:1, padding:"12px 8px", background:"none", border:"none",
              borderBottom:`2px solid ${tab===t.id?"#1a56db":"transparent"}`,
              color:tab===t.id?"#60a5fa":"var(--wa-muted)",
              fontSize:11, fontWeight:700, cursor:"pointer",
              display:"flex", flexDirection:"column", alignItems:"center", gap:3,
              transition:"color 150ms", minWidth:80, whiteSpace:"nowrap",
            }}>
              <span style={{fontSize:16}}>{t.icon}</span>
              <span>{isAr?t.ar:t.en}</span>
            </button>
          ))}
        </div>

        {/* ── CONTENT ── */}
        <div style={{flex:1,overflowY:"auto",padding:20,display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,alignContent:"start"}}>

          {/* ── Workforce Tab ── */}
          {tab==="workforce" && <>
            <div style={{gridColumn:"1/-1"}}><CompanyScore data={data} isAr={isAr} loading={loading}/></div>
            <ProductivityTrends data={data} isAr={isAr} loading={loading}
              onAI={()=>runAI("productivity")} aiData={aiData.productivity} aiLoading={aiLoading.productivity} aiError={aiError.productivity}/>
            <FocusTrends data={data} isAr={isAr} loading={loading}/>
          </>}

          {/* ── Executive Tab ── */}
          {tab==="executive" && <>
            <div style={{gridColumn:"1/-1"}}><CompanyScore data={data} isAr={isAr} loading={loading}/></div>
            <DeptComparison data={data} isAr={isAr} loading={loading}
              onAI={()=>runAI("department")} aiData={aiData.department} aiLoading={aiLoading.department} aiError={aiError.department}/>
            <BurnoutAlerts data={data} isAr={isAr} loading={loading}/>
          </>}

          {/* ── Risk Map Tab ── */}
          {tab==="risks" && <>
            <FatiguePatterns data={data} isAr={isAr} loading={loading}
              onAI={()=>runAI("fatigue")} aiData={aiData.fatigue} aiLoading={aiLoading.fatigue} aiError={aiError.fatigue}/>
            <PostureRiskHeatmap data={data} isAr={isAr} loading={loading}/>
            <EngagementAnalytics data={data} profile={profile} isAr={isAr} loading={loading}/>
            <DeptComparison data={data} isAr={isAr} loading={loading}
              onAI={()=>runAI("department")} aiData={aiData.department} aiLoading={aiLoading.department} aiError={aiError.department}/>
          </>}

        </div>
      </div>
      <style>{`
        @keyframes wa-slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes wa-fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes wa-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes waDot{0%,80%,100%{opacity:.3}40%{opacity:1}}
      `}</style>
    </div>
  );
}
