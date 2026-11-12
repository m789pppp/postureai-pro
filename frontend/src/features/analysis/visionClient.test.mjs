// Run: node --test src/features/analysis/visionClient.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { unpackPose, unpackFace, POSE_OPTIONS, createVisionClient } from "./visionClient.js";

test("pose landmarks survive the trip through the worker's packed format", () => {
  const src = Array.from({ length: 33 }, (_, i) => ({ x: i / 40, y: 1 - i / 40, z: -i / 100, visibility: i / 33 }));
  const packed = new Float32Array(33 * 4);
  src.forEach((p, i) => packed.set([p.x, p.y, p.z, p.visibility], 4 * i));
  const out = unpackPose(packed);
  assert.equal(out.length, 33);
  for (let i = 0; i < 33; i++) for (const k of ["x", "y", "z", "visibility"]) assert.ok(Math.abs(out[i][k] - src[i][k]) < 1e-6, `${i}.${k}`);
});

test("face result has the shape the precision layer reads", () => {
  const lm = new Float32Array(478 * 3).map((_, i) => i / 2000), m = new Float32Array(16).map((_, i) => i);
  const r = unpackFace({ lm, m });
  assert.equal(r.faceLandmarks[0].length, 478);
  assert.ok(Math.abs(r.faceLandmarks[0][468].y - (468 * 3 + 1) / 2000) < 1e-6);
  assert.equal(r.facialTransformationMatrixes[0].data[14], 14);
});

test("the worker runs the pose model with the same options as before", () => {
  assert.deepEqual(POSE_OPTIONS, { runningMode: "VIDEO", numPoses: 1, minPoseDetectionConfidence: .3, minPosePresenceConfidence: .3, minTrackingConfidence: .3 });
});

// ── worker mode, with a fake Worker and a fake clock ───────────────────────
let now = 0, workers = [];
function install({ failInit = false } = {}) {
  now = 1000; workers = [];
  globalThis.performance = { now: () => now };
  globalThis.location = { href: "http://localhost/" };
  globalThis.createImageBitmap = async () => ({ close() {} });
  globalThis.Worker = class {
    constructor() { this.sent = []; this.terminated = false; workers.push(this); }
    postMessage(m) {
      this.sent.push(m);
      if (m.type === "init") queueMicrotask(() => this.onmessage({ data: failInit ? { type: "error", message: "no wasm" } : { type: "ready", delegate: "CPU", source: "self-hosted" } }));
    }
    terminate() { this.terminated = true; }
    frames() { return this.sent.filter(m => m.type === "frame"); }
    answer(extra = {}) { const f = this.frames().at(-1); this.onmessage({ data: { type: "result", id: f.id, pose: new Float32Array(33 * 4).fill(0.5), ms: 40, ...extra } }); }
  };
}
const tick = () => new Promise(r => setTimeout(r, 0));
const mainStub = calls => async () => { calls.n++; return { task: { detectForVideo: () => ({ landmarks: [["main"]] }), close() {} }, delegate: "CPU", source: "self-hosted" }; };

test("worker: pending until a result arrives, each result is handed out once", async () => {
  install();
  const c = await createVisionClient({ delegates: ["CPU"] });
  assert.equal(c.mode, "worker");
  const video = {};
  assert.equal(c.pose.detectForVideo(video, 1).pending, true);          // nothing yet, first frame sent
  await tick();
  assert.equal(workers[0].frames().length, 1);
  now += 60; workers[0].answer();
  const r = c.pose.detectForVideo(video, 2);
  assert.equal(r.pending, undefined); assert.equal(r.landmarks[0].length, 33); assert.equal(r.landmarks[0][0].x, 0.5);
  assert.equal(c.pose.detectForVideo(video, 3).pending, true);          // same result is not replayed
  c.close(); assert.equal(workers[0].terminated, true);
});

