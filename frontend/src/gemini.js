/**
 * gemini.js — All AI calls via Groq (free, fast, bilingual AR+EN)
 * Model: llama-3.1-8b-instant | 14,400 req/day free
 * Key: VITE_GROQ_API_KEY in Vercel Environment Variables
 */

// Vite bakes VITE_* vars at build time — key must exist when `npm run build` runs
const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY ?? "";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODELS = [
  "llama-3.1-8b-instant",
  "llama3-8b-8192",
  "gemma2-9b-it",
];

// ── Debug helper (shows in browser console, never in UI) ──────────
if (import.meta.env.DEV || import.meta.env.VITE_DEBUG_AI === "true") {
  console.log("[Corvus AI] Key present:", !!GROQ_KEY, "| Length:", GROQ_KEY.length);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Core Groq fetch ───────────────────────────────────────────────
async function callGroq(systemPrompt, userPrompt, maxTokens = 600, messages = null) {
  if (!GROQ_KEY) throw new Error("AI_KEY_MISSING");

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
          signal: AbortSignal.timeout(25000),
        });

        if (res.ok) {
          const d = await res.json();
          const text = d?.choices?.[0]?.message?.content?.trim() || "";
          if (text) return text;
          throw new Error("Empty response from AI");
        }

        if (res.status === 429) {
          if (retry === 0) { await sleep(2500); continue; }
          break; // try next model
        }
        if (res.status === 401) throw new Error("AI_KEY_INVALID");

        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || `AI error ${res.status}`);

      } catch (e) {
        if (e.message === "AI_KEY_MISSING" || e.message === "AI_KEY_INVALID") throw e;
        if (e.name === "TimeoutError" || e.name === "AbortError") {
          if (retry === 0) { await sleep(1000); continue; }
          break;
        }
        if (retry === 1) throw e;
      }
    }
  }

  throw new Error("AI_BUSY");
}

// ── Friendly error messages ───────────────────────────────────────
export function friendlyError(e, lang = "en") {
  const msg = e?.message || "";
  const ar = lang === "ar";
  if (msg === "AI_KEY_MISSING" || msg.includes("not configured"))
    return ar ? "مفتاح الـ AI مش موجود — تواصل مع الدعم" : "AI not configured — contact support";
  if (msg === "AI_KEY_INVALID")
    return ar ? "مفتاح الـ AI غير صحيح" : "AI key invalid — contact support";
  if (msg === "AI_BUSY" || msg.includes("429"))
    return ar ? "الـ AI مشغول — انتظر ثانية وجرب تاني" : "AI is busy — try again in a moment";
  if (msg.includes("timeout") || msg.includes("Timeout") || msg.includes("AbortError"))
    return ar ? "انقطع الاتصال — جرب تاني" : "Connection timed out — try again";
  return ar ? "حصل خطأ — جرب تاني" : "Something went wrong — please try again";
}

// ── geminiChat — AICoach multi-turn ──────────────────────────────
export async function geminiChat(messagesOrPrompt, { systemPrompt = "", maxTokens = 600 } = {}) {
  const rawMessages = Array.isArray(messagesOrPrompt)
    ? messagesOrPrompt
    : [{ role: "user", content: String(messagesOrPrompt) }];
  const groqMessages = rawMessages.map(m => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content || "",
  }));
  return callGroq(systemPrompt, "", maxTokens, groqMessages);
}

// ── geminiAnalysis — AIInsights, PredictiveAI, AIReports, etc. ───
export async function geminiAnalysis(prompt, { context = {}, maxTokens = 600 } = {}) {
  const systemPrompt = context?.system_prompt || "";
  return callGroq(systemPrompt, prompt, maxTokens);
}

// ── buildCoachContext — AICoach helper ───────────────────────────
export function buildCoachContext(sessions = [], profile = {}) {
  const avg    = sessions.length ? Math.round(sessions.reduce((a, s) => a + (s.avg_score || 0), 0) / sessions.length) : 0;
  const best   = sessions.length ? Math.max(...sessions.map(s => s.avg_score || 0)) : 0;
  const worst  = sessions.length ? Math.min(...sessions.map(s => s.avg_score || 0)) : 0;
  const recent = sessions.slice(0, 5).map((s, i) =>
    `Session ${i + 1}: score=${s.avg_score || 0}, duration=${Math.round((s.duration_s || 0) / 60)}min, good=${s.good_pct || 0}%`
  ).join("\n");
  const trend = sessions.length >= 2 ? (sessions[0].avg_score || 0) - (sessions[1].avg_score || 0) : 0;
  return `
User: ${profile.name || "User"}, Tier: ${profile.tier || "free"}
Sessions: ${sessions.length} total | Avg: ${avg}/100 | Best: ${best} | Worst: ${worst}
Trend: ${trend > 0 ? `+${trend} improving` : trend < 0 ? `${trend} declining` : "stable"}
Recent:\n${recent || "No sessions yet"}
  `.trim();
}
// cache-bust: 1782417203
