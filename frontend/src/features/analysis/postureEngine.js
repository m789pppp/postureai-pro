/**
 * Corvus — Posture Analysis Engine v2
 * ✅ Strict thresholds (tighter ok/bad windows)
 * ✅ Head yaw detection (left/right turn) from front camera
 * ✅ Distance estimation via eye IPD (more accurate than shoulder width)
 * ✅ Proximity alert zone tightened
 */

// ── MediaPipe Landmark indices ────────────────────────────────────
export const PL = {
  NOSE: 0, L_EYE_INNER: 1, L_EYE: 2, L_EYE_OUTER: 3,
  R_EYE_INNER: 4, R_EYE: 5, R_EYE_OUTER: 6,
  L_EAR: 7, R_EAR: 8,
  L_SHOULDER: 11, R_SHOULDER: 12,
  L_ELBOW: 13, R_ELBOW: 14,
  L_WRIST: 15, R_WRIST: 16,
  L_HIP: 23, R_HIP: 24,
  L_KNEE: 25, R_KNEE: 26,
  L_ANKLE: 27, R_ANKLE: 28,
};

// ── Geometry ──────────────────────────────────────────────────────
export function angleVert(p1, p2) {
  const dx = Math.abs(p2.x - p1.x), dy = Math.abs(p2.y - p1.y);
  return dy < 0.001 ? 90 : Math.abs(Math.atan2(dx, dy) * 180 / Math.PI);
}

export function angleHoriz(p1, p2) {
  const dx = Math.abs(p2.x - p1.x), dy = Math.abs(p2.y - p1.y);
  return dx < 0.001 ? 90 : Math.abs(Math.atan2(dy, dx) * 180 / Math.PI);
}

export function angle3pt(a, b, c) {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const n1 = Math.sqrt(v1.x ** 2 + v1.y ** 2);
  const n2 = Math.sqrt(v2.x ** 2 + v2.y ** 2);
  if (n1 < 0.001 || n2 < 0.001) return 90;
  const cos = (v1.x * v2.x + v1.y * v2.y) / (n1 * n2);
  return Math.round(Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI);
}

// ── Score formula ─────────────────────────────────────────────────
// scoreMetric — mirrors backend score_m() exactly (same formula, same constants)
// d<=ok: 100→75 | d<=bad: 75→30 | d>bad: 30→0
// Any change here MUST be mirrored in backend.py score_m()
export function scoreMetric(v, ideal, ok, bad) {
  const d = Math.abs(v - ideal);
  if (d <= ok)  return Math.max(0, Math.trunc(100 - (d / Math.max(ok, 0.1)) * 25));
  if (d <= bad) return Math.max(0, Math.trunc(75  - ((d - ok) / Math.max(bad - ok, 0.1)) * 45));
  // Beyond bad: quadratic decay → floor 5 (mirrors backend score_m exactly)
  // Small extra deviations are forgiven; large ones hit 5 fast.
  // MSK injury risk is non-linear — quadratic reflects that.
  const excess = d - bad;
  const decay  = Math.min(25, Math.pow(excess, 1.6) * 0.9);
  return Math.max(5, Math.trunc(30 - decay));
}

// ── Grade helpers ─────────────────────────────────────────────────
export function gradeScore(s)   { return s >= 85 ? "Excellent" : s >= 70 ? "Good" : s >= 50 ? "Fair" : "Poor"; }
export function gradeScoreAr(s) { return s >= 85 ? "ممتاز"     : s >= 70 ? "جيد"  : s >= 50 ? "مقبول" : "ضعيف"; }
export function scoreColor(s)   { return s >= 75 ? "#10b981"   : s >= 50 ? "#f59e0b" : "#ef4444"; }

// ── Landmark temporal smoothing (EMA) ──────────────────────────────
// MediaPipe landmarks jitter frame-to-frame even when the person is
// perfectly still — this caused every downstream metric (neck lean,
// head tilt, yaw, distance) to flicker and occasionally fire a wrong
// alert cause. Smoothing the raw (x,y,z) landmarks BEFORE geometry is
// computed fixes all of those metrics at once, with zero changes to
// the score formula/thresholds (so backend.py stays in sync).
//
// Low-visibility landmarks (occluded ear, turned-away face, etc.) are
// blended in more slowly so a single bad detection can't yank a
// metric off — the smoother leans on recent history instead.
//
// Outlier rejection: a single-frame jump faster than any plausible
// human movement (given the actual elapsed time between frames) is
// treated as a tracking glitch — EMA alone still partially absorbs an
// outlier into the average, this rejects it outright and holds the
// previous position instead. If the "implausible" jump persists for
// several consecutive frames, it's accepted as a real fast movement
// (e.g. a quick head turn) rather than being ignored forever.
//
// Usage: const smoother = createLandmarkSmoother(); ...
//        const lms = smoother.smooth(rawLandmarksFromMediaPipe);
//        smoother.reset() on camera start/stop/mode change.
export function createLandmarkSmoother(alpha = 0.4, maxRejectStreak = 3) {
  let prev = null;
  let rejectStreak = null;
  let lastT = null;
  const MAX_VEL = 3.0;          // normalized units/sec — generous bound for legit human motion
  const MAX_REJECT_STREAK = maxRejectStreak;  // accept the jump anyway after this many consecutive flagged frames

  return {
    smooth(lms) {
      if (!lms || !lms.length) return lms;
      const now = (typeof performance !== "undefined") ? performance.now() : Date.now();
      const dt  = lastT ? Math.min(0.5, Math.max(0.001, (now - lastT) / 1000)) : 1 / 30;
      lastT = now;

      if (!prev || prev.length !== lms.length) {
        prev = lms.map(p => ({ x: p.x, y: p.y, z: p.z, visibility: p.visibility }));
        rejectStreak = new Array(lms.length).fill(0);
        return prev;
      }
      const maxDist = MAX_VEL * dt;
      const out = new Array(lms.length);
      for (let i = 0; i < lms.length; i++) {
        const c = lms[i], p = prev[i];
        const dxJump = c.x - p.x, dyJump = c.y - p.y;
        const jump = Math.sqrt(dxJump * dxJump + dyJump * dyJump);

        if (jump > maxDist && rejectStreak[i] < MAX_REJECT_STREAK) {
          // Implausible single-frame jump — most likely a detection
          // glitch. Hold the previous smoothed position this frame
          // instead of letting a bad read yank the metric off.
          rejectStreak[i]++;
          out[i] = { ...p };
          continue;
        }
        // Either a plausible move, or it's persisted long enough to be
        // a real fast movement (not a glitch) — accept it.
        rejectStreak[i] = 0;
        const vis = c.visibility ?? 1;
        // Low-confidence landmark this frame → trust history more, raw value less
        const a = vis < 0.5 ? alpha * 0.4 : alpha;
        out[i] = {
          x: p.x + a * (c.x - p.x),
          y: p.y + a * (c.y - p.y),
          z: (c.z != null && p.z != null) ? p.z + a * (c.z - p.z) : c.z,
          visibility: c.visibility,
        };
      }
      prev = out;
      return out;
    },
    reset() { prev = null; rejectStreak = null; lastT = null; },
  };
}

