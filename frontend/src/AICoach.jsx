import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { geminiChat, buildCoachContext, friendlyError } from "./gemini.js";
import { getLocalAIStatus, onLocalAIStatus, localChatStream, abortCurrentStream } from "./localAI.js";
import { qualityFor, featureTier } from "./lib/tierQuality.js";
import { CoachAPI } from "./services/api.js";
import { useBodyScrollLock } from "./lib/useBodyScrollLock.js";

// ── Tokens ────────────────────────────────────────────────────────
// T is built per-render inside FreeChatCoach using the cs prop.
// This module-level object is the DARK fallback used only when cs is unavailable.
const T_DARK = {
  bg:      "#0d1a2e",
  surf:    "#111827",
  card:    "#0f1c2e",
  border:  "rgba(56,139,253,.12)",
  borderH: "rgba(56,139,253,.3)",
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
  aiBg:    "rgba(15,28,46,.95)",
  spring:  "cubic-bezier(.16,1,.3,1)",
};
function mkT(cs) {
  const dark = !cs || cs.bg === "#030b14" || cs.bg === "#0a0f1e";
  return {
    ...T_DARK,
    bg:     cs?.card  || T_DARK.bg,
    surf:   cs?.card2 || T_DARK.surf,
    card:   cs?.card  || T_DARK.card,
    border: cs?.border|| T_DARK.border,
    borderH:cs?.border|| T_DARK.borderH,
    text:   cs?.text  || T_DARK.text,
    muted:  cs?.muted || T_DARK.muted,
    subtle: cs?.muted || T_DARK.subtle,
    aiBg:   dark ? "rgba(15,28,46,.95)" : "rgba(241,245,249,.9)",
  };
}
const T = T_DARK; // module-level fallback (overridden inside component)

// ── Markdown renderer ─────────────────────────────────────────────
// Table support: previously any line starting with "|" (a markdown
// table row — common in the clinical/comparison content the Gemini/Groq
// backend now actually returns, now that it's reachable at all — see
// backend.py's Groq fallback fix) fell straight into the generic
// "else" branch below and rendered as one raw line of literal pipe
// characters per row, no columns/borders — every AI table in this chat
// came out as unreadable "| Metric | Value |" text. AIInsights.jsx's
// MdText already handles this correctly (collect consecutive "|" lines,
// drop the "---" separator row, render a real <table>); mirrored that
// same approach here rather than inventing a second implementation.
function renderMd(raw) {
  if (!raw) return "";
  let t = raw.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const lines = t.split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
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
    else if (l.trim().startsWith("|")) {
      // Table — collect every consecutive "|" line, then render as <table>.
      const tableLines = [l.trim()];
      while (i + 1 < lines.length && lines[i+1].trim().startsWith("|")) {
        i++; tableLines.push(lines[i].trim());
      }
      // Drop markdown's "|---|---|" separator row.
      const rows = tableLines.filter(r => !/^[|\s-]+$/.test(r));
      if (rows.length >= 2) {
        const cellsOf = r => r.split("|").filter((_,j,a)=>j>0&&j<a.length-1).map(c=>c.trim());
        const headers = cellsOf(rows[0]);
        const body    = rows.slice(1);
        out.push(`<div style="overflow-x:auto;margin:10px 0"><table style="width:100%;border-collapse:collapse;font-size:12.5px">`
          + `<thead><tr>${headers.map(h=>`<th style="padding:7px 11px;text-align:left;background:rgba(56,139,253,.1);color:#79c0ff;font-weight:600;border-bottom:1px solid rgba(56,139,253,.2)">${inl(h)}</th>`).join("")}</tr></thead>`
          + `<tbody>${body.map((r,ri)=>`<tr style="background:${ri%2===0?"rgba(255,255,255,.02)":"transparent"}">${cellsOf(r).map(c=>`<td style="padding:6px 11px;border-bottom:1px solid rgba(255,255,255,.05)">${inl(c)}</td>`).join("")}</tr>`).join("")}</tbody>`
          + `</table></div>`);
      } else {
        // Not a real table (e.g. a single "|" line) — fall back to plain text.
        out.push(`<span style="font-size:13px">${inl(l)}</span><br/>`);
      }
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

// Links: matches either markdown [text](url) or a bare http(s) URL in one
// pass (alternation), so a URL already captured as the markdown form never
// gets re-matched by the bare-URL branch. Previously there was no link
// handling at all — a URL just passed through as plain text, unclickable.
function linkify(t) {
  return t.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>"']+)/g,
    (m, mdText, mdUrl, bareUrl) => {
      if (mdUrl) return `<a href="${mdUrl}" target="_blank" rel="noopener noreferrer" style="color:#58a6ff;text-decoration:underline">${mdText}</a>`;
      // Trailing punctuation (., , ; : ! ? or a closing paren) after a bare
      // URL is almost always sentence punctuation, not part of the link —
      // strip it from the href/label and put it back after the tag.
      let url = bareUrl, trail = "";
      const tm = url.match(/([.,;:!?)]+)$/);
      if (tm) { trail = tm[1]; url = url.slice(0, -trail.length); }
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:#58a6ff;text-decoration:underline">${url}</a>${trail}`;
    }
  );
}

