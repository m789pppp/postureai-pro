/**
 * gemini.js — Groq AI (free, no setup, bilingual AR+EN)
 * Key: GROQ_API_KEY في Railway env vars
 * Model: llama-3.1-8b-instant
 */

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const TIMEOUT  = 30000;

export function friendlyError(e, lang = "en") {
  const msg = e?.message || "";
  const ar  = lang === "ar";
  if (msg.includes("503") || msg.includes("busy"))
    return ar ? "الـ AI مشغول — انتظر ثانية" : "AI is busy — try again";
  if (msg.includes("502") || msg.includes("Failed to fetch"))
    return ar ? "خدمة AI غير متاحة حالياً" : "AI service unavailable";
  if (msg.includes("timeout") || msg.includes("AbortError"))
    return ar ? "انقطع الاتصال — جرب تاني" : "Request timed out — try again";
  return ar ? "حصل خطأ — جرب تاني" : "Something went wrong — try again";
}

async function apiFetch(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function geminiAnalysis(prompt, { context = {}, maxTokens = 600 } = {}) {
  const d = await apiFetch("/ai/analyze", {
    prompt,
    system_prompt: context?.system_prompt || "",
    max_tokens: maxTokens,
  });
  return d?.text || d?.result || "";
}

export async function geminiChat(messagesOrPrompt, { systemPrompt = "", maxTokens = 600, lang = "en" } = {}) {
  const messages = Array.isArray(messagesOrPrompt)
    ? messagesOrPrompt
    : [{ role: "user", content: String(messagesOrPrompt) }];
  const d = await apiFetch("/coach/chat", {
    messages, system_prompt: systemPrompt, lang, max_tokens: maxTokens,
  });
  return d?.reply || d?.text || "";
}

export function buildCoachContext(sessions = [], profile = {}) {
  const avg   = sessions.length ? Math.round(sessions.reduce((a,s)=>a+(s.avg_score||0),0)/sessions.length) : 0;
  const best  = sessions.length ? Math.max(...sessions.map(s=>s.avg_score||0)) : 0;
  const worst = sessions.length ? Math.min(...sessions.map(s=>s.avg_score||0)) : 0;
  const trend = sessions.length>=2 ? (sessions[0].avg_score||0)-(sessions[1].avg_score||0) : 0;
  const recent = sessions.slice(0,5).map((s,i)=>`Session ${i+1}: score=${s.avg_score||0}, duration=${Math.round((s.duration_s||0)/60)}min`).join("\n");
  return `User: ${profile.name||"User"}, Tier: ${profile.tier||"free"}
Sessions: ${sessions.length} | Avg: ${avg}/100 | Best: ${best} | Worst: ${worst}
Trend: ${trend>0?`+${trend} improving`:trend<0?`${trend} declining`:"stable"}
Recent:\n${recent||"No sessions yet"}`.trim();
}
