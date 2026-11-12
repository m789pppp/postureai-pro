// Run: node --test src/bench/perfCore.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { sd, percentile, landmarkJitter, pacing, seriesStats, medianOfRuns } from "./perfCore.js";

test("sd and percentile", () => {
  assert.ok(Math.abs(sd([2, 4, 4, 4, 5, 5, 7, 9]) - 2.138) < 1e-3);
  assert.ok(Number.isNaN(sd([1])));
  assert.equal(percentile([1, 2, 3, 4, 5], 50), 3);
  assert.equal(percentile([10, 20], 95), 19.5);
});

test("landmark jitter: zero for a frozen pose, known value for a known wobble", () => {
  const base = Array.from({ length: 33 }, (_, i) => ({ x: 0.3 + i * 0.01, y: 0.5 }));
  base[11] = { x: 0.7, y: 0.6 }; base[12] = { x: 0.3, y: 0.6 };            // shoulder width 400 px at W = 1000
  assert.equal(landmarkJitter(Array(10).fill(base), 1000, 1000).px, 0);
  const frames = [-1, 1, -1, 1, -1, 1].map(s => base.map(p => ({ x: p.x + s * 0.002, y: p.y })));   // ±2 px in x
  const j = landmarkJitter(frames, 1000, 1000);
  // sd of ±2 px over 6 samples = 2.191; RMS over (x, y=0) = 1.549 px; shoulders stay 400 px apart
  assert.ok(Math.abs(j.px - 1.549) < 0.002, j.px);
  assert.ok(Math.abs(j.swPct - 0.387) < 0.002, j.swPct);
  assert.equal(landmarkJitter([base], 1000, 1000).px, null);
});

test("pacing: fps from timestamps, stalls counted", () => {
  const t = Array.from({ length: 21 }, (_, i) => i * 50);
  const p = pacing(t, t.map(() => 10), [16, 17, 16, 250]);
  assert.equal(p.fps, 20); assert.equal(p.costP50, 10); assert.equal(p.longFrames, 1);
  assert.equal(pacing([], [], []).fps, null);
});

test("series stats skip short or empty series; medians ignore nulls", () => {
  const s = seriesStats({ a: [1, 2, 3], b: [NaN, 1], c: [] });
  assert.deepEqual(Object.keys(s), ["a"]); assert.equal(s.a.mean, 2);
  assert.deepEqual(medianOfRuns([{ x: 1, y: { z: null } }, { x: 9, y: { z: 4 } }, { x: 5, y: { z: 6 } }]), { x: 5, y: { z: 5 } });
});