// ── Head yaw estimation (front camera) ───────────────────────────
// Uses ratio of visible ear widths — if person turns right, left ear shrinks
// Returns yaw in degrees: + = turned right, - = turned left, 0 = straight
function estimateHeadYaw(lms, W, H) {
  try {
    const g  = idx => lms[idx];
    const lEar = { x: g(PL.L_EAR).x * W, y: g(PL.L_EAR).y * H };
    const rEar = { x: g(PL.R_EAR).x * W, y: g(PL.R_EAR).y * H };
    const lEye = { x: g(PL.L_EYE).x * W, y: g(PL.L_EYE).y * H };
    const rEye = { x: g(PL.R_EYE).x * W, y: g(PL.R_EYE).y * H };
    const nose = { x: g(PL.NOSE).x * W,   y: g(PL.NOSE).y * H };

    // Eye midpoint
    const eyeMid = { x: (lEye.x + rEye.x) / 2, y: (lEye.y + rEye.y) / 2 };
    const eyeWidth = Math.abs(rEye.x - lEye.x);
    if (eyeWidth < 2) return 0;

    // Nose offset from eye center (normalized to eye width)
    // Positive = nose shifted right → head turned right
    const noseOffset = (nose.x - eyeMid.x) / eyeWidth;
    // Scale: ~0.5 nose offset ≈ 30° yaw. Clamp to ±45°
    const yaw = Math.max(-45, Math.min(45, Math.round(noseOffset * 60)));

    // Cross-check with ear visibility ratio
    const lEarVis = g(PL.L_EAR)?.visibility || 0;
    const rEarVis = g(PL.R_EAR)?.visibility || 0;
    if (lEarVis > 0.3 && rEarVis > 0.3) {
      // Ear-to-ear pixel distance ratio (symmetric face = equal)
      const earDist = Math.abs(rEar.x - lEar.x);
      const lEarToNose = Math.abs(nose.x - lEar.x);
      const rEarToNose = Math.abs(nose.x - rEar.x);
      // If face symmetric: ratio ~= 1. If turned: one side much smaller
      const ratio = lEarToNose / Math.max(rEarToNose, 1);
      // ratio > 1.3 = turned right, < 0.7 = turned left
      if (ratio > 1.3) return Math.min(45, Math.abs(yaw));
      if (ratio < 0.7) return Math.max(-45, -Math.abs(yaw));
    }

    return yaw;
  } catch { return 0; }
}

// ── Distance estimation v2 (IPD-based, more accurate) ────────────
// Average adult IPD ≈ 63mm. Focal length calibrated to 720p.
// Falls back to shoulder width if eyes not visible.
// yawDeg corrects for foreshortening: when the head is turned, the
// projected eye-to-eye width shrinks even at constant distance, which
// previously read as "moved closer" and fired false proximity alerts
// during normal side glances.
// calibFactor (optional): from a one-time personal calibration —
// knownDistanceCm * ipdFraction measured while sitting at a known,
// user-confirmed distance. distCm = calibFactor / currentIpdFraction.
// This absorbs BOTH the user's actual IPD (varies ~54-72mm across
// adults — population average 63mm can be off by ±15%) AND this
// specific camera's actual focal length/FOV into one measured
// constant, instead of assuming generic population averages for
// both. Falls back to the generic formula when no calibration exists.
function estimateDistanceCm(lms, W, H, yawDeg = 0, calibFactor = null) {
  try {
    const g = idx => lms[idx];
    const lEye = { x: g(PL.L_EYE).x * W };
    const rEye = { x: g(PL.R_EYE).x * W };
    const lEyeVis = g(PL.L_EYE)?.visibility || 0;
    const rEyeVis = g(PL.R_EYE)?.visibility || 0;

    if (lEyeVis > 0.5 && rEyeVis > 0.5) {
      let ipdPx = Math.abs(rEye.x - lEye.x);
      // Undo foreshortening, clamp correction to avoid blow-up at extreme yaw
      const yawRad = Math.min(50, Math.abs(yawDeg)) * Math.PI / 180;
      const cosYaw = Math.max(Math.cos(yawRad), 0.55); // cap ~1.8x correction
      ipdPx = ipdPx / cosYaw;
      if (ipdPx > 4) {
        if (calibFactor && calibFactor > 0) {
          const ipdFrac = ipdPx / Math.max(W, 1);
          return Math.max(20, Math.min(160, Math.round(calibFactor / ipdFrac)));
        }
        // focal_px at 720p ≈ 800; IPD_real ≈ 6.3cm
        const focal = 800 * (W / 1280);
        const distCm = Math.round((6.3 * focal) / ipdPx);
        return Math.max(20, Math.min(160, distCm));
      }
    }

    // Fallback: shoulder width (less accurate)
    const lSh = { x: g(PL.L_SHOULDER).x * W };
    const rSh = { x: g(PL.R_SHOULDER).x * W };
    const shW = Math.abs(rSh.x - lSh.x);
    if (shW > 5) {
      const focal = 600 * (W / 640);
      const distCm = Math.round((40 * focal) / shW);
      return Math.max(20, Math.min(160, distCm));
    }

    return 65; // default
  } catch { return 65; }
}

