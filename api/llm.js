/**
 * Corvus — AI proxy (Vercel Edge Function)
 * Primary: Pollinations text GET (no auth)
 * Fallback: LLM7.io anonymous
 * No API key required.
 */
export const runtime = "edge";

function cors() {
  return {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}
function respond(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors() },
  });
}

// ── Rate limit ────────────────────────────────────────────────────
const _ip = new Map();
function tooFast(ip) {
  const now = Date.now(), e = _ip.get(ip) || { n: 0, w: now };
  if (now - e.w > 60000) { e.n = 0; e.w = now; }
  e.n++; _ip.set(ip, e);
  return e.n > 40;
}

// ── Provider 1: Pollinations text GET (no auth needed) ───────────
async function pollText(msgs, sysMsg, signal) {
  const hist = msgs.filter(m => m.role !== "system")
    .slice(-6) // last 6 turns
    .map(m => `${m.role === "user" ? "User" : "Assistant"}: ${String(m.content||"").slice(0,300)}`)
    .join("\n");
  const prompt = `${hist}\nAssistant:`;

  for (const model of ["openai", "mistral"]) {
    try {
      const url = `https://text.pollinations.ai/${encodeURIComponent(prompt.slice(0,800))}?model=${model}&system=${encodeURIComponent(sysMsg.slice(0,400))}&private=true&seed=-1`;
      const r = await fetch(url, { signal });
      if (!r.ok) continue;
      const text = (await r.text()).trim();
      if (text && text.length > 10) return { text, model: `poll:${model}` };
    } catch(e) { if (e.name==="AbortError") throw e; }
  }
  return null;
}

// ── Provider 2: Pollinations chat POST ───────────────────────────
async function pollChat(msgs, maxTok, signal) {
  try {
    const r = await fetch("https://gen.pollinations.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer public" },
      body: JSON.stringify({ model: "openai", messages: msgs, max_tokens: Math.min(maxTok,400), stream: false, private: true }),
      signal,
    });
    if (!r.ok) return null;
    const d = await r.json();
    const text = d?.choices?.[0]?.message?.content?.trim();
    if (text && text.length > 5) return { text, model: "poll-chat:openai" };
  } catch(e) { if (e.name==="AbortError") throw e; }
  return null;
}

// ── Provider 3: LLM7.io anonymous ────────────────────────────────
async function llm7(msgs, maxTok, temp, signal) {
  for (const model of ["gpt-4o-mini", "meta-llama/llama-3.3-70b-instruct", "mistralai/mistral-7b-instruct"]) {
    try {
      const r = await fetch("https://api.llm7.io/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer unused" },
        body: JSON.stringify({ model, messages: msgs, max_tokens: maxTok, temperature: temp }),
        signal,
      });
      if (r.status === 429 || r.status >= 500) continue;
      if (!r.ok) continue;
      const d = await r.json();
      const text = d?.choices?.[0]?.message?.content?.trim();
      if (text && text.length > 5) return { text, model: `llm7:${model}` };
    } catch(e) { if (e.name==="AbortError") throw e; }
  }
  return null;
}

// ── Edge handler ──────────────────────────────────────────────────
export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });
  if (req.method !== "POST") return respond({ error: "POST only" }, 405);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "x";
  if (tooFast(ip)) return respond({ error: "Rate limited" }, 429);

  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ") || auth.length < 20) return respond({ error: "Auth required" }, 401);

  let body;
  try { body = await req.json(); } catch { return respond({ error: "Bad JSON" }, 400); }

  const { messages, system_prompt, max_tokens = 500, temperature = 0.5 } = body || {};
  if (!Array.isArray(messages) || !messages.length) return respond({ error: "messages required" }, 400);

  const sys = system_prompt || "You are Dr. Corvus, a physiotherapy and ergonomics AI. Be concise and helpful.";
  const llmMsgs = [
    { role: "system", content: sys },
    ...messages.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "") })),
  ];

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 22000);

  try {
    // Try each provider in order
    const result =
      await pollText(llmMsgs, sys, ctrl.signal) ||
      await pollChat(llmMsgs, max_tokens, ctrl.signal) ||
      await llm7(llmMsgs, Math.min(max_tokens, 600), temperature, ctrl.signal);

    clearTimeout(timer);
    if (result) return respond({ ok: true, text: result.text, model: result.model });
    return respond({ ok: false, error: "All AI providers unavailable" }, 503);
  } catch(e) {
    clearTimeout(timer);
    if (e.name === "AbortError") return respond({ ok: false, error: "Timeout — try again" }, 504);
    return respond({ ok: false, error: "Internal error" }, 500);
  }
}
