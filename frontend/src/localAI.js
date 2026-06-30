/**
 * localAI.js — Free AI via Pollinations.ai
 *
 * No downloads, no API keys, no WebGPU, no backend.
 * Pollinations.ai is a free, open-source AI service that runs
 * open-source models (openai-compatible) in the cloud.
 * Works from any browser, any device, instantly.
 *
 * API: https://text.pollinations.ai/openai (OpenAI-compatible, no key)
 */

const POLLINATIONS_URL = "https://text.pollinations.ai/openai";
const MODEL            = "openai-large"; // best free model on Pollinations

// ── State (kept for API compatibility with components) ─────────────
let _ready     = false;
let _loading   = false;
let _progress  = 0;
let _error     = null;
let _listeners = new Set();

export function getLocalAIStatus() {
  return { ready: _ready, loading: _loading, progress: _progress, error: _error };
}
export function onLocalAIStatus(cb) {
  _listeners.add(cb);
  return () => _listeners.delete(cb);
}
function _notify() {
  const s = getLocalAIStatus();
  _listeners.forEach(cb => { try { cb(s); } catch {} });
}

// ── "Init" — just a connectivity ping (fast, ~300ms) ─────────────
export async function initLocalAI() {
  if (_ready) return true;
  if (_loading) {
    return new Promise((resolve, reject) => {
      const check = setInterval(() => {
        if (_ready)  { clearInterval(check); resolve(true); }
        if (_error)  { clearInterval(check); reject(new Error(_error)); }
      }, 300);
      setTimeout(() => { clearInterval(check); reject(new Error("AI_TIMEOUT")); }, 15000);
    });
  }

  _loading = true; _error = null; _progress = 50;
  _notify();

  try {
    const res = await fetch(POLLINATIONS_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        model:      MODEL,
        messages:   [{ role: "user", content: "Hi" }],
        max_tokens: 5,
        seed:       1,
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    _ready = true; _loading = false; _progress = 100; _error = null;
    _notify();
    return true;
  } catch (e) {
    _loading = false; _ready = false;
    const msg = e?.message || "";
    _error = msg.includes("timeout") || msg.includes("Timeout") || msg.includes("abort")
      ? "AI_TIMEOUT"
      : "AI_NETWORK";
    _notify();
    throw new Error(_error);
  }
}

// ── Core request ───────────────────────────────────────────────────
async function _call(messages, maxTokens = 500) {
  const res = await fetch(POLLINATIONS_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ model: MODEL, messages, max_tokens: maxTokens, seed: 42 }),
    signal:  AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(res.status === 429 ? "AI_BUSY" : `AI_NETWORK`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

// ── Chat ───────────────────────────────────────────────────────────
export async function localChat(messages, { systemPrompt = "", maxTokens = 500 } = {}) {
  const msgs = [
    ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
    ...messages.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
  ];
  return _call(msgs, maxTokens);
}

// ── Analysis ───────────────────────────────────────────────────────
export async function localAnalysis(prompt, { systemPrompt = "", maxTokens = 500 } = {}) {
  return localChat([{ role: "user", content: prompt }], { systemPrompt, maxTokens });
}

// ── Unload (no-op for cloud AI) ────────────────────────────────────
export async function unloadLocalAI() {
  _ready = false; _loading = false; _progress = 0; _error = null;
  _notify();
}

export async function checkWebGPU() { return true; } // not needed anymore
