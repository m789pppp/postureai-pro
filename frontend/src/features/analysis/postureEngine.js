/**
 * Corvus Posture Engine v3 — Production Grade
 * ============================================
 * Phase 1-17 complete rebuild based on audit findings.
 *
 * KEY CHANGES FROM v2:
 * - Unified visibility threshold: 0.6 everywhere (was 0.3/0.45/0.5)
 * - True 3D angle vectors using Z coordinate from MediaPipe
 * - Frame buffer (60 frames) with median + trimmed-mean aggregation
 * - Body-proportion normalization (shoulder-width based, not pixels)
 * - Documented constants replacing all magic numbers
 * - Independent body module analyzers with severity classification
 * - Dead code removed (drawFrontOverlay, drawSideOverlay unused)
 * - distanceScore asymmetry fixed and documented
 *
 * KNOWN DIVERGENCE FROM backend.py (intentional, not a bug):
 * - Threshold constants below (THR) are kept numerically in sync with
 *   backend.py's score_m() calls — verify both whenever either changes.
 * - The NECK LEAN *algorithm* is NOT identical: backend.py's analyze_front()
 *   blends solvePnP head-pose pitch (80%, requires FaceMesh + OpenCV,
 *   geometrically exact) with a nose-offset proxy (20%). This client-side
 *   engine has no FaceMesh/solvePnP access and uses a pure nose+ear 2D
 *   blend instead. Expect the two neck-lean readings to differ by a few
 *   degrees for the same pose — this is expected, not a sync bug.
 */

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS — no magic numbers
// ═══════════════════════════════════════════════════════════════════

/** Minimum landmark visibility/presence to trust a reading */
const VIS_MIN = 0.60;

/** Adult average IPD in cm (interpupillary distance) */
const IPD_CM = 6.3;

/** Focal length in pixels calibrated at 1280px width, 720p camera */
const FOCAL_PX_1280 = 800;

/** Adult average shoulder width in cm */
const SHOULDER_WIDTH_CM = 42.0;

/** Reference shoulder-width fraction of frame at ~65cm distance */
const REF_SH_FRAC = 0.34;

/** Neutral nose-drop fraction relative to eye width (head level gaze) */
const NEUTRAL_NOSE_DROP_FRAC = 0.62;

/** Nose sits this many cm ahead of ear plane — used to correct FHP */
const NOSE_AHEAD_CM = 5.0;

/** Maximum plausible landmark velocity (normalized/sec) for jitter rejection */
const MAX_LM_VELOCITY = 3.0;

/** Frames to accept as genuine fast movement before overriding rejection */
const MAX_REJECT_STREAK = 3;

/** Frame buffer size for aggregation */
const FRAME_BUFFER_SIZE = 150; // was 60 (2s) — raised to 150 (5s) for smoother score history

/** Beep cooldown in ms */
const BEEP_COOLDOWN_MS = 30000;

// ─── Scoring thresholds (synced with backend.py score_m calls) ─────
const THR = {
  // Front camera
  HEAD_TILT:   { ok: 3,  bad: 10  },  // backend: score_m(head_tilt, 0, 3, 10)
  SH_TILT:     { ok: 3,  bad: 10  },  // backend: score_m(sh_tilt,   0, 3, 10)
  SPINE_LEAN:  { ok: 4,  bad: 12  },  // backend: score_m(spine_lean,0, 4, 12)
  HEAD_YAW:    { ok: 8,  bad: 20  },
  FHP_CM:      { ok: 2,  bad: 6   },  // forward head posture in cm
  ROUNDED:     { ok: 8,  bad: 20  },  // rounded shoulders Z-depth
  ELBOW:       { ok: 15, bad: 30  },  // deviation from 95° ideal
  MONITOR_PITCH:{ ok: 5, bad: 18  },  // head pitch degrees

  // Side camera
  NECK_SIDE:   { ok: 8,  bad: 22  },
  TRUNK_LEAN:  { ok: 6,  bad: 16  },  // backend: score_m(trunk_lean, 0, 6, 16)
  HIP_ANGLE:   { ok: 12, bad: 30  },  // deviation from 90°
  KNEE_ANGLE:  { ok: 12, bad: 35  },  // deviation from 90°
  SPINE_ALIGN: { ok: 4,  bad: 12  },  // backend: score_m(spine_align, 0, 4, 12)
};

// ─── Weighted scoring (front camera) ───────────────────────────────
// NOTE: fhp, elbow, and monitor-height are intentionally NOT weighted
// into the overall score (mirrors backend.py) — they surface as
// informational metrics/alerts only, since they're more
// setup/ergonomics signals than posture-quality signals.
const WEIGHTS_FRONT = {
  neck:     0.28,
  tilt:     0.10,
  shoulder: 0.11,
  spine:    0.14,
  distance: 0.18,
  yaw:      0.06,
  rounded:  0.08,
  // remaining 0.05 = baseline constant
};

// ─── Weighted scoring (side camera) ────────────────────────────────
const WEIGHTS_SIDE = {
  neck:    0.30,
  trunk:   0.28,
  hip:     0.18,
  knee:    0.12,
  spine:   0.12,
};

// ─── Severity thresholds for condition classification ──────────────
const SEV = {
  // Forward head posture (cm)
  FHP: { mild: 1, moderate: 3, severe: 6 },
  // Neck lean (degrees)
  NECK: { mild: 5, moderate: 12, severe: 20 },
  // Shoulder tilt (degrees)
  SHOULDER: { mild: 3, moderate: 7, severe: 12 },
  // Rounded shoulders (Z-depth units)
  ROUNDED: { mild: 5, moderate: 10, severe: 18 },
  // Head yaw (degrees)
  YAW: { mild: 8, moderate: 18, severe: 30 },
  // Spine lean (degrees)
  SPINE: { mild: 5, moderate: 10, severe: 18 },
};

// ═══════════════════════════════════════════════════════════════════
// LANDMARK INDICES
// ═══════════════════════════════════════════════════════════════════

export const PL = {
  NOSE: 0,
  L_EYE_INNER: 1, L_EYE: 2, L_EYE_OUTER: 3,
  R_EYE_INNER: 4, R_EYE: 5, R_EYE_OUTER: 6,
  L_EAR: 7, R_EAR: 8,
  L_SHOULDER: 11, R_SHOULDER: 12,
  L_ELBOW: 13,    R_ELBOW: 14,
  L_WRIST: 15,    R_WRIST: 16,
  L_HIP: 23,      R_HIP: 24,
  L_KNEE: 25,     R_KNEE: 26,
  L_ANKLE: 27,    R_ANKLE: 28,
};

// ═══════════════════════════════════════════════════════════════════
// GEOMETRY — 3D vector math
// ═══════════════════════════════════════════════════════════════════

/**
 * 3D vector from two landmarks.
 * @param {object} a - {x,y,z}
 * @param {object} b - {x,y,z}
 */
function vec3(a, b) {
  return { x: b.x - a.x, y: b.y - a.y, z: (b.z ?? 0) - (a.z ?? 0) };
}

function dot3(u, v) { return u.x*v.x + u.y*v.y + u.z*v.z; }
function mag3(v)    { return Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z); }

/**
 * Angle between two 3D vectors in degrees.
 * Uses dot product formula — accurate regardless of coordinate plane.
 */
function angleBetween3D(u, v) {
  const m = mag3(u) * mag3(v);
  if (m < 1e-6) return 0;
  return Math.acos(Math.max(-1, Math.min(1, dot3(u, v) / m))) * 180 / Math.PI;
}

/**
 * Vertical deviation angle of a vector from the Y-axis (degrees).
 * Works in 2D (ignores Z) — used for lean measurements where
 * we care about screen-plane deviation.
 * @returns {number} degrees (0 = vertical, 90 = horizontal)
 */
export function angleVert(p1, p2) {
  if (!p1 || !p2 || !isFinite(p1.x) || !isFinite(p2.x)) return 0;
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  if (!isFinite(dx) || !isFinite(dy)) return 0;
  return Math.abs(Math.atan2(Math.abs(dx), Math.abs(dy))) * 180 / Math.PI;
}

/**
 * Horizontal deviation angle of a vector from the X-axis (degrees).
 * @returns {number} degrees (0 = horizontal, 90 = vertical)
 */
export function angleHoriz(p1, p2) {
  if (!p1 || !p2 || !isFinite(p1.x) || !isFinite(p2.x)) return 0;
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  if (!isFinite(dx) || !isFinite(dy)) return 0;
  return Math.abs(Math.atan2(Math.abs(dy), Math.abs(dx))) * 180 / Math.PI;
}

/**
 * 2D angle at vertex b formed by rays b→a and b→c.
 * Used for joint angles (elbow, hip, knee).
 */
export function angle3pt(a, b, c) {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const n1 = Math.sqrt(v1.x*v1.x + v1.y*v1.y);
  const n2 = Math.sqrt(v2.x*v2.x + v2.y*v2.y);
  if (n1 < 1e-4 || n2 < 1e-4) return 90;
  const cos = (v1.x*v2.x + v1.y*v2.y) / (n1 * n2);
  return Math.round(Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI);
}

// ═══════════════════════════════════════════════════════════════════
// SCORING
// ═══════════════════════════════════════════════════════════════════

