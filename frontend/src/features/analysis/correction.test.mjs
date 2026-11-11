// Run: node --test src/features/analysis/correction.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyCorrection } from "./correction.js";

const corr = { version: 1, targets: { head_flexion_deg: { features: ["pitch_rel"], weights: [1.25], intercept: -2.5 } } };

test("applies the learned linear map", () => {
  assert.equal(applyCorrection(corr, "head_flexion_deg", { pitch_rel: 18 }), 20);
});
test("no model or missing feature → null (caller keeps the raw value)", () => {
  assert.equal(applyCorrection(corr, "protraction_cm", { prot: 3 }), null);
  assert.equal(applyCorrection(corr, "head_flexion_deg", {}), null);
  assert.equal(applyCorrection(null, "head_flexion_deg", { pitch_rel: 1 }), null);
});
