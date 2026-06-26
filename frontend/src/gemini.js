/**
 * ai.js (as gemini.js) — Unified AI routing
 *
 * Call chain (in order):
 *   1. Backend proxy /api/coach/chat or /api/ai/analyze (22s timeout)
 *      → backend tries: Ollama local LLM → Gemini → returns text
 *   2. Groq direct (free, 14,400 req/day, bilingual AR+EN)
 *      → ONLY if backend is completely unreachable (network error, no HTTP response)
 *      → NOT used if backend returned any HTTP status (4xx/5xx means backend is up)
 *
 * Setup:
 *   VITE_GROQ_API_KEY — get free key at console.groq.com (no credit card)
 *   VITE_API_URL      — backend URL (defaults to /api)
 */

const API_BASE  = import.meta.env.VITE_API_URL || "/api";
const GROQ_KEY  = import.meta.env.VITE_GROQ_API_KEY || "";
const GROQ_URL  = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODELS = [
  "llama-3.1-8b-instant",  // fastest, bilingual AR+EN
  "llama3-8b-8192",        // fallback
  "gemma2-9b-it",          // last resort
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getAuthToken() {
  try {
    const { getAuth } = await import("firebase/auth");
    const user = getAuth().currentUser;
    return user ? await user.getIdToken() : "";
  } catch { return ""; }
}

// ── Groq direct call ─────────────────────────────────────────────
// Only used when backend is completely unreachable (no HTTP response).
async function callGroq(systemPrompt, userPrompt, maxTokens = 600, messagesOverride = null) {
  if (!GROQ_KEY) throw new Error("AI_KEY_MISSING");

  const msgs = messagesOverride
    ? [{ role: "system", content: systemPrompt || "You are a helpful assistant." }, ...messagesOverride]
    : [
        ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
        { role: "user", content: userPrompt },
      ];

  for (let mi = 0; mi < GROQ_MODELS.length; mi++) {
    const model = GROQ_MODELS[mi];
    for (let retry = 0; retry < 2; retry++) {
      try {
        const res = await fetch(GROQ_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_KEY}` },
          body: JSON.stringify({ model, messages: msgs, max_tokens: maxTokens, temperature: 0.7 }),
          signal: AbortSignal.timeout(20000),
        });
        if (res.ok) {
          const text = (await res.json())?.choices?.[0]?.message?.content || "";
          if (text) return text;
          throw new Error("Empty response from AI");
        }
        if (res.status === 429) { if (retry === 0) { await sleep(2000); continue; } break; }
        if (res.status === 401) throw new Error("AI_KEY_INVALID");
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || `AI error ${res.status}`);
      } catch (e) {
        if (e.message === "AI_KEY_MISSING" || e.message === "AI_KEY_INVALID") throw e;
        if (e.name === "TimeoutError" || e.name === "AbortError") { if (retry === 0) { await sleep(1000); continue; } break; }
        throw e;
      }
    }
  }
  throw new Error("AI_BUSY");
}

// ── Error classification ──────────────────────────────────────────
function _isRateLimitOrQuota(status, msg = "") {
  return status === 429 || status === 503 || status === 502 ||
    msg.includes("rate") || msg.includes("quota") || msg.includes("busy");
}

// ── Friendly user-facing error messages ──────────────────────────
export function friendlyError(e, lang = "en") {
  const msg = e?.message || "";
  const ar  = lang === "ar";
  if (msg === "AI_KEY_MISSING" || msg.includes("not configured"))
    return ar ? "الـ AI مش مفعّل — تواصل مع الدعم" : "AI not configured — contact support";
  if (msg === "AI_KEY_INVALID")
    return ar ? "مفتاح AI غير صحيح" : "AI key invalid — contact support";
  if (msg === "AI_BUSY" || msg.includes("busy") || msg.includes("rate-limit"))
    return ar ? "⏳ الـ AI مشغول — انتظر لحظة وحاول تاني" : "⏳ AI is busy — wait a moment and try again";
  if (msg.includes("limit_reached") || msg.includes("coach_limit") || msg.includes("Monthly"))
    return ar ? "وصلت لحد الرسائل الشهري — اترقي للـ Elite" : "Monthly AI limit reached — upgrade to Elite";
  if (msg.includes("timeout") || msg.includes("Timeout") || msg.includes("Abort"))
    return ar ? "انقطع الاتصال — جرب تاني" : "Connection timed out — please try again";
  return ar ? "حصل خطأ — جرب تاني" : "Something went wrong — please try again";
}

/**
 * geminiChat — Multi-turn AI Coach conversation
 * Backend proxy first (Ollama→Gemini), Groq fallback if backend unreachable
 */
export async function geminiChat(messagesOrPrompt, { systemPrompt = "", maxTokens = 600, lang = "en" } = {}) {
  const messages = Array.isArray(messagesOrPrompt)
    ? messagesOrPrompt
    : [{ role: "user", content: String(messagesOrPrompt) }];

  let backendReachable = false;
  try {
    const tok = await getAuthToken();
    const res = await fetch(`${API_BASE}/coach/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
      body: JSON.stringify({ messages, context: { system_prompt: systemPrompt }, lang, max_tokens: maxTokens }),
      signal: AbortSignal.timeout(22000),
    });
    backendReachable = true;

    if (res.ok) return (await res.json()).text || "";

    const err = await res.json().catch(() => ({}));
    const errMsg = err.error || err.message || "";

    if (errMsg.includes("limit_reached") || errMsg.includes("coach_limit"))
      throw new Error(err.message || "coach_limit_reached");
    if (_isRateLimitOrQuota(res.status, errMsg))
      throw new Error("AI_BUSY");
    if (res.status < 500) throw new Error(errMsg || `AI error ${res.status}`);

    // 5xx server error → try Groq
    console.warn(`[AI] backend ${res.status} → Groq fallback`);
  } catch (e) {
    if (backendReachable) throw e; // backend responded → don't retry
    console.warn("[AI] backend unreachable →", e.message?.slice(0, 60));
  }

  // Groq fallback — only if backend had no HTTP response
  const groqMsgs = messages.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));
  return callGroq(systemPrompt, "", maxTokens, groqMsgs);
}

