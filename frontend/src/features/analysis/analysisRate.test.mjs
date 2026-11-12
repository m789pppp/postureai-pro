// Run: node --test src/features/analysis/analysisRate.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRateController } from "./analysisRate.js";
import { pipelineId, pipelineOfFrames } from "./pipelineInfo.js";

const OPTS = { fastMs: 50, slowMs: 250, stillAfterMs: 3000, threshold: 0.03 };   // explicit: the tests do not depend on the tuned defaults

test("defaults: 20/s while moving, slower once still", () => {
  const c = createRateController();
  assert.equal(c.update(pose(), 0), 50);
  const slow = c.update(pose(), 60000);
  assert.ok(slow > 50 && slow <= 250, String(slow));
});

const pose = (dx = 0, dy = 0) => {
  const l = Array.from({ length: 33 }, () => ({ x: 0.5 + dx, y: 0.5 + dy }));
  l[11] = { x: 0.7 + dx, y: 0.6 + dy }; l[12] = { x: 0.3 + dx, y: 0.6 + dy };          // shoulder width 0.4
  return l;
};

test("full rate while settling, slow once still for 3 s", () => {
  const c = createRateController(OPTS);
  let t = 0;
  assert.equal(c.update(pose(), t), 50);
  for (; t < 2900; t += 50) assert.equal(c.update(pose(0.0005 * Math.sin(t)), t), 50);   // camera noise, far under the threshold
  t = 3100; assert.equal(c.update(pose(), t), 250);
  assert.equal(c.intervalMs, 250);
});

test("any real movement returns to the full rate at once and restarts the wait", () => {
  const c = createRateController(OPTS);
  c.update(pose(), 0); assert.equal(c.update(pose(), 4000), 250);
  assert.equal(c.update(pose(0.02), 4250), 50);            // 5 % of the shoulder width
  assert.equal(c.update(pose(0.02), 6000), 50);            // still inside the 3 s wait
  assert.equal(c.update(pose(0.02), 7300), 250);
});

test("a slow drift is caught: movement is measured from where stillness began", () => {
  const c = createRateController(OPTS);
  c.update(pose(), 0);
  let t = 4000, fast = 0;
  for (let i = 1; i <= 40; i++, t += 250) if (c.update(pose(0, i * 0.001), t) === 50) fast++;   // 0.25 % of shoulder width per sample
  assert.ok(fast >= 2, `drift re-triggered the full rate ${fast} times`);
});

test("one landmark moving is enough (head down, shoulders fixed)", () => {
  const c = createRateController(OPTS);
  c.update(pose(), 0); c.update(pose(), 4000);
  const p = pose(); p[0] = { x: 0.5, y: 0.53 };
  assert.equal(c.update(p, 4250), 50);
});

test("nobody in frame: slow watch, then full rate when someone appears", () => {
  const c = createRateController(OPTS);
  assert.equal(c.update(null, 0), 250);
  assert.equal(c.update(pose(), 250), 50);
});

test("pipeline id names what actually ran", () => {
  assert.equal(pipelineId({ vision: { mode: "worker", delegate: "CPU" } }), "mp0.10.14-pose_full/cpu/worker");
  assert.equal(pipelineId({ vision: { mode: "main", delegate: "GPU" }, precision: { faceModel: "on", rtmw: { state: "off" } } }), "mp0.10.14-pose_full/gpu/main+face");
  assert.equal(pipelineId({ vision: { mode: "worker", delegate: "GPU" }, precision: { faceModel: "on", rtmw: { state: "on", model: "rtmw-x", ep: "webgpu" } } }),
    "mp0.10.14-pose_full/gpu/worker+face+rtmw-x:webgpu");
  assert.equal(pipelineId(), "mp0.10.14-pose_full/unknown/main");
});

test("a recording whose pipeline changed is marked mixed", () => {
  assert.equal(pipelineOfFrames(["a", "a", undefined]), "a");
  assert.equal(pipelineOfFrames(["b", "a", "b"]), "mixed(a|b)");
  assert.equal(pipelineOfFrames([]), "unknown");
});