// ── STRICT THRESHOLDS ─────────────────────────────────────────────
// ok  = deviation where score stays near 100 (tight green zone)
// bad = deviation where score hits ~30 (red zone begins)
// ── THRESHOLDS — synced exactly with backend.py ────────────────────
// Any change here MUST be mirrored in backend.py score_m calls
const T = {
  // Front analysis (matches backend analyze_front)
  neckLean:  { ok: 7,  bad: 20 },   // superseded in analyzeMP() by shoulder-width-adjusted neckOkAdj/neckBadAdj; kept as fallback reference
  headTilt:  { ok: 3,  bad: 10 },   // backend: score_m(head_tilt, 0, 3, 10)
  shTilt:    { ok: 3,  bad: 10 },   // backend: score_m(sh_tilt,   0, 3, 10)
  spineLean: { ok: 5,  bad: 15 },   // backend: score_m(spine_lean,0, 5, 15)

  // Side analysis (matches backend analyze_side)
  neckLeanSide: { ok: 8,  bad: 22 },
  trunkLean:    { ok: 5,  bad: 16 },
};

// ── Distance score (strict) ───────────────────────────────────────
// distanceScore — SYNCED with backend.py dist_sc logic exactly
function distanceScore(distCm, lo, hi) {
  if (distCm >= lo && distCm <= hi)                       return 100;
  if (distCm >= lo - 8  && distCm <= hi + 12)             return 80;
  if (distCm >= lo - 16 && distCm <= hi + 20)             return 55;
  return 30;
}

