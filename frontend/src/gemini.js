/**
 * gemini.js — AI calls, 100% client-side, no server, no API keys.
 *
 * Engine: Offline rule-based AI — zero downloads, zero API calls, works on all browsers.
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
  if (msg === "AI_NO_WEBGPU" || msg.toLowerCase().includes("webgpu") || msg.toLowerCase().includes("gpu"))
    return ar ? "🧠 المتصفح ده مش بيدعم الـ AI المحلي — جرب Chrome أو Edge (أحدث إصدار)" : "🧠 Your browser doesn't support local AI — try the latest Chrome or Edge";
  if (msg === "AI_NETWORK" || msg.includes("fetch") || msg.includes("network"))
    return ar ? "🌐 فشل تحميل AI — تأكد من الاتصال بالإنترنت وجرب تاني" : "🌐 Failed to download AI — check your connection and retry";
  if (msg === "AI_TIMEOUT")
    return ar ? "⏳ تحميل AI استغرق وقتًا طويلاً — جرب تاني" : "⏳ AI download timed out — please try again";
  if (msg === "AI_LOAD_FAILED" || msg.includes("load") || msg.includes("initialize"))
    return ar ? "⚠️ فشل تحميل AI — جرب تحديث الصفحة" : "⚠️ Failed to load AI — try refreshing the page";
  if (msg === "AI_BUSY" || msg.includes("429") || msg.includes("busy"))
    return ar ? "⏳ الـ AI مشغول — انتظر ثانية وجرب تاني" : "⏳ AI is busy — try again in a moment";
  if (e?.code === "coach_limit_reached" || e?.code === "ai_limit_reached" || msg.includes("limit_reached"))
    return ar ? `وصلت لحد الرسائل الشهري — رقّي خطتك` : `You've reached your monthly message limit — upgrade for more`;
  if (msg.includes("imeout") || msg.includes("bort"))
    return ar ? "انقطع الاتصال — جرب تاني" : "Connection timed out — try again";
  return ar ? "حصل خطأ — جرب تاني أو حدّث الصفحة" : "Something went wrong — try again or refresh the page";
}

/**
 * geminiChat — multi-turn conversation, fully offline (rule-based engine).
 * context: structured analytics object {avg_score, sessions_count,
 * worst_time, top_alerts, has_calibration} — folded into the system
 * prompt since there is no server-side session/tier to read it from.
 */
export async function geminiChat(messagesOrPrompt, { systemPrompt = "", maxTokens = 600, lang = "en", context = {} } = {}) {
  const messages = Array.isArray(messagesOrPrompt)
    ? messagesOrPrompt
    : [{ role: "user", content: String(messagesOrPrompt) }];

  const { localChat } = await import("./localAI.js");

  // If caller already built a full system prompt (e.g. AICoach builds Dr. Corvus prompt
  // with all patient data), pass it through directly — don't append redundant context.
  // Only append context JSON if the system prompt is minimal/empty.
  let fullSystemPrompt;
  if (systemPrompt && systemPrompt.length > 200) {
    // Full prompt provided — use as-is (AICoach, AIInsights pattern)
    fullSystemPrompt = systemPrompt;
  } else {
    // Minimal/no prompt — build from context (legacy callers)
    const ctxBlock = Object.keys(context).length
      ? `Context: ${JSON.stringify(context)}`
      : "";
    const langLine = lang === "ar"
      ? "LANGUAGE: Respond ENTIRELY in Egyptian Arabic (\u0639\u0627\u0645\u064a\u0629 \u0645\u0635\u0631\u064a\u0629)."
      : "LANGUAGE: Respond in English.";
    fullSystemPrompt = [systemPrompt, ctxBlock, langLine].filter(Boolean).join("\n\n");
  }

  try {
    return await localChat(messages, { systemPrompt: fullSystemPrompt, maxTokens });
  } catch (e) {
    throw e;
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
 * geminiAnalysis — single-shot analysis, fully offline (rule-based engine).
 * Used by AIInsights, PredictiveAI, AIReports, NotificationsHub.
 */
export async function geminiAnalysis(prompt, { lang = "en", context = {}, maxTokens = 600, systemPrompt = "" } = {}) {
  const { localAnalysis } = await import("./localAI.js");

  // Support both: explicit systemPrompt (from AIInsights) and context object (from PredictiveAI)
  const ctxBlock = Object.keys(context).length && !context.system_prompt
    ? `Context: ${JSON.stringify(context)}`
    : "";

  // If context.system_prompt exists, use it as the base (PredictiveAI pattern)
  const basePrompt = systemPrompt || context.system_prompt || "";

  const langLine = lang === "ar"
    ? "LANGUAGE: Respond ENTIRELY in Egyptian Arabic (\u0639\u0627\u0645\u064a\u0629 \u0645\u0635\u0631\u064a\u0629)."
    : "LANGUAGE: Respond in clear, professional English.";

  const fullSystemPrompt = [basePrompt, ctxBlock, langLine]
    .filter(Boolean)
    .join("\n\n");

  try {
    return await localAnalysis(prompt, { systemPrompt: fullSystemPrompt, maxTokens });
  } catch (e) {
    throw e;
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
