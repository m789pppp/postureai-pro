/**
 * diag.js — what the live pipeline is doing on THIS device, for reporting a problem.
 *
 * Opt-in (experiment "diag": open the site once with ?exp=diag). The developer cannot see
 * a tester's screen, device or errors; this collects the handful of facts that decide
 * where a problem is, and DiagPanel shows them with a Copy button.
 * Numbers and error text only. No image, no landmarks, nothing is sent anywhere.
 */
const MAX_ERRORS = 8;
const state = { errors: [], frames: [], fields: {} };
let installed = false;

/** Pure: analyses per second from the timestamps of recent analysed frames. */
export function rateFrom(times, nowMs, windowMs = 5000) {
  const recent = times.filter(t => nowMs - t <= windowMs);
  if (recent.length < 2) return 0;
  return Math.round(((recent.length - 1) / ((recent[recent.length - 1] - recent[0]) / 1000)) * 10) / 10;
}

/** Pure: keep an error list short, newest last, identical neighbours collapsed with a count. */
export function pushError(list, text, max = MAX_ERRORS) {
  const msg = String(text || "unknown error").replace(/\s+/g, " ").slice(0, 240);
  const last = list[list.length - 1];
  if (last && last.msg === msg) { last.n++; return list; }
  list.push({ msg, n: 1 });
  while (list.length > max) list.shift();
  return list;
}

/** Start collecting script errors. Safe to call more than once and outside a browser. */
export function diagInstall() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", e => pushError(state.errors, e?.message || e?.error?.message));
  window.addEventListener("unhandledrejection", e => pushError(state.errors, `promise: ${e?.reason?.message || e?.reason}`));
  window.addEventListener("vite:preloadError", e => pushError(state.errors, `chunk failed to load: ${e?.payload?.message || ""}`));
}

/** Call once per analysed frame. */
export function diagFrame(nowMs) {
  state.frames.push(nowMs);
  if (state.frames.length > 240) state.frames.splice(0, state.frames.length - 240);
}

/** Merge facts about the pipeline (pipeline id, delegate, model states…). */
export function diagSet(fields) { Object.assign(state.fields, fields); }

export function diagError(text) { pushError(state.errors, text); }

export function diagSnapshot(nowMs = (typeof performance !== "undefined" ? performance.now() : 0)) {
  const nav = typeof navigator === "undefined" ? {} : navigator;
  const last = state.frames[state.frames.length - 1];
  return {
    analysesPerSec: rateFrom(state.frames, nowMs),
    msSinceLastFrame: last == null ? null : Math.round(nowMs - last),
    ...state.fields,
    errors: state.errors.map(e => (e.n > 1 ? `${e.msg} (×${e.n})` : e.msg)),
    device: { cores: nav.hardwareConcurrency ?? null, memoryGb: nav.deviceMemory ?? null,
              screen: typeof screen === "undefined" ? null : `${screen.width}x${screen.height}@${typeof devicePixelRatio === "undefined" ? 1 : devicePixelRatio}`,
              ua: String(nav.userAgent || "").slice(0, 160) },
  };
}
