/**
 * qaAccuracy — measurement math for the live QA validation protocol.
 *
 * WHAT "ACCURACY" CAN AND CANNOT MEAN HERE
 *
 * There is no motion-capture rig behind a webcam, so we cannot ask the honest
 * accuracy question — "the true neck angle was 22°, what did it report?" Any
 * tool claiming that from a laptop camera is inventing it.
 *
 * What IS measurable, and what this computes, are the four things a clinician
 * or a reviewer would actually ask for:
 *
 *   1. NOISE FLOOR (precision). Hold still; the standard deviation of the
 *      reported value IS the measurement noise, in the metric's own unit. It
 *      is the resolution limit: the engine cannot honestly detect any change
 *      smaller than this, so it bounds every other claim.
 *
 *   2. SENSITIVITY. Hold a deliberate, named fault; did the engine raise the
 *      alert that fault is supposed to raise? Ground truth here is the
 *      INSTRUCTED POSTURE — truth about intent, not about degrees. That is a
 *      real and standard design when a rig is unavailable, and it is labelled
 *      as such rather than dressed up as angular accuracy.
 *
 *   3. SPECIFICITY. Hold a posture that is good but DIFFERENT (reclined
 *      against the backrest, a second relaxed neutral); the engine must stay
 *      quiet. Without this a detector that shouts at everything scores
 *      perfectly — which is exactly what the first version of this tool did,
 *      because every one of its phases was a fault.
 *
 *   4. DISCRIMINATION. How far did the fault move the metric, measured in
 *      units of that metric's own noise (Cohen's d)? A 3-point shift means
 *      nothing if the metric wanders 8 points at rest. This replaces a
 *      pass/fail against an invented fixed threshold.
 *
 * WHY THE CONFIDENCE INTERVAL IS THE POINT
 *
 * One run yields 4 fault trials and 3 control trials. Seven binary outcomes
 * cannot support a number like "94%" — and a percentage printed without its
 * interval is exactly how a QA figure ends up in marketing. Every proportion
 * here carries a Wilson score interval, so a thin run reads "75% (95% CI
 * 30-95%)" and is visibly unquotable. Trials accumulate across runs, so the
 * interval narrows honestly as evidence is gathered rather than by assertion.
 *
 * Frames are NOT trials. Consecutive frames of a held posture are strongly
 * autocorrelated; treating 300 of them as 300 observations would shrink the
 * interval by a factor of ~17 for free. Frames are used for the within-phase
 * estimates (mean, SD, effect size) where correlation is not the issue; the
 * unit of evidence for sensitivity and specificity is the PHASE.
 */

// ── Metric units, straight from the engine's emitted `metrics` block ──
export const METRIC_UNITS = {
  neck_lean: "°", head_tilt: "°", shoulder_level: "°", spine_lean: "°",
  head_yaw: "°", screen_distance: "cm", fhp_index: "cm",
  rounded_shoulders: "depth", torso_flexion: "%", trunk_rotation: "°",
  shoulder_elevation: "%", elbow_angle: "°", monitor_height: "cm",
};

/**
 * Engine alert key -> the metric it is about. The engine emits severity
 * suffixes (`fhp_sev` / `fhp_mid`); both mean "the engine flagged forward head
 * posture", which is the question a sensitivity trial asks.
 */
export const ALERT_TO_METRIC = {
  neck_sev: "neck_lean", neck_mid: "neck_lean",
  tilt: "head_tilt",
  sh: "shoulder_level",
  spine_sev: "spine_lean", spine_mid: "spine_lean",
  yaw: "head_yaw",
  dist_c: "screen_distance", dist_cl: "screen_distance", dist_f: "screen_distance",
  fhp_sev: "fhp_index", fhp_mid: "fhp_index",
  round_sev: "rounded_shoulders", round_mid: "rounded_shoulders",
  slouch_sev: "torso_flexion", slouch_mid: "torso_flexion",
  twist_sev: "trunk_rotation", twist_mid: "trunk_rotation",
  shrug_sev: "shoulder_elevation", shrug_mid: "shoulder_elevation",
  elbow_hi: "elbow_angle", elbow_lo: "elbow_angle",
  mon_low: "monitor_height", mon_hi: "monitor_height",
};

export const PHASE_SECONDS = 12;
/**
 * Discarded from the front of every phase. The tester is still MOVING into the
 * posture for the first couple of seconds, and those frames are neither the
 * previous posture nor this one. Averaging them in was contaminating roughly a
 * fifth of every phase with transition garbage.
 */