test("worker: an empty frame is 'nobody there', not pending", async () => {
  install();
  const c = await createVisionClient({ delegates: ["CPU"] });
  c.pose.detectForVideo({}, 1); await tick();
  now += 60; workers[0].answer({ pose: null });
  const r = c.pose.detectForVideo({}, 2);
  assert.equal(r.pending, undefined); assert.deepEqual(r.landmarks, []);
  c.close();
});

test("worker: the next inference starts when a result arrives, never above the rate cap, only while polled", async () => {
  install();
  const c = await createVisionClient({ delegates: ["CPU"], minIntervalMs: 50 });
  const video = {};
  c.pose.detectForVideo(video, 1); await tick();
  now += 60; workers[0].answer(); await tick();                         // 60 ms since the last send: start at once
  assert.equal(workers[0].frames().length, 2);
  now += 600; workers[0].answer(); await tick();                        // nobody polled for 600 ms: session paused
  assert.equal(workers[0].frames().length, 2);
  c.close();
});

test("worker: a result left unread across a pause is dropped", async () => {
  install();
  const c = await createVisionClient({ delegates: ["CPU"], staleMs: 1000 });
  c.pose.detectForVideo({}, 1); await tick();
  now += 60; workers[0].answer();
  now += 5000;                                                          // session stopped and started again
  assert.equal(c.pose.detectForVideo({}, 2).pending, true);
  c.close();
});

test("worker: face is requested every 2nd frame once wanted, and read once", async () => {
  install();
  const c = await createVisionClient({ delegates: ["CPU"] });
  const video = {};
  assert.equal(c.face.detectForVideo(), null);                          // marks the face model as wanted
  for (let i = 0; i < 4; i++) { c.pose.detectForVideo(video, i); await tick(); now += 60; c.face.detectForVideo(); workers[0].answer(); await tick(); }
  const flags = workers[0].frames().map(f => f.face);
  assert.ok(flags.filter(Boolean).length >= 2 && flags.filter(f => !f).length >= 2, JSON.stringify(flags));
  workers[0].answer({ faceState: "on", face: { lm: new Float32Array(478 * 3).fill(0.25), m: new Float32Array(16).fill(1) } });
  assert.equal(c.face.state, "on");
  assert.equal(c.face.detectForVideo().faceLandmarks[0].length, 478);
  assert.equal(c.face.detectForVideo(), null);
  c.close();
});

test("worker that cannot start: the client runs on the main thread", async () => {
  install({ failInit: true });
  const calls = { n: 0 };
  const c = await createVisionClient({ delegates: ["CPU"], mainThread: mainStub(calls) });
  assert.equal(c.mode, "main"); assert.equal(c.face, null); assert.equal(calls.n, 1);
  assert.deepEqual(c.pose.detectForVideo({}, 1).landmarks, [["main"]]);
  assert.equal(workers[0].terminated, true);
});

test("worker that stops answering: pending, then the main thread takes over", async () => {
  install();
  const calls = { n: 0 };
  const c = await createVisionClient({ delegates: ["CPU"], stallMs: 8000, mainThread: mainStub(calls) });
  c.pose.detectForVideo({}, 1); await tick();
  now += 9000;
  assert.equal(c.pose.detectForVideo({}, 2).pending, true);             // declared dead on this call
  assert.equal(workers[0].terminated, true); assert.equal(c.face.state, "failed");
  await tick();
  assert.deepEqual(c.pose.detectForVideo({}, 3).landmarks, [["main"]]);
  c.close();
});

test("App.jsx handles a pending frame before it clears the overlay", async () => {
  const { readFile } = await import("node:fs/promises");
  const src = await readFile(new URL("../../App.jsx", import.meta.url), "utf8");
  const loop = src.slice(src.indexOf("const runLoop=useCallback"));
  const pending = loop.indexOf("_det?.pending"), clear = loop.indexOf("ov.width=W");
  assert.ok(pending > 0 && clear > 0 && pending < clear, "a pending frame must return before the skeleton is erased");
  assert.ok(/createLiveEnhancer\(calibData,\{face:mpRef\.current\?\.faceDetector/.test(src), "the precision layer must get the worker's face detector");
});
