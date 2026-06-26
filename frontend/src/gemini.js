/**
 * gemini.js — AI routing: backend proxy → Groq direct fallback
 *
 * Primary: /api/coach/chat and /api/ai/analyze (22s timeout)
 *   Backend tries: Ollama local → Gemini → returns text
 * Fallback: Groq direct (free, fast, bilingual, runtime key via /api/config)
 *   Only used when backend is completely unreachable (no HTTP response)
 *
 * Groq setup: console.groq.com → API Keys → set as GROQ_KEY in Railway
 *   Vercel Edge Function /api/config exposes it to frontend at runtime
 */

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODELS = [
  "llama-3.1-8b-instant",  // fastest, bilingual AR+EN
  "llama3-8b-8192",
  "gemma2-9b-it",
];

// ── Runtime Groq key — fetched from /api/config (Vercel Edge Function)
// This bypasses Vite tree-shaking which was stripping VITE_GROQ_API_KEY
let _cachedKey = null;
let _keyPromise = null;

async function getGroqKey() {
  if (_cachedKey !== null) return _cachedKey;
  if (_keyPromise) return _keyPromise;
  _keyPromise = (async () => {
    try {
      const res = await fetch("/api/config", { cache: "no-store" });
      if (res.ok) { _cachedKey = (await res.json()).groqKey || ""; return _cachedKey; }
    } catch {}
    if (typeof window !== "undefined" && window.__GROQ_KEY__) {
      _cachedKey = window.__GROQ_KEY__; return _cachedKey;
    }
    _cachedKey = ""; return "";
  })();
  return _keyPromise;
}

async function getAuthToken() {
  try {
    const { getAuth } = await import("firebase/auth");
    const u = getAuth().currentUser;
    return u ? await u.getIdToken() : "";
  } catch { return ""; }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Groq direct call ─────────────────────────────────────────────
async function callGroq(systemPrompt, userPrompt, maxTokens = 600, messages = null) {
  const key = await getGroqKey();
  if (!key) throw new Error("AI_KEY_MISSING");

  const msgs = messages
    ? [{ role: "system", content: systemPrompt || "You are a helpful assistant." }, ...messages]
    : [...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
       { role: "user", content: userPrompt }];

  for (let mi = 0; mi < GROQ_MODELS.length; mi++) {
    const model = GROQ_MODELS[mi];
    for (let retry = 0; retry < 2; retry++) {
      try {
        const res = await fetch(GROQ_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({ model, messages: msgs, max_tokens: maxTokens, temperature: 0.7 }),
          signal: AbortSignal.timeout(25000),
        });
        if (res.ok) {
          const text = (await res.json())?.choices?.[0]?.message?.content?.trim() || "";
          if (text) return text;
          throw new Error("Empty response from AI");
        }
        if (res.status === 429) { if (retry === 0) { await sleep(2500); continue; } break; }
        if (res.status === 401) { _cachedKey = null; throw new Error("AI_KEY_INVALID"); }
        throw new Error((await res.json().catch(() => ({}))).error?.message || `AI error ${res.status}`);
      } catch (e) {
        if (e.message === "AI_KEY_MISSING" || e.message === "AI_KEY_INVALID") throw e;
        if (e.name === "TimeoutError" || e.name === "AbortError") { if (retry === 0) { await sleep(1000); continue; } break; }
        if (retry === 1) throw e;
      }
    }
  }
  throw new Error("AI_BUSY");
}

// ── Rate-limit classifier ─────────────────────────────────────────
function _isRateLimit(status, msg = "") {
  return status === 429 || status === 503 || status === 502 ||
    msg.includes("rate") || msg.includes("quota") || msg.includes("busy");
}

// ── Friendly error messages ───────────────────────────────────────
export function friendlyError(e, lang = "en") {
  const msg = e?.message || "";
  const ar  = lang === "ar";
  if (msg === "AI_KEY_MISSING" || msg.includes("not configured"))
    return ar ? "مفتاح الـ AI مش موجود — تواصل مع الدعم" : "AI not configured — contact support";
  if (msg === "AI_KEY_INVALID")
    return ar ? "مفتاح الـ AI غير صحيح" : "AI key invalid — contact support";
  if (msg === "AI_BUSY" || msg.includes("429") || msg.includes("busy"))
    return ar ? "⏳ الـ AI مشغول — انتظر ثانية وجرب تاني" : "⏳ AI is busy — try again in a moment";
  if (msg.includes("limit_reached") || msg.includes("coach_limit") || msg.includes("Monthly"))
    return ar ? "وصلت لحد الرسائل الشهري — اترقي للـ Elite" : "Monthly AI limit reached — upgrade to Elite";
  if (msg.includes("imeout") || msg.includes("bort"))
    return ar ? "انقطع الاتصال — جرب تاني" : "Connection timed out — try again";
  return ar ? "حصل خطأ — جرب تاني" : "Something went wrong — please try again";
}

// ── geminiChat — AICoach multi-turn ──────────────────────────────
export async function geminiChat(messagesOrPrompt, { systemPrompt = "", maxTokens = 600, lang = "en" } = {}) {
  const messages = Array.isArray(messagesOrPrompt)
    ? messagesOrPrompt
    : [{ role: "user", content: String(messagesOrPrompt) }];

  // 1. Backend proxy
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
    if (_isRateLimit(res.status, errMsg)) throw new Error("AI_BUSY");
    if (res.status < 500) throw new Error(errMsg || `AI error ${res.status}`);
    console.warn(`[AI] backend ${res.status} → Groq fallback`);
  } catch (e) {
    if (backendReachable) throw e;
    console.warn("[AI] backend unreachable →", e.message?.slice(0, 60));
  }

  // 2. Groq fallback
  const groqMsgs = messages.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));
  return callGroq(systemPrompt, "", maxTokens, groqMsgs);
}

// ── geminiAnalysis — single-turn ─────────────────────────────────
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
    if (_isRateLimit(res.status, errMsg)) throw new Error("AI_BUSY");
    if (res.status < 500) throw new Error(errMsg || `AI error ${res.status}`);
    console.warn(`[AI] /ai/analyze ${res.status} → Groq fallback`);
  } catch (e) {
    if (backendReachable) throw e;
    console.warn("[AI] backend unreachable →", e.message?.slice(0, 60));
  }

  return callGroq(context?.system_prompt || "", prompt, maxTokens);
}

// ── buildCoachContext ─────────────────────────────────────────────
export function buildCoachContext(sessions = [], profile = {}) {
  const avg   = sessions.length ? Math.round(sessions.reduce((a,s) => a + (s.avg_score||0), 0) / sessions.length) : 0;
  const best  = sessions.length ? Math.max(...sessions.map(s => s.avg_score||0)) : 0;
  const worst = sessions.length ? Math.min(...sessions.map(s => s.avg_score||0)) : 0;
  const recent = sessions.slice(0,5).map((s,i) =>
    `Session ${i+1}: score=${s.avg_score||0}, duration=${Math.round((s.duration_s||0)/60)}min`
  ).join("\n");
  const trend = sessions.length >= 2 ? (sessions[0].avg_score||0) - (sessions[1].avg_score||0) : 0;
  return `User: ${profile.name||"User"}, Tier: ${profile.tier||"free"}
Sessions: ${sessions.length} | Avg: ${avg}/100 | Best: ${best} | Worst: ${worst}
Trend: ${trend>0?`+${trend} improving`:trend<0?`${trend} declining`:"stable"}
Recent:\n${recent||"No sessions yet"}`.trim();
}
