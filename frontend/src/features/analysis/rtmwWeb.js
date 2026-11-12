/**
 * rtmwWeb.js — RTMW-x whole-body pose (133 keypoints, OpenMMLab, Apache-2.0)
 * running in the browser with onnxruntime-web (WebGPU, WASM fallback).
 *
 * Top-down model: MediaPipe's landmarks give the person box, RTMW refines the
 * points inside it. Pre/post-processing mirrors rtmlib (Python) exactly, so the
 * browser output can be checked against the Python reference.
 *
 * Weights (~229 MB) are downloaded once, SHA-256 verified and kept in Cache Storage.
 * Inference runs in a Web Worker (rtmwWorker.js) so the UI thread never blocks;
 * devices too slow for real-time refinement are detected by a benchmark and skipped.
 * Whether a device should download the model at all is decided first, in rtmwPolicy.js.
 *
 * Both runners take an optional `spec` (input size, keypoint count — see rtmwCore) so the
 * same code can run another SimCC model, e.g. a smaller one on the benchmark page.
 */

const ORT_VER = "1.31.1";
const ORT_BASE = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VER}/dist/`;
export const RTMW_MODEL_URL =
  "https://huggingface.co/SceneWorks/dwpose-onnx/resolve/main/rtmw-dw-x-l_simcc-cocktail14_270e-384x288_20231122.onnx";
export const RTMW_SHA256 = "bd033156e5104c4f5d2edfe0453e02661e30a2f3da453ec93c8764d561b83054";
const CACHE_NAME = "posmoz-models-v1";

import { RTMW_X_SPEC, MEAN, STD, cropRect, cropRectInt, decodeFor, toSource } from "./rtmwCore.js";
export * from "./rtmwCore.js";

// ── runtime ────────────────────────────────────────────────────────────────
async function fetchModelCached(url, onProgress) {
  let cache = null;
  try { cache = await caches.open(CACHE_NAME); } catch { /* no Cache Storage (private mode) */ }
  if (cache) {
    const hit = await cache.match(url);
    if (hit) { onProgress?.(1); return new Uint8Array(await hit.arrayBuffer()); }
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`model download failed: ${res.status}`);
  const total = Number(res.headers.get("content-length")) || 0;
  const reader = res.body.getReader();
  const chunks = []; let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); got += value.length;
    if (total) onProgress?.(got / total);
  }
  const buf = new Uint8Array(got); let o = 0;
  for (const c of chunks) { buf.set(c, o); o += c.length; }
  if (cache) { try { await cache.put(url, new Response(buf, { headers: { "content-type": "application/octet-stream" } })); } catch { /* quota */ } }
  return buf;
}

/**
 * @param {object} o
 * @param {(p:number)=>void} [o.onProgress] download progress 0..1
 * @param {string[]} [o.providers] execution providers, default WebGPU then WASM
 */
export async function createRtmwRunnerMain({ onProgress, providers = ["webgpu", "wasm"], modelUrl = RTMW_MODEL_URL, spec = RTMW_X_SPEC } = {}) {
  const INPUT_W = spec.inputW, INPUT_H = spec.inputH;
  const ort = await import(/* @vite-ignore */ `${ORT_BASE}ort.all.min.mjs`);
  ort.env.wasm.wasmPaths = ORT_BASE;
  const bytes = await fetchModelCached(modelUrl, onProgress);
  let session = null, ep = null, lastErr = null;
  for (const p of providers) {
    try { session = await ort.InferenceSession.create(bytes, { executionProviders: [p], graphOptimizationLevel: "all" }); ep = p; break; }
    catch (e) { lastErr = e; }
  }
  if (!session) throw lastErr || new Error("no execution provider");
  const [outX, outY] = session.outputNames;
  const canvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(INPUT_W, INPUT_H)
    : Object.assign(document.createElement("canvas"), { width: INPUT_W, height: INPUT_H });
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const input = new Float32Array(3 * INPUT_W * INPUT_H);
  const plane = INPUT_W * INPUT_H;

  return {
    ep,
    /** @returns {{kpts: Float32Array, scores: Float32Array, ms: number}} keypoints in source px */
    async infer(source, bboxXyxy) {
      const t0 = performance.now();
      const rect = cropRect(bboxXyxy, 1.25, spec);
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, INPUT_W, INPUT_H);
      ctx.drawImage(source, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, INPUT_W, INPUT_H);
      const px = ctx.getImageData(0, 0, INPUT_W, INPUT_H).data;
      for (let i = 0, p = 0; i < plane; i++, p += 4) {
        input[i] = (px[p + 2] - MEAN[0]) / STD[0];             // B
        input[plane + i] = (px[p + 1] - MEAN[1]) / STD[1];     // G
        input[2 * plane + i] = (px[p] - MEAN[2]) / STD[2];     // R
      }
      const feeds = { [session.inputNames[0]]: new ort.Tensor("float32", input, [1, 3, INPUT_H, INPUT_W]) };
      const out = await session.run(feeds);
      const { locs, scores } = decodeFor(spec, out[outX].data, out[outY].data);
      return { kpts: toSource(locs, rect, spec), scores, ms: performance.now() - t0 };
    },
    async close() { try { await session.release(); } catch { /* ignore */ } },
  };
}

// ── default runner: Web Worker ─────────────────────────────────────────────
/**
 * Worker-backed runner. Rejects with { reason: "slow" | "download" | "checksum" | "provider" | … }
 * so the caller can fall back to fewer models.
 * @param {object} o
 * @param {(p:number)=>void} [o.onProgress]
 * @param {string[]} [o.providers]   default ["webgpu","wasm"]
 * @param {number} [o.maxBenchMs]    refuse devices slower than this per inference (default 400)
 */
export function createRtmwRunner({ onProgress, providers = ["webgpu", "wasm"], modelUrl = RTMW_MODEL_URL,
                                   sha256 = RTMW_SHA256, maxBenchMs = 400, spec = RTMW_X_SPEC } = {}) {
  if (typeof Worker === "undefined" || typeof createImageBitmap === "undefined") {
    return createRtmwRunnerMain({ onProgress, providers, modelUrl, spec });
  }
  const worker = new Worker(new URL("./rtmwWorker.js", import.meta.url), { type: "module" });
  const pending = new Map();
  let nextId = 1;
  return new Promise((resolve, reject) => {
    worker.onerror = e => reject(Object.assign(new Error(e.message || "worker failed"), { reason: "worker" }));
    worker.onmessage = ({ data }) => {
      if (data.type === "progress") onProgress?.(data.p);
      else if (data.type === "error") { worker.terminate(); reject(Object.assign(new Error(data.message), { reason: data.reason, benchMs: data.benchMs })); }
      else if (data.type === "result") { const p = pending.get(data.id); pending.delete(data.id); p?.(data); }
      else if (data.type === "ready") {
        resolve({
          ep: data.ep,
          benchMs: data.benchMs,
          async infer(source, bbox) {
            const rect = cropRectInt(bbox, spec);
            const bitmap = await createImageBitmap(source, rect.sx, rect.sy, rect.sw, rect.sh,
              { resizeWidth: spec.inputW, resizeHeight: spec.inputH, resizeQuality: "medium" });
            const id = nextId++;
            const res = await new Promise(done => { pending.set(id, done); worker.postMessage({ type: "infer", id, bitmap }, [bitmap]); });
            if (res.error) throw new Error(res.error);
            return { kpts: toSource(res.locs, rect, spec), scores: res.scores, ms: res.ms };
          },
          close() { worker.terminate(); pending.clear(); },
        });
      }
    };
    // resolve against the page — inside the worker a relative URL would resolve against the worker script
    const absUrl = new URL(modelUrl, globalThis.location?.href).href;
    worker.postMessage({ type: "init", modelUrl: absUrl, sha256, providers, maxBenchMs, spec });
  });
}
