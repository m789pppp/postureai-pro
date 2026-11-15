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
  assert.match(src, /HEAD3D\?\{head:headPose,moderateCap:true\}:\{\}/);
  assert.match(src, /EXP_EDGE\?\{edgeGuard:true\}:\{\}/);
  assert.match(src, /const engineExt=\(HEAD3D\|\|EXP_EDGE\|\|EXP_FHPGUARD\|\|EXP_TRUNKLEAN\|\|EXP_MODCAP\|\|EXP_TILTGUARD\)\?/);
  assert.match(src, /EXP_TILTGUARD\?\{tiltGuard:true\}:\{\}/);
  assert.match(src, /EXP_MODCAP\?\{moderateCap:true\}:\{\}/);
  assert.match(src, /EXP_TRUNKLEAN\?\{trunkLean:true\}:\{\}/);
  assert.match(src, /EXP_FHPGUARD\?\{fhpGuard:true\}:\{\}/);
  assert.match(src, /learnNeutral:HEAD3D/);
  assert.match(src, /createVisionClient\(\{worker:EXP_WORKER\}\)/);
  assert.match(src, /\(!EXP_ADAPTIVE \|\| clinicalSinkRef\.current\) \? 50 :/);
});

test("?exp=camp turns on every camp switch plus diag, and mixes with others", () => {
  const camp = parseExperiments("?exp=camp", "");
  for (const n of ["diag", "sevlabel", "edge", "fhpguard", "trunklean", "modcap", "head3d", "tiltguard", "slump"]) assert.ok(camp.includes(n), n);
  assert.ok(!camp.includes("camp"));
  assert.deepEqual(parseExperiments("?exp=camp,worker", "").slice(-1), ["worker"]);
  assert.deepEqual(parseExperiments("", "camp"), camp);
});
