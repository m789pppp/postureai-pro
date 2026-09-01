/**
 * Synthetic subject — a parametric 3D body posed at KNOWN angles and projected
 * through a pinhole camera, producing MediaPipe-shaped landmarks.
 *
 * Why this exists
 * ---------------
 * postureEngine.selftest.mjs checks invariants: that a score falls when posture
 * worsens, that nothing returns NaN, that weights sum to 1. Those are real
 * tests and they caught real bugs. But not one of them asks the question a
 * customer asks first:
 *
 *     "If I lean my neck 30 degrees, does it say 30?"
 *
 * You cannot answer that from a recorded video without a motion-capture lab,
 * because the video has no ground truth either. You CAN answer it by going the
 * other way: start from a known pose, project it the way a camera would, and
 * check what the engine reports. That is what this file builds.
 *
 * The model is deliberately simple — rigid segments, no soft tissue, no
 * clothing, no MediaPipe estimation error. It therefore measures the engine's
 * OWN geometric error and nothing else, which is exactly what we want to
 * isolate: any bias found here is in our arithmetic, not in the pose model.
 *
 * What it cannot tell you
 * -----------------------
 * Nothing here substitutes for clinical validation. A perfect score against
 * this harness means the engine's geometry is self-consistent, not that its
 * thresholds are clinically meaningful. Those are different claims and only
 * the first one is being made.
 *
 * Coordinate system (subject-centric, centimetres)
 *   +X : the camera's right, which is the subject's LEFT side
 *        (landmarks arrive unmirrored, so subject-left sits at higher image x)
 *   +Y : up
 *   +Z : toward the camera
 *   origin: mid-hip
 */

import { PL } from "./postureEngine.js";

// ── Anthropometry ────────────────────────────────────────────────────────
// Defaults are a mid-size adult. Every value is overridable so the harness can
// sweep body sizes — a metric that is correct only for a 42cm-shouldered
// subject is not a metric, it is a coincidence.
export const DEFAULT_BODY = {
  shoulderWidthCm: 42.0,  // acromion to acromion
  hipWidthCm:      32.0,
  torsoLenCm:      52.0,  // mid-hip to mid-shoulder
  neckLenCm:       12.0,  // mid-shoulder to ear-line height
  earHalfCm:        7.5,  // ear to head midline
  earBackCm:        2.0,  // ears sit behind the coronal midline
  // Nose tip forward of the EAR plane. The value that matters for head-yaw
  // estimation is the nose's protrusion ahead of the EYE plane, since that is
  // the lever arm that converts rotation into apparent sideways nose offset.
  // Set so that noseAheadCm - eyeAheadCm = 2.2cm, the anthropometric figure
  // the engine's own yaw estimator is derived from (pronasale ahead of the
  // corneal plane). An earlier draft of this model used 3.0cm, which made the
  // engine appear to overestimate yaw by ~50% — a defect in the test rig, not
  // in the engine, and worth stating plainly because tuning the engine to
  // match a wrong model is exactly how a harness makes things worse.
  noseAheadCm:      8.2,
  noseDropCm:       2.5,  // nose below the ear line
  eyeHalfCm:        3.15, // half of a 6.3cm IPD
  eyeOuterHalfCm:   4.6,
  eyeUpCm:          1.5,  // eyes above the nose
  eyeAheadCm:       6.0,
  upperArmCm:      30.0,
  forearmCm:       26.0,
};

// ── Pose parameters, all in degrees / cm, all zero = neutral ─────────────
export const NEUTRAL_POSE = {
  neckFlexDeg:      0,  // head forward about the ear-line pivot (+ = chin toward chest)
  trunkFlexDeg:     0,  // whole torso forward about the hips
  lateralLeanDeg:   0,  // torso sideways (+ = toward subject's right)
  trunkRotDeg:      0,  // axial twist of the shoulder line (+ = subject's left shoulder forward)
  headYawDeg:       0,  // head turn (+ = subject looks to their left)
  shoulderElevCm:   0,  // both shoulders raised
  shoulderTiltDeg:  0,  // one shoulder higher (+ = subject's left higher)
  forwardHeadCm:    0,  // head translated forward without rotating (true FHP)
  roundShoulderCm:  0,  // shoulders translated forward (protraction)
};

// ── Small 3D helpers ─────────────────────────────────────────────────────
const rad = d => (d * Math.PI) / 180;
const v = (x, y, z) => ({ x, y, z });
const add = (a, b) => v(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a, b) => v(a.x - b.x, a.y - b.y, a.z - b.z);

