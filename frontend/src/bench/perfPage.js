/**
 * perfPage.js — repeatable benchmark of the live posture pipeline (open /perf.html).
 *
 * Runs the same steps as the live session loop in App.jsx (pose → fusion → smoothing →
 * engine → precision layer, capped at 20 analyses/s) and reports load time, time to the
 * first score, frame rate, memory and the jitter of a still subject.
 *
 * Source: the camera (sit still) or a still test image with seeded sensor noise, which
 * makes the run repeatable. Frames never leave the device — nothing is uploaded; the
 * result is a JSON of numbers only.
 *
 * URL parameters:
 *   pipeline = mp | fused       pose only, or the full precision layer (default fused)
 *   src      = camera | <image url>                              (default camera)
 *   seconds  = measured seconds after warm-up                    (default 20)
 *   warmup   = seconds ignored after the first score             (default 3)
 *   wait     = "rtmw" to start measuring only after the third model settled (on/off)
 *   rtmw     = JSON of options for the enhancer's refinement model, e.g. {"force":true,"providers":["wasm"]}
 *   rate     = fixed             always 20 analyses/s (default: adaptive, slower once the subject is still)
 *   worker   = 0                 run MediaPipe on the main thread (default: in a worker)
 *   delegate = gpu | cpu         force MediaPipe's delegate (default: chosen by mediapipeLoader)
 *   smoother = euro:<minCutoff>,<beta>   One Euro instead of the tier's EMA
 *   auto     = 1 to start without a click (used by scripts/perf-bench.mjs)
 */
import { analyzeMP, createLandmarkSmoother, resetProportions } from "../features/analysis/postureEngine.js";
import { createLiveEnhancer } from "../features/analysis/liveEnhancer.js";
import { qualityFor } from "../lib/tierQuality.js";
import { createOneEuroLandmarkSmoother } from "../features/analysis/calibrationCore.js";
import { preferredDelegates, webglRendererName } from "../features/analysis/mediapipeLoader.js";
import { createVisionClient } from "../features/analysis/visionClient.js";
import { createRateController } from "../features/analysis/analysisRate.js";
import { pipelineId } from "../features/analysis/pipelineInfo.js";
import { PERF_VERSION, landmarkJitter, seriesStats, pacing } from "./perfCore.js";

const Q = new URLSearchParams(location.search);
const PIPELINE = Q.get("pipeline") === "mp" ? "mp" : "fused";
const SRC = Q.get("src") || "camera";
const SECONDS = Number(Q.get("seconds")) || 20;
const WARMUP = Number(Q.get("warmup") ?? 3);
const WAIT_RTMW = Q.get("wait") === "rtmw";
const RTMW_WAIT_MAX_MS = (Number(Q.get("rtmwWait")) || 180) * 1000;
const TIER = Q.get("tier") || "standard";
const FORCE_DELEGATE = { gpu: "GPU", cpu: "CPU" }[Q.get("delegate")] || null;
let RTMW_OPTS = {};
try { RTMW_OPTS = JSON.parse(Q.get("rtmw") || "{}"); } catch { /* ignore */ }

const $ = id => document.getElementById(id);
const log = m => { $("log").textContent += m + "\n"; };

// ── frame source ───────────────────────────────────────────────────────────
function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Still image → 1280×720 stream with seeded sensor noise (8 pre-rendered frames, cycled). */
async function imageStream(url, sigma = 3, seed = 7) {
  const img = new Image(); img.crossOrigin = "anonymous"; img.src = url;
  await img.decode();
  const W = 1280, H = 720;
  const base = Object.assign(document.createElement("canvas"), { width: W, height: H });
  const b = base.getContext("2d", { willReadFrequently: true });
  b.fillStyle = "#777"; b.fillRect(0, 0, W, H);
  const s = Math.min(W / img.width, H / img.height) * (Number(Q.get("zoom")) || 1.5);   // upper body fills the frame
  b.drawImage(img, (W - img.width * s) / 2, H * 0.04, img.width * s, img.height * s);
  const clean = b.getImageData(0, 0, W, H), rnd = mulberry32(seed), frames = [];
  for (let k = 0; k < 8; k++) {
    const d = new ImageData(new Uint8ClampedArray(clean.data), W, H), p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      const n = (rnd() + rnd() + rnd() - 1.5) * 2 * sigma;          // ≈ gaussian, SD ≈ sigma
      p[i] += n; p[i + 1] += n; p[i + 2] += n;
    }
    frames.push(await createImageBitmap(d));
  }
  const out = Object.assign(document.createElement("canvas"), { width: W, height: H });
  const o = out.getContext("2d"); let i = 0;
  o.drawImage(frames[0], 0, 0);
  const timer = setInterval(() => { o.drawImage(frames[i++ % frames.length], 0, 0); }, 1000 / 30);
  const stream = out.captureStream(30);
  stream.__stop = () => clearInterval(timer);
  return stream;
}

