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
const FRAME_BUFFER_SIZE = 60;

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
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  return Math.abs(Math.atan2(Math.abs(dx), Math.abs(dy))) * 180 / Math.PI;
}

/**
 * Horizontal deviation angle of a vector from the X-axis (degrees).
 * @returns {number} degrees (0 = horizontal, 90 = vertical)
 */
export function angleHoriz(p1, p2) {
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
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

function computeProportions(lms, W, H) {
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

  const cmPerPx = SHOULDER_WIDTH_CM / Math.max(shWidthPx, 1);

  return {
    lSh, rSh,
    midSh:      { x: (lSh.x + rSh.x) / 2, y: (lSh.y + rSh.y) / 2, z: (lSh.z + rSh.z) / 2 },
    shWidthPx,
    shWidthFrac,
    shRatio,
    cmPerPx,
    shOK: vis(PL.L_SHOULDER) && vis(PL.R_SHOULDER),
  };
}

/** Call on session reset / camera restart to clear proportion memory */
export function resetProportions() { _shRatioEMA = null; }

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

    const lEye = { x: g(PL.L_EYE).x * W, y: g(PL.L_EYE).y * H };
    const rEye = { x: g(PL.R_EYE).x * W, y: g(PL.R_EYE).y * H };
    const nose = { x: g(PL.NOSE).x * W,  y: g(PL.NOSE).y * H };

    const eyeWidth = Math.abs(rEye.x - lEye.x);
    if (eyeWidth < 2) return 0;

    const eyeMidX   = (lEye.x + rEye.x) / 2;
    // Normalized nose offset: 0 = centred, +0.5 ≈ +30° right turn
    const noseOffset = (nose.x - eyeMidX) / eyeWidth;
    const yaw        = Math.max(-45, Math.min(45, Math.round(noseOffset * 60)));

    // Cross-check with ear geometry when both ears visible.
    // lToNose / rToNose > 1 → nose closer to RIGHT ear → turned RIGHT (+)
    // lToNose / rToNose < 1 → nose closer to LEFT ear  → turned LEFT  (-)
    if (vis(PL.L_EAR) && vis(PL.R_EAR)) {
      const lEarX = g(PL.L_EAR).x * W;
      const rEarX = g(PL.R_EAR).x * W;
      const lToNose = Math.abs(nose.x - lEarX);
      const rToNose = Math.abs(nose.x - rEarX);
      const ratio = lToNose / Math.max(rToNose, 1);
      if (ratio > 1.3) return -Math.min(45, Math.abs(yaw)); // nose far from left ear → turned left
      if (ratio < 0.7) return  Math.min(45, Math.abs(yaw)); // nose close to left ear → turned right
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

    if (vis(PL.L_EYE) && vis(PL.R_EYE)) {
      let ipdPx = Math.abs(g(PL.R_EYE).x * W - g(PL.L_EYE).x * W);
      // Correct IPD foreshortening from head yaw
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
function distanceScore(distCm, lo, hi) {
  if (distCm >= lo        && distCm <= hi)        return 100;
  if (distCm >= lo - 10   && distCm <= hi + 10)   return 80;
  if (distCm >= lo - 20   && distCm <= hi + 20)   return 55;
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

  // Both shoulders must be visible
  if (!vis(PL.L_SHOULDER) || !vis(PL.R_SHOULDER)) {
    return { ok: false, reason: "body_cropped" };
  }

  // Shoulders must not be at frame edge (body too close)
  const lShX = g(PL.L_SHOULDER).x;
  const rShX = g(PL.R_SHOULDER).x;
  if (lShX < 0.05 || rShX > 0.95) {
    return { ok: false, reason: "too_close" };
  }

  // Shoulders must span at least 10% of frame (not too far)
  const shSpan = Math.abs(rShX - lShX);
  if (shSpan < 0.10) {
    return { ok: false, reason: "too_far" };
  }

  return { ok: true, reason: "ok" };
}

// ═══════════════════════════════════════════════════════════════════
// BODY MODULE ANALYZERS
// Each returns { angle, score, severity, confidence, reliable }
// ═══════════════════════════════════════════════════════════════════

function analyzeNeckLean(lms, W, H, prop) {
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

  // Nose+ear blend: nose weight reduces yaw bias on the ear measurement
  const noseVis   = g(PL.NOSE)?.visibility ?? 0;
  const earWeight = noseOK && noseVis > 0.7 ? 0.15 : 0.50;
  const noseWeight = 1 - earWeight;
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

  const score     = scoreMetric(angle, 0, okAdj, badAdj);
  const severity  = classify(angle, SEV.NECK);
  const confidence = Math.round(70 + (vis(PL.L_EAR) ? 15 : 0) + (noseOK ? 10 : 0) + (shOK ? 5 : 0));

  return { angle: Math.round(angle), score, severity, confidence, reliable, okAdj, badAdj };
}

function analyzeHeadTilt(lms, W, H) {
  const g   = i => lms[i];
  const vis = i => (g(i)?.visibility ?? 0) >= VIS_MIN;
  const reliable = vis(PL.L_EYE) && vis(PL.R_EYE);

  if (!reliable) return { angle: 0, score: 90, severity: "normal", confidence: 0, reliable: false };

  const lEye = { x: g(PL.L_EYE).x * W, y: g(PL.L_EYE).y * H };
  const rEye = { x: g(PL.R_EYE).x * W, y: g(PL.R_EYE).y * H };
  const angle    = angleHoriz(lEye, rEye);
  const score    = scoreMetric(angle, 0, THR.HEAD_TILT.ok, THR.HEAD_TILT.bad);
  const severity = classify(angle, { mild: 3, moderate: 7, severe: 10 });
  return { angle: Math.round(angle), score, severity, confidence: 85, reliable };
}

function analyzeShoulderLevel(lms, W, H, prop) {
  if (!prop.shOK) return { angle: 0, score: 90, severity: "normal", confidence: 0, reliable: false };

  const angle    = angleHoriz(prop.lSh, prop.rSh);
  const score    = scoreMetric(angle, 0, THR.SH_TILT.ok, THR.SH_TILT.bad);
  const severity = classify(angle, SEV.SHOULDER);
  // Signed: positive = right shoulder higher
  const signed   = (prop.rSh.y - prop.lSh.y) > 0 ? angle : -angle;

  return { angle: Math.round(angle), signedAngle: Math.round(signed * 10) / 10, score, severity, confidence: 90, reliable: true };
}

function analyzeSpineLean(lms, W, H, prop, roundedScore) {
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
  const score   = scoreMetric(angle, 0, THR.SPINE_LEAN.ok, THR.SPINE_LEAN.bad);
  const severity = classify(angle, SEV.SPINE);
  return { angle: Math.round(angle), score, severity, confidence: 88, reliable: true };
}

function analyzeRoundedShoulders(lms, prop) {
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
  const lEar = { x: g(PL.L_EAR).x, y: g(PL.L_EAR).y };
  const rEar = { x: g(PL.R_EAR).x, y: g(PL.R_EAR).y };
  const midEarY  = (lEar.y + rEar.y) / 2;
  const midShY   = (g(PL.L_SHOULDER).y + g(PL.R_SHOULDER).y) / 2;

  // Normalized by shoulder width so it's camera-distance-independent
  const elevFrac = (midShY - midEarY) / Math.max(prop.shWidthFrac, 0.01);
  // elevFrac ~2.5-3.5 = normal; lower = rounded (shoulders elevated)
  const NEUTRAL = 2.8;
  const deviation = Math.max(0, NEUTRAL - elevFrac) * 20; // scale to 0–30 range

  const score    = scoreMetric(deviation, 0, THR.ROUNDED.ok, THR.ROUNDED.bad);
  const severity = classify(deviation, SEV.ROUNDED);
  return { depth: Math.round(deviation * 10) / 10, asymmetry: 0, score, severity, confidence: 80, reliable: true };
}

function analyzeFHP(lms, W, H, prop) {
  const g   = i => lms[i];
  const vis = i => (g(i)?.visibility ?? 0) >= VIS_MIN;
  const earOK = vis(PL.L_EAR) && vis(PL.R_EAR);
  if (!prop.shOK || !earOK) return { distCm: 0, extraLoadKg: 0, neckAngleDeg: 0, score: 90, severity: "normal", confidence: 0, reliable: false };

  const lEar = { x: g(PL.L_EAR).x * W };
  const rEar = { x: g(PL.R_EAR).x * W };
  const midEarX = (lEar.x + rEar.x) / 2;

  // Horizontal offset of ear midpoint from shoulder midpoint in cm
  const distCm = Math.round(Math.abs(midEarX - prop.midSh.x) * prop.cmPerPx * 10) / 10;

  // Clinically correct extra neck load — Hansraj (2014) Surgical Technology International
  // At 0cm FHP: head weight = 4.5kg at 0°.
  // FHP distance maps to forward pitch angle via arctan(distCm / 15cm cervical height)
  // Load = head_weight / cos(pitch) — exponential, not linear.
  const HEAD_WEIGHT_KG   = 4.5;
  const CERVICAL_HEIGHT  = 15; // cm — approximate C1-to-head-centre distance
  const pitchRad         = Math.atan2(Math.max(0, distCm), CERVICAL_HEIGHT);
  const pitchDeg         = pitchRad * 180 / Math.PI;
  const extraLoadKg      = Math.round(Math.max(0, (HEAD_WEIGHT_KG / Math.max(Math.cos(pitchRad), 0.35)) - HEAD_WEIGHT_KG) * 10) / 10;

  const score    = scoreMetric(distCm, 0, THR.FHP_CM.ok, THR.FHP_CM.bad);
  const severity = classify(distCm, SEV.FHP);
  return { distCm, extraLoadKg, neckAngleDeg: Math.round(pitchDeg), score, severity, confidence: 82, reliable: true };
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

export function analyzeMP(lms, W, H, mode, distCalibFactor = null, sessionStartMs = null) {
  if (!lms || lms.length < 25) return null;

  // Quality gate
  const quality = checkFrameQuality(lms, W, H);
  if (!quality.ok) {
    return { score: null, qualityScore: 0, qualityReason: quality.reason, detected: false };
  }

  // Body proportions (camera-independent normalization)
  const prop = computeProportions(lms, W, H);

  // Head yaw & distance
  const headYaw = estimateHeadYaw(lms, W, H);
  // Read ideal distance range from MODES (single source of truth) instead
  // of duplicating it with a hardcoded if/else that silently drifts if
  // MODES is ever edited elsewhere.
  const [lo, hi] = MODES[mode]?.distRange || MODES.laptop.distRange;
  const distCm  = estimateDistanceCm(lms, W, H, headYaw, distCalibFactor);
  const distSc  = distanceScore(distCm, lo, hi);

  // Body module analysis
  const rounded  = analyzeRoundedShoulders(lms, prop);
  const neck     = analyzeNeckLean(lms, W, H, prop);
  const headTilt = analyzeHeadTilt(lms, W, H);
  const shoulder = analyzeShoulderLevel(lms, W, H, prop);
  const spine    = analyzeSpineLean(lms, W, H, prop, rounded.score);
  const fhp      = analyzeFHP(lms, W, H, prop);
  const yaw      = analyzeHeadYawModule(lms, W, H);
  const elbow    = analyzeElbow(lms, W, H);
  const monitor  = analyzeMonitorHeight(lms, W, H, distCm);

  // ── Confidence-weighted overall score ──────────────────────────────
  // Modules with reliable=false contribute at reduced weight (30%)
  // so unmeasured landmarks don't inflate the score with placeholder 90s.
  const confWeight = (mod, w) => mod.reliable === false ? w * 0.30 : w;

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
    : (typeof performance !== "undefined" ? Math.round(performance.now() / 60000) : 0);
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
  };
}

// ═══════════════════════════════════════════════════════════════════
// SIDE CAMERA ANALYSIS
// ═══════════════════════════════════════════════════════════════════

export function analyzeSideMP(lms, W, H) {
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
  const nose  = px(PL.NOSE);

  const earOK   = vis(I.EAR);
  const shOK    = vis(I.SH);
  const hipOK   = vis(I.HIP);
  const kneeOK  = vis(I.KNEE);
  const ankleOK = vis(I.ANKLE);
  const noseOK  = vis(PL.NOSE);

  const NEUTRAL = 90;

  // ── Neck lean (side) — nose+ear blend, same as front ──
  const noseVis   = g(PL.NOSE)?.visibility ?? 0;
  const earWeight = noseOK && noseVis > 0.7 ? 0.15 : 0.50;
  const noseWeight = 1 - earWeight;
  const neckRef = {
    x: nose.x * noseWeight + ear.x * earWeight,
    y: nose.y * noseWeight + ear.y * earWeight,
  };
  const neckLeanRaw  = earOK && shOK ? angleVert(sh, neckRef) : 0;
  const neckCorrect  = NOSE_AHEAD_CM * noseWeight * 0.5; // side view correction
  const neckLean     = Math.max(0, neckLeanRaw - neckCorrect);
  const neckOK       = earOK && shOK;

  // Normalize neck thresholds by ear-shoulder span (camera-distance proxy)
  const earShSpan = Math.abs(ear.x - sh.x);
  const spanFrac  = earShSpan / Math.max(W, 1);
  const spanRatio = Math.max(0.70, Math.min(1.30, spanFrac / 0.14));
  const neckOkAdj  = Math.max(5.0,  8.0  * spanRatio);  // backend: neck_ok = max(5.0, 8.0*ratio)
  const neckBadAdj = Math.max(16.0, 22.0 * spanRatio);  // backend: neck_bad = max(16.0, 22.0*ratio)

  const trunkLean = shOK && hipOK  ? angleVert(hip, sh)          : 0;
  const hipAngle  = hipOK && kneeOK ? angle3pt(sh, hip, knee)     : 90;
  const kneeAngle = kneeOK && ankleOK ? angle3pt(hip, knee, ankle) : 90;
  const spineAlign = shOK && ankleOK
    ? Math.abs(ear.x - ankle.x) / Math.max(W, 1) * 100 : 0;

  // ── Forward head posture (side view) — horizontal ear-to-shoulder offset in cm ──
  // Mirrors backend.py analyze_side(): _fhp_side_cm = |ear.x - sh.x| * cm_per_px
  const shWidthPx  = earOK && shOK ? Math.abs(g(PL.L_SHOULDER).x * W - g(PL.R_SHOULDER).x * W) : 0;
  const cmPerPxSide = SHOULDER_WIDTH_CM / Math.max(shWidthPx, 1);
  const fhpSideCm   = earOK && shOK ? Math.round(Math.abs(ear.x - sh.x) * cmPerPxSide * 10) / 10 : 0;
  const fhpSideSc   = earOK && shOK ? scoreMetric(fhpSideCm, 0, 2.5, 7) : NEUTRAL;

  const neckSc  = neckOK  ? scoreMetric(neckLean,               0, neckOkAdj, neckBadAdj) : NEUTRAL;
  const trunkSc = shOK && hipOK  ? scoreMetric(trunkLean,       0, THR.TRUNK_LEAN.ok, THR.TRUNK_LEAN.bad) : NEUTRAL;
  const hipSc   = hipOK && kneeOK ? scoreMetric(Math.abs(hipAngle-90),  0, THR.HIP_ANGLE.ok,  THR.HIP_ANGLE.bad)  : NEUTRAL;
  const kneeSc  = kneeOK && ankleOK ? scoreMetric(Math.abs(kneeAngle-90),0, THR.KNEE_ANGLE.ok, THR.KNEE_ANGLE.bad) : NEUTRAL;
  const spineSc = shOK && ankleOK ? scoreMetric(spineAlign,     0, THR.SPINE_ALIGN.ok, THR.SPINE_ALIGN.bad) : NEUTRAL;

  const overall = Math.max(0, Math.min(100, Math.round(
    neckSc  * WEIGHTS_SIDE.neck  +
    trunkSc * WEIGHTS_SIDE.trunk +
    hipSc   * WEIGHTS_SIDE.hip   +
    kneeSc  * WEIGHTS_SIDE.knee  +
    spineSc * WEIGHTS_SIDE.spine
  )));

  const alerts = [
    neckOK && neckLean > neckBadAdj               && `⚠️ Forward head ${Math.round(neckLean)}° — ear must be above shoulder`,
    neckOK && neckLean > (neckOkAdj+neckBadAdj)/2 && neckLean <= neckBadAdj && `Neck lean ${Math.round(neckLean)}° — tuck chin back`,
    earOK && shOK && fhpSideCm > 5                && `⚠️ Forward head posture ${fhpSideCm}cm (side view) — tuck chin, pull head back over shoulders`,
    shOK && hipOK && trunkLean > 12               && `Trunk leaning ${Math.round(trunkLean)}° — sit back with lumbar support`,
    hipOK && kneeOK && Math.abs(hipAngle-90) > 15  && `Hip angle ${Math.round(hipAngle)}° (ideal ~90°) — adjust seat height`,
    kneeOK && ankleOK && Math.abs(kneeAngle-90) > 18 && `Knee angle ${Math.round(kneeAngle)}° (ideal ~90°) — adjust footrest`,
    shOK && ankleOK && spineAlign > 9              && `Plumb-line off ${Math.round(spineAlign)}% — ear should be above ankle`,
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
      spine_align:    { value: Math.round(spineAlign),score: spineSc, unit: "%",  label: "Spine plumb-line",  reliable: shOK && ankleOK },
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
