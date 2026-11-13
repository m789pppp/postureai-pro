// Run: node --test src/features/analysis/experiments.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseExperiments } from "./experiments.js";

test("nothing is on by default", () => {
  assert.deepEqual(parseExperiments("", ""), []);
  assert.deepEqual(parseExperiments("?foo=1", null), []);
});

test("?exp= turns experiments on, a stored value is used when the address has none", () => {
  assert.deepEqual(parseExperiments("?exp=head3d", ""), ["head3d"]);
  assert.deepEqual(parseExperiments("?exp=head3d, other", "x"), ["head3d", "other"]);
  assert.deepEqual(parseExperiments("", "head3d"), ["head3d"]);
});

test("?exp=off clears, and junk is ignored", () => {
  assert.deepEqual(parseExperiments("?exp=off", "head3d"), []);
  assert.deepEqual(parseExperiments("?exp=<script>,head3d,,HEAD3D", ""), ["head3d"]);
});

test("App.jsx uses the worker, the adaptive rate and the 3-D head pitch only behind their switches", async () => {
  const src = await readFile(new URL("../../App.jsx", import.meta.url), "utf8");
  assert.match(src, /const HEAD3D = experimentEnabled\("head3d"\)/);
  assert.match(src, /HEAD3D\?\{head:headPose,moderateCap:true\}:null/);
  assert.match(src, /learnNeutral:HEAD3D/);
  assert.match(src, /createVisionClient\(\{worker:EXP_WORKER\}\)/);
  assert.match(src, /\(!EXP_ADAPTIVE \|\| clinicalSinkRef\.current\) \? 50 :/);
});
