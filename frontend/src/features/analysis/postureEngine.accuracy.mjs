/**
 * Posture engine — accuracy, precision and invariance measurement.
 *
 *   node src/features/analysis/postureEngine.accuracy.mjs
 *   node src/features/analysis/postureEngine.accuracy.mjs --verbose
 *
 * postureEngine.selftest.mjs checks invariants: that a score moves the right
 * way, that nothing returns NaN, that the weights sum to one. Those are real
 * tests and they caught real bugs. This file asks the different and harder
 * question — is the number CORRECT — by posing a synthetic subject at known
 * angles (syntheticSubject.mjs) and comparing what the engine reports.
 *
 * Three properties, which are genuinely different things:
 *
 *   ACCURACY   bias and error against the true value. "Says 8cm when it is 8cm."
 *   PRECISION  spread of repeated readings of the SAME pose under landmark
 *              noise. Users notice jitter immediately and bias never.
 *   INVARIANCE how far a reading drifts when something that should not matter
 *              changes — seating distance, body size, camera height. This is
 *              where posture systems usually fail and where this engine's worst
 *              bugs lived.
 *
 * A fourth section, RESPONSE, checks that each posture defect actually costs
 * points. A metric that is measured, displayed and weighted but moves the score
 * by two points is not doing its job, and that was true of the entire sagittal
 * plane — forward head, slouching, rounded shoulders — which is the actual
 * epidemiology of desk work.
 *
 * Scope, stated honestly: this measures the engine's geometry against a
 * rigid-body model with no MediaPipe estimation error and no soft tissue. It is
 * a necessary condition for accuracy, not a sufficient one, and it is not a
 * clinical validation. What it proves is that the arithmetic is right; whether
 * the thresholds are clinically meaningful is a separate question this cannot
 * answer.
 */

import { analyzeMP, resetProportions } from "./postureEngine.js";
import { renderSubject, jitter, mulberry32, DEFAULT_BODY } from "./syntheticSubject.mjs";

const VERBOSE = process.argv.includes("--verbose");
const W = 1280, H = 720;

let pass = 0, fail = 0;
const failures = [];
const check = (name, ok, detail) => {
  if (ok) { pass++; if (VERBOSE) console.log(`  ok    ${name}${detail ? " — " + detail : ""}`); }
  else { fail++; failures.push(`${name} — ${detail}`); console.log(`  FAIL  ${name} — ${detail}`); }
};
const fmt = n => (n === null || n === undefined || Number.isNaN(n)) ? "n/a" : (Math.round(n * 100) / 100).toFixed(2);

/**
 * Settle at neutral, then adopt the test pose.
 *
 * Several metrics learn the user's own neutral from their first seconds
 * (shoulder elevation, trunk rotation, torso flexion, forward head) because
 * they are ratios of that person's skeleton and no population constant works.
 * Reading them from a single static pose measures the warm-up, not the metric —
 * they would learn the TEST pose as neutral and report zero. Every reading here
 * therefore establishes a real neutral first, which is also what a user does.
 */
function read(pose = {}, { body = {}, camera = {}, settle = 120, hold = 40, noisePx = 0, seed = 1 } = {}) {
  resetProportions();
  const rng = mulberry32(seed);
  const frame = (p) => {
    let lms = renderSubject(p, body, camera);
    if (noisePx > 0) lms = jitter(lms, noisePx, camera, rng);
    return analyzeMP(lms, W, H, "front");
  };
  let r = null;
  for (let i = 0; i < settle; i++) r = frame({});
  for (let i = 0; i < hold; i++) r = frame(pose);
  return r;
}

/** Like read(), but lets a test corrupt the landmarks before the engine sees them. */
function readRaw(pose = {}, corrupt = (l) => l, { settle = 130, hold = 50 } = {}) {
  resetProportions();
  let r = null;
  const frame = (p) => { r = analyzeMP(corrupt(renderSubject(p, {}, {})), W, H, "front"); };
  for (let i = 0; i < settle; i++) frame({});
  for (let i = 0; i < hold; i++) frame(pose);
  return r;
}

/** Like read(), but with a chosen depth-noise multiplier. */
function readNoisy(pose = {}, zSigmaMult = 3, { settle = 130, hold = 50, seed = 5 } = {}) {
  resetProportions();
  const rng = mulberry32(seed);
  let r = null;
  const frame = (p) => {
    r = analyzeMP(jitter(renderSubject(p, {}, {}), 1.5, {}, rng, { zSigmaMult }), W, H, "front");
  };
  for (let i = 0; i < settle; i++) frame({});
  for (let i = 0; i < hold; i++) frame(pose);
  return r;
}

/**
 * Four analyzers need the hip landmarks: torso flexion, trunk rotation, spine
 * lean, and shoulder protraction. At the 50-80cm the app asks users to sit at,
 * the hips sit a full frame-height below the bottom edge and MediaPipe cannot
 * see them — measured in this fixture, they do not enter frame until ~130cm.
 *
 * That splits every question about those metrics in two, and the two need
 * different cameras:
 *
 *   HIPS_IN_SHOT   does the maths work, given the landmarks it needs
 *   the default    does the metric work for someone sitting at a laptop
 *
 * Tests using HIPS_IN_SHOT answer the first. The framing group at the end of
 * this file answers the second, and the answer there is currently no — which
 * is a finding about the product, not a test to be made green.
 */