/**
 * Piece-wise linear + quadratic score.
 * Mirrors backend.py score_m() exactly — any change must be reflected there.
 *
 * d <= ok:  score 100 → 75  (green zone)
 * d <= bad: score 75  → 30  (yellow zone)
 * d >  bad: score 30  → 5   (red zone, quadratic decay)
 */
export function scoreMetric(v, ideal, ok, bad) {
  const d = Math.abs(v - ideal);
  if (d <= ok)  return Math.max(0, Math.trunc(100 - (d / Math.max(ok, 0.1)) * 25));
  if (d <= bad) return Math.max(0, Math.trunc(75  - ((d - ok) / Math.max(bad - ok, 0.1)) * 45));
  const excess = d - bad;
  const decay  = Math.min(25, Math.pow(excess, 1.6) * 0.9);
  return Math.max(5, Math.trunc(30 - decay));
}

/** Classify severity of a deviation using named thresholds */
function classify(value, thresholds) {
  if (value >= thresholds.severe)   return "severe";
  if (value >= thresholds.moderate) return "moderate";
  if (value >= thresholds.mild)     return "mild";
  return "normal";
}

/**
 * Resolve scoring thresholds for a metric, personalised from the user's
 * calibration when available, else the supplied population defaults.
 *
 * This is the core of accurate front-mode analysis: instead of scoring
 * everyone against a fixed "ideal = 0°", we score deviation from THIS
 * user's own measured neutral posture, with their own tolerance band.
 * A person with a naturally 6° resting neck angle or a slightly uneven
 * shoulder line is no longer penalised for their anatomy.
 *
 * calibKey maps to PostureCalibration.jsx tolerance keys:
 *   neck_angle · head_tilt · shoulder_tilt · spine_angle
 */
function resolveThr(calib, calibKey, defIdeal, defOk, defBad) {
  const t = calib?.tolerances?.[calibKey];
  if (t && typeof t.ideal === "number" && typeof t.ok === "number" && typeof t.bad === "number") {
    const ok  = Math.max(2, t.ok);
    const bad = Math.max(ok + 2, t.bad);
    return { ideal: t.ideal, ok, bad, personalised: true };
  }
  return { ideal: defIdeal, ok: defOk, bad: defBad, personalised: false };
}

// ═══════════════════════════════════════════════════════════════════
// GRADE / COLOR HELPERS
// ═══════════════════════════════════════════════════════════════════

export function gradeScore(s)   { return s >= 85 ? "Excellent" : s >= 70 ? "Good" : s >= 50 ? "Fair" : "Poor"; }
export function gradeScoreAr(s) { return s >= 85 ? "ممتاز"     : s >= 70 ? "جيد"  : s >= 50 ? "مقبول" : "ضعيف"; }
export function scoreColor(s)   { return s >= 75 ? "#10b981"   : s >= 50 ? "#f59e0b" : "#ef4444"; }

// ═══════════════════════════════════════════════════════════════════
// LANDMARK SMOOTHING — EMA + jitter rejection
// ═══════════════════════════════════════════════════════════════════

/**
 * Creates a stateful landmark smoother.
 *
 * Algorithm:
 *  1. Outlier rejection: single-frame jumps > MAX_VEL * dt are held
 *     at the previous value unless they persist (= real fast motion).
 *  2. EMA with adaptive alpha: low-visibility landmarks are smoothed
 *     more aggressively (alpha × 0.4) to resist bad detections.
 *
 * Usage:
 *   const smoother = createLandmarkSmoother();
 *   const stable   = smoother.smooth(rawMediaPipeLandmarks);
 *   smoother.reset(); // on camera start/stop/mode change
 */
export function createLandmarkSmoother(alpha = 0.4, maxRejectStreak = MAX_REJECT_STREAK) {
  let prev         = null;
  let rejectStreak = null;
  let lastT        = null;
  const REJECT_LIMIT = maxRejectStreak ?? MAX_REJECT_STREAK;

  return {
    smooth(lms) {
      if (!lms?.length) return lms;

      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      const dt  = lastT ? Math.min(0.5, Math.max(0.001, (now - lastT) / 1000)) : 1 / 30;
      lastT = now;

      if (!prev || prev.length !== lms.length) {
        prev         = lms.map(p => ({ x: p.x, y: p.y, z: p.z ?? 0, visibility: p.visibility ?? 1 }));
        rejectStreak = new Array(lms.length).fill(0);
        return prev;
      }

      const maxDist = MAX_LM_VELOCITY * dt;
      const out     = new Array(lms.length);

      for (let i = 0; i < lms.length; i++) {
        const c = lms[i], p = prev[i];
        const jump = Math.hypot(c.x - p.x, c.y - p.y);

        if (jump > maxDist && rejectStreak[i] < REJECT_LIMIT) {
          // Implausible single-frame jump — hold previous position
          rejectStreak[i]++;
          out[i] = { ...p };
          continue;
        }

        rejectStreak[i] = 0;
        const vis = c.visibility ?? 1;
        // Low-confidence landmark: lean on history, trust raw value less
        const a = vis < VIS_MIN ? alpha * 0.4 : alpha;

        out[i] = {
          x:          p.x + a * (c.x - p.x),
          y:          p.y + a * (c.y - p.y),
          z:          p.z + a * ((c.z ?? 0) - p.z),
          visibility: c.visibility ?? 1,
        };
      }

      prev = out;
      return out;
    },

    reset() { prev = null; rejectStreak = null; lastT = null; },
  };
}

// ═══════════════════════════════════════════════════════════════════
// FRAME BUFFER — 60-frame aggregation with outlier rejection
// ═══════════════════════════════════════════════════════════════════

/**
 * Collects raw metric values over FRAME_BUFFER_SIZE frames,
 * then returns the trimmed mean (removes top/bottom 10%).
 * Provides stable readings immune to single-frame spikes.
 */
export function createFrameBuffer(size = FRAME_BUFFER_SIZE) {
  const buffer = [];

  return {
    /** Push a metrics object; returns aggregated result when buffer is full */
    push(metrics) {
      buffer.push(metrics);
      if (buffer.length > size) buffer.shift();
      return buffer.length >= Math.min(10, size); // ready after 10+ frames
    },

    /** Trimmed mean of a numeric field across all buffered frames */
    trimmedMean(field, trimFrac = 0.1) {
      const vals = buffer
        .map(f => f[field])
        .filter(v => typeof v === "number" && isFinite(v))
        .sort((a, b) => a - b);

      if (!vals.length) return null;
      const cut = Math.floor(vals.length * trimFrac);
      const trimmed = vals.slice(cut, vals.length - cut);
      return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
    },

    /** Standard deviation of a field — quality/confidence indicator */
    stdDev(field) {
      const mean = this.trimmedMean(field, 0);
      if (mean === null) return 0;
      const vals = buffer.map(f => f[field]).filter(v => isFinite(v));
      const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
      return Math.sqrt(variance);
    },

    length: () => buffer.length,
    clear()  { buffer.length = 0; },
  };
}

// ═══════════════════════════════════════════════════════════════════
// BODY PROPORTION NORMALIZATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Compute body proportion scalars for camera-independent measurements.
 * All distances in the engine are expressed as fractions of shoulder width
 * or converted to cm using the known shoulder width (SHOULDER_WIDTH_CM).
 *
 * @param {Array}  lms - smoothed landmarks
 * @param {number} W   - frame width px
 * @param {number} H   - frame height px
 * @returns {object} proportions
 */
// Stable shRatio — EMA across calls to prevent per-frame jitter
let _shRatioEMA = null;

function computeProportions(lms, W, H, calibKnownDistCm = null) {
  const g   = i => lms[i];
  const vis = i => (g(i)?.visibility ?? 0) >= VIS_MIN;

  const lSh = { x: g(PL.L_SHOULDER).x * W, y: g(PL.L_SHOULDER).y * H, z: g(PL.L_SHOULDER).z ?? 0 };
  const rSh = { x: g(PL.R_SHOULDER).x * W, y: g(PL.R_SHOULDER).y * H, z: g(PL.R_SHOULDER).z ?? 0 };

  const shWidthPx   = Math.abs(rSh.x - lSh.x);
  const shWidthFrac = shWidthPx / Math.max(W, 1);
  const rawRatio    = Math.max(0.70, Math.min(1.30, shWidthFrac / REF_SH_FRAC));

  // EMA smoothing on shRatio — α=0.05 = very slow drift (stable over seconds)
  if (_shRatioEMA === null) _shRatioEMA = rawRatio;
  else _shRatioEMA = _shRatioEMA + 0.05 * (rawRatio - _shRatioEMA);
  const shRatio = _shRatioEMA;

  // When a calibrated known distance is available, back-calculate the user's
  // actual shoulder width in cm (adults: ~32–52 cm, median ~42 cm).
  // This prevents systematic cmPerPx errors of up to ±19% for users whose
  // shoulders differ from the hardcoded 42 cm average.
  // Clamp to plausible anatomical range to guard against noisy calibrations.
  let effectiveShoulderWidthCm = SHOULDER_WIDTH_CM; // 42 cm default
  if (calibKnownDistCm && calibKnownDistCm > 20 && shWidthFrac > 0.05) {
    // Simple pinhole camera model: shoulderWidthCm = knownDist * shoulderWidthFrac / (focalLength/frameWidth)
    // Empirically: at 60 cm, REF_SH_FRAC (0.34) ≈ 42 cm shoulder → scale proportionally
    const derived = (calibKnownDistCm * shWidthFrac) / (REF_SH_FRAC * calibKnownDistCm / SHOULDER_WIDTH_CM);
    effectiveShoulderWidthCm = Math.max(28, Math.min(58, Math.round(derived * 10) / 10));
  }

  const cmPerPx = effectiveShoulderWidthCm / Math.max(shWidthPx, 1);

  return {
    lSh, rSh,
    midSh:      { x: (lSh.x + rSh.x) / 2, y: (lSh.y + rSh.y) / 2, z: (lSh.z + rSh.z) / 2 },
    // midShZ: normalised Z midpoint of shoulders — used by analyzeFHP 3D calculation
    midShZ:     (lSh.z + rSh.z) / 2,
    shWidthPx,
    shWidthFrac,
    shRatio,
    cmPerPx,
    effectiveShoulderWidthCm,
    shOK: vis(PL.L_SHOULDER) && vis(PL.R_SHOULDER),
  };
}

