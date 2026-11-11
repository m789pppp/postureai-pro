#!/usr/bin/env node
/**
 * smoothing-bench.mjs — landmark smoothing on the synthetic subject, where the true
 * position of every landmark is known.
 *
 *   node scripts/smoothing-bench.mjs [--json]
 *
 * For each smoother it reports, at 20 analysed frames per second and 1.5 px landmark noise:
 *   jitter   RMS error of the key landmarks while the subject is perfectly still (px)
 *   angle    SD of the engine's neck / head-tilt / shoulder readings while still (°)
 *   lag      time for the head landmarks to cover 90 % of a sudden 6 cm forward-head move (ms)
 *   track    RMS error while the subject sways slowly (px) — noise and lag together
 *
 * This is geometry with Gaussian noise, not a camera: it ranks smoothers against each
 * other, it does not predict the jitter of a real session and is not validation on people.
 */
import { analyzeMP, resetProportions, createLandmarkSmoother } from "../src/features/analysis/postureEngine.js";
import { createOneEuroLandmarkSmoother } from "../src/features/analysis/calibrationCore.js";
import { renderSubject, jitter, mulberry32 } from "../src/features/analysis/syntheticSubject.mjs";
import { QUALITY } from "../src/lib/tierQuality.js";
import { sd, KEY_LANDMARKS } from "../src/bench/perfCore.js";

const W = 1280, H = 720, DT = 50, NOISE = 1.5;
let clock = 1e6;
// Both smoothers read the wall clock; the bench drives a fake one so 20 fps is exact.
Object.defineProperty(globalThis, "performance", { value: { now: () => clock }, configurable: true });

export const SMOOTHERS = {
  "none": () => ({ smooth: l => l }),
  ...Object.fromEntries(Object.entries(QUALITY).map(([tier, q]) =>
    [`ema ${q.smoothingAlpha} (${tier})`, () => createLandmarkSmoother(q.smoothingAlpha, q.outlierMaxConsecutive)])),
  "one-euro 1.0 / 0.02": () => createOneEuroLandmarkSmoother({ minCutoff: 1.0, beta: 0.02 }),
  "one-euro 1.5 / 0.3":  () => createOneEuroLandmarkSmoother({ minCutoff: 1.5, beta: 0.3 }),
  "one-euro 2.0 / 0.5":  () => createOneEuroLandmarkSmoother({ minCutoff: 2.0, beta: 0.5 }),
};

const px = (a, b, i) => Math.hypot((a[i].x - b[i].x) * W, (a[i].y - b[i].y) * H);
const rms = a => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / Math.max(1, a.length));

function run(make, seed = 11) {
  const rng = mulberry32(seed);
  const frame = (sm, pose) => {
    clock += DT; analyzeMP.__testNowMs = clock;
    const truth = renderSubject(pose);
    return { truth, out: sm.smooth(jitter(truth, NOISE, {}, rng), clock) };
  };

  // still: 20 s at neutral, first 3 s ignored
  let sm = make(); resetProportions();
  const err = [], ang = { neck_lean: [], head_tilt: [], shoulder_level: [] };
  for (let i = 0; i < 400; i++) {
    const { truth, out } = frame(sm, {});
    const r = analyzeMP(out, W, H, "front");
    if (i < 60) continue;
    for (const k of KEY_LANDMARKS) err.push(px(out, truth, k));
    for (const k of Object.keys(ang)) ang[k].push(r?.metrics?.[k]?.value);
  }

  // step: sudden 6 cm forward head; time until the nose has covered 90 % of the move
  sm = make();
  for (let i = 0; i < 60; i++) frame(sm, {});
  const a = renderSubject({}), b = renderSubject({ forwardHeadCm: 6, neckFlexDeg: 15 });
  const full = px(a, b, 0); let lag = null;
  for (let i = 1; i <= 60 && lag == null; i++) {
    const { out } = frame(sm, { forwardHeadCm: 6, neckFlexDeg: 15 });
    if (px(out, a, 0) >= 0.9 * full) lag = i * DT;
  }

  // sway: slow 0.25 Hz lateral lean, 20 s
  sm = make();
  const track = [];
  for (let i = 0; i < 400; i++) {
    const { truth, out } = frame(sm, { lateralLeanDeg: 6 * Math.sin((2 * Math.PI * 0.25 * i * DT) / 1000) });
    if (i >= 40) for (const k of KEY_LANDMARKS) track.push(px(out, truth, k));
  }
  analyzeMP.__testNowMs = null;
  const r2 = v => Math.round(v * 100) / 100;
  return { jitterPx: r2(rms(err)), neckSd: r2(sd(ang.neck_lean)), tiltSd: r2(sd(ang.head_tilt)), shoulderSd: r2(sd(ang.shoulder_level)),
           lagMs: lag, trackPx: r2(rms(track)) };
}

export function smoothingBench() {
  const out = {};
  for (const [name, make] of Object.entries(SMOOTHERS)) {
    // median over 5 seeds
    const runs = [21, 22, 23, 24, 25].map(s => run(make, s));
    const med = k => runs.map(r => r[k]).sort((x, y) => x - y)[2];
    out[name] = Object.fromEntries(Object.keys(runs[0]).map(k => [k, med(k)]));
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const res = smoothingBench();
  if (process.argv.includes("--json")) console.log(JSON.stringify(res, null, 2));
  else {
    console.log("smoother                    jitter px  neck°sd  tilt°sd  shoulder°sd  lag ms  track px");
    for (const [n, r] of Object.entries(res))
      console.log(`${n.padEnd(27)} ${String(r.jitterPx).padStart(8)} ${String(r.neckSd).padStart(8)} ${String(r.tiltSd).padStart(8)} ${String(r.shoulderSd).padStart(12)} ${String(r.lagMs).padStart(7)} ${String(r.trackPx).padStart(9)}`);
  }
}
