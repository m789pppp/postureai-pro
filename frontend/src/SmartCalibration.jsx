/**
 * SmartCalibration.jsx — guided, self-checking posture calibration (v2).
 *
 * Drop-in replacement for the old CalibrationWizard: same props
 * ({ uid, onDone, onSkip, cs, lang }) and the same result fields the engine
 * already reads (tolerances, offsets, distCalibFactor, knownDistCm, …), plus:
 *   - live framing checklist + silhouette; capture starts by itself when all green
 *   - same camera resolution (1280×720) and pose model (full) as the live engine,
 *     so the baseline is measured exactly the way it will be used
 *   - Face Landmarker: 3-D head pose + iris-based distance
 *   - only "good" frames are kept; robust (median/MAD) baseline instead of a plain mean
 *   - a 0–100 calibration quality score the user can see
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { saveCalibration } from "./firebase.js";
import { useBodyScrollLock } from "./lib/useBodyScrollLock.js";
import {
  framingChecks, poseMotion, irisDiameterPx, headPoseFromMatrix, focalFromHfov,
  focalFromKnownDistance, distanceFromIris, robustMean, median, calibrationQuality,
  DIST_RANGE_CM,
} from "./features/analysis/calibrationCore.js";
import { captureSignature, saveReferenceSignature } from "./features/analysis/cameraDrift.js";
import { bboxFromPose } from "./features/analysis/rtmwCore.js";

// runtime + models: self-hosted first, CDN second; CPU delegate where WebGL is software
import { loadVision, createTask, MP_SOURCES } from "./features/analysis/mediapipeLoader.js";

const CAPTURE_MS = 3000;       // seconds of *good* (all-green) time we measure
const TARGET_FRAMES = 30;      // frames expected in that time even on a slow CPU-only laptop
const READY_HOLD_MS = 1200;    // all checks green this long → capture starts
const MAX_CAPTURE_MS = 15000;
const MIN_FRAMES = 10;
const FOCAL_KEY = "posmoz_camera_focal_v1";

const LM = { NOSE: 0, L_EYE: 2, R_EYE: 5, L_EAR: 7, R_EAR: 8, L_SHOULDER: 11, R_SHOULDER: 12 };

// ── angle helpers — identical to the legacy wizard / postureEngine.js ─────────
const angleV = (p1, p2) => { const dx = Math.abs(p2.x - p1.x), dy = Math.abs(p2.y - p1.y); return dy < 0.001 ? 90 : Math.abs(Math.atan2(dx, dy) * 180 / Math.PI); };
const angleH = (p1, p2) => { const dx = Math.abs(p2.x - p1.x), dy = Math.abs(p2.y - p1.y); return dx < 0.001 ? 90 : Math.abs(Math.atan2(dy, dx) * 180 / Math.PI); };
const angleV_signed = (p1, p2) => { const dx = p2.x - p1.x, dy = Math.abs(p2.y - p1.y); return dy < 0.001 ? 0 : (Math.atan2(Math.abs(dx), dy) * 180 / Math.PI) * Math.sign(dx); };
const angleH_signed = (p1, p2) => { const dx = Math.abs(p2.x - p1.x), dy = p2.y - p1.y; return dx < 0.001 ? 0 : (Math.atan2(Math.abs(dy), dx) * 180 / Math.PI) * Math.sign(dy); };
function neckRefPoint(nose, midEar, noseVis) {   // MUST match postureEngine.js analyzeNeckLean
  const nw = (noseVis ?? 0) > 0.7 ? 0.15 : 0.0, ew = 1 - nw;
  return { point: { x: nose.x * nw + midEar.x * ew, y: nose.y * nw + midEar.y * ew }, correction: 5.0 * nw };
}
const r1 = v => Math.round(v * 10) / 10;

function loadFocal(camKey) {
  try { return JSON.parse(localStorage.getItem(FOCAL_KEY) || "{}")[camKey] || null; } catch { return null; }
}
function storeFocal(camKey, focalPx) {
  try {
    const all = JSON.parse(localStorage.getItem(FOCAL_KEY) || "{}");
    all[camKey] = { focalPx, at: new Date().toISOString() };
    localStorage.setItem(FOCAL_KEY, JSON.stringify(all));
  } catch { /* storage blocked — fine */ }
}