/** Call on session reset / camera restart to clear proportion memory */
export function resetProportions() {
  _shRatioEMA = null;
  // Clear expensive-metric cache so next frame recalculates fresh
  analyzeMP._frameN = 0;
  analyzeMP._cachedRounded = null;
  analyzeMP._cachedFhp     = null;
  analyzeMP._cachedElbow   = null;
  analyzeMP._cachedMonitor = null;
}

// ═══════════════════════════════════════════════════════════════════
// HEAD YAW ESTIMATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Estimate head yaw (left/right rotation) from front camera.
 * Uses nose offset relative to eye midpoint, cross-checked with
 * ear-to-nose distance ratio when ears are visible.
 *
 * @returns {number} degrees (+= turned right, -= turned left)
 */
function estimateHeadYaw(lms, W, H) {
  try {
    const g = i => lms[i];
    const vis = i => (g(i)?.visibility ?? 0) >= VIS_MIN;

    // Use a SYMMETRIC eye pair for the yaw baseline. The previous "wide
    // baseline" used L_EYE_INNER (1) with R_EYE_OUTER (6) — asymmetric
    // around the face centre, so the eye midpoint was systematically
    // shifted and every user carried a constant phantom yaw of ~5-10°.
    // Outer corners (3 & 6) give the widest symmetric span; fall back to
    // eye centres (2 & 5) when the corners aren't visible.
    const useEdge = vis(PL.L_EYE_OUTER) && vis(PL.R_EYE_OUTER);
    const lEye = useEdge
      ? { x: g(PL.L_EYE_OUTER).x * W, y: g(PL.L_EYE_OUTER).y * H }
      : { x: g(PL.L_EYE).x * W,       y: g(PL.L_EYE).y * H };
    const rEye = useEdge
      ? { x: g(PL.R_EYE_OUTER).x * W, y: g(PL.R_EYE_OUTER).y * H }
      : { x: g(PL.R_EYE).x * W,       y: g(PL.R_EYE).y * H };
    const nose = { x: g(PL.NOSE).x * W, y: g(PL.NOSE).y * H };

    const eyeWidth = Math.abs(rEye.x - lEye.x);
    if (eyeWidth < 2) return 0;

    const eyeMidX   = (lEye.x + rEye.x) / 2;
    const noseOffset = (nose.x - eyeMidX) / eyeWidth;
    const yaw        = Math.max(-45, Math.min(45, Math.round(noseOffset * 60)));

    if (vis(PL.L_EAR) && vis(PL.R_EAR)) {
      const lEarX = g(PL.L_EAR).x * W;
      const rEarX = g(PL.R_EAR).x * W;
      const lToNose = Math.abs(nose.x - lEarX);
      const rToNose = Math.abs(nose.x - rEarX);
      const ratio = lToNose / Math.max(rToNose, 1);
      if (ratio > 1.3) return -Math.min(45, Math.abs(yaw));
      if (ratio < 0.7) return  Math.min(45, Math.abs(yaw));
    }
    return yaw;
  } catch { return 0; }
}

// ═══════════════════════════════════════════════════════════════════
// DISTANCE ESTIMATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Estimate user-to-camera distance in cm using IPD (primary) or
 * shoulder width (fallback). Corrects for head yaw foreshortening.
 *
 * @param {number|null} calibFactor - user calibration constant (optional)
 */
function estimateDistanceCm(lms, W, H, yawDeg = 0, calibFactor = null) {
  try {
    const g   = i => lms[i];
    const vis = i => (g(i)?.visibility ?? 0) >= VIS_MIN;

    // IPD must be measured between eye CENTRES (2 & 5) — two reasons:
    //  1. IPD_CM (6.3) is the pupil-to-pupil distance; the old
    //     L_EYE_INNER→R_EYE_OUTER span is ~25% wider, so distances were
    //     systematically underestimated by ~25%.
    //  2. PostureCalibration.jsx computes distCalibFactor from eye centres —
    //     measuring here with different landmarks broke calibrated users too.
    const lEyeX = g(PL.L_EYE).x;
    const rEyeX = g(PL.R_EYE).x;
    if (vis(PL.L_EYE) && vis(PL.R_EYE)) {
      let ipdPx = Math.abs(rEyeX * W - lEyeX * W);
      const cosYaw = Math.max(Math.cos(Math.min(50, Math.abs(yawDeg)) * Math.PI / 180), 0.55);
      ipdPx /= cosYaw;

      if (ipdPx > 4) {
        if (calibFactor && calibFactor > 0) {
          const ipdFrac = ipdPx / Math.max(W, 1);
          return Math.max(20, Math.min(160, Math.round(calibFactor / ipdFrac)));
        }
        const focal = FOCAL_PX_1280 * (W / 1280);
        return Math.max(20, Math.min(160, Math.round((IPD_CM * focal) / ipdPx)));
      }
    }

    // Fallback: shoulder width
    const shPx = Math.abs(g(PL.R_SHOULDER).x * W - g(PL.L_SHOULDER).x * W);
    if (shPx > 5) {
      const focal = 600 * (W / 640);
      return Math.max(20, Math.min(160, Math.round((SHOULDER_WIDTH_CM * focal) / shPx)));
    }
    return 65; // default when nothing is visible
  } catch { return 65; }
}

// ═══════════════════════════════════════════════════════════════════
// DISTANCE SMOOTHER — sliding median (immune to single-frame IPD noise)
// ═══════════════════════════════════════════════════════════════════

/**
 * Keeps last N raw distance readings and returns the median.
 * Median is far more stable than mean for IPD-based distance:
 * a single bad frame (blink, partial occlusion) moves the mean
 * by several cm but barely shifts the median.
 */
export function createDistanceSmoother(size = 30) {
  const buf = [];
  return {
    push(cm) {
      if (!cm || cm < 20 || cm > 160) return this.get(); // reject implausible
      buf.push(cm);
      if (buf.length > size) buf.shift();
      return this.get();
    },
    get() {
      if (!buf.length) return 65;
      const s = [...buf].sort((a, b) => a - b);
      const mid = Math.floor(s.length / 2);
      return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
    },
    reset() { buf.length = 0; },
  };
}



/**
 * Score based on screen distance.
 * Tolerance is symmetric in documented steps:
 *   exact range [lo, hi]         → 100
 *   ±10cm slack                  → 80
 *   ±20cm slack                  → 55
 *   beyond                       → 30
 *
 * Synced with backend.py dist_sc logic.
 */
/**
 * Screen-distance score: continuous gradation instead of 3 fixed steps.
 *
 * Previous: returned only 100/80/55/30 — two users at 41cm and 49cm
 * from the same 50cm target got identical scores (55) despite a real
 * difference. Now uses linear decay within each tolerance band so
 * distance contributes proportionally to the overall score.
 *
 * Synced with backend.py dist_sc — update both together.
 */
function distanceScore(distCm, lo, hi) {
  if (distCm >= lo && distCm <= hi) return 100;
  const delta = distCm < lo ? lo - distCm : distCm - hi;
  if (delta <= 10)  return Math.round(100 - delta * 2);            // 100→80 over 10 cm
  if (delta <= 20)  return Math.round(80  - (delta - 10) * 2.5);  // 80→55 over 10 cm
  if (delta <= 35)  return Math.round(55  - (delta - 20) * 1.67); // 55→30 over 15 cm
  return 30;
}

// ═══════════════════════════════════════════════════════════════════
// QUALITY CHECK
// ═══════════════════════════════════════════════════════════════════

/**
 * Assess frame quality before running analysis.
 * Returns { ok, reason } — analysis should be skipped if !ok.
 */
function checkFrameQuality(lms, W, H) {
  if (!lms || lms.length < 25) return { ok: false, reason: "no_body" };

  const g   = i => lms[i];
  const vis = i => (g(i)?.visibility ?? 0) >= VIS_MIN;

  if (!vis(PL.L_SHOULDER) || !vis(PL.R_SHOULDER)) {
    return { ok: false, reason: "body_cropped" };
  }

  const lShX = g(PL.L_SHOULDER).x;
  const rShX = g(PL.R_SHOULDER).x;

  // Bug #9 fix: use pixel-space shoulder width rather than arbitrary normalised thresholds.
  // Frame-fraction thresholds (< 0.05 / > 0.95) were unreliable for wide-angle cameras.
  // Pixel-based checks are camera-independent.
  const lShPx = lShX * W;
  const rShPx = rShX * W;
  const shWidthPx = Math.abs(rShPx - lShPx);

  // Too close: either shoulder within 3% of frame edge
  if (lShPx < W * 0.03 || rShPx > W * 0.97) {
    return { ok: false, reason: "too_close" };
  }

  // Too far: shoulder width less than 50px regardless of frame size
  // (replaces < 0.10 span which penalised wide-shoulder users at normal distance)
  if (shWidthPx < 50) {
    return { ok: false, reason: "too_far" };
  }

  return { ok: true, reason: "ok" };
}

