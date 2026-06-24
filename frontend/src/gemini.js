/**
 * gemini.js — AI calls with smart fallback chain + 429 retry logic
 * Priority: Backend proxy → Direct Gemini → Direct Groq (free) → Friendly error
 */

const API_BASE   = import.meta.env.VITE_API_URL || "/api";
const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const GROQ_KEY   = import.meta.env.VITE_GROQ_API_KEY || "";

// Gemini models
const GEMINI_URL    = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
const GEMINI_URL_FB = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent";

// Groq (free tier: 14,400 req/day — no credit card needed)
// Get key at: console.groq.com → API Keys → Create API Key
const GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODELS = ["llama-3.1-8b-instant", "gemma2-9b-it"];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getAuthToken() {
  try {
    const { getAuth } = await import("firebase/auth");
    const user = getAuth().currentUser;
    return user ? await user.getIdToken() : "";
  } catch { return ""; }
}

// ── Direct Groq call (free, no key needed from user) ─────────────────
async function _directGroq(systemPrompt, userPrompt, maxTokens = 600) {
  if (!GROQ_KEY) return null; // silently skip if key not set

  const messages = [
    ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
    { role: "user", content: userPrompt },
  ];

  for (const model of GROQ_MODELS) {
    try {
      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_KEY}`,
        },
        body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.7 }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const d = await res.json();
        const text = d?.choices?.[0]?.message?.content || "";
        if (text) return text;
      }
      if (res.status !== 429) break; // non-429 error → stop trying
    } catch {
      break;
    }
  }
  return null; // Groq also failed — caller will throw friendly error
}

// ── Direct Gemini call with retry + model fallback for 429 ───────────
async function _directGemini(systemPrompt, userPrompt, maxTokens = 600) {
  if (!GEMINI_KEY) return null;

  const contents = [
    ...(systemPrompt ? [
      { role: "user",  parts: [{ text: systemPrompt }] },
      { role: "model", parts: [{ text: "Understood." }] },
    ] : []),
    { role: "user", parts: [{ text: userPrompt }] },
  ];
  const body = JSON.stringify({
    contents,
    generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
  });

  const models = [GEMINI_URL, GEMINI_URL_FB];
  for (let mi = 0; mi < models.length; mi++) {
    const url = `${models[mi]}?key=${GEMINI_KEY}`;
    for (let retry = 0; retry < 2; retry++) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
        if (res.ok) {
          const d = await res.json();
          const text = d?.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (text) return text;
        }
        if (res.status === 429) {
          if (retry === 0) { await sleep(3000); continue; }
          break; // try next model
        }
        // Other errors
        const errBody = await res.json().catch(() => ({}));
        console.warn("[Gemini] error:", errBody?.error?.message);
        return null;
      } catch { return null; }
    }
  }
  return null; // rate limited on all models
}

// ── Friendly error messages ───────────────────────────────────────────
function friendlyError(e, lang = "en") {
  const msg = e?.message || "";
  if (msg.includes("limit_reached") || msg.includes("coach_limit"))
    return lang === "ar"
      ? "وصلت لحد الـ AI للشهر ده — اترقي للـ Elite للرسائل غير المحدودة"
      : "Monthly AI limit reached — upgrade to Elite for unlimited messages";
  if (msg.includes("not configured") || msg.includes("VITE_GEMINI"))
    return lang === "ar" ? "خدمة AI مش مفعّلة — تواصل مع الدعم" : "AI service not active — contact support";
  if (msg.includes("429") || msg.includes("busy") || msg.includes("rate"))
    return lang === "ar"
      ? "الـ AI مشغول دلوقتي — انتظر ثانية وجرب تاني"
      : "AI is busy right now — wait a moment and try again";
  if (msg.includes("timeout") || msg.includes("abort"))
    return lang === "ar" ? "انقطع الاتصال — جرب تاني" : "Connection timed out — please try again";
  return lang === "ar" ? "حصل خطأ في الـ AI — جرب تاني" : "AI error — please try again";
}

/**
 * Main chat — backend → Gemini direct → Groq free → friendly error
 */
export async function geminiChat(messagesOrPrompt, { systemPrompt = "", maxTokens = 600, lang = "en" } = {}) {
  const messages = Array.isArray(messagesOrPrompt)
    ? messagesOrPrompt
    : [{ role: "user", content: String(messagesOrPrompt) }];

  // ── 1. Try backend ───────────────────────────────────────────────
  try {
    const tok = await getAuthToken();
    const res = await fetch(`${API_BASE}/coach/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
      },
      body: JSON.stringify({ messages, context: { system_prompt: systemPrompt }, lang, max_tokens: maxTokens }),
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      const data = await res.json();
      return data.text || data.response || "";
    }

    const err = await res.json().catch(() => ({}));
    if (err.error === "coach_limit_reached")
      throw new Error(err.message || "coach_limit_reached");
    if (res.status !== 404 && res.status < 500)
      throw new Error(err.error || err.message || `AI error ${res.status}`);
    console.warn(`[AI] backend ${res.status} — trying direct fallback`);
  } catch (e) {
    if (e.message?.includes("limit_reached") || e.message?.includes("coach_limit")) throw e;
    console.warn("[AI] backend unreachable:", e.message);
  }

  const lastPrompt = messages[messages.length - 1]?.content || "";

  // ── 2. Try Gemini direct ─────────────────────────────────────────
  const geminiResult = await _directGemini(systemPrompt, lastPrompt, maxTokens);
  if (geminiResult) return geminiResult;

  // ── 3. Try Groq (free) ───────────────────────────────────────────
  const groqResult = await _directGroq(systemPrompt, lastPrompt, maxTokens);
  if (groqResult) return groqResult;

  // ── All failed — friendly error ──────────────────────────────────
  throw new Error(lang === "ar"
    ? "الـ AI مش متاح دلوقتي — جرب بعد شوية"
    : "AI is temporarily unavailable — please try again in a moment"
  );
}

