/**
 * Corvus — Vercel Serverless Function: AI Chat Proxy
 * Route: /ai/chat  (separate from /api/* which goes to Flask)
 * Purpose: proxy LLM7.io from server-side to avoid CORS
 * Cost: FREE — Vercel hobby plan includes 100k invocations/month
 * Latency: ~200ms cold start, then fast
 */

export const config = { runtime: "edge" };

const MODELS = ["gpt-4o-mini", "deepseek/deepseek-r1", "meta-llama/llama-3.1-8b-instruct"];
const LLM7   = "https://api.llm7.io/v1/chat/completions";

export default async function handler(req) {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  if (req.method !== "POST") {
    return json({ error: "POST only" }, 405);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const { messages, system_prompt, max_tokens = 700, temperature = 0.5 } = body;

  if (!messages?.length) {
    return json({ error: "messages required" }, 400);
  }

  // Build OpenAI-format messages
  const llmMessages = [
    { role: "system", content: system_prompt || "You are Dr. Corvus, a clinical physiotherapy AI." },
    ...messages.map(m => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || ""),
    })),
  ];

  // Try models in order
  for (const model of MODELS) {
    try {
      const res = await fetch(LLM7, {
        method:  "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer unused" },
        body:    JSON.stringify({ model, messages: llmMessages, max_tokens, temperature }),
        signal:  AbortSignal.timeout(25000),
      });

      if (res.status === 429) continue; // rate-limited, try next model

      if (!res.ok) {
        const err = await res.text();
        console.error(`LLM7 ${model} error ${res.status}:`, err.slice(0, 200));
        continue;
      }

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content?.trim();

      if (!text) continue;

      return json({ ok: true, text, model }, 200);

    } catch (e) {
      console.error(`Model ${model} failed:`, e.message);
      continue;
    }
  }

  return json({ ok: false, error: "All AI models unavailable. Please try again." }, 503);
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}