// ═══════════════════════════════════════════════════════════════════
// BODY MODULE ANALYZERS
// Each returns { angle, score, severity, confidence, reliable }
// ═══════════════════════════════════════════════════════════════════

function analyzeNeckLean(lms, W, H, prop, calib = null) {
  const g   = i => lms[i];
  const vis = i => (g(i)?.visibility ?? 0) >= VIS_MIN;

  const earOK  = vis(PL.L_EAR) && vis(PL.R_EAR);
  const shOK   = prop.shOK;
  const noseOK = (g(PL.NOSE)?.visibility ?? 0) >= VIS_MIN;
  const reliable = shOK && earOK;

  if (!reliable) return { angle: 0, score: 90, severity: "normal", confidence: 0, reliable: false };

  const lEar = { x: g(PL.L_EAR).x * W, y: g(PL.L_EAR).y * H };
  const rEar = { x: g(PL.R_EAR).x * W, y: g(PL.R_EAR).y * H };
  const nose = { x: g(PL.NOSE).x * W,  y: g(PL.NOSE).y * H };
  const midEar = { x: (lEar.x + rEar.x) / 2, y: (lEar.y + rEar.y) / 2 };

  // Bug #11 fix: when nose is NOT visible, its weight must be 0 (use ear only).
  // Old code gave nose weight=0.5 when invisible — blending an unreliable point
  // equally with a reliable one. When visible (>0.7), nose gets 15% weight to
  // reduce yaw-bias; otherwise ear midpoint is the sole reference.
  const noseVis    = g(PL.NOSE)?.visibility ?? 0;
  const noseWeight = noseOK && noseVis > 0.7 ? 0.15 : 0.0; // 0, not 0.5 when invisible
  const earWeight  = 1 - noseWeight;
  const neckRef = {
    x: nose.x * noseWeight + midEar.x * earWeight,
    y: nose.y * noseWeight + midEar.y * earWeight,
  };

  const rawAngle   = angleVert(prop.midSh, neckRef);
  // Correct for nose being ~5cm anterior to ear plane.
  // Correction scales with camera distance (further = less apparent offset).
  // Uses prop.cmPerPx (derived from shoulder width) to estimate distance.
  const approxDistCm = SHOULDER_WIDTH_CM / Math.max(prop.shWidthFrac, 0.01) * 0.5;
  const correctionDeg = approxDistCm > 0
    ? Math.atan2(NOSE_AHEAD_CM * noseWeight, Math.max(approxDistCm, 30)) * 180 / Math.PI
    : 0;
  const angle = Math.max(0, rawAngle - correctionDeg);

  // Normalize thresholds by distance (shoulder-width ratio)
  const okAdj  = Math.max(5.0,  6.0  * prop.shRatio);
  const badAdj = Math.max(12.0, 17.0 * prop.shRatio);

  // Personalised scoring: deviation from the user's own neutral neck angle
  // (from calibration) using their tolerance band; else distance-normalised
  // defaults. Severity is measured as deviation-from-neutral so a naturally
  // slight resting lean is not repeatedly flagged.
  const t = resolveThr(calib, "neck_angle", 0, okAdj, badAdj);
  const dev = Math.abs(angle - t.ideal);
  const score     = scoreMetric(angle, t.ideal, t.ok, t.bad);
  const severity  = classify(dev, SEV.NECK);
  const confidence = Math.round(70 + (vis(PL.L_EAR) ? 15 : 0) + (noseOK ? 10 : 0) + (shOK ? 5 : 0));

  return { angle: Math.round(angle), score, severity, confidence, reliable, okAdj:t.ok, badAdj:t.bad, personalised:t.personalised };
}

function analyzeHeadTilt(lms, W, H, calib = null) {
  const g   = i => lms[i];
  const vis = i => (g(i)?.visibility ?? 0) >= VIS_MIN;
  const reliable = vis(PL.L_EYE) && vis(PL.R_EYE);

  if (!reliable) return { angle: 0, score: 90, severity: "normal", confidence: 0, reliable: false };

  const lEye = { x: g(PL.L_EYE).x * W, y: g(PL.L_EYE).y * H };
  const rEye = { x: g(PL.R_EYE).x * W, y: g(PL.R_EYE).y * H };
  const angle    = angleHoriz(lEye, rEye);
  const t = resolveThr(calib, "head_tilt", 0, THR.HEAD_TILT.ok, THR.HEAD_TILT.bad);
  const dev = Math.abs(angle - t.ideal);
  const score    = scoreMetric(angle, t.ideal, t.ok, t.bad);
  const severity = classify(dev, { mild: 3, moderate: 7, severe: 10 });
  return { angle: Math.round(angle), score, severity, confidence: 85, reliable, personalised:t.personalised };
}

function analyzeShoulderLevel(lms, W, H, prop, calib = null) {
  if (!prop.shOK) return { angle: 0, score: 90, severity: "normal", confidence: 0, reliable: false };

  const angle    = angleHoriz(prop.lSh, prop.rSh);
  const t = resolveThr(calib, "shoulder_tilt", 0, THR.SH_TILT.ok, THR.SH_TILT.bad);
  const dev = Math.abs(angle - t.ideal);
  const score    = scoreMetric(angle, t.ideal, t.ok, t.bad);
  const severity = classify(dev, SEV.SHOULDER);
  // Signed: positive = right shoulder higher
  const signed   = (prop.rSh.y - prop.lSh.y) > 0 ? angle : -angle;

  return { angle: Math.round(angle), signedAngle: Math.round(signed * 10) / 10, score, severity, confidence: 90, reliable: true };
}

function analyzeSpineLean(lms, W, H, prop, roundedScore, calib = null) {
  const g   = i => lms[i];
  const vis = i => (g(i)?.visibility ?? 0) >= VIS_MIN;
  const hipOK = vis(PL.L_HIP) && vis(PL.R_HIP);

  if (!hipOK) {
    // Hips out of frame — return neutral rather than re-using rounded-shoulder
    // score (which measures a completely different body region).
    return { angle: 0, score: 90, severity: "normal",
             confidence: 0, reliable: false, usedFallback: true };
  }

  const lHip = { x: g(PL.L_HIP).x * W, y: g(PL.L_HIP).y * H };
  const rHip = { x: g(PL.R_HIP).x * W, y: g(PL.R_HIP).y * H };
  const midHip = { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2 };
  const angle   = angleVert(midHip, prop.midSh);
  const t = resolveThr(calib, "spine_angle", 0, THR.SPINE_LEAN.ok, THR.SPINE_LEAN.bad);
  const dev = Math.abs(angle - t.ideal);
  const score   = scoreMetric(angle, t.ideal, t.ok, t.bad);
  const severity = classify(dev, SEV.SPINE);
  return { angle: Math.round(angle), score, severity, confidence: 88, reliable: true, personalised:t.personalised };
}

function analyzeRoundedShoulders(lms, prop, H) {
  if (!prop.shOK) return { depth: 0, score: 90, severity: "normal", confidence: 0, reliable: false };

  const g = i => lms[i];
  const vis = i => (g(i)?.visibility ?? 0) >= VIS_MIN;

  // Z-based depth is very noisy (MediaPipe Z is approximate).
  // Instead use shoulder elevation relative to neck/ear midpoint:
  // rounded shoulders raise the shoulder tops and push the upper
  // trapezius upward — measurable in 2D Y without relying on Z.
  const earOK = vis(PL.L_EAR) && vis(PL.R_EAR);
  if (!earOK) {
    // Fallback: use Z but clamp aggressively to reduce jitter
    const lShZ = g(PL.L_SHOULDER)?.z ?? 0;
    const rShZ = g(PL.R_SHOULDER)?.z ?? 0;
    const avgZ = (lShZ + rShZ) / 2;
    // Only trust Z when both values agree (asymmetry < 0.04 = low noise frame)
    const asymZ = Math.abs(lShZ - rShZ);
    if (asymZ > 0.04) return { depth: 0, score: 85, severity: "normal", confidence: 30, reliable: false };
    const depth = Math.max(0, -avgZ * 100);
    const score = scoreMetric(depth, 0, THR.ROUNDED.ok, THR.ROUNDED.bad);
    return { depth: Math.round(depth * 10) / 10, asymmetry: Math.round(asymZ * 1000) / 1000, score, severity: classify(depth, SEV.ROUNDED), confidence: 45, reliable: false };
  }

  // Primary 2D method: compare shoulder-Y to ear-midpoint-Y.
  // Rounded shoulders → shoulders creep upward toward ears (Y decreases in image coords).
  //
  // Both distances are converted to PIXELS before taking the ratio.
  // The old version divided H-normalised Y by W-normalised width, which
  // made the ratio depend on the video aspect ratio, and its neutral
  // constant (2.8) was anatomically impossible — real upright values are
  // ~0.5 (ear-to-shoulder drop ≈ 22cm vs shoulder width ≈ 42cm), so the
  // deviation was permanently ~35+ and the metric sat pinned at score 5
  // with a constant "severe rounded shoulders" alert for everyone.
  const midEarYpx = ((g(PL.L_EAR).y + g(PL.R_EAR).y) / 2) * H;
  const midShYpx  = prop.midSh.y; // already in pixels
  const elevRatio = (midShYpx - midEarYpx) / Math.max(prop.shWidthPx, 1);

  // Upright anatomical ratio ≈ 0.52; shoulders creeping toward the ears
  // (rounding/shrugging) shrinks it. Scale ×45 maps typical rounding
  // (ratio 0.30–0.42) onto the existing 0–30 "depth" range and thresholds.
  const NEUTRAL_RATIO = 0.52;
  const deviation = Math.max(0, NEUTRAL_RATIO - elevRatio) * 45;

  const score    = scoreMetric(deviation, 0, THR.ROUNDED.ok, THR.ROUNDED.bad);
  const severity = classify(deviation, SEV.ROUNDED);
  return { depth: Math.round(deviation * 10) / 10, asymmetry: 0, score, severity, confidence: 80, reliable: true };
}

