/**
 * qaAccuracy — the statistics behind the live QA validation protocol.
 *
 * The first version of this tool reported a "94%-style accuracy" that was
 * really four binary direction checks, and every one of the four was a fault —
 * so a detector that flagged literally everything scored 100%. These
 * assertions exist to make that class of result impossible to produce again.
 *
 *   node src/lib/qaAccuracy.test.mjs
 */
globalThis.localStorage = (() => {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null),
           setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) };
})();

const {
  mean, sd, cohensD, wilson, phaseStats, evaluateRun, aggregate,
  loadTrials, saveTrials, clearTrials, fmtPct,
  PROTOCOL, FAULT_PHASES, CONTROL_PHASES, SETTLE_SECONDS, ALERT_TO_METRIC, METRIC_UNITS,
} = await import("./qaAccuracy.js");

let pass = 0, fail = 0; const failures = [];
const check = (name, ok, detail = "") => {
  if (ok) pass++; else { fail++; failures.push(name + (detail ? " — " + detail : "")); }
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
};
const eq = (n, g, w) => check(n, JSON.stringify(g) === JSON.stringify(w), `got ${JSON.stringify(g)}, want ${JSON.stringify(w)}`);
const near = (n, g, w, tol = 0.02) => check(n, g != null && Math.abs(g - w) <= tol, `got ${g}, want ~${w}`);

// ── frame builders ────────────────────────────────────────────────
const T0 = 1_000_000;
/** `sec` seconds of frames at 20fps for one metric, plus which alerts fired. */
function frames({ seconds = 12, value = 10, jitter = 0.5, score = 90, key = "fhp_index",
                  alerts = [], reliable = true, fps = 20, hasDetailed = true } = {}) {
  const out = [];
  const n = seconds * fps;
  for (let i = 0; i < n; i++) {
    // deterministic pseudo-noise so the suite never flakes
    const w = Math.sin(i * 2.399963) * jitter;
    out.push({
      t: T0 + (i / fps) * 1000,
      metrics: { [key]: { value: value + w, score, reliable } },
      alertKeys: alerts,
      hasDetailed,
    });
  }
  return out;
}

console.log("\nbasic statistics");
eq("mean of nothing is null, not 0", mean([]), null);
near("sample sd", sd([2, 4, 4, 4, 5, 5, 7, 9]), 2.138);
eq("sd needs two points", sd([5]), null);
// d is the separation measured in pooled noise widths: same gap, more noise,
// smaller d. That is the whole point of using it instead of a fixed margin.
near("a 3-unit gap in quiet data is a large effect", cohensD([13, 13, 14, 12], [10, 10, 11, 9]), 3.67, 0.1);
check("the same gap in noisy data is not",
  Math.abs(cohensD([13, 20, 6, 13], [10, 17, 3, 10])) < 0.8,
  `d=${cohensD([13,20,6,13],[10,17,3,10]).toFixed(2)}`);
eq("two identical samples separate by nothing", cohensD([10, 11, 10, 11], [10, 11, 10, 11]), 0);
eq("d needs two points a side", cohensD([10], [12]), null);
eq("zero pooled noise yields null, not Infinity", cohensD([10, 10, 10], [12, 12, 12]), null);

console.log("\nWilson intervals — the reason a small run cannot be quoted");
{
  const clean = wilson(4, 4);
  near("4 of 4 is 100%", clean.p, 1);
  check("but its interval reaches well below 100%", clean.lo < 0.6,
    `lo=${(clean.lo * 100).toFixed(0)}% — a normal-approximation CI would be 100–100%`);
  const many = wilson(40, 40);
  check("forty of forty is much tighter", many.lo > clean.lo,
    `4/4 lo=${clean.lo.toFixed(2)} vs 40/40 lo=${many.lo.toFixed(2)}`);
  const half = wilson(2, 4);
  check("an interval never leaves [0,1]", half.lo >= 0 && half.hi <= 1);
  eq("no trials means no number", wilson(0, 0).p, null);
  check("the formatter cannot drop the interval", /CI/.test(fmtPct(0.75, 0.3, 0.95)));
}

console.log("\nthe settle window is discarded");
{
  // 3s of "still moving into position" at a wild value, then 9s held at 20.
  const moving = frames({ seconds: SETTLE_SECONDS, value: 60, jitter: 0 });
  const held   = frames({ seconds: 9, value: 20, jitter: 0 })
                   .map(f => ({ ...f, t: f.t + SETTLE_SECONDS * 1000 }));
  const st = phaseStats([...moving, ...held], "fhp_index");
  near("the transition frames do not enter the mean", st.meanValue, 20, 0.5);
  check("and they are counted as dropped", st.framesHeld < st.framesTotal,
    `${st.framesHeld} held of ${st.framesTotal}`);
}