const HIPS_IN_SHOT = { camera: { distCm: 140 } };

const val = (r, k) => r?.metrics?.[k]?.value;
const THR_SHRUG_OK = 3;   // THR.SHOULDER_ELEV.ok in postureEngine.js
const stats = (xs) => {
  const c = xs.filter(Number.isFinite);
  if (!c.length) return { n: 0, mean: NaN, sd: NaN, min: NaN, max: NaN };
  const mean = c.reduce((a, b) => a + b, 0) / c.length;
  return { n: c.length, mean, sd: Math.sqrt(c.reduce((a, b) => a + (b - mean) ** 2, 0) / c.length),
           min: Math.min(...c), max: Math.max(...c) };
};

console.log("\n══ Posture engine — accuracy, precision, invariance ══\n");

// ═══════════════════════════════════════════════════════════════════
console.log("ACCURACY — reported vs known truth");

{
  // Forward head displacement. The headline measurement, because forward head
  // posture is the single most common desk complaint and the engine was until
  // recently almost blind to it: from a front camera the movement is along the
  // camera axis and barely changes any x or y. It is now recovered from the
  // apparent size of the head against the shoulders.
  const truths = [0, 3, 5, 8, 12];
  const errs = [];
  if (VERBOSE) console.log("\n  Forward head");
  for (const t of truths) {
    const got = val(read({ forwardHeadCm: t }), "fhp_index");
    const e = got - t;
    if (t > 0) errs.push(e);
    if (VERBOSE) console.log(`    true ${String(t).padStart(2)}cm  ->  read ${fmt(got)}cm   err ${fmt(e)}cm`);
  }
  const s = stats(errs);
  const rms = Math.sqrt(errs.reduce((a, e) => a + e * e, 0) / errs.length);
  check("Forward head: bias within ±2.5cm", Math.abs(s.mean) <= 2.5, `bias ${fmt(s.mean)}cm, rms ${fmt(rms)}cm`);
  check("Forward head: RMS error within 2.5cm", rms <= 2.5, `rms ${fmt(rms)}cm`);
}

{
  // Lateral lean — the one plane a front camera sees directly, so this should
  // be the most accurate metric in the engine and is the control for the rest.
  const truths = [0, 5, 10, 15, 20, 25];
  const errs = [];
  if (VERBOSE) console.log("\n  Lateral lean");
  for (const t of truths) {
    const got = val(read({ lateralLeanDeg: t }, HIPS_IN_SHOT), "spine_lean");
    errs.push(got - t);
    if (VERBOSE) console.log(`    true ${String(t).padStart(2)}°  ->  read ${fmt(got)}°   err ${fmt(got - t)}°`);
  }
  const rms = Math.sqrt(errs.reduce((a, e) => a + e * e, 0) / errs.length);
  check("Lateral lean: RMS error within 2°", rms <= 2, `rms ${fmt(rms)}°`);
}

{
  // Trunk rotation. Measured against the hip line, so it is invariant to
  // everything the head does — it used to use the eye separation as its ruler
  // and consequently reported a 33° twist for a pure forward lean.
  const truths = [0, 10, 20, 30, 40];
  const errs = [];
  if (VERBOSE) console.log("\n  Trunk rotation");
  for (const t of truths) {
    const got = val(read({ trunkRotDeg: t }, HIPS_IN_SHOT), "trunk_rotation");
    errs.push(got - t);
    if (VERBOSE) console.log(`    true ${String(t).padStart(2)}°  ->  read ${fmt(got)}°   err ${fmt(got - t)}°`);
  }
  const rms = Math.sqrt(errs.reduce((a, e) => a + e * e, 0) / errs.length);
  check("Trunk rotation: RMS error within 5°", rms <= 5, `rms ${fmt(rms)}°`);
}

{
  // Head yaw. This used to be the weakest metric in the engine and the
  // assertions here said so — a "bounded over-read" of up to 1.6x, asserted
  // as a gain rather than an accuracy, because that was what it honestly was.
  //
  // The old estimator inferred the angle from how far the nose sat off the eye
  // midline, scaled by a population constant for the nose's lever arm. That
  // constant could not be learned per user: at neutral the nose offset is zero
  // whatever the constant is, so there was no signal. It also assumed an
  // orthographic projection, so it over-read more the closer the user sat.
  //
  // It now reads the eye pair's DEPTH difference instead. Turning the head
  // moves one outer eye corner toward the camera and the other away, so
  // tan(theta) = dz/dx straight from the landmarks — no nose, no anatomical
  // constant, and the eye span cancels. Asserted as accuracy now, because it
  // is accuracy.
  const truths = [10, 20, 30, 40];
  const errs = [];
  if (VERBOSE) console.log("\n  Head yaw");
  for (const t of truths) {
    const got = val(read({ headYawDeg: t }), "head_yaw");
    errs.push(Math.abs(got - t));
    if (VERBOSE) console.log(`    true ${String(t).padStart(2)}°  ->  read ${fmt(got)}°   err ${fmt(Math.abs(got - t))}°`);
  }
  const e = stats(errs);
  check("Head yaw: within 3° of truth", e.max <= 3, `worst ${fmt(e.max)}°`);
  check("Head yaw: no systematic over-read", e.mean <= 2, `mean ${fmt(e.mean)}°`);

  // The old method's error grew as the user sat closer, because the nose is
  // nearer the camera than the eye corners and is magnified: a true 30° read
  // 41° at 45cm and 36° at 100cm. Depth-difference has no such term, and the
  // residual perspective is divided out using the eye span this frame gives
  // us and the previous frame's distance.
  if (VERBOSE) console.log("\n  Head yaw across distances (was 41° at 45cm vs 36° at 100cm, for 30°)");
  const across = [];
  for (const d of [45, 60, 80, 100]) {
    const got = val(read({ headYawDeg: 30 }, { camera: { distCm: d } }), "head_yaw");
    across.push(got);
    if (VERBOSE) console.log(`    ${String(d).padStart(3)}cm  ->  ${fmt(got)}°`);
  }
  const spread = Math.max(...across) - Math.min(...across);
  check("Head yaw: same angle reads the same at any distance", spread <= 3, `spread ${fmt(spread)}° across 45-100cm`);
}

