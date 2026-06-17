/**
 * gemini.js — Direct Gemini API calls from frontend
 * Uses VITE_GEMINI_API_KEY — never expose server secrets here
 */

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

export async function geminiChat(prompt, { systemPrompt = "", maxTokens = 1024 } = {}) {
  if (!GEMINI_KEY) throw new Error("Gemini API key not configured");

  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
    generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
  };

  const res = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gemini error ${res.status}`);
  }

  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

export function buildCoachContext(sessions = [], profile = {}) {
  const avg    = sessions.length ? Math.round(sessions.reduce((a,s)=>a+(s.avg_score||0),0)/sessions.length) : 0;
  const best   = sessions.length ? Math.max(...sessions.map(s=>s.avg_score||0)) : 0;
  const worst  = sessions.length ? Math.min(...sessions.map(s=>s.avg_score||0)) : 0;
  const recent = sessions.slice(0,5).map((s,i)=>`Session ${i+1}: score=${s.avg_score||0}, duration=${Math.round((s.duration_s||0)/60)}min, good_posture=${s.good_pct||0}%`).join("\n");
  const trend  = sessions.length>=2 ? (sessions[0].avg_score||0)-(sessions[1].avg_score||0) : 0;

  return `
User: ${profile.name || "User"}, Tier: ${profile.tier || "free"}
Sessions: ${sessions.length} total
Average score: ${avg}/100
Best: ${best} | Worst: ${worst}
Trend: ${trend > 0 ? `+${trend} improving` : trend < 0 ? `${trend} declining` : "stable"}
Recent sessions:
${recent || "No sessions yet"}
  `.trim();
}
