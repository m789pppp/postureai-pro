/**
 * calibrationCore.js — pure, testable helpers for the Smart Calibration flow.
 * No React, no DOM, no MediaPipe import: everything takes plain numbers/arrays,
 * so it runs the same in the browser and in Node tests.
 *
 *  - One Euro filter (Casiez et al., CHI 2012): low jitter when still,
 *    low lag when moving — better than a fixed-alpha EMA for live landmarks.
 *  - Robust statistics (median / MAD outlier rejection) for the neutral baseline.
 *  - Iris-based distance: horizontal iris diameter ≈ 11.7 ± 0.5 mm in adults
 *    (MediaPipe Iris; Google reports ~4.3 % mean depth error with a known focal length).
 *  - Head pose (pitch / yaw / roll) from Face Landmarker's facial transformation matrix.
 *  - Framing checklist ("is the person in the right spot?") and a 0–100 quality score.
 */

export const IRIS_DIAMETER_MM = 11.7;
export const DEFAULT_HFOV_DEG = 65;          // typical laptop webcam; used only when uncalibrated
export const DIST_RANGE_CM = [45, 85];      // comfortable desk distance to the screen/camera

const DEG = 180 / Math.PI;

// ── One Euro filter ─────────────────────────────────────────────────────────
function alpha(cutoffHz, dt) {
  const tau = 1 / (2 * Math.PI * cutoffHz);
  return 1 / (1 + tau / dt);
}

