// Run: node --test src/features/analysis/rtmwPolicy.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { REFINE_MODELS, refineDecision, refineProviders } from "./rtmwPolicy.js";

const X = REFINE_MODELS["rtmw-x"];
const laptop = { webgpu: true, cached: false, saveData: false, effectiveType: "4g", deviceMemoryGb: 8, mobile: false, freeMb: 50000, verdict: null };

test("a capable laptop loads the model", () => {
  assert.deepEqual(refineDecision(X, laptop), { load: true, reason: "ok" });
  assert.deepEqual(refineProviders(X, laptop), ["webgpu"]);
});

test("no WebGPU: nothing is downloaded", () => {
  assert.equal(refineDecision(X, { ...laptop, webgpu: false }).reason, "no_webgpu");
  assert.equal(refineDecision(X, { ...laptop, webgpu: false, cached: true }).load, false);
});

test("phones, low memory, data saver, slow or mobile-data links do not download 229 MB", () => {
  assert.equal(refineDecision(X, { ...laptop, mobile: true }).reason, "mobile");
  assert.equal(refineDecision(X, { ...laptop, deviceMemoryGb: 4 }).reason, "low_memory");
  assert.equal(refineDecision(X, { ...laptop, saveData: true }).reason, "save_data");
  assert.equal(refineDecision(X, { ...laptop, effectiveType: "3g" }).reason, "slow_network");
  assert.equal(refineDecision(X, { ...laptop, cellular: true }).reason, "cellular");
  assert.equal(refineDecision(X, { ...laptop, freeMb: 300 }).reason, "no_space");
});

test("network rules do not apply once the weights are cached", () => {
  for (const d of [{ saveData: true }, { effectiveType: "2g" }, { cellular: true }, { freeMb: 10 }])
    assert.equal(refineDecision(X, { ...laptop, ...d, cached: true }).load, true, JSON.stringify(d));
});

test("unknown memory (Safari, Firefox) does not block a WebGPU laptop", () => {
  assert.equal(refineDecision(X, { ...laptop, deviceMemoryGb: null, effectiveType: null }).load, true);
});

test("a device measured too slow is not asked again for a month", () => {
  const now = 1e12, day = 86400000;
  const v = { id: "rtmw-x", reason: "slow", at: now - 3 * day };
  assert.equal(refineDecision(X, { ...laptop, verdict: v, now }).reason, "known_slow");
  assert.equal(refineDecision(X, { ...laptop, verdict: { ...v, at: now - 40 * day }, now }).load, true);
  assert.equal(refineDecision(X, { ...laptop, verdict: { ...v, id: "another-model" }, now }).load, true);
});
