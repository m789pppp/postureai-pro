/**
 * clinicalMetrics.js — the one place that turns stored session data into the
 * figures the AI surfaces (Coach, Insights, Reports, Predictive) are allowed to
 * show or send to a model.
 *
 * WHY THIS FILE EXISTS
 *
 * Those four screens each grew their own copy of the same derivations, and each
 * copy drifted into inventing numbers. The pattern was always the same shape:
 * take avg_score, apply an invented coefficient, attach a clinical label and
 * often a real academic citation, and render the result as a measurement.
 *
 *   neck_risk   = 100 - avg_score + (avg_score < 60 ? 20 : 0)     "71% neck"
 *   fatigue     = (100 - week_avg) * 0.6 + (sessions < 5 ? 30 : 10)
 *   burnout     = fatigue * 0.8 + (week_sessions > 5 ? 15 : 0)
 *   cervAngle   = avg_score < 55 ? "35-50" : ...                   "(Hansraj 2014)"
 *   cervLoad    = avg_score < 55 ? "18-27 kg" : ...
 *
 * Unrolled, burnout was 0.48 x (100 - week_avg): the posture score, printed a
 * third time under a third name. The four "independent" risk figures in the
 * clinical profile could never disagree with each other, because they were one
 * number. And the cervical angle keyed off a composite of thirteen metrics
 * including elbow angle and monitor height, so a user with a perfect neck and a
 * bad desk setup was told their neck was flexed 35-50 degrees.
 *
 * THE RULES THIS MODULE ENFORCES
 *
 * 1. A figure is computed from the metric it is named after, or it is null.
 * 2. null means "not measured" and must survive all the way to the screen and
 *    into the prompt. It is never coerced to 0 — a zero reads as a confident
 *    measurement of "none", which is the opposite of the truth.
 * 3. Unreliable readings are excluded. The engine already flags them; every
 *    consumer here honours `reliable !== false`.
 * 4. No coefficient without a source. Where the engine computes a real
 *    biomechanical figure (fhp_index.extra_load_kg, neck_angle_deg), that is
 *    what gets used. Where nothing measures the thing (burnout), no number is
 *    produced at all.
 *
 * Everything here is pure and synchronously testable; see clinicalMetrics.test.mjs.
 */

/** Mean, or null for an empty list — never 0, which is a real score. */
export function mean(xs) {
  const v = (xs || []).filter(Number.isFinite);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

const r0 = (x) => (x == null ? null : Math.round(x));
const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);

/**
 * Pull one field off one metric across the most recent `n` sessions, keeping
 * only readings the engine marked reliable.
 *
 * `reliable` is absent on a few metrics that are always trustworthy, so the
 * test is `!== false` rather than `=== true`.
 */
export function metricSamples(sessions, key, field = "score", n = 10) {
  return (sessions || [])
    .slice(0, n)
    .map((s) => s?.metrics?.[key])
    .filter((m) => m && m.reliable !== false && Number.isFinite(m[field]))
    .map((m) => m[field]);
}

/** Mean *score* (0-100, higher is better) for a metric, or null. */
export function metricScore(sessions, key, n = 10) {
  return r0(mean(metricSamples(sessions, key, "score", n)));
}

/** Mean *measured value* for a metric — degrees, cm, whatever its unit is. */
export function metricValue(sessions, key, n = 10) {
  return r1(mean(metricSamples(sessions, key, "value", n)));
}

/**
 * The canonical body-zone metric map — ONE definition, because three existed
 * and they disagreed.
 *
 * pdfReports.js, firebase.js and SharedReportPage.jsx each had their own list,
 * each with a different set of names the engine never emits, so the same
 * session produced different zone risks depending on which artefact the patient
 * handed to their physiotherapist. All three now import this.
 *
 * Only metrics that genuinely localise to the zone. `monitor_height` and
 * `screen_distance` are environmental causes, not body measurements, so they
 * are deliberately absent; nothing below the trunk appears at all, because a
 * seated upper-body camera view cannot observe the hips or pelvis.
 */
export const ZONE_METRICS = {
  cervical: ["neck_lean", "head_tilt", "head_yaw", "fhp_index"],
  thoracic: ["shoulder_level", "rounded_shoulders", "shoulder_elevation"],
  lumbar:   ["spine_lean", "torso_flexion", "trunk_rotation"],
};

