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

const val = (r, k) => r?.metrics?.[k]?.value;
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
    const got = val(read({ lateralLeanDeg: t }), "spine_lean");
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
    const got = val(read({ trunkRotDeg: t }), "trunk_rotation");
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
  const got = [3, 6, 9].map(cm => val(read({ roundShoulderCm: cm }), "rounded_shoulders"));
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
  const neutral = val(read({}), "rounded_shoulders");
  check("Rounded shoulders: reads ~0 on a neutral subject", neutral <= 1, `${fmt(neutral)}cm`);
  const fwdHead = val(read({ forwardHeadCm: 6 }), "rounded_shoulders");
  check("Rounded shoulders: a forward head is not read as rounding", fwdHead <= 1, `${fmt(fwdHead)}cm`);

  // A rigid trunk lean keeps hips, shoulders and ears collinear, so it should
  // largely cancel rather than register as protraction.
  const lean = val(read({ trunkFlexDeg: 20 }), "rounded_shoulders");
  check("Rounded shoulders: a trunk lean barely leaks in", lean <= 2.5, `${fmt(lean)}cm at 20°`);

  // Anatomy must cancel: the baseline is what makes this body-independent.
  const perBody = [
    { neckLenCm: 15, torsoLenCm: 56 },
    { neckLenCm: 9,  torsoLenCm: 48 },
    { shoulderWidthCm: 48, hipWidthCm: 36 },
  ].map(body => val(read({ roundShoulderCm: 6 }, { body }), "rounded_shoulders"));
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
  const elbow = val(read({ lateralLeanDeg: 12 }), "elbow_angle");
  if (VERBOSE) console.log(`\n  Elbow angle: read ${fmt(elbow)}° (true 92.5°, was 164° in 2D)`);
  check("Elbow: a typing arm is not read as straight", elbow < 140, `${fmt(elbow)}°`);
  check("Elbow: a typing arm scores as acceptable",
        val(read({ lateralLeanDeg: 12 }), "elbow_angle") > 80, `${fmt(elbow)}°`);
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
    // KNOWN WEAKNESS, asserted at its true value rather than an aspirational
    // one. analyzeRoundedShoulders now reports unreliable without calibration,
    // because its population constant (0.52) is anatomically wrong for
    // everyone and produced a permanent false "shoulders slightly forward"
    // alert. So an uncalibrated user gets almost no protraction detection —
    // 6cm costs 3 points, coming mostly from other metrics. This is the next
    // thing to rework in the engine; the assertion is here to make the gap
    // visible rather than to pretend it is closed.
    ["Rounded shoulders 6cm", { roundShoulderCm: 6 },   2],
    ["Lateral lean 15°",      { lateralLeanDeg: 15 },  10],
    ["Trunk rotation 30°",    { trunkRotDeg: 30 },      8],
    ["Shoulder shrug 4cm",    { shoulderElevCm: 4 },    2],
  ];
  for (const [label, pose, minDrop] of cases) {
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
  const alertsFor = (pose) => (read(pose)?.alerts || []).filter(Boolean);

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
    const d = read(pose)?.alerts?.detailed?.[0];
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