function analyzeFHP(lms, W, H, prop) {
  const g   = i => lms[i];
  const vis = i => (g(i)?.visibility ?? 0) >= VIS_MIN;
  const earOK = vis(PL.L_EAR) && vis(PL.R_EAR);
  if (!prop.shOK || !earOK) return { distCm: 0, extraLoadKg: 0, neckAngleDeg: 0, score: 90, severity: "normal", confidence: 0, reliable: false };

  const lEar  = g(PL.L_EAR);
  const rEar  = g(PL.R_EAR);
  const midEarX = ((lEar.x + rEar.x) / 2) * W;
  const midEarZ = (lEar.z + rEar.z) / 2;           // depth — normalised to same scale as X

  // Bug #7 fix: true 3D distance combining horizontal (X) and depth (Z) offsets.
  // Pure 2D (X only) was corrupted by yaw — a rotated-but-straight neck produced
  // apparent FHP. Z-component corrects for depth, giving true sagittal displacement.
  const deltaX  = midEarX - prop.midSh.x;           // pixels
  const deltaZ  = midEarZ - prop.midShZ;             // normalised units (same scale as Z from MediaPipe)
  // Convert Z to pixels using shoulder width as reference
  const deltaZpx = deltaZ * W;
  const dist2D  = Math.sqrt(deltaX * deltaX + deltaZpx * deltaZpx);
  const distCm  = Math.round(dist2D * prop.cmPerPx * 10) / 10;

  // Clinically correct extra neck load — Hansraj (2014) Surgical Technology International
  const HEAD_WEIGHT_KG   = 4.5;
  const CERVICAL_HEIGHT  = 15; // cm — approximate C1-to-head-centre distance
  const pitchRad         = Math.atan2(Math.max(0, distCm), CERVICAL_HEIGHT);
  const pitchDeg         = pitchRad * 180 / Math.PI;
  const extraLoadKg      = Math.round(Math.max(0, (HEAD_WEIGHT_KG / Math.max(Math.cos(pitchRad), 0.35)) - HEAD_WEIGHT_KG) * 10) / 10;

  const score    = scoreMetric(distCm, 0, THR.FHP_CM.ok, THR.FHP_CM.bad);
  const severity = classify(distCm, SEV.FHP);
  return { distCm, extraLoadKg, neckAngleDeg: Math.round(pitchDeg), score, severity, confidence: 88, reliable: true };
}

function analyzeHeadYawModule(lms, W, H) {
  const g   = i => lms[i];
  const vis = i => (g(i)?.visibility ?? 0) >= VIS_MIN;
  const reliable = vis(PL.L_EYE) && vis(PL.R_EYE);

  if (!reliable) return { angle: 0, score: 90, severity: "normal", confidence: 0, reliable: false };

  const yaw      = estimateHeadYaw(lms, W, H);
  const absYaw   = Math.abs(yaw);
  const score    = scoreMetric(absYaw, 0, THR.HEAD_YAW.ok, THR.HEAD_YAW.bad);
  const severity = classify(absYaw, SEV.YAW);
  return { angle: Math.round(yaw), absAngle: Math.round(absYaw), score, severity, confidence: 75, reliable };
}

function analyzeElbow(lms, W, H) {
  const g   = i => lms[i];
  const vis = i => (g(i)?.visibility ?? 0) >= VIS_MIN;

  const lOK = vis(PL.L_SHOULDER) && vis(PL.L_ELBOW) && vis(PL.L_WRIST);
  const rOK = vis(PL.R_SHOULDER) && vis(PL.R_ELBOW) && vis(PL.R_WRIST);
  if (!lOK && !rOK) return { angle: null, score: 90, severity: "normal", confidence: 0, reliable: false };

  const px = i => ({ x: g(i).x * W, y: g(i).y * H });
  const calcAngle = (sh, el, wr) => angle3pt(px(sh), px(el), px(wr));
  const lAng = lOK ? calcAngle(PL.L_SHOULDER, PL.L_ELBOW, PL.L_WRIST) : null;
  const rAng = rOK ? calcAngle(PL.R_SHOULDER, PL.R_ELBOW, PL.R_WRIST) : null;
  const avg  = lAng != null && rAng != null ? Math.round((lAng + rAng) / 2) : (lAng ?? rAng);

  // OSHA/NIOSH: acceptable elbow range 90-120°, ideal 100-110°
  // Use midpoint 105° as ideal, tolerance ±15° before penalty
  const elbowIdeal = 105;
  const elbowDev   = avg != null ? Math.max(0, Math.abs(avg - elbowIdeal) - 15) : 0;
  const score    = scoreMetric(elbowDev, 0, THR.ELBOW.ok, THR.ELBOW.bad);
  const severity = classify(elbowDev, { mild: 10, moderate: 20, severe: 30 });
  return { angle: avg, idealMin: 90, idealMax: 120, score, severity, confidence: 80, reliable: true };
}

function analyzeMonitorHeight(lms, W, H, distCm) {
  const g   = i => lms[i];
  const vis = i => (g(i)?.visibility ?? 0) >= VIS_MIN;
  if (!vis(PL.L_EYE) || !vis(PL.R_EYE)) return { offsetCm: 0, direction: "ok", score: 90, confidence: 0, reliable: false };

  const lEye = { x: g(PL.L_EYE).x * W, y: g(PL.L_EYE).y * H };
  const rEye = { x: g(PL.R_EYE).x * W, y: g(PL.R_EYE).y * H };
  const nose = { x: g(PL.NOSE).x * W,  y: g(PL.NOSE).y * H };

  const eyeMidY  = (lEye.y + rEye.y) / 2;
  const eyeWidth = Math.abs(rEye.x - lEye.x);
  if (eyeWidth < 2) return { offsetCm: 0, direction: "ok", score: 90, confidence: 0, reliable: false };

  const noseDropFrac = (nose.y - eyeMidY) / eyeWidth;
  const pitchProxy   = (noseDropFrac - NEUTRAL_NOSE_DROP_FRAC) * 90;
  const pitchDeg     = Math.round(pitchProxy * 10) / 10;

  let offsetCm = 0, direction = "ok";
  if (Math.abs(pitchDeg) > 2 && distCm > 20) {
    offsetCm  = Math.round(distCm * Math.tan(Math.abs(pitchDeg) * Math.PI / 180) * 10) / 10;
    direction = pitchDeg > 0 ? "below" : "above";
  }

  const score = scoreMetric(Math.abs(pitchDeg), 0, THR.MONITOR_PITCH.ok, THR.MONITOR_PITCH.bad);
  return { offsetCm, direction, pitchDeg, score, confidence: 72, reliable: true };
}

// ═══════════════════════════════════════════════════════════════════
// ALERT BUILDER with deduplication
// ═══════════════════════════════════════════════════════════════════

