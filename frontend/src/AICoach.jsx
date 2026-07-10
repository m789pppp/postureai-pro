import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { geminiChat, buildCoachContext, friendlyError } from "./gemini.js";
import { getLocalAIStatus, onLocalAIStatus, localChatStream } from "./localAI.js";
import { qualityFor, coachLimitLabel as tierCoachLimitLabel } from "./lib/tierQuality.js";

// ── Design tokens ─────────────────────────────────────────────────
const C = {
  bg:       "#080f1e",
  surface:  "#0d1526",
  card:     "#111d30",
  border:   "rgba(99,179,237,.10)",
  borderHi: "rgba(99,179,237,.22)",
  text:     "#e8f0fe",
  muted:    "#64748b",
  subtle:   "#94a3b8",
  blue:     "#3b82f6",
  blueGlow: "rgba(59,130,246,.18)",
  cyan:     "#06b6d4",
  green:    "#10b981",
  red:      "#ef4444",
  userBg:   "linear-gradient(135deg,#1d4ed8,#0891b2)",
  aiBg:     "rgba(255,255,255,.04)",
  aiBorder: "rgba(99,179,237,.14)",
};

// ── Markdown → HTML (clean, no XSS risk since content is from our AI) ──
function renderMd(raw) {
  if (!raw) return "";
  // Escape HTML first
  let t = raw
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;");

  // Block elements — process line by line
  const lines = t.split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    // ## Heading
    if (/^## (.+)$/.test(l)) {
      out.push(`<div style="font-size:14px;font-weight:700;color:#bfdbfe;margin:14px 0 6px;letter-spacing:-.01em">${l.replace(/^## /,"")}</div>`);
    }
    // ### Subheading
    else if (/^### (.+)$/.test(l)) {
      out.push(`<div style="font-size:13px;font-weight:700;color:#93c5fd;margin:10px 0 4px">${l.replace(/^### /,"")}</div>`);
    }
    // Numbered list
    else if (/^\d+\. (.+)$/.test(l)) {
      const [,num,rest] = l.match(/^(\d+)\. (.+)$/);
      out.push(`<div style="display:flex;gap:9px;margin:5px 0;align-items:baseline"><span style="color:#60a5fa;font-weight:700;font-size:12px;min-width:16px;flex-shrink:0">${num}.</span><span>${inline(rest)}</span></div>`);
    }
    // Bullet
    else if (/^[-•▸] (.+)$/.test(l)) {
      const rest = l.replace(/^[-•▸] /,"");
      out.push(`<div style="display:flex;gap:8px;margin:4px 0;align-items:baseline"><span style="color:#22d3ee;font-size:10px;flex-shrink:0;margin-top:3px">●</span><span>${inline(rest)}</span></div>`);
    }
    // ⚕️ warning
    else if (l.startsWith("⚕️")) {
      out.push(`<div style="background:rgba(239,68,68,.08);border:0.5px solid rgba(239,68,68,.22);border-radius:8px;padding:9px 12px;margin:10px 0;font-size:12.5px;line-height:1.6">${inline(l)}</div>`);
    }
    // Empty line → spacing
    else if (l.trim() === "") {
      out.push(`<div style="height:7px"></div>`);
    }
    // Normal paragraph
    else {
      out.push(`<span>${inline(l)}</span><br/>`);
    }
    i++;
  }
  return out.join("");
}

function inline(t) {
  return t
    .replace(/\*\*(.+?)\*\*/g, "<strong style='color:#e2e8f0;font-weight:600'>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em style='color:#cbd5e1'>$1</em>")
    .replace(/`(.+?)`/g, "<code style='background:rgba(99,179,237,.13);padding:1px 6px;border-radius:4px;font-size:.9em;font-family:monospace'>$1</code>");
}

function MdText({ text }) {
  return (
    <div style={{
      lineHeight: 1.72,
      fontFamily: "'DM Sans', system-ui, sans-serif",
      fontSize: 13.5,
      fontFeatureSettings: "'kern' 1",
      letterSpacing: "-.01em",
    }}
    dangerouslySetInnerHTML={{ __html: renderMd(text) }}
    />
  );
}

