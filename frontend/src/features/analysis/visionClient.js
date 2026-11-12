/**
 * visionClient.js — runs MediaPipe in a worker behind the same call the live loop
 * already makes: pose.detectForVideo(video, ts).
 *
 * Inference used to run on the main thread: 60–115 ms per analysed frame during which
 * the page could not paint or react (docs/PERFORMANCE.md). In the worker the call returns
 * at once with the newest finished result, or { pending: true } when there is nothing new
 * yet, and starts the next inference. A reading therefore describes a frame about one
 * inference old — irrelevant for posture, which changes over seconds.
 *
 * If the worker cannot start, or dies, the client falls back to the main thread by
 * itself, so callers never need two code paths.
 */
import { MP_SOURCES, loadVision, createTask, preferredDelegates } from "./mediapipeLoader.js";

export const POSE_OPTIONS = { runningMode: "VIDEO", numPoses: 1, minPoseDetectionConfidence: .3, minPosePresenceConfidence: .3, minTrackingConfidence: .3 };
const PENDING = Object.freeze({ pending: true, landmarks: [] });

/** Float32Array(n × 4) → [{x, y, z, visibility}] — the shape PoseLandmarker returns. Pure. */
export function unpackPose(a) {
  const out = new Array(a.length / 4);
  for (let i = 0; i < out.length; i++) out[i] = { x: a[4 * i], y: a[4 * i + 1], z: a[4 * i + 2], visibility: a[4 * i + 3] };
  return out;
}
/** { lm, m } → the shape FaceLandmarker returns. Pure. */
export function unpackFace(f) {
  const lm = new Array(f.lm.length / 3);
  for (let i = 0; i < lm.length; i++) lm[i] = { x: f.lm[3 * i], y: f.lm[3 * i + 1], z: f.lm[3 * i + 2] };
  return { faceLandmarks: [lm], facialTransformationMatrixes: [{ data: f.m }] };
}

async function mainThreadPose(delegates) {
  const { mod, fileset, source } = await loadVision();
  const { task, delegate } = await createTask(mod.PoseLandmarker, fileset, [...new Set([source.pose, ...MP_SOURCES.map(m => m.pose)])], POSE_OPTIONS, delegates);
  return { task, delegate, source: source.name };
}

/**
 * @param {object} [o]
 * @param {boolean} [o.worker=true]   false = main thread only
 * @param {string[]} [o.delegates]    default: chosen from the WebGL renderer
 * @param {number} [o.minIntervalMs=50]  at most one inference per this many ms (the app's 20/s ceiling)
 * @param {number} [o.staleMs=1000]   a finished result nobody read for this long is dropped (the loop was
 *                                    paused; it must not resume on a frame from before the pause)
 * @param {Function} [o.mainThread]   creates the main-thread task; replaceable in tests
 * @param {number} [o.stallMs=8000]   a frame unanswered for this long means the worker is dead
 * @returns {Promise<{ pose, face, mode: "worker"|"main", delegate, source, close }>}
 *   pose.detectForVideo(video, ts) → { landmarks: [[…]] } | { landmarks: [] } | { pending: true, landmarks: [] }
 *   face  null on the main thread (the precision layer loads its own model); in the worker an
 *         object whose detectForVideo() returns the newest unread face result or null.
 */
