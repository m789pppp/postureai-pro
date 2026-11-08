/** Known-answer tests against published values and a simulated study. */
import { tInv, fInv, icc21, icc31, blandAltman, walterN } from "./stats.mjs";
import { parseCsv, loadRows, analyse, judge } from "./analyze.mjs";

let pass = 0, fail = 0;
const near = (name, got, want, tol) => { if (got != null && Math.abs(got - want) <= tol) pass++; else { fail++; console.log(`FAIL ${name}: got ${got}, want ${want}`); } };
const ok = (name, c, d = "") => { if (c) pass++; else { fail++; console.log(`FAIL ${name} ${d}`); } };

near("t(.975,10)", tInv(.975, 10), 2.228, .001);
near("t(.975,32)", tInv(.975, 32), 2.037, .001);
near("F(.975,5,15)", fInv(.975, 5, 15), 3.576, .001);
near("F(.975,1,30)", fInv(.975, 1, 30), 5.568, .001);

// Shrout and Fleiss (1979) example: ICC(2,1) = .29, 95% CI .019 to .761.
const sf = [[9,2,5,8],[6,1,3,2],[8,4,6,8],[7,1,2,6],[10,5,6,9],[6,2,4,7]];
const r = icc21(sf);
near("S&F ICC", r.icc, .29, .005);
near("S&F lower", r.lower, .019, .005);
near("S&F upper", r.upper, .76, .006);

const c31 = icc31(sf);
near("S&F ICC3", c31.icc, .71, .005);
near("S&F ICC3 lower", c31.lower, .34, .006);
near("S&F ICC3 upper", c31.upper, .95, .006);

const perfect = icc21([[1,1],[5,5],[9,9],[12,12]]);
near("perfect ICC", perfect.icc, 1, 1e-9);
ok("constant offset lowers absolute agreement", icc21([[10,15],[20,25],[30,35],[40,45]]).icc < 1);

const ba = blandAltman([12,14,16,18,20,22], [10,13,15,16,19,20]);
near("BA bias", ba.bias, 1.5, 1e-9);
near("BA sd", ba.sdDiff, 0.5477, .0002);
near("BA lower", ba.loaLower, 1.5 - 1.96 * 0.5477, .001);
near("BA upper", ba.loaUpper, 1.5 + 1.96 * 0.5477, .001);
near("BA max", ba.maxAbsError, 1.5 + 1.96 * 0.5477, .001);

near("Walter n one-sided", walterN(.75, .9, 2, 1.645, .842), 26, 0);
near("Walter n two-sided", walterN(.75, .9, 2, 1.96, .842), 33, 0);

// Parser.
const p = parseCsv('\uFEFFa,b\r\n"x,1","y""z"\r\n');
ok("csv quoted", p[0].a === "x,1" && p[0].b === 'y"z');
ok("csv semicolon", parseCsv("a;b\n1;2\n")[0].b === "2");
const bad = loadRows([{ participant_id: "P1", median: "12", reference_value: "abc", usable: "1" }]);
ok("mistyped reference reported", bad.errors.length === 1);
ok("decimal comma read", loadRows([{ participant_id: "P1", median: "12,5", reference_value: "", usable: "1" }]).rows[0].app === 12.5);

// Simulated study with known truth: app = reference + 2 degrees + noise.
function rng(seed) { return () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296; }
function gauss(u) { return Math.sqrt(-2 * Math.log(u() || 1e-9)) * Math.cos(2 * Math.PI * u()); }
function study(n, bias, noise, seed = 7) {
  const u = rng(seed), out = [];
  for (let i = 1; i <= n; i++) {
    const truth = 50 + gauss(u) * 8;
    for (const rater of ["R1", "R2"]) for (const rep of [1, 2]) out.push({
      participant: `P${i}`, view: "side", posture: "habitual", rater, capturedAt: `2026-01-01T${rater === "R1" ? 10 : 11}:0${rep}`,
      trial: rep, metric: "cva_proxy_deg", unit: "deg", method: "m", version: "v", usable: true,
      app: truth + bias + gauss(u) * noise, reference: truth + gauss(u) * .5,
    });
  }
  return out;
}
const crit = { icc_lower_min: .75, min_participants: 33, primary_posture: "habitual", loa_max: { cva_proxy_deg: 5 } };
const good = analyse(study(400, 1, 1), crit);
const v = good.results.find(x => x.analysis === "criterion_validity");
near("sim recovers bias", v.bias, 1, .12);
ok("sim passes", good.verdicts[0].verdict === "PASS", JSON.stringify(good.verdicts[0]));
ok("reliability rows present", good.results.some(x => x.analysis === "inter_rater") && good.results.some(x => x.analysis === "test_retest_R1"));
ok("one point per participant", good.points.length === 400);
ok("large noise fails", analyse(study(400, 1, 5), crit).verdicts[0].verdict === "FAIL");
ok("large bias fails", analyse(study(400, 8, 1), crit).verdicts[0].verdict === "FAIL");
ok("small sample never passes", analyse(study(20, 1, 1), crit).verdicts[0].verdict === "INSUFFICIENT_N");
ok("missing limit never passes", analyse(study(400, 1, 1), { ...crit, loa_max: { cva_proxy_deg: null } }).verdicts[0].verdict === "NOT_SET");
ok("no data never passes", judge("cva_proxy_deg", null, null, crit).verdict === "NO_DATA");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