export class OneEuroFilter {
  constructor({ minCutoff = 1.0, beta = 0.02, dCutoff = 1.0 } = {}) {
    this.minCutoff = minCutoff; this.beta = beta; this.dCutoff = dCutoff;
    this.reset();
  }
  reset() { this.x = null; this.dx = 0; this.t = null; }
  /** @param {number} value  @param {number} tSec  timestamp in seconds */
  filter(value, tSec) {
    if (this.x === null || this.t === null || !Number.isFinite(value)) {
      this.x = value; this.t = tSec; this.dx = 0; return value;
    }
    const dt = Math.max(1e-3, Math.min(0.5, tSec - this.t));
    this.t = tSec;
    const rawDx = (value - this.x) / dt;
    this.dx = this.dx + alpha(this.dCutoff, dt) * (rawDx - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x = this.x + alpha(cutoff, dt) * (value - this.x);
    return this.x;
  }
}

/** Smooths an array of {x,y,z,visibility} landmarks (normalised coords). */
export function createOneEuroLandmarkSmoother(opts = {}) {
  let filters = null;
  return {
    smooth(lms, tMs) {
      if (!lms?.length) return lms;
      const t = (tMs ?? (typeof performance !== "undefined" ? performance.now() : Date.now())) / 1000;
      if (!filters || filters.length !== lms.length) {
        filters = lms.map(() => [new OneEuroFilter(opts), new OneEuroFilter(opts), new OneEuroFilter(opts)]);
      }
      return lms.map((p, i) => ({
        ...p,
        x: filters[i][0].filter(p.x, t),
        y: filters[i][1].filter(p.y, t),
        z: filters[i][2].filter(p.z ?? 0, t),
      }));
    },
    reset() { filters = null; },
  };
}

// ── Robust statistics ───────────────────────────────────────────────────────
export function median(arr) {
  const a = arr.filter(Number.isFinite).slice().sort((p, q) => p - q);
  if (!a.length) return NaN;
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

/** Median absolute deviation, scaled to be comparable with a standard deviation. */
export function madSigma(arr) {
  const m = median(arr);
  return 1.4826 * median(arr.filter(Number.isFinite).map(v => Math.abs(v - m)));
}

/**
 * Mean after dropping values more than k robust-sigmas from the median.
 * Returns { value, kept, rejected, spread } — spread is the robust SD (same unit).
 */
export function robustMean(arr, k = 3) {
  const a = arr.filter(Number.isFinite);
  if (!a.length) return { value: NaN, kept: 0, rejected: 0, spread: NaN };
  const m = median(a);
  const s = madSigma(a);
  const keep = s > 0 ? a.filter(v => Math.abs(v - m) <= k * s) : a;
  const value = keep.reduce((p, q) => p + q, 0) / keep.length;
  return { value, kept: keep.length, rejected: a.length - keep.length, spread: s };
}

// ── Face: iris + head pose ──────────────────────────────────────────────────
// Face Landmarker (478 pts): left iris 468 centre + 469–472 contour,
// right iris 473 centre + 474–477 contour.
const dist = (a, b, W, H) => Math.hypot((a.x - b.x) * W, (a.y - b.y) * H);

/** Mean horizontal iris diameter in pixels (largest contour chord per eye). */
export function irisDiameterPx(face, W, H) {
  if (!face || face.length < 478) return NaN;
  const eye = base => Math.max(dist(face[base + 1], face[base + 3], W, H),
                               dist(face[base + 2], face[base + 4], W, H));
  const d = [eye(468), eye(473)].filter(v => v > 1);
  return d.length ? d.reduce((p, q) => p + q, 0) / d.length : NaN;
}

/** Focal length in px from the frame width and a horizontal field of view. */
export function focalFromHfov(W, hfovDeg = DEFAULT_HFOV_DEG) {
  return (W / 2) / Math.tan((hfovDeg / 2) / DEG);
}

/** Calibrate this camera: focal (px) from a measured distance and the iris size. */
export function focalFromKnownDistance(irisPx, knownCm) {
  return (irisPx * knownCm * 10) / IRIS_DIAMETER_MM;
}

/** Eye-to-camera distance in cm from iris size and focal length (pinhole model). */
export function distanceFromIris(irisPx, focalPx) {
  if (!(irisPx > 1) || !(focalPx > 0)) return NaN;
  return (IRIS_DIAMETER_MM * focalPx) / irisPx / 10;
}

/**
 * Head pose from MediaPipe's 4×4 facial transformation matrix.
 * Accepts a flat 16-array in either column- or row-major order; the layout is
 * detected from where the translation (largest |values|, ~tens of cm) sits.
 * Returns degrees: pitch (+ = chin down / looking down), yaw, roll.
 */
export function headPoseFromMatrix(data) {
  if (!data || data.length < 16) return null;
  const colMajor = Math.abs(data[14]) + Math.abs(data[12]) + Math.abs(data[13]) >=
                   Math.abs(data[11]) + Math.abs(data[3]) + Math.abs(data[7]);
  const r = (i, j) => (colMajor ? data[j * 4 + i] : data[i * 4 + j]);
  const sy = Math.hypot(r(0, 0), r(1, 0));
  let pitch, yaw, roll;
  if (sy > 1e-6) {
    pitch = Math.atan2(r(2, 1), r(2, 2));
    yaw   = Math.atan2(-r(2, 0), sy);
    roll  = Math.atan2(r(1, 0), r(0, 0));
  } else {                      // gimbal lock — never happens at a desk, but stay finite
    pitch = Math.atan2(-r(1, 2), r(1, 1));
    yaw   = Math.atan2(-r(2, 0), sy);
    roll  = 0;
  }
  return { pitch: pitch * DEG, yaw: yaw * DEG, roll: roll * DEG };
}

// ── Framing checklist ───────────────────────────────────────────────────────
const vis = (p, min = 0.6) => !!p && (p.visibility ?? 1) >= min;

/**
 * "Is the person in the right spot?" — one entry per check, in the order the
 * user should fix them. Inputs are normalised MediaPipe landmarks.
 *
 * @param {object} o
 * @param {Array}  o.pose      33 pose landmarks (first person) or null
 * @param {number} o.people    number of detected people
 * @param {object} o.head      {pitch,yaw,roll} or null
 * @param {number} o.distCm    estimated distance or NaN
 * @param {number} o.luma      mean frame brightness 0–255 or NaN
 * @param {number} o.motion    recent movement in shoulder-widths per second
 */
export function framingChecks({ pose, people = 1, head = null, distCm = NaN, luma = NaN, motion = NaN }) {
  const items = [];
  const add = (key, ok, value = null) => items.push({ key, ok: !!ok, value });

  const found = !!pose && vis(pose[11]) && vis(pose[12]) && vis(pose[0], 0.5);
  add("person", found && people <= 1, people);
  if (!found) {
    ["centered", "headroom", "distance", "facing", "lighting", "still"].forEach(k => add(k, false));
    return finish(items);
  }
  const midX = (pose[11].x + pose[12].x) / 2;
  add("centered", midX > 0.38 && midX < 0.62, midX);

  const eyeY = vis(pose[2], 0.4) && vis(pose[5], 0.4) ? (pose[2].y + pose[5].y) / 2 : pose[0].y;
  const shY = (pose[11].y + pose[12].y) / 2;
  add("headroom", eyeY > 0.18 && eyeY < 0.48 && shY < 0.9, eyeY);

  const swFrac = Math.abs(pose[11].x - pose[12].x);
  const distOk = Number.isFinite(distCm)
    ? distCm >= DIST_RANGE_CM[0] && distCm <= DIST_RANGE_CM[1]
    : swFrac > 0.22 && swFrac < 0.6;
  add("distance", distOk, Number.isFinite(distCm) ? distCm : swFrac);

  const facingOk = head
    ? Math.abs(head.yaw) < 12 && Math.abs(head.roll) < 10
    : Math.abs((pose[7].x + pose[8].x) / 2 - pose[0].x) < 0.25 * swFrac;
  add("facing", facingOk, head ? head.yaw : null);

  add("lighting", !Number.isFinite(luma) || (luma > 55 && luma < 215), luma);
  add("still", Number.isFinite(motion) && motion < 0.25, motion);
  return finish(items);
}

function finish(items) {
  const firstFail = items.find(i => !i.ok) || null;
  return { items, ready: !firstFail, firstFail: firstFail?.key ?? null };
}

/** Movement of shoulders + nose between two pose frames, in shoulder-widths/second. */
export function poseMotion(prev, cur, dtSec) {
  if (!prev || !cur || !(dtSec > 0)) return NaN;
  const sw = Math.abs(cur[11].x - cur[12].x) || 1e-3;
  const d = [0, 11, 12].map(i => Math.hypot(cur[i].x - prev[i].x, cur[i].y - prev[i].y));
  return Math.max(...d) / sw / dtSec;
}

// ── Calibration quality score ───────────────────────────────────────────────
/**
 * 0–100 score + the reasons that lowered it.
 * @param {object} q
 * @param {number} q.validFrames      frames that passed the framing checklist
 * @param {number} q.targetFrames     frames we aimed for
 * @param {object} q.spreads          robust SD per baseline metric (degrees)
 * @param {boolean} q.distanceMeasured user typed a tape-measured distance
 * @param {boolean} q.faceTracked     face landmarker contributed head pose / iris
 * @param {number} q.rejectedRatio    share of frames rejected as outliers
 */
export function calibrationQuality({ validFrames, targetFrames, spreads = {}, distanceMeasured,
                                     faceTracked, rejectedRatio = 0 }) {
  let score = 100;
  const reasons = [];
  const cov = Math.min(1, validFrames / Math.max(1, targetFrames));
  if (cov < 1) { score -= Math.round((1 - cov) * 30); reasons.push("few_frames"); }
  const worst = Math.max(0, ...Object.values(spreads).filter(Number.isFinite));
  if (worst > 1.0) { score -= Math.min(30, Math.round((worst - 1.0) * 10)); reasons.push("movement"); }
  if (rejectedRatio > 0.15) { score -= Math.min(15, Math.round(rejectedRatio * 40)); reasons.push("outliers"); }
  if (!distanceMeasured) { score -= 10; reasons.push("distance_estimated"); }
  if (!faceTracked) { score -= 10; reasons.push("no_face_model"); }
  score = Math.max(0, Math.min(100, score));
  const grade = score >= 85 ? "high" : score >= 65 ? "good" : "low";
  return { score, grade, reasons };
}

// ── Neutral learned at the start of a session ───────────────────────────────
/**
 * Learns a person's settled value of some reading (e.g. head pitch) at the start of a
 * session, by TIME rather than by a count of samples: the first `skipMs` are ignored
 * (the person is still settling), the next `learnMs` are sampled, and the median becomes
 * the neutral. Used when no calibrated neutral exists, so that a tilted camera does not
 * read as a tilted head. Pure — unit-tested.
 */
export function createNeutralLearner({ skipMs = 1000, learnMs = 2000, minSamples = 6 } = {}) {
  let t0 = null, samples = [], value = null;
  return {
    /** @returns {number|null} the neutral once learned, else null */
    feed(v, tMs) {
      if (value !== null || !Number.isFinite(v)) return value;
      if (t0 === null) t0 = tMs;
      const age = tMs - t0;
      if (age < skipMs) return null;
      samples.push(v);
      if (age >= skipMs + learnMs && samples.length >= minSamples) value = median(samples);
      return value;
    },
    get value() { return value; },
    reset() { t0 = null; samples = []; value = null; },
  };
}
