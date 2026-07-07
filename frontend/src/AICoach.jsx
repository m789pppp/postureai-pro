import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { geminiChat, buildCoachContext, friendlyError } from "./gemini.js";
import { getLocalAIStatus, onLocalAIStatus } from "./localAI.js";
import { qualityFor, coachLimitLabel as tierCoachLimitLabel } from "./lib/tierQuality.js";

// ── Markdown renderer (lightweight) ──────────────────────────────
function MdText({ text }) {
  const html = text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g,     "<em>$1</em>")
    .replace(/^### (.+)$/gm,   "<h4 style='margin:8px 0 4px;font-size:13px;font-weight:700'>$1</h4>")
    .replace(/^## (.+)$/gm,    "<h3 style='margin:10px 0 5px;font-size:14px;font-weight:700'>$1</h3>")
    .replace(/^- (.+)$/gm,     "<li style='margin:3px 0'>$1</li>")
    .replace(/(<li[\s\S]+<\/li>)/g, "<ul style='padding-left:18px;margin:6px 0'>$1</ul>")
    .replace(/\n\n/g, "<br/><br/>")
    .replace(/\n/g,   "<br/>");
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

// ── Typing indicator ──────────────────────────────────────────────
function TypingDots({ cs }) {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "10px 14px" }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: "50%",
          background: cs.blue || "#1a56db",
          animation: `blink 1.2s ease ${i * 0.2}s infinite`,
          opacity: 0.5,
        }} />
      ))}
      <style>{`@keyframes blink{0%,80%,100%{opacity:.3}40%{opacity:1}}`}</style>
    </div>
  );
}

// ── Suggestion chips ──────────────────────────────────────────────
const SUGGESTIONS = {
  en: [
    "Why does my neck hurt?",
    "What's my biggest posture problem?",
    "When is my posture worst?",
    "Give me a 5-minute stretch routine",
    "How can I improve my score this week?",
    "What's the best monitor height for me?",
  ],
  ar: [
    "ليه بتألمني رقبتي؟",
    "إيه أكبر مشكلة في وضعيتي؟",
    "امتى بتبقى وضعيتي أسوأ؟",
    "ديني روتين تمديد 5 دقائق",
    "إزاي أحسّن نتيجتي الأسبوع ده؟",
    "إيه أنسب ارتفاع للشاشة بالنسبالي؟",
  ],
};

