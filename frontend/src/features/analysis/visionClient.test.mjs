// Run: node --test src/features/analysis/visionClient.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { unpackPose, unpackFace, POSE_OPTIONS } from "./visionClient.js";

test("pose landmarks survive the trip through the worker's packed format", () => {
  const src = Array.from({ length: 33 }, (_, i) => ({ x: i / 40, y: 1 - i / 40, z: -i / 100, visibility: i / 33 }));
  const packed = new Float32Array(33 * 4);
  src.forEach((p, i) => packed.set([p.x, p.y, p.z, p.visibility], 4 * i));
  const out = unpackPose(packed);
  assert.equal(out.length, 33);
  for (let i = 0; i < 33; i++) for (const k of ["x", "y", "z", "visibility"]) assert.ok(Math.abs(out[i][k] - src[i][k]) < 1e-6, `${i}.${k}`);
});

test("face result has the shape the precision layer reads", () => {
  const lm = new Float32Array(478 * 3).map((_, i) => i / 2000), m = new Float32Array(16).map((_, i) => i);
  const r = unpackFace({ lm, m });
  assert.equal(r.faceLandmarks[0].length, 478);
  assert.ok(Math.abs(r.faceLandmarks[0][468].y - (468 * 3 + 1) / 2000) < 1e-6);
  assert.equal(r.facialTransformationMatrixes[0].data[14], 14);
});

test("the worker runs the pose model with the same options as before", () => {
  assert.deepEqual(POSE_OPTIONS, { runningMode: "VIDEO", numPoses: 1, minPoseDetectionConfidence: .3, minPosePresenceConfidence: .3, minTrackingConfidence: .3 });
});