{
  // "Screen distance" is EYE to screen, which is what a user cares about and
  // what the engine reports — it measures the inter-pupillary distance. The
  // camera parameter here is set relative to the shoulder PLANE, and the eyes
  // sit DEFAULT_BODY.eyeAheadCm in front of it, so the truth to compare
  // against is that much less.
  //
  // Worth spelling out because the first version of this check did not, saw a
  // clean -6cm offset at every distance, and briefly looked like a systematic
  // engine bias. It was the harness measuring from the wrong landmark.
  const EYE_AHEAD = DEFAULT_BODY.eyeAheadCm;
  const dists = [45, 50, 60, 70, 80, 90];
  const pct = [];
  if (VERBOSE) console.log("\n  Screen distance (eye to camera)");
  for (const d of dists) {
    const truth = d - EYE_AHEAD;
    const got = val(read({}, { camera: { distCm: d } }), "screen_distance");
    pct.push(Math.abs(100 * (got - truth) / truth));
    if (VERBOSE) console.log(`    true ${String(truth).padStart(2)}cm  ->  read ${fmt(got)}cm   err ${fmt(100 * (got - truth) / truth)}%`);
  }
  check("Distance: worst error within 6%", Math.max(...pct) <= 6, `worst ${fmt(Math.max(...pct))}%`);
}

// ═══════════════════════════════════════════════════════════════════
{
  // Rounded shoulders. This metric reported `reliable: false` for every user
  // who had not run the calibration wizard — which is almost all of them — so
  // it contributed nothing and fired no alert. The reason was honest: its
  // ear-to-shoulder ratio mostly measured neck length, and its neutral
  // constant of 0.52 is a value no real body has (0.20-0.43 across the
  // plausible adult range), so an uncalibrated user was told their shoulders
  // were forward while sitting upright.
  //
  // It now measures protraction directly: how far in front of the hip-to-ear
  // axis the shoulders sit, in centimetres, self-baselined against the user's
  // own neutral. A forward head moves the ear and not the shoulder, so it
  // pushes the reading the other way instead of masquerading as rounding.
  const got = [3, 6, 9].map(cm => val(read({ roundShoulderCm: cm }, HIPS_IN_SHOT), "rounded_shoulders"));
  if (VERBOSE) {
    console.log("\n  Rounded shoulders (protraction)");
    [3, 6, 9].forEach((cm, i) => console.log(`    true ${cm}cm  ->  read ${fmt(got[i])}cm`));
  }
  check("Rounded shoulders: responds without calibration",
        got.every(Number.isFinite) && got[2] > 0, `9cm reads ${fmt(got[2])}`);
  check("Rounded shoulders: monotonic in the true displacement",
        got[0] < got[1] && got[1] < got[2], `${got.map(x => fmt(x)).join(" < ")}`);

  // The two failure modes that made the old metric useless: reading high on a
  // neutral subject, and confusing a forward head for rounded shoulders.
  const neutral = val(read({}, HIPS_IN_SHOT), "rounded_shoulders");
  check("Rounded shoulders: reads ~0 on a neutral subject", neutral <= 1, `${fmt(neutral)}cm`);
  const fwdHead = val(read({ forwardHeadCm: 6 }, HIPS_IN_SHOT), "rounded_shoulders");
  check("Rounded shoulders: a forward head is not read as rounding", fwdHead <= 1, `${fmt(fwdHead)}cm`);

  // A rigid trunk lean keeps hips, shoulders and ears collinear, so it should
  // largely cancel rather than register as protraction.
  const lean = val(read({ trunkFlexDeg: 20 }, HIPS_IN_SHOT), "rounded_shoulders");
  check("Rounded shoulders: a trunk lean barely leaks in", lean <= 2.5, `${fmt(lean)}cm at 20°`);

  // Anatomy must cancel: the baseline is what makes this body-independent.
  const perBody = [
    { neckLenCm: 15, torsoLenCm: 56 },
    { neckLenCm: 9,  torsoLenCm: 48 },
    { shoulderWidthCm: 48, hipWidthCm: 36 },
  ].map(body => val(read({ roundShoulderCm: 6 }, { body, ...HIPS_IN_SHOT }), "rounded_shoulders"));
  const spread = Math.max(...perBody) - Math.min(...perBody);
  if (VERBOSE) console.log(`    same 6cm across long neck / short neck / broad frame: ${perBody.map(x => fmt(x)).join(", ")}`);
  check("Rounded shoulders: same displacement reads the same on any build",
        spread <= 1, `spread ${fmt(spread)}cm`);
}

