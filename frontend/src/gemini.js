/**
 * gemini.js — All AI calls routed through backend (never direct from browser)
 * No API key needed on frontend — backend handles authentication securely
 */

const API_BASE = import.meta.env.VITE_API_URL || "/api";

async function getAuthToken() {
  try {
    const { getAuth } = await import("firebase/auth");
    const user = getAuth().currentUser;
    return user ? await user.getIdToken() : "";
  } catch { return ""; }
}

/**
 * Main chat function — proxies through /api/coach/chat
 * Accepts either:
 *   - messages: [{role:"user"|"assistant", content:string}]  ← preferred
 *   - prompt: string  ← converted to single-turn [{role:"user",content:prompt}]
 */
export async function geminiChat(messagesOrPrompt, { systemPrompt = "", maxTokens = 1024, lang = "en" } = {}) {
  const tok = await getAuthToken();

  // Normalize: string → single-message array
  const messages = Array.isArray(messagesOrPrompt)
    ? messagesOrPrompt
    : [{ role: "user", content: String(messagesOrPrompt) }];

  const res = await fetch(`${API_BASE}/coach/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
    },
    body: JSON.stringify({
      messages,
      context:    { system_prompt: systemPrompt },
      lang,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    // Surface friendly limit message
    if (err.error === "coach_limit_reached") {
      throw new Error(err.message || "Monthly AI limit reached — upgrade for more.");
    }
    throw new Error(err.error || err.message || `AI error ${res.status}`);
  }

  const data = await res.json();
  return data.text || data.response || "";
}

/**
 * Generic AI analysis — proxies through /api/ai/analyze
 * Used by AIInsights, AIReports, PredictiveAI
 */
export async function geminiAnalysis(prompt, { lang = "en", context = {}, maxTokens } = {}) {
  const tok = await getAuthToken();

  const res = await fetch(`${API_BASE}/ai/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
    },
    body: JSON.stringify({ prompt, lang, context, ...(maxTokens ? { max_tokens: maxTokens } : {}) }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `AI error ${res.status}`);
  }

  const data = await res.json();
  return data.text || data.response || "";
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
