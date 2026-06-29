/**
 * localAI.js — Browser-based AI using WebLLM (Transformers.js)
 * Model: Qwen2.5-0.5B-Instruct (~500MB, cached after first load)
 * Runs 100% in browser — no API keys, no backend, no cost
 * 
 * Usage:
 *   import { localChat, localAnalysis, getLocalAIStatus } from "./localAI.js"
 */

// ── State ──────────────────────────────────────────────────────────
let _engine    = null;
let _loading   = false;
let _progress  = 0; // 0-100
let _error     = null;
let _listeners = new Set();

const MODEL = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";

// ── Status ─────────────────────────────────────────────────────────
export function getLocalAIStatus() {
  return { ready: !!_engine, loading: _loading, progress: _progress, error: _error };
}

export function onLocalAIStatus(cb) {
  _listeners.add(cb);
  return () => _listeners.delete(cb);
}

function _notify() {
  const status = getLocalAIStatus();
  _listeners.forEach(cb => { try { cb(status); } catch {} });
}

// ── Initialize ─────────────────────────────────────────────────────
export async function initLocalAI(onProgress) {
  if (_engine) return _engine;
  if (_loading) {
    // Wait for existing load
    return new Promise((resolve, reject) => {
      const check = setInterval(() => {
        if (_engine) { clearInterval(check); resolve(_engine); }
        if (_error)  { clearInterval(check); reject(new Error(_error)); }
      }, 500);
    });
  }

  _loading = true; _error = null; _progress = 0;
  _notify();

  try {
    const { CreateMLCEngine } = await import("@mlc-ai/web-llm");

    _engine = await CreateMLCEngine(MODEL, {
      initProgressCallback: (report) => {
        _progress = Math.round(report.progress * 100);
        if (onProgress) onProgress(_progress, report.text);
        _notify();
      },
    });

    _loading = false; _progress = 100;
    _notify();
    return _engine;

  } catch(e) {
    _loading = false;
    _error   = e.message || "Failed to load local AI";
    _engine  = null;
    _notify();
    throw e;
  }
}

// ── Chat ───────────────────────────────────────────────────────────
export async function localChat(messages, { systemPrompt = "", maxTokens = 400 } = {}) {
  const engine = _engine || await initLocalAI();

  const msgs = [
    ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
    ...messages.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
  ];

  const reply = await engine.chat.completions.create({
    messages: msgs,
    max_tokens: maxTokens,
    temperature: 0.7,
    stream: false,
  });

  return reply.choices[0]?.message?.content?.trim() || "";
}

// ── Analysis ───────────────────────────────────────────────────────
export async function localAnalysis(prompt, { systemPrompt = "", maxTokens = 400 } = {}) {
  return localChat(
    [{ role: "user", content: prompt }],
    { systemPrompt, maxTokens }
  );
}

// ── Unload (free memory) ───────────────────────────────────────────
export async function unloadLocalAI() {
  if (_engine) { try { await _engine.unload(); } catch {} }
  _engine = null; _loading = false; _progress = 0;
  _notify();
}
