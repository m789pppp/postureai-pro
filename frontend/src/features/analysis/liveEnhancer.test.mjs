// Run: node --test src/features/analysis/liveEnhancer.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createExposureTracker, readingConfidence } from "./liveEnhancer.js";

test("exposure: time, streaks and episodes", () => {
  const ex = createExposureTracker(undefined, { minEpisodeSec: 60 });
  let t = 0, snap;
  const step = (sec, sample) => { for (let i = 0; i < sec * 10; i++) { t += 100; snap = ex.update(t, sample); } };
  step(1, { headFlexion: 0, distCm: 60, score: 80 });          // first tick only sets the clock
  step(90, { headFlexion: 20, distCm: 60, score: 80 });        // 90 s flexed → 1 episode
  step(30, { headFlexion: 5, distCm: 40, score: 50 });         // 30 s close + poor
  assert.ok(Math.abs(snap.head_flexion.totalSec - 90) < 0.2, snap.head_flexion.totalSec);
  assert.equal(snap.head_flexion.episodes, 1);
  assert.ok(Math.abs(snap.head_flexion.longestSec - 90) < 0.2);
  assert.equal(snap.head_flexion.streakSec, 0);
  assert.ok(Math.abs(snap.too_close.totalSec - 30) < 0.2);
  assert.equal(snap.too_close.episodes, 0);                    // 30 s < 60 s episode threshold
  assert.ok(Math.abs(snap.trackedSec - 120.9) < 0.3, snap.trackedSec);
});

test("exposure: a long gap (tab hidden) is not counted", () => {
  const ex = createExposureTracker();
  ex.update(0, { headFlexion: 30 });
  const s = ex.update(60000, { headFlexion: 30 });             // 60 s jump
  assert.equal(s.head_flexion.totalSec, 0);
  assert.equal(s.trackedSec, 0);
});

test("confidence", () => {
  const pose = Array.from({ length: 33 }, () => ({ visibility: 1 }));
  assert.equal(readingConfidence({ pose, faceFresh: true, calibScore: 100 }), 100);
  assert.equal(readingConfidence({ pose, faceFresh: false, calibScore: null }), 68);
  assert.equal(readingConfidence({ pose: null, faceFresh: true, calibScore: 100 }), 0);
});

import { fuseWithRtmw, rtmwConf, WB133_TO_MP33, createCorrectionField } from "./liveEnhancer.js";

function mpPose() {
  return Array.from({ length: 33 }, (_, i) => ({ x: 0.3 + i * 0.01, y: 0.5, z: 0, visibility: 0.9 }));
}
function rtFrom(mp, W, H, dx = 0, score = 6) {
  const kpts = new Float32Array(266), scores = new Float32Array(133);
  for (const [mi, wi] of Object.entries(WB133_TO_MP33)) { kpts[2 * wi] = mp[mi].x * W + dx; kpts[2 * wi + 1] = mp[mi].y * H; scores[wi] = score; }
  return { kpts, scores };
}

test("fusion: identical models → unchanged, full agreement", () => {
  const W = 1280, H = 720, mp = mpPose();
  mp[11].x = 0.6; mp[12].x = 0.4;
  const r = fuseWithRtmw(mp, rtFrom(mp, W, H), W, H, 0);
  assert.ok(Math.abs(r.lms[0].x - mp[0].x) < 1e-6);   // Float32 keypoints → tiny rounding
  assert.ok(r.disagreement < 1e-4, r.disagreement);
});

test("fusion: confident RTMW pulls the point; stale RTMW counts less", () => {
  const W = 1000, H = 1000, mp = mpPose();
  mp[11].x = 0.6; mp[12].x = 0.4;                 // shoulder width 200 px
  const rt = rtFrom(mp, W, H, 20);                // RTMW 20 px to the right, conf 1
  const fresh = fuseWithRtmw(mp, rt, W, H, 0);
  const stale = fuseWithRtmw(mp, rt, W, H, 200);
  const shiftFresh = (fresh.lms[0].x - mp[0].x) * W, shiftStale = (stale.lms[0].x - mp[0].x) * W;
  assert.ok(Math.abs(shiftFresh - 20 * 1 / 1.9) < 1e-3, shiftFresh);   // wm 0.9 vs wr 1.0
  assert.ok(shiftStale < shiftFresh && shiftStale > 0, `${shiftStale}`);
  assert.ok(Math.abs(fresh.disagreement - 0.1) < 1e-4);               // 20 px / 200 px
});

test("fusion: motion compensation keeps RTMW's correction when the user moved", () => {
  const W = 1000, H = 1000, mp0 = mpPose();
  mp0[11].x = 0.6; mp0[12].x = 0.4;
  const rt = rtFrom(mp0, W, H, 20);               // RTMW said +20 px vs the frame it saw
  const mpNow = mp0.map(p => ({ ...p, x: p.x + 0.05 }));   // user moved 50 px since
  const r = fuseWithRtmw(mpNow, rt, W, H, 0, null, mp0);
  const shift = (r.lms[0].x - mpNow[0].x) * W;
  assert.ok(Math.abs(shift - 20 / 1.9) < 1e-3, shift);    // same correction, applied to the new position
  assert.ok(Math.abs(r.disagreement - 0.1) < 1e-4);
});