export async function createVisionClient({ worker: useWorker = true, delegates, stallMs = 8000, minIntervalMs = 50, staleMs = 1000,
                                          mainThread = mainThreadPose } = {}) {
  delegates ||= preferredDelegates();
  const canWork = useWorker && typeof Worker !== "undefined" && typeof createImageBitmap !== "undefined";
  let w = null, info = null;
  if (canWork) {
    try {
      w = new Worker(new URL("./visionWorker.js", import.meta.url), { type: "classic" });
      const abs = u => new URL(u, globalThis.location?.href).href;        // relative URLs would resolve against the worker script
      const sources = MP_SOURCES.map(s => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, k === "name" ? v : abs(v)])));
      info = await new Promise((ok, bad) => {
        const t = setTimeout(() => bad(new Error("vision worker timed out")), 12000);
        w.onerror = e => { clearTimeout(t); bad(new Error(e.message || "vision worker failed")); };
        w.onmessage = ({ data }) => { if (data.type === "ready") { clearTimeout(t); ok(data); } else if (data.type === "error") { clearTimeout(t); bad(new Error(data.message)); } };
        w.postMessage({ type: "init", sources, delegates, poseOptions: POSE_OPTIONS });
      });
    } catch (e) { try { w?.terminate(); } catch { /* ignore */ } w = null; console.warn("[vision] worker unavailable, using the main thread:", e?.message); }
  }
  if (!w) {
    const m = await mainThread(delegates);
    m.task.info = { mode: "main", delegate: m.delegate };
    return { pose: m.task, face: null, mode: "main", delegate: m.delegate, source: m.source, close() { try { m.task.close(); } catch { /* ignore */ } } };
  }

  // ── worker mode ──
  let busy = false, sentAt = 0, nextId = 1, fresh = null, faceFresh = null, faceWantedAt = -1e9, frameN = 0, faceState = "idle";
  let lastVideo = null, polledAt = 0;
  let fallback = null, closed = false;                    // main-thread task once the worker has died
  const die = why => {
    if (fallback || closed) return;
    console.warn("[vision] worker lost, continuing on the main thread:", why);
    try { w.terminate(); } catch { /* ignore */ }
    fallback = { task: null };
    mainThread(delegates).then(m => { if (closed) { try { m.task.close(); } catch { /* ignore */ } } else fallback.task = m.task; }, () => { /* stays pending; the app's own watchdog reports it */ });
  };
  w.onerror = e => die(e.message);
  w.onmessage = ({ data }) => {
    if (data.type !== "result") return;
    busy = false;
    if (!data.error) {
      fresh = { landmarks: data.pose ? [unpackPose(data.pose)] : [], ms: data.ms, at: performance.now() };
      if (data.faceState) faceState = data.faceState;
      if (data.face) faceFresh = unpackFace(data.face);
    }
    // Start the next inference now instead of waiting for the caller's next tick, which would
    // idle the worker for up to one tick per frame. Only while the caller is still polling,
    // and never faster than minIntervalMs.
    if (lastVideo && performance.now() - polledAt < Math.max(500, 3 * minIntervalMs)) {
      const wait = minIntervalMs - (performance.now() - sentAt);
      if (wait <= 0) kick(lastVideo, performance.now()); else setTimeout(() => { if (!busy && !closed && !fallback && lastVideo) kick(lastVideo, performance.now()); }, wait);
    }
  };
  const kick = (video, ts) => {
    busy = true; sentAt = performance.now();
    const wantFace = performance.now() - faceWantedAt < 2000 && ++frameN % 2 === 0;       // every 2nd frame, as before
    createImageBitmap(video).then(bitmap => { if (!closed && !fallback) w.postMessage({ type: "frame", id: nextId++, bitmap, ts, face: wantFace }, [bitmap]); else bitmap.close(); },
      () => { busy = false; });
  };
  return {
    mode: "worker", delegate: info.delegate, source: info.source,
    pose: {
      get info() { return { mode: fallback ? "main" : "worker", delegate: info.delegate }; },
      /** Change the rate cap (adaptive rate: 50 ms while moving, slower once still). */
      setMinInterval(ms) { if (ms > 0) minIntervalMs = ms; },
      detectForVideo(video, ts) {
        if (fallback) return fallback.task ? fallback.task.detectForVideo(video, ts) : PENDING;
        if (busy && performance.now() - sentAt > stallMs) { die("no answer"); return PENDING; }
        lastVideo = video; polledAt = performance.now();
        if (!busy && polledAt - sentAt >= minIntervalMs) kick(video, ts);
        if (fresh && polledAt - fresh.at > staleMs) fresh = null;
        if (!fresh) return PENDING;
        const r = fresh; fresh = null; return r;
      },
    },
    face: {
      /** Newest face result not yet read, or null. Also tells the worker the face model is wanted. */
      detectForVideo() { faceWantedAt = performance.now(); const r = faceFresh; faceFresh = null; return r; },
      get state() { return fallback ? "failed" : faceState; },
    },
    close() { closed = true; lastVideo = null; try { w.terminate(); } catch { /* ignore */ } try { fallback?.task?.close(); } catch { /* ignore */ } },
  };
}
