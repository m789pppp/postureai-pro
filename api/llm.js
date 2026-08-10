/**
 * Corvus — AI proxy (Vercel Edge Function)
 * Route: /api/llm  +  /api/ai-chat
 * Tries LLM7.io → Pollinations → offline fallback
 * No API key required server-side.
 */

export const runtime = "edge";

// LLM7.io free anonymous models (no key needed) — kept to 2 fast models,
// not 5: this is an Edge Function (see runtime="edge" above), whose real
// platform execution limit is NOT controlled by vercel.json's
// functions.maxDuration (that setting only applies to Node.js serverless
// functions, not Edge). All model attempts here share ONE timeout budget
// with no per-call limit, so a long list makes it easy to exceed
// whatever Vercel's actual Edge ceiling is — the function gets killed by
// the platform before the code's own 503/504 error handling ever runs,
// which is what a bare 500 with no useful error body looks like.
const LLM7_MODELS = [
  "gpt-4o-mini",
  "meta-llama/llama-3.3-70b-instruct",
];

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

// ── Rate limiting (per cold-start) ───────────────────────────────
const _ipCounts = new Map();
function checkRate(ip) {
  const now = Date.now();
  const e = _ipCounts.get(ip) || { count: 0, window: now };
  if (now - e.window > 60000) { e.count = 0; e.window = now; }
  e.count++;
  _ipCounts.set(ip, e);
  return e.count > 40;
}

// ── LLM7.io call ─────────────────────────────────────────────────
async function callLLM7(messages, maxTokens, temperature, signal) {
  for (const model of LLM7_MODELS) {
    try {
      // Per-model cap (independent of the outer signal's overall budget)
      // so one slow model can't eat the whole request's time allowance
      // before the next model — or the Pollinations fallbacks — get a
      // real chance to run.
      const perCallCtrl = new AbortController();
      const onOuterAbort = () => perCallCtrl.abort();
      signal?.addEventListener("abort", onOuterAbort, { once: true });
      const perCallTimer = setTimeout(() => perCallCtrl.abort(), 6000);
      let r;
      try {
        r = await fetch("https://api.llm7.io/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer unused",
          },
          body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
          signal: perCallCtrl.signal,
        });
      } finally {
        clearTimeout(perCallTimer);
        signal?.removeEventListener("abort", onOuterAbort);
      }
      if (r.status === 429) { continue; }
      if (!r.ok) { console.warn(`[llm7] ${model} → ${r.status}`); continue; }
      const data = await r.json();
      const text = data?.choices?.[0]?.message?.content?.trim();
      if (text && text.length > 5) return { text, model: `llm7:${model}` };
    } catch (e) {
      if (signal?.aborted && e.name === "AbortError") throw e; // outer (whole-request) abort — stop entirely
      // otherwise this was just this one model's own per-call timeout/error — move to the next model
      console.warn(`[llm7] ${model} error:`, e.message);
    }
  }
  return null;
}

// ── Pollinations chat fallback ────────────────────────────────────
async function callPollinations(messages, maxTokens, temperature, signal) {
  try {
    const r = await fetch("https://gen.pollinations.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai",
        messages,
        max_tokens: Math.min(maxTokens, 500),
        temperature,
        private: true,
        stream: false,
      }),
      signal,
    });
    if (!r.ok) return null;
    const data = await r.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (text && text.length > 5) return { text, model: "pollinations:openai" };
  } catch (e) {
    if (e.name === "AbortError") throw e;
    console.warn("[pollinations] error:", e.message);
  }
  return null;
}

// ── Pollinations text GET (last resort before offline) ────────────
async function callPollinationsText(lastUserMsg, systemMsg, signal) {
  try {
    const prompt = encodeURIComponent(lastUserMsg.slice(0, 400));
    const sys    = encodeURIComponent((systemMsg || "You are Dr. Corvus, a physiotherapy AI assistant.").slice(0, 300));
    const url = `https://text.pollinations.ai/${prompt}?model=openai&system=${sys}&private=true`;
    const r = await fetch(url, { signal });
    if (!r.ok) return null;
    const text = (await r.text()).trim();
    if (text && text.length > 5) return { text, model: "pollinations:text" };
  } catch (e) {
    if (e.name === "AbortError") throw e;
    console.warn("[pollinations-text] error:", e.message);
  }
  return null;
}

export default async function handler(req) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors() });
  }
  if (req.method !== "POST") {
    return respond({ error: "POST only" }, 405);
  }

  // Rate limit
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (checkRate(ip)) {
    return respond({ error: "Too many requests — slow down" }, 429);
  }

  // Auth check (presence only — can't verify in Edge without firebase-admin)
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ") || auth.length < 20) {
    return respond({ error: "Authentication required" }, 401);
  }

  let body;
  try { body = await req.json(); }
  catch { return respond({ error: "Invalid JSON" }, 400); }

  const {
    messages,
    system_prompt,
    max_tokens  = 600,
    temperature = 0.5,
  } = body || {};

  if (!Array.isArray(messages) || !messages.length) {
    return respond({ error: "messages array required" }, 400);
  }

  const systemMsg = system_prompt || "You are Dr. Corvus, a clinical physiotherapy and ergonomics AI inside Corvus PostureAI Pro. Be helpful, concise, and evidence-based.";

  const llmMessages = [
    { role: "system", content: systemMsg },
    ...messages.map(m => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || ""),
    })),
  ];

  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 18000);

  try {
    // 1. Try LLM7.io
    const llm7 = await callLLM7(llmMessages, Math.min(max_tokens, 700), temperature, ctrl.signal);
    if (llm7) {
      clearTimeout(timer);
      return respond({ ok: true, text: llm7.text, model: llm7.model });
    }

    // 2. Try Pollinations chat
    const poll = await callPollinations(llmMessages, max_tokens, temperature, ctrl.signal);
    if (poll) {
      clearTimeout(timer);
      return respond({ ok: true, text: poll.text, model: poll.model });
    }

    // 3. Try Pollinations text GET (last resort)
    const lastUser = [...messages].reverse().find(m => m.role === "user");
    const pollText = await callPollinationsText(lastUser?.content || "", systemMsg, ctrl.signal);
    if (pollText) {
      clearTimeout(timer);
      return respond({ ok: true, text: pollText.text, model: pollText.model });
    }

    clearTimeout(timer);
    return respond({ ok: false, error: "All AI providers unavailable — offline mode active" }, 503);

  } catch (e) {
    clearTimeout(timer);
    if (e.name === "AbortError") {
      return respond({ ok: false, error: "Request timeout — try again" }, 504);
    }
    console.error("[llm] unexpected:", e.message);
    return respond({ ok: false, error: "Internal error" }, 500);
  }
}
