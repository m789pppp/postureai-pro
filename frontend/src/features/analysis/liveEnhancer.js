/**
 * liveEnhancer.js — adds a second model and clinical-style signals to the
 * live analysis loop, without changing the existing score pipeline.
 *
 *   - Face Landmarker (lazy-loaded, every 2nd frame): 3-D head pose + iris.
 *   - Head flexion relative to the user's calibrated neutral — the camera's own
 *     tilt cancels out because both readings come from the same camera position.
 *   - Iris-based distance (One Euro smoothed), using the calibrated focal length
 *     when the user measured it once, a 65° HFOV estimate otherwise.
 *   - Exposure tracking: how long the user has spent in each risk zone
 *     (the clinically meaningful number, rather than a per-frame score).
 *   - RTMW-x (133-point whole-body model, WebGPU) as a third model: refines the
 *     MediaPipe landmarks by confidence-weighted fusion and reports how much the
 *     models agree.
 *   - Virtual ears from the face mesh: MediaPipe Pose's ear points weaken when ears
 *     are covered (hijab, long hair) and every neck metric depends on them. The face
 *     contour points at ear level stay visible, so the ear is rebuilt from them and
 *     blended in by pose visibility.
 *   - A 0–100 confidence for the current reading.
 */
import {
  OneEuroFilter, headPoseFromMatrix, irisDiameterPx, distanceFromIris, focalFromHfov,
} from "./calibrationCore.js";
import { createRtmwRunner, bboxFromPose } from "./rtmwWeb.js";
import { headProtractionCm, neckLoadKg, shoulderWidthPx } from "./neckModel.js";
import { captureSignature, loadReferenceSignature, cameraChange } from "./cameraDrift.js";
import { createPostureStateMachine } from "./postureState.js";
import { applyCorrection } from "./correction.js";

// COCO-WholeBody-133 → MediaPipe-33 (same table as backend/ai/ensemble_pose.py)
const F = k => 23 + k, LH = k => 91 + k, RH = k => 112 + k;
export const WB133_TO_MP33 = {
  0: 0, 1: F(42), 2: 1, 3: F(45), 4: F(39), 5: 2, 6: F(36), 7: 3, 8: 4, 9: F(54), 10: F(48),
  11: 5, 12: 6, 13: 7, 14: 8, 15: 9, 16: 10, 17: LH(17), 18: RH(17), 19: LH(5), 20: RH(5),
  21: LH(4), 22: RH(4), 23: 11, 24: 12, 25: 13, 26: 14, 27: 15, 28: 16, 29: 19, 30: 22, 31: 17, 32: 20,
};
const AGREE_KEYS = [0, 7, 8, 11, 12];

/**
 * Ear position relative to the face-mesh contour point at ear level (234 right, 454 left),
 * in face-local units of outer-eye-corner distance (33↔263): "inward" toward the face
 * centre, "down" perpendicular. Fitted on 2 people × 6 views (flip, ±12° roll):
 * inward 0.086–0.093, down −0.02–0.00, per-view SD ≈ 0.03 IOD (≈3 mm). Small sample —
 * refit on the bench when available.
 */
export const EAR_OFFSET = { inward: 0.09, down: -0.01 };

/** Virtual ear points {7: left, 8: right} (normalised) from Face Landmarker landmarks. */
export function virtualEars(face, W, H) {
  if (!face || face.length < 455) return null;
  const P = i => ({ x: face[i].x * W, y: face[i].y * H });
  const L = P(454), R = P(234), eL = P(263), eR = P(33);
  const iod = Math.hypot(eL.x - eR.x, eL.y - eR.y);
  const hn = Math.hypot(L.x - R.x, L.y - R.y);
  if (!(iod > 1) || !(hn > 1)) return null;
  const ux = (L.x - R.x) / hn, uy = (L.y - R.y) / hn;      // right → left axis
  const vx = -uy, vy = ux;                                  // "down" when upright
  const at = (edge, inwardSign) => ({
    x: (edge.x + (inwardSign * ux * EAR_OFFSET.inward + vx * EAR_OFFSET.down) * iod) / W,
    y: (edge.y + (inwardSign * uy * EAR_OFFSET.inward + vy * EAR_OFFSET.down) * iod) / H,
  });
  return { 7: at(L, -1), 8: at(R, 1) };
}

