/**
 * Corvus — Notifications & Integrations Hub v1.0
 * Phase 10: Full ecosystem
 * Queue system · Retries · Scheduled digests · AI alerts
 * Slack · Microsoft Teams · Google Calendar · Jira · Zoom
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { geminiAnalysis, localFallbackAnalysis } from "./gemini.js";
import { getLocalAIStatus } from "./localAI.js";
import { db, collection, addDoc, getDocs, query, orderBy, limit,
         where, updateDoc, doc, setDoc, getDoc, serverTimestamp } from "./firebase.js";

/* ── Design tokens ───────────────────────────────────────────────── */
const D = {
  bg:"#020a18", bg2:"#040f22", bg3:"#071428", surf:"#0a1830",
  card:"rgba(8,18,36,.88)", border:"rgba(148,163,184,.08)", borderH:"rgba(26,86,219,.35)",
  text:"#e8f0fe", text2:"#94a3b8", muted:"#475569",
  blue:"#1a56db", teal:"#0891b2", green:"#10b981", amber:"#f59e0b",
  red:"#ef4444", purple:"#7c3aed", cyan:"#06b6d4",
};
const SPRING = "cubic-bezier(0.16,1,0.3,1)";
const SYNE = "'Syne',sans-serif";

/* ═══════════════════════════════════════════════════════════════════
   NOTIFICATION QUEUE ENGINE
   ═══════════════════════════════════════════════════════════════════ */

/* Notification types */
const NOTIF_TYPES = {
  burnout_alert:    { icon:"🔥", label:"Burnout Alert",      color:"#ef4444", priority:1 },
  posture_warning:  { icon:"⚠️", label:"Posture Warning",    color:"#f59e0b", priority:2 },
  weekly_digest:    { icon:"📊", label:"Weekly Digest",      color:"#1a56db", priority:3 },
  achievement:      { icon:"🏆", label:"Achievement",        color:"#10b981", priority:3 },
  session_reminder: { icon:"⏰", label:"Session Reminder",   color:"#0891b2", priority:4 },
  risk_alert:       { icon:"🚨", label:"Risk Alert",         color:"#ef4444", priority:1 },
  ai_insight:       { icon:"🧠", label:"AI Insight",         color:"#7c3aed", priority:3 },
  team_milestone:   { icon:"🎯", label:"Team Milestone",     color:"#10b981", priority:4 },
  gdpr_request:     { icon:"🛡️", label:"GDPR Request",       color:"#0891b2", priority:1 },
  integration_sync: { icon:"🔄", label:"Integration Sync",  color:"#475569", priority:5 },
};

