/**
 * analysisRate.js — how often the live loop needs to analyse a frame.
 *
 * Posture changes over seconds, yet the loop analysed up to 20 frames a second for as long
 * as the session ran, whether or not the person moved. This controller keeps the full rate
 * while the person is moving and drops to a slow rate once they have been still for a
 * while. Nothing is skipped: the slow rate still samples several times a second, and any
 * movement — including a slow drift away from where stillness began — returns to the full
 * rate on the next sample.
 * Pure — unit-tested.
 */
const KEYS = [0, 7, 8, 11, 12];            // nose, ears, shoulders

/**
 * @param {object} [o]
 * @param {number} [o.fastMs=50]        interval while moving (the loop's 20/s ceiling)
 * @param {number} [o.slowMs=150]       interval while still
 * @param {number} [o.stillAfterMs=2000] how long without movement before slowing down
 * @param {number} [o.threshold=0.05]   movement that counts, as a share of the shoulder width (about 2 cm)
 *
 * The defaults come from the benchmark (docs/PERFORMANCE.md): 150 ms roughly halves the CPU
 * used on a still subject for a small loss of stability; 250 ms saved more and cost more.
 */
export function createRateController({ fastMs = 50, slowMs = 150, stillAfterMs = 2000, threshold = 0.05 } = {}) {
  let anchor = null, anchorT = 0, interval = fastMs;
  const moved = lms => {
    const sw = Math.hypot(lms[11].x - lms[12].x, lms[11].y - lms[12].y);
    if (!(sw > 1e-4)) return true;
    for (const k of KEYS) {
      const a = anchor[k], p = lms[k];
      if (!a || !p || Math.hypot(p.x - a.x, p.y - a.y) > threshold * sw) return true;
    }
    return false;
  };
  return {
    /**
     * Feed every analysed frame.
     * @param {Array|null} lms  raw landmarks (normalised), or null when nobody is in frame
     * @param {number} tMs
     * @returns {number} milliseconds to wait before the next analysis
     */
    update(lms, tMs) {
      if (!lms || !lms[11] || !lms[12]) { anchor = null; return (interval = slowMs); }   // empty frame: keep watching, slowly
      if (!anchor || moved(lms)) {
        anchor = KEYS.reduce((o, k) => { o[k] = { x: lms[k]?.x, y: lms[k]?.y }; return o; }, {});
        anchorT = tMs;
        return (interval = fastMs);
      }
      return (interval = tMs - anchorT >= stillAfterMs ? slowMs : fastMs);
    },
    get intervalMs() { return interval; },
    reset() { anchor = null; interval = fastMs; },
  };
}