// ── Main AI Coach Component ───────────────────────────────────────
export function AICoach({ profile, sessions, calibration, cs, lang = "en", onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState("");
  const [loading,      setLoading]     = useState(false);
  const [error,        setError]       = useState("");
  const [localAIReady, setLocalAIReady]= useState(getLocalAIStatus().ready);
  const [localAIStatus,setLocalAIStatus]=useState(getLocalAIStatus());

  useEffect(() => {
    const unsub = onLocalAIStatus(s => { setLocalAIReady(s.ready); setLocalAIStatus(s); });
    // Auto-start download immediately when coach opens (don't wait for first message)
    import("./localAI.js").then(({ initLocalAI }) => initLocalAI()).catch(() => {});
    return unsub;
  }, []);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  const DARK = cs || {
    bg: "#030b14", card: "#05101f", card2: "#080f1e",
    border: "rgba(148,163,184,.1)", text: "#f0f4f8",
    muted: "#64748b", blue: "#1a56db",
  };

  // ── Coach quality/limits — single source of truth, correctly handles
  //    B2B plans (b2b_growth/b2b_enterprise) via featureTier() mapping ──
  const quality        = qualityFor(profile?.tier);
  const coachLimit      = quality.aiCoach.monthlyLimit;
  const coachLimitLabel = tierCoachLimitLabel(profile?.tier, lang);

  const T = {
    en: {
      title:       "AI Posture Coach",
      subtitle:    `AI-powered — ${coachLimitLabel}`,
      placeholder: "Ask me anything about your posture…",
      send:        "Send",
      clear:       "Clear chat",
      thinking:    "Coach is thinking…",
      welcome:     `Hi ${profile?.name?.split(" ")[0] || "there"}! 👋 I'm your personal posture coach. I can see your analytics — your average score is **${sessions?.length ? Math.round(sessions.reduce((a,s) => a+(s.avg_score||0),0)/sessions.length) : "—"}/100** from ${sessions?.length||0} sessions.\n\nAsk me anything — why you have pain, how to improve, or what your worst posture times are.`,
      welcome_ar:  `أهلاً ${profile?.name?.split(" ")[0] || ""}! 👋 أنا مدربك الشخصي للوضعية. أقدر أشوف بياناتك — متوسط نتيجتك **${sessions?.length ? Math.round(sessions.reduce((a,s) => a+(s.avg_score||0),0)/sessions.length) : "—"}/100** من ${sessions?.length||0} جلسة.\n\nاسألني أي حاجة — عن الألم، التحسين، أو أوقات الوضعية السيئة.`,
    },
    ar: {
      title:       "مدرب الوضعية الذكي",
      subtitle:    `مدعوم بالذكاء الاصطناعي — ${coachLimitLabel}`,
      placeholder: "اسألني أي حاجة عن وضعيتك…",
      send:        "إرسال",
      clear:       "مسح المحادثة",
      thinking:    "المدرب بيفكر…",
    },
  };
  const t = T[lang] || T.en;
  const isAr = lang === "ar";


  // Build analytics context for backend — must be a plain object (backend reads individual fields)
  const context = useMemo(() => {
    const avgScore = sessions?.length
      ? Math.round(sessions.reduce((a,s) => a + (s.avg_score||0), 0) / sessions.length)
      : 0;

    // Worst posture time: find the session hour where score was lowest
    const hourBuckets = {};
    (sessions || []).forEach(s => {
      const d = s.created_at?.toDate ? s.created_at.toDate() : s.created_at ? new Date(s.created_at) : null;
      if (!d) return;
      const h = d.getHours();
      if (!hourBuckets[h]) hourBuckets[h] = { total: 0, count: 0 };
      hourBuckets[h].total += s.avg_score || 0;
      hourBuckets[h].count += 1;
    });
    let worstHour = "—", worstAvg = 999;
    Object.entries(hourBuckets).forEach(([h, {total, count}]) => {
      const avg = total / count;
      if (avg < worstAvg) { worstAvg = avg; worstHour = `${h}:00`; }
    });

    // Top alerts: most common alert strings across recent sessions
    const alertCounts = {};
    (sessions || []).slice(0, 20).forEach(s => {
      (s.metrics ? Object.values(s.metrics) : []).forEach(m => {
        if (m?.score < 60 && m?.label) {
          alertCounts[m.label] = (alertCounts[m.label] || 0) + 1;
        }
      });
    });
    const topAlerts = Object.entries(alertCounts)
      .sort((a,b) => b[1]-a[1])
      .slice(0, 3)
      .map(([label]) => label);

    return {
      avg_score:       avgScore,
      sessions_count:  sessions?.length || 0,
      worst_time:      worstHour,
      top_alerts:      topAlerts,
      has_calibration: !!calibration,
      tier:            profile?.tier || "standard",
    };
  }, [sessions, calibration, profile?.tier]);

  // Welcome message — re-run when lang changes so it stays in correct language
  useEffect(() => {
    const welcome = isAr ? t.welcome_ar : t.welcome;
    setMessages([{ role: "assistant", content: welcome, ts: Date.now() }]);
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = useCallback(async (text) => {
    const userMsg = (typeof text === "string" ? text : input).trim();
    if (!userMsg || loading) return;
    setInput("");
    setError("");

    const newMessages = [...messages, { role: "user", content: userMsg, ts: Date.now() }];
    setMessages(newMessages);
    setLoading(true);

    try {
      // Build proper messages array — take last 8, strip UI-only ts field
      const messagesPayload = newMessages.slice(-8).map(m => ({
        role:    m.role === "user" ? "user" : "assistant",
        content: m.content,
      }));

      const _scoreLabel = context.avg_score >= 85 ? "Excellent" : context.avg_score >= 70 ? "Good" : context.avg_score >= 55 ? "Fair" : "Needs Attention";
      const _neckRisk   = context.neck_risk || 0;
      const _fatigue    = context.fatigue_score || 0;
      const _topAlerts  = (context.top_alerts || []).slice(0, 4).join("; ") || "None recorded";
      const _calib      = context.has_calibration ? "COMPLETE — personalized thresholds active" : "NOT DONE — generic population thresholds";

      const systemPrompt = isAr
        ? `أنت دكتور كورفوس — الفيزيوثيرابيست الذكي داخل منصة Corvus PostureAI Pro.

هويتك: متخصص في الإرجونوميكس وصحة الجهاز العضلي الهيكلي. مش بوت عادي.
متقولش "أنا ذكاء اصطناعي" — أنت دكتور كورفوس.

خبرتك السريرية:
- الجهاز العضلي الهيكلي: عنق، ظهر، كتفين، معصم، حوض
- متلازمات الوضعية: الرأس المتقدم (FHP)، متلازمة كروس العلوية والسفلية لـ Janda، الحداب، القعس
- البيومكانيكا: معادلة Hansraj 2014 لحمل الرقبة (0°=4.5kg ← 45°=22kg)، نموذج ضغط الديسك Nachemson
- الأدلة العلمية: NIOSH 1997، معايير OSHA، ISO 11226، إرشادات Cornell Human Factors

بيانات المريض (مهمة — لازم تذكرها في كل رد):
- درجة الوضعية الإجمالية: ${context.avg_score}/100 (${_scoreLabel})
- إجمالي الجلسات: ${context.sessions_count} | أسوأ وقت: ${context.worst_time || "غير محدد"}
- خطر الرقبة: ${_neckRisk}% | مؤشر الإجهاد: ${_fatigue}%
- المعايرة الجسدية: ${context.has_calibration ? "مكتملة — عتبات شخصية" : "لم تُكمل — عتبات عامة"}
- التنبيهات المتكررة: ${_topAlerts}

مبادئ الرد:
1. اذكر أرقام المريض الفعلية في كل رد — ما تتكلمش بشكل عام.
2. لكل توصية: إيه (التصحيح) ← ليه (الآلية التشريحية) ← إزاي (خطوات دقيقة) ← الفائدة ← الجدول الزمني.
3. متقولش "حافظ على وضعية جيدة" — وصف التصحيح التشريحي المحدد والعضلة المستهدفة.
4. استشهد بالأبحاث بشكل طبيعي: "هانسراج 2014 أثبت إن عند 45° انحناء الرقبة، الحمل بيوصل 22 كيلو..."
5. استخدم مصطلحات تشريحية مع شرح بسيط: "العضلات العنقية العميقة (longuس colli — كورسيه العمود الفقري الداخلي)..."
6. ⚕️ علّم العلامات التحذيرية: ألم متشع، تنميل، ضعف من جانب واحد → وصي بمراجعة طبيب.
7. الشكل: **خط عريض** للمصطلحات المهمة، أرقام للبروتوكولات، عناوين للردود متعددة الأجزاء.
8. الحدود الموضوعية: وضعية، إرجونوميكس، صحة عضلية هيكلية، إعداد مكان العمل، تمارين فيزيوثيرابي فقط.
9. ردود المحادثة: 150-220 كلمة. للتقارير الكاملة: حتى 350 كلمة.

أسلوب المحادثة:
- جاوب على اللي اتسأل فعلاً — متعطيش رد قالبي.
- لو بيشكي من ألم: قيّمه سريرياً (المكان، الطبيعة، الانتشار، العوامل المحسِّنة والمحسِّنة).
- اختم بسؤال متابعة واحد مركّز لما يكون مناسب سريرياً.
اللغة: رد بالعامية المصرية بالكامل.`
        : `You are Dr. Corvus — the AI physiotherapist embedded in Corvus PostureAI Pro.

IDENTITY: Certified ergonomics consultant and physiotherapy specialist. Not a generic chatbot.
Never say "I'm an AI" — you are Dr. Corvus.

CLINICAL EXPERTISE:
- MSK anatomy: cervical/thoracic/lumbar spine, shoulder girdle, carpal tunnel, hip flexors, sacroiliac joint
- Postural syndromes: Forward Head Posture, Upper/Lower Crossed Syndrome (Janda), kyphosis, lordosis, APT, piriformis syndrome
- Biomechanics: Hansraj cervical load model (2014) — 0°=4.5kg, 15°=12kg, 30°=18kg, 45°=22kg, 60°=27kg
- Evidence base: NIOSH 1997, OSHA ergonomics standards, ISO 11226, Cornell Human Factors (Hedge 2017)

PATIENT CLINICAL DATA (always reference these numbers):
- Overall posture score: ${context.avg_score}/100 (${_scoreLabel})
- Total sessions: ${context.sessions_count} | Worst window: ${context.worst_time || "not identified"}
- Cervical risk: ${_neckRisk}% | Fatigue index: ${_fatigue}%
- Calibration: ${_calib}
- Recurring alerts: ${_topAlerts}

RESPONSE PRINCIPLES:
1. Reference the patient's ACTUAL data numbers in every response — never be generic.
2. For every recommendation: WHAT → WHY (mechanism) → HOW (precise steps) → BENEFIT → TIMEFRAME.
3. NEVER say "maintain good posture." Describe the specific anatomical correction.
4. Cite evidence naturally: "Hansraj (2014) showed at 45° neck flexion, cervical load reaches 22 kg..."
5. Use clinical language with plain explanations: "the deep cervical flexors (your spine's inner corset)..."
6. ⚕️ Flag red flags (radiating pain, paresthesia, unilateral weakness) → recommend professional evaluation.
7. Format: **bold** key terms, numbered steps for protocols, short headers for multi-part answers.
8. TOPIC BOUNDARY: posture, ergonomics, MSK health, workspace, physiotherapy exercises ONLY.
9. Conversational responses: 150-220 words. Explicit report requests: up to 350 words.

CONVERSATION STYLE:
- Respond to what was actually asked — don't give a template.
- Pain reports: assess clinically (location, character, radiation, aggravating/relieving factors).
- End with ONE focused follow-up question when clinically appropriate.`;

      const reply = await geminiChat(messagesPayload, {
        systemPrompt,
        lang: isAr ? "ar" : "en",
        maxTokens: quality.aiCoach.maxTokens,
        context,
      });
      setMessages(prev => [...prev, { role: "assistant", content: reply, ts: Date.now() }]);
    } catch (e) {
      // Don't show error if AI is still downloading — just wait
      if (!getLocalAIStatus().loading) {
        setError(friendlyError(e, isAr ? "ar" : "en"));
      }
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, messages, loading, context, lang, isAr, quality]);

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  // ── Full coach UI ─────────────────────────────────────────────────
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9200, backdropFilter: "blur(8px)" }}>
      <div style={{
        background: DARK.card, border: `0.5px solid ${DARK.border}`,
        borderRadius: 20, width: "min(640px,96vw)", height: "min(700px,92vh)",
        display: "flex", flexDirection: "column", overflow: "hidden",
        direction: isAr ? "rtl" : "ltr",
      }}>

        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: `0.5px solid ${DARK.border}`, display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg,#1a56db,#0891b2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🤖</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: DARK.text }}>{t.title}</div>
            <div style={{ fontSize: 10, color: "#6366f1" }}>{t.subtitle}</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setMessages([{ role: "assistant", content: isAr ? t.welcome_ar : t.welcome, ts: Date.now() }])} style={{ background: "none", border: `0.5px solid ${DARK.border}`, borderRadius: 7, padding: "5px 10px", fontSize: 10, color: DARK.muted, cursor: "pointer" }}>{t.clear}</button>
            <button onClick={onClose} style={{ background: "none", border: `0.5px solid ${DARK.border}`, borderRadius: 7, padding: "5px 10px", fontSize: 11, color: DARK.muted, cursor: "pointer" }}>✕</button>
          </div>
        </div>

        {/* Context bar */}
        <div style={{ padding: "8px 20px", background: "rgba(99,102,241,.05)", borderBottom: `0.5px solid ${DARK.border}`, display: "flex", gap: 14, flexShrink: 0, overflowX: "auto" }}>
          {[
            ["📊", isAr ? `${context.avg_score}/100 معدل` : `${context.avg_score}/100 avg`],
            ["📅", isAr ? `${context.sessions_count} جلسة` : `${context.sessions_count} sessions`],
            ["🎯", context.has_calibration ? (isAr ? "معايَر ✓" : "Calibrated") : (isAr ? "غير معايَر" : "Not calibrated")],
            ["⭐", profile?.tier || "standard"],
            [coachLimit === -1 ? "💬" : "💬", coachLimit === -1 ? (isAr ? "∞ رسائل" : "∞ msgs") : `${coachLimit} ${isAr ? "رسالة/شهر" : "msgs/mo"}`],
          ].map(([icon, label]) => (
            <div key={label} style={{ fontSize: 10, color: DARK.muted, whiteSpace: "nowrap", display: "flex", gap: 4, alignItems: "center" }}>
              <span>{icon}</span><span>{label}</span>
            </div>
          ))}
        </div>

        {/* AI status indicator */}
        {!localAIReady && localAIStatus.loading && (
          <div style={{ padding: "8px 20px", background: "rgba(26,86,219,.06)", borderBottom: `0.5px solid ${DARK.border}`, flexShrink: 0, fontSize: 10.5, color: DARK.muted, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#93c5fd", display: "inline-block", animation: "pulse 1.2s ease infinite" }} />
            {isAr ? "جاري الاتصال بـ AI…" : "Connecting to AI…"}
            <style>{`@keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}`}</style>
          </div>
        )}

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", flexDirection: msg.role === "user" ? (isAr ? "row" : "row-reverse") : "row" }}>
              {/* Avatar */}
              <div style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
                background: msg.role === "user" ? "#1a56db" : "linear-gradient(135deg,#1a56db,#0891b2)", }}>
                {msg.role === "user" ? "👤" : "🤖"}
              </div>
              {/* Bubble */}
              <div style={{
                maxWidth: "78%",
                background: msg.role === "user" ? "#1a56db" : "rgba(148,163,184,.07)",
                border: msg.role === "user" ? "none" : `0.5px solid ${DARK.border}`,
                borderRadius: msg.role === "user" ? "14px 4px 14px 14px" : "4px 14px 14px 14px",
                padding: "10px 14px", fontSize: 13, color: DARK.text, lineHeight: 1.65,
              }}>
                <MdText text={msg.content} />
                <div style={{ fontSize: 9, color: msg.role === "user" ? "rgba(255,255,255,.4)" : DARK.muted, marginTop: 5, textAlign: "right" }}>
                  {new Date(msg.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg,#1a56db,#0891b2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🤖</div>
              <div style={{ background: "rgba(148,163,184,.07)", border: `0.5px solid ${DARK.border}`, borderRadius: "4px 14px 14px 14px" }}>
                <TypingDots cs={DARK} />
              </div>
            </div>
          )}
          {error && (
            <div style={{ fontSize: 11, color: "#ef4444", textAlign: "center", padding: "10px 14px", background: "rgba(239,68,68,.08)", borderRadius: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              <span>{error}</span>
              {error.includes("limit") && (
                <a href="/pricing" style={{ color: "#93c5fd", fontSize: 11, fontWeight: 600 }}>
                  {isAr ? "⬆ ترقية للمزيد ←" : "⬆ Upgrade for more →"}
                </a>
              )}
              {!error.includes("WebGPU") && !error.includes("browser") && !error.includes("المتصفح") && (
                <button onClick={() => { setError(""); sendMessage(messages[messages.length - 2]?.content || ""); }}
                  style={{ background: "rgba(26,86,219,.2)", border: "1px solid rgba(26,86,219,.4)", borderRadius: 6, padding: "4px 12px", fontSize: 11, fontWeight: 700, color: "#93c5fd", cursor: "pointer", alignSelf: "center" }}>
                  {isAr ? "⟳ أعد المحاولة" : "⟳ Retry"}
                </button>
              )}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Suggestions (show only at start) */}
        {messages.length <= 1 && (
          <div style={{ padding: "0 20px 10px", display: "flex", gap: 6, flexWrap: "wrap", flexShrink: 0 }}>
            {(SUGGESTIONS[lang] || SUGGESTIONS.en).map((s, i) => (
              <button key={i} onClick={() => sendMessage(s)} style={{
                background: "rgba(26,86,219,.08)", border: "0.5px solid rgba(26,86,219,.2)",
                borderRadius: 99, padding: "5px 12px", fontSize: 11, color: "#93c5fd",
                cursor: "pointer", transition: "background .15s",
              }}>{s}</button>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{ padding: "12px 16px", borderTop: `0.5px solid ${DARK.border}`, display: "flex", gap: 8, flexShrink: 0 }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={!localAIReady && localAIStatus.loading
              ? (isAr ? "بيتحمّل AI… لحظة" : "Downloading AI… please wait")
              : t.placeholder}
            disabled={loading || (!localAIReady && localAIStatus.loading)}
            rows={1}
            style={{
              flex: 1, background: "rgba(148,163,184,.06)",
              border: `0.5px solid ${DARK.border}`, borderRadius: 10,
              padding: "10px 14px", fontSize: 13, color: DARK.text,
              outline: "none", resize: "none", fontFamily: "inherit",
              direction: isAr ? "rtl" : "ltr",
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim() || (!localAIReady && localAIStatus.loading)}
            style={{
              background: loading || !input.trim() ? "rgba(26,86,219,.3)" : "#1a56db",
              border: "none", borderRadius: 10, padding: "0 18px",
              fontSize: 12, fontWeight: 600, color: "white", cursor: loading ? "wait" : "pointer",
              transition: "background .2s", flexShrink: 0,
            }}
          >{t.send} ↵</button>
        </div>
      </div>
    </div>
  );
}