export const SETTLE_SECONDS = 3;

/**
 * The protocol. Faults and controls interleave deliberately: a tester who does
 * four faults in a row drifts into exaggerating them.
 *
 * `control` phases are the half that was missing entirely. They are good
 * posture held DIFFERENTLY, and the engine must stay quiet through them.
 */
export const PROTOCOL = [
  { id: "neutral", kind: "control", target: null,
    en: "Sit the way you normally would when working well — relaxed, not rigid",
    ar: "اقعد زي ما بتقعد عادي وانت شغال كويس — مرتاح، مش متحجّر" },

  { id: "fhp", kind: "fault", target: "fhp_index",
    en: "Push your head toward the screen, chin forward — like reading small text",
    ar: "قرّب دماغك من الشاشة ودقنك لقدام — زي ما تقرا خط صغير" },

  { id: "recline", kind: "control", target: null,
    en: "Sit well, but lean back into the chair's backrest — good posture, different shape",
    ar: "اقعد كويس بس استند بضهرك على الكرسي — وضعية سليمة بشكل مختلف" },

  { id: "tilt", kind: "fault", target: "head_tilt",
    en: "Tilt your head sideways, ear toward your shoulder",
    ar: "ميّل دماغك لجنب، ودنك ناحية كتفك" },

  { id: "slouch", kind: "fault", target: "torso_flexion",
    en: "Slump forward from the waist — let your ribs drop toward your hips",
    ar: "اتهدّل لقدام من وسطك — سيب صدرك ينزل ناحية حوضك" },

  { id: "twist", kind: "fault", target: "trunk_rotation",
    en: "Turn your whole torso to one side, as if talking to someone beside you",
    ar: "لُف جسمك كله لجنب، كإنك بتكلم حد جنبك" },

  { id: "neutral_repeat", kind: "control", target: null, repeatOf: "neutral",
    en: "Sit normally again — exactly as you did in the first phase",
    ar: "اقعد عادي تاني — بالظبط زي أول مرحلة" },
];

export const FAULT_PHASES   = PROTOCOL.filter(p => p.kind === "fault");
export const CONTROL_PHASES = PROTOCOL.filter(p => p.kind === "control");

// ── Statistics ────────────────────────────────────────────────────
export function mean(xs) {
  const v = (xs || []).filter(Number.isFinite);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

/** Sample standard deviation (n-1). Needs at least two points to exist. */
export function sd(xs) {
  const v = (xs || []).filter(Number.isFinite);
  if (v.length < 2) return null;
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1));
}

/**
 * Cohen's d — the separation between two postures in units of their own
 * pooled noise. This is the number that says whether a difference is real:
 * d = 0.5 is barely visible above the wobble, d = 3 is unmistakable.
 */
export function cohensD(a, b) {
  const va = (a || []).filter(Number.isFinite), vb = (b || []).filter(Number.isFinite);
  if (va.length < 2 || vb.length < 2) return null;
  const ma = mean(va), mb = mean(vb), sa = sd(va), sb = sd(vb);
  const pooled = Math.sqrt(((va.length - 1) * sa * sa + (vb.length - 1) * sb * sb)
                           / (va.length + vb.length - 2));
  if (!pooled) return null;
  return (ma - mb) / pooled;
}

/**
 * Wilson score interval. Chosen over the textbook normal approximation
 * because that one is badly wrong exactly where this tool lives — small n and
 * proportions near 0 or 1, where it happily produces intervals that extend
 * past 100% or collapse to zero width on a clean sweep. 4 of 4 here reads
 * "100% (95% CI 51-100%)", which is the truth.
 */
export function wilson(k, n, z = 1.96) {
  if (!n) return { p: null, lo: null, hi: null, n: 0, k: 0 };
  const p = k / n, z2 = z * z;
  const denom  = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const half   = (z / denom) * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n));
  return { p, lo: Math.max(0, centre - half), hi: Math.min(1, centre + half), n, k };
}

// ── Per-phase reduction ───────────────────────────────────────────
/**
 * Reduce one phase's frames to what the report needs.
 *
 * `reliable === false` frames are DROPPED, not averaged. The engine returns
 * `score: 90` for a metric it could not measure — a deliberately optimistic
 * placeholder — so including them pulls a fault phase's average UP and makes a
 * working engine look like it missed the fault. That bias lands hardest on the
 * postures that are hardest to track, which are precisely the ones worth
 * testing.
 */
