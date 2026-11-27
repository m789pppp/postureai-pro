/**
 * measurementContract.js — one definition of frames, signs and units for every
 * number the live engine produces (pure, unit-tested).
 *
 * Three coordinate systems meet in this app and they disagree:
 *
 *   1. Image (MediaPipe normalised landmarks): x right, y DOWN, in 0..1 of the
 *      frame; pose z is relative depth on the same scale as x, smaller = closer.
 *   2. Face geometry (Face Landmarker transformation matrix, OpenGL style):
 *      x right, y UP, z TOWARD the viewer, units in cm.
 *   3. Camera (OpenCV / AprilTag / solvePnP): x right, y DOWN, z FORWARD
 *      (away from the camera), units in cm.
 *
 * Everything the engine reports is expressed in (3), the camera frame, so a
 * marker pose, a face pose and a body landmark can be compared directly.
 * The video the user sees is mirrored for display only; no measurement is ever
 * computed on mirrored coordinates.
 *
 * Signs:
 *   head_flexion_deg   + = chin down (flexion), − = extension
 *   head_roll_deg      + = head tilted toward the subject's RIGHT shoulder
 *   head_yaw_deg       + = face turned toward the subject's RIGHT
 *   protraction_cm     + = head forward of its neutral position over the shoulders
 *   view_distance_cm   eye-to-camera distance, always > 0
 *
 * References:
 *   gravity  — relative to true vertical (needs the camera tilt from the card)
 *   neutral  — relative to the user's calibrated neutral anchor
 *   camera   — relative to the camera's optical axis (raw)
 */

export const FRAMES = Object.freeze({ IMAGE: "image", FACE_GL: "face_gl", CAMERA: "camera" });
export const REFS   = Object.freeze({ GRAVITY: "gravity", NEUTRAL: "neutral", CAMERA: "camera" });
export const UNITS  = Object.freeze({ CM: "cm", DEG: "deg", PCT: "pct", S: "s", PX: "px" });

/** Every measurement the engine may publish, with its unit and sign meaning. */
export const MEASUREMENTS = Object.freeze({
  head_flexion_deg:    { unit: UNITS.DEG, positive: "chin down" },
  head_roll_deg:       { unit: UNITS.DEG, positive: "toward subject's right shoulder" },
  head_yaw_deg:        { unit: UNITS.DEG, positive: "face toward subject's right" },
  protraction_cm:      { unit: UNITS.CM,  positive: "head forward of neutral" },
  view_distance_cm:    { unit: UNITS.CM,  positive: "distance (always > 0)" },
  shoulder_tilt_deg:   { unit: UNITS.DEG, positive: "subject's right shoulder lower" },
  shoulder_elev_pct:   { unit: UNITS.PCT, positive: "shoulders raised vs neutral" },
  trunk_flexion_pct:   { unit: UNITS.PCT, positive: "trunk shortened vs neutral (slouch)" },
  trunk_rotation_deg:  { unit: UNITS.DEG, positive: "trunk turned toward subject's right" },
  camera_pitch_deg:    { unit: UNITS.DEG, positive: "camera looking down" },
});

/**
 * Build one measurement. Returns null-valued but well-formed output for bad input,
 * so callers never have to guess whether a number is usable.
 */
export function makeMeasurement(key, value, { confidence = 0, reliable = false, source = "", ref = REFS.CAMERA } = {}) {
  const spec = MEASUREMENTS[key];
  if (!spec) throw new Error(`unknown measurement: ${key}`);
  const ok = Number.isFinite(value);
  const c = Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0;
  return {
    key, unit: spec.unit, ref, source,
    value: ok ? value : null,
    confidence: ok ? c : 0,
    reliable: ok && !!reliable && c > 0,
  };
}

/** Checks a measurement object against the contract; returns a list of problems (empty = valid). */
export function validateMeasurement(m) {
  const errs = [];
  if (!m || typeof m !== "object") return ["not an object"];
  const spec = MEASUREMENTS[m.key];
  if (!spec) errs.push(`unknown key ${m.key}`);
  else if (m.unit !== spec.unit) errs.push(`${m.key}: unit ${m.unit} != ${spec.unit}`);
  if (!Object.values(REFS).includes(m.ref)) errs.push(`${m.key}: bad ref ${m.ref}`);
  if (m.value !== null && !Number.isFinite(m.value)) errs.push(`${m.key}: value not finite`);
  if (!(m.confidence >= 0 && m.confidence <= 1)) errs.push(`${m.key}: confidence out of [0,1]`);
  if (m.reliable && m.value === null) errs.push(`${m.key}: reliable without a value`);
  if (m.key === "view_distance_cm" && m.value !== null && !(m.value > 0)) errs.push("view_distance_cm must be > 0");
  return errs;
}

// ── Frame conversions ────────────────────────────────────────────────────────

/** Normalised image landmark → pixel coordinates (image frame, y down). */
export function imageToPx(lm, W, H) {
  return { x: lm.x * W, y: lm.y * H, z: (lm.z ?? 0) * W };
}

/** A vector in the Face Landmarker (OpenGL) frame → camera (OpenCV) frame. */
export function faceGlToCamera(v) {
  return { x: v.x, y: -v.y, z: -v.z };
}

/**
 * Undo the display mirror on an x coordinate. Measurements must be computed on
 * the raw camera image; use this only when a value was read from the mirrored view.
 */
export function unmirrorX(xNorm, mirrored) {
  return mirrored ? 1 - xNorm : xNorm;
}

/** Angle relative to gravity from a camera-frame angle and the camera's own pitch. */
export function toGravityRef(angleCameraDeg, cameraPitchDeg) {
  if (!Number.isFinite(angleCameraDeg) || !Number.isFinite(cameraPitchDeg)) return null;
  return angleCameraDeg + cameraPitchDeg;
}

/** Angle relative to the user's neutral anchor. */
export function toNeutralRef(value, neutral) {
  if (!Number.isFinite(value) || !Number.isFinite(neutral)) return null;
  return value - neutral;
}