/**
 * geminiAnalysis — Single-turn AI analysis
 * Used by AIInsights, PredictiveAI, AIReports, NotificationsHub, WorkforceAnalytics
 */
export async function geminiAnalysis(prompt, { lang = "en", context = {}, maxTokens = 600 } = {}) {
  let backendReachable = false;
  try {
    const tok = await getAuthToken();
    const res = await fetch(`${API_BASE}/ai/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
      body: JSON.stringify({ prompt, lang, context, max_tokens: maxTokens }),
      signal: AbortSignal.timeout(22000),
    });
    backendReachable = true;

    if (res.ok) return (await res.json()).text || "";

    const err = await res.json().catch(() => ({}));
    const errMsg = err.error || "";
    if (_isRateLimitOrQuota(res.status, errMsg)) throw new Error("AI_BUSY");
    if (res.status < 500) throw new Error(errMsg || `AI error ${res.status}`);

    console.warn(`[AI] /ai/analyze ${res.status} → Groq fallback`);
  } catch (e) {
    if (backendReachable) throw e;
    console.warn("[AI] backend unreachable →", e.message?.slice(0, 60));
  }

  return callGroq(context?.system_prompt || "", prompt, maxTokens);
}

export function buildCoachContext(sessions = [], profile = {}) {
  const avg  = sessions.length ? Math.round(sessions.reduce((a,s) => a + (s.avg_score||0), 0) / sessions.length) : 0;
  const best = sessions.length ? Math.max(...sessions.map(s => s.avg_score||0)) : 0;
  const worst= sessions.length ? Math.min(...sessions.map(s => s.avg_score||0)) : 0;
  const recent = sessions.slice(0,5).map((s,i) =>
    `Session ${i+1}: score=${s.avg_score||0}, duration=${Math.round((s.duration_s||0)/60)}min, good=${s.good_pct||0}%`
  ).join("\n");
  const trend = sessions.length >= 2 ? (sessions[0].avg_score||0) - (sessions[1].avg_score||0) : 0;
  return `User: ${profile.name||"User"}, Tier: ${profile.tier||"free"}
Sessions: ${sessions.length} | Avg: ${avg}/100 | Best: ${best} | Worst: ${worst}
Trend: ${trend>0?`+${trend} improving`:trend<0?`${trend} declining`:"stable"}
Recent:\n${recent||"No sessions yet"}`.trim();
}