// ── Front-camera analysis ─────────────────────────────────────────
export function analyzeMP(lms, W, H, mode, distCalibFactor = null) {
  if (!lms || lms.length < 25) return null;
  const g   = idx => lms[idx];
  const px  = idx => ({ x: g(idx).x * W, y: g(idx).y * H });
  const vis = idx => (g(idx)?.visibility || 0) > 0.45;

  const nose  = px(PL.NOSE);
  const lSh   = px(PL.L_SHOULDER), rSh  = px(PL.R_SHOULDER);
  const lEar  = px(PL.L_EAR),      rEar = px(PL.R_EAR);
  const lEye  = px(PL.L_EYE),      rEye = px(PL.R_EYE);
  const lHip  = px(PL.L_HIP),      rHip = px(PL.R_HIP);

  const midSh  = { x: (lSh.x + rSh.x) / 2, y: (lSh.y + rSh.y) / 2 };
  const midEar = { x: (lEar.x + rEar.x) / 2, y: (lEar.y + rEar.y) / 2 };
  const midHip = { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2 };

  // ── Neck lean: nose+ear blend (ported from backend.py's fix) ────
  // Ear-only reference is biased by head yaw: turning the head shifts
  // the ear sideways relative to the shoulder and reads as "more
  // forward lean" even with perfect posture. Nose→shoulder measures
  // true forward head displacement and isn't fooled by yaw. Stays
  // ear-weighted when the nose itself isn't reliably visible.
  const noseVis    = g(PL.NOSE)?.visibility ?? 1;
  const earWeight  = noseVis > 0.7 ? 0.15 : 0.50;
  const noseWeight = 1 - earWeight;
  const neckRef = {
    x: nose.x * noseWeight + midEar.x * earWeight,
    y: nose.y * noseWeight + midEar.y * earWeight,
  };
  const neckLeanRaw    = angleVert(midSh, neckRef);
  const noseCorrection = 5.0 * noseWeight; // nose sits ~10cm ahead of the ear plane
  const neckLean = Math.max(0, neckLeanRaw - noseCorrection);

  const headTilt  = angleHoriz(lEye, rEye);
  const shTilt    = angleHoriz(lSh, rSh);
  const spineLean = angleVert(midHip, midSh);

  // Head yaw (new)
  const headYaw = estimateHeadYaw(lms, W, H);

  // Distance (IPD-based)
  const distCm = estimateDistanceCm(lms, W, H, headYaw, distCalibFactor);
  const lo = mode === "laptop" ? 50 : 60;
  const hi = mode === "laptop" ? 80 : 90;
  const distSc = distanceScore(distCm, lo, hi);

  // ── Neck threshold normalization by apparent shoulder width ─────
  // A fixed degree threshold is too strict when sitting close to the
  // camera (shoulders fill more of the frame → angles read larger for
  // the same real lean) and too loose far away. Matches backend.py.
  const shWidthPx = Math.abs(rSh.x - lSh.x);
  const refShFrac = 0.34;
  const shFrac    = shWidthPx / Math.max(W, 1);
  const shRatio   = Math.max(0.70, Math.min(1.30, shFrac / refShFrac));
  const neckOkAdj  = Math.max(5.0, 6.0  * shRatio);
  const neckBadAdj = Math.max(12.0, 17.0 * shRatio);

  // ── Confidence gating ─────────────────────────────────────────
  // If the landmarks a metric depends on aren't reliably visible
  // (occluded ear, bad lighting, extreme angle), trust the geometry
  // less: fall back to a neutral score instead of computing a metric
  // off noisy/garbage positions and risking a false "bad posture"
  // read. Frontend-only robustness layer — does not change score_m()
  // itself, so backend.py stays in sync for well-tracked frames.
  const NEUTRAL = 90;
  const shOK  = vis(PL.L_SHOULDER) && vis(PL.R_SHOULDER);
  const earOK = vis(PL.L_EAR) && vis(PL.R_EAR);
  const eyeOK = vis(PL.L_EYE) && vis(PL.R_EYE);
  const hipOK = vis(PL.L_HIP) && vis(PL.R_HIP);
  const neckOK  = shOK && earOK;
  const spineOK = shOK && hipOK;

  // Scores — strict thresholds (neck now uses shoulder-width-adjusted thresholds)
  const neckSc  = neckOK  ? scoreMetric(neckLean,  0, neckOkAdj,     neckBadAdj)    : NEUTRAL;
  const tiltSc  = eyeOK   ? scoreMetric(headTilt,  0, T.headTilt.ok, T.headTilt.bad): NEUTRAL;
  const shSc    = shOK    ? scoreMetric(shTilt,    0, T.shTilt.ok,   T.shTilt.bad)  : NEUTRAL;

  // Yaw score: ok ≤ 8°, bad ≥ 20°
  const yawSc = eyeOK ? scoreMetric(Math.abs(headYaw), 0, 8, 20) : NEUTRAL;

  // ── Forward Head Posture index (cm) — ported from backend.py ────
  // Converts the ear→shoulder pixel offset to real-world cm using
  // shoulder width as a reference scale. More clinically readable
  // than a bare degree number. Informational — not in the weighted
  // overall score (would double-count with neck_lean above).
  const shWidthCm   = 42.0;
  const cmPerPx     = shWidthCm / Math.max(shWidthPx, 1);
  const fhpCm       = Math.round(Math.abs(midEar.x - midSh.x) * cmPerPx * 10) / 10;
  const extraLoadKg = Math.round((fhpCm / 2.5) * 4.5 * 10) / 10;
  const fhpSc       = neckOK ? scoreMetric(fhpCm, 0, 2, 6) : NEUTRAL;

  // ── Rounded shoulders (protraction) via Z-depth — ported from backend.py ──
  // MediaPipe Z: more negative = closer to camera (in front of body).
  // Rounded/hunched shoulders push both shoulders forward (toward the
  // camera) relative to the torso. Uses the Pose landmark Z directly —
  // no FaceMesh/solvePnP needed. Only needs shoulders (not hips), which
  // is exactly why this doubles as the spine_lean fallback below: when
  // leaning in close to a laptop camera, the hips are usually the first
  // thing to leave the frame, but the shoulders stay visible.
  const lShZ = g(PL.L_SHOULDER)?.z ?? 0;
  const rShZ = g(PL.R_SHOULDER)?.z ?? 0;
  const shZAvg       = (lShZ + rShZ) / 2;
  const shZAsym      = Math.abs(lShZ - rShZ);
  const roundedDepth = Math.max(0, -shZAvg * 100);
  const roundedSc    = shOK ? scoreMetric(roundedDepth, 0, 8, 20) : NEUTRAL;

  // spine_lean: when hips aren't visible (very common when leaning close
  // to a laptop camera — narrow FOV pushes hips out of frame first), fall
  // back to the rounded-shoulders Z-depth score instead of a blind
  // neutral. Leaning + hunching forward toward the screen is exactly the
  // scenario rounded_shoulders is built to catch, and it only needs
  // shoulders. Without this, that exact posture used to score as "fine"
  // the moment the hips dropped out of frame.
  const spineSc = spineOK ? scoreMetric(spineLean, 0, T.spineLean.ok, T.spineLean.bad)
                : shOK     ? roundedSc
                : NEUTRAL;

  // Weights — synced with backend.py for neck/tilt/shoulder/spine/dist/yaw;
  // rounded_shoulders weight is a frontend-only addition (backend keeps it
  // informational-only) specifically to catch "leaning in + hunching
  // toward the screen", which previously didn't move the score at all.
  const W_NECK = 0.28, W_TILT = 0.10, W_SH = 0.11, W_SPINE = 0.14, W_DIST = 0.18, W_YAW = 0.06, W_ROUNDED = 0.08;
  const wSum   = W_NECK + W_TILT + W_SH + W_SPINE + W_DIST + W_YAW + W_ROUNDED; // 0.95
  const baseline = 72 * (1.0 - wSum);  // same 72-baseline approach as backend

  const overall = Math.max(0, Math.min(100, Math.round(
    neckSc    * W_NECK  +
    tiltSc    * W_TILT  +
    shSc      * W_SH    +
    spineSc   * W_SPINE +
    distSc    * W_DIST  +
    yawSc     * W_YAW   +
    roundedSc * W_ROUNDED +
    baseline
  )));

  // ── Elbow ergonomics (RSI indicator) ────────────────────────────
  // Measures elbow flexion from shoulder→elbow→wrist angle.
  // Ideal: 90-100° for keyboard use. <70° = too high (shoulder strain).
  // >120° = too low (reaches down, causes forearm/wrist deviation).
  // Informational only — not in weighted score (needs visible wrists,
  // which are outside frame for most laptop setups).
  const lElbow = px(PL.L_ELBOW), rElbow = px(PL.R_ELBOW);
  const lWrist = px(PL.L_WRIST), rWrist = px(PL.R_WRIST);
  const lElbOK = vis(PL.L_ELBOW) && vis(PL.L_WRIST) && vis(PL.L_SHOULDER);
  const rElbOK = vis(PL.R_ELBOW) && vis(PL.R_WRIST) && vis(PL.R_SHOULDER);
  let elbowAngle = null, elbowReliable = false;
  if (lElbOK || rElbOK) {
    const calcElbow = (sh, el, wr) => {
      const v1 = { x: sh.x - el.x, y: sh.y - el.y };
      const v2 = { x: wr.x - el.x, y: wr.y - el.y };
      const dot = v1.x*v2.x + v1.y*v2.y;
      const mag = Math.sqrt(v1.x*v1.x+v1.y*v1.y) * Math.sqrt(v2.x*v2.x+v2.y*v2.y);
      return mag > 0 ? Math.round(Math.acos(Math.min(1,Math.max(-1,dot/mag))) * 180 / Math.PI) : null;
    };
    const lAng = lElbOK ? calcElbow(lSh, lElbow, lWrist) : null;
    const rAng = rElbOK ? calcElbow(rSh, rElbow, rWrist) : null;
    if (lAng != null && rAng != null) elbowAngle = Math.round((lAng + rAng) / 2);
    else elbowAngle = lAng ?? rAng;
    elbowReliable = true;
  }
  const elbowSc = elbowAngle != null
    ? scoreMetric(Math.abs(elbowAngle - 95), 0, 15, 30) // ideal ~95°, ok ±15°, bad ±30°
    : NEUTRAL;

  // ── #1  Monitor Height Offset ─────────────────────────────────
  // Estimates whether the monitor is above or below eye level using
  // the vertical angle from the nose tip to the eye midpoint (head
  // pitch proxy). No FaceMesh needed — the nose sits ~3-4cm below
  // the eye axis; when the head tilts down to look at a low monitor,
  // the nose drops below the eye midpoint by more than its natural
  // offset. Converts the pitch angle + current distCm to cm offset.
  let monitorOffsetCm = 0, monitorDir = "ok", monitorSc = NEUTRAL;
  if (eyeOK) {
    const eyeMidY  = (lEye.y + rEye.y) / 2;
    const eyeWidth = Math.abs(rEye.x - lEye.x);
    // Vertical nose offset as fraction of eye width (normalized, distance-independent)
    const noseDropFrac = (nose.y - eyeMidY) / Math.max(eyeWidth, 1);
    // At neutral gaze noseDropFrac ≈ 0.55-0.70. Deviation from that indicates pitch.
    const NEUTRAL_FRAC = 0.62;
    const pitchProxy = (noseDropFrac - NEUTRAL_FRAC) * 90; // ~degrees
    const pitchDeg = Math.round(pitchProxy * 10) / 10;
    if (Math.abs(pitchDeg) > 2 && distCm > 20) {
      monitorOffsetCm = Math.round(distCm * Math.tan(Math.abs(pitchDeg) * Math.PI / 180) * 10) / 10;
      monitorDir = pitchDeg > 0 ? "below" : "above"; // nose drops = looking down = monitor below
    }
    monitorSc = scoreMetric(Math.abs(pitchDeg), 0, 5, 18);
  }

  // ── #3  Session Fatigue Score Adjustment ─────────────────────
  // After 90+ minutes the body's postural endurance decreases —
  // a score of 70 at 30 minutes represents different effort than
  // 70 at 2 hours. Multiply fatigue as an informational field; the
  // weighted overall score is NOT adjusted (would cause confusion).
  // Instead, expose this as a separate metric the UI can display.
  const sessionMinutes = typeof performance !== "undefined"
    ? Math.round(performance.now() / 60000) : 0;
  const fatiguePenalty = sessionMinutes > 90 ? Math.min(15, Math.round((sessionMinutes - 90) / 10)) : 0;
  const fatigueAdjScore = Math.max(0, overall - fatiguePenalty);

  // ── #6  Confidence (expose as metric) ────────────────────────
  const detectionConfidence = Math.min(94,
    78 +
    (vis(PL.L_SHOULDER) && vis(PL.R_SHOULDER) ? 10 : 0) +
    (vis(PL.L_EAR) ? 3 : 0) +
    (vis(PL.R_EAR) ? 3 : 0)
  );

  // ── #7  Alert deduplication — dedupe by cause code ───────────
  // Same alert can fire from multiple metrics (neck_lean AND fhp_index
  // both say "raise monitor"). Track by cause key within this frame.
  const alertsSeen = new Set();
  const dedupeAlert = (key, text) => {
    if (!text || alertsSeen.has(key)) return false;
    alertsSeen.add(key); return text;
  };

  const alerts = [
    dedupeAlert("neck_sev",   neckOK && neckLean > neckBadAdj && `⚠️ Severe neck lean ${Math.round(neckLean)}° — raise monitor to eye level immediately`),
    dedupeAlert("neck_mid",   neckOK && neckLean > (neckOkAdj+neckBadAdj)/2 && neckLean <= neckBadAdj && `Neck lean ${Math.round(neckLean)}° — tuck chin slightly and check monitor height`),
    dedupeAlert("head_tilt",  eyeOK && headTilt > 10   && `Head tilting ${Math.round(headTilt)}° — check chair height and monitor centering`),
    dedupeAlert("sh_tilt",    shOK && shTilt > 10     && `Shoulder imbalance ${Math.round(shTilt)}° — adjust armrests`),
    dedupeAlert("spine_sev",  spineOK && spineLean > 18  && `⚠️ Spine lean ${Math.round(spineLean)}° — sit back and use lumbar support`),
    dedupeAlert("spine_mid",  spineOK && spineLean > 10 && spineLean <= 18 && `Spine lean ${Math.round(spineLean)}° — engage your core and sit upright`),
    dedupeAlert("yaw",        eyeOK && Math.abs(headYaw) > 18 && `Head turned ${Math.abs(Math.round(headYaw))}° ${headYaw > 0 ? "right" : "left"} — face monitor directly`),
    dedupeAlert("dist_close_sev", distCm < lo - 10 && `⚠️ Very close to screen (${distCm}cm) — move back to ${lo}–${hi}cm`),
    dedupeAlert("dist_close",     distCm < lo && distCm >= lo - 10 && `Too close to screen (${distCm}cm) — move back to ${lo}–${hi}cm`),
    dedupeAlert("dist_far",       distCm > hi + 15 && `Too far from screen (${distCm}cm) — ideal is ${lo}–${hi}cm`),
    dedupeAlert("fhp_sev",   neckOK && fhpCm > 6 && `⚠️ Forward head posture ${fhpCm}cm (+${extraLoadKg}kg neck load) — critical: raise monitor immediately`),
    dedupeAlert("fhp_mid",   neckOK && fhpCm > 3 && fhpCm <= 6 && `Forward head posture ${fhpCm}cm (+${extraLoadKg}kg neck load) — tuck chin back`),
    dedupeAlert("rounded_sev", shOK && roundedDepth > 15 && `⚠️ Rounded shoulders detected — pull shoulder blades together and down`),
    dedupeAlert("rounded_mid", shOK && roundedDepth > 8 && roundedDepth <= 15 && `Shoulders slightly forward — open chest, squeeze shoulder blades gently`),
    dedupeAlert("elbow_hi",  elbowReliable && elbowAngle != null && elbowAngle < 70 && `⚠️ Elbows too high (${elbowAngle}°) — lower keyboard or raise chair`),
    dedupeAlert("elbow_lo",  elbowReliable && elbowAngle != null && elbowAngle > 125 && `Elbows too low (${elbowAngle}°) — raise keyboard or desk height`),
    dedupeAlert("monitor_low",  eyeOK && monitorDir === "below" && monitorOffsetCm > 5 && `Monitor ~${monitorOffsetCm}cm below eye level — raise it to reduce neck flexion`),
    dedupeAlert("monitor_high", eyeOK && monitorDir === "above" && monitorOffsetCm > 5 && `Monitor ~${monitorOffsetCm}cm above eye level — lower it to reduce neck extension`),
  ].filter(Boolean);

  return {
    score: overall,
    metrics: {
      neck_lean:        { value: Math.round(neckLean),  score: neckSc,    unit: "°",     label: "Neck lean",                reliable: neckOK },
      head_tilt:        { value: Math.round(headTilt),  score: tiltSc,    unit: "°",     label: "Head tilt",                reliable: eyeOK },
      shoulder_level:   { value: Math.round(shTilt),    score: shSc,      unit: "°",     label: "Shoulder level",           reliable: shOK, signed: Math.round(((rSh.y-lSh.y)>0?shTilt:-shTilt)*10)/10 },
      spine_lean:       { value: Math.round(spineLean), score: spineSc,   unit: "°",     label: "Spine lean",               reliable: spineOK },
      head_yaw:         { value: Math.round(headYaw),   score: yawSc,     unit: "°",     label: "Head turn",                reliable: eyeOK },
      screen_distance:  { value: distCm,                score: distSc,    unit: "cm",    label: "Screen distance",          calibrated: !!(distCalibFactor && distCalibFactor>0) },
      fhp_index:        { value: fhpCm,                 score: fhpSc,     unit: "cm",    label: "Forward head posture",     extra_load_kg: extraLoadKg, reliable: neckOK },
      rounded_shoulders:{ value: Math.round(roundedDepth*10)/10, score: roundedSc, unit: "depth", label: "Rounded shoulders", asymmetry: Math.round(shZAsym*1000)/1000, reliable: shOK },
      elbow_angle:      { value: elbowAngle,            score: elbowSc,   unit: "°",     label: "Elbow angle",              reliable: elbowReliable },
      monitor_height:   { value: monitorOffsetCm,       score: monitorSc, unit: "cm",    label: "Monitor height offset",    direction: monitorDir, reliable: eyeOK },
      session_fatigue:  { value: fatiguePenalty,        score: fatigueAdjScore, unit: "pts", label: "Fatigue adjustment",  session_min: sessionMinutes },
      confidence_val:   { value: detectionConfidence,   score: detectionConfidence, unit: "%", label: "Detection confidence" },
    },
    alerts,
    recommendations: [
      `Overall: ${gradeScore(overall)} (${overall}/100)`,
      `Screen distance: ${distCm >= lo && distCm <= hi ? "✓ Optimal" : `Move to ${lo}–${hi}cm`} (${distCm}cm)`,
      "Keep ears directly above shoulders, chin parallel to floor",
      "Lumbar support: lower back fully touching chair back",
      "Every 20 min: look 6m away for 20 seconds (20-20-20 rule)",
    ],
    distCm,
    lo, hi,
    headYaw,
    detected:   true,
    confidence: detectionConfidence,
    fatigue_adjusted_score: fatigueAdjScore,
  };
}

