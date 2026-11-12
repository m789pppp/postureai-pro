#!/usr/bin/env node
/**
 * Analyse a filled-in Posmoz validation export.
 *
 *   node validation/analyze.mjs data.csv [--out dir] [--criteria file.json]
 *                               [--participants p.csv --by hijab]
 *
 * Input is the CSV from the study capture panel with reference_value filled in.
 * Output: summary.md, results.csv, bland_altman_points.csv.
 *
 * A value that cannot be read as a number is listed and stops the run, because
 * silently dropping a mistyped reference would change the result.
 */
import fs from "node:fs";
import path from "node:path";
import { icc21, icc31, blandAltman, mean } from "./stats.mjs";

export function parseCsv(text) {
  const clean = text.replace(/^\uFEFF/, "");
  const delim = clean.split(/\r?\n/, 1)[0].split(";").length > clean.split(/\r?\n/, 1)[0].split(",").length ? ";" : ",";
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (q) {
      if (c === '"' && clean[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some(v => v !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); if (row.some(v => v !== "")) rows.push(row); }
  const [header, ...body] = rows;
  return body.map(r => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

const stripFormulaGuard = s => (/^'[=+\-@]/.test(s) ? s.slice(1) : s);

function toNumber(raw, label, errors) {
  if (raw === "" || raw == null) return null;
  const v = Number(String(raw).replace(",", "."));
  if (!Number.isFinite(v)) { errors.push(`${label}: "${raw}"`); return null; }
  return v;
}

export function loadRows(records) {
  const errors = [];
  const rows = records.map((r, i) => {
    const line = i + 2;
    return {
      participant: stripFormulaGuard(r.participant_id), view: r.view, posture: r.posture, rater: r.rater,
      capturedAt: r.captured_at, trial: Number(r.trial), metric: r.metric, unit: r.unit, method: r.method,
      version: r.measure_version, pipeline: r.pipeline || "", usable: r.usable === "1",
      app: toNumber(r.median, `line ${line} median`, errors),
      reference: toNumber(r.reference_value, `line ${line} reference_value`, errors),
    };
  });
  return { rows, errors };
}

const groupBy = (xs, f) => xs.reduce((m, x) => { const k = f(x); (m[k] ||= []).push(x); return m; }, {});
const inOrder = xs => [...xs].sort((a, b) => String(a.capturedAt).localeCompare(String(b.capturedAt)) || a.trial - b.trial);

/** Participants x repeats matrix from the first two repeats of each participant. */
function repeatMatrix(rows, field) {
  const out = [];
  for (const rs of Object.values(groupBy(rows, r => r.participant))) {
    const vals = inOrder(rs).map(r => r[field]).filter(v => v != null);
    if (vals.length >= 2) out.push(vals.slice(0, 2));
  }
  return out;
}

/** Participants x raters matrix of each rater's mean, complete cases only. */
function raterMatrix(rows, field, raters) {
  const out = [];
  for (const rs of Object.values(groupBy(rows, r => r.participant))) {
    const line = raters.map(rater => {
      const v = rs.filter(r => r.rater === rater && r[field] != null).map(r => r[field]);
      return v.length ? mean(v) : null;
    });
    if (line.every(v => v != null)) out.push(line);
  }
  return out;
}

const iccRow = (base, analysis, instrument, m) => (m && m.length >= 3 ? { ...base, analysis, instrument, ...icc21(m) } : null);

export function analyse(rows, criteria) {
  const results = [], points = [], verdicts = [];
  const groups = groupBy(rows, r => [r.view, r.posture, r.metric].join("|"));
  for (const [key, all] of Object.entries(groups)) {
    const [view, posture, metric] = key.split("|");
    const base = { view, posture, metric, unit: all[0].unit };
    const usable = all.filter(r => r.usable && r.app != null);
    const usableRate = usable.length / all.length;

    // Criterion validity: one independent pair per participant.
    const pairs = Object.entries(groupBy(usable.filter(r => r.reference != null), r => r.participant))
      .map(([participant, rs]) => ({ participant, app: mean(rs.map(r => r.app)), reference: mean(rs.map(r => r.reference)) }));
    let validity = null, ba = null;
    if (pairs.length >= 3) {
      const matrix = pairs.map(p => [p.app, p.reference]);
      const c = icc31(matrix);
      validity = icc21(matrix);
      if (validity && c) validity = { ...validity, iccC: c.icc, iccCLower: c.lower, iccCUpper: c.upper };
      ba = blandAltman(pairs.map(p => p.app), pairs.map(p => p.reference));
      if (validity && ba) {
        results.push({ ...base, analysis: "criterion_validity", instrument: "app_vs_reference", ...validity, ...ba, points: undefined, usableRate });
        pairs.forEach((p, i) => points.push({ view, posture, metric, participant: p.participant, app: p.app, reference: p.reference, mean: ba.points[i].mean, diff: ba.points[i].diff }));
      }
    }
    const raters = [...new Set(all.map(r => r.rater))].filter(Boolean).sort();
    for (const rater of raters) {
      const rs = usable.filter(r => r.rater === rater);
      for (const [field, instrument] of [["app", "app"], ["reference", "reference"]]) {
        const row = iccRow(base, `test_retest_${rater}`, instrument, repeatMatrix(rs, field));
        if (row) results.push(row);
      }
    }
    if (raters.length >= 2) for (const [field, instrument] of [["app", "app"], ["reference", "reference"]]) {
      const row = iccRow(base, "inter_rater", instrument, raterMatrix(usable, field, raters));
      if (row) results.push(row);
    }
    if (posture === criteria.primary_posture && metric in (criteria.loa_max || {})) {
      verdicts.push({ ...base, ...judge(metric, validity, ba, criteria), usableRate });
    }
  }
  return { results, points, verdicts };
}

/** Applies only the pre-specified criteria. Missing evidence never counts as a pass. */
export function judge(metric, validity, ba, criteria) {
  const limit = criteria.loa_max?.[metric] ?? null;
  const n = ba?.n ?? 0;
  const facts = { n, limit, icc: validity?.iccC ?? null, iccLower: validity?.iccCLower ?? null, maxAbsError: ba?.maxAbsError ?? null };
  if (limit == null) return { verdict: "NOT_SET", why: "no acceptance limit set by the PI", ...facts };
  if (!validity || !ba) return { verdict: "NO_DATA", why: "no paired readings", ...facts };
  if (n < criteria.min_participants) return { verdict: "INSUFFICIENT_N", why: `${n} of ${criteria.min_participants} participants`, ...facts };
  const fails = [];
  if (!(validity.iccCLower >= criteria.icc_lower_min)) fails.push(`ICC(3,1) lower bound ${validity.iccCLower.toFixed(3)} below ${criteria.icc_lower_min}`);
  if (!(ba.maxAbsError <= limit)) fails.push(`limits of agreement reach ${ba.maxAbsError.toFixed(2)}, above ${limit}`);
  return fails.length ? { verdict: "FAIL", why: fails.join("; "), ...facts } : { verdict: "PASS", why: "met all pre-specified criteria", ...facts };
}

const f = (v, d = 3) => (v == null || !Number.isFinite(v) ? "" : v.toFixed(d));
const RESULT_COLS = ["view","posture","metric","unit","analysis","instrument","n","k","icc","lower","upper","iccC","iccCLower","iccCUpper","sem","mdc95","bias","biasLower","biasUpper","sdDiff","loaLower","loaUpper","loaLowerCiLow","loaLowerCiHigh","loaUpperCiLow","loaUpperCiHigh","maxAbsError","mae","slope","slopeP","usableRate"];

function resultsCsv(results) {
  return [RESULT_COLS.join(","), ...results.map(r => RESULT_COLS.map(c => (typeof r[c] === "number" ? f(r[c], 4) : (r[c] ?? ""))).join(","))].join("\n") + "\n";
}

function summaryMd({ verdicts, results }, meta) {
  const L = [`# Posmoz validation results`, ``, `Input: ${meta.input}`, `Measure version: ${meta.versions.join(", ")}`,
    meta.versions.length > 1 ? `\n**WARNING: this dataset mixes measurement versions and should not be pooled.**\n` : ``,
    `Pipeline: ${meta.pipelines?.length ? meta.pipelines.join(", ") : "not recorded"}`,
    (meta.pipelines?.length || 0) > 1 || meta.pipelines?.some(p => p.startsWith("mixed(")) ? `\n**WARNING: this dataset mixes pipelines (different models or delegates ran) and should not be pooled.**\n` : ``,
    `Criteria: ICC(3,1) lower 95% bound >= ${meta.criteria.icc_lower_min}, n >= ${meta.criteria.min_participants}, posture "${meta.criteria.primary_posture}".`, ``,
    `## Verdicts (pre-specified criteria)`, ``,
    `| View | Metric | Verdict | n | ICC(3,1) | Lower bound | Max abs LoA | Limit | Usable | Reason |`, `|---|---|---|---|---|---|---|---|---|---|`];
  for (const v of verdicts) L.push(`| ${v.view} | ${v.metric} | **${v.verdict}** | ${v.n} | ${f(v.icc)} | ${f(v.iccLower)} | ${f(v.maxAbsError, 2)} | ${v.limit ?? ""} | ${(v.usableRate * 100).toFixed(0)}% | ${v.why} |`);
  L.push(``, `## Reliability`, ``, `| View | Posture | Metric | Analysis | Instrument | n | ICC (95% CI) | SEM | MDC95 |`, `|---|---|---|---|---|---|---|---|---|`);
  for (const r of results.filter(x => x.analysis !== "criterion_validity")) L.push(`| ${r.view} | ${r.posture} | ${r.metric} | ${r.analysis} | ${r.instrument} | ${r.n} | ${f(r.icc)} (${f(r.lower)} to ${f(r.upper)}) | ${f(r.sem, 2)} | ${f(r.mdc95, 2)} |`);
  L.push(``, `A verdict applies only to the view, posture, population and software version tested. Have the statistician confirm these results before reporting them.`, ``);
  return L.join("\n");
}

function main(argv) {
  const opt = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
  const input = argv[0];
  if (!input || input.startsWith("--")) { console.error("Usage: node validation/analyze.mjs data.csv [--out dir] [--criteria file.json] [--participants p.csv --by column]"); process.exit(2); }
  const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
  const criteria = JSON.parse(fs.readFileSync(opt("--criteria") || path.join(here, "criteria.json"), "utf8"));
  const outDir = opt("--out") || "validation-output";
  const { rows, errors } = loadRows(parseCsv(fs.readFileSync(input, "utf8")));
  if (errors.length) { console.error("Unreadable numbers, fix these first:\n  " + errors.join("\n  ")); process.exit(1); }
  fs.mkdirSync(outDir, { recursive: true });

  const versions = [...new Set(rows.map(r => r.version))].filter(Boolean);
  const pipelines = [...new Set(rows.map(r => r.pipeline))].filter(Boolean);
  const write = (subset, suffix) => {
    const out = analyse(subset, criteria);
    fs.writeFileSync(path.join(outDir, `results${suffix}.csv`), resultsCsv(out.results));
    fs.writeFileSync(path.join(outDir, `bland_altman_points${suffix}.csv`),
      "view,posture,metric,participant,app,reference,mean,diff\n" + out.points.map(p => [p.view, p.posture, p.metric, p.participant, f(p.app, 2), f(p.reference, 2), f(p.mean, 2), f(p.diff, 2)].join(",")).join("\n") + "\n");
    fs.writeFileSync(path.join(outDir, `summary${suffix}.md`), summaryMd(out, { input: path.basename(input) + (suffix ? ` (${suffix.slice(1)})` : ""), criteria, versions, pipelines }));
    return out;
  };
  const all = write(rows, "");
  const by = opt("--by"), pFile = opt("--participants");
  if (by && pFile) {
    const map = Object.fromEntries(parseCsv(fs.readFileSync(pFile, "utf8")).map(p => [p.participant_id, p[by]]));
    const missing = [...new Set(rows.map(r => r.participant))].filter(p => !(p in map));
    if (missing.length) { console.error("Missing from participants file: " + missing.join(", ")); process.exit(1); }
    for (const [level, sub] of Object.entries(groupBy(rows, r => map[r.participant]))) write(sub, `_${by}_${String(level).replace(/[^\w-]/g, "_")}`);
  }
  for (const v of all.verdicts) console.log(`${v.view.padEnd(6)} ${v.metric.padEnd(24)} ${v.verdict.padEnd(15)} ${v.why}`);
  console.log(`\nWrote results to ${outDir}`);
}

if (process.argv[1] && path.basename(process.argv[1]) === "analyze.mjs") main(process.argv.slice(2));
