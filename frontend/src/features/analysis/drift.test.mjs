// Run: node --test src/features/analysis/drift.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { makeSignature, cameraChange, SIG_W, SIG_H } from "./cameraDrift.js";
import { createPostureStateMachine } from "./postureState.js";

// Real-image fixture (≈460 KB) lives in the research copy; skipped when absent.
const FX = new URL("./drift.fixture.json", import.meta.url);
const fx = existsSync(FX) ? JSON.parse(readFileSync(FX)) : null;
const sig = c => makeSignature(new Uint8Array(Buffer.from(c.rgba, "base64")), fx.box);

// Smooth value noise (non-periodic, so a shift has exactly one best match).
const hash = (i, j) => { const h = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return h - Math.floor(h) - 0.5; };
function noise(x, y) {
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, s = t => t * t * (3 - 2 * t);
  const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
  return a + (b - a) * s(fx) + (c - a) * s(fy) + (a - b - c + d) * s(fx) * s(fy);
}
// Procedural textured scene: shift/rotate exactly, then sample to SIG_W×SIG_H RGBA.
function scene(pitchPx, rollDeg) {
  const out = new Uint8Array(SIG_W * SIG_H * 4), c = Math.cos(rollDeg * Math.PI / 180), s = Math.sin(rollDeg * Math.PI / 180);
  for (let y = 0; y < SIG_H; y++) for (let x = 0; x < SIG_W; x++) {
    const dx = x - SIG_W / 2, dy = y - SIG_H / 2 - pitchPx;
    const u = c * dx - s * dy, v = s * dx + c * dy;                 // inverse rotation
    const val = 128 + 90 * noise(u / 6, v / 3) + 50 * noise(u / 2.5, v / 1.5);   // non-periodic texture
    const i = (y * SIG_W + x) * 4; out[i] = out[i + 1] = out[i + 2] = Math.max(0, Math.min(255, val)); out[i + 3] = 255;
  }
  return out;
}

test("camera pitch/roll recovered on a procedural textured scene", () => {
  const W = 1280, f = 640 / Math.tan(32.5 * Math.PI / 180), box = [0.35, 0.3, 0.65, 1];
  const ref = makeSignature(scene(0, 0), box);
  for (const [p, r] of [[3, 0], [-4, 0], [0, 2], [2, -2]]) {
    const pitchPx = (f * Math.tan(p * Math.PI / 180)) / (W / SIG_W);
    const est = cameraChange(ref, makeSignature(scene(pitchPx, r), box), f, W);
    assert.ok(est.ok, `ok ${p}/${r}`);
    assert.ok(Math.abs(est.pitch - p) < 0.3, `pitch ${est.pitch} vs ${p}`);
    assert.ok(Math.abs(est.roll - r) < 0.4, `roll ${est.roll} vs ${r}`);
  }
});

test("camera pitch/roll recovered from a real background (person masked)", { skip: !fx && "fixture not present" }, () => {
  const ref = sig(fx.cases[0]);
  for (const c of fx.cases) {
    const r = cameraChange(ref, sig(c), fx.f, fx.W);
    assert.ok(r.ok, `ok for ${c.pitch}/${c.roll}`);
    assert.ok(Math.abs(r.pitch - c.pitch) < 0.2, `pitch ${r.pitch} vs ${c.pitch}`);
    assert.ok(Math.abs(r.roll - c.roll) < 0.25, `roll ${r.roll} vs ${c.roll}`);
  }
});

test("textureless background → not trusted", () => {
  const flat = new Uint8Array(SIG_W * SIG_H * 4).fill(240);
  const box = [0.35, 0.3, 0.65, 1];
  const a = makeSignature(flat, box), b = makeSignature(flat, box);
  assert.equal(cameraChange(a, b, 1005, 1280).ok, false);
});

test("posture state: hysteresis and dwell time", () => {
  const sm = createPostureStateMachine();
  let t = 0, r;
  const feed = (score, ms) => { for (let i = 0; i < ms / 100; i++) { t += 100; r = sm.update(t, score); } return r; };
  assert.equal(feed(85, 1000).state, "good");
  assert.equal(feed(50, 2000).state, "good");     // not long enough
  assert.equal(feed(50, 1500).state, "bad");      // >3 s below 60
  assert.equal(feed(63, 5000).state, "bad");      // 63 is inside the hysteresis band
  assert.equal(feed(70, 2500).state, "warn");     // left bad, still below 72
  assert.equal(feed(90, 2000).state, "good");
  assert.equal(feed(55, 300).state, "good");      // one bad blip doesn't flip it
});
