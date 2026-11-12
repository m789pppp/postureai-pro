/**
 * perfCore.js — pure statistics for the live-pipeline benchmark (perf.html).
 * No DOM: runs the same in the browser and in Node tests.
 *
 * What the benchmark reports, and what it does not:
 *   - speed (load, first score, frame rate), memory and STABILITY of a still subject.
 *   - it has no ground truth for a real person, so it says nothing about accuracy on
 *     people. Accuracy against known truth exists only for the synthetic rig
 *     (postureEngine.accuracy.mjs, scripts/smoothing-bench.mjs).
 */

export const PERF_VERSION = 1;
/** Landmarks the desk-posture engine leans on: nose, ears, shoulders. */
export const KEY_LANDMARKS = [0, 7, 8, 11, 12];

export function mean(a) {
  let s = 0, n = 0;
  for (const v of a) if (Number.isFinite(v)) { s += v; n++; }
  return n ? s / n : NaN;
}

/** Sample standard deviation (n − 1). NaN with fewer than 2 finite values. */
export function sd(a) {
  const m = mean(a);
  let s = 0, n = 0;
  for (const v of a) if (Number.isFinite(v)) { s += (v - m) ** 2; n++; }
  return n > 1 ? Math.sqrt(s / (n - 1)) : NaN;
}

/** Linear-interpolated percentile, p in 0..100. */
export function percentile(a, p) {
  const s = a.filter(Number.isFinite).sort((x, y) => x - y);
  if (!s.length) return NaN;
  const i = (s.length - 1) * (p / 100), lo = Math.floor(i), hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
}

const r = (v, d = 2) => (Number.isFinite(v) ? Math.round(v * 10 ** d) / 10 ** d : null);

/**
 * Jitter of a still subject.
 * @param {Array<Array<{x:number,y:number}>>} frames normalised landmarks, one array per frame
 * @returns {{px:number|null, swPct:number|null, perLandmark:object, frames:number}}
 *   px     RMS over the key landmarks of the per-axis SD, in source pixels
 *   swPct  the same as a percentage of the shoulder width (comparable across distances)
 */
export function landmarkJitter(frames, W, H, keys = KEY_LANDMARKS) {
  const ok = frames.filter(f => f && keys.every(k => f[k]));
  if (ok.length < 3) return { px: null, swPct: null, perLandmark: {}, frames: ok.length };
  const sw = mean(ok.map(f => Math.hypot((f[11].x - f[12].x) * W, (f[11].y - f[12].y) * H)));
  const per = {}; let sum = 0;
  for (const k of keys) {
    const sx = sd(ok.map(f => f[k].x * W)), sy = sd(ok.map(f => f[k].y * H));
    const v = Math.sqrt((sx * sx + sy * sy) / 2);
    per[k] = r(v, 3); sum += v * v;
  }
  const px = Math.sqrt(sum / keys.length);
  return { px: r(px, 3), swPct: sw > 1 ? r((100 * px) / sw, 3) : null, perLandmark: per, frames: ok.length };
}

/** SD and mean of every numeric series in { name: number[] }. */
export function seriesStats(series) {
  const out = {};
  for (const [k, a] of Object.entries(series)) {
    const f = a.filter(Number.isFinite);
    if (f.length >= 3) out[k] = { mean: r(mean(f)), sd: r(sd(f), 3), n: f.length };
  }
  return out;
}

/**
 * Frame pacing from the timestamps of analysed frames and the cost of each one.
 * @param {number[]} tMs      time of each analysed frame
 * @param {number[]} costMs   main-thread time spent in each analysed frame
 * @param {number[]} rafGapMs gap between consecutive animation frames (UI smoothness)
 */
export function pacing(tMs, costMs, rafGapMs = []) {
  const span = tMs.length > 1 ? (tMs[tMs.length - 1] - tMs[0]) / 1000 : 0;
  return {
    fps: span > 0 ? r((tMs.length - 1) / span, 1) : null,
    frames: tMs.length,
    costP50: r(percentile(costMs, 50), 1),
    costP95: r(percentile(costMs, 95), 1),
    costMax: costMs.length ? r(Math.max(...costMs), 1) : null,
    rafGapP95: r(percentile(rafGapMs, 95), 1),
    longFrames: rafGapMs.filter(g => g > 100).length,   // visible stalls of the page
  };
}

/** Median of each numeric leaf across repeated runs (objects with the same shape). */
export function medianOfRuns(runs) {
  if (!runs.length) return null;
  const first = runs.find(v => v != null) ?? null;
  if (typeof first === "number" || first === null) return r(percentile(runs.filter(Number.isFinite), 50), 3);
  if (typeof first !== "object") return first;
  if (Array.isArray(first)) return first;
  const out = {};
  for (const k of Object.keys(first)) out[k] = medianOfRuns(runs.map(x => x?.[k]).filter(v => v !== undefined));
  return out;
}
