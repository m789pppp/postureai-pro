/**
 * Corvus — Vercel Serverless Function: LLM Proxy
 * Auto-route: /api/ai-chat  (Vercel serves /api/*.js automatically)
 * No rewrites needed — just call /api/ai-chat from frontend
 */

const MODELS = [
  "gpt-4o-mini",
  "meta-llama/llama-3.3-70b-instruct",
  "deepseek/deepseek-r1",
];
const LLM7_URL = "https://api.llm7.io/v1/chat/completions";

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function respond(data, status) {
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
  try {
    body = await req.json();
  } catch {
    return respond({ error: "Invalid JSON" }, 400);
  }

  const { messages, system_prompt, max_tokens = 700, temperature = 0.5 } = body || {};

  if (!Array.isArray(messages) || !messages.length) {
    return respond({ error: "messages array required" }, 400);
  }

  const llmMessages = [
    {
      role: "system",
      content: system_prompt || "You are Dr. Corvus, a clinical physiotherapy AI specialist.",
    },
    ...messages.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || ""),
    })),
  ];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 24000);

  for (const model of MODELS) {
    try {
      const res = await fetch(LLM7_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer unused",
        },
        body: JSON.stringify({
          model,
          messages: llmMessages,
          max_tokens,
          temperature,
        }),
        signal: controller.signal,
      });

      if (res.status === 429) {
        // rate-limited on this model, try next
        continue;
      }

      if (!res.ok) {
        console.error(`[ai-chat] ${model} returned ${res.status}`);
        continue;
      }

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content?.trim();

      if (!text) {
        console.error(`[ai-chat] ${model} returned empty text`);
        continue;
      }

      clearTimeout(timer);
      return respond({ ok: true, text, model }, 200);

    } catch (e) {
      if (e.name === "AbortError") {
        clearTimeout(timer);
        return respond({ ok: false, error: "AI response timeout" }, 504);
      }
      console.error(`[ai-chat] ${model} error:`, e.message);
      continue;
    }
  }

  clearTimeout(timer);
  return respond({ ok: false, error: "All AI models unavailable" }, 503);
}

export const config = { runtime: "edge" };
