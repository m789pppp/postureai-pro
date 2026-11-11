/**
 * neckModel.js — neck metrics from a front-facing webcam (pure, unit-tested).
 *
 * 1) Head protraction (forward head) in cm, relative to the calibrated neutral.
 *    Pinhole model with two depth cues:
 *      head depth      D_h  from the iris (11.7 mm)            — distanceFromIris()
 *      shoulder depth  D_sh = D_sh0 · (sw0 / sw)               — shoulder width is constant in cm
 *    protraction Δ = (D_sh − D_h) − (D_sh0 − D_h0), with D_sh0 ≈ D_h0.
 *    The D_sh0 ≈ D_h0 approximation costs δ·(k−1) (δ = real head–shoulder depth gap,
 *    k = sw0/sw ≈ 1), i.e. well under 1 cm at desk distances. Leaning the whole trunk
 *    toward the screen moves head and shoulders together and correctly reads ≈ 0.
 *    Known confound: rounding the shoulders narrows them and reads as extra protraction.
 *
 * 2) Estimated load on the cervical spine from head flexion — interpolated from
 *    Hansraj (2014, Surgical Technology International), a computational model:
 *    0° ≈ 4.5–5.4 kg, 15° ≈ 12.2, 30° ≈ 18.1, 45° ≈ 22.2, 60° ≈ 27.2 kg.
 *    It is a model estimate for user feedback, not a measurement.
 */

/** Head protraction in cm (+ = head forward of its neutral position over the shoulders). */
export function headProtractionCm({ headDistCm, shoulderPx, neutralHeadDistCm, neutralShoulderPx }) {
  if (![headDistCm, shoulderPx, neutralHeadDistCm, neutralShoulderPx].every(v => Number.isFinite(v) && v > 0)) return null;
  const k = neutralShoulderPx / shoulderPx;               // D_sh / D_sh0
  const shoulderDist = neutralHeadDistCm * k;             // D_sh0 ≈ D_h0
  return (shoulderDist - headDistCm) - 0;                 // − (D_sh0 − D_h0) = 0 under the approximation
}

const HANSRAJ = [[0, 5.0], [15, 12.2], [30, 18.1], [45, 22.2], [60, 27.2]];

/** Estimated cervical load (kg) for a head flexion angle in degrees (≤0 → neutral load). */
export function neckLoadKg(flexionDeg) {
  if (!Number.isFinite(flexionDeg)) return null;
  const a = Math.max(0, Math.min(60, flexionDeg));
  for (let i = 1; i < HANSRAJ.length; i++) {
    const [x0, y0] = HANSRAJ[i - 1], [x1, y1] = HANSRAJ[i];
    if (a <= x1) return Math.round((y0 + ((a - x0) / (x1 - x0)) * (y1 - y0)) * 10) / 10;
  }
  return HANSRAJ.at(-1)[1];
}

/** Shoulder width in px from normalised pose landmarks. */
export function shoulderWidthPx(pose, W, H) {
  const a = pose?.[11], b = pose?.[12];
  if (!a || !b) return NaN;
  return Math.hypot((a.x - b.x) * W, (a.y - b.y) * H);
}
