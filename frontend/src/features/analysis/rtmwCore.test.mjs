// Run: node --test src/features/analysis/rtmwCore.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { cropRect, cropRectInt, decodeSimcc, toSource, bboxFromPose, INPUT_W, INPUT_H } from "./rtmwCore.js";

test("crop keeps the 3:4 model aspect and the box centre", () => {
  const r = cropRect([100, 100, 300, 200]);          // wide box → height grows
  assert.ok(Math.abs(r.sw / r.sh - INPUT_W / INPUT_H) < 1e-9);
  assert.ok(Math.abs(r.sx + r.sw / 2 - 200) < 1e-9 && Math.abs(r.sy + r.sh / 2 - 150) < 1e-9);
  const ri = cropRectInt([100.4, 100.6, 300.2, 200.2]);
  assert.ok(Number.isInteger(ri.sx) && Number.isInteger(ri.sw));
});

test("SimCC decode + map back to source pixels", () => {
  const wx = INPUT_W * 2, wy = INPUT_H * 2, k = 2;
  const x = new Float32Array(k * wx), y = new Float32Array(k * wy);
  x[100] = 5; y[200] = 7;                 // kp0 at input (50, 100), score 6
  x[wx + 10] = -1; y[wy + 10] = -1;       // kp1 invalid
  const { locs, scores } = decodeSimcc(x, y, k, wx, wy);
  assert.deepEqual([locs[0], locs[1], scores[0]], [50, 100, 6]);
  assert.deepEqual([locs[2], locs[3]], [-1, -1]);
  const src = toSource(locs, { sx: 10, sy: 20, sw: INPUT_W * 2, sh: INPUT_H * 2 });
  assert.deepEqual([src[0], src[1]], [110, 220]);
});

test("person box from MediaPipe adds head room", () => {
  const lms = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.6, visibility: 0.9 }));
  lms[2] = { x: 0.52, y: 0.3, visibility: 0.9 }; lms[5] = { x: 0.48, y: 0.3, visibility: 0.9 };
  lms[11] = { x: 0.65, y: 0.6, visibility: 0.9 }; lms[12] = { x: 0.35, y: 0.6, visibility: 0.9 };
  const b = bboxFromPose(lms, 1000, 1000);
  assert.ok(b[1] < 300 - 100, `top ${b[1]}`);     // extended above the eyes
  assert.equal(bboxFromPose(null, 1, 1), null);
});
