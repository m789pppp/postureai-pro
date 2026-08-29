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
import { analyzeMP, PL, MODES } from './postureEngine.js';

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
  lms[PL.L_HIP] = { x: cx - half * 0.8,  y: shY + 0.30,   z: 0, visibility: 0.90 };
  lms[PL.R_HIP] = { x: cx + half * 0.8,  y: shY + 0.30,   z: 0, visibility: 0.90 };
  lms[PL.L_ELBOW] = { x: cx - half - 0.03, y: shY + 0.16, z: 0, visibility: 0.85 };
  lms[PL.R_ELBOW] = { x: cx + half + 0.03, y: shY + 0.16, z: 0, visibility: 0.85 };
  lms[PL.L_WRIST] = { x: cx - half,        y: shY + 0.30, z: 0, visibility: 0.80 };
  lms[PL.R_WRIST] = { x: cx + half,        y: shY + 0.30, z: 0, visibility: 0.80 };
  return lms;
}

const run = (opts) => analyzeMP(makeLandmarks(opts), W, H, 'laptop');
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

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`);
process.exit(failures === 0 ? 0 : 1);
