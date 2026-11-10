/**
 * correction.js — apply the bench-learned correction (backend/ai/bench_train.py →
 * correction.json) in the browser. A target is corrected only if the training run
 * showed it beats the raw estimate on unseen people (leave-one-subject-out).
 */
export function applyCorrection(correction, target, features) {
  const m = correction?.targets?.[target];
  if (!m) return null;
  let y = m.intercept;
  for (let i = 0; i < m.features.length; i++) {
    const v = features[m.features[i]];
    if (!Number.isFinite(v)) return null;
    y += m.weights[i] * v;
  }
  return y;
}