const TXT = {
  en: {
    title: "Smart Calibration", sub: "Measures your neutral posture — about 10 seconds",
    intro: ["Sit upright the way you want to sit while working", "Laptop at its usual spot, screen tilted toward you", "Good light in front of you, not behind"],
    start: "Start", skip: "Skip for now", loading: "Loading AI models…",
    setup: "Get into position", setupSub: "Capture starts automatically when everything is green",
    capture: "Hold still — measuring", paused: "Paused — ", readyMsg: "Perfect — hold still",
    done: "Calibration complete", finish: "Start analysis →", retry: "Recalibrate",
    distLabel: "Measured distance eyes → screen (optional, cm)",
    distHint: "Measure once with a tape for high-precision distance on this camera.",
    checks: { person: "Only you", centered: "Centered", headroom: "Head height", distance: "Distance", facing: "Facing camera", lighting: "Lighting", still: "Still" },
    hints: {
      person: "Make sure only you are in view, head and shoulders visible",
      centeredL: "Move a little to your left", centeredR: "Move a little to your right",
      headroomHigh: "Tilt the screen back a bit — your eyes are too high in the frame",
      headroomLow: "Tilt the screen forward a bit — your head is too low",
      far: "Come a little closer", near: "Move back a little",
      facing: "Look straight at the camera", dark: "Add light in front of you", bright: "Avoid strong light behind you",
      still: "Hold still for a moment",
    },
    quality: "Calibration quality", grade: { high: "High precision", good: "Good", low: "Low — recalibrate recommended" },
    reasons: { few_frames: "Not enough steady frames", movement: "You moved during measurement", outliers: "Some frames were unstable",
               distance_estimated: "Distance estimated (add a measured distance for higher precision)", no_face_model: "Face model unavailable — head pose estimated" },
    distEst: "estimated", distMeas: "measured", cam: "camera",
    labels: { neck: "Neck", tilt: "Head tilt", shoulder: "Shoulders", spine: "Spine", head: "Head pitch", dist: "Distance" },
    errCam: "Camera access denied. Please allow the camera and try again.",
    errModel: "Couldn't load the AI models. Check your internet connection and try again.",
    errFrames: "Couldn't get enough steady frames. Check the list below and try again.",
    warnNeck: "Neck was leaning during calibration — sit taller and recalibrate.",
    warnTilt: "Head was tilted — check chair and monitor height.",
    warnSpine: "Back was leaning — sit against the backrest and recalibrate.",
    warnTitle: "Notes on your calibration posture",
  },
  ar: {
    title: "المعايرة الذكية", sub: "بتقيس وضعك الطبيعي — حوالي ١٠ ثواني",
    intro: ["اقعد مستقيم بالشكل اللي عايز تشتغل بيه", "اللابتوب في مكانه المعتاد والشاشة مايلة ناحيتك", "خلي النور قدامك مش وراك"],
    start: "ابدأ", skip: "تخطي دلوقتي", loading: "جاري تحميل موديلات الذكاء الاصطناعي…",
    setup: "اظبط مكانك", setupSub: "التصوير هيبدأ لوحده لما كل حاجة تبقى خضرا",
    capture: "اثبت — جاري القياس", paused: "متوقف — ", readyMsg: "تمام — اثبت كده",
    done: "المعايرة خلصت", finish: "ابدأ التحليل ←", retry: "أعد المعايرة",
    distLabel: "المسافة المقاسة من عينك للشاشة (اختياري، سم)",
    distHint: "قيسها مرة واحدة بالمتر عشان دقة عالية للمسافة على الكاميرا دي.",
    checks: { person: "إنت بس", centered: "في النص", headroom: "ارتفاع الراس", distance: "المسافة", facing: "باصص للكاميرا", lighting: "الإضاءة", still: "ثابت" },
    hints: {
      person: "اتأكد إنك لوحدك في الصورة وراسك وكتفك باينين",
      centeredL: "اتحرك شوية ناحية شمالك", centeredR: "اتحرك شوية ناحية يمينك",
      headroomHigh: "ميّل الشاشة لورا شوية — عينك عالية في الصورة",
      headroomLow: "ميّل الشاشة لقدام شوية — راسك واطية",
      far: "قرّب شوية", near: "ارجع لورا شوية",
      facing: "بص للكاميرا على طول", dark: "زوّد النور اللي قدامك", bright: "ابعد عن النور القوي اللي وراك",
      still: "اثبت لحظة",
    },
    quality: "جودة المعايرة", grade: { high: "دقة عالية", good: "كويسة", low: "ضعيفة — يُفضّل تعيدها" },
    reasons: { few_frames: "اللقطات الثابتة مش كفاية", movement: "اتحركت أثناء القياس", outliers: "فيه لقطات مش مستقرة",
               distance_estimated: "المسافة تقديرية (اكتب مسافة مقاسة لدقة أعلى)", no_face_model: "موديل الوش مش متاح — ميل الراس تقديري" },
    distEst: "تقديرية", distMeas: "مقاسة", cam: "الكاميرا",
    labels: { neck: "الرقبة", tilt: "ميل الراس", shoulder: "الكتفين", spine: "الضهر", head: "انحناء الراس", dist: "المسافة" },
    errCam: "الكاميرا مرفوضة. اسمح بالكاميرا وجرّب تاني.",
    errModel: "ما قدرتش أحمّل موديلات الذكاء الاصطناعي. اتأكد من النت وجرّب تاني.",
    errFrames: "ما قدرتش آخد لقطات ثابتة كفاية. بص على القايمة تحت وجرّب تاني.",
    warnNeck: "رقبتك كانت مايلة وقت المعايرة — اقعد أطول وأعدها.",
    warnTilt: "راسك كانت مايلة — راجع ارتفاع الكرسي والشاشة.",
    warnSpine: "ضهرك كان مايل — اسند على الكرسي وأعد المعايرة.",
    warnTitle: "ملاحظات على وضعك وقت المعايرة",
  },
};

