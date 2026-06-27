/**
 * gemini.js — AI calls, routed through the backend proxy only.
 *
 * The backend's only AI provider is a local, free, open-source LLM
 * (Ollama — see OLLAMA_URL/LOCAL_LLM_MODEL in backend.py). No cloud
 * API keys (Gemini, Groq) are used anywhere, on either side:
 *   - No client-exposed secrets, no per-request cost, no rate limits
 *     from a third party, no data leaving the server.
 *   - There is intentionally NO client-side direct-provider fallback.
 *     A local model isn't reachable from the browser anyway, and a
 *     "fallback" that calls a cloud provider directly from the client
 *     would re-introduce the exact problems we removed (exposed keys,
 *     bypassed tier limits) for a rare edge case. If the backend is
 *     down, the user sees a clear "AI unavailable" message instead.
 */

const API_BASE = import.meta.env.VITE_API_URL || "/api";

async function getAuthToken() {
  try {
    const { getAuth } = await import("firebase/auth");
    const u = getAuth().currentUser;
    return u ? await u.getIdToken() : "";
  } catch { return ""; }
}

function _isRateLimit(status, msg = "") {
  return status === 429 || status === 503 || status === 502 ||
    msg.includes("rate") || msg.includes("quota") || msg.includes("busy");
}

// ── Friendly error messages ───────────────────────────────────────
export function friendlyError(e, lang = "en") {
  const msg = e?.message || "";
  const ar  = lang === "ar";
  if (msg === "AI_BUSY" || msg.includes("429") || msg.includes("busy"))
    return ar ? "⏳ الـ AI مشغول — انتظر ثانية وجرب تاني" : "⏳ AI is busy — try again in a moment";
  if (e?.code === "coach_limit_reached" || e?.code === "ai_limit_reached" || msg.includes("limit_reached") || msg.includes("coach_limit") || msg.includes("Monthly") || msg.includes("messages this month"))
    return ar ? `وصلت لحد ${e?.limit ?? ""} رسالة الشهر ده — رقّي خطتك لرسائل أكتر` : `You've reached your limit of ${e?.limit ?? ""} messages this month — upgrade for more`;
  if (msg.includes("not configured"))
    return ar ? "خدمة AI غير مفعّلة حالياً — تواصل مع الدعم" : "AI service not active — contact support";
  if (msg.includes("imeout") || msg.includes("bort"))
    return ar ? "انقطع الاتصال — جرب تاني" : "Connection timed out — try again";
  return ar ? "حصل خطأ — جرب تاني" : "Something went wrong — please try again";
}

/**
 * geminiChat — multi-turn conversation via /api/coach/chat (local AI).
 * context: structured analytics object {avg_score, sessions_count,
 * worst_time, top_alerts, has_calibration} — tier itself is taken
 * from the authenticated session server-side, never from the client.
 */
export async function geminiChat(messagesOrPrompt, { systemPrompt = "", maxTokens = 600, lang = "en", context = {} } = {}) {
  const messages = Array.isArray(messagesOrPrompt)
    ? messagesOrPrompt
    : [{ role: "user", content: String(messagesOrPrompt) }];

  const tok = await getAuthToken();
  let res;
  try {
    res = await fetch(`${API_BASE}/coach/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
      body: JSON.stringify({ messages, context, lang, max_tokens: maxTokens }),
      signal: AbortSignal.timeout(30000),
    });
  } catch (e) {
    throw new Error(e?.name === "TimeoutError" || e?.name === "AbortError"
      ? "Connection timed out — please try again"
      : "AI temporarily unavailable — please try again");
  }

  if (res.ok) return (await res.json()).text || "";
  const err = await res.json().catch(() => ({}));
  const errMsg = err.error || err.message || "";
  if (err.error === "coach_limit_reached") {
    const limitErr = new Error(err.message || "coach_limit_reached");
    limitErr.code = "coach_limit_reached";
    limitErr.used = err.used;
    limitErr.limit = err.limit;
    throw limitErr;
  }
  if (_isRateLimit(res.status, errMsg)) throw new Error("AI_BUSY");
  throw new Error(errMsg || `AI error ${res.status}`);
}

/**
 * geminiAnalysis — single-shot analysis via /api/ai/analyze (local AI).
 * Used by AIInsights, PredictiveAI, AIReports, NotificationsHub.
 */
export async function geminiAnalysis(prompt, { lang = "en", context = {}, maxTokens = 600 } = {}) {
  const tok = await getAuthToken();
  let res;
  try {
    res = await fetch(`${API_BASE}/ai/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
      body: JSON.stringify({ prompt, lang, context, max_tokens: maxTokens }),
      signal: AbortSignal.timeout(30000),
    });
  } catch (e) {
    throw new Error(e?.name === "TimeoutError" || e?.name === "AbortError"
      ? "Connection timed out — please try again"
      : "AI temporarily unavailable — please try again");
  }

  if (res.ok) return (await res.json()).text || "";
  const err = await res.json().catch(() => ({}));
  const errMsg = err.error || err.message || "";
  if (err.error === "ai_limit_reached") {
    const limitErr = new Error(err.message || "ai_limit_reached");
    limitErr.code = "ai_limit_reached";
    limitErr.used = err.used;
    limitErr.limit = err.limit;
    throw limitErr;
  }
  if (_isRateLimit(res.status, errMsg)) throw new Error("AI_BUSY");
  throw new Error(errMsg || `AI error ${res.status}`);
}

// ── buildCoachContext — readable text summary for direct-prompt use ──
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
