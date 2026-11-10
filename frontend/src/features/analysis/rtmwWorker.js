/**
 * rtmwWorker.js — RTMW-x inference off the main thread.
 *
 * Protocol (postMessage):
 *   main → { type: "init", modelUrl, sha256, providers, maxBenchMs }
 *   worker → { type: "progress", p } … { type: "ready", ep, benchMs } | { type: "error", reason, message }
 *   main → { type: "infer", id, bitmap }   (bitmap already cropped + resized to 288×384, transferred)
 *   worker → { type: "result", id, locs, scores, ms }   (locs in model-input px; buffers transferred)
 */
import { INPUT_W, INPUT_H, decodeSimcc, MEAN, STD } from "./rtmwCore.js";

const ORT_BASE = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/";
const CACHE_NAME = "posmoz-models-v1";

let ort = null, session = null, outX = null, outY = null, ctx = null;
const plane = INPUT_W * INPUT_H;
const input = new Float32Array(3 * plane);

const hex = buf => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, "0")).join("");

async function fetchVerified(url, sha256) {
  let cache = null;
  try { cache = await caches.open(CACHE_NAME); } catch { /* Cache Storage unavailable */ }
  const hit = cache && await cache.match(url);
  if (hit) { postMessage({ type: "progress", p: 1 }); return new Uint8Array(await hit.arrayBuffer()); }
  const res = await fetch(url);
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { reason: "download" });
  const total = Number(res.headers.get("content-length")) || 0;
  const reader = res.body.getReader();
  const chunks = []; let got = 0, lastP = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); got += value.length;
    const p = total ? got / total : 0;
    if (p - lastP > 0.01) { lastP = p; postMessage({ type: "progress", p }); }
  }
  const buf = new Uint8Array(got); let o = 0;
  for (const c of chunks) { buf.set(c, o); o += c.length; }
  if (sha256) {
    const digest = hex(await crypto.subtle.digest("SHA-256", buf));
    if (digest !== sha256) throw Object.assign(new Error(`checksum mismatch ${digest.slice(0, 12)}`), { reason: "checksum" });
  }
  if (cache) { try { await cache.put(url, new Response(buf)); } catch { /* quota */ } }
  return buf;
}

function toTensorInput(rgba) {
  for (let i = 0, p = 0; i < plane; i++, p += 4) {
    input[i] = (rgba[p + 2] - MEAN[0]) / STD[0];            // B
    input[plane + i] = (rgba[p + 1] - MEAN[1]) / STD[1];    // G
    input[2 * plane + i] = (rgba[p] - MEAN[2]) / STD[2];    // R
  }
  return new ort.Tensor("float32", input, [1, 3, INPUT_H, INPUT_W]);
}

async function run(tensor) {
  const out = await session.run({ [session.inputNames[0]]: tensor });
  return decodeSimcc(out[outX].data, out[outY].data);
}

async function init({ modelUrl, sha256, providers = ["webgpu", "wasm"], maxBenchMs = 400 }) {
  ort = await import(/* @vite-ignore */ `${ORT_BASE}ort.all.min.mjs`);
  ort.env.wasm.wasmPaths = ORT_BASE;
  const bytes = await fetchVerified(modelUrl, sha256);
  let ep = null, lastErr = null;
  for (const p of providers) {
    if (p === "webgpu" && !self.navigator?.gpu) continue;
    try { session = await ort.InferenceSession.create(bytes, { executionProviders: [p], graphOptimizationLevel: "all" }); ep = p; break; }
    catch (e) { lastErr = e; }
  }
  if (!session) throw Object.assign(lastErr || new Error("no execution provider"), { reason: "provider" });
  [outX, outY] = session.outputNames;
  ctx = new OffscreenCanvas(INPUT_W, INPUT_H).getContext("2d", { willReadFrequently: true });
  // benchmark: first run compiles shaders, the second is the real cost
  const blank = toTensorInput(new Uint8ClampedArray(plane * 4));
  await run(blank);
  const t0 = performance.now(); await run(blank); const benchMs = performance.now() - t0;
  if (benchMs > maxBenchMs) {
    try { await session.release(); } catch { /* ignore */ }
    session = null;
    throw Object.assign(new Error(`too slow on this device (${Math.round(benchMs)} ms)`), { reason: "slow", benchMs });
  }
  return { ep, benchMs };
}

self.onmessage = async ({ data }) => {
  if (data.type === "init") {
    try { postMessage({ type: "ready", ...(await init(data)) }); }
    catch (e) { postMessage({ type: "error", reason: e.reason || "init", message: String(e?.message || e), benchMs: e.benchMs ?? null }); }
  } else if (data.type === "infer") {
    const t0 = performance.now();
    try {
      ctx.clearRect(0, 0, INPUT_W, INPUT_H);
      ctx.drawImage(data.bitmap, 0, 0);
      data.bitmap.close();
      const { locs, scores } = await run(toTensorInput(ctx.getImageData(0, 0, INPUT_W, INPUT_H).data));
      postMessage({ type: "result", id: data.id, locs, scores, ms: performance.now() - t0 }, [locs.buffer, scores.buffer]);
    } catch (e) {
      postMessage({ type: "result", id: data.id, error: String(e?.message || e) });
    }
  }
};
