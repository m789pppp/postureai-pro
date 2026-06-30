/**
 * gemini.js — AI calls, 100% client-side, no server, no API keys.
 *
 * Engine: WebLLM (@mlc-ai/web-llm, open-source, MIT) running
 * Qwen2.5-0.5B-Instruct entirely inside the user's browser via WebGPU.
 *   - Nothing to install — the model downloads once on first use and
 *     is cached by the browser (IndexedDB), then works instantly,
 *     completely free, with zero backend involvement.
 *   - No cloud API keys (no Gemini, no Groq), no per-request cost,
 *     no rate limits, no data ever leaves the user's device.
 *   - Every user who opens the site gets their own private AI — no
 *     shared quota, no "AI not configured" errors.
 */

function _isRateLimit() { return false; } // kept for API compatibility, unused locally

// ── Friendly error messages ───────────────────────────────────────
export function friendlyError(e, lang = "en") {
  const msg = e?.message || "";
  const ar  = lang === "ar";
  if (msg === "AI_NO_WEBGPU")
    return ar ? "🧠 المتصفح ده مش بيدعم الـ AI المحلي — جرب Chrome أو Edge أحدث إصدار" : "🧠 This browser doesn't support local AI — try the latest Chrome or Edge";
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
 * geminiChat — multi-turn conversation, fully local (WebLLM in-browser).
 * context: structured analytics object {avg_score, sessions_count,
 * worst_time, top_alerts, has_calibration} — folded into the system
 * prompt since there is no server-side session/tier to read it from.
 */
export async function geminiChat(messagesOrPrompt, { systemPrompt = "", maxTokens = 600, lang = "en", context = {} } = {}) {
  const messages = Array.isArray(messagesOrPrompt)
    ? messagesOrPrompt
    : [{ role: "user", content: String(messagesOrPrompt) }];

  const { localChat } = await import("./localAI.js");

  const fullSystemPrompt = [
    systemPrompt,
    Object.keys(context).length ? `Context: ${JSON.stringify(context)}` : "",
    lang === "ar" ? "Respond in Egyptian Arabic." : "Respond in English.",
  ].filter(Boolean).join("\n\n");

  try {
    return await localChat(messages, { systemPrompt: fullSystemPrompt, maxTokens });
  } catch (e) {
    throw new Error(e?.message?.includes("WebGPU") || e?.message?.includes("gpu")
      ? "AI_NO_WEBGPU"
      : "AI temporarily unavailable — please try again");
  }
}

// ── Direct local-AI wrappers (used by components that check
// getLocalAIStatus().ready themselves before calling) ───────────────
export async function localFallbackChat(messages, opts = {}) {
  const { localChat } = await import("./localAI.js");
  return await localChat(messages, opts);
}

export async function localFallbackAnalysis(prompt, opts = {}) {
  const { localAnalysis } = await import("./localAI.js");
  return await localAnalysis(prompt, opts);
}

/**
 * geminiAnalysis — single-shot analysis, fully local (WebLLM in-browser).
 * Used by AIInsights, PredictiveAI, AIReports, NotificationsHub.
 */
export async function geminiAnalysis(prompt, { lang = "en", context = {}, maxTokens = 600 } = {}) {
  const { localAnalysis } = await import("./localAI.js");

  const systemPrompt = [
    Object.keys(context).length ? `Context: ${JSON.stringify(context)}` : "",
    lang === "ar" ? "Respond in Egyptian Arabic." : "Respond in English.",
  ].filter(Boolean).join("\n\n");

  try {
    return await localAnalysis(prompt, { systemPrompt, maxTokens });
  } catch (e) {
    throw new Error(e?.message?.includes("WebGPU") || e?.message?.includes("gpu")
      ? "AI_NO_WEBGPU"
      : "AI temporarily unavailable — please try again");
  }
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