/**
 * Risk for a body region, as the complement of the mean score of the metrics
 * that genuinely bear on it. Metrics with no reliable reading are dropped
 * rather than defaulted.
 *
 * The important part is `keys.filter(has a reading)`: an earlier version of
 * this idea (in the shared report) listed metric names the engine does not
 * emit — `fhp`, `spine_align`, `hip_angle` — and defaulted each missing one to
 * a perfect 100. With three of four names phantom, thoracic risk could not
 * mathematically exceed 25%, so a patient with severe rounded shoulders got a
 * green "4% - Low" on the report they handed their physiotherapist. Returning
 * null on no data, and counting only what was actually read, is what stops
 * that class of silent flooring.
 */
export function zoneRisk(sessions, keys, n = 10) {
  const per = keys
    .map((k) => metricScore(sessions, k, n))
    .filter((v) => v != null);
  if (!per.length) return null;
  return { risk: r0(100 - mean(per)), from: per.length, of: keys.length };
}

/**
 * Cervical load in kg above neutral, straight from the engine's own Hansraj
 * (2014) implementation.
 *
 * postureEngine computes this per frame from *measured* forward-head
 * displacement: pitch = atan2(distCm, 15cm), load = 4.5/cos(pitch) - 4.5. That
 * is the actual published method against an actual measurement — which is
 * exactly what the four hardcoded `avg_score < 55 ? "18-27 kg"` lookup tables
 * were pretending to be while the real number sat unread on every session doc.
 */
export function cervicalLoadKg(sessions, n = 10) {
  return r1(mean(metricSamples(sessions, "fhp_index", "extra_load_kg", n)));
}

/** Measured head flexion in degrees (the Hansraj input), or null. */
export function neckFlexionDeg(sessions, n = 10) {
  const fromFhp = mean(metricSamples(sessions, "fhp_index", "neck_angle_deg", n));
  if (fromFhp != null) return r0(fromFhp);
  // Sessions written before the engine emitted neck_angle_deg carry the
  // neck-lean angle, which is a different (lateral/sagittal lean) measurement
  // but still a measured angle rather than a bucket off the overall score.
  return null;
}

/**
 * Evenly-spaced sample of a series, preserving its overall shape.
 *
 * Sessions store `score_history` as a TAIL slice — App.jsx keeps the last 60
 * samples and firebase.js caps that to 30 — so at one sample per two seconds a
 * session document has carried only the final MINUTE of a session, however long
 * it ran. A "within-session decline" computed from that measures the first
 * twenty seconds of the last minute against the last twenty, which is not what
 * the label says and would have been a fresh instance of exactly the defect
 * this module exists to remove.
 *
 * The full series is in memory at save time (App.jsx's fullHistRef); decimating
 * it to the same 30 points costs no extra storage and keeps the whole span.
 */
export function decimate(arr, n = 30) {
  const a = (arr || []).filter(Number.isFinite);
  if (a.length <= n) return a;
  const out = [];
  for (let i = 0; i < n; i++) out.push(a[Math.round((i * (a.length - 1)) / (n - 1))]);
  return out;
}

/**
 * Within-session score decline — the only fatigue signal this product actually
 * has.
 *
 * Every session stores `score_history`, a series sampled through the session.
 * Comparing the last third against the first third measures whether the user's
 * posture degraded while they sat there, which is what "fatigue" is supposed to
 * mean. Returns points of decline (positive = got worse) averaged over the
 * sessions long enough to split into thirds, plus how many that was.
 *
 * Sessions with fewer than 9 samples are skipped rather than split into thirds
 * of two or three points, where a single noisy sample would dominate.
 *
 * This replaces `(100 - week_avg) * 0.6 + (sessions.length < 5 ? 30 : 10)`,
 * which measured no such thing: it was the weekly posture average inverted,
 * plus a step that made a user's "fatigue" drop 20 points the moment their
 * fifth session was recorded, and which could never read below 10 — so a
 * flawless week still reported fatigue.
 */
