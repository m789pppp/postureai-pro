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
const VIS_MIN = 0.55;  // was 0.60 — ears/hips MediaPipe scores 0.45-0.58 regularly
const VIS_FACE = 0.60; // stricter for eyes/nose (more visible, more reliable)

/** Adult average IPD in cm (interpupillary distance) */
const IPD_CM = 6.3;

/** Focal length in pixels calibrated at 1280px width, 720p camera */
const FOCAL_PX_1280 = 800;

/** Adult average shoulder width in cm */
const SHOULDER_WIDTH_CM = 42.0;

/** Distance (cm) the shoulder-width reference is anchored at */
const REF_DIST_CM = 60;

/**
 * Reference shoulder-width fraction of frame at REF_DIST_CM.
 *
 * DERIVED from FOCAL_PX_1280 rather than hardcoded, because the file used to
 * carry three mutually incompatible focal-length models at once:
 *   - FOCAL_PX_1280 = 800            (IPD branch)      → 77° HFOV
 *   - REF_SH_FRAC 0.34 @ 60cm        (calibration)     → 92° HFOV
 *   - `600 * (W/640)` = 1200 @1280   (shoulder branch) → 56° HFOV
 * On one identical frame those returned 77cm, 60cm and 116cm. Because
 * estimateDistanceCm picks the IPD or shoulder branch per-frame on eye
 * visibility, a single blink or glare could flip the reading 77↔116cm on a
 * motionless body, firing a spurious "Too far" alert and swinging the overall
 * score ~11 points frame to frame.
 *
 * 800 is the one physically plausible value — a laptop webcam is ~60-78° HFOV;
 * 622 implies a 92° ultra-wide and 1200 a 56° telephoto. So everything is now
 * derived from it, which also fixes the calibration path: back-calculating a
 * real 42cm-shouldered adult at 60cm now yields 42cm rather than 54cm.
 */
const REF_SH_FRAC = (SHOULDER_WIDTH_CM * FOCAL_PX_1280) / (REF_DIST_CM * 1280); // ≈ 0.4375

/** Neutral nose-drop fraction relative to eye width (head level gaze) */
const NEUTRAL_NOSE_DROP_FRAC = 0.62;

/** Nose sits this many cm ahead of ear plane — used to correct FHP */
const NOSE_AHEAD_CM = 5.0;

/** Maximum plausible landmark velocity (normalized/sec) for jitter rejection */
const MAX_LM_VELOCITY = 3.0;

/** Frames to accept as genuine fast movement before overriding rejection */
const MAX_REJECT_STREAK = 3;

/** Frame buffer size for aggregation */
const FRAME_BUFFER_SIZE = 60; // 2s at 20fps after throttle — balances smoothness and responsiveness

/** Beep cooldown in ms */
const BEEP_COOLDOWN_MS = 30000;

/**
 * Consecutive frames a module's `reliable` flag must disagree with its
 * current stable state before that state actually flips — see
 * debounceReliable(). At the ~20fps effective analysis rate documented
 * above (FRAME_BUFFER_SIZE), 5 frames ≈ 250ms: long enough to smooth out
 * a single-frame visibility dip (e.g. ears sitting right at VIS_MIN, a
 * known-common case per the VIS_MIN comment above), short enough to still
 * react quickly to genuine occlusion (hand covering the camera, standing
 * up out of frame).
 */
const RELIABILITY_HYSTERESIS_FRAMES = 5;

// ─── Scoring thresholds (synced with backend.py score_m calls) ─────
const THR = {
  // Front camera
  HEAD_TILT:   { ok: 5,  bad: 12  },  // was ok:3 — natural asymmetry is 2-4°, raised to 5
  SH_TILT:     { ok: 5,  bad: 12  },  // was ok:3 — natural shoulder asymmetry 2-5° in adults
  SPINE_LEAN:  { ok: 6,  bad: 14  },  // was ok:4 — camera perspective adds 2-4° apparent lean
  HEAD_YAW:    { ok: 8,  bad: 20  },
  FHP_CM:      { ok: 3,  bad: 7   },  // was ok:2 — 2cm is within normal head position variation
  ROUNDED:     { ok: 10, bad: 22  },  // was ok:8 — raised to reduce false positives for natural posture
  ELBOW:       { ok: 15, bad: 30  },  // deviation from 95° ideal
  MONITOR_PITCH:{ ok: 5, bad: 18  },  // head pitch degrees
  TRUNK_ROT:   { ok: 12, bad: 30  },  // trunk twist degrees (calibrated band)
  TORSO_FLEX:  { ok: 12, bad: 30  },  // torso shortening % vs neutral (calibrated band)
  // Dedicated shoulder-shrug/tension metric — see analyzeShoulderElevation()
  // for why this needed its own scale separate from ROUNDED. Units: % of
  // shoulder-width the shoulders have risen above the user's neutral rest
  // position. ok=3 (~1.2cm rise at typical desk distance, ignorable) →
  // bad=10 (~4cm rise, a real deliberate shrug) crosses into the red zone.
  SHOULDER_ELEV:{ ok: 3,  bad: 10  },

  // Side camera
  NECK_SIDE:   { ok: 8,  bad: 22  },
  TRUNK_LEAN:  { ok: 6,  bad: 16  },  // backend: score_m(trunk_lean, 0, 6, 16)
  HIP_ANGLE:   { ok: 12, bad: 30  },  // deviation from 90°
  KNEE_ANGLE:  { ok: 12, bad: 35  },  // deviation from 90°
  SPINE_ALIGN: { ok: 4,  bad: 12  },  // backend: score_m(spine_align, 0, 4, 12)
};

// ─── Weighted scoring (front camera) ───────────────────────────────
// FHP (forward head posture — head/neck leaning toward the screen) used
// to be intentionally excluded here (see prior note, mirrored backend.py)
// and only surfaced as an informational alert. In practice this meant the
// single most common and damaging desk posture — craning your head toward
// the screen — never moved the overall score at all, even though
// analyzeFHP() already measures it correctly using true 3D (X+Z) distance.
// Given a real weight (0.18) and the other 7 weights rescaled by ×0.82 so
// they still sum to 1.0.
//
// monitor (head pitch — looking down/up) had the exact same problem as
// FHP used to: analyzeMonitorHeight() measured it correctly but it was
// never in this table, so a genuinely bad pitch (e.g. looking down at a
// phone/notes for long stretches) never moved the overall score, only
// ever appeared as an easy-to-miss informational alert. Given a real
// weight (0.08) and the other 8 weights rescaled by ×0.92 so the table
// still sums to 1.0.
// Exported (read-only) so the self-test can assert that every module which
// gets scored actually carries weight — twice now a metric has been computed,
// classified, alerted on and displayed while contributing 0 to the score.
export const WEIGHTS_FRONT_KEYS = {};
const WEIGHTS_FRONT = {
  // WEIGHT REBALANCE, from the sensitivity matrix in
  // postureEngine.accuracy.mjs rather than from intuition.
  //
  // `neck` carried the largest weight in the table, but analyzeNeckLean
  // measures the ear-midpoint-to-shoulder angle in the IMAGE plane, and from a
  // front-facing camera that is essentially a LATERAL measurement. Sweeping
  // every pose parameter against every metric showed it responding only to
  // lateral lean and to trunk rotation — both of which spine_lean and
  // trunk_rotation already score. So the single heaviest weight in the engine
  // was largely a duplicate of two others, and sagittal posture, which is what
  // desk work actually damages, was carried almost entirely by `fhp`.
  //
  // Weight moved from neck to fhp and torsoFlex. It is a judgement about
  // clinical priority, which no harness can settle, but it is a judgement
  // informed by measurement: forward head posture and thoracic flexion are the
  // dominant desk complaints and are now the metrics that actually detect them.
  // The table still sums to exactly 1.0 — asserted by the self-test.
  neck:     0.1400,
  tilt:     0.0669,
  shoulder: 0.0730,
  spine:    0.0883,
  distance: 0.0791,
  yaw:      0.0365,
  rounded:  0.0548,
  fhp:      0.1800,
  monitor:  0.0638,
  // analyzeElbow() has always been computed, classified for severity, given
  // alert copy and shown in the UI — but it was never in this table, so like
  // shoulderElev before it, it contributed exactly 0 to the score. Reaching
  // too far for a mouse is a named contributor to shoulder pain, so it should
  // cost something. Modest weight: for most laptop users the hands sit below
  // the frame, where the metric correctly reports unreliable and confWeight
  // drops it to 0 anyway.
  elbow:    0.0350,
  // Forward slouch and trunk twist were previously unscored entirely: a full
  // slump moved the total by 2 points and a 45-degree twist by 0, while lower
  // back and neck/shoulder are the two most-reported problem regions among
  // office workers. The ten weights above are scaled to make room.
  torsoFlex: 0.0957,
  trunkRot:  0.0386,
  // analyzeShoulderElevation() was added specifically because "no metric in
  // this engine reacted to a shoulder shrug at all" — but it was never given a
  // weight, so it still didn't: a measured SEVERE shrug (13.5% elevation) moved
  // the overall score by 1 point while the UI simultaneously showed "Shoulder
  // Elevation: severe" and surfaced "Drop your shoulders" as the top cue. The
  // nine original weights above are scaled by 0.95 to make room for it.
  shoulderElev: 0.0483,
  // sums to 1.00
};
Object.assign(WEIGHTS_FRONT_KEYS, WEIGHTS_FRONT);