{
  // Elbow angle, in 3D. The synthetic subject is posed at a true 92.5° — a
  // correct typing arm — and the engine used to read 164° from it, because a
  // typing forearm points at the camera and all but vanishes in the image
  // plane. 164° is scored as "Elbows too low — raise keyboard", so the engine
  // told a correctly seated person to rebuild their desk.
  //
  // It never surfaced because a second bug kept the metric permanently
  // unreliable and therefore unweighted (see the caching note in analyzeMP).
  // Fixing that one exposed this one — the selftest's headline assertions
  // started failing with "got elbow" for poses that are nothing to do with
  // arms.
  const elbow = val(read({ lateralLeanDeg: 12 }, HIPS_IN_SHOT), "elbow_angle");
  if (VERBOSE) console.log(`\n  Elbow angle: read ${fmt(elbow)}° (true 92.5°, was 164° in 2D)`);
  check("Elbow: a typing arm is not read as straight", elbow < 140, `${fmt(elbow)}°`);
  check("Elbow: a typing arm scores as acceptable",
        val(read({ lateralLeanDeg: 12 }, HIPS_IN_SHOT), "elbow_angle") > 80, `${fmt(elbow)}°`);
  // Honest limit: 3D recovery still reads ~28° high against the fixture's
  // known 92.5°, so this asserts the alert outcome rather than an accuracy
  // figure. It is inside the 90-120° band the guidance is written about, and
  // no longer fires, which is what matters to a user. The residual is the next
  // thing to check against a real camera.
}

console.log("\nRESPONSE — each defect must actually cost points");

{
  const neutral = read({})?.score;
  if (VERBOSE) console.log(`\n  neutral score ${neutral}`);
  const cases = [
    ["Neck flexion 25°",      { neckFlexDeg: 25 },      4],
    ["Forward head 8cm",      { forwardHeadCm: 8 },     5],
    ["Trunk flexion 20°",     { trunkFlexDeg: 20 },     8],
    // Protraction now measures properly (see the accuracy group above), but it
    // needs the hips, and at the default camera here — the 50-80cm the app
    // asks users to sit at — the hips are below the bottom edge. So this
    // costs exactly zero points for a real laptop user, and the assertion
    // says so rather than being quietly moved to a camera where it passes.
    // The framing group asserts the same fact directly.
    ["Rounded shoulders 6cm", { roundShoulderCm: 6 },   0],
    ["Lateral lean 15°",      { lateralLeanDeg: 15 },  10],
    ["Trunk rotation 30°",    { trunkRotDeg: 30 },      8],
    ["Shoulder shrug 4cm",    { shoulderElevCm: 4 },    2],
  ];
  for (const [label, pose, minDrop] of cases) {
    // Deliberately the DEFAULT camera for every case here: this section is
    // about what a defect actually costs a user sitting where the app tells
    // them to sit, which for the hip-dependent metrics is nothing at all.
    const s = read(pose)?.score;
    const drop = neutral - s;
    if (VERBOSE) console.log(`    ${label.padEnd(24)} ${neutral} -> ${s}  (−${fmt(drop)})`);
    check(`${label} costs >= ${minDrop} points`, drop >= minDrop, `dropped ${fmt(drop)}`);
  }

  check("Neutral posture scores >= 85", neutral >= 85, `score ${neutral}`);

  const bad = read({ neckFlexDeg: 25, trunkFlexDeg: 15, roundShoulderCm: 5, forwardHeadCm: 6 })?.score;
  check("Compound bad posture drops >= 25 points", (neutral - bad) >= 25, `${neutral} -> ${bad}`);
}

// ═══════════════════════════════════════════════════════════════════
console.log("\nALERTS — the right instruction, and only the right one");