export function sessionFatigue(sessions, n = 10) {
  const declines = [];
  for (const s of (sessions || []).slice(0, n)) {
    // score_curve ONLY. `score_history` is a tail slice covering the last
    // minute of a session (see decimate() above), so computing a whole-session
    // decline from it would be a fabrication with measured-sounding
    // provenance. Sessions written before score_curve existed simply have no
    // reading, and every consumer already renders null as "not measured".
    const h = (s?.score_curve || []).filter(Number.isFinite);
    if (h.length < 9) continue;
    const t = Math.floor(h.length / 3);
    const first = mean(h.slice(0, t));
    const last = mean(h.slice(-t));
    if (first == null || last == null) continue;
    declines.push(first - last);
  }
  if (!declines.length) return null;
  return { declinePoints: r1(mean(declines)), from: declines.length };
}

const asDate = (v) => (v?.toDate ? v.toDate() : new Date(v || 0));
const DAY = 864e5;

/**
 * This week and last week, each reporting its own session count, and an average
 * that is null when that week had no sessions.
 *
 * `avg([])` returning 0 was fed to the clinical prompts across all four screens
 * as a literal `Last week: 0/100`, so a user who took a week off was described
 * to a physiotherapist persona as having scored zero out of a hundred — and the
 * trend it produced was `-100%`, which fired the decline and safety language.
 * The screens themselves rendered an honest em-dash while the prompt beside
 * them asserted the zero.
 */
export function weekWindows(sessions, now = Date.now()) {
  const inWindow = (lo, hi) =>
    (sessions || []).filter((s) => {
      const ms = now - asDate(s.created_at).getTime();
      return ms >= lo && ms < hi;
    });
  const thisWeek = inWindow(0, 7 * DAY);
  const lastWeek = inWindow(7 * DAY, 14 * DAY);
  const scoreOf = (arr) => arr.map((s) => s.avg_score).filter(Number.isFinite);
  const wAvg = r0(mean(scoreOf(thisWeek)));
  const lAvg = r0(mean(scoreOf(lastWeek)));
  return {
    thisWeek: { n: thisWeek.length, avg: wAvg },
    lastWeek: { n: lastWeek.length, avg: lAvg },
    // A trend needs both endpoints. Either side missing means "no comparison
    // possible", which is not the same as 0% ("measured, unchanged").
    trendPct: wAvg != null && lAvg != null && lAvg > 0
      ? Math.round(((wAvg - lAvg) / lAvg) * 100)
      : null,
  };
}

/**
 * Lifetime session count, and whether it is exact.
 *
 * The session queries are `limit(50)`, so `sessions.length` saturates and every
 * screen that printed it as "Sessions: N total" told a 300-session user they
 * had 50. The profile doc carries the true count, maintained on every save.
 * When it is missing, `exact:false` says the array was truncated so callers can
 * render "50+" rather than a wrong total.
 */
export function lifetimeSessions(profile, sessions, queryLimit = 50) {
  const n = profile?.sessions_count;
  if (Number.isFinite(n)) return { count: n, exact: true };
  const len = (sessions || []).length;
  return { count: len, exact: len < queryLimit };
}

/**
 * How much of what we showed was actually measured — a real confidence signal,
 * to replace the invented "±15% error margin" that four screens quoted to a
 * clinical persona as instrument accuracy. Nothing in this codebase has ever
 * measured calibrated-vs-uncalibrated error, so no number was available to
 * quote; this one is at least computed from the engine's own reliability flags.
 */
export function readingReliability(sessions, n = 10) {
  let ok = 0;
  let total = 0;
  for (const s of (sessions || []).slice(0, n)) {
    for (const m of Object.values(s?.metrics || {})) {
      if (!m || typeof m !== "object" || !("reliable" in m)) continue;
      total++;
      if (m.reliable !== false) ok++;
    }
  }
  return total ? { pct: Math.round((ok / total) * 100), of: total } : null;
}

/**
 * Render a nullable measurement for a prompt or a label. Callers pass the unit;
 * null becomes an explicit "not measured" rather than a silent 0.
 */
export function fmtMeasure(v, unit, isAr = false) {
  if (v == null) return isAr ? "غير متاح (لم يُقَس)" : "not measured";
  return `${v}${unit || ""}`;
}

/**
 * Metrics that are internal scoring adjustments, not postural findings. They
 * must never be rendered as a metric row or folded into a zone: `position_penalty`
 * is a deduction in points and `session_fatigue` is a scoring adjustment, both
 * with a `score` field that looks exactly like a real metric's.
 */
export const NON_POSTURAL_METRICS = new Set([
  "session_fatigue",
  "position_penalty",
  "confidence_val",
]);
