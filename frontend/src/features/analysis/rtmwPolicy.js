/**
 * rtmwPolicy.js — decides, BEFORE anything is downloaded, whether this device should
 * load a refinement model at all, and which one.
 *
 * Why: the first version downloaded RTMW-x (229 MB), built the session and only then
 * timed it. A device that could never run it in real time (no WebGPU) still paid for the
 * whole download and for hundreds of MB of memory, on every session, to be told "too slow".
 *
 * Pure: takes plain facts about the device, returns a decision. Unit-tested in Node.
 */

/** Refinement models, heaviest first. `spec` is passed to rtmwCore / the worker. */
export const REFINE_MODELS = {
  "rtmw-x": {
    id: "rtmw-x", mb: 229, keypoints: 133,
    url: "https://huggingface.co/SceneWorks/dwpose-onnx/resolve/main/rtmw-dw-x-l_simcc-cocktail14_270e-384x288_20231122.onnx",
    sha256: "bd033156e5104c4f5d2edfe0453e02661e30a2f3da453ec93c8764d561b83054",
    spec: { inputW: 288, inputH: 384, k: 133, confLo: 0.5, confHi: 3.0 },
    providers: ["webgpu"],          // measured: far too slow on WASM, see docs/PERFORMANCE.md
    maxBenchMs: 400,
  },
};

export const VERDICT_KEY = "posmoz_refine_verdict_v1";
const VERDICT_TTL_MS = 30 * 24 * 3600 * 1000;      // re-test a "too slow" device once a month (driver / browser updates)
const SLOW_NETWORKS = new Set(["slow-2g", "2g", "3g"]);

/**
 * @param {object} model  entry of REFINE_MODELS
 * @param {object} d      device facts
 * @param {boolean} d.webgpu          a real (non-fallback) WebGPU adapter exists
 * @param {boolean} [d.cached]        the weights are already in Cache Storage
 * @param {boolean} [d.saveData]      the user asked the browser to save data
 * @param {string|null} [d.effectiveType]  navigator.connection.effectiveType
 * @param {number|null} [d.deviceMemoryGb] navigator.deviceMemory (Chromium only, capped at 8)
 * @param {boolean} [d.mobile]        phone or tablet
 * @param {boolean} [d.cellular]      on a mobile-data connection
 * @param {number|null} [d.freeMb]    free origin storage, from navigator.storage.estimate()
 * @param {object|null} [d.verdict]   stored result of an earlier attempt: { id, reason, at }
 * @param {number} [d.now]
 * @returns {{ load: boolean, reason: string }}
 */
export function refineDecision(model, d) {
  const no = reason => ({ load: false, reason });
  if (!model) return no("no_model");
  const v = d.verdict;
  if (v && v.id === model.id && v.reason === "slow" && (d.now ?? Date.now()) - (v.at || 0) < VERDICT_TTL_MS) return no("known_slow");
  if (model.providers.includes("webgpu") && !model.providers.includes("wasm") && !d.webgpu) return no("no_webgpu");
  // a model this size needs headroom: weights + session + GPU buffers are several times the file
  const heavy = model.mb >= 100;
  if (heavy && d.mobile) return no("mobile");
  if (heavy && d.deviceMemoryGb != null && d.deviceMemoryGb < 8) return no("low_memory");
  if (!d.cached) {
    if (d.saveData) return no("save_data");
    if (d.effectiveType && SLOW_NETWORKS.has(d.effectiveType)) return no("slow_network");
    if (heavy && d.cellular) return no("cellular");
    if (d.freeMb != null && d.freeMb < model.mb * 2) return no("no_space");
  }
  return { load: true, reason: "ok" };
}

/** Providers to try for this model on this device, in order. */
export function refineProviders(model, d) {
  return model.providers.filter(p => p !== "webgpu" || d.webgpu);
}

// ── browser glue (not unit-tested: reads navigator / storage) ────────────────
export function readVerdict() {
  try { return JSON.parse(localStorage.getItem(VERDICT_KEY) || "null"); } catch { return null; }
}
export function writeVerdict(id, reason, extra = {}) {
  try { localStorage.setItem(VERDICT_KEY, JSON.stringify({ id, reason, at: Date.now(), ...extra })); } catch { /* private mode */ }
}
export function clearVerdict() {
  try { localStorage.removeItem(VERDICT_KEY); } catch { /* ignore */ }
}

/** Collect the facts refineDecision() needs. Never throws. */
export async function deviceFacts(model, cacheName = "posmoz-models-v1") {
  const nav = typeof navigator === "undefined" ? {} : navigator;
  let webgpu = false, cached = false, freeMb = null;
  try { const a = await nav.gpu?.requestAdapter(); webgpu = !!a && !a.isFallbackAdapter; } catch { /* no WebGPU */ }
  try { cached = !!(await (await caches.open(cacheName)).match(new URL(model.url, globalThis.location?.href).href)); } catch { /* no Cache Storage */ }
  try { const e = await nav.storage?.estimate(); if (e?.quota) freeMb = (e.quota - (e.usage || 0)) / 1048576; } catch { /* ignore */ }
  const c = nav.connection;
  return {
    webgpu, cached, freeMb,
    saveData: !!c?.saveData,
    effectiveType: c?.effectiveType ?? null,
    cellular: c?.type === "cellular",
    deviceMemoryGb: nav.deviceMemory ?? null,
    mobile: nav.userAgentData?.mobile ?? /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent || ""),
    verdict: readVerdict(),
  };
}