console.log("\nunreliable frames are dropped, not averaged");
{
  // The engine returns score 90 / a placeholder value for a metric it could
  // not measure. Averaging those in pulls a fault phase back toward "fine" —
  // and it does that hardest on the postures that are hardest to track.
  const good = frames({ seconds: 6, value: 22, score: 30, jitter: 0 });
  const bad  = frames({ seconds: 6, value: 0,  score: 90, jitter: 0, reliable: false })
                 .map(f => ({ ...f, t: f.t + 6000 }));
  const st = phaseStats([...good, ...bad], "fhp_index");
  near("only the measured frames count", st.meanScore, 30, 0.5);
  check("the reliable fraction is reported", st.reliableRate != null && st.reliableRate < 0.6,
    `reliableRate=${st.reliableRate?.toFixed(2)}`);
  const naive = (30 + 90) / 2;
  check("pins the averaging-in bug as the regression", naive === 60 && st.meanScore < 35,
    `naive would have been ${naive}`);
}

console.log("\na phase is flagged only if the alert actually stood");
{
  const steady = frames({ seconds: 10, alerts: ["fhp_sev"] });
  eq("a held alert flags the phase", phaseStats(steady, "fhp_index").flagged, true);
  const flicker = frames({ seconds: 10 }).map((f, i) => ({ ...f, alertKeys: i % 10 === 0 ? ["fhp_sev"] : [] }));
  eq("a flickering one does not", phaseStats(flicker, "fhp_index").flagged, false);
  const wrongAlert = frames({ seconds: 10, alerts: ["tilt"] });
  eq("someone else's alert does not count as detecting this fault",
     phaseStats(wrongAlert, "fhp_index").flagged, false);
  eq("but it does count as noise in a control", phaseStats(wrongAlert, null).flagged, true);
}

// ── protocol-level ────────────────────────────────────────────────
function buildRun({ detectFaults = true, quietControls = true } = {}) {
  const by = {};
  for (const p of PROTOCOL) {
    const isFault = p.kind === "fault";
    const key = p.target || "fhp_index";
    const alertKeysFor = Object.keys(ALERT_TO_METRIC).filter(k => ALERT_TO_METRIC[k] === p.target);
    by[p.id] = frames({
      seconds: 12, key,
      value: isFault ? 25 : 8,
      score: isFault ? 35 : 92,
      alerts: isFault ? (detectFaults ? [alertKeysFor[0]] : []) : (quietControls ? [] : ["fhp_sev"]),
    });
  }
  // The baseline every fault is compared against. It is ALSO a control trial,
  // so it must obey quietControls — overwriting it unconditionally made the
  // "shouts at everything" engine score 33% specificity instead of 0.
  by.neutral = frames({ seconds: 12, key: "fhp_index", value: 8, score: 92,
                        alerts: quietControls ? [] : ["fhp_sev"] });
  return by;
}

console.log("\nan engine that detects every fault and stays quiet otherwise");
{
  const r = evaluateRun(buildRun());
  near("sensitivity 100%", r.sensitivity.p, 1);
  near("specificity 100%", r.specificity.p, 1);
  near("balanced accuracy 100%", r.balanced, 1);
  check("and it STILL reports an honest interval", r.balancedLo < 0.9,
    `lo=${(r.balancedLo * 100).toFixed(0)}% on ${r.nTrials} trials`);
  eq("one trial per phase", r.trials.length, PROTOCOL.length);
}

console.log("\nthe detector that shouts at everything — the case the old tool scored 100%");
{
  const r = evaluateRun(buildRun({ detectFaults: true, quietControls: false }));
  near("sensitivity is still perfect", r.sensitivity.p, 1);
  near("but specificity is zero", r.specificity.p, 0);
  near("so balanced accuracy is 50%", r.balanced, 0.5);
  check("a fault-only protocol would have called this flawless",
    r.sensitivity.p === 1 && r.balanced === 0.5);
}

console.log("\nthe detector that never fires");
{
  const r = evaluateRun(buildRun({ detectFaults: false, quietControls: true }));
  near("sensitivity zero", r.sensitivity.p, 0);
  near("specificity perfect", r.specificity.p, 1);
  near("balanced accuracy 50%, not 43%", r.balanced, 0.5);
  check("plain accuracy would have flattered it",
    (3 / 7) < 0.5 && r.balanced === 0.5,
    "3 of 7 correct = 43% plain; balanced refuses to reward the imbalance");
}