function buildAlerts(modules, distCm, lo, hi) {
  const seen    = new Set();
  const add = (key, condition, text) => {
    if (!condition || !text || seen.has(key)) return null;
    seen.add(key);
    return text;
  };

  const { neck, headTilt, shoulder, spine, fhp, rounded, yaw, elbow, monitor, distance } = modules;

  return [
    add("neck_sev",  neck.angle > neck.badAdj,                    `⚠️ Severe neck lean ${neck.angle}° — raise monitor to eye level immediately`),
    add("neck_mid",  neck.angle > (neck.okAdj + neck.badAdj) / 2 && neck.angle <= neck.badAdj, `Neck lean ${neck.angle}° — tuck chin slightly`),
    add("fhp_sev",   fhp.reliable && fhp.distCm > 6,             `⚠️ Forward head ${fhp.distCm}cm (~${fhp.neckAngleDeg}° pitch, +${fhp.extraLoadKg}kg neck load) — raise monitor`),
    add("fhp_mid",   fhp.reliable && fhp.distCm > 3 && fhp.distCm <= 6, `Forward head ${fhp.distCm}cm (+${fhp.extraLoadKg}kg) — tuck chin back`),
    add("tilt",      headTilt.reliable && headTilt.angle > 10,    `Head tilting ${headTilt.angle}° — check chair height`),
    add("sh",        shoulder.reliable && shoulder.angle > 10,    `Shoulder imbalance ${shoulder.angle}° — adjust armrests`),
    add("spine_sev", spine.reliable && spine.angle > 18,          `⚠️ Spine lean ${spine.angle}° — sit back with lumbar support`),
    add("spine_mid", spine.reliable && spine.angle > 10 && spine.angle <= 18, `Spine lean ${spine.angle}° — engage core, sit upright`),
    add("yaw",       yaw.reliable && yaw.absAngle > 18,           `Head turned ${yaw.absAngle}° ${yaw.angle > 0 ? "right" : "left"} — face monitor`),
    add("dist_cl",   distCm < lo - 10,                            `⚠️ Very close (${distCm}cm) — move back to ${lo}–${hi}cm`),
    add("dist_c",    distCm < lo && distCm >= lo - 10,            `Too close (${distCm}cm) — ideal ${lo}–${hi}cm`),
    add("dist_f",    distCm > hi + 15,                            `Too far (${distCm}cm) — ideal ${lo}–${hi}cm`),
    add("round_sev", rounded.reliable && rounded.depth > 15,      `⚠️ Rounded shoulders — pull shoulder blades together`),
    add("round_mid", rounded.reliable && rounded.depth > 8 && rounded.depth <= 15, `Shoulders slightly forward — open chest`),
    add("elbow_hi",  elbow.reliable && elbow.angle != null && elbow.angle < 70, `⚠️ Elbows too high (${elbow.angle}°) — lower keyboard`),
    add("elbow_lo",  elbow.reliable && elbow.angle != null && elbow.angle > 125, `Elbows too low (${elbow.angle}°) — raise keyboard`),
    add("mon_low",   monitor.reliable && monitor.direction === "below" && monitor.offsetCm > 5, `Monitor ~${monitor.offsetCm}cm below eye level — raise it`),
    add("mon_hi",    monitor.reliable && monitor.direction === "above" && monitor.offsetCm > 5, `Monitor ~${monitor.offsetCm}cm above eye level — lower it`),
  ].filter(Boolean);
}

// ═══════════════════════════════════════════════════════════════════
// MAIN FRONT-CAMERA ANALYSIS
// ═══════════════════════════════════════════════════════════════════

export function analyzeMP(lms, W, H, mode, distCalibFactor = null, sessionStartMs = null, calibKnownDistCm = null, calib = null) {
  if (!lms || lms.length < 25) return null;

  // Quality gate
  const quality = checkFrameQuality(lms, W, H);
  if (!quality.ok) {
    return { score: null, qualityScore: 0, qualityReason: quality.reason, detected: false };
  }

  // Body proportions — if a real known calibration distance is available,
  // back-calculate the user's actual shoulder width in cm rather than using
  // the hardcoded 42 cm constant. This corrects all downstream cm-per-px
  // conversions for users whose shoulders differ from the 42 cm average
  // (adult range: ~32 cm narrow → ~52 cm broad).
  const prop = computeProportions(lms, W, H, calibKnownDistCm);

  // #17: frame-skip for expensive metrics — FHP, rounded shoulders, elbow,
  // and monitor angle are geometrically complex and stable over ~100ms.
  // Run them every 3rd frame only; reuse cached values in between.
  // Quick metrics (neck lean, head tilt, shoulder level, spine, yaw)
  // stay per-frame since they need fast feedback for real-time alerts.
  analyzeMP._frameN = ((analyzeMP._frameN || 0) + 1) % 3;
  const skipExpensive = analyzeMP._frameN !== 0;

  // Head yaw & distance
  const headYaw = estimateHeadYaw(lms, W, H);
  // Read ideal distance range from MODES (single source of truth) instead
  // of duplicating it with a hardcoded if/else that silently drifts if
  // MODES is ever edited elsewhere.
  const [lo, hi] = MODES[mode]?.distRange || MODES.laptop.distRange;
  const distCm  = estimateDistanceCm(lms, W, H, headYaw, distCalibFactor);
  const distSc  = distanceScore(distCm, lo, hi);

  // Body module analysis — quick metrics run every frame, expensive every 3rd.
  // `calib` personalises neck/tilt/shoulder/spine scoring to the user's own
  // neutral posture measured during calibration.
  const neck     = analyzeNeckLean(lms, W, H, prop, calib);
  const headTilt = analyzeHeadTilt(lms, W, H, calib);
  const shoulder = analyzeShoulderLevel(lms, W, H, prop, calib);
  const yaw      = analyzeHeadYawModule(lms, W, H);

  // Expensive metrics — cached between frames.
  // IMPORTANT: rounded must be computed BEFORE spine because analyzeSpineLean
  // uses rounded.score as input. On non-skip frames, compute rounded fresh and
  // pass it directly to spine. On skip frames, use the cached value.
  let rounded, fhp, elbow, monitor;
  if (!skipExpensive || !analyzeMP._cachedRounded) {
    rounded = analyzeRoundedShoulders(lms, prop, H);
    fhp     = analyzeFHP(lms, W, H, prop);
    elbow   = analyzeElbow(lms, W, H);
    monitor = analyzeMonitorHeight(lms, W, H, distCm);
    analyzeMP._cachedRounded = rounded;
    analyzeMP._cachedFhp     = fhp;
    analyzeMP._cachedElbow   = elbow;
    analyzeMP._cachedMonitor = monitor;
  } else {
    rounded = analyzeMP._cachedRounded;
    fhp     = analyzeMP._cachedFhp;
    elbow   = analyzeMP._cachedElbow;
    monitor = analyzeMP._cachedMonitor;
  }
  // Spine runs every frame (fast) but depends on rounded.score from above
  const spine = analyzeSpineLean(lms, W, H, prop, rounded.score, calib);

  // Confidence-weighted overall score.
  // Previous: unreliable modules contributed at a fixed 30% weight, meaning
  // a default score of 90 from an invisible landmark was still inflating the
  // overall score by 90 × 0.084 = 7.6 points — more than a genuinely bad
  // measurement. Now: unreliable modules contribute 0 weight (excluded from
  // sum entirely) and their missing weight is re-distributed via W_ACTUAL
  // normalisation, so they neither inflate nor deflate the result.
  const confWeight = (mod, w) => mod.reliable === false ? 0 : w * Math.min(1, (mod.confidence ?? 100) / 100);

  const W_neck     = confWeight(neck,     WEIGHTS_FRONT.neck);
  const W_tilt     = confWeight(headTilt, WEIGHTS_FRONT.tilt);
  const W_shoulder = confWeight(shoulder, WEIGHTS_FRONT.shoulder);
  const W_spine    = confWeight(spine,    WEIGHTS_FRONT.spine);
  const W_yaw      = confWeight(yaw,      WEIGHTS_FRONT.yaw);
  const W_rounded  = confWeight(rounded,  WEIGHTS_FRONT.rounded);
  const W_dist     = WEIGHTS_FRONT.distance; // distance is always measured

  const W_ACTUAL = W_neck + W_tilt + W_shoulder + W_spine + W_dist + W_yaw + W_rounded;
  const baseline = 72 * Math.max(0, 1 - W_ACTUAL);

  const overall = Math.max(0, Math.min(100, Math.round(
    neck.score     * W_neck     +
    headTilt.score * W_tilt     +
    shoulder.score * W_shoulder +
    spine.score    * W_spine    +
    distSc         * W_dist     +
    yaw.score      * W_yaw      +
    rounded.score  * W_rounded  +
    baseline
  )));

  // Detection confidence
  const g   = i => lms[i];
  const vis = i => (g(i)?.visibility ?? 0) >= VIS_MIN;
  const detectionConfidence = Math.min(94,
    78 +
    (vis(PL.L_SHOULDER) && vis(PL.R_SHOULDER) ? 10 : 0) +
    (vis(PL.L_EAR) ? 3 : 0) +
    (vis(PL.R_EAR) ? 3 : 0)
  );

  // ── Fatigue penalty — evidence-based non-linear model ─────────────
  // Richter et al. (2011): muscle fatigue onset at ~20-30 min sustained
  // sedentary work, with non-linear accumulation thereafter.
  // Penalty is informational only — does NOT reduce overall score.
  const sessionMin = sessionStartMs
    ? Math.max(0, Math.round((Date.now() - sessionStartMs) / 60000))
    : 0; // Bug #8 fix: if no session start provided, assume 0 min — using performance.now()
         // caused inflated fatigue penalty when the tab was left open before starting a session.
  // Non-linear fatigue: 0-20min=none, 20-60min=mild (0-8pts), 60-120min=moderate (8-15pts), 120min+=severe
  let fatiguePenalty = 0;
  if (sessionMin > 120) fatiguePenalty = Math.min(20, 15 + Math.round((sessionMin - 120) / 15));
  else if (sessionMin > 60) fatiguePenalty = Math.round(8 + ((sessionMin - 60) / 60) * 7);
  else if (sessionMin > 20) fatiguePenalty = Math.round(((sessionMin - 20) / 40) * 8);

  // Alerts
  const alerts = buildAlerts({ neck, headTilt, shoulder, spine, fhp, rounded, yaw, elbow, monitor }, distCm, lo, hi);

  return {
    score:       overall,
    qualityScore: 100,
    confidence:  detectionConfidence,

    bodyModules: {
      neck:     { ...neck,     label: "Neck Lean" },
      headTilt: { ...headTilt, label: "Head Tilt" },
      shoulder: { ...shoulder, label: "Shoulder Level" },
      spine:    { ...spine,    label: "Spine Lean" },
      fhp:      { ...fhp,      label: "Forward Head Posture" },
      rounded:  { ...rounded,  label: "Rounded Shoulders" },
      yaw:      { ...yaw,      label: "Head Rotation" },
      elbow:    { ...elbow,    label: "Elbow Angle" },
      monitor:  { ...monitor,  label: "Monitor Height" },
    },

    detectedConditions: [
      neck.severity     !== "normal" && { name: "Neck Lean",          severity: neck.severity,     value: `${neck.angle}°` },
      fhp.reliable      !== false   && fhp.severity !== "normal"    && { name: "Forward Head",       severity: fhp.severity,      value: `${fhp.distCm}cm` },
      headTilt.severity !== "normal" && { name: "Head Tilt",          severity: headTilt.severity, value: `${headTilt.angle}°` },
      shoulder.severity !== "normal" && { name: "Shoulder Imbalance", severity: shoulder.severity, value: `${shoulder.angle}°` },
      rounded.severity  !== "normal" && { name: "Rounded Shoulders",  severity: rounded.severity,  value: rounded.depth },
      spine.severity    !== "normal" && spine.reliable && { name: "Spine Lean", severity: spine.severity, value: `${spine.angle}°` },
    ].filter(Boolean),

    // Legacy metrics shape (backward-compatible with App.jsx/overlays)
    metrics: {
      neck_lean:         { value: neck.angle,       score: neck.score,     unit: "°",  label: "Neck lean",           reliable: neck.reliable },
      head_tilt:         { value: headTilt.angle,   score: headTilt.score, unit: "°",  label: "Head tilt",           reliable: headTilt.reliable },
      shoulder_level:    { value: shoulder.angle,   score: shoulder.score, unit: "°",  label: "Shoulder level",      reliable: shoulder.reliable, signed: shoulder.signedAngle },
      spine_lean:        { value: spine.angle,      score: spine.score,    unit: "°",  label: "Spine lean",          reliable: spine.reliable },
      head_yaw:          { value: yaw.angle,        score: yaw.score,      unit: "°",  label: "Head turn",           reliable: yaw.reliable },
      screen_distance:   { value: distCm,           score: distSc,         unit: "cm", label: "Screen distance",     calibrated: !!(distCalibFactor && distCalibFactor > 0) },
      fhp_index:         { value: fhp.distCm,       score: fhp.score,      unit: "cm", label: "Forward head posture",extra_load_kg: fhp.extraLoadKg, reliable: fhp.reliable },
      rounded_shoulders: { value: rounded.depth,    score: rounded.score,  unit: "depth", label: "Rounded shoulders",asymmetry: rounded.asymmetry, reliable: rounded.reliable },
      elbow_angle:       { value: elbow.angle,      score: elbow.score,    unit: "°",  label: "Elbow angle",         reliable: elbow.reliable },
      monitor_height:    { value: monitor.offsetCm, score: monitor.score,  unit: "cm", label: "Monitor height offset",direction: monitor.direction, reliable: monitor.reliable },
      session_fatigue:   { value: fatiguePenalty,   score: Math.max(0, overall - fatiguePenalty), unit: "pts", label: "Fatigue adjustment", session_min: sessionMin },
      confidence_val:    { value: detectionConfidence, score: detectionConfidence, unit: "%", label: "Detection confidence" },
    },

    alerts,
    recommendations: [
      `Overall: ${gradeScore(overall)} (${overall}/100)`,
      `Screen distance: ${distCm >= lo && distCm <= hi ? "✓ Optimal" : `Move to ${lo}–${hi}cm`} (${distCm}cm)`,
      "Keep ears directly above shoulders, chin parallel to floor",
      "Lumbar support: lower back fully touching chair back",
      "Every 20 min: look 6m away for 20 seconds (20-20-20 rule)",
    ],

    distCm, lo, hi,
    headYaw,
    detected: true,
    fatigue_adjusted_score: Math.max(0, overall - fatiguePenalty),
    calibrationStatus: quality.reason,
    // True when the postural angles were scored against the user's own
    // calibrated neutral rather than population defaults.
    personalised: !!(calib?.tolerances) && (neck.personalised || shoulder.personalised || headTilt.personalised || spine.personalised),
  };
}