/** Rotate about X (pitch — forward/back lean). +angle tips +Y toward +Z. */
const rotX = (p, deg) => {
  const c = Math.cos(rad(deg)), s = Math.sin(rad(deg));
  return v(p.x, p.y * c - p.z * s, p.y * s + p.z * c);
};
/** Rotate about Y (yaw — turning). */
const rotY = (p, deg) => {
  const c = Math.cos(rad(deg)), s = Math.sin(rad(deg));
  return v(p.x * c + p.z * s, p.y, -p.x * s + p.z * c);
};
/** Rotate about Z (roll — lateral lean). */
const rotZ = (p, deg) => {
  const c = Math.cos(rad(deg)), s = Math.sin(rad(deg));
  return v(p.x * c - p.y * s, p.x * s + p.y * c, p.z);
};

/**
 * Build the 3D landmark set for a pose.
 * Returns a map of landmark index -> {x,y,z} in centimetres.
 */
export function buildSubject3D(pose = {}, body = {}) {
  const B = { ...DEFAULT_BODY, ...body };
  const P = { ...NEUTRAL_POSE, ...pose };

  const shHalf  = B.shoulderWidthCm / 2;
  const hipHalf = B.hipWidthCm / 2;

  // Hips are the root and never move.
  const lHip = v(+hipHalf, 0, 0);
  const rHip = v(-hipHalf, 0, 0);
  const midHip = v(0, 0, 0);

  // ── Shoulder girdle, in torso-local space (origin at mid-hip) ──────────
  let lSh = v(+shHalf, B.torsoLenCm + P.shoulderElevCm, 0);
  let rSh = v(-shHalf, B.torsoLenCm + P.shoulderElevCm, 0);

  // One shoulder higher than the other.
  if (P.shoulderTiltDeg) {
    const dy = Math.tan(rad(P.shoulderTiltDeg)) * shHalf;
    lSh = v(lSh.x, lSh.y + dy, lSh.z);
    rSh = v(rSh.x, rSh.y - dy, rSh.z);
  }

  // Protraction: both shoulders slide forward (toward the camera).
  if (P.roundShoulderCm) {
    lSh = v(lSh.x, lSh.y, lSh.z + P.roundShoulderCm);
    rSh = v(rSh.x, rSh.y, rSh.z + P.roundShoulderCm);
  }

  // Axial twist about the spine: rotate the shoulder line only.
  if (P.trunkRotDeg) {
    const midY = (lSh.y + rSh.y) / 2;
    const pivot = v(0, midY, 0);
    lSh = add(rotY(sub(lSh, pivot), P.trunkRotDeg), pivot);
    rSh = add(rotY(sub(rSh, pivot), P.trunkRotDeg), pivot);
  }

  const midSh = v((lSh.x + rSh.x) / 2, (lSh.y + rSh.y) / 2, (lSh.z + rSh.z) / 2);

  // ── Head, built in head-local space with the ear line as the pivot ─────
  // The head hangs off the SPINE, not off the shoulder girdle. Deriving the
  // pivot from midSh made the head rise with a shrug, so the ear-to-shoulder
  // gap never changed and shoulder elevation was invisible to the harness —
  // a modelling error that would have been read as an engine defect.
  // Protraction and twist move the shoulders around a head that stays put,
  // which is what those movements actually are.
  const neckBaseY = B.torsoLenCm;
  const headPivot = v(0, neckBaseY + B.neckLenCm, 0);

  let head = {
    L_EAR:       v(+B.earHalfCm, 0, -B.earBackCm),
    R_EAR:       v(-B.earHalfCm, 0, -B.earBackCm),
    NOSE:        v(0, -B.noseDropCm, +B.noseAheadCm),
    L_EYE:       v(+B.eyeHalfCm, +B.eyeUpCm, +B.eyeAheadCm),
    R_EYE:       v(-B.eyeHalfCm, +B.eyeUpCm, +B.eyeAheadCm),
    L_EYE_OUTER: v(+B.eyeOuterHalfCm, +B.eyeUpCm, +B.eyeAheadCm - 1.0),
    R_EYE_OUTER: v(-B.eyeOuterHalfCm, +B.eyeUpCm, +B.eyeAheadCm - 1.0),
    L_EYE_INNER: v(+B.eyeHalfCm * 0.55, +B.eyeUpCm, +B.eyeAheadCm),
    R_EYE_INNER: v(-B.eyeHalfCm * 0.55, +B.eyeUpCm, +B.eyeAheadCm),
  };

  // Head turn, then neck flexion. Order matters and this is the anatomical
  // one: you turn your head within the neck, then the neck tips forward.
  const applyHead = (p) => {
    let q = p;
    if (P.headYawDeg)   q = rotY(q, P.headYawDeg);
    if (P.neckFlexDeg)  q = rotX(q, P.neckFlexDeg);
    return q;
  };
  const headWorldLocal = {};
  for (const [k, p] of Object.entries(head)) {
    headWorldLocal[k] = add(applyHead(p), headPivot);
  }

  // Neck flexion also carries the head forward of the neck base, because the
  // pivot is at the ear line rather than at the base of the neck. Add the
  // translation component so a flexed neck reads as forward-head too, which is
  // what happens in a real body.
  if (P.neckFlexDeg) {
    const armLen = B.neckLenCm;
    const dz = Math.sin(rad(P.neckFlexDeg)) * armLen;
    const dy = (Math.cos(rad(P.neckFlexDeg)) - 1) * armLen;
    for (const k of Object.keys(headWorldLocal)) {
      headWorldLocal[k] = v(headWorldLocal[k].x, headWorldLocal[k].y + dy, headWorldLocal[k].z + dz);
    }
  }

  // Pure forward-head translation (no rotation) — the classic FHP.
  if (P.forwardHeadCm) {
    for (const k of Object.keys(headWorldLocal)) {
      headWorldLocal[k] = v(headWorldLocal[k].x, headWorldLocal[k].y, headWorldLocal[k].z + P.forwardHeadCm);
    }
  }

  // ── Arms in a typing posture ───────────────────────────────────────────
  // Upper arm hangs close to the body, forearm reaches forward to the desk at
  // roughly elbow height — which puts the elbow near the 90-105° that the
  // ergonomic guidance is written about.
  //
  // The first version of this model ran the forearm steeply down and far
  // forward, producing an almost straight 179° arm. That is a resting arm, not
  // a typing one, and it made the engine look like it was firing a false
  // "elbows too low" alert when the fixture was simply posing the wrong thing.
  const lElb = v(lSh.x + 2, lSh.y - B.upperArmCm, lSh.z + 3);
  const rElb = v(rSh.x - 2, rSh.y - B.upperArmCm, rSh.z + 3);
  const lWri = v(lElb.x - 5, lElb.y + 1, lElb.z + B.forearmCm * 0.92);
  const rWri = v(rElb.x + 5, rElb.y + 1, rElb.z + B.forearmCm * 0.92);

  // ── Whole-body transforms about the hips ──────────────────────────────
  const all = {
    [PL.NOSE]:        headWorldLocal.NOSE,
    [PL.L_EYE_INNER]: headWorldLocal.L_EYE_INNER,
    [PL.L_EYE]:       headWorldLocal.L_EYE,
    [PL.L_EYE_OUTER]: headWorldLocal.L_EYE_OUTER,
    [PL.R_EYE_INNER]: headWorldLocal.R_EYE_INNER,
    [PL.R_EYE]:       headWorldLocal.R_EYE,
    [PL.R_EYE_OUTER]: headWorldLocal.R_EYE_OUTER,
    [PL.L_EAR]:       headWorldLocal.L_EAR,
    [PL.R_EAR]:       headWorldLocal.R_EAR,
    [PL.L_SHOULDER]:  lSh,
    [PL.R_SHOULDER]:  rSh,
    [PL.L_ELBOW]:     lElb,
    [PL.R_ELBOW]:     rElb,
    [PL.L_WRIST]:     lWri,
    [PL.R_WRIST]:     rWri,
    [PL.L_HIP]:       lHip,
    [PL.R_HIP]:       rHip,
  };

  const out = {};
  for (const [k, p] of Object.entries(all)) {
    let q = sub(p, midHip);
    if (P.trunkFlexDeg)   q = rotX(q, P.trunkFlexDeg);
    if (P.lateralLeanDeg) q = rotZ(q, P.lateralLeanDeg);
    out[k] = add(q, midHip);
  }
  return out;
}

