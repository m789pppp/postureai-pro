import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { geminiChat, buildCoachContext, friendlyError } from "./gemini.js";
import { getLocalAIStatus, onLocalAIStatus, localChatStream, abortCurrentStream } from "./localAI.js";
import { qualityFor } from "./lib/tierQuality.js";

// ── Tokens ────────────────────────────────────────────────────────
const T = {
  bg:      "#060d1a",
  surf:    "#0b1525",
  card:    "#0f1c2e",
  border:  "rgba(56,139,253,.1)",
  borderH: "rgba(56,139,253,.25)",
  text:    "#e6edf3",
  muted:   "#8b949e",
  subtle:  "#6e7681",
  blue:    "#388bfd",
  cyan:    "#39d353",
  teal:    "#06b6d4",
  green:   "#3fb950",
  red:     "#f85149",
  amber:   "#d29922",
  userBg:  "linear-gradient(135deg,#1158c7,#0e7490)",
  aiBg:    "rgba(13,17,23,.9)",
  spring:  "cubic-bezier(.16,1,.3,1)",
};

// ── Markdown renderer ─────────────────────────────────────────────
function renderMd(raw) {
  if (!raw) return "";
  let t = raw.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const lines = t.split("\n");
  const out = [];
  for (const l of lines) {
    if (/^## (.+)$/.test(l))
      out.push(`<div style="font-size:13px;font-weight:700;color:#79c0ff;margin:14px 0 5px;letter-spacing:-.01em;border-bottom:0.5px solid rgba(56,139,253,.15);padding-bottom:5px">${l.replace(/^## /,"")}</div>`);
    else if (/^### (.+)$/.test(l))
      out.push(`<div style="font-size:12px;font-weight:700;color:#58a6ff;margin:10px 0 3px">${l.replace(/^### /,"")}</div>`);
    else if (/^\d+\. (.+)$/.test(l)) {
      const [,num,rest] = l.match(/^(\d+)\. (.+)$/);
      out.push(`<div style="display:flex;gap:9px;margin:4px 0;align-items:baseline"><span style="color:#388bfd;font-weight:700;font-size:11px;min-width:14px;flex-shrink:0;font-variant-numeric:tabular-nums">${num}.</span><span style="font-size:13px">${inl(rest)}</span></div>`);
    }
    else if (/^[-•▸] (.+)$/.test(l)) {
      out.push(`<div style="display:flex;gap:8px;margin:3px 0;align-items:baseline"><span style="color:#39d353;font-size:9px;flex-shrink:0;margin-top:4px">●</span><span style="font-size:13px">${inl(l.replace(/^[-•▸] /,""))}</span></div>`);
    }
    else if (l.startsWith("⚕️") || l.startsWith("⚠️"))
      out.push(`<div style="background:rgba(248,81,73,.07);border:0.5px solid rgba(248,81,73,.2);border-radius:8px;padding:8px 11px;margin:9px 0;font-size:12.5px;line-height:1.6">${inl(l)}</div>`);
    else if (l.trim() === "")
      out.push(`<div style="height:6px"></div>`);
    else
      out.push(`<span style="font-size:13px">${inl(l)}</span><br/>`);
  }
  return out.join("");
}

function inl(t) {
  return t
    .replace(/\*\*(.+?)\*\*/g,"<strong style='color:#e6edf3;font-weight:600'>$1</strong>")
    .replace(/\*(.+?)\*/g,"<em style='color:#8b949e'>$1</em>")
    .replace(/`(.+?)`/g,"<code style='background:rgba(56,139,253,.12);padding:1px 5px;border-radius:4px;font-size:.88em;font-family:\"SF Mono\",monospace;color:#79c0ff'>$1</code>");
}

function MdText({ text }) {
  return (
    <div style={{ lineHeight:1.74,fontFamily:"'DM Sans',system-ui,sans-serif",fontSize:13,letterSpacing:"-.01em",color:T.text }}
      dangerouslySetInnerHTML={{ __html: renderMd(text) }}/>
  );
}

// ── Typing dots ───────────────────────────────────────────────────
function TypingDots() {
  return (
    <div style={{ display:"flex",gap:5,alignItems:"center",padding:"10px 14px" }}>
      {[0,1,2].map(i=>(
        <div key={i} style={{ width:6,height:6,borderRadius:"50%",background:T.teal,
          animation:`cDot 1.3s ease-in-out ${i*.15}s infinite` }}/>
      ))}
      <style>{`@keyframes cDot{0%,60%,100%{transform:translateY(0);opacity:.25}30%{transform:translateY(-5px);opacity:1}}`}</style>
    </div>
  );
}

// ── Copy button ───────────────────────────────────────────────────
function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).catch(()=>{});
    setCopied(true);
    setTimeout(()=>setCopied(false),2000);
  };
  return (
    <button onClick={copy} title="Copy" style={{
      background:"none",border:"none",cursor:"pointer",padding:"2px 6px",
      fontSize:11,color:copied?T.green:T.subtle,transition:"color .15s",
      borderRadius:4,
    }}>{copied?"✓":"⎘"}</button>
  );
}

