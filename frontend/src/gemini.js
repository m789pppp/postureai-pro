/**
 * gemini.js — AI calls via backend proxy (primary) + direct Gemini (last resort)
 * Primary: backend proxy (/api/coach/chat, /api/ai/analyze)
 *   - Handles Ollama local LLM first, then Gemini with server-side retry
 *   - Timeout: 22s (Railway cold-start can take 10-15s on first request)
 * Last resort: direct Gemini API only when backend is completely unreachable
 *   (connection refused / DNS failure) — NOT for 4xx/5xx errors from backend,
 *   because those indicate a real problem or rate-limit that a direct call
 *   will hit immediately too.
 */

const API_BASE   = import.meta.env.VITE_API_URL || "/api";
const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
// NOTE: gemini-1.5-flash-8b was removed from the API in 2025 — DO NOT use it
const GEMINI_URL    = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
const GEMINI_URL_FB = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent";

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getAuthToken() {
  try {
    const { getAuth } = await import("firebase/auth");
    const user = getAuth().currentUser;
    return user ? await user.getIdToken() : "";
  } catch { return ""; }
}

// Direct Gemini call — ONLY used when backend is completely unreachable (network error).
// If backend returned any HTTP status, don't call this — the same quota limits apply.
async function _directGemini(systemPrompt, userPrompt, maxTokens = 600) {
  if (!GEMINI_KEY) {
    throw new Error("AI unavailable — backend is unreachable and no fallback key configured");
  }
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
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      if (res.ok) {
        const d = await res.json();
        const text = d?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (!text) throw new Error("AI returned an empty response");
        return text;
      }

      if (res.status === 429) {
        if (retry === 0) { await sleep(4000); continue; }
        break; // try next model
      }

      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody?.error?.message || `AI error ${res.status}`);
    }
  }
  throw new Error("AI is rate-limited — please wait a moment and try again");
}

// Errors that should NOT trigger a direct-Gemini fallback.
// If the backend told us something went wrong, a direct call will hit
// the same problem (quota, auth, model error) and just double-fail.
function _isRateLimitOrBackendError(status, errMsg = "") {
  if (status === 429 || status === 503 || status === 502) return true;
  if (errMsg?.toLowerCase().includes("rate") ||
      errMsg?.toLowerCase().includes("quota") ||
      errMsg?.toLowerCase().includes("busy") ||
      errMsg?.toLowerCase().includes("unavailable")) return true;
  return false;
}

/**
 * Main chat — backend first (22s timeout), direct Gemini only on network failure
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
      headers: {
        "Content-Type": "application/json",
        ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
      },
      body: JSON.stringify({ messages, context: { system_prompt: systemPrompt }, lang, max_tokens: maxTokens }),
      signal: AbortSignal.timeout(22000), // 22s — covers Railway cold start
    });

    backendReachable = true; // backend responded with some HTTP status

    if (res.ok) {
      const data = await res.json();
      return data.text || data.response || "";
    }

    const err = await res.json().catch(() => ({}));
    const errMsg = err.error || err.message || "";

    // Specific known errors — surface directly, don't fallback
    if (errMsg.includes("limit_reached") || errMsg.includes("coach_limit"))
      throw new Error(err.message || "Monthly AI message limit reached — upgrade for more.");

    // Rate-limit / quota — don't hammer direct API with same request
    if (_isRateLimitOrBackendError(res.status, errMsg))
      throw new Error("AI is busy right now — please wait a moment and try again");

    // Any other backend error (auth, config, etc.)
    if (res.status < 500)
      throw new Error(errMsg || `AI error ${res.status}`);

    // 5xx — fall through to direct call
    console.warn(`[AI] backend ${res.status} — trying direct`);
  } catch (e) {
    if (backendReachable) throw e; // backend responded → surface its error
    console.warn("[AI] backend unreachable:", e.message?.slice(0, 80));
  }

  // Only reach here if backend was completely unreachable (no HTTP response)
  const lastPrompt = messages[messages.length - 1]?.content || "";
  return _directGemini(systemPrompt, lastPrompt, maxTokens);
}

/**
 * Generic AI analysis — backend first, direct only on network failure
 */
export async function geminiAnalysis(prompt, { lang = "en", context = {}, maxTokens = 600 } = {}) {
  let backendReachable = false;
  try {
    const tok = await getAuthToken();
    const res = await fetch(`${API_BASE}/ai/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
      },
      body: JSON.stringify({ prompt, lang, context, max_tokens: maxTokens }),
      signal: AbortSignal.timeout(22000),
    });

    backendReachable = true;

    if (res.ok) {
      const data = await res.json();
      return data.text || data.response || "";
    }
    const err = await res.json().catch(() => ({}));
    const errMsg = err.error || "";

    if (_isRateLimitOrBackendError(res.status, errMsg))
      throw new Error("AI is busy right now — please wait a moment and try again");
    if (res.status < 500)
      throw new Error(errMsg || `AI error ${res.status}`);

    console.warn(`[AI] /ai/analyze ${res.status} — trying direct`);
  } catch (e) {
    if (backendReachable) throw e;
    console.warn("[AI] backend unreachable:", e.message?.slice(0, 80));
  }

  return _directGemini("", prompt, maxTokens);
}

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