// ── Side-camera analysis ──────────────────────────────────────────
// Brought to full parity with analyzeMP (front camera):
//   ✅ Confidence gating — noisy/occluded landmarks fall back to NEUTRAL
//   ✅ Nose+ear blend for neck reference (same formula as front camera)
//   ✅ Shoulder-width-normalized neck threshold (same distance-correction)
//   ✅ Outlier rejection: handled upstream by createLandmarkSmoother()
//      (the same smoother instance is reused for side mode in App.jsx)
//   ✅ Reliable flag per metric (matches front camera output shape)
export function analyzeSideMP(lms, W, H) {
  if (!lms || lms.length < 28) return null;

  const g   = idx => lms[idx];
  const px  = idx => ({ x: g(idx).x * W, y: g(idx).y * H });
  const vis = (idx, thr = 0.45) => (g(idx)?.visibility ?? 0) > thr;

  // ── Pick the better-visible side ─────────────────────────────
  const lVis = g(PL.L_SHOULDER)?.visibility ?? 0;
  const rVis = g(PL.R_SHOULDER)?.visibility ?? 0;
  const S = lVis >= rVis ? "L" : "R";
  const I = {
    EAR:   S === "L" ? PL.L_EAR    : PL.R_EAR,
    SH:    S === "L" ? PL.L_SHOULDER: PL.R_SHOULDER,
    HIP:   S === "L" ? PL.L_HIP    : PL.R_HIP,
    KNEE:  S === "L" ? PL.L_KNEE   : PL.R_KNEE,
    ANKLE: S === "L" ? PL.L_ANKLE  : PL.R_ANKLE,
    EYE:   S === "L" ? PL.L_EYE    : PL.R_EYE,
  };

  const ear   = px(I.EAR);
  const sh    = px(I.SH);
  const hip   = px(I.HIP);
  const knee  = px(I.KNEE);
  const ankle = px(I.ANKLE);
  const nose  = px(PL.NOSE);

  // ── Confidence gates ─────────────────────────────────────────
  const earOK   = vis(I.EAR);
  const shOK    = vis(I.SH);
  const hipOK   = vis(I.HIP);
  const kneeOK  = vis(I.KNEE);
  const ankleOK = vis(I.ANKLE);
  const noseOK  = vis(PL.NOSE);
  const neckOK  = earOK && shOK;
  const trunkOK = shOK && hipOK;
  const kneeVis = kneeOK && hipOK;
  const ankleVis= ankleOK && kneeOK;
  const NEUTRAL = 90;

  // ── Neck lean (side): nose+ear blend — same as front camera ──
  // Pure ear-based is biased by yaw: if the person is slightly rotated
  // the ear shifts relative to the shoulder and reads as false forward
  // lean. Blending in the nose anchors to true forward head position.
  const noseVis     = g(PL.NOSE)?.visibility ?? 1;
  const earWeight   = noseOK && noseVis > 0.7 ? 0.15 : 0.50;
  const noseWeight  = 1 - earWeight;
  const neckRef = {
    x: nose.x * noseWeight + ear.x * earWeight,
    y: nose.y * noseWeight + ear.y * earWeight,
  };
  const neckLeanRaw   = angleVert(sh, neckRef);
  const noseCorrection = 5.0 * noseWeight;
  const neckLean      = Math.max(0, neckLeanRaw - noseCorrection);

  // ── Shoulder-width-normalized neck threshold ──────────────────
  // Matches front camera: a fixed degree threshold is too strict when
  // close (angles read large) and too loose when far. Use apparent
  // shoulder WIDTH to normalize — side camera: use ear→shoulder
  // horizontal span as a proxy (both visible in side view).
  const refSpanFrac = 0.14;  // typical ear–shoulder span at neutral distance
  const earShSpan   = Math.abs(ear.x - sh.x);
  const spanFrac    = earShSpan / Math.max(W, 1);
  const spanRatio   = Math.max(0.70, Math.min(1.30, spanFrac / refSpanFrac));
  const neckOkAdj   = Math.max(6.0,  8.0 * spanRatio);
  const neckBadAdj  = Math.max(14.0, 22.0 * spanRatio);

  const trunkLean = trunkOK ? angleVert(hip, sh)             : 0;
  const hipAngle  = kneeVis ? angle3pt(sh, hip, knee)        : 90;
  const kneeAngle = ankleVis? angle3pt(hip, knee, ankle)     : 90;
  // Plumb-line: ear should be directly above ankle in ideal seated posture
  const spineAlign = shOK && ankleOK
    ? Math.abs(ear.x - ankle.x) / Math.max(W, 1) * 100
    : 0;

  // ── Scores (all gated) ────────────────────────────────────────
  const neckSc  = neckOK  ? scoreMetric(neckLean,               0, neckOkAdj, neckBadAdj) : NEUTRAL;
  const trunkSc = trunkOK ? scoreMetric(trunkLean,              0, T.trunkLean.ok, T.trunkLean.bad) : NEUTRAL;
  const hipSc   = kneeVis ? scoreMetric(Math.abs(hipAngle-90),  0, 12, 30) : NEUTRAL;
  const kneeSc  = ankleVis? scoreMetric(Math.abs(kneeAngle-90), 0, 12, 35) : NEUTRAL;
  const spineSc = (shOK && ankleOK) ? scoreMetric(spineAlign,   0, 3, 9) : NEUTRAL;

  const W_NECK=0.30, W_TRUNK=0.28, W_HIP=0.18, W_KNEE=0.12, W_SPINE=0.12;
  const overall = Math.max(0, Math.min(100, Math.round(
    neckSc  * W_NECK  +
    trunkSc * W_TRUNK +
    hipSc   * W_HIP   +
    kneeSc  * W_KNEE  +
    spineSc * W_SPINE
  )));

  // ── Alerts (gated by same visibility checks as scores) ────────
  const alerts = [
    neckOK && neckLean > neckBadAdj && `⚠️ Forward head ${Math.round(neckLean)}° — ear must be directly above shoulder`,
    neckOK && neckLean > (neckOkAdj + neckBadAdj)/2 && neckLean <= neckBadAdj && `Neck lean ${Math.round(neckLean)}° — tuck chin back`,
    trunkOK && trunkLean > 12 && `Trunk leaning ${Math.round(trunkLean)}° — sit back against lumbar support`,
    kneeVis && Math.abs(hipAngle  - 90) > 15 && `Hip angle ${Math.round(hipAngle)}° (ideal ~90°) — adjust seat height`,
    ankleVis&& Math.abs(kneeAngle - 90) > 18 && `Knee angle ${Math.round(kneeAngle)}° (ideal ~90°) — adjust footrest or seat depth`,
    (shOK && ankleOK) && spineAlign > 9 && `Plumb-line off by ${Math.round(spineAlign)}% — ear should be above ankle`,
  ].filter(Boolean);

  const sideName = S === "L" ? "left" : "right";
  return {
    score: overall,
    metrics: {
      neck_lean_side: { value: Math.round(neckLean),  score: neckSc,  unit: "°", label: "Neck lean (side)",  reliable: neckOK },
      trunk_lean:     { value: Math.round(trunkLean), score: trunkSc, unit: "°", label: "Trunk lean",        reliable: trunkOK },
      hip_angle:      { value: Math.round(hipAngle),  score: hipSc,   unit: "°", label: "Hip angle",         reliable: kneeVis },
      knee_angle:     { value: Math.round(kneeAngle), score: kneeSc,  unit: "°", label: "Knee angle",        reliable: ankleVis },
      spine_align:    { value: Math.round(spineAlign),score: spineSc, unit: "%", label: "Spine plumb-line",  reliable: shOK && ankleOK },
    },
    alerts,
    recommendations: [
      `Overall: ${gradeScore(overall)} (${overall}/100) — ${sideName} side view`,
      "Ear directly above shoulder, shoulder above hip",
      `Hip angle ${Math.round(hipAngle)}° — ${Math.abs(hipAngle-90)<12 ? "✓ ideal" : "adjust chair height"}`,
      "Feet flat, lumbar support fully engaged",
    ],
    detected:   true,
    confidence: Math.min(93,
      70 +
      (shOK   ? 10 : 0) +
      (earOK  ? 8  : 0) +
      (hipOK  ? 5  : 0)
    ),
  };
}

