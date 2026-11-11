// Run: node --test src/features/analysis/neckModel.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { headProtractionCm, neckLoadKg } from "./neckModel.js";
import { distanceFromIris, IRIS_DIAMETER_MM } from "./calibrationCore.js";

// Simulated pinhole camera: project the iris and the shoulders at known depths.
const F = 1000, SHOULDER_CM = 40;
const irisPx = dCm => (IRIS_DIAMETER_MM / 10) * F / dCm;
const swPx = dCm => SHOULDER_CM * F / dCm;
function reading(headCm, shoulderCm) {
  return { headDistCm: distanceFromIris(irisPx(headCm), F), shoulderPx: swPx(shoulderCm) };
}
const neutral = { neutralHeadDistCm: 60, neutralShoulderPx: swPx(60) };   // upright: head over shoulders

test("upright → 0 cm", () => {
  assert.ok(Math.abs(headProtractionCm({ ...reading(60, 60), ...neutral })) < 1e-9);
});

test("head pushed 5 cm forward, shoulders still → +5 cm", () => {
  assert.ok(Math.abs(headProtractionCm({ ...reading(55, 60), ...neutral }) - 5) < 1e-9);
});

test("whole trunk leans 8 cm toward the screen → ≈0 (not counted as forward head)", () => {
  assert.ok(Math.abs(headProtractionCm({ ...reading(52, 52), ...neutral })) < 1e-9);
});

test("lean 8 cm AND head forward 4 cm → +4 cm", () => {
  assert.ok(Math.abs(headProtractionCm({ ...reading(48, 52), ...neutral }) - 4) < 1e-9);
});

test("real head–shoulder depth gap (6 cm) costs < 1 cm at 5 cm protraction", () => {
  // true geometry: shoulders 6 cm behind the head at neutral
  const n = { neutralHeadDistCm: 60, neutralShoulderPx: swPx(66) };
  const est = headProtractionCm({ ...reading(55, 66), ...n });
  assert.ok(Math.abs(est - 5) < 1, `${est}`);
  const lean = headProtractionCm({ ...reading(52, 58), ...n });   // whole-trunk lean of 8 cm
  assert.ok(Math.abs(lean) < 1, `${lean}`);
});

test("missing inputs → null", () => {
  assert.equal(headProtractionCm({ headDistCm: NaN, shoulderPx: 300, ...neutral }), null);
});

test("neck load model (Hansraj 2014)", () => {
  assert.equal(neckLoadKg(0), 5);
  assert.equal(neckLoadKg(30), 18.1);
  assert.equal(neckLoadKg(37.5), 20.2);   // between 30° and 45°
  assert.equal(neckLoadKg(-10), 5);
  assert.equal(neckLoadKg(90), 27.2);
  assert.equal(neckLoadKg(NaN), null);
});
