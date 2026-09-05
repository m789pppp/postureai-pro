/**
 * clinicalMetrics — the module the AI screens derive their clinical figures
 * from.
 *
 * These assert the properties that the old inline derivations violated, because
 * every one of them shipped and reached users:
 *
 *   - a figure named after a metric is computed from THAT metric, and moves
 *     independently of avg_score
 *   - "not measured" is null all the way out, never 0 and never a reassuring
 *     default
 *   - unreliable readings are excluded rather than averaged in
 *   - a zone cannot be silently floored by metric names the engine never emits
 *   - a week with no sessions is not a score of zero
 *   - a truncated 50-row query is not reported as a lifetime total
 *
 *   node src/lib/clinicalMetrics.test.mjs
 */
import {
  mean, metricScore, metricValue, zoneRisk, cervicalLoadKg, neckFlexionDeg, decimate,
  sessionFatigue, weekWindows, lifetimeSessions, readingReliability,
  fmtMeasure, NON_POSTURAL_METRICS, sessionTimeMs, bySessionTimeDesc, sessionTrend,
} from "./clinicalMetrics.js";

let pass = 0, fail = 0;
const failures = [];
const check = (name, ok, detail = "") => {
  if (ok) pass++; else { fail++; failures.push(`${name}${detail ? " — " + detail : ""}`); }
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
};
const eq = (name, got, want) =>
  check(name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

const DAY = 864e5;
const NOW = Date.UTC(2026, 0, 15);
const sess = (o = {}) => ({ avg_score: 70, created_at: new Date(NOW - DAY), metrics: {}, ...o });
const m = (score, extra = {}) => ({ score, reliable: true, ...extra });

console.log("\nmean / null discipline");
eq("mean of empty is null, not 0", mean([]), null);
eq("mean ignores non-finite", mean([10, null, 20, undefined, NaN]), 15);
eq("a real zero still averages", mean([0, 10]), 5);

console.log("\nmetricScore reads the named metric only");
{
  const s = [sess({ avg_score: 20, metrics: { neck_lean: m(90), spine_lean: m(10) } })];
  eq("neck score comes from neck_lean", metricScore(s, "neck_lean"), 90);
  // The defect this replaces: neck_risk was 100-avg_score+20, so a user with an
  // excellent neck and a terrible overall score was reported as high neck risk.
  check("neck score is independent of avg_score", metricScore(s, "neck_lean") === 90 && s[0].avg_score === 20);
  eq("a metric with no reading is null", metricScore(s, "head_tilt"), null);
}

console.log("\nunreliable readings are excluded, not averaged");
{
  const s = [
    sess({ metrics: { fhp_index: m(90, { reliable: false }) } }),
    sess({ metrics: { fhp_index: m(40) } }),
  ];
  eq("only the reliable reading counts", metricScore(s, "fhp_index"), 40);
  eq("all-unreliable is null", metricScore([s[0]], "fhp_index"), null);
  // reliable is absent on metrics that are always trustworthy
  eq("absent reliable flag is kept", metricScore([sess({ metrics: { screen_distance: { score: 55 } } })], "screen_distance"), 55);
}

console.log("\nzoneRisk cannot be floored by metric names the engine never emits");
{
  // The shipped shared-report bug: 3 of 4 thoracic keys were phantom and each
  // missing one defaulted to a perfect 100, so a severe finding rendered "4% Low".
  const severe = [sess({ metrics: { rounded_shoulders: m(15), spine_lean: m(85) } })];
  const real = zoneRisk(severe, ["rounded_shoulders", "spine_lean"]);
  eq("risk reflects the severe metric", real, { risk: 50, from: 2, of: 2 });

  const withPhantoms = zoneRisk(severe, ["rounded_shoulders", "spine_lean", "shoulder", "trunk_lean"]);
  check("phantom keys do not dilute the result",
    withPhantoms.risk === 50, `got ${withPhantoms.risk}`);
  eq("and the caller is told how many were read", [withPhantoms.from, withPhantoms.of], [2, 4]);
  eq("no readings at all is null, not a green zero", zoneRisk([sess()], ["neck_lean"]), null);

  // Under the old default-to-100 behaviour this same input produced 4.
  const oldWay = Math.round(100 - (100 + 100 + 15 + 85) / 4);
  check("pins the old flooring as the regression", oldWay === 25 && real.risk === 50, `old=${oldWay} new=${real.risk}`);
}

console.log("\ncervical load and flexion come from the engine's measurement");
{
  const s = [
    sess({ avg_score: 95, metrics: { fhp_index: m(30, { extra_load_kg: 18.2, neck_angle_deg: 41 }) } }),
    sess({ avg_score: 95, metrics: { fhp_index: m(30, { extra_load_kg: 17.8, neck_angle_deg: 39 }) } }),
  ];
  eq("load is the mean measured extra_load_kg", cervicalLoadKg(s), 18);
  eq("flexion is the mean measured angle", neckFlexionDeg(s), 40);
  // The four hardcoded tables keyed load off avg_score, so this user (95/100)
  // would have been reported at "4-6 kg" while actually measuring ~18.
  check("measurement disagrees with the old score bucket", cervicalLoadKg(s) > 15 && s[0].avg_score >= 85);
  eq("unmeasured load is null", cervicalLoadKg([sess()]), null);
  eq("unmeasured flexion is null", neckFlexionDeg([sess()]), null);
  eq("load ignores unreliable fhp", cervicalLoadKg([sess({ metrics: { fhp_index: m(30, { extra_load_kg: 99, reliable: false }) } })]), null);
}

console.log("\nfatigue is within-session decline, or nothing");
{
  const declining = sess({ score_curve: [80, 80, 80, 70, 70, 70, 60, 60, 60] });
  eq("measures the drop across the session", sessionFatigue([declining]), { declinePoints: 20, from: 1 });

  const steady = sess({ avg_score: 30, score_curve: [30, 30, 30, 30, 30, 30, 30, 30, 30] });
  eq("a bad but steady session is zero decline", sessionFatigue([steady]), { declinePoints: 0, from: 1 });
  // The old formula was (100 - week_avg)*0.6 + …, so this steady 30/100 session
  // reported 52% "fatigue" purely because the score was low.
  check("low score alone no longer produces fatigue", sessionFatigue([steady]).declinePoints === 0);

  const improving = sess({ score_curve: [60, 60, 60, 70, 70, 70, 85, 85, 85] });
  check("improving within a session is negative decline", sessionFatigue([improving]).declinePoints < 0);

  eq("too few samples to split into thirds is skipped", sessionFatigue([sess({ score_curve: [90, 40] })]), null);
  eq("no history at all is null, not a reassuring 0%", sessionFatigue([sess()]), null);
  // The old formula could never read below 10 even for a flawless week.
  eq("a perfect session reports no fatigue rather than 10%",
    sessionFatigue([sess({ score_curve: Array(12).fill(100) })]), { declinePoints: 0, from: 1 });
}

console.log("\ndecimate keeps the whole span, not the tail");
{
  const long = Array.from({length: 900}, (_, i) => 90 - Math.floor(i / 10)); // 90 down to 1
  const d = decimate(long, 30);
  eq("keeps the requested count", d.length, 30);
  eq("first sample is the session's start", d[0], long[0]);
  eq("last sample is the session's end", d[d.length-1], long[long.length-1]);
  // The shipped behaviour was `hist.slice(-60)` then `.slice(-30)` — the last
  // 30 samples, i.e. the final minute of a 30-minute session.
  const tail = long.slice(-30);
  check("a tail slice would have missed the whole decline",
    (tail[0] - tail[tail.length-1]) < 5 && (d[0] - d[d.length-1]) > 80,
    `tail span ${tail[0]-tail[tail.length-1]}, curve span ${d[0]-d[d.length-1]}`);
  eq("short series passes through", decimate([1,2,3], 30), [1,2,3]);
  eq("empty is empty", decimate(null, 30), []);
}

console.log("\nfatigue reads score_curve, never the tail-sliced history");
eq("a tail-only session reports nothing",
  sessionFatigue([{ score_history: [80,80,80,70,70,70,60,60,60], metrics: {} }]), null);

console.log("\nweek windows: absence is not a score of zero");
{
  const s = [
    sess({ avg_score: 60, created_at: new Date(NOW - 2 * DAY) }),
    sess({ avg_score: 80, created_at: new Date(NOW - 9 * DAY) }),
  ];
  const w = weekWindows(s, NOW);
  eq("this week averaged", [w.thisWeek.n, w.thisWeek.avg], [1, 60]);
  eq("last week averaged", [w.lastWeek.n, w.lastWeek.avg], [1, 80]);
  eq("trend computed from both", w.trendPct, -25);

  const offWeek = weekWindows([s[1]], NOW);
  eq("a week off is null, not 0/100", offWeek.thisWeek.avg, null);
  eq("and yields no trend, not -100%", offWeek.trendPct, null);
  // Both of those were shipped: 0 went into the prompt as a literal score and
  // produced "-100%" in alarm red plus the report's decline language.
  const oldTrend = Math.round(((0 - 80) / 80) * 100);
  check("pins the old -100% as the regression", oldTrend === -100 && offWeek.trendPct === null);

  const noPrior = weekWindows([s[0]], NOW);
  eq("no prior week means no comparison, not 'stable'", noPrior.trendPct, null);
}

console.log("\nlifetime totals vs the 50-row query cap");
{
  eq("profile count wins", lifetimeSessions({ sessions_count: 312 }, Array(50).fill(sess())), { count: 312, exact: true });
  eq("a saturated array is flagged inexact", lifetimeSessions({}, Array(50).fill(sess())), { count: 50, exact: false });
  eq("a short array is exact", lifetimeSessions({}, [sess(), sess()]), { count: 2, exact: true });
  eq("zero sessions is exact", lifetimeSessions(null, []), { count: 0, exact: true });
}

console.log("\nreliability replaces the invented ±15%");
{
  const s = [sess({ metrics: { a: m(10), b: m(10, { reliable: false }), c: { score: 5 } } })];
  eq("counts only metrics carrying the flag", readingReliability(s), { pct: 50, of: 2 });
  eq("no flagged metrics is null", readingReliability([sess()]), null);
}

console.log("\nformatting keeps null visible");
eq("null renders as not measured", fmtMeasure(null, "kg"), "not measured");
eq("null renders in Arabic too", fmtMeasure(null, "kg", true), "غير متاح (لم يُقَس)");
eq("a value keeps its unit", fmtMeasure(18, " kg"), "18 kg");
eq("a real zero still prints", fmtMeasure(0, "°"), "0°");

console.log("\ninternal adjustments are not postural findings");
check("position_penalty excluded", NON_POSTURAL_METRICS.has("position_penalty"));
check("session_fatigue excluded", NON_POSTURAL_METRICS.has("session_fatigue"));
check("confidence_val excluded", NON_POSTURAL_METRICS.has("confidence_val"));
check("a real metric is not excluded", !NON_POSTURAL_METRICS.has("neck_lean"));


console.log("\na pending server timestamp must not bury the session that just ended");
{
  // Firestore's serverTimestamp() is NULL in the local cache until the server
  // acknowledges the write. Every sort read created_at and fell back to 0, so
  // the session the user had just finished sat at the BOTTOM of their own
  // history for the length of the round trip — which reads as "it didn't save".
  const acked   = { avg_score: 70, created_at: { seconds: 1_700_000_000 }, created_at_ms: 1_699_999_000_000 };
  const pending = { avg_score: 80, created_at: null, created_at_ms: 1_800_000_000_000 };
  eq("an acknowledged session uses the server time", sessionTimeMs(acked), 1_700_000_000_000);
  eq("a pending one falls back to the client clock", sessionTimeMs(pending), 1_800_000_000_000);
  const sorted = [acked, pending].sort(bySessionTimeDesc);
  eq("so the newest session sorts first", sorted[0].avg_score, 80);
  // Under the old `?? 0` fallback this same input put the new session last.
  const oldWay = [acked, pending].sort((a,b)=>((b.created_at?.seconds*1000)||0)-((a.created_at?.seconds*1000)||0));
  check("pins the old ordering as the regression", oldWay[0].avg_score === 70 && sorted[0].avg_score === 80);
  eq("a session with neither is last, not NaN", sessionTimeMs({}), 0);
  eq("a Firestore Timestamp object works", sessionTimeMs({ created_at: { toDate: () => new Date(5000) } }), 5000);
}

console.log("\nthe 'better than your first sessions' trend");
{
  const S = (avg_score) => ({ avg_score });
  // newest-first, as userSessions is
  const improving = [S(85), S(84), S(83), S(60), S(58), S(57)];
  eq("a real improvement is reported", sessionTrend(improving)?.diff, 26);
  check("and flagged as improving", sessionTrend(improving)?.improving === true);

  // The shipped bug: `(s.avg_score||0)` counted a session that failed to
  // record a score as a session SCORED ZERO. Those are almost always the
  // earliest ones, so the oldest window averaged near nothing and a first-week
  // user was congratulated on an improvement of fifty-odd points.
  // Scores chosen so the fabricated jump is UNDER the implausible-swing
  // ceiling: only the exclusion itself can catch this one, so the assertion
  // cannot be satisfied by a different guard further down.
  const withUnscored = [S(55), S(55), S(55), S(0), S(undefined), S(null)];
  const oldRecent = Math.round((55 + 55 + 55) / 3);
  const oldFirst  = Math.round([0, undefined, null].reduce((a, v) => a + (v || 0), 0) / 3);
  check("the old formula fabricated a +55 improvement here",
    oldRecent - oldFirst === 55 && 55 < 60, "and 55 is inside the plausible range, so nothing else would have stopped it");
  eq("unscored sessions are excluded, so there is no comparison to make", sessionTrend(withUnscored), null);

  // …and with enough genuinely-scored sessions alongside them, the unscored
  // ones must not drag the baseline down either.
  const mixed = [S(70), S(70), S(70), S(64), S(64), S(64), S(0), S(null)];
  eq("a real comparison ignores them rather than averaging them in", sessionTrend(mixed)?.diff, 6);

  eq("four sessions is not enough — the windows would overlap", sessionTrend([S(80),S(80),S(80),S(50)]), null);
  {
    // slice(0,3) is [0,1,2] and slice(-3) is [1,2,3]: two of three shared.
    const four = [S(90), S(70), S(70), S(50)];
    const overlapFirst = four.slice(-3), overlapRecent = four.slice(0,3);
    check("pins the overlap as the reason",
      overlapFirst.filter(x => overlapRecent.includes(x)).length === 2);
  }

  eq("a flat run reports nothing rather than noise", sessionTrend([S(80),S(80),S(81),S(80),S(79),S(80)]), null);
  eq("an implausible swing is treated as a data problem",
     sessionTrend([S(95),S(95),S(95),S(5),S(5),S(5)]), null);
  eq("a decline is reported too", sessionTrend([S(55),S(55),S(55),S(85),S(85),S(85)])?.improving, false);
  eq("no sessions at all is null", sessionTrend([]), null);
  eq("null input is null", sessionTrend(null), null);
}

console.log(`\n${pass} passed · ${fail} failed`);
if (fail) { failures.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