async function openSource(video) {
  const stream = SRC === "camera"
    ? await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }, audio: false })
    : await imageStream(SRC, Number(Q.get("noise") ?? 3));
  video.srcObject = stream;
  await video.play();
  return stream;
}

// ── models ─────────────────────────────────────────────────────────────────
async function loadPose() {
  // worker=0 keeps inference on the main thread; delegate=gpu reproduces the old delegate choice
  const c = await createVisionClient({ worker: Q.get("worker") !== "0", delegates: FORCE_DELEGATE ? [FORCE_DELEGATE, "CPU"] : preferredDelegates() });
  return { pl: c.pose, face: c.face, source: c.source, delegate: c.delegate, mode: c.mode, close: c.close };
}

const heapMb = () => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null);

async function deviceInfo() {
  let gpu = null;
  try { const a = await navigator.gpu?.requestAdapter(); gpu = a ? { fallback: !!a.isFallbackAdapter, vendor: a.info?.vendor || null, arch: a.info?.architecture || null } : null; } catch { /* none */ }
  const c = navigator.connection;
  return { ua: navigator.userAgent, cores: navigator.hardwareConcurrency ?? null, deviceMemoryGb: navigator.deviceMemory ?? null,
           webgpu: gpu, connection: c ? { type: c.effectiveType ?? null, saveData: !!c.saveData, downlinkMbps: c.downlink ?? null } : null,
           screen: `${screen.width}x${screen.height}@${devicePixelRatio}`, webglRenderer: webglRendererName() };
}