// ═══════════════════════════════════════════════════════════════════
// SIDE CAMERA ANALYSIS
// ═══════════════════════════════════════════════════════════════════

export function analyzeSideMP(lms, W, H, calibKnownDistCm = null) {
  if (!lms || lms.length < 28) return null;

  const g   = i => lms[i];
  const vis = (i, thr = VIS_MIN) => (g(i)?.visibility ?? 0) >= thr;

  // Pick the better-visible side
  const lVis = g(PL.L_SHOULDER)?.visibility ?? 0;
  const rVis = g(PL.R_SHOULDER)?.visibility ?? 0;
  const S    = lVis >= rVis ? "L" : "R";
  const I    = {
    EAR:   S === "L" ? PL.L_EAR    : PL.R_EAR,
    SH:    S === "L" ? PL.L_SHOULDER : PL.R_SHOULDER,
    HIP:   S === "L" ? PL.L_HIP    : PL.R_HIP,
    KNEE:  S === "L" ? PL.L_KNEE   : PL.R_KNEE,
    ANKLE: S === "L" ? PL.L_ANKLE  : PL.R_ANKLE,
  };

  const px  = i => ({ x: g(i).x * W, y: g(i).y * H });
  const ear   = px(I.EAR);
  const sh    = px(I.SH);
  const hip   = px(I.HIP);
  const knee  = px(I.KNEE);
  const ankle = px(I.ANKLE);

  const earOK   = vis(I.EAR);
  const shOK    = vis(I.SH);
  const hipOK   = vis(I.HIP);
  const kneeOK  = vis(I.KNEE);
  const ankleOK = vis(I.ANKLE);

  const NEUTRAL = 90;

  // Shoulder width in px — the cm ruler for side-view conversions (mirrors
  // backend.py analyze_side). MUST be computed before any use below: it was
  // previously declared with `const` AFTER its first use, which threw a TDZ
  // ReferenceError on every frame and silently killed side-mode analysis
  // (the RAF loop catches and swallows engine errors).
  const shWidthPx = shOK ? Math.abs(g(PL.L_SHOULDER).x * W - g(PL.R_SHOULDER).x * W) : 0;

  // Apply calibration-based shoulder width correction (same logic as front mode).
  // Without this, all cm-based side calculations used the hardcoded 42cm average.
  let effectiveShoulderWidthCm = SHOULDER_WIDTH_CM;
  if (calibKnownDistCm && calibKnownDistCm > 20 && shWidthPx > 0) {
    const shWidthFracSide = shWidthPx / W;
    if (shWidthFracSide > 0.01) {
      const derived = (calibKnownDistCm * shWidthFracSide) / (REF_SH_FRAC * calibKnownDistCm / SHOULDER_WIDTH_CM);
      effectiveShoulderWidthCm = Math.max(28, Math.min(58, Math.round(derived * 10) / 10));
    }
  }

  // ── Neck lean (side) — pure ear-over-shoulder angle ──
  // Matches backend.py analyze_side(), which treats the profile view as
  // geometrically exact (angle_vert(sh, ear), no nose blend). The old
  // nose-dominant blend (nose 85% when visible, 50% when NOT visible) added
  // a systematic forward bias — the nose sits several cm anterior of the
  // ear in profile, so blending it always inflated the lean reading.
  const neckLean = earOK && shOK ? angleVert(sh, ear) : 0;
  const neckOK   = earOK && shOK;

  // Normalize neck thresholds by ear-shoulder span (camera-distance proxy).
  // Full euclidean ear→shoulder distance — the old |ear.x - sh.x| was the
  // horizontal FHP offset (≈0 px for an upright sitter), not a distance
  // proxy, so the ratio always sat clamped at 0.70.
  const earShSpanPx = Math.hypot(ear.x - sh.x, ear.y - sh.y);
  const spanFrac  = earShSpanPx / Math.max(W, 1);
  const spanRatio = Math.max(0.70, Math.min(1.30, spanFrac / 0.14));
  const neckOkAdj  = Math.max(5.0,  8.0  * spanRatio);  // backend: neck_ok = max(5.0, 8.0*ratio)
  const neckBadAdj = Math.max(16.0, 22.0 * spanRatio);  // backend: neck_bad = max(16.0, 22.0*ratio)

  const trunkLean = shOK && hipOK  ? angleVert(hip, sh)          : 0;
  const hipAngle  = hipOK && kneeOK ? angle3pt(sh, hip, knee)     : 90;
  const kneeAngle = kneeOK && ankleOK ? angle3pt(hip, knee, ankle) : 90;
  // ── Spine alignment (side view) ────────────────────────────────────
  // Proper measure: deviation of shoulder from ear-to-hip line.
  // A straight spine has shoulder on the ear→hip vector.
  // Using horizontal offset of ear vs ankle was measuring lean, not curvature.
  let spineAlign = 0;
  if (shOK && hipOK && earOK) {
    // Angle at shoulder between ear-shoulder and shoulder-hip vectors
    spineAlign = angle3pt(ear, sh, hip);
    // Ideal = 180° (straight line); deviation = |180 - angle|
    spineAlign = Math.abs(180 - spineAlign);
  }

  // ── Forward head posture (side view) — horizontal ear-to-shoulder offset in cm ──
  // cm ruler: in a true profile view the L-R shoulder width is foreshortened
  // to near-zero px, so using it as a 42cm ruler (backend.py's approach)
  // explodes the conversion — an upright sitter measured 20+cm of "FHP".
  // Instead use spans that stay fully visible in profile: shoulder→hip
  // (~46cm seated torso) when hips are visible, else ear→shoulder (~25cm).
  // Intentional divergence from backend.py until it gets the same fix.
  const TORSO_CM = 46, EAR_SH_CM = 25;
  const torsoPx = shOK && hipOK ? Math.hypot(sh.x - hip.x, sh.y - hip.y) : 0;
  const cmPerPxSide =
    torsoPx     > 20 ? TORSO_CM  / torsoPx     :
    earShSpanPx > 10 ? EAR_SH_CM / earShSpanPx :
    effectiveShoulderWidthCm / Math.max(shWidthPx, 1);
  const fhpSideCm   = earOK && shOK ? Math.round(Math.abs(ear.x - sh.x) * cmPerPxSide * 10) / 10 : 0;
  const fhpSideSc   = earOK && shOK ? scoreMetric(fhpSideCm, 0, 2.5, 7) : NEUTRAL;

  const neckSc  = neckOK  ? scoreMetric(neckLean,               0, neckOkAdj, neckBadAdj) : NEUTRAL;
  const trunkSc = shOK && hipOK  ? scoreMetric(trunkLean,       0, THR.TRUNK_LEAN.ok, THR.TRUNK_LEAN.bad) : NEUTRAL;
  const hipSc   = hipOK && kneeOK ? scoreMetric(Math.abs(hipAngle-90),  0, THR.HIP_ANGLE.ok,  THR.HIP_ANGLE.bad)  : NEUTRAL;
  const kneeSc  = kneeOK && ankleOK ? scoreMetric(Math.abs(kneeAngle-90),0, THR.KNEE_ANGLE.ok, THR.KNEE_ANGLE.bad) : NEUTRAL;
  const spineSc = shOK && hipOK && earOK ? scoreMetric(spineAlign, 0, THR.SPINE_ALIGN.ok, THR.SPINE_ALIGN.bad) : NEUTRAL;

  // Confidence-weighted overall (same principle as front camera):
  // unreliable modules contribute 0 weight — their NEUTRAL placeholder score
  // (90) must not inflate the result. The missing weight is redistributed
  // through sideBase below, exactly like the front-camera W_ACTUAL fix.
  const cw = (ok, w) => ok ? w : 0;
  const wN = cw(neckOK,           WEIGHTS_SIDE.neck);
  const wT = cw(shOK && hipOK,    WEIGHTS_SIDE.trunk);
  const wH = cw(hipOK && kneeOK,  WEIGHTS_SIDE.hip);
  const wK = cw(kneeOK && ankleOK,WEIGHTS_SIDE.knee);
  const wS = cw(shOK && hipOK && earOK, WEIGHTS_SIDE.spine);
  const wSum = wN + wT + wH + wK + wS;
  const sideBase = 72 * Math.max(0, 1 - wSum);

  const overall = Math.max(0, Math.min(100, Math.round(
    neckSc  * wN +
    trunkSc * wT +
    hipSc   * wH +
    kneeSc  * wK +
    spineSc * wS +
    sideBase
  )));

  const alerts = [
    neckOK && neckLean > neckBadAdj               && `⚠️ Forward head ${Math.round(neckLean)}° — ear must be above shoulder`,
    neckOK && neckLean > (neckOkAdj+neckBadAdj)/2 && neckLean <= neckBadAdj && `Neck lean ${Math.round(neckLean)}° — tuck chin back`,
    earOK && shOK && fhpSideCm > 5                && `⚠️ Forward head posture ${fhpSideCm}cm (side view) — tuck chin, pull head back over shoulders`,
    shOK && hipOK && trunkLean > 12               && `Trunk leaning ${Math.round(trunkLean)}° — sit back with lumbar support`,
    hipOK && kneeOK && Math.abs(hipAngle-90) > 15  && `Hip angle ${Math.round(hipAngle)}° (ideal ~90°) — adjust seat height`,
    kneeOK && ankleOK && Math.abs(kneeAngle-90) > 18 && `Knee angle ${Math.round(kneeAngle)}° (ideal ~90°) — adjust footrest`,
    shOK && hipOK && earOK && spineAlign > 12       && `Spine curvature ${Math.round(spineAlign)}° — maintain neutral spine, lumbar support`,
  ].filter(Boolean);

  return {
    score:    overall,
    confidence: Math.min(93, 70 + (shOK?10:0) + (earOK?8:0) + (hipOK?5:0)),
    metrics: {
      neck_lean_side: { value: Math.round(neckLean),  score: neckSc,  unit: "°",  label: "Neck lean (side)",  reliable: neckOK },
      fhp_side:       { value: fhpSideCm,             score: fhpSideSc, unit: "cm", label: "Forward head posture", reliable: earOK && shOK },
      trunk_lean:     { value: Math.round(trunkLean), score: trunkSc, unit: "°",  label: "Trunk lean",        reliable: shOK && hipOK },
      hip_angle:      { value: Math.round(hipAngle),  score: hipSc,   unit: "°",  label: "Hip angle",         reliable: hipOK && kneeOK },
      knee_angle:     { value: Math.round(kneeAngle), score: kneeSc,  unit: "°",  label: "Knee angle",        reliable: kneeOK && ankleOK },
      spine_align:    { value: Math.round(spineAlign),score: spineSc, unit: "°",  label: "Spine alignment",   reliable: shOK && hipOK && earOK },
    },
    bodyModules: { neck: { angle: Math.round(neckLean), score: neckSc, severity: classify(neckLean, SEV.NECK) },
                   trunk: { angle: Math.round(trunkLean), score: trunkSc }, hip: { angle: Math.round(hipAngle), score: hipSc },
                   knee: { angle: Math.round(kneeAngle), score: kneeSc } },
    alerts,
    recommendations: [
      `Overall: ${gradeScore(overall)} (${overall}/100) — ${S==="L"?"left":"right"} side`,
      "Ear directly above shoulder, shoulder above hip",
      `Hip angle ${Math.round(hipAngle)}° — ${Math.abs(hipAngle-90)<12?"✓ ideal":"adjust chair height"}`,
      "Feet flat, lumbar support fully engaged",
    ],
    detected: true,
  };
}

