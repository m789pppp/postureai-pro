/**
 * Marketing claims must match what the code actually does.
 *
 * This exists because the product shipped, on its pricing page, two paid
 * features it does not have. "FaceMesh 478 landmarks" and "3D solvePnP head
 * pose" were listed as Professional-tier capabilities across six files —
 * while postureEngine.js's own header says, in as many words, that the engine
 * "has no FaceMesh/solvePnP access". The app loads MediaPipe's
 * `pose_landmarker_full`, which returns 33 body landmarks; 478 is the FaceMesh
 * count. Alongside them sat a "~96% accuracy rate" that had never been
 * measured against anything, and a "< 40ms latency" for a loop explicitly
 * throttled to a 20fps (50ms) ceiling.
 *
 * Nobody wrote those in bad faith — they accumulate. A spec table gets a
 * plausible number early on, the engine is rewritten around it, and the two
 * drift apart silently because nothing connects them. This test is the
 * connection: every claim below is checked against the code that would have
 * to implement it, so the next one cannot be added without the check failing.
 *
 *   node src/lib/claims.test.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = readFileSync(join(SRC, "features/analysis/postureEngine.js"), "utf8");
const APP    = readFileSync(join(SRC, "App.jsx"), "utf8");

/** Every .jsx a signed-out visitor or a paying user can actually read. */
function userFacingFiles(dir = SRC, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "features") userFacingFiles(p, out); }
    else if (e.name.endsWith(".jsx")) out.push(p);
  }
  return out;
}
const FILES = userFacingFiles();

/** Strip comments: a claim explained in a comment is documentation, not a claim. */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const PAGES = FILES.map(f => ({ file: f.replace(SRC + "/", ""), text: stripComments(readFileSync(f, "utf8")) }));

let pass = 0, fail = 0; const failures = [];
const check = (name, ok, detail = "") => {
  if (ok) pass++; else { fail++; failures.push(name + (detail ? " — " + detail : "")); }
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
};
/** Nothing a user reads may contain `needle` unless the code backs it. */
const noClaim = (needle, why) => {
  // Word-boundary, not substring: the hex colour #047857 contains "478".
  const re = new RegExp(`(?<![\\w#])${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w])`);
  const hits = PAGES.filter(p => re.test(p.text)).map(p => p.file);
  check(`no user-facing claim of "${needle}"`, hits.length === 0, hits.length ? `${why} — found in ${hits.join(", ")}` : why);
};

console.log("\nwhat the engine actually is");
check("the app loads MediaPipe Pose, not FaceMesh",
  /pose_landmarker/.test(APP) && !/face_landmarker|FaceLandmarker/.test(APP),
  "pose_landmarker_full → 33 body landmarks");
check("the engine states it has no FaceMesh or solvePnP",
  /no FaceMesh\/solvePnP access/.test(ENGINE));
check("no solvePnP is implemented anywhere in the engine",
  !/cv\.solvePnP|solvePnP\s*\(/.test(ENGINE));

console.log("\nclaims the code cannot back");
noClaim("478", "478 is the FaceMesh landmark count; this product tracks 33 with MediaPipe Pose");
noClaim("FaceMesh", "no FaceMesh model is loaded anywhere");
noClaim("solvePnP", "no solvePnP implementation exists");
noClaim("~96%", "an accuracy figure that was never measured against a reference");
noClaim("< 40ms", "the analysis loop is throttled to a 20fps (50ms) ceiling");

console.log("\nno unbacked accuracy percentage anywhere");
{
  // Any "NN% accurate/accuracy" in user-facing copy. There is a real
  // validation protocol now (lib/qaAccuracy.js), but it deliberately publishes
  // a figure WITH its confidence interval and only from banked trials — it
  // does not license a hardcoded percentage in marketing copy.
  const re = /(\d{1,3}\s?%[^.\n]{0,24}accur|accura[a-z]*[^.\n]{0,24}\d{1,3}\s?%)/gi;
  const hits = [];
  for (const p of PAGES) for (const m of p.text.matchAll(re)) hits.push(`${p.file}: "${m[0].trim()}"`);
  check("no hardcoded accuracy percentage in user-facing copy", hits.length === 0, hits.slice(0, 4).join(" | "));
}

console.log("\nthe numbers that ARE claimed match the code");
{
  // Brace-matched, not a fixed-size slice. A slice that happens to cut the
  // object short can make the count come out right by accident — which is
  // exactly what a fixed 2400-character window did here, reporting 13 of 14
  // when the object actually holds 16.
  const metricBlock = (() => {
    const start = ENGINE.indexOf("metrics: {") + "metrics: ".length;
    let depth = 0;
    for (let i = start; i < ENGINE.length; i++) {
      if (ENGINE[i] === "{") depth++;
      else if (ENGINE[i] === "}" && --depth === 0) return ENGINE.slice(start, i + 1);
    }
    throw new Error("could not find the end of the metrics object");
  })();
  // The engine emits 16 entries, three of which are internal diagnostics
  // rather than findings about posture — the same three that
  // NON_POSTURAL_METRICS excludes everywhere else in the product. The claim
  // is about postural metrics, so the count must be too.
  const NON_POSTURAL = ["session_fatigue", "position_penalty", "confidence_val"];
  const keys = [...metricBlock.matchAll(/^\s{6}(\w+):\s*\{/gm)].map(m => m[1]);
  const metricCount = keys.filter(k => !NON_POSTURAL.includes(k)).length;
  check("the three non-postural entries are the ones the product already excludes",
    NON_POSTURAL.every(k => keys.includes(k)) && /NON_POSTURAL_METRICS/.test(readFileSync(join(SRC, "lib/clinicalMetrics.js"), "utf8")));
  check("the engine measures exactly 13 postural metrics", metricCount === 13,
    `counted ${metricCount} of ${keys.length} emitted`);
  const claims13 = PAGES.filter(p => /\b13\b[^\n]{0,40}(posture )?metric/i.test(p.text)).map(p => p.file);
  check("pages claiming 13 metrics are telling the truth", metricCount === 13 && claims13.length > 0,
    `claimed in ${claims13.length} file(s)`);

  check("the analysis loop really is capped near 20fps",
    /_nowTs - lastAnalysisTsRef\.current < 50/.test(APP), "50ms throttle = 20fps ceiling");
  const fpsClaims = [];
  for (const p of PAGES) for (const m of p.text.matchAll(/(\d{2,3})\s?fps/gi)) {
    if (Number(m[1]) > 20) fpsClaims.push(`${p.file}: ${m[0]}`);
  }
  check("no page claims a frame rate above the engine's ceiling", fpsClaims.length === 0, fpsClaims.join(" | "));
}

console.log("\nno medical claim");
{
  // A wellness tool, not a medical device. "Diagnose" is the word that changes
  // the regulatory category.
  const hits = [];
  for (const p of PAGES) for (const m of p.text.matchAll(/\b(diagnos[ei]s|diagnose|medical device|clinically proven|FDA[- ]approved)\b/gi)) {
    // "not a diagnosis" / "does not diagnose" are the disclaimers, not claims.
    const around = p.text.slice(Math.max(0, m.index - 40), m.index + 40).toLowerCase();
    if (!/\b(not|never|isn'?t|doesn'?t|non-|no)\b/.test(around)) hits.push(`${p.file}: "${m[0]}"`);
  }
  check("nothing claims to diagnose or to be a medical device", hits.length === 0, hits.slice(0, 4).join(" | "));
}

console.log(`\n${pass} passed · ${fail} failed`);
if (fail) { failures.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