// ── run ────────────────────────────────────────────────────────────────────
async function run() {
  $("go").disabled = true;
  const t0 = performance.now(), at = () => Math.round(performance.now() - t0);
  const video = $("v");
  const timings = {}, res = { perf_version: PERF_VERSION, pipeline: PIPELINE, source: SRC === "camera" ? "camera" : "image", tier: TIER, seconds: SECONDS };
  res.device = await deviceInfo();
  let stream;
  try {
    stream = await openSource(video); timings.sourceMs = at();
    const pose = await loadPose(); timings.poseReadyMs = at();
    res.pose = { source: pose.source, delegate: pose.delegate, mode: pose.mode };
    log(`pose model ready in ${timings.poseReadyMs} ms (${pose.source}, ${pose.delegate})`);

    const W = video.videoWidth, H = video.videoHeight;
    res.frame = { W, H };
    const q = qualityFor(TIER);
    const euro = /^euro:([\d.]+),([\d.]+)$/.exec(Q.get("smoother") || "");            // smoother=euro:1,100 to compare
    const smoother = euro ? createOneEuroLandmarkSmoother({ minCutoff: +euro[1], beta: +euro[2] }) : createLandmarkSmoother(q.smoothingAlpha, q.outlierMaxConsecutive);
    res.smoother = euro ? `one-euro ${euro[1]}/${euro[2]}` : `ema ${q.smoothingAlpha}`;
    const enh = PIPELINE === "fused" ? createLiveEnhancer(null, { rtmw: RTMW_OPTS, face: pose.face }) : null;
    resetProportions?.();
    const sess = Date.now();

    const rec = { t: [], cost: [], raf: [], raw: [], fused: [], smooth: [], series: {}, heap: [] };
    const push = (k, v) => { (rec.series[k] ||= []).push(Number.isFinite(v) ? v : NaN); };
    const infer = [], intervals = [], pitchMethods = {};
    let rateOpts = {};
    try { rateOpts = JSON.parse(Q.get("rateOpts") || "{}"); } catch { /* defaults */ }      // tuning only, e.g. {"slowMs":150}
    const rate = Q.get("rate") === "fixed" ? null : createRateController(rateOpts);
    let intervalMs = 50;
    let measuring = false, startT = 0, lastT = 0, lastRaf = 0, prec = null, lastScore = null, done;
    const finished = new Promise(r => { done = r; });

    const tick = () => {
      const now = performance.now();
      if (measuring && lastRaf) rec.raf.push(now - lastRaf);
      lastRaf = now;
      if (now - lastT < intervalMs || video.readyState < 2) return requestAnimationFrame(tick);   // same pacing as the app
      lastT = now;
      const c0 = performance.now();
      const det = pose.pl.detectForVideo(video, now);
      if (det.pending) { lastT = 0; return requestAnimationFrame(tick); }     // nothing new from the worker: ask again next frame
      if (det.ms != null) infer.push(det.ms);
      intervalMs = rate ? rate.update(det.landmarks?.[0] || null, now) : 50;
      pose.pl.setMinInterval?.(intervalMs);
      if (measuring) intervals.push(intervalMs);
      const raw = det.landmarks?.[0];
      if (raw) {
        timings.firstLandmarksMs ??= at();
        let fused = raw;
        if (enh) { try { fused = enh.fuse(raw, video, W, H, now); } catch { fused = raw; } }
        const lms = smoother.smooth(fused);
        const headPose = enh?.headPitch?.(now) ?? null;                       // same hand-over as App.jsx
        const r = analyzeMP(lms, W, H, "laptop", null, sess, null, null, headPose ? { head: headPose } : null);
        if (measuring && r?.bodyModules?.monitor) { const mm = r.bodyModules.monitor; pitchMethods[mm.method || "landmark_proxy"] = (pitchMethods[mm.method || "landmark_proxy"] || 0) + 1; push("headPitch.relDeg", mm.pitchDeg); if (headPose) push("headPitch.absDeg", headPose.pitchDeg); }
        if (enh) { try { prec = enh.process(video, lms, W, H, now, lastScore); } catch { /* keep going */ } }
        if (r?.score != null) { lastScore = r.score; timings.firstScoreMs ??= at(); }
        if (prec) {
          if (prec.faceModel === "on") timings.faceReadyMs ??= at();
          if (prec.rtmw?.state === "on" || prec.rtmw?.state === "off") timings.rtmwSettledMs ??= at();
        }
        const rtmwSettled = !enh || !WAIT_RTMW || timings.rtmwSettledMs != null || at() > RTMW_WAIT_MAX_MS;
        if (!measuring && timings.firstScoreMs != null && rtmwSettled && now - t0 > (timings.measureFromMs ??= at() + WARMUP * 1000)) {
          measuring = true; startT = now; lastRaf = 0; window.__perfMeasuring = true;
        }
        if (measuring) {
          rec.t.push(now); rec.cost.push(performance.now() - c0);
          const pick = l => l.map(p => ({ x: p.x, y: p.y }));
          rec.raw.push(pick(raw)); rec.fused.push(pick(fused)); rec.smooth.push(pick(lms));
          push("score", r?.score);
          for (const [k, m] of Object.entries(r?.metrics || {})) if (typeof m?.value === "number") push(`metric.${k}`, m.value);
          if (prec) { push("prec.headFlexion", prec.headFlexion); push("prec.distCm", prec.distCm); push("prec.confidence", prec.confidence); push("prec.agreement", prec.agreement); }
          if (rec.t.length % 20 === 0) { rec.heap.push(heapMb()); $("status").textContent = `measuring… ${Math.round((now - startT) / 1000)}/${SECONDS}s`; }
          if (now - startT >= SECONDS * 1000) return done();
        } else $("status").textContent = prec?.rtmw?.state === "loading" ? `loading third model… ${prec.rtmw.progress}%` : "warming up…";
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    await finished;

    res.timings = timings;
    res.pacing = pacing(rec.t, rec.cost, rec.raf);
    res.headPitchMethods = pitchMethods;          // how often the engine used the 3-D head pose vs the landmark proxy
    res.rate = { mode: rate ? "adaptive" : "fixed", slowShare: intervals.length ? Math.round(100 * intervals.filter(i => i > 50).length / intervals.length) / 100 : null };
    res.pipeline = pipelineId({ vision: pose.pl.info || { mode: pose.mode, delegate: pose.delegate }, precision: prec });
    res.workerInferMs = infer.length ? Math.round(infer.slice(-100).sort((a, b) => a - b)[Math.floor(Math.min(infer.length, 100) / 2)]) : null;
    res.jitter = { raw: landmarkJitter(rec.raw, W, H), fused: landmarkJitter(rec.fused, W, H), smoothed: landmarkJitter(rec.smooth, W, H) };
    res.stability = seriesStats(rec.series);
    res.heapMb = { end: heapMb(), max: Math.max(...rec.heap.filter(Number.isFinite), 0) || null };
    res.precision = prec ? { faceModel: prec.faceModel, models: prec.models, rtmw: prec.rtmw } : null;
    try { const e = await navigator.storage?.estimate(); res.storageMb = e ? Math.round((e.usage || 0) / 1048576) : null; } catch { res.storageMb = null; }
    enh?.close(); pose.close?.();
  } catch (e) {
    res.error = String(e?.message || e);
  }
  stream?.__stop?.(); stream?.getTracks().forEach(t => t.stop());
  $("status").textContent = res.error ? "failed" : "done";
  $("out").textContent = JSON.stringify(res, null, 2);
  $("dl").hidden = false;
  $("dl").onclick = () => {
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([JSON.stringify(res, null, 2)], { type: "application/json" })),
      download: `posmoz-perf-${PIPELINE}-${Date.now()}.json` });
    a.click(); URL.revokeObjectURL(a.href);
  };
  window.__perfResult = res;
}

$("cfg").textContent = `pipeline=${PIPELINE} · source=${SRC === "camera" ? "camera" : "image"} · ${SECONDS}s after ${WARMUP}s warm-up`;
$("go").onclick = run;
if (Q.get("auto") === "1") run();