// ── Canvas drawing ─────────────────────────────────────────────────
export function drawFrontOverlay(ctx, result, W, H) {
  if (!ctx || !result?.landmarks?.length) return;
  const col = result.score >= 75 ? "#10b981" : result.score >= 50 ? "#f59e0b" : "#ef4444";
  const conns = [
    ["l_ear","r_ear"], ["l_ear","l_sh"], ["r_ear","r_sh"],
    ["l_sh","r_sh"], ["l_sh","l_hip"], ["r_sh","r_hip"], ["l_hip","r_hip"],
  ];
  const pts = {};
  result.landmarks.forEach(lm => { pts[lm.name] = { x: lm.x * W, y: lm.y * H }; });
  ctx.setLineDash([]);
  conns.forEach(([a, b]) => {
    if (pts[a] && pts[b]) {
      ctx.beginPath(); ctx.moveTo(pts[a].x, pts[a].y); ctx.lineTo(pts[b].x, pts[b].y);
      ctx.strokeStyle = col + "88"; ctx.lineWidth = 2; ctx.stroke();
    }
  });
  Object.values(pts).forEach(pt => {
    ctx.beginPath(); ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = col; ctx.fill();
  });
}

export function drawSideOverlay(ctx, result, W, H) {
  if (!ctx || !result?.landmarks?.length) return;
  const col  = result.score >= 75 ? "#10b981" : result.score >= 50 ? "#f59e0b" : "#ef4444";
  const pts  = {};
  result.landmarks.forEach(lm => { pts[lm.name] = { x: lm.x * W, y: lm.y * H }; });
  const order = ["ear", "sh", "hip", "knee", "ankle"];
  ctx.setLineDash([]);
  for (let i = 0; i < order.length - 1; i++) {
    const a = pts[order[i]], b = pts[order[i + 1]];
    if (a && b) {
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = col + "88"; ctx.lineWidth = 2; ctx.stroke();
    }
  }
  Object.values(pts).forEach(pt => {
    ctx.beginPath(); ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = col; ctx.fill();
  });
  if (pts.ear && pts.ankle) {
    ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(pts.ear.x, 0); ctx.lineTo(pts.ear.x, H);
    ctx.strokeStyle = "rgba(99,102,241,.4)"; ctx.lineWidth = 1; ctx.stroke();
    ctx.setLineDash([]);
  }
}

