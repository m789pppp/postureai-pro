// Run: node --test src/features/analysis/mediapipeLoader.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { isSoftwareRenderer, delegateOrder, createTask, MP_SOURCES } from "./mediapipeLoader.js";

test("software rasterisers are recognised, real GPUs are not", () => {
  for (const s of ["ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)",
                   "llvmpipe (LLVM 15.0.7, 256 bits)", "ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0)",
                   "Google SwiftShader"]) assert.equal(isSoftwareRenderer(s), true, s);
  for (const s of ["ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)", "Apple M2", "Mali-G78",
                   "ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11 vs_5_0 ps_5_0)", "Adreno (TM) 650", ""])
    assert.equal(isSoftwareRenderer(s), false, s);
});

test("delegate order: CPU only without hardware WebGL", () => {
  assert.deepEqual(delegateOrder("Apple M2"), ["GPU", "CPU"]);
  assert.deepEqual(delegateOrder("Google SwiftShader"), ["CPU"]);
  assert.deepEqual(delegateOrder(null), ["CPU"]);
});

test("createTask falls back across delegates, then across model URLs", async () => {
  const tried = [];
  const Cls = { createFromOptions: async (_f, o) => {
    tried.push(`${o.baseOptions.modelAssetPath}:${o.baseOptions.delegate}`);
    if (o.baseOptions.modelAssetPath === "local" || o.baseOptions.delegate === "GPU") throw new Error("nope");
    return { ok: true, numPoses: o.numPoses };
  } };
  const r = await createTask(Cls, {}, ["local", "cdn"], { numPoses: 1 }, ["GPU", "CPU"]);
  assert.deepEqual(tried, ["local:GPU", "local:CPU", "cdn:GPU", "cdn:CPU"]);
  assert.deepEqual([r.delegate, r.model, r.task.numPoses], ["CPU", "cdn", 1]);
  await assert.rejects(createTask(Cls, {}, "local", {}, ["CPU"]), /nope/);
});

test("self-hosted assets come before the CDN and pin the same runtime version", () => {
  assert.equal(MP_SOURCES[0].name, "self-hosted");
  assert.ok(MP_SOURCES[0].face.startsWith("/mediapipe/") && MP_SOURCES[0].pose.startsWith("/mediapipe/"));
  assert.match(MP_SOURCES[1].bundle, /tasks-vision@0\.10\.14\//);
});
