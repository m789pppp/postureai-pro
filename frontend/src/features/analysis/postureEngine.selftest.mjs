/**
 * postureEngine.selftest.mjs — standalone regression checks for the scoring
 * pipeline. No test runner or dependencies required:
 *
 *     node src/features/analysis/postureEngine.selftest.mjs
 *
 * Exits non-zero if any check fails, so it can be dropped into CI as-is.
 *
 * Why this exists: a user reported that the app told them "too close — back
 * up" while the score didn't move. It was reproducible and exact — the frame
 * quality check flagged too_close from frame geometry, but nothing downstream
 * consumed that flag, and the separate distCm estimate could still read inside
 * the ideal band, leaving distanceScore at a perfect 100. The overall score sat
 * at 91 whether the user was well positioned or pressed against the lens.
 * Case 1 below locks that behaviour down.
 */
import { analyzeMP, PL, MODES, resetProportions, WEIGHTS_FRONT_KEYS } from './postureEngine.js';

const W = 1280, H = 720;

// Build a synthetic upper-body landmark set. shoulderFrac controls how much of
// the frame the shoulders span (the signal checkFrameQuality uses); neckLeanDeg
// and shoulderTiltDeg inject specific posture faults.
function makeLandmarks({ shoulderFrac = 0.35, neckLeanDeg = 0, shoulderTiltDeg = 0, yShift = 0 } = {}) {
  const lms = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.95 }));
  const cx = 0.5;
  const half = shoulderFrac / 2;
  const shY = 0.62 + yShift;
  const tilt = (shoulderTiltDeg * Math.PI) / 180;
  const dy = Math.tan(tilt) * half;

  lms[PL.L_SHOULDER] = { x: cx - half, y: shY - dy, z: 0, visibility: 0.98 };
  lms[PL.R_SHOULDER] = { x: cx + half, y: shY + dy, z: 0, visibility: 0.98 };

  // head sits above shoulder midpoint; neck lean pushes it forward (x offset)
  const lean = (neckLeanDeg / 90) * 0.12;
  const headY = shY - 0.26;
  lms[PL.NOSE]  = { x: cx + lean,        y: headY + 0.03, z: 0, visibility: 0.97 };
  lms[PL.L_EAR] = { x: cx - 0.05 + lean, y: headY,        z: 0, visibility: 0.95 };
  lms[PL.R_EAR] = { x: cx + 0.05 + lean, y: headY,        z: 0, visibility: 0.95 };
  lms[PL.L_EYE] = { x: cx - 0.03 + lean, y: headY - 0.01, z: 0, visibility: 0.96 };
  lms[PL.R_EYE] = { x: cx + 0.03 + lean, y: headY - 0.01, z: 0, visibility: 0.96 };
  // estimateHeadYaw prefers the OUTER corners (3 & 6) and only falls back to
  // the centres — leaving these at the default 0.5 gives eyeWidth 0.
  lms[PL.L_EYE_OUTER] = { x: cx - 0.045 + lean, y: headY - 0.01, z: 0, visibility: 0.96 };
  lms[PL.R_EYE_OUTER] = { x: cx + 0.045 + lean, y: headY - 0.01, z: 0, visibility: 0.96 };
  lms[PL.L_HIP] = { x: cx - half * 0.8,  y: shY + 0.30,   z: 0, visibility: 0.90 };
  lms[PL.R_HIP] = { x: cx + half * 0.8,  y: shY + 0.30,   z: 0, visibility: 0.90 };
  lms[PL.L_ELBOW] = { x: cx - half - 0.03, y: shY + 0.16, z: 0, visibility: 0.85 };
  lms[PL.R_ELBOW] = { x: cx + half + 0.03, y: shY + 0.16, z: 0, visibility: 0.85 };
  lms[PL.L_WRIST] = { x: cx - half,        y: shY + 0.30, z: 0, visibility: 0.80 };
  lms[PL.R_WRIST] = { x: cx + half,        y: shY + 0.30, z: 0, visibility: 0.80 };
  return lms;
}

