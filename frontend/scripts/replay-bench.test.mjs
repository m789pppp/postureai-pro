// Run: node --test scripts/replay-bench.test.mjs
// Builds bench sessions from the synthetic subject (known truth) and checks the replay
// judges them as the engine behaves: right posture caught, no cross-talk on neutral.
import { test } from "node:test";
import assert from "node:assert/strict";
import { replaySession, summarise } from "./replay-bench.mjs";
import { renderSubject, jitter, mulberry32 } from "../src/features/analysis/syntheticSubject.mjs";
import { BENCH_VERSION } from "../src/features/analysis/benchProtocol.js";

const r4 = v => Math.round(v * 1e4) / 1e4;
function session(steps, seed = 3) {
  const rng = mulberry32(seed);
  let t = 1000;
  return {
    bench_version: BENCH_VERSION, subject: "SYN", camera: { width: 1280, height: 720 }, calib: null,
    steps: steps.map(([id, target, measured, pose, headPitch = 0]) => {
      const frames = [];
      for (let i = 0; i < 100; i++) {                      // 5 s at 20 fps
        t += 50;
        const lms = jitter(renderSubject(pose), 1.0, {}, rng).map(p => [r4(p.x), r4(p.y), r4(p.z ?? 0), r4(p.visibility ?? 0)]);
        frames.push({ t, raw: lms, fused: lms, head: [headPitch, 0, 0] });
      }
      t += 3000;                                             // typing the measured value
      return { id, target, measured, frames };
    }),
  };
}

const STEPS = [
  ["neutral", "head_flexion_deg", 0, {}],
  ["turn_left", "head_yaw_deg", 30, { headYawDeg: 30 }],
  ["lean_side", "spine_lateral_deg", 12, { lateralLeanDeg: 12 }],
  ["shoulder_raise", "shoulder_level_deg", 12, { shoulderTiltDeg: 12 }],
  ["look_up", "head_flexion_deg", -20, {}, -20],
];

test("replay judges each posture and reports the engine's reading", () => {
  const res = replaySession(session(STEPS));
  const s = Object.fromEntries(res.steps.map(x => [x.id, x]));
  assert.equal(res.steps.length, 5);
  assert.deepEqual(s.neutral.crossTalk, [], `neutral fired ${s.neutral.alerts}`);
  assert.equal(s.turn_left.expectedOk, true, `turn: ${s.turn_left.alerts}`);
  assert.ok(Math.abs(Math.abs(s.turn_left.reading) - 30) <= 4, `yaw read ${s.turn_left.reading}`);
  assert.equal(s.shoulder_raise.expectedOk, true, `shoulder: ${s.shoulder_raise.alerts}`);
  // Engine behaviour the replay must SHOW, not hide: with the hips out of frame (a laptop
  // camera) a sideways lean is read as uneven shoulders and a head tilt, not as spine lean.
  assert.equal(s.lean_side.expectedOk, false);
  assert.ok(s.lean_side.alerts.some(a => /^(sh|tilt) /.test(a)), `lean: ${s.lean_side.alerts}`);
  assert.ok(s.turn_left.framesJudged >= 60);
});

test("looking up is missed by the engine as shipped and caught with head3d", () => {
  const off = replaySession(session(STEPS));
  const on = replaySession(session(STEPS), { exp: ["head3d"] });
  const up = r => r.steps.find(x => x.id === "look_up");
  assert.equal(up(off).expectedOk, false, "the landmark proxy is known not to see looking up");
  assert.equal(up(on).expectedOk, true, `head3d: ${up(on).alerts}`);
  assert.ok(Math.abs(up(on).reading + 20) <= 1.5, `head3d reads ${up(on).reading}`);
});

test("summary counts catches and cross-talk across people", () => {
  const a = replaySession(session(STEPS, 1)), b = replaySession(session(STEPS, 2));
  const sum = Object.fromEntries(summarise([a, b]).map(x => [x.id, x]));
  assert.equal(sum.turn_left.n, 2);
  assert.equal(sum.turn_left.caught, 2);
  assert.equal(sum.neutral.crossTalk, 0);
});

test("the replay leaves the real performance.now in place", () => {
  const before = globalThis.performance;
  replaySession(session(STEPS.slice(0, 1)));
  assert.equal(globalThis.performance, before);
});
