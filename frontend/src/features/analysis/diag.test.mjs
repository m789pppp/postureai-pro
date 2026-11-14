// Run: node --test src/features/analysis/diag.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { rateFrom, pushError, diagSnapshot, diagFrame, diagSet, diagError } from "./diag.js";

test("rate: analyses per second over the recent window", () => {
  const t = Array.from({ length: 101 }, (_, i) => 1000 + i * 50);      // 20/s for 5 s
  assert.equal(rateFrom(t, 6000), 20);
  assert.equal(rateFrom([1000], 1100), 0);
  assert.equal(rateFrom(t, 60000), 0);                                 // nothing recent: stalled
});

test("errors: short list, repeats collapsed, long text cut", () => {
  const l = [];
  pushError(l, "boom"); pushError(l, "boom"); pushError(l, "x".repeat(900));
  assert.equal(l.length, 2); assert.equal(l[0].n, 2); assert.equal(l[1].msg.length, 240);
  for (let i = 0; i < 20; i++) pushError(l, `e${i}`);
  assert.equal(l.length, 8); assert.equal(l.at(-1).msg, "e19");
});

test("snapshot carries the facts a report needs and nothing about the person", () => {
  diagSet({ pipeline: "mp0.10.14-pose_full/gpu/main+face", experiments: "diag" });
  for (let i = 0; i < 40; i++) diagFrame(i * 50);
  diagError("TypeError: x is undefined");
  const s = diagSnapshot(2000);
  assert.equal(s.pipeline, "mp0.10.14-pose_full/gpu/main+face");
  assert.equal(s.analysesPerSec, 20);
  assert.deepEqual(s.errors, ["TypeError: x is undefined"]);
  assert.ok(!JSON.stringify(s).includes("landmark\":"));
});
