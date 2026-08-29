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
import { analyzeMP, PL, MODES, resetProportions } from './postureEngine.js';

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

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`);
process.exit(failures === 0 ? 0 : 1);