export function CalibrationWizard({ uid, onDone, onSkip, cs, lang = "en" }) {
  useBodyScrollLock();
  const t = TXT[lang] || TXT.en;
  const isAr = lang === "ar";
  const C = cs || { bg: "#0d1a2e", card: "#05101f", border: "rgba(148,163,184,.1)", text: "#f0f4f8", muted: "#7b8aa3", blue: "#1a56db" };

  const [step, setStep] = useState("intro");           // intro | setup | capture | done
  const [modelsReady, setModelsReady] = useState(false);
  const [checks, setChecks] = useState(null);
  const [live, setLive] = useState({ distCm: NaN, distSource: "estimated" });
  const [progress, setProgress] = useState(0);
  const [knownDistanceCm, setKnownDistanceCm] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const videoRef = useRef(null), canvasRef = useRef(null), lumaCanvas = useRef(null);
  const streamRef = useRef(null), poseRef = useRef(null), faceRef = useRef(null), rafRef = useRef(null);
  const stepRef = useRef(step); stepRef.current = step;
  const st = useRef({});                                // mutable loop state

  useEffect(() => {
    const h = e => { if (e.key === "Escape") onSkip?.(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onSkip]);

  const stopAll = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach(tr => tr.stop());
    streamRef.current = null;
    try { poseRef.current?.close(); } catch { /* already closed */ }
    try { faceRef.current?.close(); } catch { /* already closed */ }
    poseRef.current = null; faceRef.current = null;
  }, []);
  useEffect(() => () => stopAll(), [stopAll]);

  // ── finish: robust baseline from the good frames ──────────────────────────
  const finish = useCallback(async () => {
    const s = st.current;
    const frames = s.frames || [];
    if (frames.length < MIN_FRAMES) {
      setError(t.errFrames); s.frames = []; s.readySince = null; setProgress(0); setStep("setup");
      return;
    }
    const { W, H } = s;
    const series = { neck: [], tilt: [], shoulder: [], spine: [], neck_s: [], tilt_s: [], shoulder_s: [], spine_s: [], rounded: [], ipd: [], swpx: [], noseDrop: [], trunk: [], torso: [] };
    frames.forEach(({ pose: q }) => {
      const P = i => ({ x: (q[i]?.x ?? 0) * W, y: (q[i]?.y ?? 0) * H });
      const lSh = P(11), rSh = P(12), lEar = P(7), rEar = P(8), lEye = P(2), rEye = P(5), lHip = P(23), rHip = P(24);
      const nose = P(0);
      const midSh = { x: (lSh.x + rSh.x) / 2, y: (lSh.y + rSh.y) / 2 };
      const midEar = { x: (lEar.x + rEar.x) / 2, y: (lEar.y + rEar.y) / 2 };
      const midHip = { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2 };
      const { point: neckRef, correction } = neckRefPoint(nose, midEar, q[0]?.visibility);
      series.neck.push(Math.max(0, angleV(midSh, neckRef) - correction));
      series.tilt.push(angleH(lEye, rEye));
      series.shoulder.push(angleH(lSh, rSh));
      series.spine.push(angleV(midHip, midSh));
      series.neck_s.push(angleV_signed(midSh, neckRef));
      series.tilt_s.push(angleH_signed(lEye, rEye));
      series.shoulder_s.push(angleH_signed(lSh, rSh));
      series.spine_s.push(angleV_signed(midHip, midSh));
      const shW = Math.abs(rSh.x - lSh.x);
      if (shW > 1) series.rounded.push((midSh.y - midEar.y) / shW);
      series.swpx.push(Math.hypot(lSh.x - rSh.x, lSh.y - rSh.y));   // neutral shoulder width (forward-head model)
      if ((q[2]?.visibility ?? 1) > 0.5 && (q[5]?.visibility ?? 1) > 0.5) series.ipd.push(Math.abs(q[5].x - q[2].x));
      // Same neutral ratios the legacy wizard captures (postureEngine reads them):
      // nose-below-eyeline / eye span, shoulder width / IPD, shoulder-hip span / shoulder width.
      const eyeSpanPx = Math.abs(rEye.x - lEye.x);
      if (eyeSpanPx > 2 && (q[0]?.visibility ?? 0) > 0.5) series.noseDrop.push((nose.y - (lEye.y + rEye.y) / 2) / eyeSpanPx);
      if (eyeSpanPx > 2 && shW > 1) series.trunk.push(shW / eyeSpanPx);
      if (shW > 1 && (q[23]?.visibility ?? 0) > 0.5 && (q[24]?.visibility ?? 0) > 0.5) {
        const torsoPx = midHip.y - midSh.y;
        if (torsoPx > 0) series.torso.push(torsoPx / shW);
      }
    });
    const R = {}; let rejected = 0, total = 0;
    for (const k of Object.keys(series)) { R[k] = robustMean(series[k]); rejected += R[k].rejected; total += R[k].kept + R[k].rejected; }

    const heads = frames.map(f => f.head).filter(Boolean);
    const irises = frames.map(f => f.irisPx).filter(v => v > 1);
    const irisPx = median(irises);
    const known = parseFloat(knownDistanceCm);
    const distanceMeasured = known >= 20 && known <= 150;
    let focal = s.focal, focalSource = s.focalSource;
    if (distanceMeasured && irisPx > 1) {
      focal = focalFromKnownDistance(irisPx, known); focalSource = "measured";
      storeFocal(s.camKey, focal);
    }
    const distNow = distanceMeasured ? known : distanceFromIris(irisPx, focal);

    const baseline = {
      neck_angle: r1(R.neck.value), head_tilt: r1(R.tilt.value),
      shoulder_tilt: r1(R.shoulder.value), spine_angle: r1(R.spine.value),
      frames_used: frames.length, calibrated_at: new Date().toISOString(),
    };
    const warnings = [];
    if (baseline.neck_angle > 18) warnings.push(t.warnNeck);
    if (baseline.head_tilt > 8) warnings.push(t.warnTilt);
    if (baseline.spine_angle > 15) warnings.push(t.warnSpine);
    if (warnings.length) baseline.quality_warnings = warnings;

    const tol = (base, ok, bad) => ({ ideal: base, ok: Math.max(ok, Math.abs(base) * 0.3 + ok * 0.5), bad: Math.max(bad, Math.abs(base) * 0.5 + bad * 0.5) });
    const quality = calibrationQuality({
      validFrames: frames.length, targetFrames: TARGET_FRAMES,
      spreads: { neck: R.neck.spread, tilt: R.tilt.spread, shoulder: R.shoulder.spread, spine: R.spine.spread },
      distanceMeasured: distanceMeasured || focalSource === "stored", faceTracked: heads.length >= frames.length * 0.6,
      rejectedRatio: total ? rejected / total : 0,
    });

    const calib = {
      ...baseline,
      tolerances: {
        neck_angle: tol(baseline.neck_angle, 7, 20), head_tilt: tol(baseline.head_tilt, 3, 10),
        shoulder_tilt: tol(baseline.shoulder_tilt, 3, 10), spine_angle: tol(baseline.spine_angle, 5, 15),
      },
      offsets: { neck_angle: r1(R.neck_s.value), head_tilt: r1(R.tilt_s.value), shoulder_tilt: r1(R.shoulder_s.value), spine_angle: r1(R.spine_s.value) },
      asymmetric_correction: true,
      ...(R.rounded.kept >= 5 ? { rounded_neutral: Math.round(R.rounded.value * 1000) / 1000 } : {}),
      ...(R.noseDrop.kept >= 5 ? { nose_drop_neutral: Math.round(R.noseDrop.value * 1000) / 1000 } : {}),
      ...(R.trunk.kept    >= 5 ? { trunk_ratio_neutral: Math.round(R.trunk.value * 1000) / 1000 } : {}),
      ...(R.torso.kept    >= 5 ? { torso_ratio_neutral: Math.round(R.torso.value * 1000) / 1000 } : {}),
      // v2 additions (ignored by older engine code)
      calib_version: 2,
      calib_quality: quality,
      spreads_deg: { neck: r1(R.neck.spread), tilt: r1(R.tilt.spread), shoulder: r1(R.shoulder.spread), spine: r1(R.spine.spread) },
      camera: { width: W, height: H, focal_px: Math.round(focal), focal_source: focalSource },
      ...(irisPx > 1 ? { iris_px_neutral: r1(irisPx), iris_frac_neutral: Math.round((irisPx / W) * 1e5) / 1e5 } : {}),
      ...(R.swpx.kept >= 3 ? { shoulder_px_neutral: r1(R.swpx.value) } : {}),
      ...(heads.length ? { head_pose_neutral: {
        pitch: r1(median(heads.map(h => h.pitch))), yaw: r1(median(heads.map(h => h.yaw))), roll: r1(median(heads.map(h => h.roll))) } } : {}),
    };
    // Same distance contract the engine already uses: distCm = distCalibFactor / ipdFraction.
    // Written when the distance is measured now, or when this camera was measured before.
    const ipdFrac = R.ipd.value;
    if (Number.isFinite(distNow) && ipdFrac > 0 && (distanceMeasured || focalSource === "stored")) {
      calib.distance_calibrated_cm = Math.round(distNow);
      calib.distance_source = distanceMeasured ? "measured" : "iris_stored_camera";
      calib.distCalibFactor = Math.round(distNow * ipdFrac * 1e5) / 1e5;
      calib.knownDistCm = Math.round(distNow);
    } else if (Number.isFinite(distNow)) {
      calib.distance_estimate_cm = Math.round(distNow);   // shown, not used for scoring
    }

    // background signature for "camera moved since calibration" — kept on this device only
    try {
      const last = frames[frames.length - 1]?.pose;
      const box = last && bboxFromPose(last, 1, 1);
      const sig = box && videoRef.current && captureSignature(videoRef.current, box, {});
      if (sig) saveReferenceSignature(sig, { at: calib.calibrated_at, W, H });
    } catch { /* optional */ }
    stopAll();
    setResult(calib);
    setStep("done");
    if (uid) { try { await saveCalibration(uid, calib); } catch (e) { console.warn("Calibration save:", e); } }
    try { localStorage.setItem("posture_calibration", JSON.stringify(calib)); } catch { /* ignore */ }
  }, [knownDistanceCm, stopAll, t, uid]);
  const finishRef = useRef(finish); finishRef.current = finish;   // loop always calls the latest

  // ── camera + models + loop (one load for setup and capture) ───────────────
  const running = step === "setup" || step === "capture";
  useEffect(() => {
    if (!running || rafRef.current) return;
    let destroyed = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: { ideal: "user" } }, audio: false });
        if (destroyed) { stream.getTracks().forEach(tr => tr.stop()); return; }
        streamRef.current = stream;
        const v = videoRef.current; v.srcObject = stream; await v.play();
        const set = stream.getVideoTracks()[0]?.getSettings?.() || {};
        st.current.camKey = `${set.deviceId || "default"}@${v.videoWidth}x${v.videoHeight}`;
      } catch { setError(t.errCam); return; }

      const { mod, fileset: fr, source } = await loadVision();
      const urls = k => [...new Set([source[k], ...MP_SOURCES.map(m => m[k])])];
      const make = async (Cls, model, extra) => (await createTask(Cls, fr, model, { runningMode: "VIDEO", ...extra })).task;
      const POSE_MODEL = urls("pose"), FACE_MODEL = urls("face");
      poseRef.current = await make(mod.PoseLandmarker, POSE_MODEL, {
        numPoses: 2, minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5 });
      try {
        faceRef.current = await make(mod.FaceLandmarker, FACE_MODEL, {
          numFaces: 1, outputFacialTransformationMatrixes: true, outputFaceBlendshapes: false });
      } catch (e) { console.warn("Face landmarker unavailable:", e?.message); faceRef.current = null; }
      if (destroyed) return;

      const v = videoRef.current;
      const s = st.current;
      Object.assign(s, { W: v.videoWidth, H: v.videoHeight, frames: [], readySince: null, captureStart: null,
        prev: null, prevT: null, motion: NaN, luma: NaN, head: null, irisPx: NaN, n: 0 });
      const stored = loadFocal(s.camKey);
      s.focal = stored?.focalPx || focalFromHfov(s.W);
      s.focalSource = stored ? "stored" : "estimated";
      setModelsReady(true);

      const tick = () => {
        if (destroyed) return;
        rafRef.current = requestAnimationFrame(tick);
        if (v.readyState < 2) return;
        const now = performance.now();
        s.n++;
        let pose = null, people = 0;
        try {
          const res = poseRef.current.detectForVideo(v, now);
          people = res.landmarks?.length || 0; pose = res.landmarks?.[0] || null;
        } catch { return; }
        if (faceRef.current && s.n % 2 === 0) {
          try {
            const fres = faceRef.current.detectForVideo(v, now);
            const face = fres.faceLandmarks?.[0];
            s.head = fres.facialTransformationMatrixes?.[0] ? headPoseFromMatrix(fres.facialTransformationMatrixes[0].data) : null;
            const ip = irisDiameterPx(face, s.W, s.H);
            s.irisPx = Number.isFinite(ip) ? (Number.isFinite(s.irisPx) ? s.irisPx * 0.7 + ip * 0.3 : ip) : NaN;
          } catch { /* keep last */ }
        }
        if (s.n % 15 === 0) s.luma = frameLuma(v, lumaCanvas);
        const dtMs = s.prevT ? now - s.prevT : 0;
        if (pose && s.prev) {
          const m = poseMotion(s.prev, pose, (now - s.prevT) / 1000);
          s.motion = Number.isFinite(s.motion) ? s.motion * 0.8 + m * 0.2 : m;
        }
        s.prev = pose; s.prevT = now;
        const distCm = distanceFromIris(s.irisPx, s.focal);
        const ch = framingChecks({ pose, people, head: s.head, distCm, luma: s.luma, motion: s.motion });

        const mode = stepRef.current;
        if (mode === "setup") {
          s.readySince = ch.ready ? (s.readySince ?? now) : null;
          if (s.readySince && now - s.readySince > READY_HOLD_MS) {
            s.frames = []; s.readyMs = 0; s.captureStart = now; setError(""); setStep("capture");
          }
        } else if (mode === "capture") {
          if (ch.ready) {
            s.frames.push({ pose: pose.map(p => ({ x: p.x, y: p.y, z: p.z, visibility: p.visibility })), head: s.head, irisPx: s.irisPx });
            s.readyMs += Math.min(dtMs, 500);   // a stalled frame can't count as a long steady stretch (≥2 fps devices)
          }
          const p = Math.min(1, s.readyMs / CAPTURE_MS);
          setProgress(p);
          if ((p >= 1 && s.frames.length >= MIN_FRAMES) || now - s.captureStart > MAX_CAPTURE_MS) { cancelAnimationFrame(rafRef.current); rafRef.current = null; finishRef.current(); return; }
        }
        if (s.n % 4 === 0) {
          setChecks(ch);
          setLive({ distCm, distSource: s.focalSource });
        }
        draw(canvasRef.current, pose, s.W, s.H, ch.ready, mode === "capture" ? Math.min(1, s.readyMs / CAPTURE_MS) : null);
      };
      rafRef.current = requestAnimationFrame(tick);
    })().catch(e => { console.warn("Calibration init failed:", e); setError(t.errModel); });
    return () => { destroyed = true; };
    // the loop reads step through stepRef — it must not restart when step changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  // ── UI pieces ──────────────────────────────────────────────────────────────
  const hintFor = (key, value) => {
    const h = t.hints;
    if (key === "centered") return value < 0.5 ? h.centeredL : h.centeredR;
    if (key === "headroom") return value < 0.18 ? h.headroomHigh : h.headroomLow;
    if (key === "distance") {
      if (Number.isFinite(value) && value > 1) return value > DIST_RANGE_CM[1] ? h.far : h.near;
      return value < 0.22 ? h.far : h.near;
    }
    if (key === "lighting") return value < 55 ? h.dark : h.bright;
    return h[key];
  };
  const firstHint = checks && !checks.ready ? hintFor(checks.firstFail, checks.items.find(i => i.key === checks.firstFail)?.value) : null;
  const btn = (bg, color = "white") => ({ background: bg, border: "none", borderRadius: 10, padding: "12px 0", fontSize: 13, fontWeight: 600, color, cursor: "pointer" });

  return (
    <div dir={isAr ? "rtl" : "ltr"} style={{ position: "fixed", inset: 0, background: "rgba(2,6,23,.72)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9000 }}
      onClick={e => { if (e.target === e.currentTarget) onSkip?.(); }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 22, padding: "26px 24px", width: "min(760px, 96vw)", maxHeight: "94vh", overflowY: "auto", boxShadow: "0 30px 80px rgba(0,0,0,.45)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg,#1a56db,#10b981)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
            {step === "done" ? "✓" : "◎"}
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.text }}>{t.title}</div>
            <div style={{ fontSize: 12, color: C.muted }}>{step === "setup" ? t.setupSub : t.sub}</div>
          </div>
        </div>

        {step === "intro" && (
          <>
            <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
              {t.intro.map((tip, i) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "center", background: "rgba(26,86,219,.07)", border: "1px solid rgba(26,86,219,.18)", borderRadius: 12, padding: "12px 14px" }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#1a56db", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ fontSize: 13, color: C.text }}>{tip}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={onSkip} style={{ ...btn("none", C.muted), flex: 1, border: `1px solid ${C.border}` }}>{t.skip}</button>
              <button onClick={() => setStep("setup")} style={{ ...btn("#1a56db"), flex: 2 }}>{t.start}</button>
            </div>
          </>
        )}

        {(step === "setup" || step === "capture") && (
          <>
            <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", background: "#000", aspectRatio: "16/9", marginBottom: 12 }}>
              <video ref={videoRef} playsInline muted autoPlay style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
              <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", transform: "scaleX(-1)" }} />
              {!modelsReady && !error && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 13, background: "rgba(0,0,0,.45)" }}>{t.loading}</div>
              )}
              {modelsReady && (
                <div style={{ position: "absolute", top: 10, insetInlineStart: 10, background: "rgba(0,0,0,.6)", color: "white", fontSize: 12, padding: "5px 10px", borderRadius: 99 }}>
                  📏 <bdi dir="ltr">{Number.isFinite(live.distCm) ? `~${Math.round(live.distCm)} cm` : "—"}</bdi> · {live.distSource === "estimated" ? t.distEst : t.distMeas}
                </div>
              )}
              {modelsReady && (
                <div style={{ position: "absolute", bottom: 12, left: 0, right: 0, textAlign: "center" }}>
                  <span style={{ background: checks?.ready ? "rgba(16,185,129,.92)" : "rgba(15,23,42,.82)", color: "white", fontSize: 13, fontWeight: 600, padding: "7px 16px", borderRadius: 99 }}>
                    {step === "capture"
                      ? (checks?.ready ? `${t.capture} · ${Math.round(progress * 100)}%` : `${t.paused}${firstHint || ""}`)
                      : (checks?.ready ? `✓ ${t.readyMsg}` : firstHint || t.setup)}
                  </span>
                </div>
              )}
            </div>
            {checks && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(100px,1fr))", gap: 6, marginBottom: 12 }}>
                {checks.items.map(it => (
                  <div key={it.key} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 9px", borderRadius: 9, fontSize: 11.5,
                    background: it.ok ? "rgba(16,185,129,.1)" : "rgba(245,158,11,.1)", border: `1px solid ${it.ok ? "rgba(16,185,129,.35)" : "rgba(245,158,11,.35)"}`,
                    color: it.ok ? "#10b981" : "#f59e0b", transition: "all .25s" }}>
                    <span>{it.ok ? "●" : "○"}</span><span style={{ color: C.text }}>{t.checks[it.key]}</span>
                  </div>
                ))}
              </div>
            )}
            {step === "setup" && (
              <div style={{ marginBottom: 8 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 4 }}>{t.distLabel}</label>
                <input type="number" inputMode="decimal" min="20" max="150" value={knownDistanceCm} placeholder="55"
                  onChange={e => setKnownDistanceCm(e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box", background: "rgba(148,163,184,.08)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 12px", fontSize: 14, color: C.text }} />
                <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{t.distHint}</div>
              </div>
            )}
            {error && <div style={{ color: "#ef4444", fontSize: 12, margin: "8px 0", textAlign: "center" }}>{error}</div>}
            <button onClick={() => { stopAll(); onSkip?.(); }} style={{ ...btn("none", C.muted), width: "100%", fontSize: 11, padding: 6 }}>{t.skip}</button>
          </>
        )}

        {step === "done" && result && (
          <>
            <QualityBanner q={result.calib_quality} t={t} C={C} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8, margin: "14px 0" }}>
              {[[t.labels.neck, result.neck_angle, 5, 12], [t.labels.tilt, result.head_tilt, 3, 8],
                [t.labels.shoulder, result.shoulder_tilt, 3, 8], [t.labels.spine, result.spine_angle, 5, 12]].map(([label, val, ok, warn]) => {
                const a = Math.abs(val || 0), col = a <= ok ? "#10b981" : a <= warn ? "#f59e0b" : "#ef4444";
                return (
                  <div key={label} style={{ background: `${col}12`, border: `1px solid ${col}40`, borderRadius: 11, padding: "10px 12px" }}>
                    <div style={{ fontSize: 11, color: C.muted }}>{label}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: col }}>{val}°</div>
                  </div>
                );
              })}
              {result.head_pose_neutral && (
                <div style={{ background: "rgba(26,86,219,.08)", border: "1px solid rgba(26,86,219,.25)", borderRadius: 11, padding: "10px 12px" }}>
                  <div style={{ fontSize: 11, color: C.muted }}>{t.labels.head}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>{result.head_pose_neutral.pitch}°</div>
                </div>
              )}
              {(result.distance_calibrated_cm || result.distance_estimate_cm) && (
                <div style={{ background: "rgba(26,86,219,.08)", border: "1px solid rgba(26,86,219,.25)", borderRadius: 11, padding: "10px 12px" }}>
                  <div style={{ fontSize: 11, color: C.muted }}>{t.labels.dist} · {result.distance_calibrated_cm ? t.distMeas : t.distEst}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>{result.distance_calibrated_cm || result.distance_estimate_cm} cm</div>
                </div>
              )}
            </div>
            {result.quality_warnings?.length > 0 && (
              <div style={{ background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.3)", borderRadius: 11, padding: "10px 14px", marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", marginBottom: 6 }}>{t.warnTitle}</div>
                {result.quality_warnings.map((w, i) => <div key={i} style={{ fontSize: 12, color: "#fbbf24", lineHeight: 1.6 }}>• {w}</div>)}
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setResult(null); setProgress(0); setChecks(null); setModelsReady(false); setStep("setup"); }}
                style={{ ...btn("none", C.text), flex: 1, border: `1px solid ${C.border}` }}>{t.retry}</button>
              <button onClick={() => onDone(result)} style={{ ...btn("#10b981"), flex: 2 }}>{t.finish}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function QualityBanner({ q, t, C }) {
  if (!q) return null;
  const col = q.grade === "high" ? "#10b981" : q.grade === "good" ? "#3b82f6" : "#f59e0b";
  const R = 26, L = 2 * Math.PI * R;
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "center", background: `${col}10`, border: `1px solid ${col}40`, borderRadius: 14, padding: "12px 14px" }}>
      <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r={R} fill="none" stroke="rgba(148,163,184,.2)" strokeWidth="6" />
        <circle cx="32" cy="32" r={R} fill="none" stroke={col} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${(q.score / 100) * L} ${L}`} transform="rotate(-90 32 32)" />
        <text x="32" y="37" textAnchor="middle" fontSize="15" fontWeight="700" fill={col}>{q.score}</text>
      </svg>
      <div>
        <div style={{ fontSize: 11, color: C.muted }}>{t.quality}</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: col }}>{t.grade[q.grade]}</div>
        {q.reasons.map(r => <div key={r} style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>• {t.reasons[r]}</div>)}
      </div>
    </div>
  );
}

function frameLuma(video, ref) {
  try {
    if (!ref.current) { ref.current = document.createElement("canvas"); ref.current.width = 32; ref.current.height = 18; }
    const ctx = ref.current.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, 32, 18);
    const d = ctx.getImageData(0, 0, 32, 18).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    return sum / (d.length / 4);
  } catch { return NaN; }
}

function draw(canvas, pose, W, H, ready, progress) {
  if (!canvas || !W) return;
  if (canvas.width !== W) { canvas.width = W; canvas.height = H; }
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, W, H);
  const col = ready ? "#10b981" : "#f59e0b";
  // silhouette guide: head oval + shoulder line
  const hx = W / 2, hy = H * 0.36, rx = W * 0.075, ry = H * 0.16;
  ctx.save();
  ctx.lineWidth = Math.max(2, W / 400); ctx.setLineDash([10, 8]); ctx.strokeStyle = col; ctx.globalAlpha = 0.9;
  ctx.beginPath(); ctx.ellipse(hx, hy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(W * 0.25, H * 0.98);
  ctx.bezierCurveTo(W * 0.26, H * 0.72, W * 0.36, H * 0.66, hx - rx * 0.55, hy + ry * 1.05);
  ctx.moveTo(W * 0.75, H * 0.98);
  ctx.bezierCurveTo(W * 0.74, H * 0.72, W * 0.64, H * 0.66, hx + rx * 0.55, hy + ry * 1.05);
  ctx.stroke();
  ctx.setLineDash([]);
  if (progress != null) {
    ctx.lineWidth = Math.max(4, W / 220); ctx.strokeStyle = "#10b981"; ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.ellipse(hx, hy, rx + 10, ry + 10, 0, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2); ctx.stroke();
  }
  if (pose) {
    ctx.globalAlpha = 0.95; ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = Math.max(2, W / 500);
    const P = i => [pose[i].x * W, pose[i].y * H];
    const mid = (a, b) => [(pose[a].x + pose[b].x) / 2 * W, (pose[a].y + pose[b].y) / 2 * H];
    [[P(11), P(12)], [P(7), P(8)], [mid(7, 8), mid(11, 12)]].forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke(); });
    [0, 2, 5, 7, 8, 11, 12].forEach(i => { ctx.beginPath(); ctx.arc(...P(i), Math.max(4, W / 260), 0, Math.PI * 2); ctx.fill(); });
  }
  ctx.restore();
}

export default CalibrationWizard;