{
  // alerts[0] is what App.jsx shows the user AND what it stores as the
  // session's alert cause, so its correctness matters twice.
  // Poses involving the hips (lean, twist, slouch, rounding) are read with a
  // camera that can see them — otherwise this would be testing the framing
  // limitation rather than the alert logic, which the framing group covers.
  const needsHips = (pose) => ["lateralLeanDeg","trunkRotDeg","trunkFlexDeg","roundShoulderCm"]
    .some(k => pose[k]);
  // The distance alert is filtered out for hip poses, and the reason is the
  // uncomfortable part: there is no camera distance that satisfies both
  // conditions. The hips need ~130cm to enter frame; the app tells users to
  // sit at 50-80cm. Those ranges do not overlap, so a fixture posed far
  // enough back to exercise these analyzers is, correctly, told it is too far
  // away. Dropping that one alert keeps these tests about the alert logic.
  // The fact that the ranges do not overlap is the product finding, and it is
  // asserted directly in the framing group rather than left implied here.
  const TOO_FAR = /Too far|Very close|ideal 50/i;
  const alertsFor = (pose) => {
    const hips = needsHips(pose);
    return (read(pose, hips ? HIPS_IN_SHOT : {})?.alerts || [])
      .filter(Boolean)
      .filter(a => !(hips && TOO_FAR.test(a)));
  };

  const quiet = alertsFor({});
  if (VERBOSE && quiet.length) quiet.forEach(a => console.log(`    (neutral) ${a}`));
  check("Correct posture fires NO alerts", quiet.length === 0,
        `${quiet.length}: ${quiet.join(" | ") || "-"}`);

  const cases = [
    ["Lateral lean",   { lateralLeanDeg: 18 }, /Leaning (right|left)/],
    ["Forward head",   { forwardHeadCm: 8 },   /Forward head/],
    ["Trunk rotation", { trunkRotDeg: 35 },    /twisted/i],
    ["Slouch",         { trunkFlexDeg: 20 },   /Slouch|slump/i],
    ["Head turned",    { headYawDeg: 35 },     /Head turned/],
  ];
  for (const [label, pose, wanted] of cases) {
    const a = alertsFor(pose);
    if (VERBOSE) { console.log(`    ${label}:`); a.forEach(x => console.log(`      ${x}`)); }
    check(`${label}: the right instruction is present`, a.some(x => wanted.test(x)),
          a.join(" | ") || "no alerts");
    // One fault should not produce a wall of corrections. A lateral lean used
    // to fire eight, led by "tuck chin slightly".
    check(`${label}: at most 3 alerts`, a.length <= 3, `${a.length} alerts`);
  }

  // Lateral lean must not be headlined by a neck/chin/armrest instruction —
  // those describe the same event with the wrong correction.
  const lean = alertsFor({ lateralLeanDeg: 18 });
  check("Lateral lean is not headlined by chin/armrest advice",
        !/tuck chin|armrest|chair height/i.test(lean[0] || ""), `headline: ${lean[0]}`);

  // The LIVE headline — alerts.detailed[0] — is what App.jsx now shows on
  // screen, speaks aloud and pushes as a desktop notification. Before it was
  // wired to this list the live loop ran its own hardcoded neck/yaw/distance
  // chain that knew nothing about forward head, slouching, twist or shrug.
  const headlineKey = (pose) => {
    // Same reasoning as alertsFor above.
    const hips = needsHips(pose);
    const det = (read(pose, hips ? HIPS_IN_SHOT : {})?.alerts?.detailed || [])
      .filter(x => !(hips && TOO_FAR.test(x?.text || "")));
    const d = det[0];
    return d ? String(d.key).replace(/_(sev|mid|cl|c|f|hi|lo|calib_tip)$/, "") : null;
  };
  const headlines = [
    ["upright",      {},                     null],
    ["forward head", { forwardHeadCm: 8 },   "fhp"],
    ["lateral lean", { lateralLeanDeg: 18 }, "spine"],
    ["trunk twist",  { trunkRotDeg: 35 },    "twist"],
    ["shoulder shrug",{ shoulderElevCm: 4 }, "shrug"],
  ];
  for (const [label, pose, want] of headlines) {
    const got = headlineKey(pose);
    if (VERBOSE) console.log(`    live headline, ${label}: ${got ?? "(none)"}`);
    check(`Live headline for ${label} is ${want ?? "nothing"}`, got === want, `got ${got ?? "(none)"}`);
  }

  // Per-side shoulder elevation must not read a rigid lean as a shrug.
  // Scoring each side against its own baseline made this possible for the
  // first time: a lateral lean rotates the shoulder-ear frame, so measured
  // along the image vertical one side's gap closes and the other opens, and
  // the larger of the two wins. These pin down that a lean is a lean, a shrug
  // is a shrug, and a one-sided shrug is still caught at full severity.
  const shrugOf = (pose) => {
    const m = read(pose)?.metrics?.shoulder_elevation;
    return { pct: m?.value ?? 0, side: read(pose)?.bodyModules?.shoulderElev?.asymmetric ?? null };
  };
  const leanShrug  = shrugOf({ lateralLeanDeg: 18 });
  const bothShrug  = shrugOf({ shoulderElevCm: 4 });
  if (VERBOSE) console.log(`\n  shrug reading: 18° lean → ${fmt(leanShrug.pct)}%, real 4cm shrug → ${fmt(bothShrug.pct)}%`);
  check("An 18° lateral lean is not read as a shrug",
        leanShrug.pct < THR_SHRUG_OK, `${fmt(leanShrug.pct)}% (ok threshold ${THR_SHRUG_OK}%)`);
  check("A lateral lean is not blamed on one shoulder",
        leanShrug.side === null, `side: ${leanShrug.side}`);
  check("A real shrug still registers",
        bothShrug.pct > THR_SHRUG_OK, `${fmt(bothShrug.pct)}%`);

  // Severity levels of one metric are mutually exclusive.
  const slouch = alertsFor({ trunkFlexDeg: 20 });
  const both = slouch.some(x => /Slouching forward/.test(x)) && slouch.some(x => /starting to slump/.test(x));
  check("Slump alert does not fire at two severities at once", !both, slouch.join(" | "));
}

