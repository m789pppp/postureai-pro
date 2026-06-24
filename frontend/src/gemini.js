/**
 * gemini.js — AI calls with smart fallback + 429 retry logic
 * Primary: backend proxy (/api/coach/chat, /api/ai/analyze)
 * Fallback: direct Gemini API if backend returns 404/5xx or times out
 *   Uses VITE_GEMINI_API_KEY (set in Vercel env vars, never committed)
 */

const API_BASE    = import.meta.env.VITE_API_URL || "/api";
const GEMINI_KEY  = import.meta.env.VITE_GEMINI_API_KEY || "";
// Primary model: gemini-2.0-flash (15 req/min free)
// Fallback model: gemini-2.0-flash-lite (higher free quota, lighter)
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

// Direct Gemini call with retry + model fallback for 429
// Strategy: try primary → 3s wait → retry primary → try fallback model → give up
async function _directGemini(systemPrompt, userPrompt, maxTokens = 600) {
  if (!GEMINI_KEY) {
    throw new Error("AI key not configured — contact support");
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
        if (!text) throw new Error("Gemini returned an empty response");
        return text;
      }

      if (res.status === 429) {
        if (retry === 0) {
          // First 429: wait 3 seconds, retry same model
          await sleep(3000);
          continue;
        }
        // Second 429 on this model → try fallback model
        break;
      }

      // Other errors: parse and throw immediately
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody?.error?.message || `Gemini ${res.status}`);
    }
  }

  // Both models rate-limited
  throw new Error("AI is busy right now — wait 30 seconds and try again");
}

/**
 * Main chat — backend first, direct Gemini fallback
 */
export async function geminiChat(messagesOrPrompt, { systemPrompt = "", maxTokens = 600, lang = "en" } = {}) {
  const messages = Array.isArray(messagesOrPrompt)
    ? messagesOrPrompt
    : [{ role: "user", content: String(messagesOrPrompt) }];

  // Try backend
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
      throw new Error(err.message || "Monthly AI limit reached — upgrade for more.");
    if (res.status !== 404 && res.status < 500)
      throw new Error(err.error || err.message || `AI error ${res.status}`);
    console.warn(`[Gemini] backend ${res.status} — direct fallback`);
  } catch (e) {
    if (e.message?.includes("limit_reached") || e.message?.includes("AI error")) throw e;
    console.warn("[Gemini] backend unreachable:", e.message);
  }

  const lastPrompt = messages[messages.length - 1]?.content || "";
  return _directGemini(systemPrompt, lastPrompt, maxTokens);
}

/**
 * Generic AI analysis — proxies through /api/ai/analyze, falls back to direct
 */
export async function geminiAnalysis(prompt, { lang = "en", context = {}, maxTokens = 600 } = {}) {
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
    console.warn(`[Gemini] /ai/analyze ${res.status} — direct fallback`);
  } catch (e) {
    if (e.message?.includes("AI error")) throw e;
    console.warn("[Gemini] backend unreachable:", e.message);
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
