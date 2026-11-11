// Run: node --test src/features/analysis/calibrationCore.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  OneEuroFilter, robustMean, median, headPoseFromMatrix, irisDiameterPx,
  focalFromKnownDistance, distanceFromIris, focalFromHfov, framingChecks,
  calibrationQuality, poseMotion,
} from "./calibrationCore.js";

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} ${a} vs ${b}`);

test("One Euro: removes most jitter on a still signal", () => {
  let seed = 42;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5);
  const f = new OneEuroFilter({ minCutoff: 1.0, beta: 0.02 });
  const raw = [], out = [];
  for (let i = 0; i < 300; i++) { const v = 0.5 + rnd() * 0.01; raw.push(v); out.push(f.filter(v, i / 30)); }
  const v = a => { const s = a.slice(60); const m = s.reduce((p, q) => p + q) / s.length; return s.reduce((p, q) => p + (q - m) ** 2, 0) / s.length; };
  assert.ok(v(out) < 0.3 * v(raw), `variance ratio ${v(out) / v(raw)}`);
});

test("One Euro: follows a real move within ~0.5 s", () => {
  const f = new OneEuroFilter({ minCutoff: 1.0, beta: 0.02 });
  let y = 0;
  for (let i = 0; i < 30; i++) y = f.filter(0, i / 30);
  for (let i = 30; i < 45; i++) y = f.filter(1, i / 30);   // step, then 0.5 s later
  assert.ok(y > 0.9, `after 0.5 s: ${y}`);
});

test("robustMean drops an outlier frame", () => {
  const r = robustMean([10, 10.2, 9.9, 10.1, 10, 9.8, 35]);
  near(r.value, 10, 0.1);
  assert.equal(r.rejected, 1);
  assert.equal(median([3, 1, 2]), 2);
});

function poseMatrix(pitchDeg, yawDeg, rollDeg, colMajor) {
  const [x, y, z] = [pitchDeg, yawDeg, rollDeg].map(d => d * Math.PI / 180);
  const Rx = [[1, 0, 0], [0, Math.cos(x), -Math.sin(x)], [0, Math.sin(x), Math.cos(x)]];
  const Ry = [[Math.cos(y), 0, Math.sin(y)], [0, 1, 0], [-Math.sin(y), 0, Math.cos(y)]];
  const Rz = [[Math.cos(z), -Math.sin(z), 0], [Math.sin(z), Math.cos(z), 0], [0, 0, 1]];
  const mul = (A, B) => A.map((r, i) => B[0].map((_, j) => r.reduce((s, _, k) => s + A[i][k] * B[k][j], 0)));
  const R = mul(Rz, mul(Ry, Rx));
  const M = [[...R[0], 2], [...R[1], -3], [...R[2], -55], [0, 0, 0, 1]];
  const out = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) out.push(colMajor ? M[j][i] : M[i][j]);
  return out;
}

test("head pose recovered from column- and row-major matrices", () => {
  for (const cm of [true, false]) {
    const p = headPoseFromMatrix(poseMatrix(12, -8, 4, cm));
    near(p.pitch, 12, 1e-6, "pitch"); near(p.yaw, -8, 1e-6, "yaw"); near(p.roll, 4, 1e-6, "roll");
  }
});

test("iris → distance round-trip and HFOV focal", () => {
  const face = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
  const W = 1280, H = 720, rPx = 12;       // iris radius 12 px → diameter 24 px
  for (const c of [468, 473]) {
    face[c + 1] = { x: 0.5 + rPx / W, y: 0.5 }; face[c + 3] = { x: 0.5 - rPx / W, y: 0.5 };
    face[c + 2] = { x: 0.5, y: 0.5 - (rPx * 0.8) / H }; face[c + 4] = { x: 0.5, y: 0.5 + (rPx * 0.8) / H };
  }
  const d = irisDiameterPx(face, W, H);
  near(d, 24, 1e-9);
  const f = focalFromKnownDistance(d, 60);
  near(distanceFromIris(d, f), 60, 1e-9);
  near(distanceFromIris(d / 2, f), 120, 1e-9, "half size → double distance");
  near(focalFromHfov(1280, 90), 640, 1e-9);
});

function goodPose() {
  const p = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.99 }));
  p[0] = { x: 0.5, y: 0.38, visibility: 0.99 };
  p[2] = { x: 0.53, y: 0.34, visibility: 0.99 }; p[5] = { x: 0.47, y: 0.34, visibility: 0.99 };
  p[7] = { x: 0.58, y: 0.37, visibility: 0.9 }; p[8] = { x: 0.42, y: 0.37, visibility: 0.9 };
  p[11] = { x: 0.68, y: 0.7, visibility: 0.99 }; p[12] = { x: 0.32, y: 0.7, visibility: 0.99 };
  return p;
}

test("framing: good setup is ready; problems are named in order", () => {
  const base = { pose: goodPose(), people: 1, head: { pitch: 0, yaw: 2, roll: 1 }, distCm: 60, luma: 120, motion: 0.05 };
  assert.equal(framingChecks(base).ready, true);
  const off = goodPose().map(q => ({ ...q, x: q.x + 0.2 }));
  assert.equal(framingChecks({ ...base, pose: off }).firstFail, "centered");
  assert.equal(framingChecks({ ...base, people: 2 }).firstFail, "person");
  assert.equal(framingChecks({ ...base, distCm: 30 }).firstFail, "distance");
  assert.equal(framingChecks({ ...base, head: { pitch: 0, yaw: 25, roll: 0 } }).firstFail, "facing");
  assert.equal(framingChecks({ ...base, luma: 20 }).firstFail, "lighting");
  assert.equal(framingChecks({ ...base, motion: 1.2 }).firstFail, "still");
  assert.equal(framingChecks({ ...base, pose: null }).firstFail, "person");
});

test("motion in shoulder-widths per second", () => {
  const a = goodPose(), b = goodPose().map(q => ({ ...q, x: q.x + 0.036 }));
  near(poseMotion(a, b, 0.1), 1.0, 1e-9);     // moved 0.1 SW in 0.1 s
});

test("quality score", () => {
  const perfect = calibrationQuality({ validFrames: 90, targetFrames: 90, spreads: { a: 0.5 },
    distanceMeasured: true, faceTracked: true });
  assert.deepEqual([perfect.score, perfect.grade], [100, "high"]);
  const weak = calibrationQuality({ validFrames: 30, targetFrames: 90, spreads: { a: 4 },
    distanceMeasured: false, faceTracked: false, rejectedRatio: 0.3 });
  assert.ok(weak.score < 65 && weak.grade === "low", JSON.stringify(weak));
});
