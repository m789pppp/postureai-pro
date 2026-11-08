import { useState, useRef, useEffect, useCallback } from "react";
import { measureSideView, summarizeTrial, trialsToCsv, MEASURE_VERSION } from "./features/analysis/clinicalMeasure.js";

const HOLD_MS = 15000;
const SETTLE_MS = 3000;
const STORE = "posmoz.clinicalTrials.v1";

const LABELS = {
  neck_lateral_deg:      ["Neck lateral tilt", "ميل الرقبة الجانبي"],
  head_tilt_deg:         ["Head tilt", "ميل الرأس"],
  shoulder_tilt_deg:     ["Shoulder tilt", "ميل الكتفين"],
  spine_lateral_deg:     ["Spine lateral lean", "ميل العمود الجانبي"],
  head_yaw_deg:          ["Head rotation", "دوران الرأس"],
  trunk_rotation_deg:    ["Trunk rotation", "دوران الجذع"],
  elbow_included_deg:    ["Elbow angle", "زاوية الكوع"],
  forward_head_cm:       ["Forward head", "تقدم الرأس"],
  cva_proxy_deg:         ["CVA proxy (ear-shoulder)", "CVA تقريبي (أذن-كتف)"],
  head_sagittal_deg:     ["Head sagittal angle", "زاوية الرأس الجانبية"],
  trunk_inclination_deg: ["Trunk inclination", "ميل الجذع للأمام"],
};
const load = () => { try { return JSON.parse(localStorage.getItem(STORE) || "[]"); } catch { return []; } };
const save = t => { try { localStorage.setItem(STORE, JSON.stringify(t)); } catch { /* kept in memory */ } };