test("rtmw score mapping", () => {
  assert.equal(rtmwConf(0.5), 0); assert.equal(rtmwConf(3), 1); assert.equal(rtmwConf(10), 1);
});

import { virtualEars, blendEars } from "./liveEnhancer.js";
import { readFileSync } from "node:fs";

test("virtual ears match real pose ears on real detections (2 people × flip × ±12°)", () => {
  const fx = JSON.parse(readFileSync(new URL("./ears.fixture.json", import.meta.url)));
  let worst = 0;
  for (const s of fx) {
    const face = []; for (const [k, v] of Object.entries(s.face)) face[+k] = { x: v[0], y: v[1] };
    for (let i = 0; i < 478; i++) face[i] ??= { x: 0, y: 0 };
    const ears = virtualEars(face, s.W, s.H);
    const iod = Math.hypot((s.face[263][0] - s.face[33][0]) * s.W, (s.face[263][1] - s.face[33][1]) * s.H);
    for (const [k, real] of [[7, s.ear7], [8, s.ear8]]) {
      const e = Math.hypot((ears[k].x - real[0]) * s.W, (ears[k].y - real[1]) * s.H) / iod;
      worst = Math.max(worst, e);
    }
  }
  assert.ok(worst < 0.12, `worst error ${worst.toFixed(3)} IOD`);   // < ~1 cm
});

test("blendEars: covered ear (low visibility) follows the face mesh", () => {
  const pose = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
  pose[7] = { x: 0.40, y: 0.5, visibility: 0.1 };      // hidden → unreliable
  pose[8] = { x: 0.60, y: 0.5, visibility: 0.99 };     // visible
  const out = blendEars(pose, { 7: { x: 0.45, y: 0.5 }, 8: { x: 0.61, y: 0.5 } });
  assert.ok(Math.abs(out[7].x - 0.45) < 0.002, out[7].x);           // ~fully virtual
  assert.ok(Math.abs(out[8].x - 0.60) < 0.005, out[8].x);           // mostly pose
});

test("correction field: a constant offset passes through unchanged", () => {
  const W = 1000, H = 1000, mp = mpPose();
  mp[11].x = 0.6; mp[12].x = 0.4;
  const f = createCorrectionField({ tauMs: 1500 });
  let out;
  for (let t = 0; t < 3000; t += 100) out = f.update(rtFrom(mp, W, H, 20), mp, W, H, t);
  const r = fuseWithRtmw(mp, out, W, H, 0, null, mp);
  assert.ok(Math.abs((r.lms[0].x - mp[0].x) * W - 20 / 1.9) < 1e-2);   // same pull as the raw result
});

test("correction field: per-inference noise is averaged out, motion is not delayed", () => {
  const W = 1000, H = 1000, base = mpPose();
  base[11].x = 0.6; base[12].x = 0.4;
  const f = createCorrectionField({ tauMs: 1500 });
  let seed = 7; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296 - 0.5) * 2;
  const rawShift = [], smoothShift = [];
  for (let i = 0; i < 300; i++) {                     // one inference per 100 ms, RTMW noise ±6 px around +20 px
    const rt = rtFrom(base, W, H, 20 + 6 * rnd());
    const sm = f.update(rt, base, W, H, i * 100);
    if (i < 100) continue;
    rawShift.push((fuseWithRtmw(base, rt, W, H, 0, null, base).lms[0].x - base[0].x) * W);
    smoothShift.push((fuseWithRtmw(base, sm, W, H, 0, null, base).lms[0].x - base[0].x) * W);
  }
  const sd = a => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length); };
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  assert.ok(sd(smoothShift) < 0.3 * sd(rawShift), `${sd(smoothShift)} vs ${sd(rawShift)}`);
  assert.ok(Math.abs(mean(smoothShift) - mean(rawShift)) < 0.3);          // same average correction
  // the user moves 80 px: the fused point moves with MediaPipe at once
  const moved = base.map(p => ({ ...p, x: p.x + 0.08 }));
  const last = f.update(rtFrom(base, W, H, 20), base, W, H, 30000);
  const r = fuseWithRtmw(moved, last, W, H, 0, null, base);
  assert.ok(Math.abs((r.lms[0].x - base[0].x) * W - (80 + 20 / 1.9)) < 1.5);
});

test("correction field: a body-only model leaves face and hand points alone", () => {
  const spec = { inputW: 192, inputH: 256, k: 17, confLo: 0.2, confHi: 0.8 };
  const W = 1000, H = 1000, mp = mpPose();
  const kpts = new Float32Array(34), scores = new Float32Array(17).fill(0.9);
  for (const [mi, wi] of Object.entries(WB133_TO_MP33)) if (wi < 17) { kpts[2 * wi] = mp[mi].x * W + 10; kpts[2 * wi + 1] = mp[mi].y * H; }
  const out = createCorrectionField({ spec }).update({ kpts, scores }, mp, W, H, 0);
  const r = fuseWithRtmw(mp, out, W, H, 0, null, mp, spec);
  assert.ok((r.lms[11].x - mp[11].x) * W > 4);        // shoulder corrected
  assert.equal(r.lms[1].x, mp[1].x);                  // inner eye: no such point in a 17-keypoint model
});