function inl(t) {
  return linkify(t)
    .replace(/\*\*(.+?)\*\*/g,"<strong style='color:#e6edf3;font-weight:600'>$1</strong>")
    .replace(/\*(.+?)\*/g,"<em style='color:#8b949e'>$1</em>")
    .replace(/`(.+?)`/g,"<code style='background:rgba(56,139,253,.12);padding:1px 5px;border-radius:4px;font-size:.88em;font-family:\"SF Mono\",monospace;color:#79c0ff'>$1</code>");
}

function MdText({ text }) {
  return (
    <div style={{ lineHeight:1.74,fontFamily:"'IBM Plex Sans Arabic','DM Sans',system-ui,sans-serif",fontSize:13,letterSpacing:"-.01em",color:T.text }}
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
        userSelect:"none",marginTop:2,
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
          backdropFilter:isUser?"none":"blur(4px)",
          WebkitBackdropFilter:isUser?"none":"blur(4px)",
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
  // null when no recent session recorded a reliable neck reading. It used to
  // be 100 - avg_score, so the coach was handed a "cervical risk" that was the
  // overall score in disguise and wrote clinical-sounding advice about it.
  const nr = ctx.neck_risk;
  const nrTxt = nr == null ? (isAr ? "مش متقاس" : "not measured") : `${nr}%`;
  const fa = ctx.fatigue_score||0;
  const bu = ctx.burnout_risk||0;
  const tr = ctx.trend_pct||0;
  const wa = ctx.week_avg||ctx.avg_score;
  const al = (ctx.top_alerts||[]).slice(0,5).join("; ")||"None recorded";
  const nm = ctx.user_name||"Patient";

  if (isAr) return `تعليمات إلزامية: يجب أن تردّ باللغة العربية فقط في كل الأحوال. ممنوع منعاً باتاً الرد بالإنجليزية أو أي لغة أخرى بغض النظر عن لغة المستخدم.

أنت دكتور كورفوس — فيزيوثيرابيست سريري وخبير إرجونوميكس داخل Corvus PostureAI Pro. خبرة 15 سنة في الجهاز العضلي الهيكلي.

## بيانات ${nm} السريرية:
- درجة الوضعية: **${ctx.avg_score}/100** (${sc}) | هذا الأسبوع: ${wa}/100 (${tr>0?"+":""}${tr}%)
- خطر الرقبة: **${nrTxt}** — ${nr==null?"ما تتكلمش عن الرقبة كأنك قستها":nr>=70?"🔴 مرتفع":nr>=40?"🟡 متوسط":"🟢 منخفض"}
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
اللغة: عامية مصرية. مصطلحات طبية مع شرح.

[CTXDATA:${JSON.stringify({avg:ctx.avg_score||0, sessions:ctx.sessions_count||0, weekAvg:wa||0, weekSessions:ctx.week_sessions||0, trendPct:tr||0, neckRisk:nr||0, fatigue:fa||0, burnout:bu||0, calibrated:!!ctx.has_calibration, alerts:al, lang:"ar"})}]`;

  return `You are Dr. Corvus — clinical physiotherapist & ergonomics specialist in Corvus PostureAI Pro. 15 years MSK experience.

## PATIENT DATA: ${nm}
| Metric | Value | Status |
|--------|-------|--------|
| Posture | ${ctx.avg_score}/100 | ${sc} |
| This week | ${wa}/100 | ${tr>0?"+":""}${tr}% trend |
| Cervical risk | ${nrTxt} | ${nr==null?"no reliable neck reading in recent sessions — do not describe it as measured":nr>=70?"🔴 HIGH":nr>=40?"🟡 MODERATE":"🟢 LOW"} |
| Fatigue | ${fa}% | ${fa>=70?"HIGH":fa>=45?"MODERATE":"Normal"} |
| Burnout risk | ${bu}% | ${bu>=70?"HIGH":bu>=45?"MODERATE":"Low"} |
| Sessions | ${ctx.sessions_count} total | ${ctx.week_sessions}/wk | ${ctx.streak_days||0}-day streak |
| Calibration | ${ctx.has_calibration?"Personalized ✅":"Generic ⚠️ (-15% accuracy)"} |
| Top issues | ${al} |

## CLINICAL REFS
**Hansraj 2014 cervical load:** 0°=4.5kg → 15°=12kg → 30°=18kg → 45°=22kg → 60°=27kg
Est. flexion for ${nm}: ${nr==null?"unavailable — no neck reading recorded":nr>=70?"~35-45°":nr>=40?"~20-30°":"~<15°"}
**Nachemson disc pressure:** upright=100% → slouch=185% → forward lean=220%

## PROTOCOL
- PAIN → assess (location, character, radiation, provocateurs) + explain structure
- EXERCISE → precise Rx: name, sets×reps, hold time, frequency, muscle target, weeks to improve
- DATA → clinical interpretation: MSK load meaning, structures at risk
- PLAN → weekly protocol with progressions
- ⚕️ Red flags (radiation/numbness/unilateral weakness) → advise in-person physio
- No "Great question!" openings. Start with the answer.
- 220w max conversation | 400w max for full plans.

[CTXDATA:${JSON.stringify({avg:ctx.avg_score||0, sessions:ctx.sessions_count||0, weekAvg:wa||0, weekSessions:ctx.week_sessions||0, trendPct:tr||0, neckRisk:nr||0, fatigue:fa||0, burnout:bu||0, calibrated:!!ctx.has_calibration, alerts:al, lang:isAr?"ar":"en"})}]`;
}

// ── Free-form chat coach (Professional/Elite — plenty of monthly budget
// for open conversation) ────────────────────────────────────────────
function FreeChatCoach({ profile, sessions=[], calibration, cs, lang="en", effectiveTier, onClose }) {
  const isAr = lang==="ar";
  const dir  = isAr?"rtl":"ltr";
  const T    = mkT(cs); // theme tokens that respect light/dark mode

  const [messages,  setMessages]  = useState([]);
  const [input,     setInput]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [msgCount,  setMsgCount]  = useState(0);
  const [lastUserMsg, setLastUserMsg] = useState("");
  const messagesRef = useRef([]);
  useEffect(()=>{ messagesRef.current=messages; },[messages]);

  // ALL tiers get free chat — just with different monthly limits
  const _tier    = effectiveTier||profile?.tier||"standard";
  const quality  = qualityFor(_tier);
  const coachLimit = quality.aiCoach?.monthlyLimit ?? 5;
  const limitReached = coachLimit!==-1 && msgCount>=coachLimit;

  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  // Load monthly count from Firestore (tamper-proof)
  useEffect(()=>{
    const uid = profile?.uid||"";
    if (!uid) return;
    const month = new Date().toISOString().slice(0,7);
    import("./firebase.js").then(({ db, doc, getDoc }) => {
      getDoc(doc(db, "users", uid, "ai_usage", month))
        .then(snap => {
          if (snap.exists()) setMsgCount(snap.data()?.coach_messages || 0);
        })
        .catch(() => {
          // Fallback to localStorage if Firestore fails
          try {
            const key = "corvus_coach_count_"+uid+"_"+month;
            setMsgCount(parseInt(localStorage.getItem(key)||"0",10));
          } catch {}
        });
    }).catch(() => {});
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
      // Saved sessions store this under alert_causes (see App.jsx saveSession
      // calls), not alerts — s.alerts is always undefined on real session
      // docs, which silently zeroed out "top issues" for every user in this
      // component (DailyCheckinPanel below already got this right).
      (s.alert_causes||s.alerts||[]).forEach(a=>{
        const k=typeof a==="string"?a:(a?.cause||a?.label||a?.type||"");
        if(k) ac[k]=(ac[k]||0)+1;
      });
    });
    const topAlerts=Object.entries(ac).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k])=>k);
    // profile.avg_score is a LIFETIME cumulative mean, recomputed on every
    // save as ((old * (n-1)) + this) / n. At 73 sessions a perfect session
    // moves it by under one point, so the pill reads the same number week
    // after week — reported as "this data never updates", which is exactly
    // what a lifetime average does. Both figures are kept: `recent_avg` is
    // what the user is doing now and drives the pill, `avg_score` stays the
    // all-time figure the rest of the app uses.
    const recent = (sessions||[]).slice(0, 7).map(x=>x.avg_score||0).filter(Boolean);
    const recentAvg = avg(recent);
    const avgScore=profile?.avg_score||avg(scores);
    const fatigue=Math.min(100,Math.max(0,Math.round((100-wAvg)*.6+(sessions?.length<5?30:10))));

    // Neck risk from the NECK, not from the overall score.
    //
    // It was Math.round(100 - avgScore + (avgScore < 60 ? 20 : 0)) — pure
    // arithmetic on the number in the pill beside it. An overall 49 produced
    // "71% neck" every time, and it could never move independently of the
    // score because it was the score. Meanwhile the engine measures neck_lean
    // on every frame, stores it on every session, and none of it was read.
    //
    // Averaged over the recent sessions that actually recorded a reliable
    // neck_lean. null when none did, so the pill can say so rather than
    // inventing a percentage.
    const neckScores = (sessions||[]).slice(0, 10)
      .map(x => x?.metrics?.neck_lean)
      .filter(m => m && m.reliable !== false && Number.isFinite(m.score))
      .map(m => m.score);
    const neck = neckScores.length ? Math.max(0, Math.min(100, 100 - avg(neckScores))) : null;
    const burnout=Math.min(100,Math.round(fatigue*.8+(thisWk.length>5?15:0)));
    return {
      avg_score:avgScore,recent_avg:recentAvg,recent_n:recent.length,
      week_avg:wAvg,last_week_avg:lAvg,trend_pct:trendPct,
      sessions_count:profile?.sessions_count||sessions?.length||0,week_sessions:thisWk.length,
      has_calibration:!!calibration,tier:_tier,neck_risk:neck,
      fatigue_score:fatigue,burnout_risk:burnout,streak_days:profile?.streak_days||0,
      user_name:profile?.name?.split(" ")[0]||"",top_alerts:topAlerts,
    };
  },[sessions,calibration,_tier,profile]);

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
            const n=msgCount+1;
            setMsgCount(n);
            const month=new Date().toISOString().slice(0,7);
            import("./firebase.js").then(({ db, doc, setDoc, increment }) => {
              setDoc(doc(db,"users",uid,"ai_usage",month),
                { coach_messages: n, updated_at: new Date().toISOString() },
                { merge: true }
              ).catch(() => {
                // Fallback localStorage
                try { localStorage.setItem("corvus_coach_count_"+uid+"_"+month, String(n)); } catch {}
              });
            }).catch(() => {});
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
      background:"rgba(4,8,20,.6)",padding:16,
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
        width:"100%",maxWidth:640,height:"min(700px,92dvh)",
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
              // The score pill shows the recent average, which moves; the
              // all-time figure is in the coach's context, not on a pill that
              // looked live and was not. The neck pill is omitted entirely
              // when no recent session recorded a reliable neck reading —
              // better a missing pill than a number derived from the one next
              // to it.
              context.recent_n
                ? {label:`${context.recent_avg}/100 · ${isAr?`آخر ${context.recent_n}`:`last ${context.recent_n}`}`,
                   color:context.recent_avg>=70?T.green:context.recent_avg>=55?T.amber:T.red}
                : null,
              context.neck_risk!=null
                ? {label:`${context.neck_risk}% ${isAr?"رقبة":"neck"}`,
                   color:context.neck_risk>=70?T.red:context.neck_risk>=40?T.amber:T.green}
                : null,
              {label:`${context.sessions_count} ${isAr?"جلسة":"sessions"}`,color:T.subtle},
            ].filter(Boolean).map(p=>(
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
          {/* Fresh conversation — messages.map() below renders nothing when
              empty, and this area is flex:1 (expands to fill the modal), so
              a brand-new chat used to just show a big blank void above the
              suggested questions with nothing explaining why. */}
          {messages.length===0 && (
            <div style={{
              flex:1,display:"flex",flexDirection:"column",alignItems:"center",
              justifyContent:"center",gap:10,padding:"20px 24px",textAlign:"center",
              opacity:.85,
            }}>
              <div style={{fontSize:34}}>🩺</div>
              <div style={{fontSize:14,fontWeight:700,color:T.text||"#f0f6ff"}}>
                {isAr?"أهلاً! أنا Dr. Corvus":"Hi, I'm Dr. Corvus"}
              </div>
              <div style={{fontSize:12,color:T.subtle,maxWidth:280,lineHeight:1.6}}>
                {isAr
                  ?"اسألني عن وضعيتك، الألم، أو أي حاجة عايز تفهمها من بياناتك — أو دوس على سؤال جاهز تحت"
                  :"Ask me about your posture, pain, or anything from your data — or tap a suggestion below to start"}
              </div>
            </div>
          )}
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
              <div style={{background:T.aiBg||"rgba(15,28,46,.95)",border:`0.5px solid ${T.borderH}`,
                borderRadius:"16px 4px 16px 16px"}}>
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

// ── Daily Check-in panel (Basic tier) ────────────────────────────
// One question + one tip per day, server-generated and server-gated
// (via CoachAPI → backend /api/ai-coach/daily-checkin, Firestore +
// Redis-backed — idempotent per calendar day, real monthly quota).
// Replaces free-form chat for Basic: the same 10/month budget now
// buys 10 complete daily interactions instead of 10 scattered messages.
function DailyCheckinPanel({ profile, sessions=[], calibration, cs, lang="en", tier, onClose }) {
  const isAr = lang === "ar";
  const dir  = isAr ? "rtl" : "ltr";

  const [state,   setState]   = useState("loading"); // loading | ready | limit | error
  const [checkin, setCheckin] = useState(null);       // {question, question_ar, tip, tip_ar, answered, answer, used, limit}
  const [answer,  setAnswer]  = useState("");
  const [saving,  setSaving]  = useState(false);
  const [tipShown, setTipShown] = useState(false);

  const context = useMemo(() => {
    const avg = arr => arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : 0;
    const scores = (sessions||[]).map(s=>s.avg_score||0).filter(Boolean);
    const ac = {};
    (sessions||[]).slice(0,20).forEach(s => {
      (s.alert_causes||s.alerts||[]).forEach(a => {
        const k = typeof a==="string" ? a : (a?.cause||a?.label||a?.type||"");
        if (k) ac[k]=(ac[k]||0)+1;
      });
    });
    const topAlerts = Object.entries(ac).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k])=>k);
    return {
      avg_score: profile?.avg_score || avg(scores),
      streak_days: profile?.streak_days || 0,
      // Same defect as the coach's context above: this was 100 - avg_score,
      // a restatement of the overall score labelled as the neck. Read from the
      // metric the engine actually records, or report nothing.
      neck_risk: (() => {
        const ns = (sessions||[]).slice(0,10)
          .map(x => x?.metrics?.neck_lean)
          .filter(m => m && m.reliable !== false && Number.isFinite(m.score))
          .map(m => m.score);
        return ns.length ? Math.max(0, Math.min(100, 100 - avg(ns))) : null;
      })(),
      top_alerts: topAlerts,
      // Free-tier self-report ("Where does it hurt?") — was captured and
      // saved but never actually fed into any personalization until now.
      pain_area: profile?.pain_area || null,
    };
  }, [sessions, profile]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await CoachAPI.getDailyCheckin({ context, lang });
        if (cancelled) return;
        setCheckin(res);
        setTipShown(!!res.answered); // if already answered today, show everything immediately
        setAnswer(res.answer || "");
        setState("ready");
      } catch (e) {
        if (cancelled) return;
        if (e?.code === "coach_limit_reached" || String(e?.message||"").includes("limit")) setState("limit");
        else setState("error");
      }
    })();
    return () => { cancelled = true; };
  }, []); // one fetch per panel open — server is the source of truth for "today"

  const submitAnswer = async () => {
    if (!answer.trim() || saving) return;
    setSaving(true);
    try {
      await CoachAPI.answerDailyCheckin(answer.trim());
      setCheckin(prev => ({ ...prev, answered: true, answer: answer.trim() }));
      setTipShown(true);
    } catch {
      setTipShown(true); // still reveal the tip even if saving the answer failed — that's the real value
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position:"fixed",inset:0,zIndex:9999,
      display:"flex",alignItems:"center",justifyContent:"center",
      background:"rgba(4,8,20,.8)",padding:16,
      animation:"bIn .18s ease both",
    }}>
      <style>{`@keyframes bIn{from{opacity:0}to{opacity:1}}@keyframes sUp{from{opacity:0;transform:translateY(18px) scale(.97)}to{opacity:1;transform:none}}`}</style>
      <div dir={dir} style={{
        width:"100%",maxWidth:460,
        background:T.bg,border:`0.5px solid ${T.borderH}`,borderRadius:22,
        padding:24,boxShadow:"0 32px 96px rgba(0,0,0,.7)",
        animation:"sUp .3s "+T.spring+" both",
      }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
          <div style={{ display:"flex",alignItems:"center",gap:9 }}>
            <div style={{ width:34,height:34,borderRadius:10,background:"linear-gradient(135deg,#1158c7,#0e7490)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16 }}>🩺</div>
            <div>
              <div style={{ fontSize:14,fontWeight:800,color:T.text }}>{isAr?"تشيك-إن اليوم":"Today's Check-in"}</div>
              <div style={{ fontSize:10,color:T.muted }}>Dr. Corvus · {isAr?"مرة واحدة يوميًا":"once a day"}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:"none",border:"none",color:T.muted,fontSize:18,cursor:"pointer" }}>✕</button>
        </div>

        {state === "loading" && (
          <div style={{ padding:"40px 0",textAlign:"center",color:T.muted,fontSize:13 }}>
            {isAr?"جاري تحضير سؤال اليوم…":"Preparing today's check-in…"}
          </div>
        )}

        {state === "limit" && (
          <div style={{ padding:"20px 0",textAlign:"center" }}>
            <div style={{ fontSize:13,color:T.text,marginBottom:6 }}>
              {isAr?"استخدمت كل تشيك-إن الشهر ده":"You've used all your check-ins this month"}
            </div>
            <div style={{ fontSize:12,color:T.muted }}>{isAr?"رقّي خطتك لمزيد":"Upgrade for more"}</div>
          </div>
        )}

        {state === "error" && (
          <div style={{ padding:"20px 0",textAlign:"center",color:T.red,fontSize:13 }}>
            {isAr?"حصل خطأ — جرب تاني":"Something went wrong — try again"}
          </div>
        )}

        {state === "ready" && checkin && (
          <>
            <div style={{ background:"rgba(56,139,253,.08)",border:`0.5px solid ${T.border}`,borderRadius:14,padding:16,marginBottom:14 }}>
              <div style={{ fontSize:10,fontWeight:700,color:T.blue,textTransform:"uppercase",letterSpacing:".06em",marginBottom:6 }}>
                {isAr?"سؤال اليوم":"Today's question"}
              </div>
              <div style={{ fontSize:14,color:T.text,lineHeight:1.55 }}>
                {isAr ? (checkin.question_ar||checkin.question) : (checkin.question||checkin.question_ar)}
              </div>
            </div>

            {!tipShown ? (
              <div style={{ display:"flex",gap:8 }}>
                <input
                  value={answer}
                  onChange={e=>setAnswer(e.target.value)}
                  onKeyDown={e=>{ if(e.key==="Enter") submitAnswer(); }}
                  placeholder={isAr?"اكتب إجابتك…":"Type your answer…"}
                  style={{ flex:1,background:"rgba(255,255,255,.04)",border:`0.5px solid ${T.border}`,borderRadius:10,padding:"10px 14px",fontSize:13,color:T.text,outline:"none" }}
                  autoFocus
                />
                <button onClick={submitAnswer} disabled={!answer.trim()||saving}
                  style={{ background:answer.trim()?"#388bfd":"rgba(56,139,253,.22)",border:"none",borderRadius:10,padding:"0 16px",color:"#fff",fontWeight:700,fontSize:13,cursor:answer.trim()?"pointer":"default" }}>
                  {saving ? "…" : (isAr?"إرسال":"Send")}
                </button>
              </div>
            ) : (
              <div style={{ background:"rgba(16,185,129,.08)",border:"0.5px solid rgba(16,185,129,.25)",borderRadius:14,padding:16 }}>
                <div style={{ fontSize:10,fontWeight:700,color:"#10b981",textTransform:"uppercase",letterSpacing:".06em",marginBottom:6 }}>
                  {isAr?"نصيحة اليوم":"Today's tip"}
                </div>
                <div style={{ fontSize:13,color:T.text,lineHeight:1.6 }}>
                  {isAr ? (checkin.tip_ar||checkin.tip) : (checkin.tip||checkin.tip_ar)}
                </div>
              </div>
            )}

            {typeof checkin.limit === "number" && checkin.limit > 0 && (
              <div style={{ marginTop:14,fontSize:10,color:T.subtle,textAlign:"center" }}>
                {isAr
                  ? `${(checkin.limit-(checkin.used||1))} تشيك-إن متبقي الشهر ده`
                  : `${checkin.limit-(checkin.used||1)} check-ins left this month`}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Main export — routes by tier ─────────────────────────────────
// Basic: bounded daily check-in (question + tip, server-gated).
// Professional/Elite: full free-form chat (plenty of monthly budget).
export function AICoach({ profile, sessions=[], calibration, cs, lang="en", effectiveTier, onClose }) {
  useBodyScrollLock();
  // All users get the free-chat Dr. Corvus — tier only affects the monthly message limit
  // (free=5, basic=10, pro=50, elite=unlimited). DailyCheckinPanel is still
  // accessible via the Basic features panel; this modal is the full chat.
  return <FreeChatCoach profile={profile} sessions={sessions} calibration={calibration} cs={cs} lang={lang} effectiveTier={effectiveTier} onClose={onClose} />;
}
