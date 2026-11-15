/**
 * slumpModel — a small learned layer for the postures the geometric analyzers
 * miss when the hips are out of frame: a forward slouch, a sofa-style recline
 * (pelvis rolled back, neck flexed to keep the eyes on the screen), leaning in
 * toward the screen, and head-down.
 *
 * Camp 2026-11-15, R11: the tester slumped back on a sofa and every metric read
 * normal. Nothing in the engine can name that posture without the hips. This
 * reads six scale-free features of the face and shoulders, compares them with
 * the user's own first seconds (learned neutral), and runs a softmax
 * regression over five classes.
 *
 * Trained ONLY on the OpenSim kinematic fixture (validation/opensim,
 * frontend/scripts/train-slump.mjs). It has never seen a real person. It sits
 * behind the `slump` switch and must be checked on real recordings before it
 * can be turned on for anyone. No accuracy figure from it may be shown to
 * users (CLAUDE.md).
 */
import { PL } from "./postureEngine.js";

export const SLUMP_CLASSES = ["neutral", "slouch_forward", "recline_slump", "lean_to_screen", "head_down"];

/** Six scale-free features, or null when a needed landmark is not visible. */
export function slumpFeatures(lms, W, H, minVis = 0.5) {
  const g = i => lms?.[i];
  const ok = i => (g(i)?.visibility ?? 0) >= minVis;
  for (const i of [PL.L_SHOULDER, PL.R_SHOULDER, PL.L_EAR, PL.R_EAR, PL.L_EYE, PL.R_EYE, PL.NOSE]) if (!ok(i)) return null;
  const P = i => ({ x: g(i).x * W, y: g(i).y * H });
  const lS = P(PL.L_SHOULDER), rS = P(PL.R_SHOULDER), lE = P(PL.L_EAR), rE = P(PL.R_EAR);
  const lY = P(PL.L_EYE), rY = P(PL.R_EYE), n = P(PL.NOSE);
  const shW = Math.hypot(lS.x - rS.x, lS.y - rS.y), ipd = Math.hypot(lY.x - rY.x, lY.y - rY.y);
  if (shW < 20 || ipd < 4) return null;
  const midSh = { x: (lS.x + rS.x) / 2, y: (lS.y + rS.y) / 2 }, midEar = { x: (lE.x + rE.x) / 2, y: (lE.y + rE.y) / 2 };
  return [
    Math.log(shW / W),               // overall distance
    Math.log(ipd / shW),             // head size against the shoulders: head forward / closer
    (midSh.y - midEar.y) / shW,      // neck's vertical gap
    (n.y - midEar.y) / ipd,          // nose below the ear line: head pitch
    midSh.y / H,                     // shoulders' height in the frame
    midEar.y / H,                    // ears' height in the frame
  ];
}

// ── Trained weights (written by frontend/scripts/train-slump.mjs) ─────────
// BEGIN WEIGHTS
// 2026-11-15 · 4740 train examples · held-out 88% · OOD 79% (synthetic only)
export const SLUMP_MODEL = {"mean":[0.0736,0.0441,0.0076,0.3041,0.0345,0.0082],"std":[0.1607,0.0766,0.0107,0.2677,0.0584,0.0327],"W":[[-0.3231,-0.2479,-0.4439,-2.2156,-0.7104,-0.5201],[2.5977,-0.655,1.2941,-1.2144,2.0081,-0.0215],[-3.6266,0.0601,-0.0605,0.5674,-0.8658,1.9985],[2.3311,0.6014,-0.6429,0.387,0.6491,-0.7382],[-0.9791,0.2414,-0.1468,2.4756,-1.081,-0.7187]],"b":[-0.5962,0.0262,-0.2341,0.9703,-0.1661]};
// END WEIGHTS

/**
 * Per-session tracker: learns the user's neutral from the first `learnN`
 * usable frames (median per feature), then returns smoothed class
 * probabilities. `model` defaults to the trained weights.
 */
export function createSlumpTracker({ learnN = 40, alpha = 0.25, model = SLUMP_MODEL } = {}) {
  const seen = [];
  let base = null, probs = null;
  const median = a => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
  return {
    reset() { seen.length = 0; base = null; probs = null; },
    get learning() { return base == null; },
    update(lms, W, H) {
      if (!model) return null;
      const f = slumpFeatures(lms, W, H);
      if (!f) return probs;
      if (!base) {
        seen.push(f);
        if (seen.length >= learnN) base = f.map((_, i) => median(seen.map(r => r[i])));
        return null;
      }
      const d = f.map((v, i) => (v - base[i] - model.mean[i]) / model.std[i]);
      const z = model.W.map((w, k) => w.reduce((s, wi, i) => s + wi * d[i], model.b[k]));
      const m = Math.max(...z), e = z.map(v => Math.exp(v - m)), sum = e.reduce((a, b) => a + b, 0);
      const p = e.map(v => v / sum);
      probs = probs ? probs.map((q, k) => q + alpha * (p[k] - q)) : p;
      return probs;
    },
  };
}

/**
 * The engine-shaped metric for the summary/findings (`slump_posture`), or null
 * when nothing should be shown. Head-down is left to the neck metrics so it is
 * not reported twice. `learning` → unmeasured until the neutral is learned.
 */
export function slumpMetric(probs, { learning = false } = {}) {
  if (learning) return { value: null, score: 90, unit: "", label: "Slumped posture", reliable: false, severity: "normal" };
  if (!probs) return null;
  let k = 0; for (let i = 1; i < probs.length; i++) if (probs[i] > probs[k]) k = i;
  const kind = SLUMP_CLASSES[k], p = probs[k];
  const shown = kind !== "neutral" && kind !== "head_down" && p >= 0.65;
  const severity = !shown ? "normal" : p >= 0.8 ? "moderate" : "mild";
  return {
    value: Math.round((shown ? p : 0) * 100), score: !shown ? 95 : p >= 0.8 ? 60 : 72, unit: "",
    label: "Slumped posture", reliable: true, severity, kind: shown ? kind : "neutral", source: "model",
  };
}
