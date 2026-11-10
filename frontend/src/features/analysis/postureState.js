/**
 * postureState.js — stable posture state from a noisy score (pure, unit-tested).
 * Hysteresis + dwell time: a state only changes after the score has stayed past the
 * threshold for a while, so alerts and "episodes" don't flicker on a single bad frame.
 */
export const DEFAULT_STATE_RULES = {
  bad:  { enterBelow: 60, enterMs: 3000, exitAbove: 66, exitMs: 2000 },
  warn: { enterBelow: 72, enterMs: 2000, exitAbove: 76, exitMs: 1500 },
};

export function createPostureStateMachine(rules = DEFAULT_STATE_RULES) {
  let state = "good", since = null, candidate = null, candSince = null;
  const target = s => {
    if (state === "bad") return s > rules.bad.exitAbove ? (s < rules.warn.enterBelow ? "warn" : "good") : "bad";
    if (s < rules.bad.enterBelow) return "bad";
    if (state === "warn") return s > rules.warn.exitAbove ? "good" : "warn";
    return s < rules.warn.enterBelow ? "warn" : "good";
  };
  const dwell = (from, to) => (to === "bad" ? rules.bad.enterMs : from === "bad" ? rules.bad.exitMs
    : to === "warn" ? rules.warn.enterMs : rules.warn.exitMs);
  return {
    update(tMs, score) {
      if (since == null) since = tMs;
      if (score == null || !Number.isFinite(score)) return { state, since, changed: false };
      const want = target(score);
      if (want === state) { candidate = null; return { state, since, changed: false }; }
      if (want !== candidate) { candidate = want; candSince = tMs; }
      if (tMs - candSince >= dwell(state, want)) {
        state = want; since = candSince; candidate = null;
        return { state, since, changed: true };
      }
      return { state, since, changed: false };
    },
    get state() { return state; },
  };
}