export function phaseStats(frames, metricKey) {
  const usable = (frames || []).filter(f => f && f.t != null);
  const settleCut = usable.length ? usable[0].t + SETTLE_SECONDS * 1000 : 0;
  const held = usable.filter(f => f.t >= settleCut);

  const out = {
    framesTotal: usable.length,
    framesHeld:  held.length,
    framesReliable: 0,
    values: [], scores: [],
    meanValue: null, sdValue: null, meanScore: null,
    alertRate: null, flagged: null, reliableRate: null,
  };
  if (!held.length) return out;

  if (metricKey) {
    const m = held.map(f => f.metrics?.[metricKey]).filter(Boolean);
    // `reliable` is absent on metrics that are always trustworthy (e.g.
    // screen_distance); absent means reliable, false means excluded.
    const good = m.filter(x => x.reliable !== false);
    out.framesReliable = good.length;
    out.reliableRate   = m.length ? good.length / m.length : null;
    out.values = good.map(x => x.value).filter(Number.isFinite);
    out.scores = good.map(x => x.score).filter(Number.isFinite);
    out.meanValue = mean(out.values);
    out.sdValue   = sd(out.values);
    out.meanScore = mean(out.scores);
  }

  // Did the engine RAISE THE ALERT, in its own words? Testing the product's
  // actual output beats testing a score against a threshold invented here.
  const targetKeys = metricKey
    ? Object.keys(ALERT_TO_METRIC).filter(k => ALERT_TO_METRIC[k] === metricKey)
    : null;
  const firedIn = held.map(f => {
    const keys = (f.alertKeys || []);
    return targetKeys ? keys.some(k => targetKeys.includes(k)) : keys.length > 0;
  });
  out.alertRate = firedIn.length ? firedIn.filter(Boolean).length / firedIn.length : null;
  // A phase counts as flagged when the alert stood for a majority of the held
  // window — one flickering frame is not the engine telling the user anything.
  out.flagged = out.alertRate != null ? out.alertRate >= 0.5 : null;
  return out;
}

// ── Whole-run evaluation ──────────────────────────────────────────
/**
 * @param {Object} framesByPhase  { phaseId: [ {t, metrics, alertKeys}, ... ] }
 * @returns a report, plus `trials` to be banked for the cumulative figure.
 */
