/**
 * ai.js (as gemini.js) — All AI calls go through Groq (free, no credit card)
 * Model: llama-3.1-8b-instant (fast, bilingual AR+EN, 14,400 req/day free)
 * Fallback chain: Groq primary → Groq fallback model → friendly error
 *
 * Setup: Add VITE_GROQ_API_KEY to Vercel env vars
 * Get free key: console.groq.com → API Keys → Create API Key
 */

const GROQ_KEY    = import.meta.env.VITE_GROQ_API_KEY || "";
const GROQ_URL    = "https://api.groq.com/openai/v1/chat/completions";
// Models in priority order — all free on Groq
const GROQ_MODELS = [
  "llama-3.1-8b-instant",   // fastest, bilingual
  "llama3-8b-8192",         // fallback
  "gemma2-9b-it",           // last resort
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Core Groq call ──────────────────────────────────────────────────
async function callGroq(systemPrompt, userPrompt, maxTokens = 600, messages = null) {
  if (!GROQ_KEY) {
    throw new Error("AI_KEY_MISSING");
  }

  const msgs = messages
    ? [{ role: "system", content: systemPrompt || "You are a helpful assistant." }, ...messages]
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
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${GROQ_KEY}`,
          },
          body: JSON.stringify({ model, messages: msgs, max_tokens: maxTokens, temperature: 0.7 }),
          signal: AbortSignal.timeout(20000),
        });

        if (res.ok) {
          const d = await res.json();
          const text = d?.choices?.[0]?.message?.content || "";
          if (text) return text;
          throw new Error("Empty response from AI");
        }

        if (res.status === 429) {
          if (retry === 0) { await sleep(2000); continue; }
          break; // try next model
        }

        // Other error
        const body = await res.json().catch(() => ({}));
        const msg = body?.error?.message || `AI error ${res.status}`;
        if (res.status === 401) throw new Error("AI_KEY_INVALID");
        throw new Error(msg);
      } catch (e) {
        if (e.message === "AI_KEY_MISSING" || e.message === "AI_KEY_INVALID") throw e;
        if (e.name === "TimeoutError" || e.name === "AbortError") {
          if (retry === 0) { await sleep(1000); continue; }
          break;
        }
        throw e;
      }
    }
  }

  throw new Error("AI_BUSY");
}

// ── Friendly error messages ─────────────────────────────────────────
export function friendlyError(e, lang = "en") {
  const msg = e?.message || "";
  const ar = lang === "ar";

  if (msg === "AI_KEY_MISSING" || msg.includes("not configured"))
    return ar ? "مفتاح الـ AI مش موجود — تواصل مع الدعم" : "AI not configured — contact support";
  if (msg === "AI_KEY_INVALID")
    return ar ? "مفتاح الـ AI غير صحيح — تواصل مع الدعم" : "AI key invalid — contact support";
  if (msg === "AI_BUSY" || msg.includes("busy") || msg.includes("429"))
    return ar ? "الـ AI مشغول — انتظر ثانية وجرب تاني" : "AI is busy — wait a moment and try again";
  if (msg.includes("limit_reached") || msg.includes("coach_limit"))
    return ar ? "وصلت لحد الرسائل الشهري — اترقي للـ Elite" : "Monthly AI limit reached — upgrade to Elite";
  if (msg.includes("timeout") || msg.includes("TimeoutError") || msg.includes("AbortError"))
    return ar ? "انقطع الاتصال — جرب تاني" : "Connection timed out — please try again";

  return ar ? "حصل خطأ — جرب تاني" : "Something went wrong — please try again";
}

/**
 * geminiChat — Used by AICoach for multi-turn conversation
 * Drop-in replacement: same signature as before
 */
export async function geminiChat(messagesOrPrompt, { systemPrompt = "", maxTokens = 600, lang = "en" } = {}) {
  const rawMessages = Array.isArray(messagesOrPrompt)
    ? messagesOrPrompt
    : [{ role: "user", content: String(messagesOrPrompt) }];

  // Convert to Groq format
  const groqMessages = rawMessages.map(m => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content || "",
  }));

  return callGroq(systemPrompt, "", maxTokens, groqMessages);
}

/**
 * geminiAnalysis — Used by AIInsights, PredictiveAI, AIReports, NotificationsHub
 * Drop-in replacement: same signature as before
 */
export async function geminiAnalysis(prompt, { lang = "en", context = {}, maxTokens = 600 } = {}) {
  const systemPrompt = context?.system_prompt || "";
  return callGroq(systemPrompt, prompt, maxTokens);
}

/**
 * buildCoachContext — unchanged helper used by AICoach
 */
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