console.log("\neffect size, noise floor, repeatability, cross-talk");
{
  const by = buildRun();
  // give the neutral phase real wobble so the noise floor is not degenerate
  by.neutral = frames({ seconds: 12, key: "fhp_index", value: 8, jitter: 2, score: 92 });
  by.fhp     = frames({ seconds: 12, key: "fhp_index", value: 25, jitter: 2, score: 35, alerts: ["fhp_sev"] });
  const r = evaluateRun(by);
  check("the fault is many noise-widths away from baseline", Math.abs(r.perPhase.fhp.d) > 5,
    `d=${r.perPhase.fhp.d?.toFixed(1)}`);
  check("a noise floor is reported in the metric's own unit",
    r.noise.fhp_index?.sd > 0 && r.noise.fhp_index.unit === "cm",
    `sd=${r.noise.fhp_index?.sd?.toFixed(2)}${r.noise.fhp_index?.unit}`);
  check("repeatability compares the two neutrals", r.repeat.fhp_index?.delta != null,
    `delta=${r.repeat.fhp_index?.delta?.toFixed(2)}`);
  check("cross-talk is reported for the fault", r.crosstalk.fhp != null);
}

console.log("\na 3-point shift inside an 8-point wobble is not a finding");
{
  const by = buildRun();
  by.neutral = frames({ seconds: 12, key: "fhp_index", value: 10, jitter: 8 });
  by.fhp     = frames({ seconds: 12, key: "fhp_index", value: 13, jitter: 8, alerts: ["fhp_sev"] });
  const r = evaluateRun(by);
  check("the effect size says so even though the means differ",
    Math.abs(r.perPhase.fhp.d) < 0.8,
    `d=${r.perPhase.fhp.d?.toFixed(2)} — the old fixed "-3 points" rule would have called this a pass`);
}

console.log("\nan incomplete phase is not scored as a failure of the engine");
{
  const by = buildRun();
  by.twist = [];   // tester left the frame, or the camera dropped out
  const r = evaluateRun(by);
  check("the phase is marked incomplete", r.perPhase.twist.incomplete === true);
  eq("and contributes no trial", r.trials.filter(t => t.phaseId === "twist").length, 0);
  check("so it cannot drag the score down", r.sensitivity.n === FAULT_PHASES.length - 1,
    `fault trials = ${r.sensitivity.n}`);
}

console.log("\ntrials accumulate so the interval narrows with evidence");
{
  clearTrials();
  eq("starts empty", loadTrials().length, 0);
  let all = [];
  const one = evaluateRun(buildRun()).trials;
  all = saveTrials([...loadTrials(), ...one]);
  const after1 = aggregate(all);
  for (let i = 0; i < 9; i++) all = saveTrials([...loadTrials(), ...evaluateRun(buildRun()).trials]);
  const after10 = aggregate(all);
  eq("ten runs banked", after10.nTrials, PROTOCOL.length * 10);
  near("the estimate is unchanged", after10.balanced, after1.balanced);
  check("but the interval is materially tighter",
    (after10.balancedHi - after10.balancedLo) < (after1.balancedHi - after1.balancedLo) / 2,
    `1 run: ±${((after1.balancedHi - after1.balancedLo) * 50).toFixed(0)}pt, ` +
    `10 runs: ±${((after10.balancedHi - after10.balancedLo) * 50).toFixed(0)}pt`);
  clearTrials();
  eq("and can be reset", loadTrials().length, 0);
}

console.log("\nthe protocol itself");
check("it contains controls at all", CONTROL_PHASES.length >= 3,
  "every phase of the previous version was a fault, so nothing could ever be a false positive");
check("faults and controls interleave", PROTOCOL[0].kind === "control" && PROTOCOL[1].kind === "fault");
check("there is a repeat phase for drift", PROTOCOL.some(p => p.repeatOf));
check("every fault names a metric the engine actually emits",
  FAULT_PHASES.every(p => METRIC_UNITS[p.target]),
  FAULT_PHASES.map(p => p.target).join(", "));
check("every fault's metric has at least one alert key",
  FAULT_PHASES.every(p => Object.values(ALERT_TO_METRIC).includes(p.target)));
check("no fault targets neck_lean for a sagittal movement",
  !FAULT_PHASES.some(p => p.target === "neck_lean" && /down|forward|lap|phone/i.test(p.en)),
  "bending the neck DOWN is measured by fhp_index; neck_lean is lateral, so the old " +
  "phase-2 asked the wrong metric and failed a working engine");
check("every phase is bilingual", PROTOCOL.every(p => p.en && p.ar));

console.log("\na cloud-analysis run refuses to publish a number");
{
  // `alerts.detailed` is a property on an Array, so it does not survive JSON.
  // The cloud path serialises the result, and every frame then looks
  // alert-free — which would read as 0% sensitivity against a working engine.
  const by = buildRun();
  for (const k of Object.keys(by)) by[k] = by[k].map(f => ({ ...f, hasDetailed: false, alertKeys: [] }));
  const r = evaluateRun(by);
  eq("the run is marked unusable", r.unusable, "no_alert_keys");
  eq("and produces no trials to bank", r.trials.length, 0);
  eq("and no headline number", r.balanced, null);

  const ok = evaluateRun(buildRun());
  eq("a normal on-device run is unaffected", ok.unusable, undefined);
}

console.log(`\n${pass} passed · ${fail} failed`);
if (fail) { failures.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