/* Queue entry shape */
const mkQueueEntry = (type, payload, channels=["in_app"], schedule=null) => ({
  id: `q_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
  type, payload, channels,
  status: schedule ? "scheduled" : "queued",
  priority: NOTIF_TYPES[type]?.priority || 5,
  attempts: 0, maxAttempts: 3,
  created_at: new Date().toISOString(),
  scheduled_for: schedule,
  sent_at: null, error: null,
});

/* In-memory queue store (persists to Firestore) */
class NotificationQueue {
  constructor() {
    this._q = [];
    this._processing = false;
    this._listeners = new Set();
  }

  subscribe(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }
  notify() { this._listeners.forEach(fn => fn([...this._q])); }

  enqueue(entry) {
    this._q.push(entry);
    this._q.sort((a,b) => a.priority - b.priority);
    this.notify();
    if (!this._processing) this._processNext();
  }

  async _processNext() {
    const ready = this._q.filter(e =>
      e.status === "queued" &&
      (!e.scheduled_for || new Date(e.scheduled_for) <= new Date())
    );
    if (!ready.length) { this._processing = false; return; }
    this._processing = true;

    const entry = ready[0];
    entry.status = "processing"; this.notify();

    try {
      await this._dispatch(entry);
      entry.status = "sent"; entry.sent_at = new Date().toISOString();
    } catch(e) {
      entry.attempts++;
      if (entry.attempts >= entry.maxAttempts) {
        entry.status = "failed"; entry.error = e.message;
      } else {
        entry.status = "queued"; // back in queue for retry
        setTimeout(() => { if (!this._processing) this._processNext(); },
          1000 * Math.pow(2, entry.attempts)); // exponential backoff
      }
    }
    this.notify();
    setTimeout(() => this._processNext(), 200);
  }

  async _dispatch(entry) {
    // Simulate dispatch (real implementation calls backend API)
    await new Promise(r => setTimeout(r, 300 + Math.random() * 400));
    // In production: await fetch("/api/notify/dispatch", {method:"POST", body:JSON.stringify(entry)})
  }

  get all() { return [...this._q]; }
  get pending() { return this._q.filter(e => ["queued","scheduled","processing"].includes(e.status)); }
  get failed() { return this._q.filter(e => e.status === "failed"); }
  retry(id) {
    const e = this._q.find(e => e.id === id);
    if (e) { e.status = "queued"; e.attempts = 0; e.error = null; this.notify(); this._processNext(); }
  }
  remove(id) { this._q = this._q.filter(e => e.id !== id); this.notify(); }
}

const globalQueue = new NotificationQueue();

/* ── Integration config store ────────────────────────────────────── */
const INTEGRATIONS_META = {
  slack: {
    id:"slack", name:"Slack", icon:"💬", color:"#4A154B",
    description:"Send posture alerts and weekly digests to Slack channels",
    descriptionAr:"إرسال تنبيهات الوضعية والملخصات الأسبوعية إلى قنوات Slack",
    fields:[
      {key:"webhook_url",  label:"Webhook URL",      labelAr:"رابط Webhook",   placeholder:"https://hooks.slack.com/services/...", type:"url"},
      {key:"channel",      label:"Channel",          labelAr:"القناة",          placeholder:"#hr-posture", type:"text"},
      {key:"bot_name",     label:"Bot Name",         labelAr:"اسم البوت",       placeholder:"Corvus Bot", type:"text"},
    ],
    events:["burnout_alert","risk_alert","weekly_digest","achievement","team_milestone"],
    docs:"https://api.slack.com/messaging/webhooks",
  },
  teams: {
    id:"teams", name:"Microsoft Teams", icon:"🟦", color:"#6264A7",
    description:"Post workforce health updates to Teams channels",
    descriptionAr:"نشر تحديثات صحة القوى العاملة في قنوات Teams",
    fields:[
      {key:"webhook_url",  label:"Connector Webhook URL", labelAr:"رابط الموصّل", placeholder:"https://outlook.office.com/webhook/...", type:"url"},
      {key:"team_name",    label:"Team Name",              labelAr:"اسم الفريق",   placeholder:"HR Team", type:"text"},
    ],
    events:["burnout_alert","risk_alert","weekly_digest","team_milestone"],
    docs:"https://docs.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors",
  },
  gcalendar: {
    id:"gcalendar", name:"Google Calendar", icon:"📅", color:"#1A73E8",
    description:"Auto-schedule wellness sessions and break reminders",
    descriptionAr:"جدولة جلسات الصحة وتذكيرات الاستراحة تلقائياً",
    fields:[
      {key:"calendar_id",  label:"Calendar ID",      labelAr:"معرف التقويم",  placeholder:"primary or your-calendar@group.calendar.google.com", type:"text"},
      {key:"api_key",      label:"Google API Key",   labelAr:"مفتاح API",      placeholder:"AIza...", type:"password"},
      {key:"reminder_min", label:"Reminder (min)",   labelAr:"تذكير (دقيقة)", placeholder:"10", type:"number"},
    ],
    events:["session_reminder","weekly_digest"],
    docs:"https://developers.google.com/calendar/api",
  },
  jira: {
    id:"jira", name:"Jira", icon:"🔵", color:"#0052CC",
    description:"Auto-create HR tickets for high-risk employees",
    descriptionAr:"إنشاء تذاكر HR تلقائياً للموظفين عالي المخاطر",
    fields:[
      {key:"base_url",     label:"Jira Base URL",    labelAr:"رابط Jira",     placeholder:"https://your-org.atlassian.net", type:"url"},
      {key:"api_token",    label:"API Token",        labelAr:"رمز API",        placeholder:"ATATT3x...", type:"password"},
      {key:"project_key",  label:"Project Key",      labelAr:"مفتاح المشروع", placeholder:"HR", type:"text"},
      {key:"issue_type",   label:"Issue Type",       labelAr:"نوع المشكلة",   placeholder:"Task", type:"text"},
    ],
    events:["burnout_alert","risk_alert","gdpr_request"],
    docs:"https://developer.atlassian.com/cloud/jira/platform/rest/v3",
  },
  zoom: {
    id:"zoom", name:"Zoom", icon:"📹", color:"#2D8CFF",
    description:"Auto-generate wellness check-in meeting links",
    descriptionAr:"إنشاء روابط اجتماعات الفحص الصحي تلقائياً",
    fields:[
      {key:"api_key",      label:"API Key",          labelAr:"مفتاح API",      placeholder:"your-zoom-api-key", type:"password"},
      {key:"api_secret",   label:"API Secret",       labelAr:"سر API",         placeholder:"your-zoom-secret", type:"password"},
      {key:"user_id",      label:"Host User ID",     labelAr:"معرف المضيف",   placeholder:"me or user@company.com", type:"text"},
    ],
    events:["burnout_alert","team_milestone"],
    docs:"https://marketplace.zoom.us/docs/api-reference",
  },
};

/* ── API send functions ──────────────────────────────────────────── */
async function sendToSlack(config, message) {
  const payload = {
    channel: config.channel,
    username: config.bot_name || "Corvus Bot",
    icon_emoji: ":health:",
    blocks: [
      { type:"section", text:{ type:"mrkdwn", text: `*Corvus Alert*\n${message.text}` } },
      message.score != null ? {
        type:"context", elements:[{type:"mrkdwn", text:`Score: *${message.score}/100* | ${new Date().toLocaleString()}`}]
      } : null,
      { type:"divider" },
    ].filter(Boolean),
  };
  // Real: return fetch(config.webhook_url, {method:"POST", body:JSON.stringify(payload)})
  return { ok: true, simulated: true };
}

async function sendToTeams(config, message) {
  const payload = {
    "@type":"MessageCard", "@context":"http://schema.org/extensions",
    themeColor: message.color || "1A56DB",
    summary: "Corvus Notification",
    sections:[{ activityTitle:"Corvus Workforce Intelligence",
      activitySubtitle: message.subtitle || new Date().toLocaleString(),
      activityText: message.text, markdown:true }],
    potentialAction:[{ "@type":"OpenUri", name:"Open Dashboard",
      targets:[{os:"default", uri:"https://app.corvus.io"}] }],
  };
  // Real: return fetch(config.webhook_url, {method:"POST", body:JSON.stringify(payload)})
  return { ok: true, simulated: true };
}

async function createJiraTicket(config, issue) {
  // Real: POST /rest/api/3/issue with Basic auth
  return { ok: true, key:`${config.project_key}-${Math.floor(Math.random()*999)}`, simulated: true };
}

/* ── UI primitives ────────────────────────────────────────────────── */
function Skel({w="100%",h=12,r=6}) {
  return <div style={{width:w,height:h,borderRadius:r,background:"rgba(148,163,184,.07)",animation:"nh-shimmer 1.6s ease infinite"}}/>;
}

function Btn({children,onClick,variant="primary",size="base",disabled=false,icon,loading=false,fullWidth=false,style:sx={}}) {
  const [hov,setHov]=useState(false);
  const pads={xs:"5px 11px",sm:"7px 14px",base:"10px 18px",lg:"13px 24px"};
  const fss={xs:10,sm:11,base:12,lg:13};
  const varMap={
    primary:{bg:"linear-gradient(135deg,#1a56db,#0891b2)",c:"#fff",border:"none",sh:hov?"0 8px 28px rgba(26,86,219,.5)":"0 4px 16px rgba(26,86,219,.3)"},
    secondary:{bg:D.surf,c:D.text,border:`1px solid ${D.border}`},
    ghost:{bg:"transparent",c:D.text2,border:`1px solid ${D.border}`},
    danger:{bg:"rgba(239,68,68,.1)",c:"#f87171",border:"1px solid rgba(239,68,68,.2)"},
    success:{bg:"rgba(16,185,129,.1)",c:"#34d399",border:"1px solid rgba(16,185,129,.2)"},
  };
  const v=varMap[variant]||varMap.primary;
  return (
    <button onClick={disabled||loading?undefined:onClick} disabled={disabled||loading}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{display:"inline-flex",alignItems:"center",gap:6,padding:pads[size],
        fontSize:fss[size],fontWeight:700,borderRadius:9,cursor:disabled||loading?"not-allowed":"pointer",
        opacity:disabled?.45:1,fontFamily:"'DM Sans',system-ui,sans-serif",
        whiteSpace:"nowrap",transition:`all 220ms ${SPRING}`,
        transform:hov&&!disabled&&!loading?"translateY(-1px)":"none",
        width:fullWidth?"100%":undefined,justifyContent:"center",
        background:v.bg,color:v.c,border:v.border,boxShadow:v.sh||"none",...sx}}>
      {loading ? <span style={{animation:"nh-spin 750ms linear infinite",display:"inline-block"}}>⟳</span>
               : icon&&<span style={{fontSize:"1.1em"}}>{icon}</span>}
      {children}
    </button>
  );
}

function Input({label,value,onChange,placeholder,type="text",hint,error,mono=false,disabled=false}) {
  const [foc,setFoc]=useState(false);
  return (
    <div style={{width:"100%"}}>
      {label&&<label style={{display:"block",fontSize:11,fontWeight:700,color:D.text2,letterSpacing:".03em",marginBottom:5}}>{label}</label>}
      <input type={type} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled}
        onFocus={()=>setFoc(true)} onBlur={()=>setFoc(false)}
        style={{width:"100%",padding:"9px 13px",background:disabled?"rgba(148,163,184,.04)":D.surf,
          border:`1.5px solid ${error?D.red:foc?D.blue:D.border}`,
          borderRadius:9,color:disabled?D.muted:D.text,fontSize:12,outline:"none",
          fontFamily:mono?"'DM Mono',monospace":"'DM Sans',system-ui,sans-serif",
          boxShadow:foc&&!disabled?(error?`0 0 0 3px rgba(239,68,68,.12)`:`0 0 0 3px rgba(26,86,219,.12)`):"none",
          transition:`border-color 150ms, box-shadow 150ms`}}/>
      {(hint||error)&&<div style={{fontSize:10,color:error?D.red:D.muted,marginTop:4,fontWeight:500}}>{error||hint}</div>}
    </div>
  );
}

function Toggle({value,onChange,label,disabled=false}) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:10,cursor:disabled?"not-allowed":"pointer",opacity:disabled?.5:1}}
      onClick={()=>!disabled&&onChange(!value)}>
      <div style={{width:40,height:22,borderRadius:99,background:value?"#1a56db":"rgba(148,163,184,.15)",
        position:"relative",transition:"background 200ms",border:`1px solid ${value?"#1a56db":"rgba(148,163,184,.2)"}`}}>
        <div style={{position:"absolute",top:2,left:value?20:2,width:16,height:16,borderRadius:"50%",
          background:"#fff",transition:`left 200ms ${SPRING}`,boxShadow:"0 1px 4px rgba(0,0,0,.25)"}}/>
      </div>
      {label&&<span style={{fontSize:12,color:D.text2,fontWeight:500}}>{label}</span>}
    </div>
  );
}

function StatusDot({status}) {
  const map={connected:{c:"#10b981",anim:true},testing:{c:"#f59e0b",anim:true},error:{c:"#ef4444",anim:false},disconnected:{c:"#475569",anim:false}};
  const m=map[status]||map.disconnected;
  return (
    <div style={{position:"relative",width:10,height:10,flexShrink:0}}>
      <div style={{width:10,height:10,borderRadius:"50%",background:m.c,position:"absolute"}}/>
      {m.anim&&<div style={{width:10,height:10,borderRadius:"50%",background:m.c,position:"absolute",animation:"nh-livePulse 1.8s ease-out infinite"}}/>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TAB 1: NOTIFICATION QUEUE
   ═══════════════════════════════════════════════════════════════════ */
function QueuePanel({orgId,profile,isAr}) {
  const [items,setItems]=useState([]);
  const [filter,setFilter]=useState("all");
  const [sending,setSending]=useState(false);
  const [showCompose,setShowCompose]=useState(false);

  useEffect(()=>{
    const unsub = globalQueue.subscribe(setItems);
    setItems(globalQueue.all);
    // Seed with demo items
    if(globalQueue.all.length===0) {
      const seeds=[
        {type:"burnout_alert",  payload:{user:"Ahmed M.",score:72,dept:"Engineering"}, channels:["slack","in_app"]},
        {type:"weekly_digest",  payload:{user:"All",period:"This week"},               channels:["email","slack"], schedule: new Date(Date.now()+3600000).toISOString()},
        {type:"ai_insight",     payload:{text:"Your posture improved 8% this week"},   channels:["in_app"]},
        {type:"session_reminder",payload:{user:"Sara D.",due:"14:00"},                 channels:["teams","in_app"]},
        {type:"risk_alert",     payload:{user:"Omar K.",risk:78,type:"burnout"},       channels:["slack","email","jira"]},
      ];
      seeds.forEach(s=>globalQueue.enqueue(mkQueueEntry(s.type,s.payload,s.channels,s.schedule||null)));
    }
    return unsub;
  },[]);

  const stats={
    total:items.length,
    queued:items.filter(i=>i.status==="queued").length,
    sent:items.filter(i=>i.status==="sent").length,
    failed:items.filter(i=>i.status==="failed").length,
    scheduled:items.filter(i=>i.status==="scheduled").length,
  };

  const filtered=items.filter(i=>filter==="all"||i.status===filter);

  const sendTest=async()=>{
    setSending(true);
    globalQueue.enqueue(mkQueueEntry("ai_insight",{
      text:"Test notification from Corvus",
      score:Math.round(60+Math.random()*30),
    },["in_app","slack"]));
    await new Promise(r=>setTimeout(r,600));
    setSending(false);
  };

  const STATUS_COLOR={queued:D.amber,processing:D.blue,sent:D.green,failed:D.red,scheduled:D.purple};
  const STATUS_LABEL={queued:isAr?"في الانتظار":"Queued",processing:isAr?"جاري الإرسال":"Processing",sent:isAr?"تم الإرسال":"Sent",failed:isAr?"فشل":"Failed",scheduled:isAr?"مجدول":"Scheduled"};

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {/* Stats row */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10}}>
        {[
          {l:isAr?"الكل":"Total",      v:stats.total,    c:D.text2},
          {l:isAr?"في الانتظار":"Queued",  v:stats.queued,   c:D.amber},
          {l:isAr?"تم":"Sent",           v:stats.sent,     c:D.green},
          {l:isAr?"مجدول":"Scheduled",   v:stats.scheduled,c:D.purple},
          {l:isAr?"فشل":"Failed",        v:stats.failed,   c:D.red},
        ].map((m,i)=>(
          <div key={i} style={{background:`${m.c}08`,border:`1px solid ${m.c}20`,borderRadius:12,padding:"12px 14px",textAlign:"center",cursor:"pointer"}}
            onClick={()=>setFilter(i===0?"all":["all","queued","sent","scheduled","failed"][i])}>
            <div style={{fontFamily:SYNE,fontSize:24,fontWeight:800,color:m.c,lineHeight:1}}>{m.v}</div>
            <div style={{fontSize:9,color:D.muted,marginTop:4,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em"}}>{m.l}</div>
          </div>
        ))}
      </div>

      {/* Filter + actions */}
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
        {["all","queued","sent","failed","scheduled"].map(s=>(
          <button key={s} onClick={()=>setFilter(s)} style={{
            padding:"5px 13px",borderRadius:99,cursor:"pointer",fontSize:11,fontWeight:700,
            background:filter===s?"rgba(26,86,219,.14)":"transparent",
            border:`1px solid ${filter===s?"rgba(26,86,219,.35)":D.border}`,
            color:filter===s?D.blue:D.muted,transition:"all 150ms",
          }}>{STATUS_LABEL[s]||"All"}</button>
        ))}
        <div style={{marginLeft:"auto",display:"flex",gap:8}}>
          <Btn size="sm" variant="ghost" icon="+" onClick={()=>setShowCompose(true)}>{isAr?"إنشاء تنبيه":"Compose"}</Btn>
          <Btn size="sm" variant="primary" icon="▶" loading={sending} onClick={sendTest}>{isAr?"إرسال اختباري":"Send Test"}</Btn>
        </div>
      </div>

      {/* Compose panel */}
      {showCompose&&<ComposeNotification isAr={isAr} onSend={(entry)=>{globalQueue.enqueue(entry);setShowCompose(false);}} onClose={()=>setShowCompose(false)}/>}

      {/* Queue table */}
      <div style={{background:D.surf,border:`1px solid ${D.border}`,borderRadius:14,overflow:"hidden"}}>
        <div style={{display:"grid",gridTemplateColumns:"36px 1fr 120px 120px auto auto",gap:0,
          padding:"9px 16px",borderBottom:`1px solid ${D.border}`,background:"rgba(255,255,255,.02)"}}>
          {["","Notification","Channels","Status","Attempts",""].map((h,i)=>(
            <div key={i} style={{fontSize:9,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase",color:D.muted}}>{isAr&&h==="Notification"?"التنبيه":isAr&&h==="Channels"?"القنوات":isAr&&h==="Status"?"الحالة":isAr&&h==="Attempts"?"المحاولات":h}</div>
          ))}
        </div>
        <div style={{maxHeight:340,overflowY:"auto"}}>
          {filtered.length===0&&(
            <div style={{padding:"32px",textAlign:"center",fontSize:12,color:D.muted}}>
              {isAr?"لا توجد إشعارات":"No notifications"}
            </div>
          )}
          {filtered.map((item,i)=>{
            const meta=NOTIF_TYPES[item.type]||{icon:"●",label:item.type,color:D.muted};
            const sc=STATUS_COLOR[item.status]||D.muted;
            return (
              <div key={item.id} style={{display:"grid",gridTemplateColumns:"36px 1fr 120px 120px auto auto",
                gap:0,padding:"11px 16px",borderBottom:i<filtered.length-1?`1px solid ${D.border}`:"none",
                alignItems:"center",transition:"background 150ms",animation:`nh-fadeIn 200ms ${Math.min(i,8)*40}ms both`}}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.025)"}
                onMouseLeave={e=>e.currentTarget.style.background="none"}>
                <span style={{fontSize:18}}>{meta.icon}</span>
                <div>
                  <div style={{fontSize:12,fontWeight:600,color:D.text}}>{meta.label}</div>
                  <div style={{fontSize:10,color:D.muted,marginTop:1}}>
                    {item.payload?.user&&`${item.payload.user} · `}
                    {item.payload?.text||item.payload?.period||""}
                    {item.scheduled_for&&item.status==="scheduled"&&` · 🕐 ${new Date(item.scheduled_for).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}`}
                  </div>
                </div>
                <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                  {(item.channels||[]).map(ch=>(
                    <span key={ch} style={{fontSize:9,padding:"2px 7px",borderRadius:99,
                      background:"rgba(148,163,184,.08)",border:`1px solid ${D.border}`,color:D.text2,fontWeight:600}}>
                      {ch}
                    </span>
                  ))}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <StatusDot status={item.status==="sent"?"connected":item.status==="failed"?"error":item.status==="processing"?"testing":"disconnected"}/>
                  <span style={{fontSize:11,fontWeight:700,color:sc}}>{STATUS_LABEL[item.status]||item.status}</span>
                </div>
                <div style={{fontSize:11,color:D.muted,textAlign:"center"}}>{item.attempts}/{item.maxAttempts}</div>
                <div style={{display:"flex",gap:4}}>
                  {item.status==="failed"&&<button onClick={()=>globalQueue.retry(item.id)} style={{fontSize:10,padding:"3px 8px",borderRadius:6,background:"rgba(26,86,219,.1)",border:`1px solid rgba(26,86,219,.2)`,color:D.blue,cursor:"pointer",fontWeight:700}}>⟳</button>}
                  <button onClick={()=>globalQueue.remove(item.id)} style={{fontSize:10,padding:"3px 8px",borderRadius:6,background:"rgba(239,68,68,.08)",border:`1px solid rgba(239,68,68,.15)`,color:D.red,cursor:"pointer",fontWeight:700}}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Compose Notification ────────────────────────────────────────── */
function ComposeNotification({isAr,onSend,onClose}) {
  const [type,setType]=useState("ai_insight");
  const [text,setText]=useState("");
  const [channels,setChannels]=useState(["in_app"]);
  const [schedule,setSchedule]=useState("");
  const [recipients,setRecipients]=useState("all");

  const ALL_CH=["in_app","slack","teams","email","jira","zoom"];

  const send=()=>{
    if(!text) return;
    onSend(mkQueueEntry(type,{text,recipients},channels,schedule||null));
  };

  return (
    <div style={{background:D.bg2,border:`1px solid ${D.blue}28`,borderRadius:14,padding:18,animation:`nh-fadeIn 250ms ${SPRING} both`}}>
      <div style={{fontFamily:SYNE,fontSize:13,fontWeight:800,color:D.text,marginBottom:14}}>
        {isAr?"إنشاء إشعار جديد":"Compose Notification"}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
        <div>
          <label style={{display:"block",fontSize:11,fontWeight:700,color:D.text2,marginBottom:5}}>
            {isAr?"نوع الإشعار":"Notification Type"}
          </label>
          <select value={type} onChange={e=>setType(e.target.value)}
            style={{width:"100%",padding:"9px 13px",background:D.surf,border:`1px solid ${D.border}`,borderRadius:9,color:D.text,fontSize:12,outline:"none"}}>
            {Object.entries(NOTIF_TYPES).map(([k,v])=>(
              <option key={k} value={k}>{v.icon} {v.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{display:"block",fontSize:11,fontWeight:700,color:D.text2,marginBottom:5}}>
            {isAr?"المستلمون":"Recipients"}
          </label>
          <input value={recipients} onChange={e=>setRecipients(e.target.value)}
            placeholder="all / dept:engineering / uid:abc"
            style={{width:"100%",padding:"9px 13px",background:D.surf,border:`1px solid ${D.border}`,borderRadius:9,color:D.text,fontSize:12,outline:"none"}}/>
        </div>
      </div>

      <div style={{marginBottom:12}}>
        <label style={{display:"block",fontSize:11,fontWeight:700,color:D.text2,marginBottom:5}}>
          {isAr?"نص الرسالة":"Message"}
        </label>
        <textarea value={text} onChange={e=>setText(e.target.value)} rows={3}
          placeholder={isAr?"اكتب رسالتك...":"Write your message..."}
          style={{width:"100%",padding:"9px 13px",background:D.surf,border:`1px solid ${D.border}`,borderRadius:9,color:D.text,fontSize:12,outline:"none",resize:"vertical",fontFamily:"'DM Sans',system-ui,sans-serif"}}/>
      </div>

      {/* Channel checkboxes */}
      <div style={{marginBottom:12}}>
        <div style={{fontSize:11,fontWeight:700,color:D.text2,marginBottom:8}}>{isAr?"القنوات":"Channels"}</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {ALL_CH.map(ch=>{
            const on=channels.includes(ch);
            return (
              <button key={ch} onClick={()=>setChannels(prev=>on?prev.filter(c=>c!==ch):[...prev,ch])} style={{
                padding:"5px 13px",borderRadius:99,cursor:"pointer",fontSize:11,fontWeight:700,
                background:on?"rgba(26,86,219,.14)":"transparent",
                border:`1px solid ${on?"rgba(26,86,219,.35)":D.border}`,
                color:on?D.blue:D.muted,transition:"all 150ms",
              }}>{on?"✓ ":""}{ch}</button>
            );
          })}
        </div>
      </div>

      {/* Schedule */}
      <div style={{marginBottom:14}}>
        <Input label={isAr?"جدول الإرسال (اختياري)":"Schedule (optional)"} type="datetime-local"
          value={schedule} onChange={e=>setSchedule(e.target.value)}
          hint={isAr?"اتركه فارغاً للإرسال الفوري":"Leave empty to send immediately"}/>
      </div>

      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <Btn variant="ghost" size="sm" onClick={onClose}>{isAr?"إلغاء":"Cancel"}</Btn>
        <Btn variant="primary" size="sm" icon="▶" onClick={send} disabled={!text}>{isAr?"إضافة للطابور":"Add to Queue"}</Btn>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TAB 2: SCHEDULED DIGESTS
   ═══════════════════════════════════════════════════════════════════ */
function DigestsPanel({orgId,isAr}) {
  const [digests,setDigests]=useState([
    {id:"d1",name:isAr?"الملخص الأسبوعي للـ HR":"Weekly HR Digest",
      schedule:"MON 09:00",frequency:"weekly",channels:["email","slack"],
      recipients:"hr_admins",enabled:true,lastSent:"2025-01-13",nextSend:"2025-01-20",
      template:"weekly_digest",aiEnhanced:true},
    {id:"d2",name:isAr?"تقرير خطر الإنهاك اليومي":"Daily Burnout Risk Report",
      schedule:"Daily 08:00",frequency:"daily",channels:["slack"],
      recipients:"dept_managers",enabled:true,lastSent:"2025-01-14",nextSend:"2025-01-15",
      template:"risk_alert",aiEnhanced:true},
    {id:"d3",name:isAr?"ملخص الأقسام الشهري":"Monthly Department Summary",
      schedule:"1st of month 10:00",frequency:"monthly",channels:["email"],
      recipients:"org_owners",enabled:false,lastSent:"2025-01-01",nextSend:"2025-02-01",
      template:"weekly_digest",aiEnhanced:true},
  ]);
  const [editing,setEditing]=useState(null);
  const [saving,setSaving]=useState(false);

  const saveDigest=async(d)=>{
    setSaving(true);
    await new Promise(r=>setTimeout(r,600));
    setDigests(prev=>prev.map(x=>x.id===d.id?d:x));
    setSaving(false); setEditing(null);
  };

  const sendNow=async(d)=>{
    globalQueue.enqueue(mkQueueEntry(d.template||"weekly_digest",
      {digest_id:d.id,name:d.name,aiEnhanced:d.aiEnhanced},d.channels));
  };

  const FREQ_LABELS={weekly:isAr?"أسبوعي":"Weekly",daily:isAr?"يومي":"Daily",monthly:isAr?"شهري":"Monthly"};

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontFamily:SYNE,fontSize:14,fontWeight:800,color:D.text}}>{isAr?"الملخصات المجدولة":"Scheduled Digests"}</div>
          <div style={{fontSize:11,color:D.muted,marginTop:2}}>{isAr?"ملخصات AI مؤتمتة على فترات منتظمة":"AI-powered automated digests on regular intervals"}</div>
        </div>
        <Btn size="sm" variant="primary" icon="+" onClick={()=>setEditing({
          id:`d${Date.now()}`,name:"",schedule:"",frequency:"weekly",
          channels:["email"],recipients:"hr_admins",enabled:true,aiEnhanced:true,template:"weekly_digest",
        })}>{isAr?"ملخص جديد":"New Digest"}</Btn>
      </div>

      {digests.map((d,i)=>(
        <div key={d.id} style={{background:D.card,border:`1px solid ${d.enabled?D.blue+"20":D.border}`,
          borderRadius:14,padding:18,position:"relative",overflow:"hidden",
          animation:`nh-fadeIn 300ms ${i*60}ms both`}}>
          {d.enabled&&<div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,#1a56db,transparent)"}}/>}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                <StatusDot status={d.enabled?"connected":"disconnected"}/>
                <div style={{fontFamily:SYNE,fontSize:13,fontWeight:800,color:D.text}}>{d.name}</div>
                {d.aiEnhanced&&<span style={{background:"rgba(124,58,237,.12)",border:"1px solid rgba(124,58,237,.25)",borderRadius:99,padding:"2px 9px",fontSize:9,fontWeight:700,color:"#a78bfa"}}>🧠 AI-Enhanced</span>}
              </div>
              <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                {[
                  {l:isAr?"التكرار":"Frequency",v:FREQ_LABELS[d.frequency]||d.frequency},
                  {l:isAr?"الجدول":"Schedule",v:d.schedule},
                  {l:isAr?"المستلمون":"Recipients",v:d.recipients},
                  {l:isAr?"آخر إرسال":"Last sent",v:d.lastSent||"—"},
                  {l:isAr?"الإرسال القادم":"Next send",v:d.nextSend||"—"},
                ].map(m=>(
                  <div key={m.l}>
                    <div style={{fontSize:9,color:D.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>{m.l}</div>
                    <div style={{fontSize:11,color:D.text2,fontWeight:500,marginTop:2}}>{m.v}</div>
                  </div>
                ))}
                <div>
                  <div style={{fontSize:9,color:D.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>{isAr?"القنوات":"Channels"}</div>
                  <div style={{display:"flex",gap:4,marginTop:2}}>
                    {d.channels.map(c=><span key={c} style={{fontSize:10,padding:"2px 8px",borderRadius:99,background:"rgba(26,86,219,.1)",border:`1px solid rgba(26,86,219,.2)`,color:D.blue,fontWeight:600}}>{c}</span>)}
                  </div>
                </div>
              </div>
            </div>
            <div style={{display:"flex",gap:6,flexShrink:0}}>
              <Toggle value={d.enabled} onChange={v=>setDigests(prev=>prev.map(x=>x.id===d.id?{...x,enabled:v}:x))}/>
              <Btn size="xs" variant="ghost" onClick={()=>setEditing({...d})}>{isAr?"تعديل":"Edit"}</Btn>
              <Btn size="xs" variant="secondary" icon="▶" onClick={()=>sendNow(d)}>{isAr?"إرسال الآن":"Send Now"}</Btn>
            </div>
          </div>
        </div>
      ))}

      {/* Edit panel */}
      {editing&&(
        <div style={{background:D.bg2,border:`1px solid ${D.blue}28`,borderRadius:14,padding:18,animation:`nh-fadeIn 250ms both`}}>
          <div style={{fontFamily:SYNE,fontSize:13,fontWeight:800,color:D.text,marginBottom:14}}>
            {editing.id.startsWith("d")?isAr?"تعديل الملخص":"Edit Digest":isAr?"ملخص جديد":"New Digest"}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <Input label={isAr?"اسم الملخص":"Digest Name"} value={editing.name} onChange={e=>setEditing(p=>({...p,name:e.target.value}))} placeholder="Weekly HR Digest"/>
            <div>
              <label style={{display:"block",fontSize:11,fontWeight:700,color:D.text2,marginBottom:5}}>{isAr?"التكرار":"Frequency"}</label>
              <select value={editing.frequency} onChange={e=>setEditing(p=>({...p,frequency:e.target.value}))}
                style={{width:"100%",padding:"9px 13px",background:D.surf,border:`1px solid ${D.border}`,borderRadius:9,color:D.text,fontSize:12,outline:"none"}}>
                {["daily","weekly","monthly","custom"].map(f=><option key={f} value={f}>{FREQ_LABELS[f]||f}</option>)}
              </select>
            </div>
            <Input label={isAr?"الجدول":"Schedule"} value={editing.schedule} onChange={e=>setEditing(p=>({...p,schedule:e.target.value}))} placeholder="MON 09:00"/>
            <Input label={isAr?"المستلمون":"Recipients"} value={editing.recipients} onChange={e=>setEditing(p=>({...p,recipients:e.target.value}))} placeholder="hr_admins / all / dept:eng"/>
          </div>
          <div style={{display:"flex",gap:16,marginBottom:14}}>
            <Toggle value={editing.enabled} onChange={v=>setEditing(p=>({...p,enabled:v}))} label={isAr?"مفعّل":"Enabled"}/>
            <Toggle value={editing.aiEnhanced} onChange={v=>setEditing(p=>({...p,aiEnhanced:v}))} label={isAr?"تحسين AI":"AI-Enhanced"}/>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn variant="ghost" size="sm" onClick={()=>setEditing(null)}>{isAr?"إلغاء":"Cancel"}</Btn>
            <Btn variant="primary" size="sm" loading={saving} onClick={()=>saveDigest(editing)}>{isAr?"حفظ":"Save Digest"}</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TAB 3: INTEGRATIONS
   ═══════════════════════════════════════════════════════════════════ */
function IntegrationsPanel({orgId,profile,isAr}) {
  const [configs,setConfigs]=useState({});
  const [statuses,setStatuses]=useState({});
  const [activeInt,setActiveInt]=useState(null);
  const [saving,setSaving]=useState(false);
  const [testing,setTesting]=useState(null);

  // Load saved configs from Firestore
  useEffect(()=>{
    if(!orgId) return;
    getDoc(doc(db,"orgs",orgId,"settings","integrations")).then(snap=>{
      if(snap.exists()) setConfigs(snap.data());
    }).catch(()=>{});
  },[orgId]);

  const updateField=(intId,field,val)=>{
    setConfigs(prev=>({...prev,[intId]:{...(prev[intId]||{}),field_values:{...(prev[intId]?.field_values||{}),[field]:val}}}));
  };

  const saveConfig=async(intId)=>{
    setSaving(true);
    const updated={...configs,[intId]:{...(configs[intId]||{}),enabled:true,connected_at:new Date().toISOString()}};
    if(orgId) {
      await setDoc(doc(db,"orgs",orgId,"settings","integrations"),updated,{merge:true});
    }
    setConfigs(updated);
    setSaving(false);
    setStatuses(prev=>({...prev,[intId]:"connected"}));
  };

  const testConnection=async(intId)=>{
    setTesting(intId); setStatuses(prev=>({...prev,[intId]:"testing"}));
    const cfg=configs[intId]?.field_values||{};
    await new Promise(r=>setTimeout(r,1400+Math.random()*800));
    const ok=Object.values(cfg).some(v=>v&&v.length>3);
    setStatuses(prev=>({...prev,[intId]:ok?"connected":"error"}));
    setTesting(null);
  };

  const disconnect=(intId)=>{
    setConfigs(prev=>({...prev,[intId]:{...prev[intId],enabled:false}}));
    setStatuses(prev=>({...prev,[intId]:"disconnected"}));
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div>
        <div style={{fontFamily:SYNE,fontSize:14,fontWeight:800,color:D.text}}>{isAr?"تكاملات النظام":"System Integrations"}</div>
        <div style={{fontSize:11,color:D.muted,marginTop:2}}>{isAr?"ربط Corvus مع منصاتك المفضلة":"Connect Corvus with your favourite platforms"}</div>
      </div>

      {/* Integration cards grid */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:14}}>
        {Object.values(INTEGRATIONS_META).map((int,i)=>{
          const cfg=configs[int.id]||{};
          const status=statuses[int.id]||(cfg.enabled?"connected":"disconnected");
          const isOpen=activeInt===int.id;
          return (
            <div key={int.id} style={{background:D.card,border:`1px solid ${status==="connected"?int.color+"35":D.border}`,
              borderRadius:14,overflow:"hidden",transition:`border-color 200ms`,
              animation:`nh-fadeIn 300ms ${i*70}ms both`}}>
              {/* Card header */}
              <div style={{padding:"16px 18px",display:"flex",alignItems:"center",gap:12,cursor:"pointer",
                borderBottom:isOpen?`1px solid ${D.border}`:"none"}}
                onClick={()=>setActiveInt(isOpen?null:int.id)}>
                <div style={{width:42,height:42,borderRadius:12,background:`${int.color}14`,border:`1px solid ${int.color}28`,
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>
                  {int.icon}
                </div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                    <div style={{fontFamily:SYNE,fontSize:13,fontWeight:800,color:D.text}}>{int.name}</div>
                    <StatusDot status={status}/>
                    {status==="connected"&&<span style={{fontSize:9,fontWeight:700,color:D.green,background:"rgba(16,185,129,.1)",border:"1px solid rgba(16,185,129,.2)",borderRadius:99,padding:"2px 8px"}}>Connected</span>}
                  </div>
                  <div style={{fontSize:11,color:D.muted}}>{isAr?int.descriptionAr:int.description}</div>
                </div>
                <span style={{color:D.muted,fontSize:16,transform:isOpen?"rotate(180deg)":"none",transition:"transform 200ms"}}>▾</span>
              </div>

              {/* Expanded config */}
              {isOpen&&(
                <div style={{padding:"16px 18px",animation:`nh-fadeIn 200ms both`}}>
                  {/* Events this integration handles */}
                  <div style={{marginBottom:14}}>
                    <div style={{fontSize:10,fontWeight:700,color:D.muted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:7}}>
                      {isAr?"الأحداث المدعومة":"Supported Events"}
                    </div>
                    <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                      {int.events.map(e=>{
                        const meta=NOTIF_TYPES[e];
                        return meta ? (
                          <span key={e} style={{fontSize:9,padding:"3px 9px",borderRadius:99,
                            background:`${meta.color}10`,border:`1px solid ${meta.color}22`,color:meta.color,fontWeight:700}}>
                            {meta.icon} {meta.label}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>

                  {/* Config fields */}
                  <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:14}}>
                    {int.fields.map(field=>(
                      <Input key={field.key}
                        label={isAr?field.labelAr:field.label}
                        value={cfg.field_values?.[field.key]||""}
                        onChange={e=>updateField(int.id,field.key,e.target.value)}
                        placeholder={field.placeholder} type={field.type||"text"}/>
                    ))}
                  </div>

                  {/* Test result */}
                  {status==="connected"&&(
                    <div style={{background:"rgba(16,185,129,.06)",border:"1px solid rgba(16,185,129,.18)",borderRadius:10,padding:"10px 12px",marginBottom:12,fontSize:11,color:"#34d399"}}>
                      ✓ {isAr?"متصل — آخر اختبار ناجح":"Connected — last test successful"}
                    </div>
                  )}
                  {status==="error"&&(
                    <div style={{background:"rgba(239,68,68,.06)",border:"1px solid rgba(239,68,68,.18)",borderRadius:10,padding:"10px 12px",marginBottom:12,fontSize:11,color:"#f87171"}}>
                      ✕ {isAr?"فشل الاتصال — تحقق من الإعدادات":"Connection failed — check your settings"}
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{display:"flex",gap:8,justifyContent:"space-between",alignItems:"center"}}>
                    <a href={int.docs} target="_blank" rel="noopener noreferrer"
                      style={{fontSize:11,color:D.blue,textDecoration:"none"}}>
                      📖 {isAr?"وثائق API":"API Docs ↗"}
                    </a>
                    <div style={{display:"flex",gap:7}}>
                      {status==="connected"&&(
                        <Btn size="sm" variant="danger" onClick={()=>disconnect(int.id)}>{isAr?"قطع الاتصال":"Disconnect"}</Btn>
                      )}
                      <Btn size="sm" variant="ghost" loading={testing===int.id} onClick={()=>testConnection(int.id)} icon="🧪">
                        {isAr?"اختبار":"Test"}
                      </Btn>
                      <Btn size="sm" variant="primary" loading={saving} onClick={()=>saveConfig(int.id)} icon="💾">
                        {isAr?"حفظ":"Save"}
                      </Btn>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TAB 4: AI ALERTS
   ═══════════════════════════════════════════════════════════════════ */
function AIAlertsPanel({orgId,profile,sessions=[],allUsers=[],isAr}) {
  const [rules,setRules]=useState([
    {id:"r1",name:isAr?"تنبيه إنهاك مرتفع":"High Burnout Alert",condition:"burnout_risk > 70",
     action:"notify:slack,email",severity:"critical",enabled:true,triggered:3,
     lastTriggered:"2025-01-14 09:12"},
    {id:"r2",name:isAr?"تحذير وضعية منخفضة":"Low Posture Warning",condition:"avg_score < 50 AND streak < 3",
     action:"notify:in_app",severity:"warning",enabled:true,triggered:8,
     lastTriggered:"2025-01-13 15:44"},
    {id:"r3",name:isAr?"ملخص الأداء الأسبوعي":"Weekly Performance Digest",condition:"schedule:weekly",
     action:"digest:slack,email",severity:"info",enabled:true,triggered:12,
     lastTriggered:"2025-01-13 09:00"},
    {id:"r4",name:isAr?"تنبيه شذوذ فريد":"Anomaly Detection Alert",condition:"z_score > 2",
     action:"notify:slack,jira",severity:"high",enabled:false,triggered:1,
     lastTriggered:"2025-01-10 11:30"},
  ]);
  const [aiText,setAiText]=useState("");
  const [aiLoading,setAiLoading]=useState(false);

  const SEV_COLOR={critical:"#ef4444",high:"#f59e0b",warning:"#fbbf24",info:"#60a5fa"};

  const generateAIRule=async()=>{
    setAiLoading(true);
    try {
      const system=`You are Corvus's alert rule generator. Generate 3 smart alert rule suggestions for a workforce health platform. Respond in ${isAr?"Arabic":"English"} as a JSON array with fields: name, condition, action, severity, rationale.`;
      const prompt=`Generate 3 alert rules for: avg posture score ${Math.round(50+Math.random()*30)}/100, ${sessions.length} sessions, ${allUsers.length} employees. Make them practical and specific.`;
      const text = await geminiAnalysis(prompt,{lang:isAr?"ar":"en",context:{system_prompt:system},maxTokens:600})
        .catch(async e => {
          if (getLocalAIStatus().ready) return await localFallbackAnalysis(prompt, { systemPrompt: system, maxTokens: 600 });
          throw e;
        });
      setAiText(text);
    } catch(e){setAiText(isAr?"⚠️ خطأ في توليد القواعد":"⚠️ Error generating rules");}
    setAiLoading(false);
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {/* AI rule generator */}
      <div style={{background:"linear-gradient(135deg,rgba(124,58,237,.08),rgba(26,86,219,.06))",
        border:"1px solid rgba(124,58,237,.2)",borderRadius:16,padding:18}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div>
            <div style={{fontFamily:SYNE,fontSize:13,fontWeight:800,color:D.text}}>{isAr?"مولّد قواعد AI":"AI Rule Generator"}</div>
            <div style={{fontSize:11,color:D.muted,marginTop:2}}>{isAr?"دع Gemini AI يقترح قواعد تنبيه مخصصة لبياناتك":"Let Gemini AI suggest custom alert rules based on your data"}</div>
          </div>
          <Btn size="sm" variant="primary" loading={aiLoading} onClick={generateAIRule} icon="🧠">
            {isAr?"توليد قواعد":"Generate Rules"}
          </Btn>
        </div>
        {aiLoading&&(
          <div style={{display:"flex",flexDirection:"column",gap:7}}>
            {[100,85,70].map((w,i)=><Skel key={i} h={11} w={`${w}%`} r={5}/>)}
          </div>
        )}
        {aiText&&!aiLoading&&(
          <div style={{background:"rgba(255,255,255,.03)",border:`1px solid ${D.border}`,borderRadius:10,padding:14,fontSize:12,color:D.text2,lineHeight:1.75,maxHeight:220,overflowY:"auto"}}>
            {aiText}
          </div>
        )}
      </div>

      {/* Alert rules */}
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{fontFamily:SYNE,fontSize:13,fontWeight:800,color:D.text}}>{isAr?"قواعد التنبيه":"Alert Rules"}</div>
          <span style={{fontSize:11,color:D.muted}}>{rules.filter(r=>r.enabled).length}/{rules.length} {isAr?"مفعّل":"active"}</span>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {rules.map((rule,i)=>(
            <div key={rule.id} style={{background:D.card,border:`1px solid ${rule.enabled?D.border:"rgba(148,163,184,.04)"}`,
              borderRadius:13,padding:"14px 16px",display:"flex",alignItems:"center",gap:14,
              opacity:rule.enabled?1:.55,transition:"opacity 200ms",animation:`nh-fadeIn 250ms ${i*60}ms both`}}>
              <div style={{width:10,height:10,borderRadius:"50%",background:SEV_COLOR[rule.severity]||D.muted,flexShrink:0,
                animation:rule.enabled&&rule.severity==="critical"?"nh-livePulse 1.8s ease-out infinite":"none"}}/>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                  <span style={{fontFamily:SYNE,fontSize:12,fontWeight:800,color:D.text}}>{rule.name}</span>
                  <span style={{fontSize:9,padding:"2px 8px",borderRadius:99,background:`${SEV_COLOR[rule.severity]||D.muted}14`,
                    border:`1px solid ${SEV_COLOR[rule.severity]||D.muted}28`,color:SEV_COLOR[rule.severity]||D.muted,fontWeight:700,textTransform:"uppercase"}}>
                    {rule.severity}
                  </span>
                </div>
                <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                  <div style={{fontSize:10,color:D.muted}}><span style={{color:D.text2}}>Condition:</span> <code style={{fontFamily:"monospace",fontSize:10,color:"#a78bfa"}}>{rule.condition}</code></div>
                  <div style={{fontSize:10,color:D.muted}}><span style={{color:D.text2}}>Action:</span> {rule.action}</div>
                  <div style={{fontSize:10,color:D.muted}}>{isAr?"تفعيل":"Triggered"}: {rule.triggered}× · {rule.lastTriggered}</div>
                </div>
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
                <Toggle value={rule.enabled} onChange={v=>setRules(prev=>prev.map(r=>r.id===rule.id?{...r,enabled:v}:r))}/>
                <Btn size="xs" variant="ghost">Edit</Btn>
                <Btn size="xs" variant="danger" onClick={()=>setRules(prev=>prev.filter(r=>r.id!==rule.id))}>✕</Btn>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TAB 5: IN-APP NOTIFICATIONS (Slack-style)
   ═══════════════════════════════════════════════════════════════════ */
function InAppNotifications({profile,sessions=[],isAr}) {
  const [notifs,setNotifs]=useState(()=>{
    const types=[
      {type:"burnout_alert",icon:"🔥",title:isAr?"تنبيه إنهاك وظيفي":"Burnout Risk Alert",
       body:isAr?"مؤشر الإرهاق وصل 72% — يُنصح بأخذ استراحة":"Fatigue index reached 72% — rest recommended",color:"#ef4444"},
      {type:"achievement",icon:"🏆",title:isAr?"إنجاز جديد!":"New Achievement!",
       body:isAr?"أتممت 7 أيام متتالية 🔥 ممتاز!":"Completed a 7-day streak 🔥 Excellent!",color:"#10b981"},
      {type:"ai_insight",icon:"🧠",title:isAr?"رؤية Gemini AI":"Gemini AI Insight",
       body:isAr?"وضعيتك تحسّنت 8% هذا الأسبوع — استمر!":"Your posture improved 8% this week — keep it up!",color:"#7c3aed"},
      {type:"weekly_digest",icon:"📊",title:isAr?"ملخصك الأسبوعي":"Your Weekly Digest",
       body:isAr?"79/100 متوسط | 5 جلسات | الأفضل: الأربعاء":"79/100 avg | 5 sessions | Best: Wednesday",color:"#1a56db"},
      {type:"team_milestone",icon:"🎯",title:isAr?"إنجاز الفريق":"Team Milestone",
       body:isAr?"فريقك حقق 80/100 لأول مرة 🎉":"Your team hit 80/100 for the first time 🎉",color:"#0891b2"},
    ].map((n,i)=>({
      ...n,id:`n${i}`,read:i>1,
      time:new Date(Date.now()-(i*3600000*1.4)).toISOString(),
      actions:n.type==="burnout_alert"?[{label:"Take Break",key:"break"},{label:"View Report",key:"report"}]:
              n.type==="achievement"?[{label:"Share",key:"share"}]:
              [{label:"View",key:"view"}],
    }));
    return types;
  });

  const [search,setSearch]=useState("");
  const [filterRead,setFilterRead]=useState("all");
  const unread=notifs.filter(n=>!n.read).length;

  const markAll=()=>setNotifs(prev=>prev.map(n=>({...n,read:true})));
  const markRead=(id)=>setNotifs(prev=>prev.map(n=>n.id===id?{...n,read:true}:n));
  const dismiss=(id)=>setNotifs(prev=>prev.filter(n=>n.id!==id));

  const filtered=notifs.filter(n=>{
    if(filterRead==="unread"&&n.read) return false;
    if(search&&!JSON.stringify(n).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const timeAgo=(iso)=>{
    const diff=(Date.now()-new Date(iso))/1000;
    if(diff<60) return isAr?"الآن":"just now";
    if(diff<3600) return isAr?`منذ ${Math.round(diff/60)} د`:`${Math.round(diff/60)}m ago`;
    if(diff<86400) return isAr?`منذ ${Math.round(diff/3600)} س`:`${Math.round(diff/3600)}h ago`;
    return isAr?`منذ ${Math.round(diff/86400)} يوم`:`${Math.round(diff/86400)}d ago`;
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{fontFamily:SYNE,fontSize:14,fontWeight:800,color:D.text}}>{isAr?"الإشعارات":"Notifications"}</div>
          {unread>0&&<span style={{background:D.red,borderRadius:99,padding:"2px 8px",fontSize:10,fontWeight:800,color:"#fff"}}>{unread}</span>}
        </div>
        <div style={{display:"flex",gap:8}}>
          {["all","unread"].map(f=>(
            <button key={f} onClick={()=>setFilterRead(f)} style={{padding:"5px 13px",borderRadius:99,cursor:"pointer",fontSize:11,fontWeight:700,
              background:filterRead===f?"rgba(26,86,219,.14)":"transparent",
              border:`1px solid ${filterRead===f?"rgba(26,86,219,.35)":D.border}`,
              color:filterRead===f?D.blue:D.muted,transition:"all 150ms"}}>
              {f==="all"?(isAr?"الكل":"All"):(isAr?"غير مقروء":"Unread")}
            </button>
          ))}
          <Btn size="sm" variant="ghost" onClick={markAll}>{isAr?"تحديد الكل كمقروء":"Mark all read"}</Btn>
        </div>
      </div>

      <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder={isAr?"بحث في الإشعارات...":"Search notifications..."}/>

      {/* Notification feed (Slack-style) */}
      <div style={{display:"flex",flexDirection:"column",gap:2}}>
        {filtered.map((n,i)=>(
          <div key={n.id}
            style={{background:n.read?D.card:`${n.color}08`,
              border:`1px solid ${n.read?D.border:`${n.color}22`}`,
              borderRadius:12,padding:"14px 16px",
              display:"flex",gap:12,alignItems:"flex-start",
              transition:`all 200ms`,cursor:"pointer",
              animation:`nh-fadeIn 200ms ${i*40}ms both`,
              position:"relative",overflow:"hidden"}}
            onMouseEnter={e=>e.currentTarget.style.borderColor=n.color+"35"}
            onMouseLeave={e=>e.currentTarget.style.borderColor=n.read?D.border:`${n.color}22`}
            onClick={()=>markRead(n.id)}>
            {!n.read&&<div style={{position:"absolute",left:0,top:0,bottom:0,width:3,background:n.color,borderRadius:"0 2px 2px 0"}}/>}
            <div style={{width:40,height:40,borderRadius:11,background:`${n.color}14`,border:`1px solid ${n.color}22`,
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,flexShrink:0}}>
              {n.icon}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:3}}>
                <span style={{fontFamily:SYNE,fontSize:12,fontWeight:800,color:n.read?D.text2:D.text}}>{n.title}</span>
                <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
                  <span style={{fontSize:10,color:D.muted,whiteSpace:"nowrap"}}>{timeAgo(n.time)}</span>
                  {!n.read&&<div style={{width:7,height:7,borderRadius:"50%",background:n.color,flexShrink:0}}/>}
                  <button onClick={e=>{e.stopPropagation();dismiss(n.id);}} style={{background:"none",border:"none",color:D.muted,cursor:"pointer",fontSize:12,padding:"0 2px",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
                </div>
              </div>
              <div style={{fontSize:12,color:n.read?D.muted:D.text2,lineHeight:1.55,marginBottom:8}}>{n.body}</div>
              <div style={{display:"flex",gap:6}}>
                {n.actions.map(a=>(
                  <button key={a.key} onClick={e=>{e.stopPropagation();markRead(n.id);}}
                    style={{fontSize:10,padding:"4px 11px",borderRadius:7,cursor:"pointer",fontWeight:700,
                      background:`${n.color}14`,border:`1px solid ${n.color}28`,color:n.color,
                      transition:"all 150ms"}}>
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
        {filtered.length===0&&(
          <div style={{padding:"48px 24px",textAlign:"center",fontSize:13,color:D.muted}}>
            {isAr?"🎉 لا توجد إشعارات جديدة":"🎉 You're all caught up!"}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN EXPORT
   ═══════════════════════════════════════════════════════════════════ */
export function NotificationsHub({ orgId, profile, sessions=[], allUsers=[], cs, lang="en", onClose }) {
  const [tab,setTab]=useState("queue");
  const isAr=lang==="ar";

  const TABS=[
    {id:"queue",       icon:"📬", en:"Queue",          ar:"طابور الإرسال"},
    {id:"digests",     icon:"📅", en:"Digests",        ar:"الملخصات"},
    {id:"integrations",icon:"🔌", en:"Integrations",   ar:"التكاملات"},
    {id:"alerts",      icon:"🤖", en:"AI Alerts",      ar:"تنبيهات AI"},
    {id:"feed",        icon:"🔔", en:"Notifications",  ar:"الإشعارات"},
  ];

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(2,8,20,.94)",backdropFilter:"blur(10px)",
      WebkitBackdropFilter:"blur(10px)",zIndex:9200,display:"flex",alignItems:"center",
      justifyContent:"center",padding:16}}>
      <div style={{
        background:D.bg, border:`1px solid ${D.border}`,
        borderRadius:20, width:"min(980px,97vw)", height:"min(840px,96vh)",
        display:"flex", flexDirection:"column", overflow:"hidden",
        direction:isAr?"rtl":"ltr",
        boxShadow:"0 28px 80px rgba(0,0,0,.65)",
        animation:`nh-slideUp 350ms ${SPRING} both`,
      }}>
        {/* HEADER */}
        <div style={{padding:"18px 22px",borderBottom:`1px solid ${D.border}`,flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:11}}>
              <div style={{width:38,height:38,borderRadius:11,background:"linear-gradient(135deg,#1a56db,#0891b2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,boxShadow:"0 4px 16px rgba(26,86,219,.4)"}}>🔔</div>
              <div>
                <div style={{fontFamily:SYNE,fontSize:15,fontWeight:800,color:D.text,letterSpacing:"-.02em"}}>
                  {isAr?"مركز الإشعارات والتكاملات":"Notifications & Integrations Hub"}
                </div>
                <div style={{fontSize:10,color:D.teal,fontWeight:600,marginTop:1}}>
                  {isAr?"طابور ذكي · ملخصات مجدولة · Slack · Teams · Jira · Zoom":"Smart queue · Scheduled digests · Slack · Teams · Jira · Zoom"}
                </div>
              </div>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              {/* Live queue indicator */}
              <div style={{display:"flex",alignItems:"center",gap:6,background:"rgba(16,185,129,.08)",border:"1px solid rgba(16,185,129,.2)",borderRadius:99,padding:"5px 12px"}}>
                <StatusDot status="connected"/>
                <span style={{fontSize:10,fontWeight:700,color:D.green}}>{globalQueue.pending.length} {isAr?"في الطابور":"in queue"}</span>
              </div>
              <button onClick={onClose} style={{width:30,height:30,borderRadius:8,background:"rgba(255,255,255,.06)",border:`1px solid ${D.border}`,color:D.muted,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
            </div>
          </div>

          {/* Integration status pills */}
          <div style={{display:"flex",gap:8,marginTop:14,flexWrap:"wrap"}}>
            {Object.values(INTEGRATIONS_META).map(int=>(
              <div key={int.id} style={{display:"flex",alignItems:"center",gap:6,background:"rgba(255,255,255,.04)",border:`1px solid ${D.border}`,borderRadius:99,padding:"4px 12px"}}>
                <span style={{fontSize:12}}>{int.icon}</span>
                <span style={{fontSize:10,fontWeight:600,color:D.muted}}>{int.name}</span>
                <StatusDot status="disconnected"/>
              </div>
            ))}
          </div>
        </div>

        {/* TABS */}
        <div style={{display:"flex",borderBottom:`1px solid ${D.border}`,flexShrink:0,overflowX:"auto"}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              flex:1,padding:"12px 8px",background:"none",border:"none",
              borderBottom:`2px solid ${tab===t.id?D.blue:"transparent"}`,
              color:tab===t.id?"#60a5fa":D.muted,
              fontSize:11,fontWeight:700,cursor:"pointer",
              display:"flex",flexDirection:"column",alignItems:"center",gap:3,
              transition:"color 150ms",minWidth:90,whiteSpace:"nowrap",
            }}>
              <span style={{fontSize:16}}>{t.icon}</span>
              <span>{isAr?t.ar:t.en}</span>
            </button>
          ))}
        </div>

        {/* CONTENT */}
        <div style={{flex:1,overflowY:"auto",padding:20}}>
          {tab==="queue"        && <QueuePanel        orgId={orgId} profile={profile} isAr={isAr}/>}
          {tab==="digests"      && <DigestsPanel      orgId={orgId} isAr={isAr}/>}
          {tab==="integrations" && <IntegrationsPanel orgId={orgId} profile={profile} isAr={isAr}/>}
          {tab==="alerts"       && <AIAlertsPanel     orgId={orgId} profile={profile} sessions={sessions} allUsers={allUsers} isAr={isAr}/>}
          {tab==="feed"         && <InAppNotifications profile={profile} sessions={sessions} isAr={isAr}/>}
        </div>
      </div>

      <style>{`
        @keyframes nh-slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes nh-fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes nh-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes nh-spin{to{transform:rotate(360deg)}}
        @keyframes nh-livePulse{0%{transform:scale(1);opacity:.8}100%{transform:scale(3);opacity:0}}
      `}</style>
    </div>
  );
}

/* ── Utility hook for in-app toasts ──────────────────────────────── */
export function useNotifications() {
  const push = useCallback((type, payload, channels=["in_app"]) => {
    globalQueue.enqueue(mkQueueEntry(type, payload, channels));
  }, []);
  return { push, queue: globalQueue };
}
