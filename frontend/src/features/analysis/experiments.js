/**
 * experiments.js — switches for changes that are not yet proven on real people.
 *
 * Anything behind a switch is OFF for every user unless they turn it on themselves, by
 * adding ?exp=name1,name2 to the address once (it is remembered on that device) or
 * ?exp=off to clear it. This exists because scoring changes that passed every synthetic
 * test still made real sessions worse, and they had gone straight to everyone.
 *
 *   diag     show an on-screen readout of the pipeline and any script errors, with a Copy
 *            button, for reporting a problem. Changes nothing about the analysis.
 *   worker   run pose and face inference in a Web Worker instead of on the main thread.
 *   adaptive lower the analysis rate while the person is still.
 *   head3d   score looking down / up from the face model's 3-D head pose, with a neutral
 *            learned in the first seconds; cap the score at 84 while a moderate fault lasts;
 *            show head flexion in the HUD relative to that learned neutral.
 */
const KEY = "posmoz_exp";

/** Pure: which experiments a query string and a stored value turn on. */
export function parseExperiments(search, stored) {
  const q = new URLSearchParams(search || "").get("exp");
  const raw = q != null ? q : (stored || "");
  if (raw.trim().toLowerCase() === "off") return [];
  return [...new Set(raw.split(",").map(s => s.trim().toLowerCase()).filter(s => /^[a-z0-9_-]{1,24}$/.test(s)))];
}

let memo = null;
function active() {
  if (memo) return memo;
  let stored = "";
  try { stored = localStorage.getItem(KEY) || ""; } catch { /* private mode */ }
  const search = typeof location !== "undefined" ? location.search : "";
  memo = parseExperiments(search, stored);
  try { if (new URLSearchParams(search).get("exp") != null) localStorage.setItem(KEY, memo.join(",")); } catch { /* ignore */ }
  return memo;
}

export function experimentEnabled(name) { return active().includes(name); }
export function activeExperiments() { return active().slice(); }