/** Blend virtual ears into pose landmarks: weak (covered) pose ears lean on the face mesh. */
export function blendEars(pose, ears, faceWeight = 0.5) {
  if (!pose || !ears) return pose;
  const out = pose.slice();
  for (const i of [7, 8]) {
    const p = pose[i], e = ears[i];
    if (!p || !e) continue;
    const vis = Math.max(0, Math.min(1, p.visibility ?? 0));
    const wp = vis * vis;
    out[i] = { ...p, x: (wp * p.x + faceWeight * e.x) / (wp + faceWeight), y: (wp * p.y + faceWeight * e.y) / (wp + faceWeight),
               visibility: Math.max(vis, 0.7) };
  }
  return out;
}

/** RTMW SimCC scores are not 0–1 (confident points ≈ 3–8): map to 0–1. Heuristic. */
export const rtmwConf = s => Math.min(1, Math.max(0, (s - 0.5) / 2.5));

/**
 * Confidence-weighted fusion of MediaPipe (normalised) and RTMW (source px) points.
 * RTMW runs slower than the live loop, so its result is motion-compensated: what is
 * kept is RTMW's correction relative to the MediaPipe frame it was computed on
 * (mp0), re-applied to the current MediaPipe frame. Older results count less.
 * Pure — unit-tested.
 * @returns {{ lms: Array, disagreement: number|null }} disagreement in shoulder-widths
 */
export function fuseWithRtmw(mp, rt, W, H, ageMs, weights = null, mp0 = null) {
  if (!mp || !rt) return { lms: mp, disagreement: null };
  const age = Math.max(0, 1 - ageMs / 3000);
  const dx = i => (mp0?.[i] ? mp[i].x - mp0[i].x : 0), dy = i => (mp0?.[i] ? mp[i].y - mp0[i].y : 0);
  const out = mp.map(p => ({ ...p }));
  for (const [mi, wi] of Object.entries(WB133_TO_MP33)) {
    const i = +mi, p = mp[i];
    if (!p) continue;
    const xr = rt.kpts[2 * wi] / W + dx(i), yr = rt.kpts[2 * wi + 1] / H + dy(i);
    const cr = rtmwConf(rt.scores[wi]);
    if (!(cr > 0) || !Number.isFinite(xr) || xr < -0.1 || xr > 1.1) continue;
    const wm = Math.max(0, p.visibility ?? 1) * (weights?.mp?.[i] ?? 1);
    const wr = cr * (weights?.rtmw?.[i] ?? 1) * age;
    if (wm + wr <= 0) continue;
    out[i] = { ...p, x: (wm * p.x + wr * xr) / (wm + wr), y: (wm * p.y + wr * yr) / (wm + wr),
               visibility: Math.max(p.visibility ?? 0, cr) };
  }
  const sw = Math.hypot((mp[11].x - mp[12].x) * W, (mp[11].y - mp[12].y) * H);
  let sum = 0, n = 0;
  for (const i of AGREE_KEYS) {
    const wi = WB133_TO_MP33[i];
    if (rtmwConf(rt.scores[wi]) < 0.3 || (mp[i]?.visibility ?? 0) < 0.3) continue;
    sum += Math.hypot((mp[i].x - dx(i)) * W - rt.kpts[2 * wi], (mp[i].y - dy(i)) * H - rt.kpts[2 * wi + 1]); n++;
  }
  return { lms: out, disagreement: n && sw > 1 ? sum / n / sw : null };
}

const TV = "0.10.14";
const BUNDLE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TV}/vision_bundle.mjs`;
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TV}/wasm`;
const FACE_MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

// Head pitch sign: + = chin down (flexion). Verified only on synthetic matrices —
// flip to -1 if looking down shows a negative number on a real camera.
export const HEAD_PITCH_SIGN = 1;

