#!/usr/bin/env node
/**
 * replay-bench.mjs — runs the scoring engine over real Posmoz Bench recordings and says,
 * for every posture of every person, whether the engine got it right.
 *
 *   node scripts/replay-bench.mjs <session.json | folder> [--exp head3d] [--compare head3d] [--out report.md] [--json]
 *
 * A recording (from /bench.html) holds the landmarks MediaPipe produced, frame by frame,
 * for each posture, plus the value measured by hand. Replaying it runs exactly the
 * pipeline the live app runs after the camera — smoothing, then analyzeMP() — so a fix
 * to the engine can be checked against the same real people without recording again.
 *
 * Per posture it reports:
 *   expected   at least one of the posture's expected alerts fired while it was held
 *   cross-talk an alert fired that belongs to a different posture (a turn read as a tilt)
 *   reading    the engine's own number for that posture against the measured one
 * --compare X  runs the engine twice, without and with experiment X, and puts the two
 *              side by side, so a change is judged on the same frames.
 *
 * What it cannot see: anything before the landmarks (camera, MediaPipe, the face model's
 * own errors) — those are already baked into the recording.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, basename } from "node:path";
import { analyzeMP, resetProportions, createLandmarkSmoother } from "../src/features/analysis/postureEngine.js";
import { createNeutralLearner } from "../src/features/analysis/calibrationCore.js";
import { BENCH_STEPS } from "../src/features/analysis/benchProtocol.js";
import { QUALITY } from "../src/lib/tierQuality.js";

/** The engine reading that corresponds to each bench target, and how to get it. */
const READING = {
  head_flexion_deg:   r => r?.bodyModules?.monitor?.pitchDeg,
  head_tilt_deg:      r => r?.metrics?.head_tilt?.value,
  head_yaw_deg:       r => r?.metrics?.head_yaw?.value,
  shoulder_level_deg: r => r?.metrics?.shoulder_level?.value,
  spine_lateral_deg:  r => r?.metrics?.spine_lean?.value,
  protraction_cm:     r => r?.metrics?.fhp_index?.value,
};
const STEP = Object.fromEntries(BENCH_STEPS.map(s => [s.id, s]));
const median = a => { const f = a.filter(Number.isFinite).sort((x, y) => x - y); return f.length ? f[f.length >> 1] : null; };
const r1 = v => (Number.isFinite(v) ? Math.round(v * 10) / 10 : null);

const unpack = a => (a ? a.map(([x, y, z, v]) => ({ x, y, z, visibility: v })) : null);

/** Replays one session. Pure apart from the engine's module state, which is reset. */
export function replaySession(session, { exp = [] } = {}) {
  const W = session.camera?.width || 1280, H = session.camera?.height || 720;
  const head3d = exp.includes("head3d");
  const edge = exp.includes("edge");
  const fhpguard = exp.includes("fhpguard");
  const trunklean = exp.includes("trunklean");
  const modcap = exp.includes("modcap");
  const tiltguard = exp.includes("tiltguard");
  let clock = 0;
  const realPerf = globalThis.performance;
  Object.defineProperty(globalThis, "performance", { value: { now: () => clock }, configurable: true });
  try {
    resetProportions();
    const smoother = createLandmarkSmoother(QUALITY.standard.smoothingAlpha, QUALITY.standard.outlierMaxConsecutive);
    const neutral = createNeutralLearner();
    // Head-pitch neutral for head3d: a calibrated one if the session has it, otherwise the
    // median head pitch of the bench's own "neutral" step (sitting upright, measured 0).
    // The app's in-session learner cannot be used here: a bench changes posture every few
    // seconds, so within its 30 s window it would average the postures being measured.
    const neutralStep = (session.steps || []).find(st => st.id === "neutral");
    const benchNeutral = median((neutralStep?.frames || []).filter(f => f.head && f.t - (neutralStep.frames[0]?.t ?? 0) >= 1500).map(f => f.head[0]));
    const calibPitch = typeof session.calib?.head_pose_neutral?.pitch === "number" ? session.calib.head_pose_neutral.pitch : benchNeutral;
    const sess = 0;
    const steps = [];
    for (const step of session.steps || []) {
      const frames = step.frames || [];
      const t0 = frames[0]?.t ?? 0, tEnd = frames[frames.length - 1]?.t ?? 0;
      const fired = {}; let judged = 0;
      const readings = [], scores = [];
      for (const f of frames) {
        clock = f.t; analyzeMP.__testNowMs = f.t;
        const lms = unpack(f.fused || f.raw);
        if (!lms) continue;
        const sm = smoother.smooth(lms);
        let ext = null;
        if (head3d && f.head) {
          const n = typeof calibPitch === "number" ? calibPitch : neutral.feed(f.head[0], f.t);
          ext = { head: { pitchDeg: f.head[0], neutralDeg: typeof calibPitch === "number" ? calibPitch : n }, moderateCap: true };
        } else if (f.head) neutral.feed(f.head[0], f.t);
        if (edge) ext = { ...(ext || {}), edgeGuard: true };
        if (fhpguard) ext = { ...(ext || {}), fhpGuard: true };
        if (trunklean) ext = { ...(ext || {}), trunkLean: true };
        if (modcap) ext = { ...(ext || {}), moderateCap: true };
        if (tiltguard) ext = { ...(ext || {}), tiltGuard: true };
        const r = analyzeMP(sm, W, H, "laptop", null, sess, null, null, ext);
        if (!r) continue;
        if (f.t - t0 < 1500) continue;                 // the person is still getting into the posture
        judged++;
        for (const a of r.alerts?.detailed || []) { const k = a?.key; if (k) fired[k] = (fired[k] || 0) + 1; }   // alerts is a string array; .detailed carries the keys
        if (Number.isFinite(r.score)) scores.push(r.score);
        const get = READING[step.target]; if (get) readings.push(get(r));
      }
      const share = Object.fromEntries(Object.entries(fired).map(([k, n]) => [k, n / Math.max(1, judged)]));
      const on = k => (share[k] || 0) >= 0.4;          // fired on at least 40 % of the held frames
      const spec = STEP[step.id] || { expectAny: [], forbid: [] };
      const expectedOk = !spec.expectAny?.length || spec.expectAny.some(on);
      const crossTalk = (spec.forbid || []).filter(on);
      const reading = median(readings);
      steps.push({
        id: step.id, target: step.target, measured: step.measured, reading: r1(reading),
        error: Number.isFinite(reading) && Number.isFinite(step.measured) ? r1(Math.abs(reading) - Math.abs(step.measured)) : null,
        score: r1(median(scores)), framesJudged: judged, heldSec: r1((tEnd - t0) / 1000),
        expectAny: spec.expectAny || [], expectedOk, crossTalk,
        alerts: Object.entries(share).filter(([, v]) => v >= 0.4).map(([k, v]) => `${k} ${Math.round(v * 100)}%`),
        pipeline: step.pipeline || null,
      });
    }
    return { subject: session.subject || "?", benchVersion: session.bench_version ?? null, measureVersion: session.measure_version ?? null, frame: `${W}x${H}`, steps };
  } finally {
    analyzeMP.__testNowMs = null;
    Object.defineProperty(globalThis, "performance", { value: realPerf, configurable: true });
  }
}