// ─── Severity thresholds for condition classification ──────────────
const SEV = {
  // Forward head posture (cm)
  // mild was 1cm, which contradicted THR.FHP_CM.ok = 3: a 1cm reading scored
  // 91/100 ("green") while simultaneously being listed as a "Forward Head"
  // condition. 1cm is inside landmark noise, so every user carried a permanent
  // condition badge. Aligned to the scoring threshold.
  FHP: { mild: 3, moderate: 5, severe: 8 },
  // Neck lean (degrees). mild was 5, exactly the floor of okAdj — so a 5°
  // reading was "score 75, green zone" and "mild condition" at the same time.
  NECK: { mild: 7, moderate: 12, severe: 20 },
  // Shoulder tilt (degrees)
  SHOULDER: { mild: 3, moderate: 7, severe: 12 },
  // Rounded shoulders (Z-depth units)
  ROUNDED: { mild: 5, moderate: 10, severe: 18 },
  // Head yaw (degrees)
  YAW: { mild: 8, moderate: 18, severe: 30 },
  // Spine lean (degrees)
  SPINE: { mild: 5, moderate: 10, severe: 18 },
  // Shoulder elevation / shrug (% of shoulder width above neutral)
  SHOULDER_ELEV: { mild: 3, moderate: 7, severe: 12 },
  // Monitor/gaze pitch (degrees off level — looking down or up)
  MONITOR_PITCH: { mild: 5, moderate: 10, severe: 18 },
  // Trunk twist (degrees off square-on to the camera)
  TRUNK_ROT:     { mild: 12, moderate: 20, severe: 30 },
  // Torso flexion / forward slouch (% shortening of the shoulder-hip span)
  TORSO_FLEX:    { mild: 12, moderate: 20, severe: 30 },
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

export function gradeScore(s)   { return s >= 85 ? "Excellent" : s >= 70 ? "Good" : s >= 55 ? "Fair" : s >= 40 ? "Poor" : "Critical"; }
export function gradeScoreAr(s) { return s >= 85 ? "ممتاز"     : s >= 70 ? "جيد"  : s >= 55 ? "مقبول" : s >= 40 ? "ضعيف" : "خطر"; }
/** One-line health context shown below the score badge */
export function gradeContext(s, ar = false) {
  if (ar) {
    if (s >= 85) return "وضعية ممتازة — استمر على هذا";
    if (s >= 70) return "وضعية جيدة — تحسينات بسيطة ممكنة";
    if (s >= 55) return "ضغط متوسط على الرقبة والعمود — انتبه للتنبيهات";
    if (s >= 40) return "ضغط مرتفع — خطر توتر عضلي مزمن على المدى البعيد";
    return "وضعية خطرة — صحّح فوراً للحماية من الإصابة";
  }
  if (s >= 85) return "Excellent posture — keep it up";
  if (s >= 70) return "Good posture — minor tweaks possible";
  if (s >= 55) return "Moderate spinal load — watch the alerts";
  if (s >= 40) return "High load — chronic muscle strain risk over time";
  return "Critical posture — correct now to avoid injury";
}
export function scoreColor(s)   { return s >= 70 ? "#10b981"   : s >= 55 ? "#f59e0b" : "#ef4444"; } // aligned to gradeScore's tier boundaries (85/70/55/40)

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
 *
 * Perf note (live-session lag fix): this is called on every analysed
 * camera frame from App.jsx's runLoop. The previous implementation used
 * `Array.push`+`Array.shift` (O(n) re-index on every push) and re-sorted
 * the entire buffer on every `trimmedMean()` call (O(n log n), called
 * immediately after every push) — real, measurable per-frame cost that
 * buys nothing, since a multi-second rolling average cannot change
 * meaningfully frame-to-frame. Fixed with a fixed-size ring buffer
 * (O(1) push) and a throttled sort (recomputed every 3rd call, still
 * far more often than the underlying value can actually change).
 */
export function createFrameBuffer(size = FRAME_BUFFER_SIZE) {
  const buffer = new Array(size);
  let count = 0, head = 0, tick = 0;
  let cache = Object.create(null);

  return {
    /** Push a metrics object; returns aggregated result when buffer is full */
    push(metrics) {
      buffer[head] = metrics;
      head = (head + 1) % size;
      if (count < size) count++;
      tick = (tick + 1) % 3;
      return count >= Math.min(10, size); // ready after 10+ frames
    },

    /** Trimmed mean of a numeric field across all buffered frames (throttled) */
    trimmedMean(field, trimFrac = 0.1) {
      if (tick !== 0 && cache[field] !== undefined) return cache[field];
      const vals = [];
      for (let i = 0; i < count; i++) {
        const v = buffer[i] && buffer[i][field];
        if (typeof v === "number" && isFinite(v)) vals.push(v);
      }
      vals.sort((a, b) => a - b);
      if (!vals.length) { cache[field] = null; return null; }
      const cut = Math.floor(vals.length * trimFrac);
      const trimmed = vals.slice(cut, vals.length - cut);
      const result = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
      cache[field] = result;
      return result;
    },

    /** Standard deviation of a field — quality/confidence indicator */
    stdDev(field) {
      const mean = this.trimmedMean(field, 0);
      if (mean === null) return 0;
      let sum = 0, n = 0;
      for (let i = 0; i < count; i++) {
        const v = buffer[i] && buffer[i][field];
        if (typeof v === "number" && isFinite(v)) { sum += (v - mean) ** 2; n++; }
      }
      return n ? Math.sqrt(sum / n) : 0;
    },

    length: () => count,
    clear()  { count = 0; head = 0; tick = 0; cache = Object.create(null); buffer.length = 0; buffer.length = size; },
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
let _shRatioEMA  = null;
// Sliding median for distance. App.jsx had a smoother of its own, but it
// overwrote only `distCm` and `metrics.screen_distance.value` AFTER analyzeMP
// had already returned — so the distance SCORE (and the ~9.3% of the composite
// it carries) was still computed from the raw single-frame estimate. Result:
// the number on screen was smooth while the score it sat next to jittered, and
// the two could disagree outright (display reading 60cm while the score came
// from a 75cm spike). Smoothing here, before distanceScore() runs, fixes the
// display, the score and the disagreement in one place.
let _distMedBuf = [];
const DIST_MED_N = 9;

// ── Session self-baselines for the two posture-CHANGE metrics ──────────────
// Trunk rotation and torso flexion are both ratios of body measurements, and
// the population constants they would otherwise need vary enormously between
// people: IPD spans ~5.5-7.0cm and shoulder width ~36-48cm, so a
// shoulder/IPD ratio can sit +/-25% off "average" for a perfectly square
// subject — enough phantom signal to swamp the real one. The same is true of
// the shoulder-to-hip span, which additionally depends on camera height and
// tilt as much as on the person.
//
// So neither is scored against an absolute constant. Each learns THIS user's
// own neutral from the settled early part of the session and then scores the
// CHANGE from it — which is also the more useful question for these two
// postures, since slouching and twisting develop over a session rather than
// being fixed traits. A calibrated neutral overrides the learned one.
function _makeBaseline(warmupSkip, sampleN) {
  return { skipped: 0, samples: [], value: null, warmupSkip, sampleN };
}
function _feedBaseline(b, v) {
  if (!Number.isFinite(v)) return b.value;
  if (b.value !== null) return b.value;
  // Ignore the first frames: the user is usually still settling into the chair.
  if (b.skipped < b.warmupSkip) { b.skipped++; return null; }
  b.samples.push(v);
  if (b.samples.length >= b.sampleN) {
    const sorted = b.samples.slice().sort((a, c) => a - c);
    b.value = sorted[Math.floor(sorted.length / 2)]; // median, robust to outliers
  }
  return b.value;
}
let _trunkBase = _makeBaseline(40, 60);
let _torsoBase = _makeBaseline(40, 60);
// Ear-to-shoulder gap, used by BOTH shoulder elevation and rounded shoulders.
// See the note in analyzeShoulderElevation for why a population constant
// cannot work for this one.
let _earShBase = _makeBaseline(40, 60);
// Head apparent size relative to shoulder width — the sagittal forward-head
// signal. See analyzeFHP.
let _headShBase = _makeBaseline(40, 60);

// Head-yaw state. The estimator below reads the eye pair's DEPTH difference,
// which is a per-frame trigonometric measurement rather than a smoothed
// baseline — so what it needs is a short rolling median to knock down the
// noise in z, not a warm-up.
//
// 12 frames is 0.4s at 30fps: long enough to cut the spread by ~3x, short
// enough that a real head turn is not visibly laggy.
// Shoulder protraction, self-baselined. See analyzeRoundedShoulders for what
// is being measured; the baseline exists because the geometry has a constant
// anatomical offset (the ears sit behind the hip-shoulder line by an amount
// that depends on neck length) which cancels once the user's own neutral is
// known.
// 12 warm-up samples then 25 to average, NOT the (40, 60) the other baselines
// use. This analyzer runs inside the 1-in-3 expensive-metric block, so every
// "sample" is three frames: (40, 60) would need 300 frames — ten seconds — and
// the metric would sit unreliable through most of a short session. (12, 25)
// settles in about 120 frames, four seconds.
// ── Is the depth channel usable at all? ─────────────────────────────────
//
// Two metrics now read z: head yaw and shoulder protraction. MediaPipe does
// not measure depth, it regresses it, and how well it does that varies by
// device, lighting and model build. On a camera where it fails, z arrives as
// noise or as a column of zeros — and the engine must not go on reporting
// confident numbers derived from it.
//
// Measured without this gate: at 12x the x/y noise, head yaw read 37 deg for a
// true 30 and still said reliable; with z dead it read 38. Worse, protraction
// read 0.0cm — "no rounding" — with reliable=true, for a subject rounded 6cm.
// Silently telling someone their posture is fine is the worst direction to
// fail in, and it is exactly what an unvalidated depth channel produces.
//
// The check uses an anatomical fact that holds in every posture: the nose is
// in front of the ears. Always, by roughly 8-11cm, whichever way the head is
// turned or tilted. If the measured nose-ahead-of-ears distance is not a
// plausible positive number of centimetres, depth is not carrying depth.
const _DEPTH_MIN_CM = 3;    // below this, z is flat or inverted
const _DEPTH_MAX_CM = 30;   // above this, z is not in the units we think
// Measured on the harness, the frame-to-frame spread of the nose-ahead
// distance is 0.47cm at 3x the x/y landmark noise, 0.94cm at 6x, 1.87cm at
// 12x and 4.68cm at 30x. Head yaw survives 6x (a true 30 deg still reads 30
// after the rolling median) and breaks at 12x, where it reads 37 — atan2
// stops behaving symmetrically once the noise approaches the signal. 1.2cm
// admits everything up to about 8x and rejects the rest.
const _DEPTH_MAX_NOISE_CM = 1.2;
let _depthNoiseCm = 0;
let _depthWin = [];
let _depthOK  = false;

function _updateDepthUsable(g, vis, W) {
  if (!(vis(PL.NOSE) && vis(PL.L_EAR) && vis(PL.R_EAR)) || !(_lastDistCm > 0)) return;
  const earZ = (g(PL.L_EAR).z + g(PL.R_EAR).z) / 2;
  const noseZ = g(PL.NOSE).z;
  const focalPx = (FOCAL_PX_1280 * W) / 1280;
  const frameWidthCm = (_lastDistCm * W) / focalPx;
  const aheadCm = (earZ - noseZ) * frameWidthCm;
  if (!Number.isFinite(aheadCm)) return;
  _depthWin.push(aheadCm);
  if (_depthWin.length > 30) _depthWin.shift();
  if (_depthWin.length >= 12) {
    const sorted = [..._depthWin].sort((a, b) => a - b);
    const med = sorted[_depthWin.length >> 1];
    const mean = _depthWin.reduce((a, b) => a + b, 0) / _depthWin.length;
    const sd = Math.sqrt(_depthWin.reduce((a, b) => a + (b - mean) ** 2, 0) / _depthWin.length);
    // Two separate questions. Is z pointing the right way and roughly the
    // right size (the median) — and is it steady enough to measure a few
    // centimetres of posture with (the spread)? A camera can pass the first
    // and fail the second badly: under heavy noise the median of a symmetric
    // error is still correct while any single reading is not.
    //
    // The smallest thing these metrics claim to resolve is about 3cm of
    // shoulder protraction, so depth noise of that order makes the reading
    // meaningless however sensible its average looks.
    _depthNoiseCm = sd;
    _depthOK = med >= _DEPTH_MIN_CM && med <= _DEPTH_MAX_CM && sd <= _DEPTH_MAX_NOISE_CM;
  }
}

let _protractBase = _makeBaseline(12, 25);

let _yawWin      = [];
let _yawUsedZ    = false;  // which estimator produced the last reading
let _yawLastLms  = null;   // per-frame memo — two call sites, one computation
let _yawLastVal  = 0;
let _lastDistCm  = null;   // previous frame's distance, for the perspective term
// Ear-to-shoulder drop over shoulder width, for rounded shoulders. Separate
// from _earShBase because the two use different numerators (mid-ear vs
// per-side) and must not share a learned value.
// NOTE ON SAMPLE COUNTS: analyzeRoundedShoulders runs inside the
// every-third-frame block in analyzeMP, so these two baselines are fed once
// per three frames. (40, 60) would need 300 frames to settle — five times
// longer than the metrics fed every frame — and until it did, the metric
// reported unreliable and contributed nothing. Scaled to match the ~100-frame
// settle the others use. (5,12) = 17 calls, about 50 frames.
// Shoulder width over hip width. Above neutral means the shoulders have come
// FORWARD (nearer the camera, so magnified) — protraction. Below neutral means
// the shoulder line has foreshortened — rotation, which analyzeTrunkRotation
// reads from the same quantity. One ratio, two faults, opposite directions.
function smoothDistance(cm) {
  if (!Number.isFinite(cm)) return cm;
  _distMedBuf.push(cm);
  if (_distMedBuf.length > DIST_MED_N) _distMedBuf.shift();
  const sorted = _distMedBuf.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}
let _ipdShEMA    = null;  // IPD-based shoulder width estimate (pixels), EMA-smoothed

function computeProportions(lms, W, H, calibKnownDistCm = null) {
  const g   = i => lms[i];
  const vis = i => (g(i)?.visibility ?? 0) >= VIS_MIN;

  const lSh = { x: g(PL.L_SHOULDER).x * W, y: g(PL.L_SHOULDER).y * H, z: g(PL.L_SHOULDER).z ?? 0 };
  const rSh = { x: g(PL.R_SHOULDER).x * W, y: g(PL.R_SHOULDER).y * H, z: g(PL.R_SHOULDER).z ?? 0 };

  const shWidthPx   = Math.abs(rSh.x - lSh.x);
  const shWidthFrac = shWidthPx / Math.max(W, 1);
  const rawRatio    = Math.max(0.70, Math.min(1.30, shWidthFrac / REF_SH_FRAC));

  if (_shRatioEMA === null) _shRatioEMA = rawRatio;
  else _shRatioEMA = _shRatioEMA + 0.05 * (rawRatio - _shRatioEMA);
  const shRatio = _shRatioEMA;

  // ── IPD-based shoulder width estimation (no calibration needed) ─────────
  // Outer eye corner span is stable, highly visible, and correlates strongly
  // with biacromial shoulder width across body types.
  // Population avg: outer eye span ≈ 93 mm, shoulder width ≈ 410 mm
  // Ratio: 410 / 93 ≈ 4.41  (same distance → pixel ratio = cm ratio)
  // α = 0.04 → converges after ~25 frames (≈1 second at 30fps)
  const eyeOuterOK = vis(PL.L_EYE_OUTER) && vis(PL.R_EYE_OUTER);
  if (eyeOuterOK) {
    const outerSpanPx = Math.abs(g(PL.L_EYE_OUTER).x * W - g(PL.R_EYE_OUTER).x * W);
    if (outerSpanPx > 8) {
      const estimate = outerSpanPx * 4.41;
      if (_ipdShEMA === null) _ipdShEMA = estimate;
      else _ipdShEMA = _ipdShEMA + 0.04 * (estimate - _ipdShEMA);
    }
  }

  let effectiveShoulderWidthCm = SHOULDER_WIDTH_CM;
  let shWidthPxForCalc = shWidthPx;

  if (calibKnownDistCm && calibKnownDistCm > 20 && shWidthFrac > 0.05) {
    // Full calibration: pinhole model — most accurate
    const derived = (shWidthFrac * SHOULDER_WIDTH_CM * calibKnownDistCm) / (REF_SH_FRAC * REF_DIST_CM);
    effectiveShoulderWidthCm = Math.max(28, Math.min(58, Math.round(derived * 10) / 10));
  } else if (_ipdShEMA !== null && _ipdShEMA > 20) {
    // No calibration: IPD-based estimate replaces noisy shoulder-landmark width
    shWidthPxForCalc = _ipdShEMA;
    effectiveShoulderWidthCm = SHOULDER_WIDTH_CM; // ratio already embedded in _ipdShEMA
  }

  const cmPerPx = effectiveShoulderWidthCm / Math.max(shWidthPxForCalc, 1);

  return {
    lSh, rSh,
    midSh:      { x: (lSh.x + rSh.x) / 2, y: (lSh.y + rSh.y) / 2, z: (lSh.z + rSh.z) / 2 },
    midShZ:     (lSh.z + rSh.z) / 2,
    shWidthPx:  shWidthPxForCalc,
    // The MEASURED shoulder-landmark separation, before the eye-span
    // substitution above. shWidthPx deliberately swaps in an IPD-derived
    // estimate when uncalibrated (it is steadier for the cm-per-pixel maths),
    // but that estimate is blind to shoulder foreshortening by construction —
    // so anything measuring the shoulder line itself, such as trunk rotation,
    // must use this raw value instead.
    shWidthPxRaw: shWidthPx,
    shWidthFrac,
    shRatio,
    cmPerPx,
    effectiveShoulderWidthCm,
    ipdEstimated: _ipdShEMA !== null,
    shOK: vis(PL.L_SHOULDER) && vis(PL.R_SHOULDER),
    // Frame width in pixels. analyzeRoundedShoulders converts a normalised z
    // difference into centimetres and needs it; every other consumer already
    // had W in scope at its own call site.
    W,
  };
}

/**
 * Debounces a module's `reliable` flag against single-frame flicker.
 *
 * Without this, a module whose visibility hovers right around VIS_MIN
 * (the file's own comment on VIS_MIN documents ears commonly scoring
 * 0.45-0.58 — straddling the 0.55 cutoff in normal conditions, worse
 * under imperfect lighting) flips `reliable` true/false on individual
 * frames. Because confWeight() gives an unreliable module zero weight and
 * redistributes it via the W_ACTUAL baseline (see analyzeMP), that flip
 * doesn't just grey out one metric — it can swing the overall score by
 * double digits between two consecutive frames with zero real posture
 * change (verified: a fixed bad-posture case moved 64→81, "Fair"→"Good",
 * purely from ear visibility ticking under VIS_MIN and back). This holds
 * the module's effective reliability at its last stable value until the
 * new value has persisted for RELIABILITY_HYSTERESIS_FRAMES consecutive
 * frames, so a momentary dip doesn't move the score at all, while a real,
 * sustained change (actually covering the camera, standing up) still
 * takes effect within a fraction of a second.
 *
 * @param {string}  key               stable identifier per module (e.g. "neck")
 * @param {boolean} currentReliable   this frame's raw reliable flag
 */
function debounceReliable(key, currentReliable) {
  if (!analyzeMP._relState) analyzeMP._relState = Object.create(null);
  let st = analyzeMP._relState[key];
  if (!st) st = analyzeMP._relState[key] = { stable: currentReliable, streak: 0 };

  if (currentReliable === st.stable) {
    st.streak = 0;
  } else {
    st.streak++;
    if (st.streak >= RELIABILITY_HYSTERESIS_FRAMES) {
      st.stable = currentReliable;
      st.streak = 0;
    }
  }
  return st.stable;
}

/**
 * EMA-smooths a module's `confidence` value (separate from the boolean
 * debounce above). Most modules report a flat, constant confidence once
 * reliable — but a few (analyzeNeckLean, analyzeRoundedShoulders) derive
 * confidence from the SAME per-frame visibility signal that flickers near
 * VIS_MIN, so even with the reliable flag correctly debounced, confWeight's
 * `w * confidence/100` term could still wobble frame to frame on its own
 * (measured: with only the reliable-flag debounce applied, a single
 * flicker frame still moved a fixed pose's score 92→85 — the reliable
 * flag correctly stayed "true" throughout, but the raw confidence number
 * feeding confWeight() dipped on that one frame regardless). alpha=0.25
 * means a single-frame anomaly contributes at most a quarter of its full
 * delta, while a real sustained change still tracks within a few frames.
 * Harmless no-op for modules with a constant confidence.
 */
function smoothConfidence(key, currentConfidence, alpha = 0.25) {
  if (!analyzeMP._confEMA) analyzeMP._confEMA = Object.create(null);
  const prev = analyzeMP._confEMA[key];
  const next = prev == null ? currentConfidence : prev + alpha * (currentConfidence - prev);
  analyzeMP._confEMA[key] = next;
  return next;
}

/** Call on session reset / camera restart to clear proportion memory */
export function resetProportions() {
  _shRatioEMA = null;
  _distMedBuf = [];
  _trunkBase  = _makeBaseline(40, 60);
  _torsoBase  = _makeBaseline(40, 60);
  _earShBase  = _makeBaseline(40, 60);
  _headShBase = _makeBaseline(40, 60);
  _protractBase = _makeBaseline(12, 25);
  _depthWin = [];
  _depthOK = false;
  _depthNoiseCm = 0;
  _yawWin     = [];
  _yawUsedZ   = false;
  _yawLastLms = null;
  _yawLastVal = 0;
  _lastDistCm = null;
  _ipdShEMA   = null; // reset IPD estimate for new session
  analyzeMP._frameN = 0;
  analyzeMP._cachedRounded = null;
  analyzeMP._cachedFhp     = null;
  analyzeMP._cachedElbow   = null;
  analyzeMP._cachedMonitor = null;
  analyzeMP._scoreBuf = null;
  analyzeMP._relState = null;
  analyzeMP._confEMA = null;
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
  // Two call sites read this per frame (analyzeHeadYawModule and analyzeMP).
  // Without a memo the rolling median below would be fed twice per frame,
  // halving the window it actually covers.
  if (lms === _yawLastLms) return _yawLastVal;
  _yawLastLms = lms;
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

    // Recover the angle trigonometrically instead of scaling linearly.
    //
    // The nose tip sits ~2.2cm anterior to the inter-eye axis, so rotating the
    // head by θ moves it sideways by 2.2·sin θ while the eye baseline (the
    // outer-canthal span, ~9.3cm) foreshortens by cos θ. That makes
    // noseOffset ≈ (2.2/9.3)·tan θ ≈ 0.215·tan θ — a TANGENT relationship, not
    // a linear one. The old `noseOffset * 60` therefore under-reported badly:
    // a real 30° head turn came out as 8°. Downstream that meant the yaw score
    // effectively never left 90-100 for any normal desk head-turn, the "severe"
    // classification at 30° needed ~67° of real rotation to trigger, and the
    // understated angle was fed into estimateDistanceCm's cos-yaw
    // foreshortening correction, inflating distance as the user turned.
    // 3.0cm nose protrusion / 9.3cm outer-canthal span.
    //
    // Was 0.215, documented as "2.2cm nose / 9.3cm outer-canthal span" — but
    // 2.2cm is roughly the nose tip's protrusion ahead of the CORNEAL plane,
    // while the span in the denominator is measured at the outer canthi, which
    // sit noticeably further back. Mixing the two planes made the lever arm
    // too short and so over-reported every turn: measured on the
    // synthetic-subject harness, a true 30° head turn read as 43° and
    // saturated the ±45° clamp, and the inflated angle then propagated into
    // estimateDistanceCm's cos-yaw foreshortening correction.
    //
    // This is a population constant and cannot be self-baselined the way the
    // torso ratios are — at neutral the nose offset is zero regardless of the
    // ratio, so there is no signal to learn from. It is therefore the metric
    // in this file most worth checking against real users; treat the yaw angle
    // as ±20% until then.
    const NOSE_PROTRUSION_RATIO = 0.32;
    const noseYaw = Math.atan(noseOffset / NOSE_PROTRUSION_RATIO) * 180 / Math.PI;

    // ── Primary estimate: the eye pair's depth difference ────────────────
    //
    // The comment above says the lever-arm constant "cannot be self-baselined,
    // because at neutral the nose offset is zero whatever the constant is".
    // That is true of the nose's SIDEWAYS offset, and it is why this metric
    // sat at a 22-49% over-read with nothing to learn from. It is not true of
    // depth.
    //
    // Turn the head and the two outer eye corners stop being equidistant from
    // the camera: one advances, the other retreats, by a·sinθ each, while the
    // span between them foreshortens to 2a·cosθ. MediaPipe reports z in the
    // same normalised units as x, so
    //
    //     tan θ = Δz / Δx
    //
    // is a direct measurement — no nose, no anatomical constant, and the
    // per-user eye span cancels out of the ratio entirely. Measured on the
    // synthetic subject it is also linear in θ where the nose method is not:
    // a flat 1.08x across 10-40 deg, against 1.37x falling to 1.22x.
    //
    // The residual 8% is perspective, and it is removable. The corners lie at
    // slightly different depths, so their projected separation is not quite
    // f·2a/D; the error scales as the half-span over the distance. Both are
    // measurable here — the half-span from this frame's pixels and the
    // previous frame's distance — so the correction introduces no new
    // population constant, only the geometric 1.17.
    //
    // Cross-checked against the nose estimate below: z is REGRESSED by the
    // model rather than observed, and on a camera where it is unusable this
    // has to degrade rather than produce confident nonsense.
    let yawDeg = noseYaw;
    let usedZ  = false;
    if (useEdge && _depthOK) {
      const dxNorm = Math.abs(g(PL.R_EYE_OUTER).x - g(PL.L_EYE_OUTER).x);
      // Sign, spelled out because it is easy to get backwards and the
      // agreement gate below hides the mistake by silently falling back to
      // the nose estimate: landmarks arrive UNMIRRORED, so the subject's LEFT
      // eye sits at the higher image x. A turn toward their left (+ve, which
      // is what the nose estimate reports) swings that eye AWAY from the
      // camera and the right eye TOWARD it. z is negative toward the camera,
      // so the left corner is the less negative of the two — hence left minus
      // right. Written the other way round, every angle past ~12 deg failed
      // the agreement check and quietly fell back.
      const dzNorm = g(PL.L_EYE_OUTER).z - g(PL.R_EYE_OUTER).z;
      if (dxNorm > 1e-4 && Number.isFinite(dzNorm)) {
        let zYaw = Math.atan2(dzNorm, dxNorm) * 180 / Math.PI;
        if (_lastDistCm > 0) {
          const focalPx    = (FOCAL_PX_1280 * W) / 1280;
          const halfSpanCm = ((dxNorm * W) / 2) * _lastDistCm / focalPx;
          const persp      = 1 + 1.17 * (halfSpanCm / _lastDistCm);
          if (persp > 0.5 && persp < 2) zYaw /= persp;
        }
        // A disagreement this large means z is not carrying usable depth on
        // this device. Keep the nose estimate rather than trust it.
        if (Math.abs(zYaw - noseYaw) <= 25) { yawDeg = zYaw; usedZ = true; }
      }
    }

    // Rolling median, but only over the z-derived readings — the nose estimate
    // is already smooth and mixing the two would blend their different biases.
    if (usedZ) {
      _yawWin.push(yawDeg);
      if (_yawWin.length > 12) _yawWin.shift();
      const sorted = [..._yawWin].sort((a, b) => a - b);
      yawDeg = sorted[sorted.length >> 1];
    } else if (_yawWin.length) {
      _yawWin = [];
    }

    _yawUsedZ = usedZ;
    const yaw = Math.max(-45, Math.min(45, Math.round(yawDeg)));

    // The ear cross-check that used to live here has been REMOVED, not
    // repaired. It compared |nose−earL| against |nose−earR| and flipped the
    // sign when the ratio passed 1.3/0.7 — but the ears are posterior and
    // lateral while the nose is anterior and medial, so under yaw they
    // translate in OPPOSITE image directions. The check therefore contradicted
    // the nose estimate by construction rather than confirming it, making the
    // reported angle non-monotonic and discontinuous: turning steadily one way
    // gave +3°, +5°, then jumped NEGATIVE while still turning the same way. The
    // alert copy reads `yaw.angle > 0 ? "right" : "left"`, so past that flip
    // the app told users to correct the wrong side.
    _yawLastVal = yaw;
    return yaw;
  } catch { _yawLastVal = 0; return 0; }
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
function estimateDistanceCm(lms, W, H, yawDeg = 0, calibFactor = null, effectiveShoulderWidthCm = SHOULDER_WIDTH_CM) {
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
      // Same focal model as the IPD branch above — these two used to disagree
      // by ~50% on the same frame (see REF_SH_FRAC's note), so which one ran
      // mattered more than where the user actually was.
      const focal = FOCAL_PX_1280 * (W / 1280);
      return Math.max(20, Math.min(160, Math.round((effectiveShoulderWidthCm * focal) / shPx)));
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

  // Too close: either shoulder within 1% of frame edge.
  // Was 3%/97% — that fires on off-center framing alone (leaning slightly
  // toward the screen while not perfectly centered on a laptop's often
  // off-axis camera, or turning a bit toward the keyboard/mouse), not just
  // genuine proximity, since it's independent of total shoulder width.
  // The shWidthFracCheck>0.88 check below already catches real over-
  // proximity; this edge check only needs to catch a shoulder that's
  // actually run off the visible frame, so it can be tighter.
  // `severity` (0..1) reports HOW FAR past the threshold we are, not just that
  // we crossed it. The overall score needs this: a boolean can only be applied
  // as a flat penalty, which is either too harsh at the boundary or too weak
  // when someone is right on top of the lens.
  // Convention-agnostic edge test. This used to read
  //   lShPx < W*0.01 || rShPx > W*0.99
  // which assumes L_SHOULDER sits at the LOW-x edge — the mirrored
  // convention. Landmarks actually arrive unmirrored (see the sign note in
  // analyzeSpineLean), so L_SHOULDER is the HIGH-x one and both halves of that
  // test were unsatisfiable for a forward-facing subject: the branch never
  // fired. Comparing min/max instead makes it work under either convention,
  // and — importantly — it can no longer misfire the OPPOSITE way, labelling a
  // distant user at the frame edge as "too close" and telling them to back
  // away from three metres out.
  const shMinPx = Math.min(lShPx, rShPx);
  const shMaxPx = Math.max(lShPx, rShPx);
  if (shMinPx < W * 0.01 || shMaxPx > W * 0.99) {
    // Only a genuinely wide subject can have a shoulder off-frame because they
    // are close; a narrow one is simply off-centre, which is not a proximity
    // problem and must not be scored as one.
    const spanFrac = shWidthPx / Math.max(W, 1);
    if (spanFrac > 0.55) return { ok: false, reason: "too_close", severity: 1 };
  }

  // Too close: shoulders take up >85% of frame width
  // 0.72 was too aggressive for laptop wide-angle, 0.88 too permissive
  const shWidthFracCheck = shWidthPx / Math.max(W, 1);
  if (shWidthFracCheck > 0.85) {
    // 0.85 → 0 ramping to 1.0 → 1 (shoulders filling the entire frame)
    const sev = Math.min(1, (shWidthFracCheck - 0.85) / 0.15);
    return { ok: false, reason: "too_close", severity: sev };
  }

  // Too far: shoulder width less than 50px regardless of frame size
  // (replaces < 0.10 span which penalised wide-shoulder users at normal distance)
  if (shWidthPx < 50) {
    // 50px → 0 ramping to 20px or less → 1
    const sev = Math.min(1, (50 - shWidthPx) / 30);
    return { ok: false, reason: "too_far", severity: sev };
  }

  return { ok: true, reason: "ok", severity: 0 };
}

// ═══════════════════════════════════════════════════════════════════
// BODY MODULE ANALYZERS
// Each returns { angle, score, severity, confidence, reliable }
// ═══════════════════════════════════════════════════════════════════

function analyzeNeckLean(lms, W, H, prop, calib = null) {
  const g   = i => lms[i];
  const vis = i => (g(i)?.visibility ?? 0) >= VIS_MIN;

  const earOK  = (g(PL.L_EAR)?.visibility ?? 0) >= VIS_MIN && (g(PL.R_EAR)?.visibility ?? 0) >= VIS_MIN;
  const shOK   = prop.shOK;
  const noseOK = (g(PL.NOSE)?.visibility ?? 0) >= VIS_FACE;
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

  // FIXED angular thresholds — deliberately NOT scaled by apparent body size.
  //
  // These used to be `6.0 * prop.shRatio` / `17.0 * prop.shRatio`, where
  // shRatio is just how much of the frame the shoulders span, i.e. a proxy for
  // seating distance. But `angle` here comes from angleVert(), and an angle in
  // a fronto-parallel plane is already scale-invariant: sitting nearer does not
  // change the angle your neck makes, it only makes everything bigger in
  // pixels. Widening the tolerance band for a nearer user had no geometric
  // basis — if anything close-range landmarks are the more reliable ones.
  //
  // Measured on a fixed 12 deg neck lean with only the chair distance varied,
  // the old scaling produced scores of 31 / 43 / 52 / 59 / 63 across the normal
  // seating range: a 32-point swing on the single highest-weighted metric
  // (~0.24 of the total), so the overall score drifted by ~8 points as the user
  // leaned in and out over the day while their actual neck posture was
  // unchanged. The anchor values are the ones the scaling produced at the
  // reference distance.
  const okAdj  = 6.0;
  const badAdj = 17.0;

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
  const vis = i => (g(i)?.visibility ?? 0) >= VIS_FACE; // use stricter face threshold
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
  // Signed: positive = the subject's RIGHT shoulder is LOWER.
  // (Image y grows downward, so rSh.y > lSh.y means the right shoulder sits
  // lower in the frame.) The comment here used to say "right shoulder higher",
  // which is backwards on its own terms — the code and its consumer in
  // App.jsx's session-insight tracker ("right shoulder lower on average") were
  // already consistent with each other, so only the comment was wrong.
  // Unlike the spine sign below this is a Y comparison, so it is unaffected by
  // whether the frame is mirrored.
  const signed   = (prop.rSh.y - prop.lSh.y) > 0 ? angle : -angle;

  return { angle: Math.round(angle), signedAngle: Math.round(signed * 10) / 10, score, severity, confidence: 90, reliable: true, personalised:t.personalised };
}

/**
 * Trunk rotation — how far the shoulder line is twisted away from square-on.
 *
 * WHY THIS EXISTS: nothing in this engine reacted to a twisted torso. Measured
 * before adding it, a subject rotated a full 45 degrees scored identically to
 * one sitting square (95 vs 95, zero movement). Sitting turned toward an
 * off-centre monitor is one of the most common desk setups there is, it loads
 * the lumbar spine and neck asymmetrically, and head_yaw does not catch it —
 * someone twisted at the trunk is usually facing their screen squarely with
 * their HEAD, so head yaw reads ~0 while the whole torso is rotated.
 *
 * METHOD: shoulder width foreshortens as cos(theta) under rotation, but it also
 * shrinks with distance — so raw width says nothing on its own. Dividing by the
 * inter-pupillary distance removes distance entirely (both are measured at
 * essentially the same depth), leaving a pure rotation signal. Head yaw
 * foreshortens the IPD in the same way, so it is corrected out first; otherwise
 * simply turning your head would masquerade as a twisted trunk.
 */
function analyzeTrunkRotation(lms, W, H, prop, headYawDeg = 0, calib = null) {
  const g   = i => lms[i];
  const vis = i => (g(i)?.visibility ?? 0) >= VIS_MIN;
  if (!prop.shOK || !vis(PL.L_EYE) || !vis(PL.R_EYE)) {
    return { angle: 0, score: 90, severity: "normal", confidence: 0, reliable: false };
  }

  // MUST be the measured shoulder separation, not prop.shWidthPx — that one is
  // substituted with an eye-span-derived estimate when uncalibrated, which
  // cannot shrink when the trunk turns, so this metric would read a flat 0
  // degrees at any angle.
  const shPx  = prop.shWidthPxRaw ?? prop.shWidthPx;

  // The ruler is the HIP width, not the inter-pupillary distance.
  //
  // Using the IPD conflated depth with rotation, because the eyes and the
  // shoulders sit at different depths: anything that brings the head nearer
  // the camera enlarges the IPD while the shoulders stay put, shrinking
  // shPx/ipd exactly as a twist would. Measured on the synthetic-subject
  // harness, the old formulation reported a trunk twist of 25° for pure neck
  // flexion, 32° for 8cm of forward-head and 33° for a 20° forward lean — none
  // of which involve any rotation at all. A user slouching was told they were
  // twisted.
  //
  // Shoulders and hips are both on the torso and move together in depth, so
  // their ratio is invariant to how near the user sits and to anything the
  // head does. Anatomically it is also the right definition: trunk rotation IS
  // the shoulder line turning relative to the pelvis. A whole-body turn (the
  // chair swivels) foreshortens both equally and correctly reads zero — that
  // is facing away, which head yaw already covers, not spinal rotation.
  const hipsOK = vis(PL.L_HIP) && vis(PL.R_HIP);
  if (!hipsOK) {
    // Hips are frequently hidden by a desk. Report nothing rather than fall
    // back to a ruler known to be wrong.
    return { angle: 0, score: 90, severity: "normal", confidence: 0, reliable: false, reason: "hips_hidden" };
  }
  const hipPx = Math.abs(g(PL.R_HIP).x * W - g(PL.L_HIP).x * W);
  if (hipPx < 20 || shPx < 20) {
    return { angle: 0, score: 90, severity: "normal", confidence: 0, reliable: false };
  }

  const ratio = shPx / hipPx;

  // Neutral: the user's own settled early-session ratio (or a calibrated one).
  // A population constant is unusable here — see the _makeBaseline note.
  const personalised = typeof calib?.trunk_ratio_neutral === "number";
  const neutralRatio = personalised
    ? calib.trunk_ratio_neutral
    : _feedBaseline(_trunkBase, ratio);

  // Still learning this user's neutral — report nothing rather than guess.
  if (neutralRatio == null) {
    return { angle: 0, score: 90, severity: "normal", confidence: 0, reliable: false, calibrating: true };
  }

  // ratio = neutral * cos(theta)  ->  theta = acos(ratio / neutral).
  // Only SHRINKAGE means rotation; a ratio above neutral is noise, not a twist.
  const cosT  = Math.max(0, Math.min(1, ratio / Math.max(neutralRatio, 0.1)));
  const angle = Math.round(Math.acos(cosT) * 180 / Math.PI);

  const score    = scoreMetric(angle, 0, THR.TRUNK_ROT.ok, THR.TRUNK_ROT.bad);
  const severity = classify(angle, SEV.TRUNK_ROT);
  return { angle, score, severity, confidence: personalised ? 88 : 80, reliable: true, personalised };
}

/**
 * Torso flexion — the forward slouch/slump.
 *
 * WHY THIS EXISTS: lower back is the second most affected region in office
 * workers (~52% report it), and this engine had nothing that reacted to a
 * forward slump. analyzeSpineLean is explicitly a LATERAL detector — its own
 * comment says a forward slouch "barely moves it", because that motion is
 * almost entirely along the camera's depth axis. Measured before adding this, a
 * progressive slump from upright to fully slouched moved the overall score by
 * 2 points while spine_lean sat at a perfect 100 the whole way.
 *
 * METHOD: as the trunk flexes forward, the shoulder-to-hip span foreshortens in
 * the image. Normalising by shoulder width makes that scale-invariant, the same
 * trick analyzeRoundedShoulders uses for the ear-shoulder gap. Requires hips in
 * frame; on a laptop camera they often are not, in which case this reports
 * unreliable and the composite simply redistributes its weight.
 */
function analyzeTorsoFlexion(lms, W, H, prop, calib = null) {
  const g   = i => lms[i];
  const vis = i => (g(i)?.visibility ?? 0) >= VIS_MIN;
  const hipOK = vis(PL.L_HIP) && vis(PL.R_HIP);
  if (!prop.shOK || !hipOK) {
    return { ratio: 0, score: 90, severity: "normal", confidence: 0, reliable: false };
  }

  const midHipY = ((g(PL.L_HIP).y + g(PL.R_HIP).y) / 2) * H;
  const torsoPx = midHipY - prop.midSh.y;           // image-space, hips below shoulders
  const shRefPx = prop.shWidthPxRaw ?? prop.shWidthPx;
  if (torsoPx <= 0 || shRefPx < 20) {
    return { ratio: 0, score: 90, severity: "normal", confidence: 0, reliable: false };
  }
  const ratio = torsoPx / shRefPx;

  // Neutral: this user's own settled early-session span, or a calibrated one.
  // An absolute constant can't work — the projected shoulder-to-hip distance
  // depends on camera height and tilt as much as on the person's build.
  const personalised = typeof calib?.torso_ratio_neutral === "number";
  const neutral = personalised
    ? calib.torso_ratio_neutral
    : _feedBaseline(_torsoBase, ratio);

  if (neutral == null) {
    return { ratio: 0, score: 90, severity: "normal", confidence: 0, reliable: false, calibrating: true };
  }

  // Only SHORTENING counts. A longer-than-neutral span means sitting taller
  // than baseline, which is not a fault.
  const shrinkPct = Math.max(0, (neutral - ratio) / Math.max(neutral, 0.1)) * 100;
  const score    = scoreMetric(shrinkPct, 0, THR.TORSO_FLEX.ok, THR.TORSO_FLEX.bad);
  const severity = classify(shrinkPct, SEV.TORSO_FLEX);
  return { ratio: Math.round(ratio * 100) / 100, shrinkPct: Math.round(shrinkPct),
           score, severity, confidence: personalised ? 88 : 82, reliable: true, personalised };
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
  // Signed lean direction: angleVert() is documented as 2D-only (ignores
  // Z), so this metric is geometrically a LATERAL (sideways) lean
  // detector — a forward slouch toward the screen barely moves it, since
  // that motion is mostly along the camera's depth axis, not sideways in
  // the image. Needed so buildAlerts() can give direction-correct advice
  // instead of assuming forward slouch.
  //
  // SIGN CONVENTION — this was inverted, and the app told users to correct
  // the wrong side. App.jsx calls detectForVideo() on the raw <video>
  // element; the CSS `transform: scaleX(-1)` there is display-only and does
  // not touch the pixels MediaPipe reads. So landmarks arrive UNMIRRORED,
  // and in an unmirrored front-facing frame the subject's anatomical LEFT
  // appears at HIGHER image x (L_SHOULDER.x > R_SHOULDER.x). The old test
  // `(midSh.x - midHip.x) > 0` therefore meant "shoulders shifted toward the
  // subject's LEFT" while every consumer — buildAlerts' "Leaning right" copy
  // and App.jsx's `rightLean = signed > 0` cue — read positive as RIGHT.
  //
  // Derive the direction from the landmarks themselves rather than assuming
  // an x-ordering, so this stays correct if a caller ever feeds a
  // pre-mirrored frame: `leftIsHigherX` tells us which way anatomical-left
  // points in THIS frame, and positive stays "leaning to the subject's
  // right" as the consumers expect.
  const leftIsHigherX = prop.lSh.x >= prop.rSh.x;
  const towardHigherX = (prop.midSh.x - midHip.x) > 0;
  const leaningRight  = leftIsHigherX ? !towardHigherX : towardHigherX;
  const signed = leaningRight ? angle : -angle;
  return { angle: Math.round(angle), signedAngle: Math.round(signed * 10) / 10, score, severity, confidence: 88, reliable: true, personalised:t.personalised };
}

function analyzeRoundedShoulders(lms, prop, H, calib = null, trunkFlexDeg = 0) {
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

  // Neutral ear-to-shoulder ratio is ANATOMY-dependent (neck length): a
  // naturally short-necked user has a lower ratio and would read as
  // permanently "rounded" against a fixed constant. Prefer the user's own
  // calibrated neutral ratio; fall back to the population value ≈0.52.
  // Rounding/shrugging shrinks the ratio; ×45 maps the deviation onto the
  // existing 0–30 "depth" range and thresholds.
  // This metric requires calibration to mean anything.
  //
  // NEUTRAL_RATIO was the hardcoded 0.52, and no real body has that
  // ear-to-shoulder ratio: measured on the synthetic-subject harness across
  // the plausible adult range it is 0.20-0.43. So every uncalibrated user read
  // ~9 "depth" against an alert threshold of 8 and was told "shoulders
  // slightly forward - open chest" while sitting perfectly upright. The number
  // tracked their neck length and shoulder width, not their posture.
  //
  // ── Protraction, measured rather than inferred from neck length ──────
  //
  // The ear-to-shoulder ratio above answers the wrong question. It tracks how
  // far the shoulders sit BELOW the ears, which is mostly a fact about neck
  // length: measured across the plausible adult range on the synthetic
  // subject it spans 0.20-0.43, so the old hardcoded 0.52 neutral told every
  // uncalibrated user their shoulders were forward while they sat upright.
  // Self-baselining it would fix the constant but not the confusion, because
  // shrugging and rounding both shrink the same ratio.
  //
  // What "rounded shoulders" actually means is protraction: the shoulders
  // sitting FORWARD of the body's own axis. That is a depth question, and
  // there is a clean way to ask it. Take the line from the hip midpoint to
  // the ear midpoint — the trunk's own axis — and measure how far in front of
  // it the shoulders sit, at the height they sit at:
  //
  //     t         = (hipY - shY) / (hipY - earY)     0 at the hips, 1 at the ears
  //     zOnAxis   = hipZ + t * (earZ - hipZ)
  //     protraction = (zOnAxis - shZ) * frameWidthCm
  //
  // Leaning the whole trunk forward rotates hips, shoulders and ears together
  // and leaves them collinear, so it largely cancels. A forward head moves the
  // ear and not the shoulder, so it pushes the number NEGATIVE and cannot be
  // mistaken for rounding. Measured on the harness after baselining, a true
  // 3/6/9cm of protraction reads 3.16/6.67/10.59cm — and identically for a
  // long neck, a short neck and a broad frame, because the baseline absorbs
  // the anatomy. A 20 degree trunk lean leaks 1.8cm.
  //
  // The previous attempt at self-baselining this metric was reverted because
  // the reliability flag behaved in a way I could not account for. The
  // difference now is that the quantity being baselined is a distance in
  // centimetres with a physical meaning, not a ratio of two lengths that both
  // move when the user shrugs.
  const earZ = (g(PL.L_EAR).z + g(PL.R_EAR).z) / 2;
  const shZ  = (g(PL.L_SHOULDER).z + g(PL.R_SHOULDER).z) / 2;
  const hipsVisible = vis(PL.L_HIP) && vis(PL.R_HIP);

  if (hipsVisible && _lastDistCm > 0 && _depthOK) {
    const hipZ  = (g(PL.L_HIP).z + g(PL.R_HIP).z) / 2;
    const midShYn = prop.midSh.y / Math.max(H, 1);
    const hipYn = (g(PL.L_HIP).y + g(PL.R_HIP).y) / 2;
    const earYn = (g(PL.L_EAR).y + g(PL.R_EAR).y) / 2;
    const span  = hipYn - earYn;

    if (Math.abs(span) > 0.02) {
      const t          = (hipYn - midShYn) / span;
      const zOnAxis    = hipZ + t * (earZ - hipZ);
      const focalPx    = (FOCAL_PX_1280 * prop.W) / 1280;
      const frameWidth = (_lastDistCm * prop.W) / focalPx;
      const raw        = (zOnAxis - shZ) * frameWidth;

      if (Number.isFinite(raw) && Math.abs(raw) < 40) {
        _feedBaseline(_protractBase, raw);
        if (_protractBase.value === null) {
          return { depth: 0, score: 90, severity: "normal", confidence: 0,
                   reliable: false, learning: true };
        }
        const protractCm = Math.max(0, raw - _protractBase.value);
        const score      = scoreMetric(protractCm, 0, THR.ROUNDED.ok, THR.ROUNDED.bad);
        // A big trunk lean leaks a little into this (1.8cm at 20 degrees), and
        // at that point the torso metric is the one that should be talking.
        const leaning    = Math.abs(trunkFlexDeg || 0) > 22;
        return {
          depth: Math.round(protractCm * 10) / 10,
          protractionCm: Math.round(protractCm * 10) / 10,
          score,
          severity: classify(protractCm, SEV.ROUNDED),
          confidence: leaning ? 45 : 75,
          reliable: !leaning,
          personalised: true,
        };
      }
    }
  }

  // Anything else — no hips in frame, no distance yet, the geometry
  // degenerate, or this camera's depth channel not carrying depth — reports
  // unreliable. confWeight then drops the metric from the score entirely.
  //
  // That is deliberately the only remaining outcome. What used to live here
  // was the old ear-to-shoulder ratio path, which measured neck length rather
  // than posture and needed a calibration almost nobody ran; keeping it as a
  // fallback would mean a user on a device with poor depth silently gets
  // scored by the method that was switched off for being wrong. Better to
  // measure nothing than to measure the wrong thing quietly.
  return { depth: 0, score: 90, severity: "normal", confidence: 0,
           reliable: false, needsDepth: true };
}

/**
 * Dedicated shoulder-shrug/tension metric.
 *
 * Previously the only signal that reacted to raising your shoulders was
 * buried inside analyzeRoundedShoulders() — the same raw ear-to-shoulder
 * gap, scaled ×45 and then blended 80/20 with a Z-depth signal meant for a
 * completely different posture problem (forward protraction). For a real,
 * deliberate shrug (shoulders rising ~3-5cm, the natural "raise your
 * shoulders toward your ears" motion), that produced a "deviation" of only
 * ~3-5 out of THR.ROUNDED's {ok:10, bad:22} scale — nowhere near the
 * round_mid alert floor of depth>8 — so the reading barely moved and no
 * alert ever fired. On top of that, analyzeShoulderLevel() (shoulder TILT)
 * is structurally blind to a symmetric shrug too: it only measures the
 * angle between the two shoulder points, which doesn't change when both
 * shoulders rise together. Net result: no metric in this engine reacted to
 * a shoulder shrug at all.
 *
 * backend.py's analyze_front() already has this as its own metric
 * ("shoulder_elevation") — this ports the same underlying signal (ear-to-
 * shoulder Y gap) but normalizes it by shoulder-width-in-pixels
 * (prop.shWidthPx) rather than raw frame height, so — like every other
 * metric in this file — it stays camera-distance-invariant instead of
 * drifting with how close the user happens to be sitting. It also gets its
 * own THR.SHOULDER_ELEV/SEV.SHOULDER_ELEV scale (see above) tuned so an
 * actual shrug lands in the yellow/red zone instead of being diluted
 * inside a metric built for a slow structural deviation.
 */
function analyzeShoulderElevation(lms, W, H, prop, calib = null) {
  const g   = i => lms[i];
  const vis = i => (g(i)?.visibility ?? 0) >= VIS_MIN;
  const earOK = vis(PL.L_EAR) && vis(PL.R_EAR);
  if (!prop.shOK || !earOK) return { elevPct: 0, score: 90, severity: "normal", confidence: 0, reliable: false };

  const lEarYpx = g(PL.L_EAR).y * H;
  const rEarYpx = g(PL.R_EAR).y * H;
  const lGap = (prop.lSh.y - lEarYpx) / Math.max(prop.shWidthPx, 1);
  const rGap = (prop.rSh.y - rEarYpx) / Math.max(prop.shWidthPx, 1);
  const elevRatio = (lGap + rGap) / 2;

  // NEUTRAL used to be the hardcoded constant 0.52, and no real body has that
  // ratio. Measured on the synthetic-subject harness across the plausible
  // adult range (neck 10-16cm, biacromial width 36-48cm), the true resting
  // ratio is 0.20-0.43 — so an uncalibrated user sitting perfectly relaxed was
  // reported at 9-32% "shoulder elevation", permanently, and the figure
  // tracked their BUILD rather than their posture: a broad-shouldered,
  // short-necked person read ~32 while a narrow-shouldered, long-necked one
  // read ~9. Both were sitting identically. Since the metric is saturated by
  // that offset it could not detect real elevation either — 4cm of genuine
  // shrug moved it by 0.3.
  //
  // The ratio is a fact about the person's skeleton, so like trunk rotation
  // and torso flexion it has to be learned from the user rather than assumed.
  // Calibration value first, then the user's own learned median, and while
  // still learning the metric reports unreliable rather than guessing — an
  // unknown answer is better than a confident wrong one.
  const calibNeutral = (typeof calib?.rounded_neutral === "number" &&
                        calib.rounded_neutral > 0.10 && calib.rounded_neutral < 0.80)
    ? calib.rounded_neutral : null;
  const learned = _feedBaseline(_earShBase, elevRatio);
  const NEUTRAL = calibNeutral ?? learned;

  if (NEUTRAL === null) {
    return { elevPct: 0, score: 90, severity: "normal", confidence: 0, reliable: false, learning: true };
  }

  const elevPct  = Math.max(0, NEUTRAL - elevRatio) * 100;
  const score    = scoreMetric(elevPct, 0, THR.SHOULDER_ELEV.ok, THR.SHOULDER_ELEV.bad);
  const severity = classify(elevPct, SEV.SHOULDER_ELEV);
  return { elevPct: Math.round(elevPct * 10) / 10, score, severity, confidence: 82, reliable: true,
           neutral: Math.round(NEUTRAL * 1000) / 1000, personalised: calibNeutral !== null };
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

  // Z-asymmetry guard: if the two ears have very different Z values the head
  // is significantly rotated (yaw). In that state the ear midpoint is no longer
  // on the sagittal plane so FHP measurement is geometrically invalid.
  // Threshold: 0.06 normalised units ≈ ~25-30° yaw — beyond this we bail out.
  const zSpread = Math.abs(lEar.z - rEar.z);
  if (zSpread > 0.06) return { distCm: 0, extraLoadKg: 0, neckAngleDeg: 0, score: 90, severity: "normal", confidence: 0, reliable: false, reason: "head_rotated" };

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

/**
 * Forward-head displacement from apparent head size — the sagittal estimator.
 *
 * analyzeFHP above measures the ear-to-shoulder offset, which from a
 * FRONT-facing camera is almost entirely a lateral measurement: moving your
 * head forward is motion along the camera axis and barely changes any x or y.
 * Its depth term leans on MediaPipe's z, which this file distrusts everywhere
 * else ("Z-based depth is very noisy") and with good reason.
 *
 * Measured on the synthetic-subject harness with a geometrically EXACT z — the
 * best case MediaPipe could ever achieve — 8cm of true forward-head read as
 * 5.6cm, and 25° of neck flexion moved the total score by 2 points. Forward
 * head posture and slouching are the actual epidemiology of desk work, so
 * being blind to them is the most consequential thing this engine could get
 * wrong.
 *
 * There is a much stronger signal available, and it needs no z at all. The
 * head and the shoulders sit at different depths, so their apparent sizes
 * scale differently as the head moves: at 60cm, moving the head 8cm forward
 * enlarges it by ~15% while the shoulders are unchanged. That ratio uses only
 * x-coordinates, which MediaPipe estimates far more accurately than depth.
 *
 *   r  = ipd_px / shoulder_px        (grows as the head comes forward)
 *   r0 = the user's own neutral r
 *   Δ  = distance · (1 − r0/r)
 *
 * Like every other ratio-of-this-body measurement here, r0 has to be learned
 * from the user rather than assumed — see the _makeBaseline note.
 *
 * (This is the same quantity analyzeTrunkRotation used to misread as a twist.
 * It was always a forward-head signal; it was only ever pointed at the wrong
 * conclusion.)
 */
function analyzeForwardHeadDepth(lms, W, H, prop, distCm, calib = null, trunkRotDeg = 0) {
  const g   = i => lms[i];
  const vis = i => (g(i)?.visibility ?? 0) >= VIS_MIN;
  if (!prop.shOK || !vis(PL.L_EYE) || !vis(PL.R_EYE)) {
    return { fwdCm: 0, reliable: false };
  }
  const ipdPx = Math.abs(g(PL.R_EYE).x * W - g(PL.L_EYE).x * W);
  const shPx  = prop.shWidthPxRaw ?? prop.shWidthPx;
  if (ipdPx < 4 || shPx < 20) return { fwdCm: 0, reliable: false };

  // De-rotate the shoulder ruler before using it.
  //
  // A trunk twist foreshortens the apparent shoulder width by cos(theta),
  // which inflates ipd/shoulder exactly as a head coming forward would — so a
  // 35° twist was reported as 9.3cm of forward head, complete with a "raise
  // your monitor" alert. Same class of error this metric was created to fix in
  // analyzeTrunkRotation, arriving from the opposite direction: two quantities
  // that share a ruler will each read as the other unless the shared term is
  // removed. Trunk rotation is measured against the hips and so is itself
  // unaffected by this, which is what makes it usable as the correction.
  const cosRot = Math.max(Math.cos(Math.min(50, Math.abs(trunkRotDeg)) * Math.PI / 180), 0.64);
  const shPxTrue = shPx / cosRot;

  const ratio = ipdPx / shPxTrue;

  const calibNeutral = (typeof calib?.head_sh_ratio_neutral === "number" && calib.head_sh_ratio_neutral > 0.05)
    ? calib.head_sh_ratio_neutral : null;
  const learned = _feedBaseline(_headShBase, ratio);
  const r0 = calibNeutral ?? learned;
  if (r0 == null) return { fwdCm: 0, reliable: false, calibrating: true };

  // Δ from the CURRENT head depth, not the neutral one:
  //
  //   r/r0 = depth0 / depth_now      (apparent size scales as 1/depth)
  //   depth0 = depth_now · (r/r0)
  //   Δ = depth0 − depth_now = depth_now · (r/r0 − 1)
  //
  // Writing it as D·(1 − r0/r) instead — the algebraically tempting form —
  // silently substitutes the current distance for the neutral one, which is
  // already shortened by the very movement being measured. That under-read
  // 8cm of true forward-head as 6.8cm.
  const D = Number.isFinite(distCm) && distCm > 20 ? distCm : 60;
  // Only growth counts: a head further away than neutral is leaning back,
  // which is not forward-head and is not scored here.
  const fwdCm = Math.max(0, D * (Math.max(ratio, 1e-6) / r0 - 1));

  // Guard against the ratio being disturbed by head yaw rather than depth:
  // turning the head foreshortens the IPD, which would read as leaning BACK
  // (harmless, clamped at 0) but a large yaw makes the estimate meaningless.
  return {
    fwdCm: Math.round(Math.min(fwdCm, 25) * 10) / 10,
    ratio: Math.round(ratio * 1000) / 1000,
    neutral: Math.round(r0 * 1000) / 1000,
    reliable: true,
    personalised: calibNeutral !== null,
  };
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
  // Confidence follows which estimator actually ran. With a usable depth
  // channel this is exact on the harness; without one it falls back to the
  // nose-offset method, which reads about 25% high — the direction is still
  // right and the alert still points the correct way, but it should not carry
  // the same weight in the score as a measurement that is not guessing.
  return { angle: Math.round(yaw), absAngle: Math.round(absYaw), score, severity,
           confidence: _yawUsedZ ? 85 : 45, usedDepth: _yawUsedZ, reliable };
}

function analyzeElbow(lms, W, H) {
  const g   = i => lms[i];
  const vis = i => (g(i)?.visibility ?? 0) >= VIS_MIN;

  const lOK = vis(PL.L_SHOULDER) && vis(PL.L_ELBOW) && vis(PL.L_WRIST);
  const rOK = vis(PL.R_SHOULDER) && vis(PL.R_ELBOW) && vis(PL.R_WRIST);
  if (!lOK && !rOK) return { angle: null, score: 90, severity: "normal", confidence: 0, reliable: false };

  const px = i => ({ x: g(i).x * W, y: g(i).y * H });

  // The elbow angle has to be computed in THREE dimensions, not in the image
  // plane, and this is the one joint where it matters most.
  //
  // A person typing has their forearms pointing away from them — which, in
  // front of a laptop, means pointing almost straight at the camera. That
  // segment projects to almost nothing in x and y, so the 2D angle between
  // upper arm and forearm collapses toward a straight line. Measured on the
  // synthetic subject: a correctly posed typing arm whose true angle is 92.5°
  // read as 164° in 2D, and 164° is scored as "Elbows too low — raise
  // keyboard". The engine was telling a person sitting correctly to rebuild
  // their desk, and the more correctly they sat, the more certain it got.
  //
  // z shares x's normalisation (a fraction of frame width), so multiplying it
  // by W puts all three axes in the same units and an ordinary dot product
  // gives the real angle.
  const pt3 = i => ({ x: g(i).x * W, y: g(i).y * H, z: (g(i).z ?? 0) * W });
  const angle3d = (a, b, c) => {
    const p1 = pt3(a), p2 = pt3(b), p3 = pt3(c);
    const u = { x: p1.x - p2.x, y: p1.y - p2.y, z: p1.z - p2.z };
    const v = { x: p3.x - p2.x, y: p3.y - p2.y, z: p3.z - p2.z };
    const mu = Math.hypot(u.x, u.y, u.z), mv = Math.hypot(v.x, v.y, v.z);
    if (mu < 1 || mv < 1) return null;
    const cos = (u.x * v.x + u.y * v.y + u.z * v.z) / (mu * mv);
    return Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI;
  };
  const calcAngle = (sh, el, wr) => angle3d(sh, el, wr) ?? angle3pt(px(sh), px(el), px(wr));
  const lAng = lOK ? calcAngle(PL.L_SHOULDER, PL.L_ELBOW, PL.L_WRIST) : null;
  const rAng = rOK ? calcAngle(PL.R_SHOULDER, PL.R_ELBOW, PL.R_WRIST) : null;
  const avg  = lAng != null && rAng != null ? Math.round((lAng + rAng) / 2) : (lAng ?? rAng);

  // Only score the elbow when the arms are actually WORKING.
  //
  // The 90-120° guidance below is about keyboard height, and it only means
  // anything while the hands are at a keyboard. Arms hanging relaxed at the
  // sides sit at 170-180°, which this scored as a severe fault and reported as
  // "Elbows too low — raise keyboard". Measured on the synthetic harness, that
  // was one of three alerts fired at a perfectly upright resting subject: the
  // app telling someone who is doing nothing wrong to adjust their desk.
  //
  // A working arm has the wrist forward of, and not far below, the elbow. A
  // hanging arm has the wrist almost directly beneath it. Use that to tell
  // them apart, and report unreliable rather than wrong when the arms are
  // simply at rest — confWeight then drops the metric from the score instead
  // of penalising a non-problem.
  const armWorking = (sh, el, wr) => {
    const e = px(el), w = px(wr), sHalf = Math.abs(px(PL.L_SHOULDER).x - px(PL.R_SHOULDER).x) / 2;
    if (!(sHalf > 10)) return false;
    const drop = (w.y - e.y) / Math.max(sHalf, 1);   // wrist below elbow, in half-shoulder units
    const reach = Math.abs(w.x - e.x) / Math.max(sHalf, 1);
    // Hanging: wrist far below the elbow and almost directly under it.
    return !(drop > 0.75 && reach < 0.45);
  };
  const lWorking = lOK && armWorking(PL.L_SHOULDER, PL.L_ELBOW, PL.L_WRIST);
  const rWorking = rOK && armWorking(PL.R_SHOULDER, PL.R_ELBOW, PL.R_WRIST);
  if (!lWorking && !rWorking) {
    return { angle: avg, score: 90, severity: "normal", confidence: 0, reliable: false, reason: "arms_at_rest" };
  }

  // OSHA/NIOSH: acceptable elbow range 90-120°, ideal 100-110°
  // Use midpoint 105° as ideal, tolerance ±15° before penalty
  const elbowIdeal = 105;
  const elbowDev   = avg != null ? Math.max(0, Math.abs(avg - elbowIdeal) - 15) : 0;
  const score    = scoreMetric(elbowDev, 0, THR.ELBOW.ok, THR.ELBOW.bad);
  const severity = classify(elbowDev, { mild: 10, moderate: 20, severe: 30 });
  return { angle: avg, idealMin: 90, idealMax: 120, score, severity, confidence: 80, reliable: true };
}

function analyzeMonitorHeight(lms, W, H, distCm, calib = null) {
  const g   = i => lms[i];
  const vis = i => (g(i)?.visibility ?? 0) >= VIS_MIN;
  if (!vis(PL.L_EYE) || !vis(PL.R_EYE)) return { offsetCm: 0, direction: "ok", score: 90, severity: "normal", confidence: 0, reliable: false };

  const lEye = { x: g(PL.L_EYE).x * W, y: g(PL.L_EYE).y * H };
  const rEye = { x: g(PL.R_EYE).x * W, y: g(PL.R_EYE).y * H };
  const nose = { x: g(PL.NOSE).x * W,  y: g(PL.NOSE).y * H };

  const eyeMidY  = (lEye.y + rEye.y) / 2;
  const eyeWidth = Math.abs(rEye.x - lEye.x);
  if (eyeWidth < 2) return { offsetCm: 0, direction: "ok", score: 90, severity: "normal", confidence: 0, reliable: false };

  // Neutral = the user's OWN measured nose-drop when available.
  //
  // The denominator here is the eye-centre IPD (~6.3cm), so the 5-degree "ok"
  // band corresponds to a nose-drop difference of only ~0.35cm — well inside
  // normal facial variation. Against the single hardcoded population constant,
  // a perfectly level head measured -7.2 degrees for a short nose and +9.9 for
  // a long one: an unclearable "raise/lower your monitor" instruction plus a
  // permanent score deduction determined by face shape rather than by where
  // the monitor actually is. PostureCalibration now captures
  // nose_drop_neutral, which removes that bias entirely for calibrated users.
  const personalNeutral = typeof calib?.nose_drop_neutral === "number"
    ? calib.nose_drop_neutral
    : null;
  const neutralFrac  = personalNeutral ?? NEUTRAL_NOSE_DROP_FRAC;
  const noseDropFrac = (nose.y - eyeMidY) / eyeWidth;
  const pitchProxy   = (noseDropFrac - neutralFrac) * 90;
  const pitchDeg     = Math.round(pitchProxy * 10) / 10;

  let offsetCm = 0, direction = "ok";
  if (Math.abs(pitchDeg) > 2 && distCm > 20) {
    offsetCm  = Math.round(distCm * Math.tan(Math.abs(pitchDeg) * Math.PI / 180) * 10) / 10;
    direction = pitchDeg > 0 ? "below" : "above";
  }

  // Uncalibrated users keep a band wide enough that anatomy alone cannot push
  // them out of it (normal face shape spans roughly +/-10 degrees of apparent
  // pitch here); calibrated users get the tight, meaningful band because their
  // neutral is measured rather than assumed. Confidence is likewise lower
  // without a personal baseline, so the composite leans on it less.
  const okThr  = personalNeutral != null ? THR.MONITOR_PITCH.ok  : 12;
  const badThr = personalNeutral != null ? THR.MONITOR_PITCH.bad : 25;
  const score    = scoreMetric(Math.abs(pitchDeg), 0, okThr, badThr);
  const severity = classify(Math.abs(pitchDeg), personalNeutral != null
    ? SEV.MONITOR_PITCH
    : { mild: 12, moderate: 18, severe: 25 });
  return { offsetCm, direction, pitchDeg, score, severity,
           confidence: personalNeutral != null ? 72 : 55,
           reliable: true, personalised: personalNeutral != null };
}

// ═══════════════════════════════════════════════════════════════════
// ALERT BUILDER with deduplication
// ═══════════════════════════════════════════════════════════════════

/**
 * Build the alert list, ordered by how much each fault is ACTUALLY costing.
 *
 * The array used to come out in the order the conditions happened to be
 * written, and App.jsx shows `alerts[0]` as the headline and stores it as the
 * session's alert cause. So the first line written won the user's attention
 * regardless of relevance: measured on the synthetic harness, an 18° lateral
 * lean produced five alerts led by "Neck lean 17° — tuck chin slightly", with
 * "Leaning right 18° — sit centered" fourth. The one useful instruction was
 * buried under three pieces of wrong advice, and the wrong one was also what
 * got written into the session history and the analytics.
 *
 * Each alert now carries the score impact of the metric behind it — the
 * metric's weight multiplied by how far below 100 it scored — and the list is
 * sorted by that. The headline becomes whatever is genuinely most wrong, and
 * it stays correct automatically when the weight table changes.
 */
function buildAlerts(modules, distCm, lo, hi) {
  const seen  = new Set();
  const items = [];
  /**
   * @param key    dedupe key
   * @param cond   whether the alert fires
   * @param text   user-facing copy
   * @param impact weight x (100 - metric score); higher sorts first
   */
  const add = (key, condition, text, impact = 0) => {
    if (!condition || !text || seen.has(key)) return null;
    seen.add(key);
    // `key` is carried through so a caller can rate-limit per CAUSE rather
    // than per message — two different neck messages are the same nag.
    items.push({ key, text, impact });
    return text;
  };

  const { neck, headTilt, shoulder, spine, fhp, rounded, yaw, elbow, monitor, distance, shoulderElev, handProp, torsoFlex, trunkRot } = modules;

  // Impact of a module: its weight in the score, times how far it fell short.
  const imp = (weightKey, mod) =>
    (WEIGHTS_FRONT[weightKey] || 0) * Math.max(0, 100 - (mod?.score ?? 100));

  // True when a lateral trunk lean accounts for most of the head's deviation
  // from vertical — the head is going with the body, not independently of it.
  const _spineAbs = Math.abs(spine?.signedAngle ?? spine?.angle ?? 0);
  const _leanExplains = (spine?.reliable ?? false) &&
                        _spineAbs > 8 &&
                        (neck?.angle ?? 0) <= _spineAbs * 1.25;

  // A trunk TWIST also produces a phantom neck lean. Rotating the shoulders
  // brings one of them nearer the lens, so perspective magnifies it and the
  // projected shoulder midpoint shifts sideways — which tilts the
  // midpoint-to-head line even though the neck has not moved. Measured on the
  // synthetic harness, a 35° twist produced a phantom 17° "neck lean", and
  // because neck outweighs trunk rotation it became the headline: a user
  // turned toward a badly placed monitor was told to tuck their chin.
  const _rotAbs = Math.abs(trunkRot?.angle ?? 0);
  const _twistExplains = (trunkRot?.reliable ?? false) && _rotAbs > 12;

  const trunkExplainsHead = _leanExplains || _twistExplains;

  const _built = [
    // The neck alerts are suppressed when the trunk already explains the head
    // being off vertical.
    //
    // analyzeNeckLean measures the shoulder-to-head angle in the image plane,
    // which from a front camera responds mostly to LATERAL movement — so when
    // a user leans sideways it fires alongside spine lean, head tilt and
    // shoulder imbalance, all describing the one event. Measured on the
    // synthetic harness, an 18° lean produced five alerts, and because neck
    // carries the larger weight its copy ("tuck chin slightly") became the
    // headline: the wrong correction for the actual fault, shown to the user
    // and stored as the session's alert cause.
    //
    // If the head is off vertical because the whole torso is, the instruction
    // is "sit centred", not "tuck your chin". Only flag the neck for the part
    // the trunk does NOT account for.
    add("neck_sev",  neck.angle > neck.badAdj && !trunkExplainsHead,                    `⚠️ Severe neck lean ${neck.angle}° — raise monitor to eye level immediately`, imp("neck", neck)),
    add("neck_mid",  neck.angle > (neck.okAdj + neck.badAdj) / 2 && neck.angle <= neck.badAdj && !trunkExplainsHead, `Neck lean ${neck.angle}° — tuck chin slightly`, imp("neck", neck)),
    add("fhp_sev",   fhp.reliable && fhp.distCm > 6,             `⚠️ Forward head ${fhp.distCm}cm (~${fhp.neckAngleDeg}° pitch, +${fhp.extraLoadKg}kg neck load) — raise monitor`, imp("fhp", fhp)),
    add("fhp_mid",   fhp.reliable && fhp.distCm > 3 && fhp.distCm <= 6, `Forward head ${fhp.distCm}cm (+${fhp.extraLoadKg}kg) — tuck chin back`, imp("fhp", fhp)),
    // Head tilt and shoulder imbalance are suppressed for the same reason as
    // the neck alerts above: a lateral trunk lean rotates the shoulder line
    // and carries the head with it, so all three fire at once and their
    // corrections ("check chair height", "adjust armrests") are wrong for a
    // fault whose actual fix is to sit centred. One event should produce one
    // instruction.
    add("tilt",      headTilt.reliable && headTilt.angle > 10 && !trunkExplainsHead,    `Head tilting ${headTilt.angle}° — check chair height`, imp("tilt", headTilt)),
    add("sh",        shoulder.reliable && shoulder.angle > 10 && !trunkExplainsHead,    `Shoulder imbalance ${shoulder.angle}° — adjust armrests`, imp("shoulder", shoulder)),
    // angleVert() (what spine.angle/signedAngle come from) is documented
    // as 2D-only — it ignores Z — so this metric is geometrically a
    // LATERAL lean detector: leaning sideways moves it a lot, leaning
    // forward toward the screen barely moves it at all (that's what
    // fhp/neck/rounded are for). The old copy — "sit back with lumbar
    // support" — assumed forward slouch, the wrong correction for what's
    // actually the dominant real-world cause here (reaching for a
    // phone/mouse, resting on one armrest, leaning toward a coworker).
    // Now uses spine.signedAngle to name the actual side and give the
    // matching correction.
    add("spine_sev", spine.reliable && Math.abs(spine.signedAngle ?? spine.angle) > 18,
        `⚠️ Leaning ${(spine.signedAngle ?? spine.angle) > 0 ? "right" : "left"} ${spine.angle}° — sit centered, weight even on both hips`),
    add("spine_mid", spine.reliable && Math.abs(spine.signedAngle ?? spine.angle) > 10 && Math.abs(spine.signedAngle ?? spine.angle) <= 18,
        `Leaning ${(spine.signedAngle ?? spine.angle) > 0 ? "right" : "left"} ${spine.angle}° — engage core, sit centered`),
    add("yaw",       yaw.reliable && yaw.absAngle > 18,           `Head turned ${yaw.absAngle}° ${yaw.angle > 0 ? "right" : "left"} — face monitor`, imp("yaw", yaw)),
    add("dist_cl",   distCm < lo - 10,                            `⚠️ Very close (${distCm}cm) — move back to ${lo}–${hi}cm`, imp("distance", distance)),
    add("dist_c",    distCm < lo && distCm >= lo - 10,            `Too close (${distCm}cm) — ideal ${lo}–${hi}cm`, imp("distance", distance)),
    add("dist_f",    distCm > hi + 15,                            `Too far (${distCm}cm) — ideal ${lo}–${hi}cm`, imp("distance", distance)),
    add("round_sev", rounded.reliable && rounded.depth > 15,      `⚠️ Rounded shoulders — pull shoulder blades together`, imp("rounded", rounded)),
    add("round_mid", rounded.reliable && rounded.depth > 8 && rounded.depth <= 15, `Shoulders slightly forward — open chest`, imp("rounded", rounded)),
    add("round_calib_tip", rounded.calibrationRecommended,        `Tip: run Personal Posture Calibration for a more precise rounded-shoulders reading`, imp("rounded", rounded)),
    add("shrug_sev", shoulderElev.reliable && shoulderElev.elevPct > THR.SHOULDER_ELEV.bad, `⚠️ Shoulders elevated/shrugging (${shoulderElev.elevPct}%) — relax shoulders down and back`, imp("shoulder", shoulder)),
    add("shrug_mid", shoulderElev.reliable && shoulderElev.elevPct > THR.SHOULDER_ELEV.ok && shoulderElev.elevPct <= THR.SHOULDER_ELEV.bad, `Shoulders slightly raised — relax your trap muscles`, imp("shoulder", shoulder)),
    add("elbow_hi",  elbow.reliable && elbow.angle != null && elbow.angle < 70, `⚠️ Elbows too high (${elbow.angle}°) — lower keyboard`, imp("elbow", elbow)),
    add("elbow_lo",  elbow.reliable && elbow.angle != null && elbow.angle > 125, `Elbows too low (${elbow.angle}°) — raise keyboard`, imp("elbow", elbow)),
    // "below" (looking down) used to always be worded as "Monitor too low —
    // raise it", which is actively wrong advice when the real cause is
    // looking down at a phone/notes rather than a low monitor — the engine
    // can't tell those apart from a single frame's pitch reading alone, so
    // the copy now covers both possibilities honestly instead of asserting
    // one specific (and often incorrect) cause.
    // Threshold depends on whether the neutral is measured or assumed: without
    // calibration this reading carries up to ~10 deg of pure face-shape bias
    // (~10cm of phantom offset at 60cm), which sailed past a flat 5cm trigger
    // and gave a large subset of users a permanent, unclearable instruction to
    // move a monitor that was already at eye level.
    add("mon_low",   monitor.reliable && monitor.direction === "below" && monitor.offsetCm > (monitor.personalised ? 5 : 14), `Looking down ~${monitor.offsetCm}cm below eye level — raise your monitor, or if you're checking a phone/notes, keep it brief`, imp("monitor", monitor)),
    add("mon_hi",    monitor.reliable && monitor.direction === "above" && monitor.offsetCm > (monitor.personalised ? 5 : 14), `Looking up ~${monitor.offsetCm}cm above eye level — lower your monitor`, imp("monitor", monitor)),
    // Hand/chin-prop occlusion — see analyzeMP() for detection logic. This
    // is deliberately informational-only (no score weight): we can't
    // quantify the actual neck angle once an ear is occluded, so this just
    // makes sure the user isn't left with zero feedback while a real
    // desk habit silently drops ~50% of the score's weight to "unreliable".
    // Forward slouch — the posture behind most lower-back complaints, and one
    // this engine used to be completely blind to.
    add("slouch_sev", torsoFlex?.reliable && torsoFlex.severity === "severe",
        `⚠️ Slouching forward — stack your ribs over your hips and let the chair back support you`),
    add("slouch_mid", torsoFlex?.reliable && (torsoFlex.severity === "moderate" || torsoFlex.severity === "mild"),
        `You're starting to slump — sit tall, hips back in the seat`, imp("torsoFlex", torsoFlex)),
    // Trunk twist — usually an off-centre monitor rather than a habit, so the
    // advice names the fix rather than telling the user to "sit better".
    add("twist_sev", trunkRot?.reliable && trunkRot.severity === "severe",
        `⚠️ Torso twisted ${trunkRot.angle}° — square your chair to the screen instead of turning your body`),
    add("twist_mid", trunkRot?.reliable && trunkRot.severity === "moderate",
        `Sitting turned ${trunkRot.angle}° — centre your monitor so you don't have to twist`),
    add("hand_prop", handProp?.detected, `Hand/object covering one ear — resting your chin on your hand hides real neck strain from being measured`),
  ];
  void _built;   // the add() calls above populate `items`; this array is unused

  // Most-costly first. `impact` is the metric's weight times its shortfall, so
  // the headline alert — the one App.jsx shows and stores as the session's
  // alert cause — is whatever is actually doing the most damage to the score,
  // not whichever condition happens to be written first in this file.
  items.sort((a, b) => b.impact - a.impact);
  // Both shapes: a plain string array for every existing caller, and the
  // structured list for the live loop, which needs the cause key to apply its
  // per-cause cooldown.
  const out = items.map(i => i.text);
  out.detailed = items;
  return out;
}

// ═══════════════════════════════════════════════════════════════════
// MAIN FRONT-CAMERA ANALYSIS
// ═══════════════════════════════════════════════════════════════════

export function analyzeMP(lms, W, H, mode, distCalibFactor = null, sessionStartMs = null, calibKnownDistCm = null, calib = null) {
  if (!lms || lms.length < 25) return null;

  // Quality gate — split into HARD blocks (genuinely nothing measurable —
  // a shoulder isn't even visible) and SOFT warnings (shoulders ARE
  // visible, so real posture metrics — especially spine lean and forward-
  // head — can and should still run; the qualityReason is surfaced as a
  // warning alongside the reading rather than instead of it).
  //
  // Previously ANY quality failure — including too_close/too_far —
  // returned immediately with no metrics at all. Since the most common way
  // to trigger too_close is leaning/slouching forward toward the screen,
  // that meant the exact "severe spine lean"/"forward head" event those
  // metrics exist to catch got silently swallowed and replaced with a
  // blank quality-failure screen instead of the real (and worse) reading.
  // too_close/too_far are the only reasons where checkFrameQuality() has
  // already confirmed both shoulders are visible (that check runs first,
  // as "body_cropped" — a genuine hard block below) — so there is enough
  // landmark data to keep going. Allowlisted explicitly rather than
  // denylisting "body_cropped"/"no_body" so any future/unexpected reason
  // string defaults to the old, safe, hard-blocking behaviour.
  const quality = checkFrameQuality(lms, W, H);
  const SOFT_QUALITY_REASONS = new Set(["too_close", "too_far"]);
  if (!quality.ok && !SOFT_QUALITY_REASONS.has(quality.reason)) {
    return { score: null, qualityScore: 0, qualityReason: quality.reason, detected: false };
  }
  const qualityScore  = quality.ok ? 100 : 0;
  const qualityReason = quality.ok ? null : quality.reason;

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
  const distCm  = smoothDistance(estimateDistanceCm(lms, W, H, headYaw, distCalibFactor, prop.effectiveShoulderWidthCm));
  // Hand this frame's distance to the NEXT frame's yaw estimator, which needs
  // it for the perspective term. Deliberately one frame stale: yaw is computed
  // before distance (distance consumes yaw for its own foreshortening
  // correction), and at 30fps a seated user's distance does not move enough
  // between frames for the lag to matter. On the very first frame it is null
  // and the correction is simply skipped.
  if (Number.isFinite(distCm) && distCm > 0) _lastDistCm = distCm;
  // Re-check whether z is carrying real depth on this device, now that a
  // distance exists to convert it with.
  _updateDepthUsable(i => lms[i], i => (lms[i]?.visibility ?? 0) >= VIS_MIN, W);
  let   distSc  = distanceScore(distCm, lo, hi);

  // Reconcile the two independent distance signals.
  //
  // checkFrameQuality() judges proximity from raw frame geometry (how much of
  // the frame the shoulders span), while distCm is a back-calculated estimate
  // that depends on distCalibFactor and the assumed shoulder width. When those
  // disagree — the frame says the user is filling the lens while distCm still
  // reads inside the ideal 50-80cm band — distSc stayed at a perfect 100 and
  // the "move back" warning had literally zero effect on the score. That is the
  // reported bug: the app says "too close" while the number doesn't move.
  //
  // Frame geometry is the more direct evidence here (it measures pixels that
  // are actually there, with no calibration in the path), so on disagreement it
  // wins: cap distSc to the band that the geometric severity implies.
  const distScUncapped = distSc;
  if (!quality.ok && (quality.reason === "too_close" || quality.reason === "too_far")) {
    const sev = typeof quality.severity === "number" ? quality.severity : 1;
    // sev 0 (just over the line) → cap 70; sev 1 (extreme) → cap 30, matching
    // distanceScore()'s own floor so the two scales stay comparable.
    const cap = Math.round(70 - 40 * sev);
    distSc = Math.min(distSc, cap);
  }

  // ── Hand/chin-prop occlusion detection ─────────────────────────────
  // Very common desk habit: resting your chin/cheek on your hand. The
  // propping hand typically covers one ear, dropping its visibility below
  // VIS_MIN — at which point analyzeNeckLean/analyzeFHP/analyzeRoundedShoulders
  // (together ~50% of the score's weight) correctly mark themselves
  // unreliable and exclude themselves from the score via confWeight()
  // below. That's the right call numerically (no false inflation from a
  // landmark we can't trust) — but it means the actual posture problem
  // silently vanishes into "insufficient data" with zero user-facing
  // feedback, instead of being flagged.
  // Detected as: exactly one ear visible while facing roughly forward
  // (|yaw|<15°). A genuinely turned head would show much larger yaw and
  // typically still resolves the far ear (just at lower confidence)
  // rather than losing it outright — so a missing ear WITHOUT a
  // corresponding head turn is a strong, cheap signal of physical
  // occlusion (hand, hair, phone) rather than normal head rotation.
  const handPropG   = i => lms[i];
  const handPropVis = i => (handPropG(i)?.visibility ?? 0) >= VIS_MIN;
  const handProp = {
    detected: (handPropVis(PL.L_EAR) !== handPropVis(PL.R_EAR)) && Math.abs(headYaw) < 15,
  };

  // Body module analysis — quick metrics run every frame, expensive every 3rd.
  // `calib` personalises neck/tilt/shoulder/spine scoring to the user's own
  // neutral posture measured during calibration.
  const neck     = analyzeNeckLean(lms, W, H, prop, calib);
  const headTilt = analyzeHeadTilt(lms, W, H, calib);
  const shoulder = analyzeShoulderLevel(lms, W, H, prop, calib);
  const yaw      = analyzeHeadYawModule(lms, W, H);
  const shoulderElev = analyzeShoulderElevation(lms, W, H, prop, calib);
  // Forward slouch and trunk twist — the two most common desk postures the
  // engine previously had no reaction to at all. See each function's header.
  const torsoFlex = analyzeTorsoFlexion(lms, W, H, prop, calib);
  const trunkRot  = analyzeTrunkRotation(lms, W, H, prop, headYaw, calib);

  // Expensive metrics — cached between frames.
  // IMPORTANT: rounded must be computed BEFORE spine because analyzeSpineLean
  // uses rounded.score as input. On non-skip frames, compute rounded fresh and
  // pass it directly to spine. On skip frames, use the cached value.
  let rounded, fhp, elbow, monitor;
  if (!skipExpensive || !analyzeMP._cachedRounded) {
    rounded = analyzeRoundedShoulders(lms, prop, H, calib, torsoFlex?.angle);
    fhp     = analyzeFHP(lms, W, H, prop);

    elbow   = analyzeElbow(lms, W, H);
    monitor = analyzeMonitorHeight(lms, W, H, distCm, calib);
    // Keep each analyzer's OWN verdict before the debounce below overwrites
    // it. These four objects are cached and reused on the two skipped frames
    // out of every three, and the debounce assigns its output straight back
    // onto `.reliable` — so without this, two frames in three fed the
    // debounce its own previous answer instead of a fresh observation.
    //
    // The effect was a latch. Once `stable` settled false (which it does for
    // every module during its warm-up), the input matched `stable` on the two
    // cached frames and reset the streak, so the one genuine `true` per cycle
    // could never accumulate the consecutive frames needed to flip it back.
    // A module that became reliable therefore stayed marked unreliable
    // forever, contributing nothing to the score.
    //
    // This is what made the earlier attempt at self-baselining rounded
    // shoulders look inexplicable: the numbers were right and the flag never
    // turned on, and the cause was here rather than in that analyzer.
    rounded._rawReliable = rounded.reliable;
    fhp._rawReliable     = fhp.reliable;
    elbow._rawReliable   = elbow.reliable;
    monitor._rawReliable = monitor.reliable;

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

  // Sagittal forward-head, computed EVERY frame rather than inside the
  // every-third-frame block above: it feeds a running baseline, and a
  // baseline fed on one frame in three takes three times as long to settle
  // (which is exactly why this read as a no-op when first wired in).
  //
  // Combine with the lateral ear-shoulder offset by taking the LARGER of the
  // two, not the sum: they are two views of one displacement, and adding them
  // When the sagittal estimate is available it REPLACES the older term rather
  // than being combined with it.
  //
  // analyzeFHP's 2D component is deltaX — the ear's horizontal offset from the
  // shoulder midpoint — which is a LATERAL measurement wearing a sagittal
  // name. Taking the larger of the two therefore reported a pure sideways lean
  // as "Forward head 3.6cm — tuck chin back", and because that outranked the
  // real instruction it became the headline the user saw and the cause stored
  // in their session history. Lateral displacement is what spine_lean is for;
  // one metric, one axis.
  {
    const fwd = analyzeForwardHeadDepth(lms, W, H, prop, distCm, calib,
                                       trunkRot?.reliable ? (trunkRot.angle || 0) : 0);
    if (fwd.reliable) {
      const d = fwd.fwdCm;
      const pitchRad = Math.atan2(Math.max(0, d), 15);
      fhp = {
        ...fhp,
        distCm: d,
        neckAngleDeg: Math.round(pitchRad * 180 / Math.PI),
        extraLoadKg: Math.round(Math.max(0, (4.5 / Math.max(Math.cos(pitchRad), 0.35)) - 4.5) * 10) / 10,
        score: scoreMetric(d, 0, THR.FHP_CM.ok, THR.FHP_CM.bad),
        severity: classify(d, SEV.FHP),
        reliable: true,
        source: "depth",
      };
    }
  }
  // Spine runs every frame (fast) but depends on rounded.score from above
  const spine = analyzeSpineLean(lms, W, H, prop, rounded.score, calib);

  // Debounce every module's `reliable` flag — see debounceReliable() for
  // why a raw per-frame flip is a real score-stability bug, not cosmetic.
  // Safe to apply uniformly to cached (rounded/fhp/elbow/monitor) as well
  // as per-frame modules: on a cache-hit frame the flag hasn't changed
  // since the last call, so this is a no-op that just keeps the streak
  // counter at 0 until the next genuinely fresh (every-3rd-frame) reading.
  neck.reliable          = debounceReliable("neck",          neck.reliable);
  headTilt.reliable      = debounceReliable("headTilt",      headTilt.reliable);
  shoulder.reliable      = debounceReliable("shoulder",      shoulder.reliable);
  spine.reliable         = debounceReliable("spine",         spine.reliable);
  yaw.reliable           = debounceReliable("yaw",           yaw.reliable);
  shoulderElev.reliable  = debounceReliable("shoulderElev",  shoulderElev.reliable);
  torsoFlex.reliable     = debounceReliable("torsoFlex",     torsoFlex.reliable);
  trunkRot.reliable      = debounceReliable("trunkRot",      trunkRot.reliable);
  rounded.reliable       = debounceReliable("rounded",       rounded._rawReliable ?? rounded.reliable);
  fhp.reliable           = debounceReliable("fhp",           fhp._rawReliable ?? fhp.reliable);
  elbow.reliable         = debounceReliable("elbow",         elbow._rawReliable ?? elbow.reliable);
  monitor.reliable       = debounceReliable("monitor",       monitor._rawReliable ?? monitor.reliable);

  // Smooth the numeric confidence too — see smoothConfidence() for why the
  // boolean debounce above isn't the whole story.
  neck.confidence     = Math.round(smoothConfidence("neck",     neck.confidence));
  rounded.confidence  = Math.round(smoothConfidence("rounded",  rounded.confidence));

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
  const W_fhp      = confWeight(fhp,      WEIGHTS_FRONT.fhp);
  const W_monitor  = confWeight(monitor,  WEIGHTS_FRONT.monitor);
  const W_shElev   = confWeight(shoulderElev, WEIGHTS_FRONT.shoulderElev);
  const W_elbow    = confWeight(elbow,     WEIGHTS_FRONT.elbow);
  const W_torso    = confWeight(torsoFlex, WEIGHTS_FRONT.torsoFlex);
  const W_twist    = confWeight(trunkRot,  WEIGHTS_FRONT.trunkRot);
  const W_dist     = WEIGHTS_FRONT.distance; // distance is always measured

  const W_ACTUAL = W_neck + W_tilt + W_shoulder + W_spine + W_dist + W_yaw + W_rounded + W_fhp + W_monitor + W_shElev + W_torso + W_twist + W_elbow;

  // True weighted average: divide by the weight actually used.
  //
  // This previously added `72 * (1 - W_ACTUAL)` instead of dividing — which is
  // not redistribution, it substitutes a constant 72 for every point of missing
  // weight, so it drags good posture down and props bad posture up. Three
  // modules that together carry 49% of the table (neck 0.2565, fhp 0.1656,
  // rounded 0.0679) go reliable:false the moment one ear is occluded — exactly
  // the hand-on-chin case this file detects elsewhere — so the effect was large
  // and trivially game-able: on a measured synthetic subject, a badly slumped
  // pose scored 52 with both ears visible and 78 with one ear hidden (+26),
  // while a textbook-perfect pose LOST 13 points for the same occlusion.
  //
  // The constant also capped the range: because confWeight scales each weight
  // by that module's confidence (72-90%), W_ACTUAL peaks near 0.90, so a
  // flawless pose could only ever reach 97 and the floor sat near 14.
  //
  // Dividing gives the weighted mean of whatever was actually measured, which
  // is what the comment above always claimed the code did.
  const weightedScore = W_ACTUAL > 0.05
    ? Math.max(0, Math.min(100, Math.round((
        neck.score     * W_neck     +
        headTilt.score * W_tilt     +
        shoulder.score * W_shoulder +
        spine.score    * W_spine    +
        distSc         * W_dist     +
        yaw.score      * W_yaw      +
        rounded.score  * W_rounded  +
        fhp.score      * W_fhp      +
        monitor.score  * W_monitor  +
        shoulderElev.score * W_shElev +
        torsoFlex.score * W_torso   +
        trunkRot.score  * W_twist   +
        elbow.score     * W_elbow
      ) / W_ACTUAL)))
    // Effectively nothing measurable this frame — report the distance channel
    // alone rather than inventing a number out of a constant.
    : Math.max(0, Math.min(100, Math.round(distSc)));

  // ── Positioning penalty ────────────────────────────────────────────
  // Distance carries only ~9.8% of the weighted score, and distanceScore()
  // floors at 30 — so even sitting on top of the lens could only move the
  // total by (100-30) × 0.0981 ≈ 6.9 points. In practice a user got told
  // "too close — back up" while the score barely moved, or (when distCm and
  // frame geometry disagreed) didn't move at all. That is not a weighting
  // subtlety, it's the headline number contradicting the instruction next to
  // it.
  //
  // Sitting too close is a real ergonomic problem in its own right — it drives
  // forward-head posture and eye strain — and it also degrades every other
  // reading on this frame, so the composite genuinely is less trustworthy.
  // Both argue for a visible, explainable deduction rather than a silent one.
  // Scaled by the same geometric severity, capped at 18 points so a marginal
  // over-step is a nudge, not a cliff.
  const positionPenalty = (!quality.ok && (quality.reason === "too_close" || quality.reason === "too_far"))
    ? Math.round(6 + 12 * (typeof quality.severity === "number" ? quality.severity : 1))
    : 0;

  // ── Occlusion penalty ──────────────────────────────────────────────
  // Resting your chin on your hand hides one ear, which makes neck lean,
  // forward-head and rounded-shoulders unmeasurable — 49% of the weight table.
  // Those are precisely the metrics that score badly when you're slumped, so
  // excluding them RAISES a bad-posture score: measured, a slumped pose went
  // from 72 to 83 purely by occluding an ear. The engine already detects this
  // (handProp.detected), already tells the user "resting your chin on your hand
  // hides real neck strain from being measured", and already lists it as a
  // detected condition — it just never charged anything for it, leaving a
  // straightforward way to game the number by adopting a bad habit.
  //
  // Scaled by how much weight was actually lost, so a brief occlusion that
  // still leaves most modules measurable costs little.
  const coverage       = Math.min(1, W_ACTUAL / 0.9);
  const occlusionPenalty = handProp.detected
    // 14 was still not enough: the modules that drop out are precisely the ones
    // scoring worst for a slumped user, so the surviving average rises steeply.
    // Sized so that covering an ear can no longer improve a bad-posture score.
    ? Math.round(26 * (1 - coverage))
    : 0;

  const overall = Math.max(0, weightedScore - positionPenalty - occlusionPenalty);

  // Mispositioning is charged twice — once by capping distSc (which makes the
  // distance metric reflect reality) and once by positionPenalty (the ergonomic
  // charge that makes the drop visible, since distance alone carries only ~9%).
  // Both are intended, but the UI labels the drop with this number, so it has
  // to be the TOTAL cost rather than just the second half of it.
  const distScLoss = Math.round((distScUncapped - distSc) * W_dist);
  const positionPenaltyTotal = positionPenalty + Math.max(0, distScLoss);

  // Detection confidence
  const g   = i => lms[i];
  const vis = i => (g(i)?.visibility ?? 0) >= VIS_MIN;
  const detectionConfidence = Math.min(94,
    78 +
    (vis(PL.L_SHOULDER) && vis(PL.R_SHOULDER) ? 10 : 0) +
    (vis(PL.L_EAR) ? 3 : 0) +
    (vis(PL.R_EAR) ? 3 : 0)
  );

  // ── Posture-drift penalty (replaces time-based fatigue) ───────────
  // Old model penalised users purely for working long hours — someone
  // with perfect posture at 3 hours got the same hit as someone slumping.
  // New model measures ACTUAL score degradation across the session:
  //   • Maintain a rolling buffer of the last 300 frames (~5 min at 1fps).
  //   • Compare the earliest 30 frames to the most recent 30 frames.
  //   • If posture has genuinely degraded, apply a proportional penalty
  //     (max 15 pts) that reflects real physical drift — not elapsed time.
  //   • Users who maintain or improve their posture get penalty = 0.
  const sessionMin = sessionStartMs
    ? Math.max(0, Math.round((Date.now() - sessionStartMs) / 60000))
    : 0;

  // The buffer is TIME-stamped, not frame-counted. It used to keep the last 300
  // entries with the comment "~5 min at 1fps" — but App.jsx throttles analysis
  // to ~20fps (a 50ms floor), so 300 frames is **15 seconds**, not 5 minutes.
  // Two consequences, both of which the user experiences as the score moving on
  // its own: a 2-second slouch was charged an extra 15 points on top of the
  // drop the posture itself already caused (a double penalty), and then, with
  // the user holding that exact same posture, the "early" window slid forward
  // past the slouch and the penalty evaporated — the number climbed ~15 points
  // with nothing changed. Keeping wall-clock time makes the window mean what
  // the comment says regardless of frame rate.
  const _nowMs = Date.now();
  if (!analyzeMP._scoreBuf) analyzeMP._scoreBuf = [];
  analyzeMP._scoreBuf.push({ t: _nowMs, v: overall });
  const DRIFT_WINDOW_MS = 5 * 60 * 1000;
  while (analyzeMP._scoreBuf.length && _nowMs - analyzeMP._scoreBuf[0].t > DRIFT_WINDOW_MS) {
    analyzeMP._scoreBuf.shift();
  }

  let fatiguePenalty = 0;
  const buf = analyzeMP._scoreBuf;
  // Compare the first vs the last 60 SECONDS of the window, rather than a fixed
  // frame count, so a momentary dip can't masquerade as session-long drift.
  if (buf.length >= 60 && sessionMin >= 10) {
    const t0 = buf[0].t, tN = buf[buf.length - 1].t;
    const SLICE_MS = 60 * 1000;
    // Only meaningful once the window actually spans a comparable stretch.
    if (tN - t0 >= 3 * SLICE_MS) {
      const earlySlice  = buf.filter(e => e.t <= t0 + SLICE_MS).map(e => e.v);
      const recentSlice = buf.filter(e => e.t >= tN - SLICE_MS).map(e => e.v);
      if (earlySlice.length >= 20 && recentSlice.length >= 20) {
        const earlyAvg  = earlySlice.reduce((a, b) => a + b, 0)  / earlySlice.length;
        const recentAvg = recentSlice.reduce((a, b) => a + b, 0) / recentSlice.length;
        const drift = Math.max(0, earlyAvg - recentAvg); // positive = degradation
        // Scale: 10pt drift → 5pt penalty, 20pt drift → 10pt, 30pt+ → 15pt cap
        fatiguePenalty = Math.round(Math.min(15, drift * 0.5));
      }
    }
  }

  // Alerts
  const alerts = buildAlerts({ neck, headTilt, shoulder, spine, fhp, rounded, yaw, elbow, monitor, shoulderElev, handProp, torsoFlex, trunkRot }, distCm, lo, hi);

  return {
    score:       overall,
    qualityScore,
    qualityReason,
    // How many points each adjustment removed, so the UI can explain the drop
    // ("−14 because you're too close") instead of the user seeing a number fall
    // for no stated reason.
    // Total points removed for being mispositioned (the ergonomic charge plus
    // the weighted loss from capping the distance metric), so the on-screen
    // "-N" beside the distance chip matches what actually left the score.
    positionPenalty: positionPenaltyTotal,
    occlusionPenalty,
    // Fraction of the weight table that was actually measurable this frame.
    // < 1 means part of the body wasn't visible and the score is a partial
    // reading — worth surfacing rather than presenting it as a full one.
    coverage: Math.round(coverage * 100) / 100,
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
      shoulderElev: { ...shoulderElev, label: "Shoulder Elevation" },
      handProp: { ...handProp, label: "Hand/Chin Prop Detected" },
      torsoFlex: { ...torsoFlex, label: "Forward Slouch" },
      trunkRot:  { ...trunkRot,  label: "Trunk Rotation" },
    },

    detectedConditions: [
      neck.severity     !== "normal" && { name: "Neck Lean",          severity: neck.severity,     value: `${neck.angle}°` },
      fhp.reliable      !== false   && fhp.severity !== "normal"    && { name: "Forward Head",       severity: fhp.severity,      value: `${fhp.distCm}cm` },
      headTilt.severity !== "normal" && { name: "Head Tilt",          severity: headTilt.severity, value: `${headTilt.angle}°` },
      shoulder.severity !== "normal" && { name: "Shoulder Imbalance", severity: shoulder.severity, value: `${shoulder.angle}°` },
      rounded.severity  !== "normal" && { name: "Rounded Shoulders",  severity: rounded.severity,  value: rounded.depth },
      spine.severity    !== "normal" && spine.reliable && { name: "Spine Lean", severity: spine.severity, value: `${spine.angle}°` },
      shoulderElev.severity !== "normal" && shoulderElev.reliable && { name: "Shoulder Elevation", severity: shoulderElev.severity, value: `${shoulderElev.elevPct}%` },
      monitor.severity  !== "normal" && monitor.reliable && { name: "Monitor/Gaze Angle", severity: monitor.severity, value: `${monitor.pitchDeg}°` },
      handProp.detected && { name: "Hand/Chin Prop", severity: "mild", value: "detected" },
      torsoFlex.reliable && torsoFlex.severity !== "normal" && { name: "Forward Slouch",   severity: torsoFlex.severity, value: `${torsoFlex.shrinkPct}%` },
      trunkRot.reliable  && trunkRot.severity  !== "normal" && { name: "Trunk Rotation",   severity: trunkRot.severity,  value: `${trunkRot.angle}°` },
    ].filter(Boolean),

    // Legacy metrics shape (backward-compatible with App.jsx/overlays)
    metrics: {
      neck_lean:         { value: neck.angle,       score: neck.score,     unit: "°",  label: "Neck lean",           reliable: neck.reliable },
      head_tilt:         { value: headTilt.angle,   score: headTilt.score, unit: "°",  label: "Head tilt",           reliable: headTilt.reliable },
      shoulder_level:    { value: shoulder.angle,   score: shoulder.score, unit: "°",  label: "Shoulder level",      reliable: shoulder.reliable, signed: shoulder.signedAngle },
      spine_lean:        { value: spine.angle,      score: spine.score,    unit: "°",  label: "Spine lean",          reliable: spine.reliable, signed: spine.signedAngle },
      head_yaw:          { value: yaw.angle,        score: yaw.score,      unit: "°",  label: "Head turn",           reliable: yaw.reliable },
      screen_distance:   { value: distCm,           score: distSc,         unit: "cm", label: "Screen distance",     calibrated: !!(distCalibFactor && distCalibFactor > 0) },
      fhp_index:         { value: fhp.distCm,       score: fhp.score,      unit: "cm", label: "Forward head posture",extra_load_kg: fhp.extraLoadKg, reliable: fhp.reliable },
      rounded_shoulders: { value: rounded.depth,    score: rounded.score,  unit: "depth", label: "Rounded shoulders",asymmetry: rounded.asymmetry, reliable: rounded.reliable },
      torso_flexion:     { value: torsoFlex.shrinkPct, score: torsoFlex.score, unit: "%",  label: "Forward slouch",   reliable: torsoFlex.reliable },
      trunk_rotation:    { value: trunkRot.angle,      score: trunkRot.score,  unit: "°",  label: "Trunk rotation",   reliable: trunkRot.reliable },
      shoulder_elevation:{ value: shoulderElev.elevPct, score: shoulderElev.score, unit: "%", label: "Shoulder elevation (shrug)", reliable: shoulderElev.reliable },
      elbow_angle:       { value: elbow.angle,      score: elbow.score,    unit: "°",  label: "Elbow angle",         reliable: elbow.reliable },
      monitor_height:    { value: monitor.offsetCm, score: monitor.score,  unit: "cm", label: "Monitor height offset",direction: monitor.direction, reliable: monitor.reliable },
      session_fatigue:   { value: fatiguePenalty,   score: Math.max(0, overall - fatiguePenalty), unit: "pts", label: "Fatigue adjustment", session_min: sessionMin },
      position_penalty:  { value: positionPenalty,  score: Math.max(0, 100 - positionPenalty),    unit: "pts", label: "Positioning adjustment", reason: qualityReason },
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
    personalised: !!(calib?.tolerances) && (neck.personalised || shoulder.personalised || headTilt.personalised || spine.personalised || rounded.personalised),
  };
}

// ═══════════════════════════════════════════════════════════════════
// SIDE CAMERA ANALYSIS
// ═══════════════════════════════════════════════════════════════════

// analyzeSideMP() removed — Side mode removed app-wide, no remaining callers.


// ═══════════════════════════════════════════════════════════════════
// MODE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════

export const MODES = {
  laptop: { label: "Laptop Camera", labelAr: "كاميرا اللابتوب", icon: "💻", distRange: [50, 80] },
  // Phone and Side modes removed app-wide.
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
