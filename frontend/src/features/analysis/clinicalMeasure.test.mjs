/** Ground-truth checks for the validation-study readings. */
import { analyzeMP, PL, resetProportions } from "./postureEngine.js";
import { renderSubject } from "./syntheticSubject.mjs";
import { measureSideView, summarizeTrial, trialsToCsv } from "./clinicalMeasure.js";

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => { if (ok) pass++; else { fail++; console.log(`FAIL ${name} ${detail}`); } };
const near = (a, b, tol = 0.11) => a != null && Math.abs(a - b) <= tol;
const rad = d => d * Math.PI / 180;

/** Profile subject with a known CVA, trunk angle and head angle, in pixels. */
function profile({ cva, trunk = 0, head = 10, facing = 1, W = 1280, H = 720, scale = 1, near_ = "L" }) {
  const hip = { x: 640, y: 620 };
  const sh = { x: hip.x + facing * 300 * scale * Math.sin(rad(trunk)), y: hip.y - 300 * scale * Math.cos(rad(trunk)) };
  const ear = { x: sh.x + facing * 120 * scale * Math.cos(rad(cva)), y: sh.y - 120 * scale * Math.sin(rad(cva)) };
  const eye = { x: ear.x + facing * 60 * scale * Math.cos(rad(head)), y: ear.y - 60 * scale * Math.sin(rad(head)) };
  const nose = { x: ear.x + facing * 80 * scale, y: ear.y + 10 };
  const lm = (p, visibility) => ({ x: p.x / W, y: p.y / H, z: 0, visibility });
  const out = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0 }));
  const [e, s, h, y] = near_ === "L" ? [PL.L_EAR, PL.L_SHOULDER, PL.L_HIP, PL.L_EYE] : [PL.R_EAR, PL.R_SHOULDER, PL.R_HIP, PL.R_EYE];
  const [s2] = near_ === "L" ? [PL.R_SHOULDER] : [PL.L_SHOULDER];
  out[e] = lm(ear, .95); out[s] = lm(sh, .95); out[h] = lm(hip, .95); out[y] = lm(eye, .9);
  out[s2] = lm({ x: sh.x + 8, y: sh.y }, .3); out[PL.NOSE] = lm(nose, .9);
  return out;
}

for (const cva of [30, 40, 48.6, 55, 62.3, 75, 90, 100]) for (const facing of [1, -1]) {
  const r = measureSideView(profile({ cva, facing }), 1280, 720);
  check(`CVA ${cva} facing ${facing}`, near(r.values.cva_proxy_deg.value, cva), JSON.stringify(r.values.cva_proxy_deg));
}
for (const trunk of [-10, 0, 7.5, 20, 35]) for (const facing of [1, -1]) {
  const r = measureSideView(profile({ cva: 50, trunk, facing }), 1280, 720);
  check(`trunk ${trunk} facing ${facing}`, near(r.values.trunk_inclination_deg.value, trunk), JSON.stringify(r));
}
for (const head of [-15, 0, 12.4, 25]) {
  const r = measureSideView(profile({ cva: 50, head }), 1280, 720);
  check(`head ${head}`, near(r.values.head_sagittal_deg.value, head));
}
for (const [W, H, scale] of [[640, 480, .5], [1920, 1080, 1], [720, 1280, .8]]) {
  const r = measureSideView(profile({ cva: 47.5, W, H, scale }), W, H);
  check(`scale and aspect ${W}x${H}`, near(r.values.cva_proxy_deg.value, 47.5), JSON.stringify(r));
}
check("right side near", near(measureSideView(profile({ cva: 52, near_: "R" }), 1280, 720).values.cva_proxy_deg.value, 52));

const front = renderSubject({}, {}, {});
for (const i of [PL.L_HIP, PL.R_HIP]) Object.assign(front[i], { y: 0.95, visibility: 0.95 });
const notSide = measureSideView(front, 1280, 720);
check("front view refused", notSide.reason === "not_side_view" && notSide.values.cva_proxy_deg.value === null, JSON.stringify(notSide));
const noHip = profile({ cva: 50 }); noHip[PL.L_HIP].visibility = .2; noHip[PL.R_HIP].visibility = .1;
check("hidden hip gives null", measureSideView(noHip, 1280, 720).values.cva_proxy_deg.value === null);
const noEar = profile({ cva: 50 }); noEar[PL.L_EAR].visibility = .1;
check("hidden ear gives null", measureSideView(noEar, 1280, 720).values.cva_proxy_deg.value === null);

const read = pose => { resetProportions(); let r; for (let i = 0; i < 90; i++) r = analyzeMP(renderSubject(pose, {}, {}), 1280, 720, "front"); return r; };
for (const d of [-12, -5, 0, 6, 15]) {
  const r = read({ shoulderTiltDeg: d });
  const m = r.measurements.shoulder_tilt_deg;
  check(`shoulder tilt ${d} magnitude`, near(m.value, Math.abs(d), .6), JSON.stringify(m));
  if (d) check(`shoulder tilt ${d} sign`, Math.sign(m.signed) === Math.sign(d), JSON.stringify(m));
}
{
  const r = read({ shoulderTiltDeg: 8 });
  check("one decimal", Number.isInteger(r.measurements.shoulder_tilt_deg.value * 10 + 1e-9) || Math.abs(r.measurements.shoulder_tilt_deg.value * 10 - Math.round(r.measurements.shoulder_tilt_deg.value * 10)) < 1e-6);
  check("legacy metric unchanged in shape", Number.isInteger(r.metrics.shoulder_level.value));
  check("measurement agrees with legacy", Math.abs(r.measurements.shoulder_tilt_deg.value - r.metrics.shoulder_level.value) <= .5);
  const elbowOff = r.measurements;
  for (const [k, e] of Object.entries(elbowOff)) if (!e.reliable) check(`${k} null when unreliable`, e.value === null && e.signed === null);
}

const entry = v => ({ value: v, signed: v, unit: "deg", method: "m", reliable: true });
const frames = Array.from({ length: 60 }, (_, i) => ({ t: i * 100, values: { a: i < 20 ? entry(999) : entry(40 + (i % 2)), b: { ...entry(5), reliable: i >= 55 } } }));
const s = summarizeTrial(frames, { settleMs: 2000, minFrames: 20 });
check("settling dropped", s.a.n === 40 && near(s.a.median, 40.5, .51) && s.a.mean < 41, JSON.stringify(s.a));
check("thin metric unusable", s.b.usable === false && s.b.median === null && s.b.n === 5 && s.b.excluded === 35, JSON.stringify(s.b));
const csv = trialsToCsv([{ participantId: "=cmd()", trial: 1, view: "side", posture: 'a"b', rater: "R1", capturedAt: "2026-11-08", summary: s }]);
check("formula neutralised", csv.includes(`"'=cmd()"`));
check("quote escaped", csv.includes(`"a""b"`));
check("reference column present and blank", csv.split("\r\n")[0].includes("reference_value") && csv.split("\r\n")[1].endsWith(",,"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