/** Per-posture summary across people: how often it was caught, cross-talk, typical error. */
export function summarise(results) {
  const by = {};
  for (const res of results) for (const s of res.steps) {
    const b = (by[s.id] ||= { id: s.id, n: 0, caught: 0, crossTalk: 0, errors: [] });
    b.n++; if (s.expectedOk) b.caught++; if (s.crossTalk.length) b.crossTalk++;
    if (Number.isFinite(s.error)) b.errors.push(Math.abs(s.error));
  }
  return Object.values(by).map(b => ({ ...b, medianAbsError: r1(median(b.errors)), errors: undefined }));
}

function loadSessions(path) {
  const files = statSync(path).isDirectory() ? readdirSync(path).filter(f => f.endsWith(".json")).map(f => join(path, f)) : [path];
  return files.map(f => ({ file: basename(f), data: JSON.parse(readFileSync(f, "utf8")) })).filter(x => Array.isArray(x.data.steps));
}

function markdown(runs, label) {
  const L = [];
  for (const [name, results] of runs) {
    L.push(`## ${name}`, "", "| Posture | People | Caught | Cross-talk | Median abs error |", "|---|---|---|---|---|");
    for (const s of summarise(results)) L.push(`| ${s.id} | ${s.n} | ${s.caught}/${s.n} | ${s.crossTalk} | ${s.medianAbsError ?? ""} |`);
    L.push("");
    for (const res of results) {
      L.push(`### ${res.subject} (${res.frame}, bench v${res.benchVersion ?? "?"}, ${res.measureVersion ?? "?"})`, "",
        "| Posture | Measured | Engine | Error | Score | Expected | Cross-talk | Alerts held |", "|---|---|---|---|---|---|---|---|");
      for (const s of res.steps) L.push(`| ${s.id} | ${s.measured ?? ""} | ${s.reading ?? ""} | ${s.error ?? ""} | ${s.score ?? ""} | ${s.expectAny.length ? (s.expectedOk ? "yes" : "**NO**") : "-"} | ${s.crossTalk.length ? "**" + s.crossTalk.join(", ") + "**" : ""} | ${s.alerts.join(", ")} |`);
      L.push("");
    }
  }
  return [`# Bench replay${label ? " — " + label : ""}`, "",
    "Caught = an expected alert held for ≥40% of the frames after the first 1.5 s. Cross-talk = an alert that belongs to another posture.",
    "Error = |engine| − |measured| (sign conventions differ between the two, so magnitudes are compared). Not a validation study.", "", ...L].join("\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = k => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : null; };
  const path = process.argv[2];
  if (!path || path.startsWith("--")) { console.error("usage: node scripts/replay-bench.mjs <session.json|folder> [--exp head3d] [--compare head3d] [--out file.md] [--json]"); process.exit(2); }
  const sessions = loadSessions(path);
  if (!sessions.length) { console.error("no bench sessions found"); process.exit(1); }
  const exp = (arg("exp") || "").split(",").filter(Boolean), cmp = (arg("compare") || "").split(",").filter(Boolean);
  const run = e => sessions.map(s => replaySession(s.data, { exp: e }));
  const runs = cmp.length ? [["engine as shipped", run(exp)], [`with ${cmp.join(",")}`, run([...exp, ...cmp])]] : [[exp.length ? `with ${exp.join(",")}` : "engine as shipped", run(exp)]];
  if (process.argv.includes("--json")) { console.log(JSON.stringify(Object.fromEntries(runs), null, 1)); process.exit(0); }
  const md = markdown(runs, `${sessions.length} session(s)`);
  const out = arg("out"); if (out) { writeFileSync(out, md); console.log(`wrote ${out}`); } else console.log(md);
}
