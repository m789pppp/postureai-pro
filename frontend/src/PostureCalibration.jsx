import { useState, useEffect, useRef, useCallback } from "react";
import { saveCalibration, getCalibration } from "./firebase.js";

// ── Calibration constants ─────────────────────────────────────────
const CALIB_DURATION = 10; // seconds
const CALIB_FRAMES   = 30; // frames to average

// ── Helpers ───────────────────────────────────────────────────────
// Absolute angle (used for scoring thresholds)
const angleV = (p1, p2) => {
  const dx = Math.abs(p2.x - p1.x), dy = Math.abs(p2.y - p1.y);
  return dy < 0.001 ? 90 : Math.abs(Math.atan2(dx, dy) * 180 / Math.PI);
};
const angleH = (p1, p2) => {
  const dx = Math.abs(p2.x - p1.x), dy = Math.abs(p2.y - p1.y);
  return dx < 0.001 ? 90 : Math.abs(Math.atan2(dy, dx) * 180 / Math.PI);
};

// Signed angles — positive = right/forward, negative = left/back
// Used to detect DIRECTION of natural lean for asymmetric thresholds
const angleV_signed = (p1, p2) => {
  // positive = p2 is to the RIGHT of p1 (lean right)
  const dx = p2.x - p1.x, dy = Math.abs(p2.y - p1.y);
  return dy < 0.001 ? 0 : (Math.atan2(Math.abs(dx), dy) * 180 / Math.PI) * Math.sign(dx);
};
const angleH_signed = (p1, p2) => {
  // positive = p2 is BELOW p1 (right shoulder lower = right tilt)
  const dx = Math.abs(p2.x - p1.x), dy = p2.y - p1.y;
  return dx < 0.001 ? 0 : (Math.atan2(Math.abs(dy), dx) * 180 / Math.PI) * Math.sign(dy);
};

const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

// Nose+ear blended reference point for neck_lean — MUST exactly match
// the formula in postureEngine.js's analyzeMP(). Without this, the
// calibration baseline ("ideal" neck angle) is measured one way while
// the live engine measures neck_lean a different way, and the two
// never line up even when sitting in the exact calibrated posture.
function neckRefPoint(nose, midEar, noseVis) {
  const earWeight  = (noseVis ?? 1) > 0.7 ? 0.15 : 0.50;
  const noseWeight = 1 - earWeight;
  return {
    point: { x: nose.x * noseWeight + midEar.x * earWeight, y: nose.y * noseWeight + midEar.y * earWeight },
    correction: 5.0 * noseWeight,
  };
}

const LM = { NOSE:0, L_EYE:2, R_EYE:5, L_EAR:7, R_EAR:8, L_SHOULDER:11, R_SHOULDER:12, L_HIP:23, R_HIP:24 };