/**
 * Generic AI analysis — backend → Gemini → Groq → friendly error
 */
export async function geminiAnalysis(prompt, { lang = "en", context = {}, maxTokens = 600 } = {}) {
  // ── 1. Try backend ───────────────────────────────────────────────
  try {
    const tok = await getAuthToken();
    const res = await fetch(`${API_BASE}/ai/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
      },
      body: JSON.stringify({ prompt, lang, context, max_tokens: maxTokens }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = await res.json();
      return data.text || data.response || "";
    }
    const err = await res.json().catch(() => ({}));
    if (res.status !== 404 && res.status < 500)
      throw new Error(err.error || `AI error ${res.status}`);
    console.warn(`[AI] /ai/analyze ${res.status} — direct fallback`);
  } catch (e) {
    if (e.message?.includes("AI error")) throw e;
    console.warn("[AI] backend unreachable:", e.message);
  }

  const systemCtx = context?.system_prompt || "";

  // ── 2. Try Gemini direct ─────────────────────────────────────────
  const geminiResult = await _directGemini(systemCtx, prompt, maxTokens);
  if (geminiResult) return geminiResult;

  // ── 3. Try Groq (free) ───────────────────────────────────────────
  const groqResult = await _directGroq(systemCtx, prompt, maxTokens);
  if (groqResult) return groqResult;

  throw new Error(lang === "ar"
    ? "تحليل الـ AI مش متاح دلوقتي"
    : "AI analysis temporarily unavailable"
  );
}

// Re-export friendly error helper for use in components
export { friendlyError };

export function buildCoachContext(sessions = [], profile = {}) {
  const avg    = sessions.length ? Math.round(sessions.reduce((a,s) => a + (s.avg_score||0), 0) / sessions.length) : 0;
  const best   = sessions.length ? Math.max(...sessions.map(s => s.avg_score||0)) : 0;
  const worst  = sessions.length ? Math.min(...sessions.map(s => s.avg_score||0)) : 0;
  const recent = sessions.slice(0,5).map((s,i) =>
    `Session ${i+1}: score=${s.avg_score||0}, duration=${Math.round((s.duration_s||0)/60)}min, good=${s.good_pct||0}%`
  ).join("\n");
  const trend = sessions.length >= 2 ? (sessions[0].avg_score||0) - (sessions[1].avg_score||0) : 0;
  return `
User: ${profile.name || "User"}, Tier: ${profile.tier || "free"}
Sessions: ${sessions.length} total | Avg: ${avg}/100 | Best: ${best} | Worst: ${worst}
Trend: ${trend > 0 ? `+${trend} improving` : trend < 0 ? `${trend} declining` : "stable"}
Recent:\n${recent || "No sessions yet"}
  `.trim();
}