export function evaluateRun(framesByPhase) {
  const baseline = framesByPhase?.neutral || [];

  // A run is only interpretable if the frames carried the engine's structured
  // alert list. `alerts.detailed` is a property hung on an Array, so it does
  // NOT survive JSON — and the cloud-analysis path serialises the result over
  // the wire. In that mode every frame would look alert-free, every fault
  // would read as missed, and the tool would report 0% sensitivity against a
  // perfectly working engine. That is a broken RUN, not a finding, and it has
  // to say so rather than publish the number.
  const all = Object.values(framesByPhase || {}).flat();
  const usable = all.some(f => f && f.hasDetailed);
  if (all.length && !usable) {
    return { unusable: "no_alert_keys", perPhase: {}, trials: [], repeat: {}, noise: {},
             crosstalk: {}, ...aggregate([]) };
  }
  const perPhase = {};
  const trials   = [];
  const now = Date.now();

  for (const p of PROTOCOL) {
    const frames = framesByPhase?.[p.id] || [];
    const st = phaseStats(frames, p.target);
    perPhase[p.id] = { ...st, id: p.id, kind: p.kind, target: p.target };

    if (!st.framesHeld) { perPhase[p.id].incomplete = true; continue; }

    if (p.kind === "fault") {
      const base = phaseStats(baseline, p.target);
      perPhase[p.id].baselineMeanValue = base.meanValue;
      perPhase[p.id].baselineMeanScore = base.meanScore;
      perPhase[p.id].d = cohensD(st.values, base.values);
      // A fault trial is correct when the engine raised that fault's alert.
      trials.push({ ts: now, phaseId: p.id, kind: "fault", target: p.target,
                    correct: st.flagged === true, flagged: st.flagged,
                    meanValue: st.meanValue, sdValue: st.sdValue,
                    d: perPhase[p.id].d, framesReliable: st.framesReliable });
    } else {
      // A control trial is correct when the engine stayed QUIET. `alertKeys`
      // is the whole alert list here, since a control asserts no fault at all.
      const quiet = phaseStats(frames, null);
      perPhase[p.id].alertRate = quiet.alertRate;
      perPhase[p.id].flagged   = quiet.flagged;
      trials.push({ ts: now, phaseId: p.id, kind: "control", target: null,
                    correct: quiet.flagged === false, flagged: quiet.flagged,
                    framesReliable: st.framesReliable });
    }
  }

  // Repeatability: the same instructed posture, held twice, minutes apart.
  // The gap between the two readings is measurement drift in real units —
  // it cannot be explained away by the tester having changed posture.
  const repeat = {};
  for (const p of PROTOCOL.filter(x => x.repeatOf)) {
    for (const key of Object.keys(METRIC_UNITS)) {
      const a = phaseStats(framesByPhase?.[p.repeatOf] || [], key);
      const b = phaseStats(framesByPhase?.[p.id] || [], key);
      if (a.meanValue == null || b.meanValue == null) continue;
      repeat[key] = { a: a.meanValue, b: b.meanValue,
                      delta: Math.abs(a.meanValue - b.meanValue), unit: METRIC_UNITS[key] };
    }
  }

  // Noise floor from the still baseline: the smallest change the engine can
  // honestly claim to see.
  const noise = {};
  for (const key of Object.keys(METRIC_UNITS)) {
    const st = phaseStats(baseline, key);
    if (st.sdValue != null) noise[key] = { sd: st.sdValue, unit: METRIC_UNITS[key], n: st.framesReliable };
  }

  // Cross-talk: during a fault, which OTHER metrics also moved? The per-metric
  // breakdown the product shows users is only meaningful if a neck fault moves
  // the neck reading and leaves the rest alone. The frames for this were
  // already being collected and thrown away.
  const crosstalk = {};
  for (const p of FAULT_PHASES) {
    const frames = framesByPhase?.[p.id] || [];
    if (!frames.length) continue;
    crosstalk[p.id] = {};
    for (const key of Object.keys(METRIC_UNITS)) {
      const d = cohensD(phaseStats(frames, key).values, phaseStats(baseline, key).values);
      if (d != null && Math.abs(d) >= 0.8) crosstalk[p.id][key] = d;  // "large" by convention
    }
  }

  return { perPhase, trials, repeat, noise, crosstalk, ...aggregate(trials) };
}

/**
 * Sensitivity, specificity and balanced accuracy over any set of trials —
 * this run's, or every run ever banked. Balanced accuracy rather than plain
 * accuracy because the protocol has more fault phases than controls, and
 * plain accuracy would let a trigger-happy engine hide behind that imbalance.
 */
export function aggregate(trials) {
  const t = (trials || []).filter(x => x && typeof x.correct === "boolean");
  const faults   = t.filter(x => x.kind === "fault");
  const controls = t.filter(x => x.kind === "control");
  const sens = wilson(faults.filter(x => x.correct).length, faults.length);
  const spec = wilson(controls.filter(x => x.correct).length, controls.length);
  const balanced = (sens.p != null && spec.p != null) ? (sens.p + spec.p) / 2 : null;
  // The interval on a mean of two independent proportions. Kept deliberately
  // conservative: half the sum of the two half-widths, so it can never look
  // tighter than the weaker of the two measurements it is built from.
  const balancedHalf = (sens.p != null && spec.p != null)
    ? ((sens.hi - sens.lo) / 2 + (spec.hi - spec.lo) / 2) / 2 : null;
  return {
    sensitivity: sens, specificity: spec,
    balanced, balancedLo: balanced == null ? null : Math.max(0, balanced - balancedHalf),
    balancedHi: balanced == null ? null : Math.min(1, balanced + balancedHalf),
    nTrials: t.length,
  };
}

// ── Persistence: trials accumulate so the interval can actually narrow ──
const STORE_KEY = "corvus_qa_trials";
const STORE_CAP = 400;

export function loadTrials() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}

export function saveTrials(trials) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify((trials || []).slice(-STORE_CAP)));
  } catch {}
  return loadTrials();
}

export function clearTrials() {
  try { localStorage.removeItem(STORE_KEY); } catch {}
  return [];
}

/** A number and its interval, formatted so the interval cannot be dropped. */
export function fmtPct(p, lo, hi) {
  if (p == null) return "—";
  const r = v => Math.round(v * 100);
  return (lo == null || hi == null) ? `${r(p)}%` : `${r(p)}% (95% CI ${r(lo)}–${r(hi)}%)`;
}