// ── Mode definitions ──────────────────────────────────────────────
export const MODES = {
  laptop: { label: "Laptop Camera", labelAr: "كاميرا اللابتوب", icon: "💻", distRange: [50, 80] },
  phone:  { label: "Phone Camera",  labelAr: "كاميرا الموبايل",  icon: "📱", distRange: [60, 90] },
  side:   { label: "Side Camera",   labelAr: "كاميرا جانبية",    icon: "🎥", distRange: [80, 120] },
};

// ── Audio alerts ──────────────────────────────────────────────────
let _lastBeepMs = 0;
const BEEP_COOLDOWN = 30000; // tightened from 45s → 30s

export function playBeep(muted = false) {
  if (muted) return;
  const now = Date.now();
  if (now - _lastBeepMs < BEEP_COOLDOWN) return;
  _lastBeepMs = now;
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    [[440, 0, 0.08], [360, 0.3, 0.26]].forEach(([freq, delay, stop]) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain); gain.connect(ac.destination);
      osc.frequency.value = freq; osc.type = "sine";
      gain.gain.setValueAtTime(0, ac.currentTime + delay);
      gain.gain.linearRampToValueAtTime(0.18, ac.currentTime + delay + 0.06);
      gain.gain.linearRampToValueAtTime(0, ac.currentTime + delay + stop);
      osc.start(ac.currentTime + delay);
      osc.stop(ac.currentTime + delay + stop + 0.05);
    });
  } catch {}
}

export function sendDesktopNotif(msg, score) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const icon = score < 50 ? "🔴" : score < 65 ? "🟡" : "🟢";
  new Notification("Corvus", {
    body: `${icon} ${msg}`,
    icon: "/icon-192.png",
    tag: "corvus-alert",
  });
}

// ── Request notification permission (call on first session start) ─
export function requestNotificationPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}

