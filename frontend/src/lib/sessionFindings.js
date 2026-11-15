/**
 * sessionFindings — what the end-of-session summary should report.
 *
 * The summary used to read the metrics of the LAST analysed frame. The last
 * frame is the moment the user reached for "Stop & Save", usually leaning
 * toward the mouse, so the "top issues" described that one second rather than
 * the session (camp test, 2026-11-15).
 *
 * This keeps, per metric, how many measured frames fell in each severity, and
 * a representative reading for the worst severity that persisted. At the end
 * it returns a metrics object in the engine's own shape, so buildFindings()
 * and the summary panel use it unchanged:
 *   - a metric is reported at the worst severity it held for at least
 *     `minShare` of its measured frames (mild + moderate + severe count
 *     toward "mild", moderate + severe toward "moderate", and so on);
 *   - below that it is "normal", so a brief moment does not become a finding;
 *   - a metric that was never reliable stays unreliable (unmeasured).
 * `share` (0–1) is attached so a caller can say "for most of the session".
 */

const ORDER = ["normal", "mild", "moderate", "severe"];
const rank = s => Math.max(0, ORDER.indexOf(s));

export function createSessionAggregator() {
  let agg = Object.create(null);
  return {
    reset() { agg = Object.create(null); },
    add(metrics) {
      if (!metrics || typeof metrics !== "object") return;
      for (const id in metrics) {
        const m = metrics[id];
        if (!m || typeof m !== "object") continue;
        const a = agg[id] || (agg[id] = { measured: 0, counts: [0, 0, 0, 0], sample: [null, null, null, null], last: null });
        a.last = m;
        if (m.reliable === false) continue;
        a.measured++;
        const r = rank(m.severity || "normal");
        a.counts[r]++;
        // Keep a reading from the middle of each severity's run rather than its
        // most extreme frame, so the value shown is typical, not a spike.
        if (a.counts[r] % 2 === 1) a.sample[r] = m;
      }
    },
    summarize({ minShare = 0.2 } = {}) {
      const out = {};
      for (const id in agg) {
        const a = agg[id];
        if (a.measured === 0) { out[id] = { ...a.last, reliable: false }; continue; }
        let sev = 0;
        for (let r = 3; r >= 1; r--) {
          const atLeast = a.counts.slice(r).reduce((x, y) => x + y, 0);
          if (atLeast / a.measured >= minShare) { sev = r; break; }
        }
        const atLeast = a.counts.slice(sev).reduce((x, y) => x + y, 0);
        const base = a.sample[sev] || a.last;
        out[id] = { ...base, reliable: true, severity: ORDER[sev], share: +(atLeast / a.measured).toFixed(2) };
      }
      return out;
    },
  };
}