// ═══════════════════════════════════════════════════════════════════
console.log("\nPRECISION — repeated readings of one pose under landmark noise");

{
  // 1.5px sigma at 720p is a fair stand-in for MediaPipe's frame-to-frame
  // jitter on a static subject.
  const pose = { neckFlexDeg: 12, forwardHeadCm: 4 };
  const scores = [], fhps = [];
  for (let i = 0; i < 20; i++) {
    const r = read(pose, { noisePx: 1.5, seed: 1000 + i });
    scores.push(r?.score); fhps.push(val(r, "fhp_index"));
  }
  const ss = stats(scores), fs = stats(fhps);
  if (VERBOSE) {
    console.log(`    score  mean ${fmt(ss.mean)}  sd ${fmt(ss.sd)}  range ${fmt(ss.min)}–${fmt(ss.max)}`);
    console.log(`    fhp    mean ${fmt(fs.mean)}  sd ${fmt(fs.sd)}  range ${fmt(fs.min)}–${fmt(fs.max)}`);
  }
  check("Score SD under 1.5px noise <= 3 points", ss.sd <= 3, `sd ${fmt(ss.sd)}`);
  check("Score range under noise <= 12 points", (ss.max - ss.min) <= 12, `range ${fmt(ss.max - ss.min)}`);
  check("Forward head SD under noise <= 2cm", fs.sd <= 2, `sd ${fmt(fs.sd)}cm`);
}

{
  // Head yaw now reads MediaPipe's z, and z is the channel this harness was
  // silently flattering: jitter() perturbed x and y and left z exactly as the
  // projection produced it, so anything depending on depth looked perfect here
  // and would have been shaky in front of a camera. z is now noised too, at a
  // deliberately pessimistic 3x the x/y sigma, because MediaPipe REGRESSES
  // depth from a single view rather than measuring it.
  //
  // The estimator answers that with a 12-frame rolling median and a fallback
  // to the old nose-offset method when the two disagree by more than 25°,
  // which is what a device with unusable z looks like.
  const yaws = [];
  for (let i = 0; i < 20; i++) {
    yaws.push(val(read({ headYawDeg: 25 }, { noisePx: 1.5, seed: 2000 + i }), "head_yaw"));
  }
  const y = stats(yaws);
  if (VERBOSE) {
    console.log(`    yaw    mean ${fmt(y.mean)}°  sd ${fmt(y.sd)}°  range ${fmt(y.min)}–${fmt(y.max)}°  (true 25°)`);
  }
  check("Head yaw stays accurate under z noise", Math.abs(y.mean - 25) <= 3, `mean ${fmt(y.mean)}° vs 25°`);
  check("Head yaw SD under noise <= 3°", y.sd <= 3, `sd ${fmt(y.sd)}°`);
  check("Head yaw never inverts sign under noise", y.min > 0, `min ${fmt(y.min)}°`);
}

{
  const a = read({ neckFlexDeg: 14 })?.score;
  const b = read({ neckFlexDeg: 14 })?.score;
  check("Deterministic without noise", a === b, `${a} / ${b}`);
}

// ═══════════════════════════════════════════════════════════════════
{
  // Degrading safely is a separate property from being accurate, and the only
  // one that matters on a device this was never tested on.
  //
  // Two metrics now read MediaPipe's z, which is regressed rather than
  // measured and varies by device. Before this gate existed, a camera with a
  // poor depth channel produced CONFIDENT WRONG numbers: at 12x the x/y noise
  // head yaw read 37 deg for a true 30 and still said reliable, and shoulder
  // protraction read 8.3cm for a true 6cm. With z dead — a flat column of
  // zeros, which some builds produce — protraction read 0.0cm, "no rounding",
  // reliable, for a subject rounded 6cm. Silently telling someone their
  // posture is fine is the worst available failure.
  const killZ = (lms) => lms.map(l => ({ ...l, z: 0 }));
  const deadZ = readRaw({ roundShoulderCm: 6 }, killZ);
  const rs = deadZ?.metrics?.rounded_shoulders;
  if (VERBOSE) console.log(`\n  Depth channel dead: rounded reads ${fmt(rs?.value)} reliable=${rs?.reliable}`);
  check("Dead depth channel: protraction reports unreliable rather than zero",
        rs && rs.reliable === false, `reliable=${rs?.reliable}, value ${fmt(rs?.value)}`);

  const noisyZ = (lms, rng) => lms;  // noise applied via noisePx below
  const heavy = readNoisy({ roundShoulderCm: 6 }, 12, HIPS_IN_SHOT);
  const rs2 = heavy?.metrics?.rounded_shoulders;
  if (VERBOSE) console.log(`  Depth 12x noisy:    rounded reads ${fmt(rs2?.value)} reliable=${rs2?.reliable}`);
  check("Noisy depth channel: protraction reports unreliable rather than wrong",
        rs2 && rs2.reliable === false, `reliable=${rs2?.reliable}, value ${fmt(rs2?.value)}`);
}