export const RISK_ZONES = {
  head_flexion: { label: "Head flexion > 15°", test: s => s.headFlexion != null && s.headFlexion > 15 },
  too_close:    { label: "Closer than 45 cm",  test: s => Number.isFinite(s.distCm) && s.distCm < 45 },
  poor_posture: { label: "Score below 60",     test: s => s.score != null && s.score < 60 },
};

/** Pure exposure tracker: seconds in each zone, current streak, longest streak, episodes ≥ minEpisodeSec. */
export function createExposureTracker(zones = RISK_ZONES, { minEpisodeSec = 60, maxGapSec = 2 } = {}) {
  const st = {};
  for (const k of Object.keys(zones)) st[k] = { totalSec: 0, streakSec: 0, longestSec: 0, episodes: 0, counted: false };
  let lastT = null, trackedSec = 0;
  return {
    update(tMs, sample) {
      const t = tMs / 1000;
      const dt = lastT == null ? 0 : t - lastT;
      lastT = t;
      if (dt <= 0 || dt > maxGapSec) return this.snapshot();   // paused tab / camera off: don't count the gap
      trackedSec += dt;
      for (const [k, z] of Object.entries(zones)) {
        const s = st[k];
        if (z.test(sample)) {
          s.totalSec += dt; s.streakSec += dt;
          s.longestSec = Math.max(s.longestSec, s.streakSec);
          if (!s.counted && s.streakSec >= minEpisodeSec) { s.episodes++; s.counted = true; }
        } else { s.streakSec = 0; s.counted = false; }
      }
      return this.snapshot();
    },
    snapshot() {
      const out = { trackedSec };
      for (const [k, s] of Object.entries(st)) {
        out[k] = { ...s, share: trackedSec ? s.totalSec / trackedSec : 0 };
        delete out[k].counted;
      }
      return out;
    },
    reset() { lastT = null; trackedSec = 0; for (const s of Object.values(st)) Object.assign(s, { totalSec: 0, streakSec: 0, longestSec: 0, episodes: 0, counted: false }); },
  };
}

/** 0–100: landmark visibility × face model available × calibration quality. */
export function readingConfidence({ pose, faceFresh, calibScore, disagreement = null }) {
  if (!pose) return 0;
  const key = [0, 2, 5, 7, 8, 11, 12];
  const vis = key.reduce((s, i) => s + Math.min(1, Math.max(0, pose[i]?.visibility ?? 0)), 0) / key.length;
  const faceF = faceFresh ? 1 : 0.85;
  const calF = calibScore == null ? 0.8 : 0.6 + 0.4 * Math.min(100, Math.max(0, calibScore)) / 100;
  const agreeF = disagreement == null ? 1 : disagreement <= 0.08 ? 1 : disagreement >= 0.25 ? 0.75 : 1 - (disagreement - 0.08) * 1.47;
  return Math.round(100 * vis * faceF * calF * agreeF);
}

