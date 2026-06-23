/**
 * gemini.js — AI calls with smart fallback
 * Primary: backend proxy (/api/coach/chat, /api/ai/analyze)
 * Fallback: direct Gemini API if backend returns 404/5xx or times out
 *   Uses VITE_GEMINI_API_KEY (set in Vercel env vars, never committed)
 */

const API_BASE   = import.meta.env.VITE_API_URL || "/api";
const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

async function getAuthToken() {
  try {
    const { getAuth } = await import("firebase/auth");
    const user = getAuth().currentUser;
    return user ? await user.getIdToken() : "";
  } catch { return ""; }
}

// Direct Gemini call — fallback when backend isn't available
async function _directGemini(systemPrompt, userPrompt, maxTokens = 1024) {
  if (!GEMINI_KEY) {
    // Key not set at build time — give a clear actionable error instead of a cryptic one
    throw new Error("AI key not configured. Ask the admin to set VITE_GEMINI_API_KEY in Vercel.");
  }
  const contents = [
    ...(systemPrompt ? [
      { role: "user",  parts: [{ text: systemPrompt }] },
      { role: "model", parts: [{ text: "Understood." }] },
    ] : []),
    { role: "user", parts: [{ text: userPrompt }] },
  ];
  const res = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
    }),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const msg = errBody?.error?.message || `Gemini ${res.status}`;
    throw new Error(msg);
  }
  const d = await res.json();
  const text = d?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (!text) throw new Error("Gemini returned an empty response");
  return text;
}

/**
 * Main chat function — backend first, direct Gemini fallback
 * Accepts either:
 *   - messages: [{role:"user"|"assistant", content:string}]  ← preferred
 *   - prompt: string  ← converted to single-turn
 */
export async function geminiChat(messagesOrPrompt, { systemPrompt = "", maxTokens = 1024, lang = "en" } = {}) {
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
    // 404 / 5xx → fall through to direct
    console.warn(`[Gemini] backend ${res.status} — using direct fallback`);
  } catch (e) {
    if (e.message?.includes("limit_reached") || e.message?.includes("AI error")) throw e;
    console.warn("[Gemini] backend unreachable — using direct fallback:", e.message);
  }

  // Last resort: direct
  const lastPrompt = messages[messages.length - 1]?.content || "";
  return _directGemini(systemPrompt, lastPrompt, maxTokens);
}

/**
 * Generic AI analysis — proxies through /api/ai/analyze, falls back to direct
 */
export async function geminiAnalysis(prompt, { lang = "en", context = {}, maxTokens = 1024 } = {}) {
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
    console.warn(`[Gemini] /ai/analyze ${res.status} — using direct fallback`);
  } catch (e) {
    if (e.message?.includes("AI error")) throw e;
    console.warn("[Gemini] backend unreachable — using direct fallback:", e.message);
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