// ── Camera ───────────────────────────────────────────────────────────────
export const DEFAULT_CAMERA = {
  W: 1280,
  H: 720,
  focalPx1280: 800,   // matches FOCAL_PX_1280 in postureEngine.js
  distCm: 60,         // camera to mid-shoulder along Z
  heightCm: 0,        // camera height relative to mid-shoulder (+ = above)
};

/**
 * Project the 3D subject to MediaPipe-shaped normalised landmarks.
 *
 * Returns a 33-length array where unmodelled joints are absent (visibility 0),
 * which is what the engine sees for a seated upper-body user anyway.
 */
export function projectToLandmarks(pts3d, camera = {}, body = {}) {
  const C = { ...DEFAULT_CAMERA, ...camera };
  const B = { ...DEFAULT_BODY, ...body };
  const f = (C.focalPx1280 * C.W) / 1280;

  // Camera sits at (0, shoulderY + heightCm, distCm) looking along -Z.
  const shoulderY = B.torsoLenCm;
  const camPos = v(0, shoulderY + C.heightCm, C.distCm);

  const lms = new Array(33).fill(null).map(() => ({ x: 0, y: 0, z: 0, visibility: 0 }));

  // MediaPipe's z convention, which two analyzers depend on and which is easy
  // to get wrong (this harness did, at first, and produced confidently invalid
  // readings for rounded shoulders and forward-head until it was corrected):
  //
  //   · origin is the HIP MIDPOINT, not the camera
  //   · NEGATIVE is toward the camera
  //   · the scale is "roughly the same as x", i.e. normalised by the image
  //     width in world units at that depth — so it shrinks with distance
  //     exactly as x does
  //
  // Getting any of the three wrong silently inverts or flattens the depth
  // metrics rather than failing, which is the worst way for a test rig to be
  // wrong.
  const hipMid = pts3d[PL.L_HIP] && pts3d[PL.R_HIP]
    ? v((pts3d[PL.L_HIP].x + pts3d[PL.R_HIP].x) / 2,
        (pts3d[PL.L_HIP].y + pts3d[PL.R_HIP].y) / 2,
        (pts3d[PL.L_HIP].z + pts3d[PL.R_HIP].z) / 2)
    : v(0, 0, 0);

  for (const [idxStr, p] of Object.entries(pts3d)) {
    const idx = Number(idxStr);
    const rel = sub(p, camPos);
    const depth = -rel.z;                 // positive in front of the camera
    if (depth <= 1) continue;             // behind or at the lens
    const xPx = C.W / 2 + (f * rel.x) / depth;
    const yPx = C.H / 2 - (f * rel.y) / depth;

    // World width of the image at this depth, so z shares x's scale.
    const frameWidthCm = (depth * C.W) / f;
    const zNorm = -(p.z - hipMid.z) / frameWidthCm;

    lms[idx] = {
      x: xPx / C.W,
      y: yPx / C.H,
      z: zNorm,
      visibility: 0.95,
    };
  }
  return lms;
}