// ── Animated typing dots ──────────────────────────────────────────
function TypingDots() {
  return (
    <div style={{ display:"flex", gap:5, alignItems:"center", padding:"12px 16px" }}>
      {[0,1,2].map(i => (
        <div key={i} style={{
          width:7, height:7, borderRadius:"50%",
          background: C.cyan,
          animation:`corvusDot 1.4s ease-in-out ${i*0.15}s infinite`,
        }}/>
      ))}
      <style>{`
        @keyframes corvusDot{0%,60%,100%{transform:translateY(0);opacity:.3}30%{transform:translateY(-5px);opacity:1}}
      `}</style>
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────
function Bubble({ msg, isAr, index }) {
  const isUser = msg.role === "user";
  const isStreaming = msg.streaming;
  return (
    <div style={{
      display:"flex", gap:10, alignItems:"flex-end",
      flexDirection: isUser ? (isAr?"row":"row-reverse") : "row",
      animation:`msgIn .28s cubic-bezier(.2,.8,.3,1) both`,
      animationDelay: `${Math.min(index * 0.04, 0.2)}s`,
    }}>
      <style>{`@keyframes msgIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Avatar */}
      <div style={{
        width:30, height:30, borderRadius:"50%", flexShrink:0,
        display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:13, fontWeight:700, letterSpacing:".02em",
        background: isUser
          ? C.userBg
          : `linear-gradient(135deg,#1e3a5f,#0c4a6e)`,
        border: isUser ? "none" : `1px solid ${C.borderHi}`,
        boxShadow: isUser ? "0 2px 8px rgba(29,78,216,.4)" : "0 2px 8px rgba(6,182,212,.12)",
        color:"#fff", userSelect:"none",
      }}>
        {isUser ? "M" : "✦"}
      </div>

      {/* Bubble */}
      <div style={{
        maxWidth:"76%", position:"relative",
        background: isUser ? C.userBg : C.aiBg,
        border: isUser ? "none" : `0.5px solid ${C.aiBorder}`,
        borderRadius: isUser
          ? (isAr ? "16px 4px 16px 16px" : "4px 16px 16px 16px")
          : (isAr ? "4px 16px 16px 16px" : "16px 4px 16px 16px"),
        padding:"11px 15px",
        fontSize:13.5, color: C.text, lineHeight:1.7,
        boxShadow: isUser
          ? "0 4px 16px rgba(29,78,216,.25)"
          : "0 2px 12px rgba(0,0,0,.2)",
        backdropFilter: isUser ? "none" : "blur(8px)",
      }}>
        <MdText text={msg.content} />
        {isStreaming && (
          <span style={{
            display:"inline-block", width:2, height:"1em",
            background:C.cyan, marginLeft:2, verticalAlign:"text-bottom",
            animation:"blink .6s step-end infinite",
          }}/>
        )}
        <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}`}</style>
        <div style={{
          fontSize:9.5, marginTop:6, opacity:.45,
          textAlign: isAr ? "left" : "right",
          color: isUser ? "rgba(255,255,255,.7)" : C.muted,
        }}>
          {new Date(msg.ts).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}
        </div>
      </div>
    </div>
  );
}

// ── Suggestions ───────────────────────────────────────────────────
const SUGGESTIONS = {
  en: [
    "Why does my neck hurt?",
    "What's my biggest posture problem?",
    "Give me a 5-minute stretch routine",
    "How can I improve my score?",
    "Best monitor height for me?",
    "When is my posture worst?",
  ],
  ar: [
    "ليه بتألمني رقبتي؟",
    "إيه أكبر مشكلة في وضعيتي؟",
    "إدّيني روتين إطالة ٥ دقايق",
    "إزاي أحسّن درجتي؟",
  ],
};

// ── Main component ────────────────────────────────────────────────
export function AICoach({ profile, sessions = [], calibration, cs, lang = "en", effectiveTier, onClose }) {
  const isAr = lang === "ar";
  const dir  = isAr ? "rtl" : "ltr";

  const [messages,  setMessages]  = useState([]);
  const [input,     setInput]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const messagesRef = useRef([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  const [localAIReady,  setLocalAIReady]  = useState(false);
  const [localAIStatus, setLocalAIStatus] = useState({ loading:false, progress:0 });

  const bottomRef = useRef(null);
  const inputRef  = useRef(null);
  const _tier = effectiveTier || (effectiveTier || profile?.tier || "standard");
  const quality   = qualityFor(_tier);
  const coachLimit = quality.monthly_limit ?? 5;

  // Build context
  const context = useMemo(() => {
    const _avg = arr => arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : 0;
    const allScores = (sessions||[]).map(s=>s.avg_score||0).filter(Boolean);
    const avgScore = _avg(allScores);
    const now = Date.now();
    const thisWeek = (sessions||[]).filter(s => {
      const d = s.created_at?.toDate ? s.created_at.toDate() : new Date(s.created_at||0);
      return (now-d) < 7*86400000;
    });
    const lastWeek = (sessions||[]).filter(s => {
      const d = s.created_at?.toDate ? s.created_at.toDate() : new Date(s.created_at||0);
      const ms = now-d; return ms>=7*86400000 && ms<14*86400000;
    });
    const weekAvg = _avg(thisWeek.map(s=>s.avg_score||0));
    const lastWeekAvg = _avg(lastWeek.map(s=>s.avg_score||0));
    const trendPct = lastWeekAvg>0 ? Math.round(((weekAvg-lastWeekAvg)/lastWeekAvg)*100) : 0;
    const alertCounts = {};
    (sessions||[]).slice(0,20).forEach(s=>{
      (s.alerts||[]).forEach(a=>{
        const k = typeof a==="string"?a:(a?.label||a?.type||"");
        if(k) alertCounts[k]=(alertCounts[k]||0)+1;
      });
    });
    const topAlerts = Object.entries(alertCounts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k])=>k);
    const fatigueScore = Math.min(100,Math.max(0,Math.round((100-weekAvg)*0.6+(sessions?.length<5?30:10))));
    const neckRisk = Math.min(100,Math.round(100-avgScore+(avgScore<60?20:0)));
    const burnoutRisk = Math.min(100,Math.round(fatigueScore*0.8+(thisWeek.length>5?15:0)));
    return {
      avg_score: avgScore, week_avg: weekAvg, last_week_avg: lastWeekAvg,
      trend_pct: trendPct, sessions_count: sessions?.length||0,
      week_sessions: thisWeek.length, has_calibration: !!calibration,
      tier: _tier, neck_risk: neckRisk, fatigue_score: fatigueScore,
      burnout_risk: burnoutRisk, streak_days: profile?.streak_days||0,
      user_name: profile?.name?.split(" ")[0]||"",
      top_alerts: topAlerts, worst_time: null,
    };
  }, [sessions, calibration, _tier]);

  // Init AI status
  useEffect(() => {
    const s = getLocalAIStatus();
    setLocalAIReady(s.ready);
    setLocalAIStatus(s);
    const unsub = onLocalAIStatus(s => { setLocalAIReady(s.ready); setLocalAIStatus(s); });
    return unsub;
  }, []);

  // Welcome message
  useEffect(() => {
    const name = profile?.name?.split(" ")[0] || (isAr?"":"there");
    const score = context.avg_score;
    const scoreLabel = score>=85?"excellent 🌟":score>=70?"good 💪":score>=55?"fair — let's work on it":"needs attention ⚠️";
    const content = isAr
      ? `أهلاً ${name}! 👋 أنا Dr. Corvus، أخصائي وضعية الجسم الذكي.\n\nدرجتك الحالية **${score}/100** من **${context.sessions_count}** جلسة. اسألني أي حاجة عن وضعيتك، ألمك، أو بيئة شغلك.`
      : `Hi${name?" "+name:""}! 👋 I'm **Dr. Corvus**, your AI physiotherapy specialist.\n\nYour posture score is **${score}/100** — ${scoreLabel}. Ask me anything about your posture, pain, or workspace setup.`;
    setMessages([{ role:"assistant", content, ts: Date.now() }]);
  }, []);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:"smooth" });
  }, [messages, loading]);

  // Send message
  const sendMessage = useCallback(async (text) => {
    const content = (text || input).trim();
    if (!content || loading) return;
    setInput("");
    setError("");

    const userMsg = { role:"user", content, ts:Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    const _scoreLabel = context.avg_score>=85?"Excellent":context.avg_score>=70?"Good":context.avg_score>=55?"Fair":"Needs Attention";
    const _neckRisk   = context.neck_risk||0;
    const _fatigue    = context.fatigue_score||0;
    const _burnout    = context.burnout_risk||0;
    const _trend      = context.trend_pct||0;
    const _weekAvg    = context.week_avg||context.avg_score;
    const _topAlerts  = (context.top_alerts||[]).slice(0,5).join("; ")||"None recorded";
    const _name       = context.user_name||"Patient";

    const systemPrompt = isAr
      ? `أنت دكتور كورفوس — الفيزيوثيرابيست الذكي داخل Corvus PostureAI Pro.

هويتك: متخصص سريري في الإرجونوميكس وصحة الجهاز العضلي الهيكلي.
متقولش "أنا ذكاء اصطناعي" — أنت دكتور كورفوس.

بيانات المريض ${_name}:
- درجة الوضعية: **${context.avg_score}/100** (${_scoreLabel})
- هذا الأسبوع: ${_weekAvg}/100 | التغيير: ${_trend>0?"+":""}${_trend}%
- الجلسات: ${context.sessions_count} | هذا الأسبوع: ${context.week_sessions}
- خطر الرقبة: **${_neckRisk}%** (${_neckRisk>=70?"🔴 مرتفع":_neckRisk>=40?"🟡 متوسط":"🟢 منخفض"})
- الإجهاد: ${_fatigue}% | الإرهاق: ${_burnout}%
- المعايرة: ${context.has_calibration?"✅ مكتملة":"⚠️ لم تُكمل"}
- التنبيهات: ${_topAlerts}

مبادئ الرد:
1. اذكر أرقام المريض الفعلية دايمًا
2. لكل توصية: إيه → ليه (الآلية) → إزاي (خطوات) → الفائدة → الوقت
3. استشهد بالأبحاث: "هانسراج 2014..."
4. ⚕️ علّم العلامات الخطيرة (ألم متشع، تنميل)
5. الشكل: **خط عريض**، أرقام للبروتوكولات، ## للعناوين
6. 150-250 كلمة للمحادثة
اللغة: عامية مصرية كاملة.`
      : `You are Dr. Corvus — the AI physiotherapist inside Corvus PostureAI Pro.

IDENTITY: Certified ergonomics & physiotherapy specialist. Never say "I'm an AI."

PATIENT DATA — ${_name}:
- Posture score: **${context.avg_score}/100** (${_scoreLabel})
- This week: ${_weekAvg}/100 | Trend: ${_trend>0?"+":""}${_trend}%
- Sessions: ${context.sessions_count} | This week: ${context.week_sessions} | Streak: ${context.streak_days||0}d
- Cervical risk: **${_neckRisk}%** (${_neckRisk>=70?"🔴 HIGH":_neckRisk>=40?"🟡 MODERATE":"🟢 LOW"})
- Fatigue: ${_fatigue}% | Burnout: ${_burnout}%
- Calibration: ${context.has_calibration?"✅ complete":"⚠️ not done"}
- Recurring alerts: ${_topAlerts}

PRINCIPLES:
1. Always reference patient's actual numbers
2. Every recommendation: WHAT → WHY (mechanism) → HOW (steps) → BENEFIT → TIMEFRAME
3. Cite evidence: "Hansraj (2014) showed at 45° neck flexion = 22kg load..."
4. ⚕️ Flag red flags (radiating pain, numbness) → recommend professional evaluation
5. Format: **bold** terms, numbered protocols, ## headers for structure
6. 150-250 words conversational | up to 400 for full reports
LANGUAGE: Clear, professional English.`;

    const streamingId = Date.now();
    // Add empty AI message immediately — will fill as tokens arrive
    setMessages(prev => [...prev, { role:"assistant", content:"", ts:streamingId, streaming:true }]);

    try {
      // Use ref to get latest messages (avoids stale closure bug)
      const history = messagesRef.current
        .filter(m => m.content && !m.streaming)  // skip empty streaming msgs
        .slice(-8)
        .map(m=>({role:m.role,content:m.content}));
      const allMsgs = [...history, {role:"user",content}];

      // Try streaming first (shows text as it arrives)
      try {
        await localChatStream(allMsgs, systemPrompt, quality.max_tokens || 700, (partial) => {
          setMessages(prev => prev.map(m =>
            m.ts === streamingId ? { ...m, content: partial } : m
          ));
        });
        // Mark streaming done
        setMessages(prev => prev.map(m =>
          m.ts === streamingId ? { ...m, streaming: false } : m
        ));
      } catch(streamErr) {
        // Streaming failed — fall back to non-streaming
        console.warn("[CorvusAI] Stream failed, using fallback:", streamErr.message);
        const reply = await geminiChat(allMsgs, {
          systemPrompt, context, lang, maxTokens: quality.max_tokens || 700,
        });
        setMessages(prev => prev.map(m =>
          m.ts === streamingId ? { ...m, content: reply, streaming: false } : m
        ));
      }
    } catch(e) {
      // Remove the empty streaming placeholder
      setMessages(prev => prev.filter(m => m.ts !== streamingId || m.content));
      setError(friendlyError(e, lang));
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, loading, context, isAr, quality, lang]);

  const handleKey = e => {
    if (e.key==="Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const suggestions = SUGGESTIONS[lang]||SUGGESTIONS.en;
  const showSuggestions = messages.length <= 1 && !loading;

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:9999,
      display:"flex", alignItems:"center", justifyContent:"center",
      background:"rgba(4,8,20,.75)", backdropFilter:"blur(12px)",
      padding:"16px",
      animation:"backdropIn .2s ease both",
    }}>
      <style>{`
        @keyframes backdropIn{from{opacity:0}to{opacity:1}}
        @keyframes slideUp{from{opacity:0;transform:translateY(20px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        .corvus-input:focus{border-color:rgba(59,130,246,.5)!important;box-shadow:0 0 0 3px rgba(59,130,246,.1)!important}
        .corvus-send:hover:not(:disabled){background:#2563eb!important;transform:translateY(-1px);box-shadow:0 4px 12px rgba(37,99,235,.4)!important}
        .corvus-send:active:not(:disabled){transform:translateY(0)!important}
        .corvus-chip:hover{background:rgba(59,130,246,.15)!important;border-color:rgba(59,130,246,.35)!important;transform:translateY(-1px)}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(99,179,237,.2);border-radius:99px}
      `}</style>

      {/* Panel */}
      <div dir={dir} style={{
        width:"100%", maxWidth:620, height:"min(680px,90vh)",
        background:C.bg,
        border:`0.5px solid ${C.borderHi}`,
        borderRadius:20,
        display:"flex", flexDirection:"column",
        overflow:"hidden",
        boxShadow:"0 32px 80px rgba(0,0,0,.6), 0 0 0 0.5px rgba(99,179,237,.08) inset",
        animation:"slideUp .3s cubic-bezier(.2,.8,.3,1) both",
      }}>

        {/* Header */}
        <div style={{
          padding:"14px 18px", flexShrink:0,
          background:`linear-gradient(135deg,rgba(29,78,216,.12),rgba(8,145,178,.06))`,
          borderBottom:`0.5px solid ${C.border}`,
          display:"flex", alignItems:"center", gap:12,
        }}>
          {/* Logo */}
          <div style={{
            width:38, height:38, borderRadius:11, flexShrink:0,
            background:"linear-gradient(135deg,#1d4ed8,#0891b2)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:18, boxShadow:"0 4px 12px rgba(29,78,216,.4)",
          }}>🤖</div>

          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:14, fontWeight:700, color:C.text, letterSpacing:"-.01em" }}>
              Dr. Corvus
            </div>
            <div style={{ fontSize:10.5, color:C.cyan, display:"flex", alignItems:"center", gap:5 }}>
              <span style={{
                width:5, height:5, borderRadius:"50%", background:C.green,
                display:"inline-block", boxShadow:`0 0 6px ${C.green}`,
                animation:"pulse 2s ease infinite",
              }}/>
              <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
              {isAr?"أخصائي الوضعية الذكي":"AI Physiotherapy Specialist"} · {isAr?"غير محدود":"Unlimited"}
            </div>
          </div>

          {/* Context pills */}
          <div style={{ display:"flex", gap:6, flexShrink:0 }}>
            {[
              `${context.avg_score}/100`,
              `${context.sessions_count} ${isAr?"جلسة":"sessions"}`,
              _tier,
            ].map(label => (
              <div key={label} style={{
                fontSize:10, color:C.subtle, background:"rgba(255,255,255,.04)",
                border:`0.5px solid ${C.border}`, borderRadius:6,
                padding:"3px 8px", whiteSpace:"nowrap",
              }}>{label}</div>
            ))}
          </div>

          <button onClick={onClose} style={{
            width:28, height:28, borderRadius:8, border:`0.5px solid ${C.border}`,
            background:"rgba(255,255,255,.04)", color:C.muted, cursor:"pointer",
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:13,
            flexShrink:0, transition:"all .15s",
          }}>✕</button>
        </div>

        {/* Messages */}
        <div style={{
          flex:1, overflowY:"auto", padding:"18px 18px 10px",
          display:"flex", flexDirection:"column", gap:16,
        }}>
          {messages.map((msg, i) => (
            <Bubble key={i} msg={msg} isAr={isAr} index={i} />
          ))}

          {/* Typing indicator */}
          {loading && !messages.some(m=>m.streaming&&m.content) && (
            <div style={{
              display:"flex", gap:10, alignItems:"flex-end",
              animation:"msgIn .28s cubic-bezier(.2,.8,.3,1) both",
            }}>
              <div style={{
                width:30, height:30, borderRadius:"50%", flexShrink:0,
                background:"linear-gradient(135deg,#1e3a5f,#0c4a6e)",
                border:`1px solid ${C.borderHi}`,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:13, color:"#fff",
              }}>✦</div>
              <div style={{
                background:C.aiBg, border:`0.5px solid ${C.aiBorder}`,
                borderRadius:"16px 4px 16px 16px",
                backdropFilter:"blur(8px)",
              }}>
                <TypingDots />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              fontSize:12, color:"#fca5a5",
              background:"rgba(239,68,68,.08)", border:"0.5px solid rgba(239,68,68,.2)",
              borderRadius:10, padding:"10px 14px",
              display:"flex", flexDirection:"column", gap:8, alignItems:"center",
            }}>
              <span>{error}</span>
              <button onClick={() => { setError(""); sendMessage(messages[messages.length-2]?.content||""); }}
                style={{
                  background:"rgba(239,68,68,.15)", border:"0.5px solid rgba(239,68,68,.3)",
                  borderRadius:6, padding:"4px 14px", fontSize:11, fontWeight:600,
                  color:"#fca5a5", cursor:"pointer",
                }}>
                {isAr?"أعد المحاولة":"Retry"}
              </button>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Suggestions */}
        {showSuggestions && (
          <div style={{
            padding:"0 18px 10px", display:"flex", gap:6, flexWrap:"wrap", flexShrink:0,
            animation:"msgIn .3s ease .15s both",
          }}>
            {suggestions.map((s,i) => (
              <button key={i} className="corvus-chip" onClick={() => sendMessage(s)} style={{
                background:"rgba(59,130,246,.07)", border:"0.5px solid rgba(59,130,246,.18)",
                borderRadius:99, padding:"5px 12px", fontSize:11.5, color:"#93c5fd",
                cursor:"pointer", transition:"all .15s", whiteSpace:"nowrap",
              }}>{s}</button>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{
          padding:"12px 14px", borderTop:`0.5px solid ${C.border}`,
          background:`rgba(13,21,38,.6)`, flexShrink:0,
          display:"flex", gap:8, alignItems:"flex-end",
        }}>
          <textarea
            ref={inputRef}
            className="corvus-input"
            value={input}
            onChange={e => { setInput(e.target.value); e.target.style.height="auto"; e.target.style.height=Math.min(e.target.scrollHeight,120)+"px"; }}
            onKeyDown={handleKey}
            placeholder={isAr?"اسأل Dr. Corvus…":"Ask Dr. Corvus anything…"}
            disabled={loading}
            rows={1}
            style={{
              flex:1, background:"rgba(255,255,255,.04)",
              border:`0.5px solid ${C.border}`,
              borderRadius:12, padding:"10px 14px",
              fontSize:13.5, color:C.text, outline:"none",
              resize:"none", fontFamily:"inherit",
              direction: isAr?"rtl":"ltr",
              minHeight:42, maxHeight:120,
              transition:"border-color .15s, box-shadow .15s",
              lineHeight:1.5,
            }}
          />
          <button
            className="corvus-send"
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            style={{
              background: loading||!input.trim() ? "rgba(59,130,246,.25)" : C.blue,
              border:"none", borderRadius:12, width:44, height:44,
              fontSize:18, color:"white", cursor: loading||!input.trim() ? "default" : "pointer",
              transition:"all .2s", flexShrink:0, display:"flex",
              alignItems:"center", justifyContent:"center",
              boxShadow: !loading&&input.trim() ? "0 4px 12px rgba(59,130,246,.3)" : "none",
            }}
          >{loading ? "⟳" : "↑"}</button>
        </div>
      </div>
    </div>
  );
}

