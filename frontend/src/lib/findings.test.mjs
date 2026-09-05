/**
 * findings — the layer that turns a measurement into something actionable.
 *
 * The failure this replaces is not a crash; it is thirteen rows of
 * "Neck lean · 17.4° · ▓▓▓░░". Every screen that rendered one had to decide
 * for itself whether 17.4 was bad, and they disagreed. These assertions pin
 * the properties that make a finding a finding, and the ones that stop it
 * claiming more than the camera saw.
 *
 *   node src/lib/findings.test.mjs
 */
import { readFileSync } from "node:fs";
import { buildFindings, findingsSummary, NON_POSTURAL, SEVERITY_ORDER } from "./findings.js";

let pass = 0, fail = 0; const failures = [];
const check = (name, ok, detail = "") => {
  if (ok) pass++; else { fail++; failures.push(name + (detail ? " — " + detail : "")); }
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
};
const eq = (n, g, w) => check(n, JSON.stringify(g) === JSON.stringify(w), `got ${JSON.stringify(g)}, want ${JSON.stringify(w)}`);

const M = (o = {}) => ({ value: 10, score: 60, unit: "°", label: "X", reliable: true, severity: "moderate", ...o });

console.log("\nevery finding answers all five questions");
{
  const res = buildFindings({ fhp_index: M({ value: 6.2, unit: "cm", score: 45, severity: "moderate", extra_load_kg: 4.1, neck_angle_deg: 22 }) });
  const f = res.findings[0];
  check("1 what is wrong — a name, not a metric id", !!f.title && !/_/.test(f.title), f?.title);
  check("2 how serious — from the engine, with a word not just a colour",
    f.severity === "moderate" && !!f.severityLabel && !!f.color);
  check("3 why it matters — a mechanism, not a restatement", (f.why || "").length > 60);
  check("4 what to do — an instruction", (f.action || "").length > 40);
  check("5 technical — the number survives", f.technical.value === 6.2 && f.technical.unit === "cm" && f.technical.score === 45);
  check("the observation carries the measured value", /6\.2/.test(f.headline), f?.headline);
  check("metric-specific extras are preserved", f.technical.extra.extra_load_kg === 4.1 && f.technical.extra.neck_angle_deg === 22);
}

console.log("\nseverity is the engine's, never re-derived from the score");
{
  // A low score with a normal severity must stay normal. Re-deriving
  // seriousness from the 0-100 number is a second answer to the same
  // question, and the two drift the moment a threshold is tuned.
  const res = buildFindings({ neck_lean: M({ score: 20, severity: "normal" }) }, { includeNormal: true });
  eq("a low score does not manufacture severity", res.findings[0].severity, "normal");
  const res2 = buildFindings({ neck_lean: M({ score: 95, severity: "severe" }) });
  eq("and a high score does not suppress it", res2.findings[0].severity, "severe");
}

console.log("\nan unmeasured metric is not a finding about the body");
{
  const res = buildFindings({
    spine_lean:  M({ reliable: false }),
    torso_flexion: M({ reliable: false }),
    fhp_index:   M({ value: 5, unit: "cm", severity: "mild" }),
  });
  eq("unmeasured metrics are separated out", res.unmeasured.length, 2);
  eq("and never counted as findings", res.findings.length, 1);
  check("each explains what the camera needs", res.unmeasured.every(u => (u.why || "").length > 30));
  check("and is never given a score", res.unmeasured.every(u => u.technical.score === null));
  eq("only measured metrics count toward `measured`", res.measured, 1);
  // The shipped bug this pins: four permanently-unreadable metrics rendered
  // with their modules' default score of 90 and a full green bar.
  check("no unmeasured metric can render as healthy",
    res.unmeasured.every(u => u.severity === "unmeasured" && u.technical.reliable === false));
}

console.log("\n\"everything is fine\" requires having measured something");
{
  const blind = buildFindings({ neck_lean: M({ reliable: false }), fhp_index: M({ reliable: false }) });
  check("an unreadable frame is not an all-clear", blind.allClear === false && blind.nothingMeasured === true);
  const clear = buildFindings({ neck_lean: M({ severity: "normal" }), fhp_index: M({ severity: "normal" }) });
  check("but a genuinely clean reading is", clear.allClear === true && clear.nothingMeasured === false);
  check("and the summary says so in words", /in range/i.test(findingsSummary(clear, "en")), findingsSummary(clear, "en"));
  check("while an unreadable one talks about the camera",
    /camera/i.test(findingsSummary(blind, "en")), findingsSummary(blind, "en"));
}

console.log("\nranked by what it is actually costing, not by declaration order");
{
  const res = buildFindings({
    // elbow has the smallest weight in the engine; fhp the largest.
    elbow_angle: M({ score: 30, severity: "moderate" }),
    fhp_index:   M({ score: 30, severity: "moderate", unit: "cm" }),
  });
  eq("equal scores, heavier metric first", res.findings[0].id, "fhp_index");
  const res2 = buildFindings({
    fhp_index:   M({ score: 70, severity: "mild", unit: "cm" }),
    elbow_angle: M({ score: 10, severity: "severe" }),
  });
  eq("but severity outranks weight", res2.findings[0].id, "elbow_angle");
  check("severity ordering is total", SEVERITY_ORDER.severe > SEVERITY_ORDER.moderate
    && SEVERITY_ORDER.moderate > SEVERITY_ORDER.mild && SEVERITY_ORDER.mild > SEVERITY_ORDER.normal);
}