{
  // FRAMING. The finding a real camera produced, asserted directly so it
  // cannot quietly stop being true — in either direction.
  //
  // Four analyzers need the hip landmarks. A laptop webcam at the distance
  // this app asks for cannot see them, and the two ranges do not overlap:
  // hips enter frame at roughly 130cm, the app asks for 50-80cm. Whatever is
  // eventually done about that — a wider-angle assumption, a sagittal method
  // that does not need hips, or telling the user plainly — these assertions
  // are what changes when it is.
  const hipY = (d) => renderSubject({}, {}, { distCm: d })[23];
  check("Hips are out of frame at the distance the app asks for",
        hipY(60).visibility < 0.55 && hipY(80).visibility < 0.55,
        `vis ${fmt(hipY(60).visibility)} at 60cm, ${fmt(hipY(80).visibility)} at 80cm`);
  check("Hips only become visible far outside that range",
        hipY(130).visibility >= 0.55, `vis ${fmt(hipY(130).visibility)} at 130cm`);

  // What that costs, metric by metric, for someone sitting where they are told.
  const laptop = read({ forwardHeadCm: 8, trunkFlexDeg: 20, roundShoulderCm: 6 });
  const counted = (k) => laptop?.metrics?.[k]?.reliable === true;
  if (VERBOSE) {
    console.log("\n  At 60cm, holding forward head 8cm + trunk lean 20° + rounding 6cm:");
    for (const [k, v] of Object.entries(laptop?.metrics || {}))
      if (v && typeof v === "object" && "reliable" in v)
        console.log(`    ${k.padEnd(20)} ${String(v.value).padStart(6)} ${v.reliable ? "counted" : "NOT COUNTED"}`);
  }
  check("Forward head still works at laptop framing", counted("fhp_index"),
        `${fmt(val(laptop, "fhp_index"))}cm`);
  check("Head yaw, tilt and shoulder level still work at laptop framing",
        counted("head_yaw") && counted("head_tilt") && counted("shoulder_level"), "");
  check("The hip-dependent metrics are excluded, not guessed",
        !counted("torso_flexion") && !counted("trunk_rotation") && !counted("rounded_shoulders"),
        "torso/twist/rounding all report unreliable");

  // And the thing that must never regress: no number is invented in their place.
  check("Forward slouch never renders as undefined",
        laptop?.metrics?.torso_flexion?.value === 0,
        `value ${laptop?.metrics?.torso_flexion?.value}`);

  // The engine has to HAND that fact to the UI, not merely act on it
  // internally. Everything above was already true before coverageDetail
  // existed — and the page still displayed a single unqualified score,
  // because nothing downstream had any way to know what had been dropped.
  const cov = laptop?.coverageDetail;
  check("The engine reports which metrics it could not measure",
        !!cov && Array.isArray(cov.missing) && cov.missing.length > 0,
        cov ? `missing: ${cov.missing.join(", ")}` : "coverageDetail absent");
  check("It reports the hips as out of frame at laptop distance",
        cov?.hipsInFrame === false, `hipsInFrame=${cov?.hipsInFrame}`);
  check("The counts add up and are not the full set",
        cov?.measured > 0 && cov?.measured < cov?.total,
        `${cov?.measured} of ${cov?.total}`);
  // The number the banner shows. If this ever reads ~100 at laptop framing,
  // the UI has gone back to claiming a complete reading.
  check("Less than 80% of the weight table survives laptop framing",
        cov?.weightPct > 0 && cov?.weightPct < 80, `${cov?.weightPct}%`);

  // The converse, so a broken reliability flag cannot make every session look
  // partial: with the hips genuinely in shot, nothing should be reported
  // missing on account of framing.
  const wide = read({ forwardHeadCm: 8, trunkFlexDeg: 20, roundShoulderCm: 6 }, HIPS_IN_SHOT);
  const wcov = wide?.coverageDetail;
  const wideMissing = new Set(wcov?.missing || []);
  check("With the hips in shot, nothing is reported missing on their account",
        wcov?.hipsInFrame === true
          && !wideMissing.has("spine_lean") && !wideMissing.has("rounded_shoulders")
          && !wideMissing.has("torso_flexion") && !wideMissing.has("trunk_rotation"),
        `hipsInFrame=${wcov?.hipsInFrame} · missing: ${(wcov?.missing||[]).join(", ")||"none"}`);
  // Coverage has to actually MOVE with framing, or the banner is decoration.
  // Elbow stays out of shot at 140cm, so this is not 100 — it is "much more
  // of the body than the laptop case", which is the claim being made.
  check("Backing off the camera recovers most of the weight table",
        wcov?.weightPct - cov?.weightPct >= 20,
        `${cov?.weightPct}% at 60cm → ${wcov?.weightPct}% at 140cm`);
}