// ═══════════════════════════════════════════════════════════════════
// MODE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════

export const MODES = {
  laptop: { label: "Laptop Camera", labelAr: "كاميرا اللابتوب", icon: "💻", distRange: [50, 80] },
  phone:  { label: "Phone Camera",  labelAr: "كاميرا الموبايل",  icon: "📱", distRange: [60, 90] },
  side:   { label: "Side Camera",   labelAr: "كاميرا جانبية",    icon: "🎥", distRange: [80, 120] },
};

// ═══════════════════════════════════════════════════════════════════
// AUDIO ALERTS
// ═══════════════════════════════════════════════════════════════════

let _lastBeepMs = 0;

export function playBeep(severity = "mild") {
  const now = Date.now();
  if (now - _lastBeepMs < BEEP_COOLDOWN_MS) return;
  _lastBeepMs = now;
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    // severity="severe"  → 3 fast urgent pulses, high freq, louder
    // severity="moderate"→ 2 medium pulses
    // severity="mild"    → 1 soft gentle tone
    const patterns = {
      severe:   [[520,0,0.06,0.22],[440,0.18,0.06,0.22],[380,0.36,0.06,0.22]],
      moderate: [[460,0,0.07,0.24],[370,0.28,0.07,0.24]],
      mild:     [[400,0,0.08,0.32]],
    };
    const vol = severity==="severe"?0.22:severity==="moderate"?0.16:0.10;
    const tones = patterns[severity] || patterns.mild;
    tones.forEach(([freq,delay,attack,stop])=>{
      const osc=ac.createOscillator(),gain=ac.createGain();
      osc.connect(gain);gain.connect(ac.destination);
      osc.frequency.value=freq;osc.type="sine";
      gain.gain.setValueAtTime(0,ac.currentTime+delay);
      gain.gain.linearRampToValueAtTime(vol,ac.currentTime+delay+attack);
      gain.gain.linearRampToValueAtTime(0,ac.currentTime+delay+stop);
      osc.start(ac.currentTime+delay);
      osc.stop(ac.currentTime+delay+stop+0.05);
    });
  } catch {}
}

export function sendDesktopNotif(msg, score) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const icon = score < 50 ? "🔴" : score < 65 ? "🟡" : "🟢";
  new Notification("Corvus", { body: `${icon} ${msg}`, icon: "/icon-192.png", tag: "corvus-alert" });
}

export function requestNotificationPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") Notification.requestPermission().catch(() => {});
}

// createFrameBuffer is already exported above as: export function createFrameBuffer