// ── CalibrationWizard ─────────────────────────────────────────────
export function CalibrationWizard({ uid, onDone, onSkip, cs, lang = "en" }) {
  // Close on Escape key anywhere
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onSkip?.(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onSkip]);
  const [step, setStep]       = useState("intro");   // intro | align | counting | done
  const [countdown, setCountdown] = useState(CALIB_DURATION);
  const [progress, setProgress]   = useState(0);
  const [frames, setFrames]       = useState([]);
  const [stream, setStream]       = useState(null);
  const [error, setError]         = useState("");
  const [result, setResult]       = useState(null);
  const [knownDistanceCm, setKnownDistanceCm] = useState("");

  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const mpRef     = useRef(null);
  const timerRef  = useRef(null);
  const frameRef  = useRef([]);

  const T = {
    en: {
      title:    "Personal Posture Calibration",
      sub:      "Takes 10 seconds — improves your accuracy by 15-20%",
      intro1:   "Sit in your ideal upright position",
      intro2:   "Keep your back straight, chin parallel to floor",
      intro3:   "Look directly at the camera",
      align:    "Position yourself in the frame",
      alignSub: "Make sure your head and shoulders are visible",
      counting: "Hold still — calibrating…",
      done:     "Calibration complete!",
      doneSub:  "Your personal baseline has been saved.",
      start:    "Start calibration",
      skip:     "Skip for now",
      retry:    "Try again",
      finish:   "Start analysis →",
      neckLabel:    "Neck baseline",
      tiltLabel:    "Head tilt baseline",
      shoulderLabel:"Shoulder baseline",
      spineLabel:   "Spine baseline",
      err_cam:  "Camera access denied. Please allow camera and reload.",
      err_pose: "Could not detect pose. Make sure you're visible in the frame.",
      distLabel: "Distance from screen right now (cm)",
      distHint:  "Measure with a ruler/tape for best accuracy — improves distance accuracy from ±15cm to ±3cm",
      distPlaceholder: "e.g. 55",
      distErr: "Enter your current distance from the screen to continue",
      distBadge: "Distance calibrated",
    },
    ar: {
      title:    "معايرة وضعية شخصية",
      sub:      "10 ثواني فقط — تحسّن دقتك بنسبة 15-20%",
      intro1:   "اقعد في وضعية مستقيمة مثالية",
      intro2:   "ظهرك مستقيم، ذقنك موازي للأرض",
      intro3:   "انظر مباشرة إلى الكاميرا",
      align:    "وضّع نفسك في الإطار",
      alignSub: "تأكد من ظهور رأسك وكتفيك",
      counting: "لا تتحرك — جاري المعايرة…",
      done:     "اكتملت المعايرة!",
      doneSub:  "تم حفظ baseline الشخصي.",
      start:    "بدء المعايرة",
      skip:     "تخطي الآن",
      retry:    "حاول مجدداً",
      finish:   "ابدأ التحليل →",
      neckLabel:    "خط الرقبة",
      tiltLabel:    "ميل الرأس",
      shoulderLabel:"الكتفين",
      spineLabel:   "العمود الفقري",
      err_cam:  "تم رفض الوصول للكاميرا. أعط الإذن وأعد التحميل.",
      err_pose: "تعذر رصد الوضعية. تأكد من ظهورك في الإطار.",
      distLabel: "المسافة من الشاشة دلوقتي (سم)",
      distHint:  "قيسها بشريط/مسطرة لأفضل دقة — بتحسّن دقة المسافة من ±15سم لـ ±3سم",
      distPlaceholder: "مثال: 55",
      distErr: "اكتب مسافتك الحالية من الشاشة عشان تكمل",
      distBadge: "المسافة معايرة",
    },
  };
  const t = T[lang] || T.en;

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" }, audio: false,
      });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        await videoRef.current.play();
      }
    } catch {
      setError(t.err_cam);
    }
  }, [t.err_cam]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (stream) { stream.getTracks().forEach(tr => tr.stop()); setStream(null); }
    if (timerRef.current) clearInterval(timerRef.current);
  }, [stream]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  // Load MediaPipe pose — tasks-vision@0.10.14 (same as main engine, not old window.Pose)
  useEffect(() => {
    if (step !== "align" && step !== "counting") return;
    startCamera();
    let pl = null;
    let rafId = null;
    let destroyed = false;

    const MODEL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
    const CDN   = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";

    const drawFrame = (lms) => {
      if (!canvasRef.current || !videoRef.current) return;
      const ctx = canvasRef.current.getContext("2d");
      const { videoWidth: W, videoHeight: H } = videoRef.current;
      canvasRef.current.width  = W || 640;
      canvasRef.current.height = H || 480;
      ctx.clearRect(0, 0, W, H);
      // Alignment guide
      ctx.strokeStyle = lms ? "#10b981" : "rgba(245,158,11,.7)";
      ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
      const cx = W / 2, cy = H / 2;
      ctx.beginPath(); ctx.ellipse(cx, cy * .55, W * .18, H * .22, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - W * .3, H * .35); ctx.lineTo(cx + W * .3, H * .35); ctx.stroke();
      ctx.setLineDash([]);
      if (lms) {
        ctx.fillStyle = "#10b981";
        [LM.L_SHOULDER, LM.R_SHOULDER, LM.L_EAR, LM.R_EAR, LM.L_EYE, LM.R_EYE].forEach(i => {
          const lm = lms[i];
          if (!lm) return;
          ctx.beginPath(); ctx.arc(lm.x * W, lm.y * H, 5, 0, Math.PI * 2); ctx.fill();
        });
        ctx.strokeStyle = "#10b981"; ctx.lineWidth = 2.5; ctx.globalAlpha = .8;
        [[LM.L_SHOULDER, LM.R_SHOULDER], [LM.L_EAR, LM.R_EAR],
         [LM.L_EAR, LM.L_SHOULDER], [LM.R_EAR, LM.R_SHOULDER]].forEach(([a, b]) => {
          if (!lms[a] || !lms[b]) return;
          ctx.beginPath(); ctx.moveTo(lms[a].x * W, lms[a].y * H);
          ctx.lineTo(lms[b].x * W, lms[b].y * H); ctx.stroke();
        });
        ctx.globalAlpha = 1;
      }
    };

    import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs")
      .then(async mod => {
        if (destroyed) return;
        const fr = await mod.FilesetResolver.forVisionTasks(CDN);
        pl = await mod.PoseLandmarker.createFromOptions(fr, {
          baseOptions: { modelAssetPath: MODEL, delegate: "GPU" },
          runningMode: "VIDEO", numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        mpRef.current = pl;
        // RAF loop — tasks-vision requires VIDEO mode + timestamp
        const tick = () => {
          if (destroyed) return;
          if (videoRef.current && videoRef.current.readyState >= 2 && pl) {
            try {
              const res = pl.detectForVideo(videoRef.current, performance.now());
              const lms = res.landmarks?.[0] || null;
              if (lms && step === "counting") frameRef.current.push(lms);
              drawFrame(lms);
            } catch {}
          }
          rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);
      })
      .catch(() => {});

    return () => {
      destroyed = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (pl) { try { pl.close(); } catch {} }
      mpRef.current = null;
    };
  }, [step, startCamera]);

  // Countdown
  const startCounting = useCallback(() => {
    frameRef.current = [];
    setFrames([]);
    setStep("counting");
    let remaining = CALIB_DURATION;
    setCountdown(remaining);
    setProgress(0);

    timerRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      setProgress(Math.round(((CALIB_DURATION - remaining) / CALIB_DURATION) * 100));
      if (remaining <= 0) {
        clearInterval(timerRef.current);
        finishCalibration();
      }
    }, 1000);
  }, []);

  const finishCalibration = useCallback(async () => {
    const collected = frameRef.current;
    if (collected.length < 5) {
      setError(t.err_pose);
      setStep("align");
      return;
    }

    // Extract per-frame metrics
    const neckAngles = [], headTilts = [], shoulderTilts = [], spineAngles = [];
    const neckAngles_s = [], headTilts_s = [], shoulderTilts_s = [], spineAngles_s = []; // signed
    const ipdFracs = []; // for distance calibration
    collected.forEach(lms => {
      const lSh = lms[LM.L_SHOULDER], rSh = lms[LM.R_SHOULDER];
      const lEar = lms[LM.L_EAR],    rEar = lms[LM.R_EAR];
      const lEye = lms[LM.L_EYE],    rEye = lms[LM.R_EYE];
      const lHip = lms[23],           rHip = lms[24];
      const nose = lms[LM.NOSE];
      const midSh  = { x: (lSh.x + rSh.x) / 2,   y: (lSh.y + rSh.y) / 2 };
      const midEar = { x: (lEar.x + rEar.x) / 2,  y: (lEar.y + rEar.y) / 2 };
      const midHip = { x: (lHip.x + rHip.x) / 2,  y: (lHip.y + rHip.y) / 2 };
      const { point: neckRef, correction: neckCorr } = neckRefPoint(nose, midEar, nose?.visibility);
      neckAngles.push(Math.max(0, angleV(midSh, neckRef) - neckCorr));
      headTilts.push(angleH(lEye, rEye));
      shoulderTilts.push(angleH(lSh, rSh));
      spineAngles.push(angleV(midHip, midSh));
      // Signed for asymmetric offset detection
      neckAngles_s.push(angleV_signed(midSh, neckRef));
      headTilts_s.push(angleH_signed(lEye, rEye));
      shoulderTilts_s.push(angleH_signed(lSh, rSh));
      spineAngles_s.push(angleV_signed(midHip, midSh));
      // IPD as a fraction of frame width (these landmarks are already
      // normalized 0-1, so no need to multiply by frame width here)
      if ((lEye.visibility ?? 1) > 0.5 && (rEye.visibility ?? 1) > 0.5) {
        ipdFracs.push(Math.abs(rEye.x - lEye.x));
      }
    });

    // Compute personal baseline (with tolerance ±30% wider than default)
    const baseline = {
      neck_angle:    Math.round(avg(neckAngles) * 10) / 10,
      head_tilt:     Math.round(avg(headTilts) * 10) / 10,
      shoulder_tilt: Math.round(avg(shoulderTilts) * 10) / 10,
      spine_angle:   Math.round(avg(spineAngles) * 10) / 10,
      frames_used:   collected.length,
      calibrated_at: new Date().toISOString(),
    };

    // Tolerance zones: ±30% wider for personal baseline
    const tol = (base, defaultOk, defaultBad) => ({
      ideal: base,
      ok:    Math.max(defaultOk, Math.abs(base) * 0.3 + defaultOk * 0.5),
      bad:   Math.max(defaultBad, Math.abs(base) * 0.5 + defaultBad * 0.5),
    });

    // Signed offsets — direction of natural lean
    // positive = leans right/forward naturally, negative = left/back
    const signedOffsets = {
      neck_angle:    Math.round(avg(neckAngles_s)    * 10) / 10,
      head_tilt:     Math.round(avg(headTilts_s)     * 10) / 10,
      shoulder_tilt: Math.round(avg(shoulderTilts_s) * 10) / 10,
      spine_angle:   Math.round(avg(spineAngles_s)   * 10) / 10,
    };

    const calibData = {
      ...baseline,
      tolerances: {
        // Synced with backend score_m thresholds exactly
        neck_angle:    tol(baseline.neck_angle, 7, 20),
        head_tilt:     tol(baseline.head_tilt, 3, 10),
        shoulder_tilt: tol(baseline.shoulder_tilt, 3, 10),
        spine_angle:   tol(baseline.spine_angle, 5, 15),
      },
      // Signed directional offsets for asymmetric threshold correction
      // Backend uses these to widen tolerance in natural lean direction
      offsets: signedOffsets,
      asymmetric_correction: true,
    };

    // Distance calibration: distCalibFactor = knownDistanceCm * ipdFraction.
    // At runtime: distCm = distCalibFactor / currentIpdFraction. This
    // absorbs both this user's actual IPD and this camera's actual FOV
    // into one measured constant, instead of guessing population
    // averages for both (±15cm → ±3cm typical error reduction).
    const knownDist = parseFloat(knownDistanceCm);
    if (knownDist > 0 && ipdFracs.length >= 5) {
      calibData.distance_calibrated_cm = knownDist;
      calibData.distCalibFactor = Math.round(knownDist * avg(ipdFracs) * 100000) / 100000;
    }

    setResult(calibData);
    stopCamera();
    setStep("done");

    // Save to Firestore
    if (uid) {
      try { await saveCalibration(uid, calibData); } catch (e) { console.warn("Calibration save:", e); }
    }
    // Also save to localStorage for offline use
    try { localStorage.setItem("posture_calibration", JSON.stringify(calibData)); } catch(e) {}
  }, [uid, stopCamera, t.err_pose, knownDistanceCm]);

  const DARK  = cs || { bg: "#030b14", card: "#05101f", border: "rgba(148,163,184,.1)", text: "#f0f4f8", muted: "#64748b", blue: "#1a56db" };

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9000, backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onSkip?.(); }}
      onKeyDown={(e) => { if (e.key === "Escape") onSkip?.(); }}
      tabIndex={-1}
    >
      <div style={{ background: DARK.card, border: `0.5px solid ${DARK.border}`, borderRadius: 20, padding: "32px 28px", maxWidth: 480, width: "94%", position: "relative" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>
            {step === "done" ? "✅" : step === "counting" ? "⏱" : "🎯"}
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: DARK.text, marginBottom: 4 }}>{t.title}</div>
          <div style={{ fontSize: 12, color: DARK.muted }}>{t.sub}</div>
        </div>

        {/* INTRO */}
        {step === "intro" && (
          <>
            <div style={{ background: "rgba(26,86,219,.08)", border: "0.5px solid rgba(26,86,219,.2)", borderRadius: 12, padding: 18, marginBottom: 22 }}>
              {[t.intro1, t.intro2, t.intro3].map((tip, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: i < 2 ? 10 : 0 }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#1a56db", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ fontSize: 13, color: DARK.text, lineHeight: 1.5 }}>{tip}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={onSkip} style={{ flex: 1, background: "none", border: `0.5px solid ${DARK.border}`, borderRadius: 9, padding: "11px 0", fontSize: 12, color: DARK.muted, cursor: "pointer" }}>{t.skip}</button>
              <button onClick={() => setStep("align")} style={{ flex: 2, background: "#1a56db", border: "none", borderRadius: 9, padding: "11px 0", fontSize: 13, fontWeight: 600, color: "white", cursor: "pointer" }}>{t.start}</button>
            </div>
          </>
        )}

        {/* ALIGN */}
        {step === "align" && (
          <>
            <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", marginBottom: 16, background: "#000", aspectRatio: "4/3" }}>
              <video ref={videoRef} style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} playsInline muted autoPlay />
              <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", transform: "scaleX(-1)" }} />
              <div style={{ position: "absolute", bottom: 10, left: 0, right: 0, textAlign: "center" }}>
                <span style={{ background: "rgba(0,0,0,.6)", color: "white", fontSize: 11, padding: "4px 12px", borderRadius: 99, backdropFilter: "blur(4px)" }}>
                  {t.alignSub}
                </span>
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: DARK.text, marginBottom: 4 }}>📏 {t.distLabel}</label>
              <input
                type="number" inputMode="decimal" min="20" max="150"
                value={knownDistanceCm}
                onChange={e => setKnownDistanceCm(e.target.value)}
                placeholder={t.distPlaceholder}
                style={{ width: "100%", background: "rgba(148,163,184,.08)", border: `0.5px solid ${DARK.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 14, color: DARK.text }}
              />
              <div style={{ fontSize: 11, color: DARK.muted, marginTop: 4, lineHeight: 1.5 }}>{t.distHint}</div>
              {/* "I'm not sure" fallback */}
              <button onClick={() => setKnownDistanceCm("60")} style={{
                marginTop: 6, background: "none", border: `0.5px solid ${DARK.border}`,
                borderRadius: 6, padding: "5px 10px", fontSize: 11, color: DARK.muted,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
              }}>
                🤷 {t.distNotSure || "I'm not sure — use 60cm estimate"}
              </button>
            </div>
            {error && <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 10, textAlign: "center" }}>{error}</div>}
            <button onClick={() => {
                const d = parseFloat(knownDistanceCm);
                if (!d || d < 20 || d > 150) { setError(t.distErr); return; }
                setError("");
                startCounting();
              }} style={{ width: "100%", background: "#1a56db", border: "none", borderRadius: 9, padding: "13px 0", fontSize: 13, fontWeight: 600, color: "white", cursor: "pointer" }}>
              ▶ {t.start}
            </button>
          </>
        )}

        {/* COUNTING */}
        {step === "counting" && (
          <>
            <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", marginBottom: 16, background: "#000", aspectRatio: "4/3" }}>
              <video ref={videoRef} style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} playsInline muted autoPlay />
              <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", transform: "scaleX(-1)" }} />
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 56, fontWeight: 800, color: "white", lineHeight: 1, textShadow: "0 2px 20px rgba(0,0,0,.8)" }}>{countdown}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,.7)", marginTop: 4 }}>{t.counting}</div>
                </div>
              </div>
            </div>
            {/* Progress bar */}
            <div style={{ background: "rgba(148,163,184,.1)", borderRadius: 99, height: 6, overflow: "hidden", marginBottom: 8 }}>
              <div style={{ height: "100%", borderRadius: 99, width: `${progress}%`, background: "linear-gradient(90deg,#1a56db,#10b981)", transition: "width 1s linear" }} />
            </div>
            <div style={{ fontSize: 11, color: DARK.muted, textAlign: "center" }}>{progress}% — {frameRef.current.length} frames captured</div>
          </>
        )}

        {/* DONE */}
        {step === "done" && result && (
          <>
            <div style={{ background: "rgba(16,185,129,.08)", border: "0.5px solid rgba(16,185,129,.2)", borderRadius: 12, padding: 18, marginBottom: 22 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#10b981", marginBottom: 14 }}>{t.done}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  [t.neckLabel,     result.neck_angle,    "°", 5, 12],
                  [t.tiltLabel,     result.head_tilt,     "°", 3, 8],
                  [t.shoulderLabel, result.shoulder_tilt, "°", 3, 8],
                  [t.spineLabel,    result.spine_angle,   "°", 5, 12],
                ].map(([label, val, unit, okThresh, warnThresh]) => {
                  const abs = Math.abs(val||0);
                  const status = abs <= okThresh ? "ideal" : abs <= warnThresh ? "slight" : "attention";
                  const statusColor = status==="ideal"?"#10b981":status==="slight"?"#f59e0b":"#ef4444";
                  const statusIcon  = status==="ideal"?"✅":status==="slight"?"⚠️":"🔴";
                  const statusLabel = status==="ideal"
                    ? (t.statusIdeal||"Ideal")
                    : status==="slight"
                    ? (t.statusSlight||"Slight lean")
                    : (t.statusAttention||"Needs attention");
                  return (
                    <div key={label} style={{ background: `${statusColor}10`, border: `1px solid ${statusColor}30`, borderRadius: 8, padding: "10px 12px" }}>
                      <div style={{ fontSize: 10, color: DARK.muted, marginBottom: 3 }}>{label}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: statusColor }}>{statusIcon} {statusLabel}</div>
                      <div style={{ fontSize: 10, color: DARK.muted, marginTop: 2 }}>{val}{unit} baseline</div>
                    </div>
                  );
                })}
              </div>
              {result.distCalibFactor && (
                <div style={{ marginTop: 10, background: "rgba(16,185,129,.06)", borderRadius: 8, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 16 }}>📏</span>
                  <div>
                    <div style={{ fontSize: 10, color: DARK.muted }}>{t.distBadge}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#10b981" }}>{result.distance_calibrated_cm}cm</div>
                  </div>
                </div>
              )}
              <div style={{ fontSize: 11, color: DARK.muted, marginTop: 12 }}>{t.doneSub} ({result.frames_used} frames)</div>
            </div>
            <button onClick={() => onDone(result)} style={{ width: "100%", background: "#10b981", border: "none", borderRadius: 9, padding: "13px 0", fontSize: 13, fontWeight: 600, color: "white", cursor: "pointer" }}>
              {t.finish}
            </button>
          </>
        )}

        {/* Skip button always available */}
        {(step === "align" || step === "counting") && (
          <button onClick={onSkip} style={{ width: "100%", marginTop: 10, background: "none", border: "none", fontSize: 11, color: DARK.muted, cursor: "pointer", padding: 6 }}>
            {t.skip}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Hook: useCalibration ──────────────────────────────────────────
export function useCalibration(uid) {
  const [calibration, setCalibration] = useState(null);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    // Try localStorage first (fast)
    const local = (()=>{try{return localStorage.getItem("posture_calibration");}catch(e){return null;}})();
    if (local) {
      try { setCalibration(JSON.parse(local)); } catch {}
    }
    // Then sync from Firestore
    if (uid) {
      getCalibration(uid)
        .then(data => { if (data) { setCalibration(data); try { localStorage.setItem("posture_calibration", JSON.stringify(data)); } catch(e) {} } })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [uid]);

  return { calibration, loading };
}

// ── applyCalibration: adjust score using personal baseline ────────
// Works for both front and side camera modes.
// mode = "side" → uses the side-camera metric→calibration-key map
// mode = anything else → uses the front-camera map (default)
export function applyCalibration(rawMetrics, calibration, mode = "front") {
  if (!calibration?.tolerances) return rawMetrics;

  const adjusted = { ...rawMetrics };
  const tols = calibration.tolerances;

  const mscore = (v, ideal, ok, bad) => {
    const d = Math.abs(v - ideal);
    return d <= ok
      ? Math.round(100 - (d / Math.max(ok, .1)) * 25)
      : d <= bad
        ? Math.round(75 - ((d - ok) / Math.max(bad - ok, .1)) * 45)
        : Math.max(0, Math.round(30 - (d - bad) * 1.2));
  };

  // Front-camera metrics → calibration tolerance keys
  const frontMap = {
    neck_lean:      "neck_angle",
    head_tilt:      "head_tilt",
    shoulder_level: "shoulder_tilt",
    spine_lean:     "spine_angle",
  };

  // Side-camera metrics → calibration tolerance keys
  // The calibration wizard measures these in front-view (neck/spine/shoulder),
  // so we map side-camera equivalents to the same calibration keys where the
  // anatomy is the same (neck lean = same real-world angle, just captured from
  // the side). Trunk lean has no direct front-camera equivalent so it uses
  // spine_angle as the closest proxy.
  const sideMap = {
    neck_lean_side: "neck_angle",
    trunk_lean:     "spine_angle",
  };

  const map = mode === "side" ? sideMap : frontMap;

  Object.entries(map).forEach(([metricKey, calibKey]) => {
    if (adjusted[metricKey] !== undefined && tols[calibKey]) {
      const { ideal, ok, bad } = tols[calibKey];
      const raw = adjusted[metricKey];
      adjusted[metricKey] = {
        ...adjusted[metricKey],
        score: mscore(typeof raw === "object" ? raw.value : raw, ideal, ok, bad),
        calibrated: true,
      };
    }
  });

  return adjusted;
}