// ── Message bubble ────────────────────────────────────────────────
function Bubble({ msg, isAr, index, onReact, onRegenerate }) {
  const isUser = msg.role === "user";
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={()=>setHovered(true)}
      onMouseLeave={()=>setHovered(false)}
      style={{ display:"flex",gap:10,alignItems:"flex-start",
        flexDirection: isUser?(isAr?"row":"row-reverse"):"row",
        animation:`msgIn .26s ${T.spring} both`,
        animationDelay:`${Math.min(index*.04,.2)}s`,
        position:"relative",
      }}>
      <style>{`@keyframes msgIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Avatar */}
      <div style={{
        width:28,height:28,borderRadius:"50%",flexShrink:0,
        display:"flex",alignItems:"center",justifyContent:"center",
        fontSize:12,fontWeight:700,color:"#fff",
        background: isUser ? T.userBg : "linear-gradient(135deg,#1a2d4a,#0a3a5c)",
        border: isUser?"none":`1px solid ${T.borderH}`,
        boxShadow: isUser?"0 2px 8px rgba(17,88,199,.35)":"0 2px 8px rgba(6,182,212,.1)",
        userSelect:"none",flexShrink:0,marginTop:2,
      }}>
        {isUser?"M":"✦"}
      </div>

      {/* Bubble + actions */}
      <div style={{ maxWidth:"77%",display:"flex",flexDirection:"column",gap:4,
        alignItems: isUser?(isAr?"flex-start":"flex-end"):"flex-start" }}>
        <div style={{
          background: isUser ? T.userBg : T.aiBg,
          border: isUser?"none":`0.5px solid ${T.borderH}`,
          borderRadius: isUser
            ? (isAr?"16px 4px 16px 16px":"4px 16px 16px 16px")
            : (isAr?"4px 16px 16px 16px":"16px 4px 16px 16px"),
          padding:"10px 14px",color:T.text,
          boxShadow: isUser
            ? "0 4px 16px rgba(17,88,199,.22)"
            : "0 2px 12px rgba(0,0,0,.3)",
          backdropFilter:isUser?"none":"blur(10px)",
          WebkitBackdropFilter:isUser?"none":"blur(10px)",
        }}>
          {/* Shimmer while waiting */}
          {msg.streaming && !msg.content && (
            <div style={{ display:"flex",flexDirection:"column",gap:7,minWidth:160 }}>
              {[65,85,45].map((w,i)=>(
                <div key={i} style={{
                  height:11,width:`${w}%`,borderRadius:5,
                  background:"linear-gradient(90deg,rgba(56,139,253,.06) 0%,rgba(56,139,253,.16) 50%,rgba(56,139,253,.06) 100%)",
                  backgroundSize:"200% 100%",
                  animation:`shimmer 1.5s ease ${i*.15}s infinite`,
                }}/>
              ))}
              <style>{`@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}`}</style>
            </div>
          )}
          {isUser
            ? <div style={{ fontSize:13,lineHeight:1.6,whiteSpace:"pre-wrap" }}>{msg.content}</div>
            : msg.content && <MdText text={msg.content}/>
          }
          {/* Streaming cursor */}
          {msg.streaming && msg.content && (
            <span style={{ display:"inline-block",width:2,height:"1em",background:T.teal,
              marginLeft:2,verticalAlign:"text-bottom",animation:"blink .6s step-end infinite" }}/>
          )}
          <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}`}</style>
          {/* Timestamp */}
          <div style={{ fontSize:9,marginTop:5,opacity:.38,
            textAlign:isAr?"left":"right",
            color:isUser?"rgba(255,255,255,.6)":T.subtle }}>
            {new Date(msg.ts).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}
          </div>
        </div>

        {/* Action bar — shows on hover for AI messages */}
        {!isUser && !msg.streaming && msg.content && (
          <div style={{
            display:"flex",gap:2,alignItems:"center",
            opacity:hovered?1:0,transition:"opacity .15s",
            padding:"1px 2px",
          }}>
            <CopyBtn text={msg.content}/>
            <button onClick={()=>onReact?.(msg.ts,"👍")} title="Helpful" style={{
              background:"none",border:"none",cursor:"pointer",padding:"2px 5px",
              fontSize:11,color:msg.react==="👍"?T.green:T.subtle,
              transition:"color .15s",borderRadius:4,
            }}>👍</button>
            <button onClick={()=>onReact?.(msg.ts,"👎")} title="Not helpful" style={{
              background:"none",border:"none",cursor:"pointer",padding:"2px 5px",
              fontSize:11,color:msg.react==="👎"?T.red:T.subtle,
              transition:"color .15s",borderRadius:4,
            }}>👎</button>
            <button onClick={()=>onRegenerate?.()} title="Regenerate" style={{
              background:"none",border:"none",cursor:"pointer",padding:"2px 5px",
              fontSize:11,color:T.subtle,transition:"color .15s",borderRadius:4,
            }}>↺</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Quick suggestions ─────────────────────────────────────────────
const SUGGESTIONS = {
  en: [
    { label:"Why does my neck hurt?",       icon:"🦴" },
    { label:"5-min stretch routine",         icon:"🧘" },
    { label:"What's my biggest issue?",      icon:"🎯" },
    { label:"Best monitor height for me?",   icon:"🖥️" },
    { label:"How to improve my score?",      icon:"📈" },
    { label:"When is my posture worst?",     icon:"⏰" },
  ],
  ar: [
    { label:"ليه بتألمني رقبتي؟",    icon:"🦴" },
    { label:"روتين إطالة ٥ دقايق",    icon:"🧘" },
    { label:"إيه أكبر مشكلة عندي؟",   icon:"🎯" },
    { label:"إزاي أحسّن درجتي؟",      icon:"📈" },
  ],
};

// ── System prompt builder ─────────────────────────────────────────
function buildSystemPrompt(ctx, isAr) {
  const sc = ctx.avg_score>=85?"Excellent":ctx.avg_score>=70?"Good":ctx.avg_score>=55?"Fair":"Needs Attention";
  const nr = ctx.neck_risk||0;
  const fa = ctx.fatigue_score||0;
  const bu = ctx.burnout_risk||0;
  const tr = ctx.trend_pct||0;
  const wa = ctx.week_avg||ctx.avg_score;
  const al = (ctx.top_alerts||[]).slice(0,5).join("; ")||"None recorded";
  const nm = ctx.user_name||"Patient";

  if (isAr) return `أنت دكتور كورفوس — فيزيوثيرابيست سريري وخبير إرجونوميكس داخل Corvus PostureAI Pro. خبرة 15 سنة في الجهاز العضلي الهيكلي.

## بيانات ${nm} السريرية:
- درجة الوضعية: **${ctx.avg_score}/100** (${sc}) | هذا الأسبوع: ${wa}/100 (${tr>0?"+":""}${tr}%)
- خطر الرقبة: **${nr}%** — ${nr>=70?"🔴 مرتفع":nr>=40?"🟡 متوسط":"🟢 منخفض"}
- مؤشر الإجهاد: ${fa}% | خطر الإرهاق: ${bu}%
- الجلسات: ${ctx.sessions_count} إجمالي | ${ctx.week_sessions} هذا الأسبوع | سلسلة ${ctx.streak_days||0} يوم
- المعايرة: ${ctx.has_calibration?"دقة شخصية ✅":"عامة ⚠️ — دقة أقل 15-20%"}
- تنبيهات متكررة: ${al}

## القاعدة السريرية:
**هانسراج 2014 — حمل الرقبة:** 0°=4.5كجم، 15°=12كجم، 30°=18كجم، 45°=22كجم، 60°=27كجم
**ناشيمسون — ضغط الأقراص:** جلوس مستقيم=100%، انحناء=185%، ميل أمامي=220%

## بروتوكول الرد:
- **ألم:** قيّم (مكان، طبيعة، انتشار، محسّنات/مسيئات) → اشرح البنية التشريحية
- **تمارين:** وصف دقيق (sets×reps، مدة الثبات، تكرار يومي، العضلة المستهدفة، أسابيع متوقعة)
- **أرقام:** فسّر سريرياً (ماذا يعني للحمل العضلي، أي بنى في خطر)
- ⚕️ علامات الخطر: ألم متشع / تنميل / ضعف أحادي → "راجع فيزيوثيرابيست"
- ابدأ مباشرة — بدون "سؤال ممتاز" أو "بالطبع"
- 150-220 كلمة محادثة | حتى 400 للخطط الكاملة
اللغة: عامية مصرية. مصطلحات طبية مع شرح.`;

  return `You are Dr. Corvus — clinical physiotherapist & ergonomics specialist in Corvus PostureAI Pro. 15 years MSK experience.

## PATIENT DATA: ${nm}
| Metric | Value | Status |
|--------|-------|--------|
| Posture | ${ctx.avg_score}/100 | ${sc} |
| This week | ${wa}/100 | ${tr>0?"+":""}${tr}% trend |
| Cervical risk | ${nr}% | ${nr>=70?"🔴 HIGH":nr>=40?"🟡 MODERATE":"🟢 LOW"} |
| Fatigue | ${fa}% | ${fa>=70?"HIGH":fa>=45?"MODERATE":"Normal"} |
| Burnout risk | ${bu}% | ${bu>=70?"HIGH":bu>=45?"MODERATE":"Low"} |
| Sessions | ${ctx.sessions_count} total | ${ctx.week_sessions}/wk | ${ctx.streak_days||0}-day streak |
| Calibration | ${ctx.has_calibration?"Personalized ✅":"Generic ⚠️ (-15% accuracy)"} |
| Top issues | ${al} |

## CLINICAL REFS
**Hansraj 2014 cervical load:** 0°=4.5kg → 15°=12kg → 30°=18kg → 45°=22kg → 60°=27kg
Est. flexion for ${nm}: ~${nr>=70?"35-45°":nr>=40?"20-30°":"<15°"}
**Nachemson disc pressure:** upright=100% → slouch=185% → forward lean=220%

## PROTOCOL
- PAIN → assess (location, character, radiation, provocateurs) + explain structure
- EXERCISE → precise Rx: name, sets×reps, hold time, frequency, muscle target, weeks to improve
- DATA → clinical interpretation: MSK load meaning, structures at risk
- PLAN → weekly protocol with progressions
- ⚕️ Red flags (radiation/numbness/unilateral weakness) → advise in-person physio
- No "Great question!" openings. Start with the answer.
- 220w max conversation | 400w max for full plans.`;
}

// ── Main component ────────────────────────────────────────────────
export function AICoach({ profile, sessions=[], calibration, cs, lang="en", effectiveTier, onClose }) {
  const isAr = lang==="ar";
  const dir  = isAr?"rtl":"ltr";

  const [messages,  setMessages]  = useState([]);
  const [input,     setInput]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [msgCount,  setMsgCount]  = useState(0);
  const [lastUserMsg, setLastUserMsg] = useState("");
  const messagesRef = useRef([]);
  useEffect(()=>{ messagesRef.current=messages; },[messages]);

  const _tier    = effectiveTier||profile?.tier||"standard";
  const quality  = qualityFor(_tier);
  const coachLimit = quality.aiCoach?.monthlyLimit ?? 5;
  const limitReached = coachLimit!==-1 && msgCount>=coachLimit;

  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  // Load monthly count
  useEffect(()=>{
    try {
      const uid = profile?.uid||"";
      if (!uid) return;
      const key = "corvus_coach_count_"+uid+"_"+new Date().toISOString().slice(0,7);
      setMsgCount(parseInt(localStorage.getItem(key)||"0",10));
    } catch {}
  },[profile]);

  // Build context
  const context = useMemo(()=>{
    const avg = arr=>arr.length?Math.round(arr.reduce((a,b)=>a+b,0)/arr.length):0;
    const scores = (sessions||[]).map(s=>s.avg_score||0).filter(Boolean);
    const now = Date.now();
    const thisWk = (sessions||[]).filter(s=>{
      const d=s.created_at?.toDate?s.created_at.toDate():new Date(s.created_at||0);
      return now-d<7*864e5;
    });
    const lastWk = (sessions||[]).filter(s=>{
      const d=s.created_at?.toDate?s.created_at.toDate():new Date(s.created_at||0);
      const ms=now-d; return ms>=7*864e5&&ms<14*864e5;
    });
    const wAvg=avg(thisWk.map(s=>s.avg_score||0));
    const lAvg=avg(lastWk.map(s=>s.avg_score||0));
    const trendPct=lAvg>0?Math.round(((wAvg-lAvg)/lAvg)*100):0;
    const ac={};
    (sessions||[]).slice(0,20).forEach(s=>{
      (s.alerts||[]).forEach(a=>{
        const k=typeof a==="string"?a:(a?.label||a?.type||"");
        if(k) ac[k]=(ac[k]||0)+1;
      });
    });
    const topAlerts=Object.entries(ac).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k])=>k);
    const avgScore=avg(scores);
    const fatigue=Math.min(100,Math.max(0,Math.round((100-wAvg)*.6+(sessions?.length<5?30:10))));
    const neck=Math.min(100,Math.round(100-avgScore+(avgScore<60?20:0)));
    const burnout=Math.min(100,Math.round(fatigue*.8+(thisWk.length>5?15:0)));
    return {
      avg_score:avgScore,week_avg:wAvg,last_week_avg:lAvg,trend_pct:trendPct,
      sessions_count:sessions?.length||0,week_sessions:thisWk.length,
      has_calibration:!!calibration,tier:_tier,neck_risk:neck,
      fatigue_score:fatigue,burnout_risk:burnout,streak_days:profile?.streak_days||0,
      user_name:profile?.name?.split(" ")[0]||"",top_alerts:topAlerts,
    };
  },[sessions,calibration,_tier]);

  // Welcome message
  useEffect(()=>{
    const name=profile?.name?.split(" ")[0]||(isAr?"":"there");
    const s=context.avg_score;
    const sl=s>=85?"excellent 🌟":s>=70?"good 💪":s>=55?"fair — room to improve":"needs attention ⚠️";
    const content=isAr
      ?`أهلاً ${name}! 👋 أنا **Dr. Corvus** — فيزيوثيرابيست ذكاء اصطناعي متخصص في الجهاز العضلي الهيكلي.\n\nدرجتك دلوقتي **${s}/100** من **${context.sessions_count}** جلسة. اسألني أي حاجة عن وضعيتك، ألمك، أو إعداد مكان شغلك.`
      :`Hey${name?" "+name:""}! 👋 I'm **Dr. Corvus**, your AI physiotherapy specialist.\n\nCurrent posture score: **${s}/100** — ${sl}\nBased on **${context.sessions_count} sessions**.\n\nAsk me anything about your posture, pain, or workspace.`;
    setMessages([{role:"assistant",content,ts:Date.now()}]);
  },[]);

  // Auto-scroll
  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[messages,loading]);

  // Send
  const sendMessage = useCallback(async(text)=>{
    const content=(text||input).trim();
    if (!content||loading) return;
    setInput("");
    setError("");
    setLastUserMsg(content);

    setMessages(prev=>[...prev,{role:"user",content,ts:Date.now()}]);
    setLoading(true);

    abortCurrentStream();

    const streamingId=Date.now();
    setMessages(prev=>[...prev,{role:"assistant",content:"",ts:streamingId,streaming:true}]);

    const systemPrompt=buildSystemPrompt(context,isAr);

    try {
      const history=messagesRef.current
        .filter(m=>m.content&&!m.streaming)
        .slice(-8)
        .map(m=>({role:m.role,content:m.content}));
      const allMsgs=[...history,{role:"user",content}];

      try {
        await localChatStream(allMsgs,systemPrompt,Math.min(quality.max_tokens||500,500),(partial)=>{
          setMessages(prev=>prev.map(m=>m.ts===streamingId?{...m,content:partial}:m));
        });
        setMessages(prev=>prev.map(m=>m.ts===streamingId?{...m,streaming:false}:m));
        try {
          const uid=profile?.uid||"";
          if (uid) {
            const key="corvus_coach_count_"+uid+"_"+new Date().toISOString().slice(0,7);
            const n=msgCount+1;
            localStorage.setItem(key,String(n));
            setMsgCount(n);
          }
        } catch {}
      } catch(se) {
        console.warn("[CorvusAI] Stream fail, non-stream fallback:",se.message);
        const reply=await geminiChat(allMsgs,{systemPrompt,lang,maxTokens:Math.min(quality.max_tokens||500,500)});
        setMessages(prev=>prev.map(m=>m.ts===streamingId?{...m,content:reply,streaming:false}:m));
      }
    } catch(e) {
      setMessages(prev=>prev.filter(m=>m.ts!==streamingId||m.content));
      setError(friendlyError(e,lang));
    } finally {
      setLoading(false);
      setTimeout(()=>inputRef.current?.focus(),80);
    }
  },[input,loading,context,isAr,quality,lang,msgCount]);

  // Regenerate last response
  const handleRegenerate = useCallback(()=>{
    if (!lastUserMsg||loading) return;
    setMessages(prev=>prev.slice(0,-1));
    sendMessage(lastUserMsg);
  },[lastUserMsg,loading,sendMessage]);

  // React to message
  const handleReact = useCallback((ts,reaction)=>{
    setMessages(prev=>prev.map(m=>m.ts===ts?{...m,react:m.react===reaction?null:reaction}:m));
  },[]);

  const handleKey=e=>{
    if (e.key==="Enter"&&!e.shiftKey){e.preventDefault();if(!limitReached)sendMessage();}
  };

  const suggs=(SUGGESTIONS[lang]||SUGGESTIONS.en);
  const showSuggs=messages.length<=1&&!loading;

  return (
    <div style={{
      position:"fixed",inset:0,zIndex:9999,
      display:"flex",alignItems:"center",justifyContent:"center",
      background:"rgba(4,8,20,.8)",backdropFilter:"blur(14px)",
      WebkitBackdropFilter:"blur(14px)",padding:16,
      animation:"bIn .18s ease both",
    }}>
      <style>{`
        @keyframes bIn{from{opacity:0}to{opacity:1}}
        @keyframes sUp{from{opacity:0;transform:translateY(18px) scale(.97)}to{opacity:1;transform:none}}
        .cInput{transition:border-color .15s,box-shadow .15s!important}
        .cInput:focus{border-color:rgba(56,139,253,.5)!important;box-shadow:0 0 0 3px rgba(56,139,253,.1)!important}
        .cSend:hover:not(:disabled){background:#2563eb!important;transform:translateY(-1px);box-shadow:0 4px 14px rgba(37,99,235,.4)!important}
        .cChip:hover{background:rgba(56,139,253,.14)!important;border-color:rgba(56,139,253,.32)!important;transform:translateY(-1px)}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:rgba(56,139,253,.18);border-radius:99px}
        ::-webkit-scrollbar-track{background:transparent}
      `}</style>

      <div dir={dir} style={{
        width:"100%",maxWidth:640,height:"min(700px,92vh)",
        background:T.bg,
        border:`0.5px solid ${T.borderH}`,
        borderRadius:22,
        display:"flex",flexDirection:"column",overflow:"hidden",
        boxShadow:"0 32px 96px rgba(0,0,0,.7),0 0 0 0.5px rgba(56,139,253,.06) inset",
        animation:"sUp .3s "+T.spring+" both",
      }}>

        {/* ── Header ─────────────────────────────────────── */}
        <div style={{
          padding:"13px 18px",flexShrink:0,
          background:"linear-gradient(135deg,rgba(17,88,199,.1),rgba(6,182,212,.05))",
          borderBottom:`0.5px solid ${T.border}`,
          display:"flex",alignItems:"center",gap:11,
        }}>
          <div style={{
            width:40,height:40,borderRadius:12,flexShrink:0,
            background:"linear-gradient(135deg,#1158c7,#0891b2)",
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:19,boxShadow:"0 4px 14px rgba(17,88,199,.45)",
          }}>🤖</div>

          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:14,fontWeight:700,color:T.text,letterSpacing:"-.02em",lineHeight:1.2}}>
              Dr. Corvus
            </div>
            <div style={{fontSize:10,color:T.teal,display:"flex",alignItems:"center",gap:5,marginTop:2}}>
              <span style={{
                width:5,height:5,borderRadius:"50%",background:T.green,display:"inline-block",
                boxShadow:"0 0 8px "+T.green,animation:"gpulse 2.2s ease infinite",
              }}/>
              <style>{`@keyframes gpulse{0%,100%{opacity:1}50%{opacity:.35}}`}</style>
              {isAr?"أخصائي وضعية الجسم الذكي":"AI Physiotherapy Specialist"}
            </div>
          </div>

          {/* Context pills */}
          <div style={{display:"flex",gap:5,flexShrink:0,flexWrap:"wrap",justifyContent:"flex-end"}}>
            {[
              {label:`${context.avg_score}/100`,color:context.avg_score>=70?T.green:context.avg_score>=55?T.amber:T.red},
              {label:`${context.neck_risk}% ${isAr?"رقبة":"neck"}`,color:context.neck_risk>=70?T.red:context.neck_risk>=40?T.amber:T.green},
              {label:`${context.sessions_count} ${isAr?"جلسة":"sessions"}`,color:T.subtle},
            ].map(p=>(
              <div key={p.label} style={{
                fontSize:9.5,color:p.color,background:`${p.color}12`,
                border:`0.5px solid ${p.color}30`,borderRadius:6,
                padding:"3px 8px",whiteSpace:"nowrap",fontWeight:600,
              }}>{p.label}</div>
            ))}
            <div style={{
              fontSize:9.5,borderRadius:6,padding:"3px 8px",whiteSpace:"nowrap",fontWeight:600,
              background:limitReached?"rgba(248,81,73,.15)":"rgba(255,255,255,.04)",
              border:`0.5px solid ${limitReached?"rgba(248,81,73,.4)":T.border}`,
              color:limitReached?"#f85149":T.subtle,
            }}>
              {coachLimit===-1?(isAr?"∞ رسائل":"∞ msgs")
                :limitReached?(isAr?"انتهى الحد":"Limit reached")
                :(isAr?`${coachLimit-msgCount} متبقي`:`${coachLimit-msgCount} left`)}
            </div>
          </div>

          <button onClick={onClose} style={{
            width:28,height:28,borderRadius:8,border:`0.5px solid ${T.border}`,
            background:"rgba(255,255,255,.04)",color:T.muted,cursor:"pointer",
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,
            flexShrink:0,transition:"all .15s",
          }} aria-label="Close">✕</button>
        </div>

        {/* ── Messages ────────────────────────────────────── */}
        <div style={{
          flex:1,overflowY:"auto",padding:"18px 18px 10px",
          display:"flex",flexDirection:"column",gap:14,
        }}>
          {messages.map((msg,i)=>(
            <Bubble key={msg.ts+i} msg={msg} isAr={isAr} index={i}
              onReact={handleReact}
              onRegenerate={i===messages.length-1?handleRegenerate:undefined}
            />
          ))}

          {/* Typing indicator */}
          {loading&&!messages.some(m=>m.streaming&&m.content)&&(
            <div style={{display:"flex",gap:10,alignItems:"flex-start",
              animation:"msgIn .26s "+T.spring+" both"}}>
              <div style={{width:28,height:28,borderRadius:"50%",flexShrink:0,marginTop:2,
                background:"linear-gradient(135deg,#1a2d4a,#0a3a5c)",
                border:`1px solid ${T.borderH}`,
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:12,color:"#fff"}}>✦</div>
              <div style={{background:T.aiBg,border:`0.5px solid ${T.borderH}`,
                borderRadius:"16px 4px 16px 16px",backdropFilter:"blur(10px)"}}>
                <TypingDots/>
              </div>
            </div>
          )}

          {/* Error */}
          {error&&(
            <div style={{
              fontSize:12,color:"#f85149",
              background:"rgba(248,81,73,.07)",border:"0.5px solid rgba(248,81,73,.18)",
              borderRadius:10,padding:"10px 14px",
              display:"flex",flexDirection:"column",gap:8,alignItems:"center",
            }}>
              <span>{error}</span>
              <button onClick={()=>{setError("");sendMessage(lastUserMsg);}} style={{
                background:"rgba(248,81,73,.12)",border:"0.5px solid rgba(248,81,73,.28)",
                borderRadius:6,padding:"4px 14px",fontSize:11,fontWeight:600,
                color:"#f85149",cursor:"pointer",
              }}>{isAr?"أعد المحاولة":"Retry"}</button>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>

        {/* ── Quick suggestions ────────────────────────────── */}
        {showSuggs&&(
          <div style={{
            padding:"6px 18px 10px",display:"flex",gap:6,flexWrap:"wrap",flexShrink:0,
            animation:"msgIn .3s ease .12s both",
          }}>
            {suggs.map((s,i)=>(
              <button key={i} className="cChip" onClick={()=>sendMessage(s.label)} style={{
                background:"rgba(56,139,253,.07)",border:"0.5px solid rgba(56,139,253,.16)",
                borderRadius:99,padding:"5px 12px",fontSize:11,color:"#79c0ff",
                cursor:"pointer",transition:"all .15s",whiteSpace:"nowrap",
                display:"flex",alignItems:"center",gap:5,fontWeight:500,
              }}>
                <span>{s.icon}</span>
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* ── Limit banner ─────────────────────────────────── */}
        {limitReached&&(
          <div style={{
            padding:"9px 16px",flexShrink:0,
            background:"rgba(248,81,73,.07)",borderTop:"0.5px solid rgba(248,81,73,.18)",
            fontSize:12,color:"#f85149",textAlign:"center",
          }}>
            {isAr
              ?`وصلت للحد الشهري (${coachLimit} رسائل). الترقية للـ Elite للحصول على رسائل غير محدودة.`
              :`Monthly limit of ${coachLimit} messages reached. Upgrade to Elite for unlimited.`}
          </div>
        )}

        {/* ── Input ────────────────────────────────────────── */}
        <div style={{
          padding:"10px 12px",borderTop:`0.5px solid ${T.border}`,
          background:"rgba(11,21,37,.7)",flexShrink:0,
          display:"flex",gap:8,alignItems:"flex-end",
        }}>
          <textarea
            ref={inputRef}
            className="cInput"
            value={input}
            onChange={e=>{
              setInput(e.target.value);
              e.target.style.height="auto";
              e.target.style.height=Math.min(e.target.scrollHeight,120)+"px";
            }}
            onKeyDown={handleKey}
            placeholder={isAr?"اسأل Dr. Corvus…":"Ask Dr. Corvus anything…"}
            disabled={loading||limitReached}
            rows={1}
            style={{
              flex:1,background:"rgba(255,255,255,.04)",
              border:`0.5px solid ${T.border}`,
              borderRadius:12,padding:"10px 14px",
              fontSize:13,color:T.text,outline:"none",
              resize:"none",fontFamily:"inherit",
              direction:isAr?"rtl":"ltr",
              minHeight:42,maxHeight:120,lineHeight:1.55,
            }}
          />
          <button
            className="cSend"
            onClick={()=>sendMessage()}
            disabled={loading||!input.trim()||limitReached}
            style={{
              background:loading||!input.trim()?"rgba(56,139,253,.22)":"#388bfd",
              border:"none",borderRadius:12,width:44,height:44,
              fontSize:19,color:"white",
              cursor:loading||!input.trim()?"default":"pointer",
              transition:"all .2s",flexShrink:0,
              display:"flex",alignItems:"center",justifyContent:"center",
              boxShadow:!loading&&input.trim()?"0 4px 14px rgba(56,139,253,.3)":"none",
            }}
          >{loading?"⟳":"↑"}</button>
        </div>
      </div>
    </div>
  );
}