/** Records held postures as exact readings for comparison with a reference. */
export default function ClinicalCapture({ sinkRef, camActive, isAr, cs, onClose }) {
  const L = (en, ar) => (isAr ? ar : en);
  const [participantId, setParticipantId] = useState("");
  const [rater, setRater] = useState("");
  const [posture, setPosture] = useState("");
  const [view, setView] = useState("side");
  const [live, setLive] = useState({ values: null, reason: null });
  const [msLeft, setMsLeft] = useState(0);
  const [trials, setTrials] = useState(load);

  const viewRef = useRef(view); viewRef.current = view;
  const framesRef = useRef(null);
  const lastPaint = useRef(0);

  useEffect(() => {
    sinkRef.current = (lms, W, H, result) => {
      let values = null, reason = null;
      if (viewRef.current === "side") {
        const s = measureSideView(lms, W, H);
        values = s.values; reason = s.reason;
      } else {
        values = result?.measurements || null;
        reason = values ? null : (result?.qualityReason || "no_reading");
      }
      const t = performance.now();
      if (framesRef.current) framesRef.current.push({ t, values: values || {} });
      if (t - lastPaint.current > 250) { lastPaint.current = t; setLive({ values, reason }); }
    };
    return () => { sinkRef.current = null; };
  }, [sinkRef]);

  const finish = useCallback(() => {
    const frames = framesRef.current; framesRef.current = null;
    const summary = summarizeTrial(frames, { settleMs: SETTLE_MS });
    setTrials(prev => {
      const trial = prev.filter(t => t.participantId === participantId.trim()).length + 1;
      const next = [...prev, { participantId: participantId.trim(), trial, view: viewRef.current, posture: posture.trim(), rater: rater.trim(), capturedAt: new Date().toISOString(), summary }];
      save(next);
      return next;
    });
  }, [participantId, posture, rater]);

  useEffect(() => {
    if (msLeft <= 0) return undefined;
    const started = performance.now(), from = msLeft;
    let alive = true, raf;
    const tick = () => {
      if (!alive) return;
      const left = from - (performance.now() - started);
      if (left <= 0) { setMsLeft(0); finish(); return; }
      setMsLeft(left); raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { alive = false; cancelAnimationFrame(raf); };
    // Countdown restarts only on a new capture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msLeft > 0]);

  const capturing = msLeft > 0;
  const canStart = camActive && !capturing && participantId.trim() && posture.trim();
  const start = () => { framesRef.current = []; setMsLeft(HOLD_MS); };
  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([trialsToCsv(trials)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `posmoz-validation-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const clearAll = () => {
    if (window.confirm(L("Delete all captured trials on this device?", "مسح كل القياسات المحفوظة على الجهاز ده؟"))) { setTrials([]); save([]); }
  };

  const bg = cs?.card || "#0b1420", border = cs?.border || "rgba(148,163,184,.15)", text = cs?.text || "#e6edf3", muted = cs?.muted || "#94a3b8";
  const field = { width: "100%", boxSizing: "border-box", padding: "9px 10px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: text, fontSize: 13 };
  const btn = (on) => ({ padding: "10px 12px", borderRadius: 8, border: `1px solid ${border}`, background: on ? "#1158c7" : "transparent", color: on ? "#fff" : text, fontWeight: 700, fontSize: 13, cursor: "pointer" });
  const entries = Object.entries(live.values || {});

  return (
    <div role="dialog" aria-modal="true" aria-label={L("Study measurement", "قياس الدراسة")} dir={isAr ? "rtl" : "ltr"}
      style={{ position: "fixed", insetBlock: 0, insetInlineEnd: 0, width: "min(420px,100vw)", zIndex: 9999, background: bg, borderInlineStart: `1px solid ${border}`, color: text, padding: 16, overflowY: "auto", boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <strong>{L("Study measurement", "قياس الدراسة")}</strong>
        <button onClick={onClose} aria-label={L("Close", "إغلاق")} style={{ ...btn(false), padding: "4px 10px" }}>×</button>
      </div>
      <p style={{ fontSize: 12, color: muted, lineHeight: 1.7, marginTop: 0 }}>
        {L("Research use only. Use a code, not a name. These numbers are unverified until compared with the reference instrument.",
           "للبحث فقط. استخدم كود مش اسم المشارك. الأرقام دي غير مؤكدة لحد ما تتقارن بجهاز المرجع.")}
      </p>
      <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
        <input style={field} value={participantId} onChange={e => setParticipantId(e.target.value)} placeholder={L("Participant code (P001)", "كود المشارك (P001)")} />
        <input style={field} value={posture} onChange={e => setPosture(e.target.value)} placeholder={L("Posture (neutral, forward head...)", "الوضعية (محايد، رأس لقدام...)")} />
        <input style={field} value={rater} onChange={e => setRater(e.target.value)} placeholder={L("Rater code", "كود المُقيّم")} />
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ ...btn(view === "side"), flex: 1 }} disabled={capturing} onClick={() => setView("side")}>{L("Side camera", "كاميرا جانبية")}</button>
          <button style={{ ...btn(view === "front"), flex: 1 }} disabled={capturing} onClick={() => setView("front")}>{L("Front camera", "كاميرا أمامية")}</button>
        </div>
      </div>
      {live.reason && <div style={{ fontSize: 12, color: "#fbbf24", marginBottom: 8 }}>{L("Not measurable: ", "مش قابل للقياس: ")}{live.reason}</div>}
      <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse", marginBottom: 12 }}>
        <tbody>
          {entries.map(([k, e]) => (
            <tr key={k} style={{ borderBottom: `1px solid ${border}` }}>
              <td style={{ padding: "6px 0" }}>{L(LABELS[k]?.[0] || k, LABELS[k]?.[1] || k)}</td>
              <td dir="ltr" style={{ padding: "6px 0", textAlign: "end", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                {e.reliable ? `${(e.signed ?? e.value).toFixed(1)} ${e.unit === "deg" ? "°" : e.unit}` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button style={{ ...btn(!!canStart), width: "100%", opacity: canStart || capturing ? 1 : .5 }} disabled={!canStart} onClick={start}>
        {capturing ? L(`Hold still: ${Math.ceil(msLeft / 1000)}s`, `اثبت: ${Math.ceil(msLeft / 1000)} ث`) : L("Capture 15 seconds", "سجّل 15 ثانية")}
      </button>
      <div style={{ fontSize: 12, color: muted, margin: "12px 0 8px" }}>
        {L(`${trials.length} trials saved on this device`, `${trials.length} قياس محفوظ على الجهاز ده`)} · {MEASURE_VERSION}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button style={{ ...btn(false), flex: 1 }} disabled={!trials.length} onClick={exportCsv}>{L("Export CSV", "تصدير CSV")}</button>
        <button style={btn(false)} disabled={!trials.length} onClick={clearAll}>{L("Clear", "مسح")}</button>
      </div>
    </div>
  );
}