const run = (opts) => { resetProportions(); return analyzeMP(makeLandmarks(opts), W, H, 'laptop'); };
const ok = (c, m) => console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`);
let failures = 0;
const check = (c, m) => { if (!c) failures++; ok(c, m); };

console.log('--- 1. leaning in toward the camera ---');
const rows = [];
for (const f of [0.35, 0.60, 0.80, 0.86, 0.90, 0.95, 1.00]) {
  const r = run({ shoulderFrac: f });
  rows.push({ f, score: r?.score, reason: r?.qualityReason, pen: r?.positionPenalty });
  console.log(`  shoulders ${(f*100).toFixed(0).padStart(3)}%  score=${String(r?.score).padStart(3)}  reason=${String(r?.qualityReason)}  penalty=${r?.positionPenalty}`);
}
const flagged = rows.filter(r => r.reason === 'too_close');
check(flagged.length > 0, 'too_close actually triggers at high shoulder fraction');
check(flagged.every(r => r.pen > 0), 'every too_close frame carries a positioning penalty');
const normal = rows.find(r => r.f === 0.35);
check(flagged.every(r => r.score < normal.score), 'every too_close score is BELOW the well-positioned score');
const worst = rows[rows.length - 1], firstBad = flagged[0];
check(worst.score < firstBad.score, 'score keeps falling as the user gets closer (monotonic)');
check(normal.score - worst.score >= 15, `drop is user-visible (got ${normal.score - worst.score} pts)`);

console.log('\n--- 2. no NaN / Infinity / out-of-range anywhere ---');
for (const f of [0.2, 0.35, 0.6, 0.9, 1.0]) {
  const r = run({ shoulderFrac: f });
  if (!r) continue;
  const bad = [];
  if (r.score != null && !Number.isFinite(r.score)) bad.push('score');
  if (r.score != null && (r.score < 0 || r.score > 100)) bad.push('score-range');
  for (const [k, m] of Object.entries(r.metrics || {})) {
    if (m?.score != null && !Number.isFinite(m.score)) bad.push(k + '.score');
    if (m?.value != null && !Number.isFinite(m.value)) bad.push(k + '.value');
  }
  check(bad.length === 0, `frac ${f}: all numeric outputs finite and in range ${bad.length ? '→ ' + bad.join(',') : ''}`);
}

console.log('\n--- 3. worse posture scores lower ---');
const good = run({ neckLeanDeg: 0,  shoulderTiltDeg: 0 });
const mid  = run({ neckLeanDeg: 18, shoulderTiltDeg: 6 });
const bad  = run({ neckLeanDeg: 38, shoulderTiltDeg: 14 });
console.log(`  upright=${good?.score}  moderate=${mid?.score}  poor=${bad?.score}`);
check(good.score >= mid.score && mid.score >= bad.score, 'score decreases monotonically as posture worsens');
check(good.score - bad.score >= 5, `bad posture is meaningfully lower (got ${good.score - bad.score} pts)`);

console.log('\n--- 4. too_far is handled too ---');
const far = run({ shoulderFrac: 0.03 });
console.log(`  tiny shoulders: score=${far?.score} reason=${far?.qualityReason} penalty=${far?.positionPenalty}`);
check(far?.qualityReason === 'too_far' || far?.qualityReason === 'body_cropped', 'far user is flagged');

// ── 5. occlusion must not REWARD bad posture ────────────────────────────────
// Hiding one ear makes neck/FHP/rounded unmeasurable — 49% of the weight table
// and exactly the metrics that score badly when slumped. Before the fix a
// slumped pose GAINED 26 points from covering an ear (chin-on-hand), which made
// the score trivially gameable by adopting a bad habit.
console.log('\n--- 5. covering an ear must not raise a bad-posture score ---');
{
  const hide = (o) => { resetProportions(); const l = makeLandmarks(o); l[PL.L_EAR] = { ...l[PL.L_EAR], visibility: 0.1 }; return analyzeMP(l, W, H, 'laptop'); };
  const slumpOpen = run({ neckLeanDeg: 24, shoulderTiltDeg: 12 });
  const slumpHid  = hide({ neckLeanDeg: 24, shoulderTiltDeg: 12 });
  console.log(`  slumped, both ears=${slumpOpen.score}  one ear hidden=${slumpHid.score}  delta=${slumpHid.score - slumpOpen.score}`);
  check(slumpHid.score - slumpOpen.score <= 8, 'occluding an ear gains a slumped user <= 8 pts');
  check(slumpHid.occlusionPenalty > 0, 'chin-prop occlusion is actually charged');
}

// ── 6. both distance branches must agree ────────────────────────────────────
// The IPD branch and the shoulder fallback used three different focal-length
// models between them and returned 77cm vs 116cm on the SAME frame; the branch
// is chosen per-frame on eye visibility, so a blink flipped the reading.
console.log('\n--- 6. IPD and shoulder distance branches agree ---');
{
  const F = 800, SH = 42, IPD_CM = 6.3;
  const at = (distCm, eyes) => {
    const shPx = SH * F / distCm, ipdPx = IPD_CM * F / distCm;
    const a = Array.from({ length: 33 }, () => ({ x: .5, y: .5, z: 0, visibility: .95 }));
    const cx = .5, half = (shPx / W) / 2, ih = (ipdPx / W) / 2, shY = .62, hy = shY - .26;
    a[PL.L_SHOULDER] = { x: cx - half, y: shY, z: 0, visibility: .98 };
    a[PL.R_SHOULDER] = { x: cx + half, y: shY, z: 0, visibility: .98 };
    a[PL.NOSE]  = { x: cx, y: hy + .03, z: 0, visibility: .97 };
    a[PL.L_EAR] = { x: cx - .05, y: hy, z: 0, visibility: .95 };
    a[PL.R_EAR] = { x: cx + .05, y: hy, z: 0, visibility: .95 };
    a[PL.L_EYE] = { x: cx - ih, y: hy - .01, z: 0, visibility: eyes ? .96 : 0.1 };
    a[PL.R_EYE] = { x: cx + ih, y: hy - .01, z: 0, visibility: eyes ? .96 : 0.1 };
    a[PL.L_HIP] = { x: cx - half * .8, y: shY + .3, z: 0, visibility: .9 };
    a[PL.R_HIP] = { x: cx + half * .8, y: shY + .3, z: 0, visibility: .9 };
    return a;
  };
  for (const d of [45, 60, 85]) {
    resetProportions();
    const withEyes = analyzeMP(at(d, true),  W, H, 'laptop').metrics.screen_distance.value;
    resetProportions();
    const noEyes   = analyzeMP(at(d, false), W, H, 'laptop').metrics.screen_distance.value;
    console.log(`  true ${d}cm -> IPD ${withEyes}cm / shoulder ${noEyes}cm`);
    check(Math.abs(withEyes - d) <= 3, `IPD branch accurate at ${d}cm`);
    check(Math.abs(withEyes - noEyes) <= 3, `branches agree at ${d}cm (was 77 vs 116)`);
  }
}

// ── 7. head yaw must be monotonic and correctly scaled ──────────────────────
// The old estimator scaled nose offset linearly (a tangent relationship), so a
// real 30 deg turn reported 8 deg; and an ear cross-check flipped the SIGN
// mid-turn, so the app told users to correct the wrong side.
console.log('\n--- 7. head yaw is monotonic and correctly scaled ---');
{
  const NOSE_R = 0.215;
  const yawFrame = (deg) => {
    resetProportions();
    const l = makeLandmarks({});
    const th = deg * Math.PI / 180;
    const cx = 0.5, hy = 0.62 - 0.26;
    // Outer-canthal span foreshortens by cos(theta); the nose tip swings
    // sideways by its protrusion x sin(theta). That is the real geometry the
    // estimator inverts.
    const halfSpan = 0.045 * Math.cos(th);
    const noseX = cx + (0.045 * 2) * NOSE_R * Math.sin(th);
    l[PL.L_EYE_OUTER] = { x: cx - halfSpan, y: hy - .01, z: 0, visibility: .96 };
    l[PL.R_EYE_OUTER] = { x: cx + halfSpan, y: hy - .01, z: 0, visibility: .96 };
    l[PL.L_EYE] = { x: cx - halfSpan * 0.66, y: hy - .01, z: 0, visibility: .96 };
    l[PL.R_EYE] = { x: cx + halfSpan * 0.66, y: hy - .01, z: 0, visibility: .96 };
    l[PL.NOSE]  = { x: noseX, y: hy + .03, z: 0, visibility: .97 };
    return analyzeMP(l, W, H, 'laptop')?.metrics?.head_yaw?.value;
  };
  const seq = [0, 10, 20, 30, 40].map(d => ({ d, got: yawFrame(d) }));
  seq.forEach(r => console.log(`  true ${String(r.d).padStart(2)} deg -> reported ${r.got} deg`));
  const vals = seq.map(r => Math.abs(r.got));
  check(vals.every((v, i) => i === 0 || v >= vals[i - 1]), 'reported yaw never decreases as the head turns further (no sign flip)');
  check(Math.abs(Math.abs(seq[3].got) - 30) <= 6, `30 deg turn reports ~30 deg, not ~8 (got ${seq[3].got})`);
}

// ── 8. left/right must name the SUBJECT'S side ──────────────────────────────
// App.jsx calls detectForVideo() on the raw <video>; its CSS scaleX(-1) is
// display-only, so landmarks arrive UNMIRRORED and the subject's anatomical
// LEFT sits at HIGHER image x. The spine sign test assumed the opposite, so
// every direction cue named the wrong side.
console.log('\n--- 8. lean direction names the correct side ---');
{
  const lean = (dir) => { // dir = the SUBJECT'S own side
    const a = Array.from({ length: 33 }, () => ({ x: .5, y: .5, z: 0, visibility: .95 }));
    const half = .17, shY = .60, hipY = .90, hy = shY - .26;
    const shift = dir === 'right' ? -0.09 : +0.09;   // their right = lower x
    const cxS = .5 + shift, cxH = .5;
    a[PL.L_SHOULDER] = { x: cxS + half, y: shY, z: 0, visibility: .98 };
    a[PL.R_SHOULDER] = { x: cxS - half, y: shY, z: 0, visibility: .98 };
    a[PL.L_HIP] = { x: cxH + half * .8, y: hipY, z: 0, visibility: .95 };
    a[PL.R_HIP] = { x: cxH - half * .8, y: hipY, z: 0, visibility: .95 };
    a[PL.NOSE]  = { x: cxS, y: hy + .03, z: 0, visibility: .97 };
    a[PL.L_EAR] = { x: cxS + .05, y: hy, z: 0, visibility: .95 };
    a[PL.R_EAR] = { x: cxS - .05, y: hy, z: 0, visibility: .95 };
    a[PL.L_EYE] = { x: cxS + .03, y: hy - .01, z: 0, visibility: .96 };
    a[PL.R_EYE] = { x: cxS - .03, y: hy - .01, z: 0, visibility: .96 };
    a[PL.L_EYE_OUTER] = { x: cxS + .045, y: hy - .01, z: 0, visibility: .96 };
    a[PL.R_EYE_OUTER] = { x: cxS - .045, y: hy - .01, z: 0, visibility: .96 };
    return a;
  };
  for (const d of ['right', 'left']) {
    resetProportions();
    const signed = analyzeMP(lean(d), W, H, 'laptop').metrics.spine_lean.signed;
    const says = signed > 0 ? 'right' : 'left';
    console.log(`  subject leans ${d.padEnd(5)} -> signed ${String(signed).padStart(6)} -> app says "${says}"`);
    check(says === d, `lean ${d} is reported as ${d}, not the opposite side`);
  }
}

// ── 9. neck score must not depend on how close you sit ──────────────────────
// The thresholds were scaled by apparent body size, but angleVert() is already
// scale-invariant — a fixed 12 deg lean scored 31 far away and 63 close up.
console.log('\n--- 9. neck score is distance-independent ---');
{
  const neckAt = (frac) => {
    const a = makeLandmarks({ shoulderFrac: frac });
    const off = Math.tan(12 * Math.PI / 180) * 0.26, cx = .5, hy = .62 - .26;
    a[PL.NOSE]  = { x: cx + off, y: hy + .03, z: 0, visibility: .97 };
    a[PL.L_EAR] = { x: cx + off + .05, y: hy, z: 0, visibility: .95 };
    a[PL.R_EAR] = { x: cx + off - .05, y: hy, z: 0, visibility: .95 };
    resetProportions();
    return analyzeMP(a, W, H, 'laptop').metrics.neck_lean.score;
  };
  const scores = [0.24, 0.29, 0.34, 0.40, 0.46].map(neckAt);
  console.log('  same 12 deg lean at 5 seating distances ->', scores.join(' '));
  const spread = Math.max(...scores) - Math.min(...scores);
  check(spread <= 5, `neck score varies <= 5 pts with distance alone (was 32, got ${spread})`);
}

// ── 10. monitor pitch must measure gaze, not face shape ─────────────────────
// The neutral nose-drop was one hardcoded population constant divided by the
// ~6.3cm IPD, so its 5 deg band spanned ~0.35cm of nose length. A LEVEL head
// read -7 deg for a short nose and +10 for a long one, each with a permanent
// unclearable "raise/lower your monitor" and a score deduction.
console.log('\n--- 10. monitor pitch does not punish face shape ---');
{
  const F = 800, dist = 60, IPD = 6.3;
  const levelHead = (noseCm) => {
    const ipdPx = IPD * F / dist, shPx = 42 * F / dist, nosePx = noseCm * F / dist;
    const a = Array.from({ length: 33 }, () => ({ x: .5, y: .5, z: 0, visibility: .95 }));
    const cx = .5, half = (shPx / W) / 2, ih = (ipdPx / W) / 2, shY = .62, eyeY = shY - .26;
    a[PL.L_SHOULDER] = { x: cx + half, y: shY, z: 0, visibility: .98 };
    a[PL.R_SHOULDER] = { x: cx - half, y: shY, z: 0, visibility: .98 };
    a[PL.L_EYE] = { x: cx + ih, y: eyeY, z: 0, visibility: .96 };
    a[PL.R_EYE] = { x: cx - ih, y: eyeY, z: 0, visibility: .96 };
    a[PL.L_EYE_OUTER] = { x: cx + ih * 1.4, y: eyeY, z: 0, visibility: .96 };
    a[PL.R_EYE_OUTER] = { x: cx - ih * 1.4, y: eyeY, z: 0, visibility: .96 };
    a[PL.NOSE]  = { x: cx, y: eyeY + (nosePx / H), z: 0, visibility: .97 };
    a[PL.L_EAR] = { x: cx + .05, y: eyeY, z: 0, visibility: .95 };
    a[PL.R_EAR] = { x: cx - .05, y: eyeY, z: 0, visibility: .95 };
    a[PL.L_HIP] = { x: cx + half * .8, y: shY + .3, z: 0, visibility: .9 };
    a[PL.R_HIP] = { x: cx - half * .8, y: shY + .3, z: 0, visibility: .9 };
    return a;
  };
  for (const nose of [3.4, 4.0, 4.6]) {
    resetProportions();
    const r = analyzeMP(levelHead(nose), W, H, 'laptop');
    const fired = (r.alerts || []).some(a => /monitor/i.test(a));
    console.log(`  level head, ${nose}cm nose -> monitor score ${r.bodyModules.monitor.score}, alert: ${fired ? 'YES' : 'no'}`);
    check(!fired, `${nose}cm nose does not trigger a false monitor alert on a level head`);
  }
}

// ── 11. sitting still must not make the score wander ────────────────────────
// The distance smoother lived in App.jsx and ran AFTER analyzeMP returned, so
// it fixed the displayed number while raw per-frame jitter still entered the
// score through the distance weight.
console.log('\n--- 11. distance jitter does not move the score ---');
{
  const F = 800;
  const at = (d) => {
    const shPx = 42 * F / d, ipdPx = 6.3 * F / d;
    const a = Array.from({ length: 33 }, () => ({ x: .5, y: .5, z: 0, visibility: .95 }));
    const cx = .5, half = (shPx / W) / 2, ih = (ipdPx / W) / 2, shY = .62, hy = shY - .26;
    a[PL.L_SHOULDER] = { x: cx + half, y: shY, z: 0, visibility: .98 };
    a[PL.R_SHOULDER] = { x: cx - half, y: shY, z: 0, visibility: .98 };
    a[PL.NOSE]  = { x: cx, y: hy + .03, z: 0, visibility: .97 };
    a[PL.L_EAR] = { x: cx + .05, y: hy, z: 0, visibility: .95 };
    a[PL.R_EAR] = { x: cx - .05, y: hy, z: 0, visibility: .95 };
    a[PL.L_EYE] = { x: cx + ih, y: hy - .01, z: 0, visibility: .96 };
    a[PL.R_EYE] = { x: cx - ih, y: hy - .01, z: 0, visibility: .96 };
    a[PL.L_EYE_OUTER] = { x: cx + ih * 1.4, y: hy - .01, z: 0, visibility: .96 };
    a[PL.R_EYE_OUTER] = { x: cx - ih * 1.4, y: hy - .01, z: 0, visibility: .96 };
    a[PL.L_HIP] = { x: cx + half * .8, y: shY + .3, z: 0, visibility: .9 };
    a[PL.R_HIP] = { x: cx - half * .8, y: shY + .3, z: 0, visibility: .9 };
    return a;
  };
  resetProportions();
  const scores = [60,60,95,60,59,61,98,60,60,61,60,96,60,60].map(d => analyzeMP(at(d), W, H, 'laptop').score);
  const spread = Math.max(...scores) - Math.min(...scores);
  console.log('  scores while sitting still with a noisy estimate ->', scores.join(' '));
  check(spread <= 4, `score spread while motionless stays <= 4 pts (was 8, got ${spread})`);
}

// ── 12/13. the two most common desk postures must actually register ─────────
// Office-worker surveys put neck (~53-59%), lower back (~52%) and shoulders
// (~37-52%) at the top of reported problems. Before these two metrics existed
// the engine had NO reaction to the postures behind the lower-back half of
// that: a full forward slump moved the score by 2 points and a 45-degree trunk
// twist by 0. Both are scored against the user's OWN settled neutral rather
// than a population constant, because IPD (~5.5-7.0cm) and shoulder width
// (~36-48cm) vary far too much between people for an absolute ratio to mean
// anything.
console.log('\n--- 12. forward slouch is detected and scored ---');
{
  const F = 800;
  const person = ({ slouch = 0, twistDeg = 0 } = {}) => {
    const dist = 60 - slouch * 8, sc = F / dist;
    const shW = 42 * sc * Math.cos(twistDeg * Math.PI / 180), ipd = 6.3 * sc;
    const a = Array.from({ length: 33 }, () => ({ x: .5, y: .5, z: 0, visibility: .95 }));
    const cx = .5, half = (shW / W) / 2, ih = (ipd / W) / 2;
    const shY = .56 + slouch * .10, hipY = .93, eyeY = shY - (.24 - slouch * .07);
    a[PL.L_SHOULDER] = { x: cx + half, y: shY, z: 0, visibility: .98 };
    a[PL.R_SHOULDER] = { x: cx - half, y: shY, z: 0, visibility: .98 };
    a[PL.L_HIP] = { x: cx + half * .8, y: hipY, z: 0, visibility: .93 };
    a[PL.R_HIP] = { x: cx - half * .8, y: hipY, z: 0, visibility: .93 };
    a[PL.L_EYE] = { x: cx + ih, y: eyeY, z: 0, visibility: .96 };
    a[PL.R_EYE] = { x: cx - ih, y: eyeY, z: 0, visibility: .96 };
    a[PL.L_EYE_OUTER] = { x: cx + ih * 1.4, y: eyeY, z: 0, visibility: .96 };
    a[PL.R_EYE_OUTER] = { x: cx - ih * 1.4, y: eyeY, z: 0, visibility: .96 };
    a[PL.NOSE]  = { x: cx, y: eyeY + (4.0 * sc / H), z: 0, visibility: .97 };
    a[PL.L_EAR] = { x: cx + ih * 1.9, y: eyeY, z: 0, visibility: .95 };
    a[PL.R_EAR] = { x: cx - ih * 1.9, y: eyeY, z: 0, visibility: .95 };
    return a;
  };
  // The neutral is learned from a settled early stretch, so every case sits
  // upright first — exactly as a real session begins.
  const settleThen = (opts) => {
    resetProportions();
    let r;
    for (let i = 0; i < 110; i++) r = analyzeMP(person({}), W, H, 'laptop');
    for (let i = 0; i < 12;  i++) r = analyzeMP(person(opts), W, H, 'laptop');
    return r;
  };
  const upright = settleThen({});
  const slumped = settleThen({ slouch: 1.0 });
  console.log(`  upright score ${upright.score} (slouch ${upright.metrics.torso_flexion.value}%) -> slumped ${slumped.score} (slouch ${slumped.metrics.torso_flexion.value}%)`);
  check(slumped.metrics.torso_flexion.value >= 20, `a full slump registers as >=20% torso shortening (got ${slumped.metrics.torso_flexion.value}%)`);
  check(upright.score - slumped.score >= 5, `slouching costs a visible number of points (was 2, got ${upright.score - slumped.score})`);
  check((slumped.detectedConditions || []).some(c => c.name === 'Forward Slouch'), 'a full slump is reported as a Forward Slouch condition');
  check(!(upright.detectedConditions || []).some(c => c.name === 'Forward Slouch'), 'sitting upright does NOT report a slouch');

  console.log('\n--- 13. trunk rotation is detected and scored ---');
  const square  = settleThen({});
  const twisted = settleThen({ twistDeg: 45 });
  console.log(`  square ${square.metrics.trunk_rotation.value}deg / score ${square.score}  ->  twisted 45deg reads ${twisted.metrics.trunk_rotation.value}deg / score ${twisted.score}`);
  check(Math.abs(twisted.metrics.trunk_rotation.value - 45) <= 8, `a 45deg twist reads ~45deg (was always 0, got ${twisted.metrics.trunk_rotation.value})`);
  check(square.metrics.trunk_rotation.value <= 5, 'sitting square reads ~0deg');
  check((twisted.detectedConditions || []).some(c => c.name === 'Trunk Rotation'), 'a 45deg twist is reported as a Trunk Rotation condition');
  // Slouching must not masquerade as a twist — they are separate faults.
  check(!(slumped.detectedConditions || []).some(c => c.name === 'Trunk Rotation'), 'slouching is not misreported as a trunk twist');
}

// ── 14. every measured metric must actually affect the score ────────────────
// Twice now a metric has been computed, severity-classified, given alert copy
// and shown in the UI while carrying no weight at all, so it moved the score by
// nothing (shoulderElev, then elbow). This check makes that class of bug loud.
console.log('\n--- 14. no metric is measured but unweighted ---');
{
  const weighted = new Set(Object.keys(WEIGHTS_FRONT_KEYS));
  const missing = ['neck','tilt','shoulder','spine','distance','yaw','rounded','fhp',
                   'monitor','shoulderElev','torsoFlex','trunkRot','elbow']
                   .filter(k => !weighted.has(k));
  console.log('  weighted metrics:', [...weighted].join(', '));
  check(missing.length === 0, `every scored module has a weight ${missing.length ? '-> missing: ' + missing.join(',') : ''}`);
  const sum = Object.values(WEIGHTS_FRONT_KEYS).reduce((a, b) => a + b, 0);
  console.log('  weight sum:', sum.toFixed(4));
  check(Math.abs(sum - 1) < 0.005, `weights sum to 1.0 (got ${sum.toFixed(4)})`);
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`);
process.exit(failures === 0 ? 0 : 1);