console.log("\ninternal adjustments are not findings about posture");
{
  const res = buildFindings({
    session_fatigue:  M({ severity: "severe" }),
    position_penalty: M({ severity: "severe" }),
    confidence_val:   M({ severity: "severe" }),
    neck_lean:        M({ severity: "mild" }),
  });
  eq("only the real metric surfaces", res.findings.map(f => f.id), ["neck_lean"]);
  check("the exclusion list is the product's own", ["session_fatigue","position_penalty","confidence_val"].every(k => NON_POSTURAL.has(k)));
  // Two independent guards keep these out: the NON_POSTURAL set, and the fact
  // that the copy library has no entry for them. Asserted at source, because a
  // behavioural test cannot tell which one did the work — and if a future
  // change gives one of them a copy entry, only the set stands between it and
  // being presented to a user as a posture problem.
  {
    const src = readFileSync(new URL("./findings.js", import.meta.url), "utf8");
    check("the NON_POSTURAL guard is actually applied in buildFindings",
      /if \(NON_POSTURAL\.has\(id\)\) continue;/.test(src));
  }
}

console.log("\nnothing diagnoses, in either language");
{
  const all = {};
  for (const id of ["fhp_index","neck_lean","head_tilt","shoulder_level","spine_lean","torso_flexion",
                    "trunk_rotation","rounded_shoulders","shoulder_elevation","head_yaw",
                    "screen_distance","monitor_height","elbow_angle"]) {
    all[id] = M({ severity: "severe", unit: id.includes("distance") || id.includes("fhp") || id.includes("monitor") ? "cm" : "°", direction: "below", signed: 3 });
  }
  for (const lang of ["en", "ar"]) {
    const res = buildFindings(all, { lang });
    eq(`all 13 metrics produce a finding (${lang})`, res.findings.length, 13);
    const text = res.findings.map(f => `${f.title} ${f.headline} ${f.why} ${f.action}`).join(" ");
    // "not a diagnosis" is the disclaimer, not a claim — strip the negated
    // forms before looking for diagnostic language, the same way the
    // marketing-claims test does.
    const claims = text.replace(/\b(not|never|isn'?t|no)\s+a?\s*diagnos\w*/gi, "")
                       .replace(/مش\s*تشخيص/g, "");
    check(`no diagnostic language (${lang})`,
      !/\byou have\b|\bdiagnos|\bcondition\b|\bdisease|\bsyndrome\b|عندك مرض|تشخيص/i.test(claims),
      (claims.match(/\byou have\b|\bdiagnos\w*|\bcondition\b|تشخيص/i)||[])[0]);
    check(`no fabricated citation (${lang})`, !/\bet al\b|\d{4}\)|study shows|proven to/i.test(text));
    check(`every finding is non-empty (${lang})`,
      res.findings.every(f => f.title && f.headline && f.why && f.action));
    check(`no untranslated placeholder leaked (${lang})`, !/undefined|NaN|\[object/.test(text), text.slice(0,60));
  }
}

console.log("\nthe basis of the reading is always stated");
{
  const uncal = buildFindings({ fhp_index: M({ unit: "cm", severity: "mild" }) }, { calibrated: false });
  const cal   = buildFindings({ fhp_index: M({ unit: "cm", severity: "mild" }) }, { calibrated: true });
  check("uncalibrated readings are marked as such", uncal.findings[0].technical.personalised === false);
  check("calibrated ones are marked too", cal.findings[0].technical.personalised === true);
  const perMetric = buildFindings({ fhp_index: M({ unit: "cm", severity: "mild", personalised: true }) }, { calibrated: false });
  check("a per-metric personalised flag is honoured on its own", perMetric.findings[0].technical.personalised === true);
}

console.log("\nnull and missing values never reach the copy");
{
  const res = buildFindings({ fhp_index: M({ value: null, unit: "cm", severity: "mild" }) });
  check("a null value does not print as null/NaN",
    !/null|NaN|undefined/.test(res.findings[0].headline), res.findings[0].headline);
  eq("an empty metrics object yields nothing, not a crash", buildFindings({}).findings.length, 0);
  eq("null metrics is handled", buildFindings(null).findings.length, 0);
  check("an unknown metric id is ignored rather than half-rendered",
    buildFindings({ some_future_metric: M() }).findings.length === 0);
}

console.log("\nlimits and summaries");
{
  const many = {};
  for (const id of ["fhp_index","neck_lean","head_tilt","shoulder_level","head_yaw"]) many[id] = M({ severity: "moderate" });
  eq("limit caps the list", buildFindings(many, { limit: 2 }).findings.length, 2);
  eq("but the true total is still reported", buildFindings(many, { limit: 2 }).total, 5);
  const s = findingsSummary(buildFindings(many), "en");
  check("the summary names the top finding and counts the rest", /and 4 more/.test(s), s);
}

console.log(`\n${pass} passed · ${fail} failed`);
if (fail) { failures.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
