/**
 * The report's metric plumbing.
 *
 * Two failures, both invisible from the inside: keys the engine has never
 * emitted, and metrics the engine explicitly marked unmeasurable — each
 * falling through to a `?? 100` / `?? 70` default and printing as a good
 * reading on a document a user may hand to a physiotherapist.
 *
 *   node src/lib/pdfReports.test.mjs
 */
import { _metricScore } from "./pdfReports.js";
import { ZONE_METRICS } from "./clinicalMetrics.js";
import { analyzeMP, resetProportions } from "../features/analysis/postureEngine.js";
import { renderSubject } from "../features/analysis/syntheticSubject.mjs";
import { readFileSync } from "node:fs";

let pass = 0, fail = 0; const failures = [];
const check = (name, ok, detail = "") => {
  if (ok) pass++; else { fail++; failures.push(`${name}${detail ? " — " + detail : ""}`); }
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
};

// A real engine result at the framing the product actually ships into.
resetProportions();
let live = null;
for (let i = 0; i < 170; i++) live = analyzeMP(renderSubject({}, {}, { distCm: 60 }), 1280, 720, "front");
const metrics = live.metrics;

console.log("\n══ PDF report — metric plumbing ══\n");

// 1. Every metric key the file mentions must exist in the engine's output.
{
  const src = readFileSync(new URL("./pdfReports.js", import.meta.url), "utf8");
  const engineKeys = new Set(Object.keys(metrics));
  // Zone keys come from the imported module, not from scraping this file.
  //
  // They used to be scraped with /const _ZONES = \{([\s\S]*?)\};/ against a
  // literal declared here. When _ZONES became `= ZONE_METRICS` (one shared
  // definition instead of three divergent ones) that regex stopped matching,
  // zoneKeys silently became [], and this check — the only automated defence
  // against phantom metric names in the zone map — kept printing "ok" while
  // testing nothing. Importing the actual object cannot go stale that way.
  const zoneKeys = Object.values(ZONE_METRICS).flat();
  const radarKeys = [...src.matchAll(/const met(?:Keys|K3)=\[([^\]]+)\]/g)]
    .flatMap(m => [...m[1].matchAll(/"([a-z_]+)"/g)].map(x => x[1]));
  const used = [...new Set([...zoneKeys, ...radarKeys])];
  const phantom = used.filter(k => !engineKeys.has(k));
  check("Every key the zones and radars look up exists in the engine",
        phantom.length === 0,
        phantom.length ? `no such metric: ${phantom.join(", ")}` : `${used.length} keys checked`);
}

// 2. A metric the engine could not measure has no score, rather than a good one.
{
  const unmeasured = Object.entries(metrics)
    .filter(([, v]) => v && typeof v === "object" && v.reliable === false)
    .map(([k]) => k);
  check("This framing really does leave metrics unmeasured", unmeasured.length > 0,
        unmeasured.join(", "));
  const leaked = unmeasured.filter(k => _metricScore(metrics, k) !== null);
  check("An unmeasured metric returns no score", leaked.length === 0,
        leaked.length ? `still scored: ${leaked.join(", ")}` : "");
  // and the old behaviour, for the record
  const oldWay = k => (typeof metrics[k] === "number" ? metrics[k] : (metrics[k]?.score ?? 100));
  const inflated = unmeasured.filter(k => oldWay(k) >= 85);
  check("...where the shipped code scored them 85+", inflated.length === unmeasured.length,
        `${inflated.length}/${unmeasured.length} were reported as near-perfect`);
}

// 3. A key that does not exist is not a perfect score.
check("A key the engine never emits returns no score",
      _metricScore(metrics, "hip_angle") === null &&
      _metricScore(metrics, "spine_align") === null &&
      _metricScore(metrics, "trunk_lean") === null, "");

// 4. Measured metrics still come through untouched.
check("A measured metric still returns its score",
      _metricScore(metrics, "neck_lean") === metrics.neck_lean.score &&
      Number.isFinite(_metricScore(metrics, "head_tilt")), "");

console.log(`\n${"─".repeat(58)}\n${pass} passed · ${fail} failed\n${"─".repeat(58)}`);
if (fail) { console.log("\nFailures:"); failures.forEach(f => console.log("  · " + f)); process.exit(1); }
