/**
 * slumpModel — the learned layer's guard rails (not its accuracy).
 *   node src/features/analysis/slumpModel.test.mjs
 */
import { createSlumpTracker, slumpMetric, slumpFeatures, SLUMP_MODEL, SLUMP_CLASSES } from "./slumpModel.js";
import { renderSubject } from "./syntheticSubject.mjs";

let pass = 0, fail = 0;
const check = (n, ok, d = "") => { ok ? pass++ : fail++; console.log(`  ${ok ? "ok  " : "FAIL"}  ${n}${d ? " — " + d : ""}`); };
const W = 1280, H = 720;

check("weights are present and match the feature count",
  SLUMP_MODEL && SLUMP_MODEL.W.length === SLUMP_CLASSES.length && SLUMP_MODEL.W[0].length === slumpFeatures(renderSubject(), W, H).length);
check("no features without the face and shoulders", slumpFeatures(renderSubject().map((l, i) => i === 0 ? { ...l, visibility: 0 } : l), W, H) === null);

const t = createSlumpTracker();
let p = null;
for (let i = 0; i < 39; i++) p = t.update(renderSubject(), W, H);
check("learning first: no probabilities before the neutral is learned", p === null && t.learning);
check("learning shows as unmeasured, not as a finding", slumpMetric(null, { learning: true }).reliable === false);
for (let i = 0; i < 60; i++) p = t.update(renderSubject(), W, H);
check("sitting as at the start: no finding", slumpMetric(p).severity === "normal", JSON.stringify(p?.map(v => +v.toFixed(2))));
for (let i = 0; i < 60; i++) p = t.update(renderSubject({ neckFlexDeg: 30 }), W, H);
check("head-down is left to the neck metrics", slumpMetric(p).severity === "normal", SLUMP_CLASSES[p.indexOf(Math.max(...p))]);
t.reset();
check("reset forgets the neutral", t.learning);
check("a confident non-neutral class becomes a finding", slumpMetric([0.05, 0, 0.9, 0.05, 0]).severity === "moderate" && slumpMetric([0.05, 0, 0.9, 0.05, 0]).kind === "recline_slump");
check("a weak one does not", slumpMetric([0.4, 0, 0.5, 0.1, 0]).severity === "normal");

console.log(`\n${pass} passed · ${fail} failed`);
if (fail) process.exit(1);
