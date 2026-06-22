import { useState, useRef, useEffect, useCallback } from "react";
import { geminiChat, buildCoachContext } from "./gemini.js";

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
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  const DARK = cs || {
    bg: "#030b14", card: "#05101f", card2: "#080f1e",
    border: "rgba(148,163,184,.1)", text: "#f0f4f8",
    muted: "#64748b", blue: "#1a56db",
  };

  // ── Coach limits — defined here so T object can reference coachLimitLabel ──
  const canUseCoach = true;
  const isElite = true;
  const TIER_LIMITS = { standard: 5, basic: 10, pro: 30, professional: 50, elite: -1, premium: -1, enterprise: -1 };
  const coachLimit      = TIER_LIMITS[profile?.tier] ?? 5;
  const coachLimitLabel = coachLimit === -1
    ? (lang === "ar" ? "غير محدود" : "Unlimited")
    : `${coachLimit} ${lang === "ar" ? "رسالة/شهر" : "msgs/month"}`;

  const T = {
    en: {
      title:       "AI Posture Coach",
      subtitle:    `Powered by Gemini AI — ${coachLimitLabel}`,
      placeholder: "Ask me anything about your posture…",
      send:        "Send",
      clear:       "Clear chat",
      thinking:    "Coach is thinking…",
      elite_only:  "AI Coach is available on the Professional tier and above.",
      upgrade:     "Upgrade to Professional →",
      welcome:     `Hi ${profile?.name?.split(" ")[0] || "there"}! 👋 I'm your personal posture coach. I can see your analytics — your average score is **${sessions?.length ? Math.round(sessions.reduce((a,s) => a+(s.avg_score||0),0)/sessions.length) : "—"}/100** from ${sessions?.length||0} sessions.\n\nAsk me anything — why you have pain, how to improve, or what your worst posture times are.`,
      welcome_ar:  `أهلاً ${profile?.name?.split(" ")[0] || ""}! 👋 أنا مدربك الشخصي للوضعية. أقدر أشوف بياناتك — متوسط نتيجتك **${sessions?.length ? Math.round(sessions.reduce((a,s) => a+(s.avg_score||0),0)/sessions.length) : "—"}/100** من ${sessions?.length||0} جلسة.\n\nاسألني أي حاجة — عن الألم، التحسين، أو أوقات الوضعية السيئة.`,
    },
    ar: {
      title:       "مدرب الوضعية الذكي",
      subtitle:    `مدعوم بـ Gemini AI — ${coachLimitLabel}`,
      placeholder: "اسألني أي حاجة عن وضعيتك…",
      send:        "إرسال",
      clear:       "مسح المحادثة",
      thinking:    "المدرب بيفكر…",
      elite_only:  "مدرب AI متاح لمشتركي Professional وما فوق.",
      upgrade:     "اشترك في Professional ←",
    },
  };
  const t = T[lang] || T.en;
  const isAr = lang === "ar";


  // Build analytics context for Gemini
  const context = {
    avg_score:       sessions?.length ? Math.round(sessions.reduce((a,s) => a+(s.avg_score||0),0)/sessions.length) : 0,
    sessions_count:  sessions?.length || 0,
    worst_time:      "—",
    top_alerts:      [],
    has_calibration: !!calibration,
    tier:            profile?.tier || "professional",
  };

  // Welcome message — re-run when lang changes so it stays in correct language
  useEffect(() => {
    const welcome = isAr ? t.welcome_ar : t.welcome;
    setMessages([{ role: "assistant", content: welcome, ts: Date.now() }]);
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = useCallback(async (text) => {
    const userMsg = text.trim() || input.trim();
    if (!userMsg || loading) return;
    setInput("");
    setError("");

    const newMessages = [...messages, { role: "user", content: userMsg, ts: Date.now() }];
    setMessages(newMessages);
    setLoading(true);

    try {
      // Build proper messages array for geminiChat (backend expects [{role,content}])
      // Take last 8 messages, map role names to "user"/"assistant"
      const messagesPayload = newMessages.slice(-8).map(m => ({
        role:    m.role === "user" ? "user" : "assistant",
        content: m.content,
      }));

      const systemPrompt = isAr
        ? `أنت مدرب وضعية جسم شخصي ذكي. استخدم البيانات التالية:\n${context}\nكن موجزاً ومفيداً وودوداً. أجب بالعربية.`
        : `You are a personal posture coach. Use this user data:\n${context}\nBe concise, helpful and friendly.`;

      const reply = await geminiChat(messagesPayload, { systemPrompt, lang: isAr ? "ar" : "en", maxTokens: 512 });
      setMessages(prev => [...prev, { role: "assistant", content: reply, ts: Date.now() }]);
    } catch (e) {
      setError(isAr ? "خطأ في الاتصال بـ AI" : "AI connection error — " + (e?.message || "unknown"));
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, messages, loading, context, lang, isAr]);

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  // ── Non-elite paywall ────────────────────────────────────────────
  if (!isElite) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9200, backdropFilter: "blur(8px)" }}>
        <div style={{ background: DARK.card, border: `0.5px solid ${DARK.border}`, borderRadius: 20, padding: 32, maxWidth: 400, width: "92%", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🤖</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: DARK.text, marginBottom: 8 }}>{t.title}</div>
          <div style={{ fontSize: 13, color: DARK.muted, marginBottom: 24, lineHeight: 1.6 }}>{t.elite_only}</div>
          <button onClick={onClose} style={{ background: "#1a56db", border: "none", borderRadius: 9, padding: "12px 28px", fontSize: 13, fontWeight: 600, color: "white", cursor: "pointer", marginRight: isAr ? 0 : 10, marginLeft: isAr ? 10 : 0 }}>{t.upgrade}</button>
          <button onClick={onClose} style={{ background: "none", border: `0.5px solid ${DARK.border}`, borderRadius: 9, padding: "12px 20px", fontSize: 12, color: DARK.muted, cursor: "pointer" }}>{isAr ? "رجوع" : "Back"}</button>
        </div>
      </div>
    );
  }

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
            <div style={{ fontSize: 11, color: "#ef4444", textAlign: "center", padding: "8px 14px", background: "rgba(239,68,68,.08)", borderRadius: 8 }}>
              {error}
              {error.includes("limit") && (
                <div style={{ marginTop: 6 }}>
                  <a href="/pricing" style={{ color: "#93c5fd", fontSize: 11, fontWeight: 600 }}>
                    {isAr ? "⬆ ترقية للمزيد ←" : "⬆ Upgrade for more →"}
                  </a>
                </div>
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
            placeholder={t.placeholder}
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
            disabled={loading || !input.trim()}
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

