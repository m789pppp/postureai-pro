/**
 * Train the slump classifier (src/features/analysis/slumpModel.js) on the
 * OpenSim training samples (validation/opensim/export_training.py), and write
 * the weights into slumpModel.js.
 *
 *   python3 ../validation/opensim/export_training.py 2500 11
 *   node scripts/train-slump.mjs            # trains, reports, writes weights
 *   node scripts/train-slump.mjs --dry      # report only
 *
 * Softmax regression, no dependency. Test sets: a random 20% of samples, and
 * an out-of-distribution set (long necks and extreme eye heights, plus
 * cameras outside the training range) that the model never trains on.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { projectToLandmarks, DEFAULT_BODY } from "../src/features/analysis/syntheticSubject.mjs";
import { slumpFeatures, SLUMP_CLASSES } from "../src/features/analysis/slumpModel.js";

const here = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(resolve(here, "../../validation/opensim/training.json"), "utf8"));
const W = 1280, H = 720;
let seed = 99; const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const gauss = () => Math.sqrt(-2 * Math.log(rnd() || 1e-9)) * Math.cos(2 * Math.PI * rnd());

function frame(points, cam, body, noise = 0.0025) {
  const pts = {}; for (const [i, p] of Object.entries(points)) pts[i] = { x: p[0], y: p[1], z: p[2] };
  return projectToLandmarks(pts, cam, body).map(l => l && l.visibility > 0 ? { ...l, x: l.x + noise * gauss(), y: l.y + noise * gauss() } : l);
}

function example(s, cam) {
  const body = { ...DEFAULT_BODY, torsoLenCm: DEFAULT_BODY.torsoLenCm * (s.scale.torso_len || 1) };
  const base = [];
  for (let k = 0; k < 9; k++) { const f = slumpFeatures(frame(s.neutral, cam, body), W, H); if (f) base.push(f); }
  const f = slumpFeatures(frame(s.pose, cam, body), W, H);
  if (!f || base.length < 5) return null;
  const med = i => { const a = base.map(r => r[i]).sort((x, y) => x - y); return a[a.length >> 1]; };
  return { x: f.map((v, i) => v - med(i)), y: SLUMP_CLASSES.indexOf(s.cls) };
}

const ood = s => s.scale.neck_len > 1.12 || s.scale.eye_up < 0.45 || s.scale.eye_up > 1.55;
const camIn = () => ({ distCm: 45 + rnd() * 35, heightCm: -5 + rnd() * 25 });
const camOut = () => ({ distCm: rnd() < 0.5 ? 38 + rnd() * 6 : 82 + rnd() * 10, heightCm: rnd() < 0.5 ? -12 : 25 });

const train = [], test = [], oodSet = [];
for (const s of data.samples) {
  if (ood(s)) { for (let r = 0; r < 2; r++) { const e = example(s, camOut()); if (e) oodSet.push(e); } continue; }
  const dest = rnd() < 0.2 ? test : train;
  for (let r = 0; r < 4; r++) { const e = example(s, camIn()); if (e) dest.push(e); }
}

const F = train[0].x.length, K = SLUMP_CLASSES.length;
const mean = Array.from({ length: F }, (_, i) => train.reduce((a, e) => a + e.x[i], 0) / train.length);
const std = Array.from({ length: F }, (_, i) => Math.sqrt(train.reduce((a, e) => a + (e.x[i] - mean[i]) ** 2, 0) / train.length) || 1);
const norm = x => x.map((v, i) => (v - mean[i]) / std[i]);
const Wt = Array.from({ length: K }, () => new Array(F).fill(0)), b = new Array(K).fill(0);
const prob = x => { const z = Wt.map((w, k) => w.reduce((s, wi, i) => s + wi * x[i], b[k])); const m = Math.max(...z);
  const e = z.map(v => Math.exp(v - m)); const S = e.reduce((a, c) => a + c, 0); return e.map(v => v / S); };
const lr = 0.3, l2 = 1e-3, Xtr = train.map(e => ({ x: norm(e.x), y: e.y }));
for (let ep = 0; ep < 400; ep++) {
  const gW = Wt.map(r => r.map(() => 0)), gb = b.map(() => 0);
  for (const { x, y } of Xtr) { const p = prob(x); for (let k = 0; k < K; k++) { const d = p[k] - (k === y ? 1 : 0); gb[k] += d; for (let i = 0; i < F; i++) gW[k][i] += d * x[i]; } }
  for (let k = 0; k < K; k++) { b[k] -= lr * gb[k] / Xtr.length; for (let i = 0; i < F; i++) Wt[k][i] -= lr * (gW[k][i] / Xtr.length + l2 * Wt[k][i]); }
}

function report(name, set) {
  const cm = Array.from({ length: K }, () => new Array(K).fill(0)); let ok = 0;
  for (const e of set) { const p = prob(norm(e.x)); const k = p.indexOf(Math.max(...p)); cm[e.y][k]++; if (k === e.y) ok++; }
  console.log(`\n${name}: ${set.length} examples, ${Math.round(100 * ok / set.length)}% correct (synthetic, OpenSim fixture)`);
  console.log("true \\ predicted".padEnd(18) + SLUMP_CLASSES.map(c => c.slice(0, 9).padStart(10)).join(""));
  cm.forEach((row, i) => console.log(SLUMP_CLASSES[i].padEnd(18) + row.map(v => String(v).padStart(10)).join("")));
  return ok / set.length;
}
report("train", train); const tAcc = report("held-out", test); const oAcc = report("out-of-distribution", oodSet);

if (!process.argv.includes("--dry")) {
  const path = resolve(here, "../src/features/analysis/slumpModel.js");
  const src = readFileSync(path, "utf8");
  const r4 = v => Math.round(v * 1e4) / 1e4;
  const block = `// BEGIN WEIGHTS\n// ${new Date().toISOString().slice(0, 10)} · ${train.length} train examples · held-out ${Math.round(tAcc * 100)}% · OOD ${Math.round(oAcc * 100)}% (synthetic only)\nexport const SLUMP_MODEL = ${JSON.stringify({ mean: mean.map(r4), std: std.map(r4), W: Wt.map(r => r.map(r4)), b: b.map(r4) })};\n// END WEIGHTS`;
  writeFileSync(path, src.replace(/\/\/ BEGIN WEIGHTS[\s\S]*?\/\/ END WEIGHTS/, block));
  console.log("\nweights written to", path);
}
