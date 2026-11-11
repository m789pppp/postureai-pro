/**
 * BenchRecorder — local research tool (open /bench.html with `npm run dev`).
 * Records landmark-only sessions for the Posmoz Bench and downloads them as JSON.
 * No video or image is stored or uploaded.
 */
import { useEffect, useRef, useState } from "react";
import { createLiveEnhancer } from "../features/analysis/liveEnhancer.js";
import PrecisionHud from "../features/analysis/PrecisionHud.jsx";
import { BENCH_STEPS, frameRecord, sessionEnvelope } from "../features/analysis/benchProtocol.js";

const TV = "0.10.14";
const POSE_MODEL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";

export default function BenchRecorder() {
  const [lang, setLang] = useState("ar");
  const [subject, setSubject] = useState("");
  const [status, setStatus] = useState("loading");      // loading | ready | countdown | recording | done | error
  const [stepIdx, setStepIdx] = useState(0);
  const [measured, setMeasured] = useState("");
  const [prec, setPrec] = useState(null);
  const [left, setLeft] = useState(0);
  const [error, setError] = useState("");
  const vid = useRef(null), poseRef = useRef(null), enh = useRef(null), raf = useRef(null);
  const rec = useRef({ frames: null, until: 0 }), steps = useRef([]), calibRef = useRef(null), dims = useRef({ W: 0, H: 0 });
  const isAr = lang === "ar";
  const step = BENCH_STEPS[stepIdx];
  const stepRef = useRef(stepIdx); stepRef.current = stepIdx;

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }, audio: false });
        vid.current.srcObject = s; await vid.current.play();
        dims.current = { W: vid.current.videoWidth, H: vid.current.videoHeight };
        const mod = await import(/* @vite-ignore */ `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TV}/vision_bundle.mjs`);
        const fr = await mod.FilesetResolver.forVisionTasks(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TV}/wasm`);
        const mk = d => mod.PoseLandmarker.createFromOptions(fr, { baseOptions: { modelAssetPath: POSE_MODEL, delegate: d }, runningMode: "VIDEO", numPoses: 1 });
        poseRef.current = await mk("GPU").catch(() => mk("CPU"));
        try { calibRef.current = JSON.parse(localStorage.getItem("posture_calibration") || "null"); } catch { calibRef.current = null; }
        enh.current = createLiveEnhancer(calibRef.current);
        if (dead) return;
        setStatus("ready");
        let n = 0;
        const tick = () => {
          raf.current = requestAnimationFrame(tick);
          const v = vid.current; if (!v || v.readyState < 2) return;
          const t = performance.now(), { W, H } = dims.current;
          const raw = poseRef.current.detectForVideo(v, t).landmarks?.[0];
          if (!raw) return;
          const fused = enh.current.fuse(raw, v, W, H, t);
          const p = enh.current.process(v, fused, W, H, t, null);
          const r = rec.current;
          if (r.frames && t <= r.until) r.frames.push(frameRecord(t, raw, fused, p));
          if (++n % 6 === 0) { setPrec(p); if (r.frames) setLeft(Math.max(0, Math.ceil((r.until - t) / 1000))); }
          if (r.frames && t > r.until) {
            const cur = BENCH_STEPS[stepRef.current];
            steps.current.push({ id: cur.id, target: cur.target, measured: r.measured, frames: r.frames });
            r.frames = null;
            setMeasured("");
            const nx = stepRef.current + 1;
            if (nx >= BENCH_STEPS.length) setStatus("done"); else { setStepIdx(nx); setStatus("ready"); }
          }
        };
        raf.current = requestAnimationFrame(tick);
      } catch (e) { setError(String(e?.message || e)); setStatus("error"); }
    })();
    return () => { dead = true; cancelAnimationFrame(raf.current); vid.current?.srcObject?.getTracks().forEach(t => t.stop()); enh.current?.close(); };
  }, []);

  const record = () => {
    const m = parseFloat(measured);
    if (!Number.isFinite(m)) { setError(isAr ? "اكتب القيمة المقاسة الأول" : "Enter the measured value first"); return; }
    setError(""); setStatus("countdown");
    setTimeout(() => {
      rec.current = { frames: [], until: performance.now() + step.holdSec * 1000, measured: m };
      setStatus("recording");
    }, 2000);
  };

  const download = () => {
    const { W, H } = dims.current, c = calibRef.current;
    const cam = c?.camera && c.camera.width === W ? c.camera : { width: W, height: H, focal_px: null, focal_source: "unknown" };
    const env = sessionEnvelope({ subject: subject.trim() || "S00", camera: cam, calib: c, steps: steps.current });
    const blob = new Blob([JSON.stringify(env)], { type: "application/json" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `posmoz-bench-${env.subject}-${Date.now()}.json` });
    a.click(); URL.revokeObjectURL(a.href);
  };

  const C = { bg: "#0b1220", card: "#111a2e", text: "#e5ecf5", muted: "#93a4bd", line: "rgba(148,163,184,.2)" };
  const btn = bg => ({ background: bg, color: "white", border: "none", borderRadius: 10, padding: "11px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" });
  return (
    <div dir={isAr ? "rtl" : "ltr"} style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "system-ui, sans-serif", padding: 20 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(280px,1fr)", gap: 16 }}>
        <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", background: "#000", aspectRatio: "16/9" }}>
          <video ref={vid} playsInline muted autoPlay style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
          <PrecisionHud data={prec} isAr={isAr} calibrated={!!calibRef.current?.calib_version} />
          {(status === "countdown" || status === "recording") && (
            <div style={{ position: "absolute", left: 16, bottom: 16, background: status === "recording" ? "#dc2626" : "#334155", padding: "8px 14px", borderRadius: 99, fontWeight: 700 }}>
              {status === "recording" ? `● REC ${left}s` : (isAr ? "استعد…" : "Get ready…")}
            </div>
          )}
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <strong>Posmoz Bench</strong>
            <button onClick={() => setLang(isAr ? "en" : "ar")} style={{ ...btn("#1e293b"), padding: "6px 10px", fontSize: 12 }}>{isAr ? "EN" : "عربي"}</button>
          </div>
          <label style={{ fontSize: 12, color: C.muted }}>{isAr ? "كود المشارك (مش اسم)" : "Subject code (not a name)"}</label>
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="S01"
            style={{ width: "100%", boxSizing: "border-box", margin: "4px 0 14px", padding: 9, borderRadius: 8, border: `1px solid ${C.line}`, background: "#0b1220", color: C.text }} />
          {status === "loading" && <div style={{ color: C.muted }}>{isAr ? "تحميل الموديلات…" : "Loading models…"}</div>}
          {status === "error" && <div style={{ color: "#f87171" }}>{error}</div>}
          {status !== "loading" && status !== "error" && status !== "done" && (
            <>
              <div style={{ fontSize: 12, color: C.muted }}>{isAr ? "الخطوة" : "Step"} {stepIdx + 1}/{BENCH_STEPS.length}</div>
              <div style={{ fontSize: 17, fontWeight: 700, margin: "4px 0 12px" }}>{isAr ? step.ar : step.en}</div>
              <label style={{ fontSize: 12, color: C.muted }}>{isAr ? "القيمة المقاسة" : "Measured value"} ({step.target}, {step.unit})</label>
              <input type="number" inputMode="decimal" value={measured} onChange={e => setMeasured(e.target.value)}
                style={{ width: "100%", boxSizing: "border-box", margin: "4px 0 12px", padding: 9, borderRadius: 8, border: `1px solid ${C.line}`, background: "#0b1220", color: C.text }} />
              <button disabled={status !== "ready"} onClick={record} style={{ ...btn(status === "ready" ? "#2563eb" : "#334155"), width: "100%" }}>
                {isAr ? `سجّل ${step.holdSec} ثواني` : `Record ${step.holdSec}s`}
              </button>
              {error && <div style={{ color: "#f87171", fontSize: 12, marginTop: 8 }}>{error}</div>}
            </>
          )}
          {status === "done" && (
            <>
              <div style={{ marginBottom: 12 }}>{isAr ? "خلصت كل الخطوات." : "All steps recorded."}</div>
              <button onClick={download} style={{ ...btn("#059669"), width: "100%" }}>{isAr ? "نزّل الجلسة (JSON)" : "Download session (JSON)"}</button>
            </>
          )}
          <div style={{ fontSize: 11, color: C.muted, marginTop: 14, lineHeight: 1.6 }}>
            {isAr ? "بيتسجل نقط الجسم والأرقام بس — مفيش فيديو ولا صور. الملف بيفضل على جهازك."
                  : "Only landmarks and numbers are recorded — no video or images. The file stays on this device."}
            {` · ${steps.current.length} ${isAr ? "خطوات متسجلة" : "steps recorded"}`}
          </div>
        </div>
      </div>
    </div>
  );
}
