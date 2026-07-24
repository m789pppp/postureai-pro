/**
 * Corvus — Notifications & Integrations Hub v2.0
 * Real dispatch · Slack · Teams · Jira · Firestore in-app
 */
import { useState, useEffect, useCallback } from "react";
import { geminiAnalysis } from "./gemini.js";
import { getAuthToken } from "./firebase.js";
import { db, collection, addDoc, getDocs, query, orderBy, limit,
         where, updateDoc, doc, setDoc, getDoc, serverTimestamp } from "./firebase.js";

// ── Tokens ────────────────────────────────────────────────────────
const N = {
  bg:"#060d1a",bg2:"#080f1e",surf:"#0b1525",card:"rgba(8,15,28,.9)",
  border:"rgba(56,139,253,.1)",borderH:"rgba(56,139,253,.25)",
  text:"#e6edf3",text2:"#8b949e",muted:"#6e7681",
  blue:"#388bfd",teal:"#06b6d4",green:"#3fb950",
  amber:"#d29922",red:"#f85149",purple:"#a78bfa",cyan:"#39d353",
  spring:"cubic-bezier(.16,1,.3,1)",
};

// ── Notification types ────────────────────────────────────────────
const TYPES = {
  burnout_alert:    { icon:"🔥",label:"Burnout Alert",     color:"#f85149",priority:1 },
  posture_warning:  { icon:"⚠️",label:"Posture Warning",   color:"#d29922",priority:2 },
  weekly_digest:    { icon:"📊",label:"Weekly Digest",     color:"#388bfd",priority:3 },
  achievement:      { icon:"🏆",label:"Achievement",       color:"#3fb950",priority:3 },
  session_reminder: { icon:"⏰",label:"Session Reminder",  color:"#06b6d4",priority:4 },
  risk_alert:       { icon:"🚨",label:"Risk Alert",        color:"#f85149",priority:1 },
  ai_insight:       { icon:"🧠",label:"AI Insight",        color:"#a78bfa",priority:3 },
  team_milestone:   { icon:"🎯",label:"Team Milestone",    color:"#3fb950",priority:4 },
  gdpr_request:     { icon:"🛡️",label:"GDPR Request",      color:"#06b6d4",priority:1 },
};

