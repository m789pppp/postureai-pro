// Run: node --test src/features/analysis/measurementContract.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MEASUREMENTS, REFS, makeMeasurement, validateMeasurement,
  imageToPx, faceGlToCamera, unmirrorX, toGravityRef, toNeutralRef,
} from "./measurementContract.js";
import { headPoseFromMatrix } from "./calibrationCore.js";

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} ${a} vs ${b}`);

test("every catalogued measurement builds a valid object", () => {
  for (const key of Object.keys(MEASUREMENTS)) {
    const v = key === "view_distance_cm" ? 60 : 5;
    const m = makeMeasurement(key, v, { confidence: 0.8, reliable: true, source: "test" });
    assert.deepEqual(validateMeasurement(m), [], key);
    assert.equal(m.unit, MEASUREMENTS[key].unit);
  }
});

test("bad input gives a null, unreliable measurement — never a fake number", () => {
  for (const bad of [NaN, Infinity, undefined, null]) {
    const m = makeMeasurement("head_flexion_deg", bad, { confidence: 0.9, reliable: true });
    assert.equal(m.value, null);
    assert.equal(m.reliable, false);
    assert.equal(m.confidence, 0);
    assert.deepEqual(validateMeasurement(m), []);
  }
});

test("confidence is clamped and zero confidence is never reliable", () => {
  assert.equal(makeMeasurement("protraction_cm", 2, { confidence: 3, reliable: true }).confidence, 1);
  assert.equal(makeMeasurement("protraction_cm", 2, { confidence: 0, reliable: true }).reliable, false);
});

test("unknown keys are rejected", () => {
  assert.throws(() => makeMeasurement("neck_vibes", 1));
  assert.ok(validateMeasurement({ key: "x", unit: "cm", ref: REFS.CAMERA, value: 1, confidence: 1 }).length > 0);
});

test("view distance must be positive", () => {
  const m = makeMeasurement("view_distance_cm", -4, { confidence: 1, reliable: true });
  assert.ok(validateMeasurement(m).includes("view_distance_cm must be > 0"));
});

test("image landmarks convert to pixels with z on the x scale", () => {
  const p = imageToPx({ x: 0.5, y: 0.25, z: -0.1 }, 1280, 720);
  assert.deepEqual(p, { x: 640, y: 180, z: -128 });
});

test("face (OpenGL) frame flips y and z into the camera frame", () => {
  assert.deepEqual(faceGlToCamera({ x: 1, y: 2, z: -50 }), { x: 1, y: -2, z: 50 });
});

test("unmirror is its own inverse", () => {
  near(unmirrorX(unmirrorX(0.3, true), true), 0.3, 1e-12);
  assert.equal(unmirrorX(0.3, false), 0.3);
});

// Rotation about x in the Face Landmarker frame (y up, z toward the viewer):
// a positive angle turns the face's forward axis (+z) toward −y, i.e. the nose
// goes down. The contract says that is POSITIVE flexion.
function rotX(deg) {
  const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  return [[1, 0, 0], [0, c, -s], [0, s, c]];
}
function toFlat(R, t, colMajor) {
  const M = [[...R[0], t[0]], [...R[1], t[1]], [...R[2], t[2]], [0, 0, 0, 1]];
  const out = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) out.push(colMajor ? M[j][i] : M[i][j]);
  return out;
}

test("face matrix: chin down reads as positive flexion (both layouts)", () => {
  const R = rotX(20);
  // nose direction after rotation: z-axis column → y component must be negative (down)
  assert.ok(R[1][2] < 0, "rotated forward axis points down");
  for (const colMajor of [true, false]) {
    const pose = headPoseFromMatrix(toFlat(R, [0, -2, -55], colMajor));
    near(pose.pitch, 20, 1e-6, colMajor ? "col-major" : "row-major");
  }
});

test("gravity reference: a camera tilted down makes an upright head look extended", () => {
  // Camera pitched 10° down, head truly upright → camera sees −10°; gravity ref restores 0.
  near(toGravityRef(-10, 10), 0, 1e-12);
  near(toGravityRef(15, 10), 25, 1e-12);
  assert.equal(toGravityRef(NaN, 10), null);
});

test("neutral reference subtracts the anchor", () => {
  near(toNeutralRef(18, 4), 14, 1e-12);
  assert.equal(toNeutralRef(18, undefined), null);
});
