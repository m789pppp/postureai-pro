/**
 * Corvus — Vercel Serverless Edge Function
 * Route: /api/ai-chat
 * Proxies LLM7.io server-side (no CORS), no API key needed
 */

export const runtime = "edge";

const MODELS = [
  "gpt-4o-mini",
  "meta-llama/llama-3.3-70b-instruct",
  "deepseek/deepseek-r1",
];

function cors() {
  return {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function respond(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors() },
  });
}

export default async function handler(req) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors() });
  }

  if (req.method !== "POST") {
    return respond({ error: "POST only" }, 405);
  }

  let body;
  try { body = await req.json(); }
  catch { return respond({ error: "Invalid JSON" }, 400); }

  const { messages, system_prompt, max_tokens = 700, temperature = 0.5 } = body || {};

  if (!Array.isArray(messages) || !messages.length) {
    return respond({ error: "messages array required" }, 400);
  }

  const llmMessages = [
    { role: "system", content: system_prompt || "You are Dr. Corvus, a clinical physiotherapy AI." },
    ...messages.map(m => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || ""),
    })),
  ];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 22000);

  for (const model of MODELS) {
    try {
      const res = await fetch("https://api.llm7.io/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer unused" },
        body: JSON.stringify({ model, messages: llmMessages, max_tokens, temperature }),
        signal: controller.signal,
      });

      if (res.status === 429) continue;
      if (!res.ok) { console.error(`[ai-chat] ${model} → ${res.status}`); continue; }

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content?.trim();
      if (!text) continue;

      clearTimeout(timer);
      return respond({ ok: true, text, model }, 200);

    } catch (e) {
      if (e.name === "AbortError") {
        clearTimeout(timer);
        return respond({ ok: false, error: "AI response timeout — try again" }, 504);
      }
      console.error(`[ai-chat] ${model} failed:`, e.message);
    }
  }

  clearTimeout(timer);
  return respond({ ok: false, error: "All AI models unavailable — try again in a moment" }, 503);
}
