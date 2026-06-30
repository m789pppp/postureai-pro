/**
 * localAI.js — Browser-based AI using WebLLM (@mlc-ai/web-llm)
 * Model: Qwen2.5-0.5B-Instruct (~500MB, cached after first load)
 * Runs 100% in browser via WebGPU — no API keys, no backend, no cost
 */

let _engine    = null;
let _loading   = false;
let _progress  = 0;
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
  const s = getLocalAIStatus();
  _listeners.forEach(cb => { try { cb(s); } catch {} });
}

// ── WebGPU check ───────────────────────────────────────────────────
export async function checkWebGPU() {
  if (typeof navigator === "undefined") return false;
  if (!navigator.gpu) return false;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return false;
    const device = await adapter.requestDevice();
    device.destroy();
    return true;
  } catch {
    return false;
  }
}

// ── Initialize ─────────────────────────────────────────────────────
export async function initLocalAI(onProgress) {
  if (_engine) return _engine;

  // Already loading — wait for it
  if (_loading) {
    return new Promise((resolve, reject) => {
      const check = setInterval(() => {
        if (_engine)  { clearInterval(check); resolve(_engine); }
        if (_error)   { clearInterval(check); reject(new Error(_error)); }
      }, 500);
      // Timeout after 3 minutes
      setTimeout(() => { clearInterval(check); reject(new Error("AI_TIMEOUT")); }, 180000);
    });
  }

  // Check WebGPU first
  const gpuOk = await checkWebGPU().catch(() => false);
  if (!gpuOk) {
    _error = "AI_NO_WEBGPU";
    _notify();
    throw new Error("AI_NO_WEBGPU");
  }

  _loading = true; _error = null; _progress = 0;
  _notify();

  try {
    const { CreateMLCEngine } = await import("@mlc-ai/web-llm");

    _engine = await CreateMLCEngine(MODEL, {
      initProgressCallback: (report) => {
        _progress = Math.round((report.progress || 0) * 100);
        if (onProgress) onProgress(_progress, report.text);
        _notify();
      },
    });

    _loading = false; _progress = 100; _error = null;
    _notify();
    return _engine;

  } catch (e) {
    _loading = false; _engine = null;
    const msg = e?.message || "";
    // Classify the error
    if (msg.toLowerCase().includes("webgpu") || msg.toLowerCase().includes("gpu") || msg.includes("GPUDevice")) {
      _error = "AI_NO_WEBGPU";
    } else if (msg.includes("fetch") || msg.includes("network") || msg.includes("Failed to fetch")) {
      _error = "AI_NETWORK";
    } else {
      _error = msg || "AI_LOAD_FAILED";
    }
    _notify();
    throw new Error(_error);
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
  return localChat([{ role: "user", content: prompt }], { systemPrompt, maxTokens });
}

// ── Unload ─────────────────────────────────────────────────────────
export async function unloadLocalAI() {
  if (_engine) { try { await _engine.unload(); } catch {} }
  _engine = null; _loading = false; _progress = 0; _error = null;
  _notify();
}