/** Convenience: pose + body + camera -> landmarks. */
export function renderSubject(pose = {}, body = {}, camera = {}) {
  return projectToLandmarks(buildSubject3D(pose, body), camera, body);
}

/**
 * Add zero-mean Gaussian noise to landmark positions, in pixels, to emulate
 * MediaPipe's frame-to-frame jitter. Used for the precision (repeatability)
 * measurements — accuracy and precision are different properties and a system
 * can be excellent at one and useless at the other.
 */
export function jitter(lms, pxSigma = 1.5, camera = {}, rng = Math.random, opts = {}) {
  const C = { ...DEFAULT_CAMERA, ...camera };

  // z gets its own, larger sigma. This function used to perturb x and y and
  // leave z EXACTLY as the projection produced it — so every precision result
  // measured against a depth channel that was noise-free, which no real
  // MediaPipe output ever is. Any analyzer reading z would have looked
  // flawlessly stable here and shaky in front of a camera.
  //
  // MediaPipe's pose z is not observed, it is regressed: the model infers
  // depth from a single view rather than measuring it, and its documentation
  // notes the z magnitude is "roughly the same scale as x" without claiming
  // comparable accuracy. Face landmarks in the POSE graph (not Face Mesh) are
  // the weakest case — a small cluster of points spanning a few centimetres
  // in depth. A 3x multiplier is a deliberately pessimistic default: the point
  // is that a method leaning on z must survive noise, not that 3x is the
  // measured truth. Sweep it with zSigmaMult before trusting any z-based
  // metric, and treat the honest answer as "unknown until real users".
  const zSigmaMult = opts.zSigmaMult ?? 3;

  const gauss = () => {
    // Box-Muller, so the noise is actually Gaussian rather than uniform.
    let u = 0, w = 0;
    while (u === 0) u = rng();
    while (w === 0) w = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * w);
  };
  return lms.map(p => p.visibility === 0 ? p : ({
    ...p,
    x: p.x + (gauss() * pxSigma) / C.W,
    y: p.y + (gauss() * pxSigma) / C.H,
    // z shares x's normalisation (fraction of frame width at that depth), so
    // the same pxSigma/W scale applies before the multiplier.
    z: p.z + (gauss() * pxSigma * zSigmaMult) / C.W,
  }));
}

/** Deterministic RNG so accuracy runs are reproducible across machines. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
