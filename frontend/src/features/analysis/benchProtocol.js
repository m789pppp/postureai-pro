/**
 * benchProtocol.js — the Posmoz Bench: fixed postures, each with a ground-truth value
 * measured by hand (goniometer / phone inclinometer / tape), recorded as LANDMARKS ONLY
 * (no video, no images) so a session file carries no picture of the person.
 *
 * Each step: hold the posture, type the measured value, record `holdSec` seconds.
 * The training script (backend/ai/bench_train.py) pairs the per-step median of the
 * camera features with the measured value.
 */
export const BENCH_VERSION = 2;

/**
 * Each step: hold the posture, type the measured value, record `holdSec` seconds.
 *   expectAny  alert keys of which at least one should fire once the posture is held
 *   forbid     alert keys that must NOT fire (cross-talk: e.g. a head turn read as a tilt)
 * Used by scripts/replay-bench.mjs to judge the engine on real recordings.
 * v2 adds looking up, turning left/right and leaning sideways, so every direction a
 * tester moves in is covered, and the expectations.
 */
const POSTURE_ALERTS = ["neck_mid", "neck_sev", "tilt", "sh", "spine_mid", "spine_sev", "yaw", "fhp_mid", "fhp_sev",
  "round_mid", "round_sev", "shrug_mid", "shrug_sev", "slouch_mid", "slouch_sev", "twist_mid", "twist_sev", "mon_low", "mon_hi"];
export const BENCH_STEPS = [
  { id: "neutral",        target: "head_flexion_deg",   unit: "°",  holdSec: 5, en: "Sit upright, look at the screen",          ar: "اقعد مستقيم وبص للشاشة",
    expectAny: [], forbid: POSTURE_ALERTS },
  { id: "flex_15",        target: "head_flexion_deg",   unit: "°",  holdSec: 5, en: "Bend the head down ~15°",                  ar: "اثني راسك لتحت حوالي ١٥°",
    expectAny: [], forbid: ["mon_hi", "yaw", "tilt"] },
  { id: "flex_30",        target: "head_flexion_deg",   unit: "°",  holdSec: 5, en: "Bend the head down ~30°",                  ar: "اثني راسك لتحت حوالي ٣٠°",
    expectAny: ["mon_low", "neck_mid", "neck_sev", "fhp_mid", "fhp_sev"], forbid: ["mon_hi", "yaw", "tilt"] },
  { id: "look_up",        target: "head_flexion_deg",   unit: "°",  holdSec: 5, en: "Look up ~20° (measured value is negative)", ar: "بص لفوق حوالي ٢٠° (اكتب الرقم بالسالب)",
    expectAny: ["mon_hi"], forbid: ["mon_low", "yaw", "tilt"] },
  { id: "forward_head",   target: "protraction_cm",     unit: "cm", holdSec: 5, en: "Push the head forward, eyes level",        ar: "زق راسك لقدام وعينك مستوية",
    expectAny: ["fhp_mid", "fhp_sev"], forbid: ["tilt", "yaw", "sh"] },
  { id: "tilt_left",      target: "head_tilt_deg",      unit: "°",  holdSec: 5, en: "Tilt the head toward the left shoulder",   ar: "ميّل راسك ناحية كتفك الشمال",
    expectAny: ["tilt"], forbid: ["yaw", "mon_low", "mon_hi"] },
  { id: "tilt_right",     target: "head_tilt_deg",      unit: "°",  holdSec: 5, en: "Tilt the head toward the right shoulder",  ar: "ميّل راسك ناحية كتفك اليمين",
    expectAny: ["tilt"], forbid: ["yaw", "mon_low", "mon_hi"] },
  { id: "turn_left",      target: "head_yaw_deg",       unit: "°",  holdSec: 5, en: "Turn the head ~30° to the left",           ar: "لف راسك شمال حوالي ٣٠°",
    expectAny: ["yaw"], forbid: ["tilt", "mon_low", "mon_hi"] },
  { id: "turn_right",     target: "head_yaw_deg",       unit: "°",  holdSec: 5, en: "Turn the head ~30° to the right",          ar: "لف راسك يمين حوالي ٣٠°",
    expectAny: ["yaw"], forbid: ["tilt", "mon_low", "mon_hi"] },
  { id: "lean_side",      target: "spine_lateral_deg",  unit: "°",  holdSec: 5, en: "Lean the upper body to one side",          ar: "ميّل جسمك كله لجنب واحد",
    expectAny: ["spine_mid", "spine_sev"], forbid: ["fhp_mid", "fhp_sev", "mon_low", "mon_hi"] },
  { id: "shoulder_raise", target: "shoulder_level_deg", unit: "°",  holdSec: 5, en: "Raise one shoulder",                       ar: "ارفع كتف واحد",
    expectAny: ["sh", "shrug_mid", "shrug_sev"], forbid: ["yaw", "mon_low", "mon_hi"] },
  { id: "lean_forward",   target: "protraction_cm",     unit: "cm", holdSec: 5, en: "Lean the whole trunk toward the screen",   ar: "ميّل جسمك كله ناحية الشاشة",
    expectAny: ["dist_c", "dist_cl", "fhp_mid", "fhp_sev", "slouch_mid", "slouch_sev"], forbid: ["yaw", "tilt"] },
  { id: "slouch",         target: "head_flexion_deg",   unit: "°",  holdSec: 5, en: "Slouch the way you usually do",            ar: "اقعد مكسّل زي ما بتقعد عادةً",
    expectAny: ["slouch_mid", "slouch_sev", "fhp_mid", "fhp_sev", "round_mid", "round_sev", "neck_mid", "neck_sev", "mon_low"], forbid: ["yaw", "mon_hi"] },
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