{
  // POSITIONING. Sitting a foot from the screen used to cost about five points
  // and was reported as "Excellent" while the distance chip beside it was red,
  // because the chip follows the measured distance and the penalty followed a
  // separate frame-crop check. These assert that one instruction and one
  // number now move together.
  const at = (d) => {
    resetProportions();
    let r = null;
    for (let i = 0; i < 170; i++) r = analyzeMP(renderSubject({}, {}, { distCm: d }), W, H, "front");
    return r;
  };
  const ideal = at(65), close = at(40), veryClose = at(33), far = at(105);
  if (VERBOSE) {
    console.log("\n  Seating distance (rig cm = lens to mid-shoulder; the engine reads the EYE plane, ~6cm nearer)");
    for (const [n, r] of [["65", ideal], ["40", close], ["33", veryClose], ["105", far]])
      console.log(`    ${n.padStart(3)}cm rig → reads ${r.distCm}cm  score ${r.score}  penalty ${r.positionPenalty}`);
  }
  check("Sitting at the recommended distance costs nothing",
        ideal.positionPenalty === 0 && ideal.score >= 95,
        `reads ${ideal.distCm}cm · score ${ideal.score}`);
  check("Sitting too close is charged, not just coloured",
        close.positionPenalty >= 6, `penalty ${close.positionPenalty} at a reading of ${close.distCm}cm`);
  check("Closer costs more than close",
        veryClose.positionPenalty > close.positionPenalty,
        `${close.positionPenalty} at ${close.distCm}cm → ${veryClose.positionPenalty} at ${veryClose.distCm}cm`);
  check("A foot from the screen can no longer read as excellent",
        veryClose.score < 85, `score ${veryClose.score}`);
  check("Too far is charged the same way",
        far.positionPenalty >= 6, `penalty ${far.positionPenalty} at a reading of ${far.distCm}cm`);
  // The reported figure is positionPenaltyTotal — the ergonomic charge (capped
  // at 18) PLUS what capping the distance metric itself cost the weighted mean,
  // because the UI labels the score drop with this number and it has to be the
  // whole drop. So the bound here is on the total, not on the 18.
  const extreme = at(25);
  check("Even sitting on the lens is a slope, not a cliff",
        extreme.positionPenalty <= 26 && extreme.score > 40,
        `total ${extreme.positionPenalty}, score ${extreme.score} at a reading of ${extreme.distCm}cm`);
}

console.log("\nINVARIANCE — same posture, irrelevant variable changed");

{
  // Seating distance. The most valuable property here: a user leaning in and
  // out over the day must not see their score drift. This is the regression
  // guard for a bug that swung the neck score 32 points on seating distance
  // alone.
  const pose = { forwardHeadCm: 5 };
  const rows = [45, 55, 65, 75, 85].map(d => {
    const r = read(pose, { camera: { distCm: d } });
    return { d, score: r?.score, fhp: val(r, "fhp_index") };
  });
  if (VERBOSE) rows.forEach(r => console.log(`    ${String(r.d).padStart(2)}cm  score ${fmt(r.score)}  fhp ${fmt(r.fhp)}cm`));
  const fs = stats(rows.map(r => r.fhp)), ss = stats(rows.map(r => r.score));
  check("Forward head stable across 45–85cm (spread <= 4cm)", (fs.max - fs.min) <= 4, `spread ${fmt(fs.max - fs.min)}cm`);
  check("Score stable across 45–85cm (spread <= 15 pts)", (ss.max - ss.min) <= 15, `spread ${fmt(ss.max - ss.min)}`);
}

{
  // Body size. A metric that works only for a 42cm-shouldered adult is not a
  // metric. This is what caught the hardcoded 0.52 ear-to-shoulder constant,
  // which reported 9–32% shoulder elevation on relaxed subjects purely as a
  // function of their build.
  const pose = { forwardHeadCm: 5 };
  const bodies = [
    { label: "small",  shoulderWidthCm: 36, torsoLenCm: 46, neckLenCm: 10.5, hipWidthCm: 28 },
    { label: "medium", shoulderWidthCm: 42, torsoLenCm: 52, neckLenCm: 12.0, hipWidthCm: 32 },
    { label: "large",  shoulderWidthCm: 48, torsoLenCm: 58, neckLenCm: 13.5, hipWidthCm: 36 },
  ];
  const rows = bodies.map(b => {
    const r = read(pose, { body: b });
    return { label: b.label, score: r?.score, fhp: val(r, "fhp_index"), elev: val(r, "shoulder_elevation") };
  });
  if (VERBOSE) rows.forEach(r => console.log(`    ${r.label.padEnd(7)} score ${fmt(r.score)}  fhp ${fmt(r.fhp)}cm  shoulderElev ${fmt(r.elev)}`));
  const ss = stats(rows.map(r => r.score));
  const es = stats(rows.map(r => r.elev));
  check("Score stable across body sizes (spread <= 15 pts)", (ss.max - ss.min) <= 15, `spread ${fmt(ss.max - ss.min)}`);
  check("Shoulder elevation reads ~0 for all builds at rest", es.max <= 3, `worst ${fmt(es.max)}`);
}

{
  const pose = { forwardHeadCm: 5 };
  const rows = [-15, -7, 0, 7, 15].map(h => read(pose, { camera: { heightCm: h } })?.score);
  if (VERBOSE) console.log(`    camera height −15..+15cm: ${rows.map(fmt).join(", ")}`);
  const ss = stats(rows);
  check("Score stable across ±15cm camera height (spread <= 20 pts)", (ss.max - ss.min) <= 20, `spread ${fmt(ss.max - ss.min)}`);
}

// ═══════════════════════════════════════════════════════════════════
console.log("\n" + "─".repeat(64));
console.log(`${pass} passed · ${fail} failed`);
if (fail) { console.log("\nFailures:"); failures.forEach(f => console.log("  · " + f)); }
console.log("─".repeat(64) + "\n");
process.exit(fail ? 1 : 0);