export function createLiveEnhancer(initialCalib = null, { rtmw: rtmwOpts = {} } = {}) {
  let calib = initialCalib;
  let face = null, loading = false, failed = false, n = 0, closed = false;
  let head = null, irisPx = NaN, distCm = NaN, lastFaceT = -1e9, faceLms = null, lastDetectT = -1e9;
  const f = { pitch: new OneEuroFilter({ minCutoff: 0.8, beta: 0.05 }), yaw: new OneEuroFilter({ minCutoff: 0.8, beta: 0.05 }),
              roll: new OneEuroFilter({ minCutoff: 0.8, beta: 0.05 }), dist: new OneEuroFilter({ minCutoff: 0.4, beta: 0.01 }) };
  const exposure = createExposureTracker();
  const postureSM = createPostureStateMachine();
  // camera-moved-since-calibration check (background signature, on-device only)
  const bg = {}; let refSig, drift = null, driftN = 0;
  // third model (RTMW-x) — loaded after the face model, runs async beside the live loop
  let rtmw = null, rtmwState = "idle", rtmwReason = null, rtmwProgress = 0, rtmwBusy = false, rtmwLast = null, rtmwMs = null, disagreement = null;
  async function loadRtmw() {
    rtmwState = "loading";
    try {
      rtmw = await createRtmwRunner({ ...rtmwOpts, onProgress: p => { rtmwProgress = p; } });
      if (closed) { rtmw.close(); rtmw = null; return; }
      rtmwState = "on";
    } catch (e) { rtmwState = "off"; rtmwReason = e?.reason || "error"; console.warn("RTMW off — running with 2 models:", e?.message); }
  }

  async function load() {
    loading = true;
    try {
      const mod = await import(/* @vite-ignore */ BUNDLE);
      const fr = await mod.FilesetResolver.forVisionTasks(WASM);
      const opts = d => ({ baseOptions: { modelAssetPath: FACE_MODEL, delegate: d }, runningMode: "VIDEO",
                           numFaces: 1, outputFacialTransformationMatrixes: true, outputFaceBlendshapes: false });
      try { face = await mod.FaceLandmarker.createFromOptions(fr, opts("GPU")); }
      catch { face = await mod.FaceLandmarker.createFromOptions(fr, opts("CPU")); }
      if (closed) { try { face.close(); } catch { /* ignore */ } face = null; }
    } catch (e) { failed = true; console.warn("Face model unavailable — live precision layer off:", e?.message); }
    loading = false;
  }

  function detectFace(video, W, H, tMs) {
    if (!face && !loading && !failed && !closed) load();
    if (tMs === lastDetectT) return;            // once per frame, whoever calls first
    lastDetectT = tMs;
    n++;
    if (!face || n % 2 !== 0) return;
    try {
      const r = face.detectForVideo(video, tMs);
      const lm = r.faceLandmarks?.[0];
      const m = r.facialTransformationMatrixes?.[0];
      if (lm && m) {
        const hp = headPoseFromMatrix(m.data);
        const t = tMs / 1000;
        head = { pitch: f.pitch.filter(hp.pitch, t), yaw: f.yaw.filter(hp.yaw, t), roll: f.roll.filter(hp.roll, t) };
        const ip = irisDiameterPx(lm, W, H);
        if (Number.isFinite(ip)) {
          irisPx = ip;
          const cam = calib?.camera;
          const sameRes = cam && cam.width === W && cam.height === H;
          const focal = sameRes && cam.focal_source !== "estimated" ? cam.focal_px : focalFromHfov(W);
          const d = distanceFromIris(ip, focal);
          if (Number.isFinite(d)) distCm = f.dist.filter(d, t);
        }
        faceLms = lm;
        lastFaceT = tMs;
      }
    } catch { /* keep the last good reading */ }
  }

  return {
    setCalibration(c) { calib = c; },
    /**
     * Refine raw MediaPipe landmarks with the latest RTMW result (call before smoothing).
     * Starts an async RTMW inference when the model is idle.
     */
    fuse(rawLms, video, W, H, tMs) {
      detectFace(video, W, H, tMs);
      if (rtmwState === "idle" && face && !closed) loadRtmw();
      if (rtmw && !rtmwBusy && rawLms) {
        const box = bboxFromPose(rawLms, W, H);
        if (box) {
          rtmwBusy = true;
          const t0 = tMs, mp0 = rawLms.map(p => ({ x: p.x, y: p.y }));
          rtmw.infer(video, box).then(r => { rtmwLast = { ...r, t: t0, mp0 }; rtmwMs = r.ms; })
            .catch(() => { /* skip this frame */ }).finally(() => { rtmwBusy = false; });
        }
      }
      let lms = rawLms;
      if (rtmwLast && tMs - rtmwLast.t <= 3000) {
        const res = fuseWithRtmw(rawLms, rtmwLast, W, H, tMs - rtmwLast.t, calib?.ensemble_weights?.landmark_weights, rtmwLast.mp0);
        disagreement = res.disagreement;
        lms = res.lms;
      } else disagreement = null;
      if (faceLms && tMs - lastFaceT < 200) lms = blendEars(lms, virtualEars(faceLms, W, H));
      if (++driftN % 30 === 0 && rawLms) {                   // ~1 Hz
        if (refSig === undefined) refSig = loadReferenceSignature();
        const box = bboxFromPose(rawLms, 1, 1);
        if (refSig && box) {
          const cam = calib?.camera;
          const focal = cam && cam.width === W && cam.focal_source !== "estimated" ? cam.focal_px : focalFromHfov(W);
          const cur = captureSignature(video, box, bg);
          if (cur) drift = cameraChange(refSig, cur, focal, W);
        }
      }
      return lms;
    },
    /**
     * @param {HTMLVideoElement} video
     * @param {Array} pose   smoothed pose landmarks (normalised)
     * @param {number} W, H  frame size in px
     * @param {number} tMs   performance.now()
     * @param {number|null} score current overall score (for exposure)
     */
    process(video, pose, W, H, tMs, score = null) {
      detectFace(video, W, H, tMs);             // no-op if fuse() already ran this frame
      const faceFresh = tMs - lastFaceT < 500;
      const neutral = calib?.head_pose_neutral?.pitch ?? 0;
      const pitchRel = faceFresh && head ? HEAD_PITCH_SIGN * (head.pitch - neutral) : null;
      // bench-learned correction (calib.correction = correction.json) when one exists for this target
      const flexCorr = pitchRel == null ? null : applyCorrection(calib?.correction, "head_flexion_deg", { pitch_rel: pitchRel });
      const headFlexion = pitchRel == null ? null : Math.round((flexCorr ?? pitchRel) * 10) / 10;
      const distSource = calib?.camera?.focal_source && calib.camera.focal_source !== "estimated" ? "calibrated" : "estimated";
      // forward head (cm) vs the calibrated neutral — needs the same camera resolution
      let protractionCm = null;
      const cam = calib?.camera;
      if (faceFresh && cam && cam.width === W && cam.height === H && calib.iris_px_neutral && calib.shoulder_px_neutral) {
        const focal = cam.focal_source !== "estimated" ? cam.focal_px : focalFromHfov(W);
        const p = headProtractionCm({ headDistCm: distCm, shoulderPx: shoulderWidthPx(pose, W, H),
          neutralHeadDistCm: distanceFromIris(calib.iris_px_neutral, focal), neutralShoulderPx: calib.shoulder_px_neutral });
        if (p != null) protractionCm = Math.round((applyCorrection(calib?.correction, "protraction_cm", { prot: p }) ?? p) * 10) / 10;
      }
      const sample = { headFlexion, distCm: faceFresh ? distCm : NaN, score };
      const exp = exposure.update(tMs, sample);
      return {
        faceModel: face ? "on" : failed ? "off" : "loading",
        head: faceFresh ? head : null,
        headFlexion,
        corrected: !!calib?.correction?.targets && Object.keys(calib.correction.targets).length > 0,
        protractionCm,
        neckLoadKg: headFlexion == null ? null : neckLoadKg(headFlexion),
        irisPx: faceFresh ? irisPx : NaN,
        distCm: faceFresh && Number.isFinite(distCm) ? Math.round(distCm) : null,
        distSource,
        confidence: readingConfidence({ pose, faceFresh, calibScore: calib?.calib_quality?.score, disagreement }),
        models: 1 + (face ? 1 : 0) + (rtmwState === "on" ? 1 : 0),
        rtmw: { state: rtmwState, reason: rtmwReason, progress: Math.round(rtmwProgress * 100), ms: rtmwMs == null ? null : Math.round(rtmwMs),
                ep: rtmw?.ep ?? null, benchMs: rtmw?.benchMs == null ? null : Math.round(rtmw.benchMs) },
        agreement: disagreement == null ? null : Math.max(0, Math.round(100 * (1 - disagreement / 0.25))),
        exposure: exp,
        posture: postureSM.update(tMs, score).state,
        camera: drift && drift.ok ? { pitch: Math.round(drift.pitch * 10) / 10, roll: Math.round(drift.roll * 10) / 10,
          moved: Math.abs(drift.pitch) > 3 || Math.abs(drift.roll) > 2 } : null,
      };
    },
    resetExposure() { exposure.reset(); },
    close() { closed = true; try { face?.close(); } catch { /* ignore */ } face = null; rtmw?.close(); rtmw = null; },
  };
}