const mkEntry=(type,payload,channels=["in_app"],schedule=null)=>({
  id:`q_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
  type,payload,channels,
  status:schedule?"scheduled":"queued",
  priority:TYPES[type]?.priority||5,
  attempts:0,maxAttempts:3,
  created_at:new Date().toISOString(),
  scheduled_for:schedule,sent_at:null,error:null,
});

// ── Real dispatch queue ───────────────────────────────────────────
class NotificationQueue {
  constructor(){ this._q=[];this._proc=false;this._subs=new Set(); }
  subscribe(fn){ this._subs.add(fn);return()=>this._subs.delete(fn); }
  _emit(){ this._subs.forEach(fn=>fn([...this._q])); }
  enqueue(e){ this._q.push(e);this._q.sort((a,b)=>a.priority-b.priority);this._emit();if(!this._proc)this._next(); }

  async _next(){
    const ready=this._q.filter(e=>e.status==="queued"&&(!e.scheduled_for||new Date(e.scheduled_for)<=new Date()));
    if(!ready.length){this._proc=false;return;}
    this._proc=true;
    const entry=ready[0];
    entry.status="processing";this._emit();
    try{
      await this._dispatch(entry);
      entry.status="sent";entry.sent_at=new Date().toISOString();
    } catch(e){
      entry.attempts++;
      if(entry.attempts>=entry.maxAttempts){entry.status="failed";entry.error=e.message;}
      else{entry.status="queued";setTimeout(()=>{if(!this._proc)this._next();},1000*Math.pow(2,entry.attempts));}
    }
    this._emit();
    setTimeout(()=>this._next(),200);
  }

  async _dispatch(entry){
    let token=null;
    try{ token=await getAuthToken(); }catch(_){}
    const res=await fetch("/api/notify/dispatch",{
      method:"POST",
      headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})},
      body:JSON.stringify(entry),
      signal:AbortSignal.timeout(14000),
    });
    if(!res.ok){
      const err=await res.json().catch(()=>({error:"http_"+res.status}));
      throw new Error(err.error||"dispatch_"+res.status);
    }
    const data=await res.json();
    (data.results||[]).filter(r=>!r.ok).forEach(r=>console.warn("[Hub]",r.channel,"fail:",r.error));
  }

  get all(){ return[...this._q]; }
  get pending(){ return this._q.filter(e=>["queued","scheduled","processing"].includes(e.status)); }
  retry(id){ const e=this._q.find(e=>e.id===id);if(e){e.status="queued";e.attempts=0;e.error=null;this._emit();this._next();} }
  remove(id){ this._q=this._q.filter(e=>e.id!==id);this._emit(); }
}

const globalQueue=new NotificationQueue();

// ── Integration definitions ───────────────────────────────────────
const INTEGRATIONS={
  slack:  { id:"slack",name:"Slack",icon:"💬",color:"#4A154B",
    desc:"Send alerts to Slack channels",
    descAr:"إرسال التنبيهات لقنوات Slack",
    fields:[
      {key:"webhook_url",label:"Webhook URL",labelAr:"رابط Webhook",placeholder:"https://hooks.slack.com/services/...",type:"url"},
      {key:"channel",label:"Channel",labelAr:"القناة",placeholder:"#hr-posture",type:"text"},
      {key:"bot_name",label:"Bot Name",labelAr:"اسم البوت",placeholder:"Corvus Bot",type:"text"},
    ],
    events:["burnout_alert","risk_alert","weekly_digest","achievement","team_milestone"],
    docs:"https://api.slack.com/messaging/webhooks",
  },
  teams:  { id:"teams",name:"Microsoft Teams",icon:"🟦",color:"#6264A7",
    desc:"Post updates to Teams channels",
    descAr:"نشر التحديثات في قنوات Teams",
    fields:[
      {key:"webhook_url",label:"Connector Webhook URL",labelAr:"رابط الموصّل",placeholder:"https://outlook.office.com/webhook/...",type:"url"},
      {key:"team_name",label:"Team Name",labelAr:"اسم الفريق",placeholder:"HR Team",type:"text"},
    ],
    events:["burnout_alert","risk_alert","weekly_digest","team_milestone"],
    docs:"https://docs.microsoft.com/microsoftteams/platform/webhooks-and-connectors",
  },
  jira:   { id:"jira",name:"Jira",icon:"🔵",color:"#0052CC",
    desc:"Auto-create tickets for high-risk employees",
    descAr:"إنشاء تذاكر تلقائياً للموظفين عالي المخاطر",
    fields:[
      {key:"base_url",label:"Jira Base URL",labelAr:"رابط Jira",placeholder:"https://your-org.atlassian.net",type:"url"},
      {key:"api_token",label:"API Token",labelAr:"رمز API",placeholder:"ATATT3x...",type:"password"},
      {key:"project_key",label:"Project Key",labelAr:"مفتاح المشروع",placeholder:"HR",type:"text"},
      {key:"issue_type",label:"Issue Type",labelAr:"نوع المشكلة",placeholder:"Task",type:"text"},
    ],
    events:["burnout_alert","risk_alert","gdpr_request"],
    docs:"https://developer.atlassian.com/cloud/jira/platform/rest/v3",
  },
  gcalendar:{ id:"gcalendar",name:"Google Calendar",icon:"📅",color:"#1A73E8",
    desc:"Auto-schedule wellness sessions",
    descAr:"جدولة جلسات الصحة تلقائياً",
    fields:[
      {key:"calendar_id",label:"Calendar ID",labelAr:"معرف التقويم",placeholder:"primary",type:"text"},
      {key:"api_key",label:"Google API Key",labelAr:"مفتاح API",placeholder:"AIza...",type:"password"},
    ],
    events:["session_reminder","weekly_digest"],
    docs:"https://developers.google.com/calendar/api",
  },
  zoom:   { id:"zoom",name:"Zoom",icon:"📹",color:"#2D8CFF",
    desc:"Auto-generate wellness check-in links",
    descAr:"إنشاء روابط اجتماعات تلقائياً",
    fields:[
      {key:"api_key",label:"API Key",labelAr:"مفتاح API",placeholder:"...",type:"password"},
      {key:"api_secret",label:"API Secret",labelAr:"سر API",placeholder:"...",type:"password"},
    ],
    events:["burnout_alert","team_milestone"],
    docs:"https://marketplace.zoom.us/docs/api-reference",
  },
};

// ── Shared UI ─────────────────────────────────────────────────────
function Dot({status}){
  const m={connected:{c:"#3fb950",p:true},testing:{c:"#d29922",p:true},error:{c:"#f85149",p:false},disconnected:{c:"#6e7681",p:false}};
  const s=m[status]||m.disconnected;
  return(
    <div style={{position:"relative",width:9,height:9,flexShrink:0}}>
      <div style={{width:9,height:9,borderRadius:"50%",background:s.c,position:"absolute"}}/>
      {s.p&&<div style={{width:9,height:9,borderRadius:"50%",background:s.c,position:"absolute",animation:"nhPulse 1.8s ease-out infinite"}}/>}
    </div>
  );
}

function Tag({label,color}){
  return(
    <span style={{fontSize:9,padding:"2px 8px",borderRadius:99,
      background:`${color||N.blue}12`,border:`1px solid ${color||N.blue}22`,
      color:color||N.blue,fontWeight:700,whiteSpace:"nowrap"}}>
      {label}
    </span>
  );
}

function Btn({children,onClick,variant="primary",size="base",disabled=false,icon,loading=false,fullWidth=false,style:sx={}}){
  const [h,setH]=useState(false);
  const pads={xs:"4px 10px",sm:"6px 13px",base:"9px 17px",lg:"12px 22px"};
  const fss={xs:10,sm:11,base:12,lg:13};
  const vs={
    primary:{bg:"linear-gradient(135deg,#1158c7,#0891b2)",c:"#fff",border:"none",sh:h?"0 8px 24px rgba(17,88,199,.5)":"0 4px 14px rgba(17,88,199,.3)"},
    secondary:{bg:N.surf,c:N.text,border:"1px solid "+N.border},
    ghost:{bg:"transparent",c:N.text2,border:"1px solid "+N.border},
    danger:{bg:"rgba(248,81,73,.08)",c:"#f85149",border:"1px solid rgba(248,81,73,.2)"},
    success:{bg:"rgba(63,185,80,.08)",c:"#3fb950",border:"1px solid rgba(63,185,80,.2)"},
  };
  const v=vs[variant]||vs.primary;
  return(
    <button onClick={disabled||loading?undefined:onClick} disabled={disabled||loading}
      onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
      style={{display:"inline-flex",alignItems:"center",gap:6,padding:pads[size],
        fontSize:fss[size],fontWeight:700,borderRadius:9,cursor:disabled||loading?"not-allowed":"pointer",
        opacity:disabled?.45:1,fontFamily:"'DM Sans',system-ui,sans-serif",whiteSpace:"nowrap",
        transition:"all 200ms "+N.spring,transform:h&&!disabled&&!loading?"translateY(-1px)":"none",
        width:fullWidth?"100%":undefined,justifyContent:"center",
        background:v.bg,color:v.c,border:v.border,boxShadow:v.sh||"none",...sx}}>
      {loading?<span style={{animation:"nhSpin 700ms linear infinite",display:"inline-block"}}>⟳</span>
              :icon&&<span style={{fontSize:"1.05em"}}>{icon}</span>}
      {children}
    </button>
  );
}

function Input({label,value,onChange,placeholder,type="text",hint,error,disabled=false}){
  const[f,setF]=useState(false);
  return(
    <div style={{width:"100%"}}>
      {label&&<label style={{display:"block",fontSize:10,fontWeight:700,color:N.text2,letterSpacing:".04em",textTransform:"uppercase",marginBottom:5}}>{label}</label>}
      <input type={type} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled}
        onFocus={()=>setF(true)} onBlur={()=>setF(false)}
        style={{width:"100%",padding:"9px 12px",background:disabled?"rgba(56,139,253,.03)":N.surf,
          border:`1.5px solid ${error?N.red:f?N.blue:N.border}`,
          borderRadius:9,color:disabled?N.muted:N.text,fontSize:12,outline:"none",
          fontFamily:"'DM Sans',system-ui,sans-serif",boxSizing:"border-box",
          boxShadow:f&&!disabled?(error?"0 0 0 3px rgba(248,81,73,.1)":"0 0 0 3px rgba(56,139,253,.1)"):"none",
          transition:"border-color 150ms,box-shadow 150ms"}}/>
      {(hint||error)&&<div style={{fontSize:10,color:error?N.red:N.muted,marginTop:4,fontWeight:500}}>{error||hint}</div>}
    </div>
  );
}

function Toggle({value,onChange,label,disabled=false}){
  return(
    <div style={{display:"flex",alignItems:"center",gap:9,cursor:disabled?"not-allowed":"pointer",opacity:disabled?.5:1}}
      onClick={()=>!disabled&&onChange(!value)}>
      <div style={{width:38,height:20,borderRadius:99,position:"relative",transition:"background 200ms",
        background:value?"#388bfd":"rgba(110,118,129,.2)",border:"1px solid "+(value?"#388bfd":"rgba(110,118,129,.3)")}}>
        <div style={{position:"absolute",top:2,left:value?19:2,width:14,height:14,borderRadius:"50%",
          background:"#fff",transition:"left 200ms "+N.spring,boxShadow:"0 1px 4px rgba(0,0,0,.3)"}}/>
      </div>
      {label&&<span style={{fontSize:11,color:N.text2,fontWeight:500}}>{label}</span>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB 1: QUEUE
// ═══════════════════════════════════════════════════════════
function QueuePanel({isAr}){
  const[items,setItems]=useState([]);
  const[filter,setFilter]=useState("all");
  const[sending,setSending]=useState(false);
  const[compose,setCompose]=useState(false);

  useEffect(()=>{
    const unsub=globalQueue.subscribe(setItems);
    setItems(globalQueue.all);
    if(globalQueue.all.length===0){
      [
        {type:"burnout_alert", payload:{user:"Ahmed M.",score:72,dept:"Engineering"},channels:["slack","in_app"]},
        {type:"weekly_digest", payload:{user:"All",period:"This week"},channels:["email","slack"],schedule:new Date(Date.now()+3600000).toISOString()},
        {type:"ai_insight",    payload:{text:"Posture improved 8% this week"},channels:["in_app"]},
        {type:"risk_alert",    payload:{user:"Omar K.",risk:78,type:"burnout"},channels:["slack","jira"]},
      ].forEach(s=>globalQueue.enqueue(mkEntry(s.type,s.payload,s.channels,s.schedule||null)));
    }
    return unsub;
  },[]);

  const stats={
    total:items.length,queued:items.filter(i=>i.status==="queued").length,
    sent:items.filter(i=>i.status==="sent").length,
    failed:items.filter(i=>i.status==="failed").length,
    scheduled:items.filter(i=>i.status==="scheduled").length,
  };

  const SC={queued:N.amber,processing:N.blue,sent:N.green,failed:N.red,scheduled:N.purple};
  const SL={queued:isAr?"انتظار":"Queued",processing:isAr?"إرسال":"Processing",
    sent:isAr?"تم":"Sent",failed:isAr?"فشل":"Failed",scheduled:isAr?"مجدول":"Scheduled"};

  const filtered=items.filter(i=>filter==="all"||i.status===filter);

  const sendTest=async()=>{
    setSending(true);
    globalQueue.enqueue(mkEntry("ai_insight",{text:"Corvus test — "+new Date().toLocaleString("en-GB"),score:Math.round(60+Math.random()*30)},["in_app","slack"]));
    await new Promise(r=>setTimeout(r,500));
    setSending(false);
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8}}>
        {[
          {l:isAr?"الكل":"Total",v:stats.total,c:N.text2,f:"all"},
          {l:isAr?"انتظار":"Queued",v:stats.queued,c:N.amber,f:"queued"},
          {l:isAr?"تم":"Sent",v:stats.sent,c:N.green,f:"sent"},
          {l:isAr?"مجدول":"Scheduled",v:stats.scheduled,c:N.purple,f:"scheduled"},
          {l:isAr?"فشل":"Failed",v:stats.failed,c:N.red,f:"failed"},
        ].map(m=>(
          <div key={m.l} onClick={()=>setFilter(m.f)} style={{
            background:`${m.c}08`,border:`1px solid ${m.c}20`,borderRadius:12,
            padding:"12px 10px",textAlign:"center",cursor:"pointer",
            outline:filter===m.f?`1px solid ${m.c}40`:"none",transition:"all .15s",
          }}>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:800,color:m.c,lineHeight:1}}>{m.v}</div>
            <div style={{fontSize:9,color:N.muted,marginTop:4,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em"}}>{m.l}</div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}>
        {["all","queued","sent","failed","scheduled"].map(s=>(
          <button key={s} onClick={()=>setFilter(s)} style={{
            padding:"5px 12px",borderRadius:99,cursor:"pointer",fontSize:11,fontWeight:700,
            background:filter===s?"rgba(56,139,253,.12)":"transparent",
            border:`1px solid ${filter===s?"rgba(56,139,253,.32)":N.border}`,
            color:filter===s?N.blue:N.muted,transition:"all 150ms",
          }}>{SL[s]||"All"}</button>
        ))}
        <div style={{marginLeft:"auto",display:"flex",gap:7}}>
          <Btn size="sm" variant="ghost" icon="+" onClick={()=>setCompose(true)}>{isAr?"إنشاء":"Compose"}</Btn>
          <Btn size="sm" variant="primary" icon="▶" loading={sending} onClick={sendTest}>{isAr?"اختبار":"Send Test"}</Btn>
        </div>
      </div>

      {/* Compose */}
      {compose&&<ComposePanel isAr={isAr} onSend={e=>{globalQueue.enqueue(e);setCompose(false);}} onClose={()=>setCompose(false)}/>}

      {/* Table */}
      <div style={{background:N.surf,border:`1px solid ${N.border}`,borderRadius:14,overflow:"hidden"}}>
        <div style={{display:"grid",gridTemplateColumns:"32px 1fr 110px 110px 60px 52px",
          padding:"8px 14px",borderBottom:`1px solid ${N.border}`,background:"rgba(255,255,255,.018)"}}>
          {["","Notification","Channels","Status","Tries",""].map((h,i)=>(
            <div key={i} style={{fontSize:9,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase",color:N.muted}}>
              {isAr&&h==="Notification"?"التنبيه":isAr&&h==="Channels"?"القنوات":isAr&&h==="Status"?"الحالة":isAr&&h==="Tries"?"محاولات":h}
            </div>
          ))}
        </div>
        <div style={{maxHeight:340,overflowY:"auto"}}>
          {filtered.length===0&&(
            <div style={{padding:"32px",textAlign:"center",fontSize:12,color:N.muted}}>
              {isAr?"لا توجد إشعارات":"No notifications"}
            </div>
          )}
          {filtered.map((item,i)=>{
            const meta=TYPES[item.type]||{icon:"●",label:item.type,color:N.muted};
            return(
              <div key={item.id} style={{
                display:"grid",gridTemplateColumns:"32px 1fr 110px 110px 60px 52px",
                padding:"10px 14px",borderBottom:i<filtered.length-1?`1px solid ${N.border}`:"none",
                alignItems:"center",transition:"background 150ms",
              }}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(56,139,253,.04)"}
                onMouseLeave={e=>e.currentTarget.style.background="none"}>
                <span style={{fontSize:16}}>{meta.icon}</span>
                <div>
                  <div style={{fontSize:11,fontWeight:600,color:N.text}}>{meta.label}</div>
                  <div style={{fontSize:10,color:N.muted,marginTop:1}}>
                    {item.payload?.user&&item.payload.user+" · "}
                    {item.payload?.text||item.payload?.period||""}
                    {item.scheduled_for&&item.status==="scheduled"&&" · 🕐 "+new Date(item.scheduled_for).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}
                  </div>
                </div>
                <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                  {(item.channels||[]).map(ch=><Tag key={ch} label={ch} color={N.blue}/>)}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:5}}>
                  <Dot status={item.status==="sent"?"connected":item.status==="failed"?"error":item.status==="processing"?"testing":"disconnected"}/>
                  <span style={{fontSize:10,fontWeight:700,color:SC[item.status]||N.muted}}>{SL[item.status]||item.status}</span>
                </div>
                <div style={{fontSize:11,color:N.muted,textAlign:"center"}}>{item.attempts}/{item.maxAttempts}</div>
                <div style={{display:"flex",gap:3}}>
                  {item.status==="failed"&&<button onClick={()=>globalQueue.retry(item.id)} style={{fontSize:10,padding:"2px 7px",borderRadius:5,background:"rgba(56,139,253,.1)",border:"1px solid rgba(56,139,253,.2)",color:N.blue,cursor:"pointer",fontWeight:700}}>↺</button>}
                  <button onClick={()=>globalQueue.remove(item.id)} style={{fontSize:10,padding:"2px 7px",borderRadius:5,background:"rgba(248,81,73,.07)",border:"1px solid rgba(248,81,73,.15)",color:N.red,cursor:"pointer",fontWeight:700}}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ComposePanel({isAr,onSend,onClose}){
  const[type,setType]=useState("ai_insight");
  const[text,setText]=useState("");
  const[channels,setChannels]=useState(["in_app"]);
  const[schedule,setSchedule]=useState("");
  const ALL=["in_app","slack","teams","email","jira"];
  const send=()=>{ if(!text)return; onSend(mkEntry(type,{text},channels,schedule||null)); };
  return(
    <div style={{background:N.bg2,border:`1px solid rgba(56,139,253,.18)`,borderRadius:14,padding:18,
      animation:"nhFade 220ms ease both"}}>
      <div style={{fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:800,color:N.text,marginBottom:14}}>
        {isAr?"إنشاء إشعار":"Compose Notification"}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11,marginBottom:11}}>
        <div>
          <label style={{display:"block",fontSize:10,fontWeight:700,color:N.text2,letterSpacing:".04em",textTransform:"uppercase",marginBottom:5}}>{isAr?"النوع":"Type"}</label>
          <select value={type} onChange={e=>setType(e.target.value)}
            style={{width:"100%",padding:"9px 12px",background:N.surf,border:`1.5px solid ${N.border}`,borderRadius:9,color:N.text,fontSize:12,outline:"none"}}>
            {Object.entries(TYPES).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select>
        </div>
        <Input label={isAr?"المستلمون":"Recipients"} value="" onChange={()=>{}} placeholder="all / hr_admins / uid:abc"/>
      </div>
      <div style={{marginBottom:11}}>
        <label style={{display:"block",fontSize:10,fontWeight:700,color:N.text2,letterSpacing:".04em",textTransform:"uppercase",marginBottom:5}}>{isAr?"الرسالة":"Message"}</label>
        <textarea value={text} onChange={e=>setText(e.target.value)} rows={3}
          placeholder={isAr?"اكتب رسالتك...":"Write your message..."}
          style={{width:"100%",padding:"9px 12px",background:N.surf,border:`1.5px solid ${N.border}`,borderRadius:9,color:N.text,fontSize:12,outline:"none",resize:"vertical",fontFamily:"inherit",boxSizing:"border-box"}}/>
      </div>
      <div style={{marginBottom:11}}>
        <div style={{fontSize:10,fontWeight:700,color:N.text2,letterSpacing:".04em",textTransform:"uppercase",marginBottom:7}}>{isAr?"القنوات":"Channels"}</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {ALL.map(ch=>{
            const on=channels.includes(ch);
            return(
              <button key={ch} onClick={()=>setChannels(prev=>on?prev.filter(c=>c!==ch):[...prev,ch])} style={{
                padding:"4px 12px",borderRadius:99,cursor:"pointer",fontSize:11,fontWeight:700,
                background:on?"rgba(56,139,253,.12)":"transparent",
                border:`1px solid ${on?"rgba(56,139,253,.32)":N.border}`,
                color:on?N.blue:N.muted,transition:"all 150ms",
              }}>{on?"✓ ":""}{ch}</button>
            );
          })}
        </div>
      </div>
      <div style={{marginBottom:14}}>
        <Input label={isAr?"جدول الإرسال":"Schedule (optional)"} type="datetime-local" value={schedule} onChange={e=>setSchedule(e.target.value)} hint={isAr?"فارغ = إرسال فوري":"Empty = send immediately"}/>
      </div>
      <div style={{display:"flex",gap:7,justifyContent:"flex-end"}}>
        <Btn variant="ghost" size="sm" onClick={onClose}>{isAr?"إلغاء":"Cancel"}</Btn>
        <Btn variant="primary" size="sm" icon="▶" onClick={send} disabled={!text}>{isAr?"إضافة":"Add to Queue"}</Btn>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB 2: INTEGRATIONS
// ═══════════════════════════════════════════════════════════
function IntegrationsPanel({orgId,profile,isAr}){
  const[configs,setConfigs]=useState({});
  const[statuses,setStatuses]=useState({});
  const[open,setOpen]=useState(null);
  const[saving,setSaving]=useState(false);
  const[testing,setTesting]=useState(null);

  useEffect(()=>{
    if(!orgId)return;
    getDoc(doc(db,"orgs",orgId,"settings","integrations")).then(s=>{if(s.exists())setConfigs(s.data());}).catch(()=>{});
  },[orgId]);

  const setField=(id,key,val)=>setConfigs(p=>({...p,[id]:{...(p[id]||{}),field_values:{...(p[id]?.field_values||{}),[key]:val}}}));

  const save=async(id)=>{
    setSaving(true);
    const u={...configs,[id]:{...(configs[id]||{}),enabled:true,connected_at:new Date().toISOString()}};
    if(orgId)await setDoc(doc(db,"orgs",orgId,"settings","integrations"),u,{merge:true}).catch(()=>{});
    setConfigs(u);setSaving(false);setStatuses(p=>({...p,[id]:"connected"}));
  };

  const test=async(id)=>{
    setTesting(id);setStatuses(p=>({...p,[id]:"testing"}));
    try{
      const token=await getAuthToken().catch(()=>null);
      const res=await fetch("/api/notify/dispatch",{
        method:"POST",
        headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})},
        body:JSON.stringify({id:"test_"+Date.now(),type:"ai_insight",channels:[id],payload:{text:"Corvus connection test — "+new Date().toLocaleString("en-GB")}}),
        signal:AbortSignal.timeout(12000),
      });
      const data=await res.json().catch(()=>({}));
      const r=(data.results||[]).find(r=>r.channel===id);
      setStatuses(p=>({...p,[id]:res.ok&&r?.ok!==false?"connected":"error"}));
    }catch(e){setStatuses(p=>({...p,[id]:"error"}));}
    setTesting(null);
  };

  const disconnect=id=>{ setConfigs(p=>({...p,[id]:{...p[id],enabled:false}}));setStatuses(p=>({...p,[id]:"disconnected"})); };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div>
        <div style={{fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:800,color:N.text}}>{isAr?"تكاملات النظام":"System Integrations"}</div>
        <div style={{fontSize:11,color:N.muted,marginTop:2}}>{isAr?"ربط Corvus مع منصاتك":"Connect Corvus with your platforms"}</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:12}}>
        {Object.values(INTEGRATIONS).map((int,i)=>{
          const cfg=configs[int.id]||{};
          const status=statuses[int.id]||(cfg.enabled?"connected":"disconnected");
          const isOpen=open===int.id;
          return(
            <div key={int.id} style={{
              background:N.card,border:`1px solid ${status==="connected"?int.color+"35":N.border}`,
              borderRadius:14,overflow:"hidden",transition:"border-color 200ms",
              animation:`nhFade 280ms ${i*60}ms both`,
            }}>
              <div style={{padding:"15px 17px",display:"flex",alignItems:"center",gap:11,cursor:"pointer",
                borderBottom:isOpen?`1px solid ${N.border}`:"none"}}
                onClick={()=>setOpen(isOpen?null:int.id)}>
                <div style={{width:40,height:40,borderRadius:11,background:`${int.color}14`,border:`1px solid ${int.color}22`,
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,flexShrink:0}}>
                  {int.icon}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:3}}>
                    <div style={{fontFamily:"'Syne',sans-serif",fontSize:12,fontWeight:800,color:N.text}}>{int.name}</div>
                    <Dot status={status}/>
                    {status==="connected"&&<Tag label="Connected" color={N.green}/>}
                    {status==="error"&&<Tag label="Error" color={N.red}/>}
                  </div>
                  <div style={{fontSize:11,color:N.muted}}>{isAr?int.descAr:int.desc}</div>
                </div>
                <span style={{color:N.muted,fontSize:14,transform:isOpen?"rotate(180deg)":"none",transition:"transform 200ms"}}>▾</span>
              </div>

              {isOpen&&(
                <div style={{padding:"15px 17px",animation:"nhFade 180ms both"}}>
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:10,fontWeight:700,color:N.muted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:7}}>
                      {isAr?"الأحداث المدعومة":"Supported Events"}
                    </div>
                    <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                      {int.events.map(e=>{const m=TYPES[e];return m?<Tag key={e} label={m.icon+" "+m.label} color={m.color}/>:null;})}
                    </div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:9,marginBottom:12}}>
                    {int.fields.map(f=>(
                      <Input key={f.key} label={isAr?f.labelAr:f.label}
                        value={cfg.field_values?.[f.key]||""}
                        onChange={e=>setField(int.id,f.key,e.target.value)}
                        placeholder={f.placeholder} type={f.type||"text"}/>
                    ))}
                  </div>
                  {status==="connected"&&<div style={{background:"rgba(63,185,80,.06)",border:"1px solid rgba(63,185,80,.16)",borderRadius:9,padding:"9px 12px",marginBottom:11,fontSize:11,color:"#3fb950"}}>✓ {isAr?"متصل — آخر اختبار ناجح":"Connected — last test passed"}</div>}
                  {status==="error"&&<div style={{background:"rgba(248,81,73,.06)",border:"1px solid rgba(248,81,73,.16)",borderRadius:9,padding:"9px 12px",marginBottom:11,fontSize:11,color:"#f85149"}}>✕ {isAr?"فشل — تحقق من الإعدادات":"Failed — check configuration"}</div>}
                  <div style={{display:"flex",gap:7,justifyContent:"space-between",alignItems:"center"}}>
                    <a href={int.docs} target="_blank" rel="noopener noreferrer"
                      style={{fontSize:11,color:N.blue,textDecoration:"none"}}>📖 {isAr?"وثائق":"Docs ↗"}</a>
                    <div style={{display:"flex",gap:6}}>
                      {status==="connected"&&<Btn size="xs" variant="danger" onClick={()=>disconnect(int.id)}>{isAr?"قطع":"Disconnect"}</Btn>}
                      <Btn size="xs" variant="ghost" loading={testing===int.id} onClick={()=>test(int.id)} icon="🧪">{isAr?"اختبار":"Test"}</Btn>
                      <Btn size="xs" variant="primary" loading={saving} onClick={()=>save(int.id)} icon="💾">{isAr?"حفظ":"Save"}</Btn>
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

// ═══════════════════════════════════════════════════════════
// TAB 3: AI ALERTS
// ═══════════════════════════════════════════════════════════
function AlertsPanel({sessions=[],allUsers=[],isAr}){
  const[rules,setRules]=useState([
    {id:"r1",name:isAr?"تنبيه إنهاك مرتفع":"High Burnout Alert",condition:"burnout_risk > 70",action:"notify:slack,email",severity:"critical",enabled:true,triggered:3,lastTriggered:"2025-01-14 09:12"},
    {id:"r2",name:isAr?"تحذير وضعية منخفضة":"Low Posture Warning",condition:"avg_score < 50",action:"notify:in_app",severity:"warning",enabled:true,triggered:8,lastTriggered:"2025-01-13 15:44"},
    {id:"r3",name:isAr?"ملخص أسبوعي":"Weekly Digest",condition:"schedule:weekly",action:"digest:slack,email",severity:"info",enabled:true,triggered:12,lastTriggered:"2025-01-13 09:00"},
    {id:"r4",name:isAr?"كشف الشذوذ":"Anomaly Detection",condition:"z_score > 2",action:"notify:slack,jira",severity:"high",enabled:false,triggered:1,lastTriggered:"2025-01-10 11:30"},
  ]);
  const[aiText,setAiText]=useState("");
  const[aiLoad,setAiLoad]=useState(false);
  const SC={critical:N.red,high:N.amber,warning:"#fbbf24",info:N.blue};

  const generate=async()=>{
    setAiLoad(true);
    try{
      const sys="Generate 3 smart alert rules for Corvus PostureAI workforce health platform. Respond in JSON array format with: name, condition, action, severity, rationale. Language: "+(isAr?"Arabic":"English")+". Return only JSON, no markdown.";
      const t=await geminiAnalysis("Generate 3 alert rules for: avg posture "+Math.round(50+Math.random()*30)+"/100, "+sessions.length+" sessions, "+allUsers.length+" employees.",{lang:isAr?"ar":"en",systemPrompt:sys,maxTokens:500});
      setAiText(t);
    }catch(e){setAiText(isAr?"⚠️ خطأ في التوليد":"⚠️ Generation error");}
    setAiLoad(false);
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {/* AI Generator */}
      <div style={{background:"linear-gradient(135deg,rgba(167,139,250,.07),rgba(56,139,253,.05))",
        border:"1px solid rgba(167,139,250,.18)",borderRadius:16,padding:18}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:aiText||aiLoad?12:0}}>
          <div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:800,color:N.text}}>{isAr?"مولّد قواعد AI":"AI Rule Generator"}</div>
            <div style={{fontSize:11,color:N.muted,marginTop:2}}>{isAr?"Corvus AI يقترح قواعد تنبيه مخصصة":"Let AI suggest custom alert rules from your data"}</div>
          </div>
          <Btn size="sm" variant="primary" loading={aiLoad} onClick={generate} icon="🧠">{isAr?"توليد":"Generate"}</Btn>
        </div>
        {aiLoad&&<div style={{display:"flex",flexDirection:"column",gap:7}}>
          {[100,82,65].map((w,i)=><div key={i} style={{height:10,width:w+"%",borderRadius:5,background:"rgba(167,139,250,.1)",animation:"nhFade 1.2s ease "+i*.2+"s infinite"}}/>)}
        </div>}
        {aiText&&!aiLoad&&<div style={{background:"rgba(255,255,255,.03)",border:`1px solid ${N.border}`,borderRadius:10,padding:13,fontSize:12,color:N.text2,lineHeight:1.72,maxHeight:200,overflowY:"auto"}}>{aiText}</div>}
      </div>

      {/* Rules */}
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:11}}>
          <div style={{fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:800,color:N.text}}>{isAr?"قواعد التنبيه":"Alert Rules"}</div>
          <span style={{fontSize:11,color:N.muted}}>{rules.filter(r=>r.enabled).length}/{rules.length} {isAr?"مفعّل":"active"}</span>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:9}}>
          {rules.map((rule,i)=>(
            <div key={rule.id} style={{background:N.card,border:`1px solid ${rule.enabled?N.border:"rgba(110,118,129,.06)"}`,
              borderRadius:12,padding:"13px 15px",display:"flex",alignItems:"center",gap:13,
              opacity:rule.enabled?1:.5,transition:"opacity 200ms",animation:`nhFade 230ms ${i*55}ms both`}}>
              <div style={{width:9,height:9,borderRadius:"50%",background:SC[rule.severity]||N.muted,flexShrink:0,
                animation:rule.enabled&&rule.severity==="critical"?"nhPulse 1.8s ease-out infinite":"none"}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:4}}>
                  <span style={{fontFamily:"'Syne',sans-serif",fontSize:11,fontWeight:800,color:N.text}}>{rule.name}</span>
                  <Tag label={rule.severity.toUpperCase()} color={SC[rule.severity]}/>
                </div>
                <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
                  <div style={{fontSize:10,color:N.muted}}><span style={{color:N.text2}}>if </span><code style={{fontFamily:"monospace",fontSize:10,color:"#a78bfa"}}>{rule.condition}</code></div>
                  <div style={{fontSize:10,color:N.muted}}><span style={{color:N.text2}}>→ </span>{rule.action}</div>
                  <div style={{fontSize:10,color:N.muted}}>{isAr?"تفعّل":""} {rule.triggered}× · {rule.lastTriggered}</div>
                </div>
              </div>
              <div style={{display:"flex",gap:7,alignItems:"center",flexShrink:0}}>
                <Toggle value={rule.enabled} onChange={v=>setRules(p=>p.map(r=>r.id===rule.id?{...r,enabled:v}:r))}/>
                <Btn size="xs" variant="danger" onClick={()=>setRules(p=>p.filter(r=>r.id!==rule.id))}>✕</Btn>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB 4: IN-APP FEED
// ═══════════════════════════════════════════════════════════
function FeedPanel({profile,sessions=[],isAr}){
  const[notifs,setNotifs]=useState(()=>[
    {type:"burnout_alert",icon:"🔥",title:isAr?"تنبيه إنهاك وظيفي":"Burnout Risk Alert",body:isAr?"مؤشر الإرهاق وصل 72%":"Fatigue index at 72% — rest recommended",color:"#f85149",id:"n1",read:false,time:new Date(Date.now()-3600000).toISOString(),actions:[{label:"Take Break",key:"break"},{label:"View",key:"view"}]},
    {type:"achievement",icon:"🏆",title:isAr?"إنجاز جديد!":"New Achievement!",body:isAr?"7 أيام متتالية 🔥":"7-day streak 🔥 Keep it up!",color:"#3fb950",id:"n2",read:false,time:new Date(Date.now()-7200000).toISOString(),actions:[{label:"Share",key:"share"}]},
    {type:"ai_insight",icon:"🧠",title:isAr?"رؤية Corvus AI":"Corvus AI Insight",body:isAr?"وضعيتك تحسّنت 8% هذا الأسبوع":"Posture improved 8% this week — great work!",color:"#a78bfa",id:"n3",read:true,time:new Date(Date.now()-18000000).toISOString(),actions:[{label:"View",key:"view"}]},
    {type:"weekly_digest",icon:"📊",title:isAr?"ملخصك الأسبوعي":"Weekly Digest",body:isAr?"79/100 متوسط | 5 جلسات":"79/100 avg · 5 sessions · Best: Wednesday",color:"#388bfd",id:"n4",read:true,time:new Date(Date.now()-86400000).toISOString(),actions:[{label:"Full Report",key:"report"}]},
    {type:"posture_warning",icon:"⚠️",title:isAr?"تحذير وضعية":"Posture Warning",body:isAr?"درجتك انخفضت 12 نقطة اليوم":"Score dropped 12pts today — check your setup",color:"#d29922",id:"n5",read:true,time:new Date(Date.now()-172800000).toISOString(),actions:[{label:"Check Setup",key:"setup"}]},
  ]);
  const[search,setSearch]=useState("");
  const[filter,setFilter]=useState("all");
  const unread=notifs.filter(n=>!n.read).length;
  const markRead=id=>setNotifs(p=>p.map(n=>n.id===id?{...n,read:true}:n));
  const dismiss=id=>setNotifs(p=>p.filter(n=>n.id!==id));
  const markAll=()=>setNotifs(p=>p.map(n=>({...n,read:true})));
  const ago=iso=>{const d=(Date.now()-new Date(iso))/1000;return d<60?(isAr?"الآن":"now"):d<3600?(isAr?"منذ "+Math.round(d/60)+"د":Math.round(d/60)+"m"):d<86400?(isAr?"منذ "+Math.round(d/3600)+"س":Math.round(d/3600)+"h"):(isAr?"منذ "+Math.round(d/86400)+"ي":Math.round(d/86400)+"d");};
  const filtered=notifs.filter(n=>{
    if(filter==="unread"&&n.read)return false;
    if(search&&!JSON.stringify(n).toLowerCase().includes(search.toLowerCase()))return false;
    return true;
  });
  return(
    <div style={{display:"flex",flexDirection:"column",gap:13}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <div style={{fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:800,color:N.text}}>{isAr?"الإشعارات":"Notifications"}</div>
          {unread>0&&<span style={{background:N.red,borderRadius:99,padding:"2px 8px",fontSize:10,fontWeight:800,color:"#fff"}}>{unread}</span>}
        </div>
        <div style={{display:"flex",gap:7}}>
          {["all","unread"].map(f=>(
            <button key={f} onClick={()=>setFilter(f)} style={{padding:"4px 12px",borderRadius:99,cursor:"pointer",fontSize:11,fontWeight:700,
              background:filter===f?"rgba(56,139,253,.12)":"transparent",
              border:`1px solid ${filter===f?"rgba(56,139,253,.32)":N.border}`,
              color:filter===f?N.blue:N.muted,transition:"all 150ms"}}>
              {f==="all"?(isAr?"الكل":"All"):(isAr?"غير مقروء":"Unread")}
            </button>
          ))}
          <Btn size="sm" variant="ghost" onClick={markAll}>{isAr?"تحديد الكل":"Mark all read"}</Btn>
        </div>
      </div>
      <div style={{position:"relative"}}>
        <span style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",fontSize:13,color:N.muted,pointerEvents:"none"}}>🔍</span>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder={isAr?"بحث...":"Search notifications..."}
          style={{width:"100%",padding:"9px 12px 9px 34px",background:N.surf,border:`1px solid ${N.border}`,borderRadius:10,color:N.text,fontSize:12,outline:"none",boxSizing:"border-box"}}/>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:3}}>
        {filtered.map((n,i)=>(
          <div key={n.id} onClick={()=>markRead(n.id)} style={{
            background:n.read?N.card:`${n.color}09`,
            border:`1px solid ${n.read?N.border:`${n.color}22`}`,
            borderRadius:12,padding:"13px 15px",
            display:"flex",gap:11,alignItems:"flex-start",
            cursor:"pointer",transition:"all 200ms",
            animation:`nhFade 180ms ${i*35}ms both`,
            position:"relative",overflow:"hidden",
          }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=n.color+"35";e.currentTarget.style.background=n.read?N.surf:`${n.color}12`;}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=n.read?N.border:`${n.color}22`;e.currentTarget.style.background=n.read?N.card:`${n.color}09`;}}>
            {!n.read&&<div style={{position:"absolute",left:0,top:0,bottom:0,width:2.5,background:n.color,borderRadius:"0 2px 2px 0"}}/>}
            <div style={{width:38,height:38,borderRadius:10,background:`${n.color}14`,border:`1px solid ${n.color}22`,
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{n.icon}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:3}}>
                <span style={{fontFamily:"'Syne',sans-serif",fontSize:11,fontWeight:800,color:n.read?N.text2:N.text}}>{n.title}</span>
                <div style={{display:"flex",gap:5,alignItems:"center",flexShrink:0}}>
                  <span style={{fontSize:10,color:N.muted,whiteSpace:"nowrap"}}>{ago(n.time)}</span>
                  {!n.read&&<div style={{width:7,height:7,borderRadius:"50%",background:n.color}}/>}
                  <button onClick={e=>{e.stopPropagation();dismiss(n.id);}} style={{background:"none",border:"none",color:N.muted,cursor:"pointer",fontSize:12,padding:"0 2px",lineHeight:1}}>✕</button>
                </div>
              </div>
              <div style={{fontSize:12,color:n.read?N.muted:N.text2,lineHeight:1.55,marginBottom:7}}>{n.body}</div>
              <div style={{display:"flex",gap:5}}>
                {n.actions.map(a=>(
                  <button key={a.key} onClick={e=>{e.stopPropagation();markRead(n.id);}} style={{
                    fontSize:10,padding:"3px 10px",borderRadius:6,cursor:"pointer",fontWeight:700,
                    background:`${n.color}12`,border:`1px solid ${n.color}25`,color:n.color,transition:"all 150ms",
                  }}>{a.label}</button>
                ))}
              </div>
            </div>
          </div>
        ))}
        {filtered.length===0&&(
          <div style={{padding:"48px 24px",textAlign:"center",fontSize:13,color:N.muted}}>
            {isAr?"🎉 لا توجد إشعارات جديدة":"🎉 You're all caught up!"}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════
export function NotificationsHub({orgId,profile,sessions=[],allUsers=[],cs,lang="en",onClose}){
  const[tab,setTab]=useState("feed");
  const isAr=lang==="ar";

  const TABS=[
    {id:"feed",      icon:"🔔",en:"Notifications", ar:"الإشعارات"},
    {id:"queue",     icon:"📬",en:"Queue",          ar:"الطابور"},
    {id:"integrations",icon:"🔌",en:"Integrations", ar:"التكاملات"},
    {id:"alerts",    icon:"🤖",en:"AI Alerts",      ar:"تنبيهات AI"},
  ];

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(4,8,20,.92)",backdropFilter:"blur(12px)",
      WebkitBackdropFilter:"blur(12px)",zIndex:9200,display:"flex",alignItems:"center",
      justifyContent:"center",padding:16,animation:"nhBIn .18s ease both"}}>
      <div dir={isAr?"rtl":"ltr"} style={{
        background:N.bg,border:`0.5px solid ${N.borderH}`,
        borderRadius:22,width:"min(1000px,97vw)",height:"min(860px,96vh)",
        display:"flex",flexDirection:"column",overflow:"hidden",
        boxShadow:"0 32px 96px rgba(0,0,0,.7)",
        animation:"nhSUp 320ms "+N.spring+" both",
      }}>

        {/* Header */}
        <div style={{padding:"16px 22px",borderBottom:`0.5px solid ${N.border}`,flexShrink:0,
          background:"linear-gradient(135deg,rgba(56,139,253,.06),rgba(6,182,212,.03))"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:11}}>
              <div style={{width:40,height:40,borderRadius:12,
                background:"linear-gradient(135deg,#388bfd,#06b6d4)",
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:19,boxShadow:"0 4px 16px rgba(56,139,253,.4)"}}>🔔</div>
              <div>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:800,color:N.text,letterSpacing:"-.02em"}}>
                  {isAr?"مركز الإشعارات والتكاملات":"Notifications & Integrations Hub"}
                </div>
                <div style={{fontSize:10,color:N.teal,fontWeight:600,marginTop:2}}>
                  {isAr?"طابور ذكي · Slack · Teams · Jira · إشعارات حقيقية":"Smart queue · Real dispatch · Slack · Teams · Jira"}
                </div>
              </div>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <div style={{display:"flex",alignItems:"center",gap:6,background:"rgba(63,185,80,.08)",border:"1px solid rgba(63,185,80,.18)",borderRadius:99,padding:"5px 12px"}}>
                <Dot status="connected"/>
                <span style={{fontSize:10,fontWeight:700,color:N.green}}>{globalQueue.pending.length} {isAr?"في الطابور":"in queue"}</span>
              </div>
              <button onClick={onClose} style={{width:30,height:30,borderRadius:8,background:"rgba(255,255,255,.05)",
                border:`0.5px solid ${N.border}`,color:N.muted,cursor:"pointer",fontSize:14,
                display:"flex",alignItems:"center",justifyContent:"center"}} aria-label="Close">✕</button>
            </div>
          </div>

          {/* Integration status pills */}
          <div style={{display:"flex",gap:7,marginTop:13,flexWrap:"wrap"}}>
            {Object.values(INTEGRATIONS).map(int=>(
              <div key={int.id} style={{display:"flex",alignItems:"center",gap:5,
                background:"rgba(255,255,255,.04)",border:`0.5px solid ${N.border}`,
                borderRadius:99,padding:"3px 11px"}}>
                <span style={{fontSize:12}}>{int.icon}</span>
                <span style={{fontSize:10,fontWeight:600,color:N.muted}}>{int.name}</span>
                <Dot status="disconnected"/>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{display:"flex",borderBottom:`0.5px solid ${N.border}`,flexShrink:0,overflowX:"auto"}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              flex:1,padding:"12px 8px",background:"none",border:"none",
              borderBottom:`2px solid ${tab===t.id?"#388bfd":"transparent"}`,
              color:tab===t.id?"#79c0ff":N.muted,
              fontSize:11,fontWeight:700,cursor:"pointer",
              display:"flex",flexDirection:"column",alignItems:"center",gap:3,
              transition:"color 150ms",minWidth:90,whiteSpace:"nowrap",
            }}>
              <span style={{fontSize:16}}>{t.icon}</span>
              <span>{isAr?t.ar:t.en}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{flex:1,overflowY:"auto",padding:20}}>
          {tab==="feed"         &&<FeedPanel         profile={profile} sessions={sessions} isAr={isAr}/>}
          {tab==="queue"        &&<QueuePanel         isAr={isAr}/>}
          {tab==="integrations" &&<IntegrationsPanel  orgId={orgId} profile={profile} isAr={isAr}/>}
          {tab==="alerts"       &&<AlertsPanel        sessions={sessions} allUsers={allUsers} isAr={isAr}/>}
        </div>
      </div>

      <style>{`
        @keyframes nhSUp{from{opacity:0;transform:translateY(18px) scale(.97)}to{opacity:1;transform:none}}
        @keyframes nhBIn{from{opacity:0}to{opacity:1}}
        @keyframes nhFade{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
        @keyframes nhPulse{0%{transform:scale(1);opacity:.8}100%{transform:scale(3.2);opacity:0}}
        @keyframes nhSpin{to{transform:rotate(360deg)}}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:rgba(56,139,253,.18);border-radius:99px}
        ::-webkit-scrollbar-track{background:transparent}
      `}</style>
    </div>
  );
}

export function useNotifications(){
  const push=useCallback((type,payload,channels=["in_app"])=>{
    globalQueue.enqueue(mkEntry(type,payload,channels));
  },[]);
  return{push,queue:globalQueue};
}
