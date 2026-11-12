/**
 * benchProtocol.js — the Posmoz Bench: fixed postures, each with a ground-truth value
 * measured by hand (goniometer / phone inclinometer / tape), recorded as LANDMARKS ONLY
 * (no video, no images) so a session file carries no picture of the person.
 *
 * Each step: hold the posture, type the measured value, record `holdSec` seconds.
 * The training script (backend/ai/bench_train.py) pairs the per-step median of the
 * camera features with the measured value.
 */
export const BENCH_VERSION = 1;

export const BENCH_STEPS = [
  { id: "neutral",        target: "head_flexion_deg", unit: "°",  holdSec: 5, en: "Sit upright, look at the screen",          ar: "اقعد مستقيم وبص للشاشة" },
  { id: "flex_15",        target: "head_flexion_deg", unit: "°",  holdSec: 5, en: "Bend the head down ~15°",                  ar: "اثني راسك لتحت حوالي ١٥°" },
  { id: "flex_30",        target: "head_flexion_deg", unit: "°",  holdSec: 5, en: "Bend the head down ~30°",                  ar: "اثني راسك لتحت حوالي ٣٠°" },
  { id: "forward_head",   target: "protraction_cm",   unit: "cm", holdSec: 5, en: "Push the head forward, eyes level",        ar: "زق راسك لقدام وعينك مستوية" },
  { id: "tilt_left",      target: "head_tilt_deg",    unit: "°",  holdSec: 5, en: "Tilt the head toward the left shoulder",   ar: "ميّل راسك ناحية كتفك الشمال" },
  { id: "tilt_right",     target: "head_tilt_deg",    unit: "°",  holdSec: 5, en: "Tilt the head toward the right shoulder",  ar: "ميّل راسك ناحية كتفك اليمين" },
  { id: "shoulder_raise", target: "shoulder_level_deg", unit: "°", holdSec: 5, en: "Raise one shoulder",                      ar: "ارفع كتف واحد" },
  { id: "lean_forward",   target: "protraction_cm",   unit: "cm", holdSec: 5, en: "Lean the whole trunk toward the screen",   ar: "ميّل جسمك كله ناحية الشاشة" },
  { id: "slouch",         target: "head_flexion_deg", unit: "°",  holdSec: 5, en: "Slouch the way you usually do",            ar: "اقعد مكسّل زي ما بتقعد عادةً" },
];

const r4 = v => (Number.isFinite(v) ? Math.round(v * 1e4) / 1e4 : null);

/** One compact frame record (normalised landmarks rounded to 1e-4 ≈ 0.1 px at 1280). */
export function frameRecord(tMs, rawLms, fusedLms, prec) {
  const pack = l => l ? l.map(p => [r4(p.x), r4(p.y), r4(p.z ?? 0), r4(p.visibility ?? 0)]) : null;
  return {
    t: Math.round(tMs),
    raw: pack(rawLms),
    fused: pack(fusedLms),
    head: prec?.head ? [r4(prec.head.pitch), r4(prec.head.yaw), r4(prec.head.roll)] : null,
    iris: r4(prec?.irisPx), dist: prec?.distCm ?? null, prot: prec?.protractionCm ?? null,
    conf: prec?.confidence ?? null, agree: prec?.agreement ?? null,
  };
}

/** Session envelope written to the downloaded JSON. */
export function sessionEnvelope({ subject, camera, calib, steps, measureVersion = null }) {
  return {
    bench_version: BENCH_VERSION,
    recorded_at: new Date().toISOString(),
    measure_version: measureVersion,
    // every step also carries `pipeline` (pipelineInfo.js): sessions from different pipelines are not pooled

    subject,                                 // pseudonymous code, e.g. "S07" — never a name
    camera,                                  // { width, height, focal_px, focal_source }
    calib: calib ? { head_pose_neutral: calib.head_pose_neutral, iris_px_neutral: calib.iris_px_neutral,
                     shoulder_px_neutral: calib.shoulder_px_neutral } : null,
    steps,                                   // [{ id, target, measured, frames: [...] }]
  };
}
