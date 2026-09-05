import { useState, useRef, useEffect, useCallback } from "react";

const PHASES = [
  {
    id: "straight",
    en: "Sit perfectly straight — best posture you can hold",
    ar: "اقعد مستقيم تمامًا — أحسن وضعية تقدر تعملها",
    metricKey: null, // reference phase — every other phase compares against this
    expect: "highest", // this phase's overall score should be the highest of the 4
  },
  {
    id: "neck_down",
    en: "Bend your neck down, like looking at your phone in your lap",
    ar: "انحني برقبتك لتحت، زي ما تبص في موبايلك في حجرك",
    metricKey: "neck_lean",
    expect: "worse",
  },
  {
    id: "head_tilt",
    en: "Tilt your head to one side, ear toward shoulder",
    ar: "ميّل دماغك لجنب، ودنك ناحية كتفك",
    metricKey: "head_tilt",
    expect: "worse",
  },
  {
    id: "lean_forward",
    en: "Lean your head toward the screen, like reading small text",
    ar: "قرّب دماغك من الشاشة، زي ما تقرا حاجة صغيرة",
    metricKey: "fhp_index",
    expect: "worse",
  },
];

const PHASE_SECONDS = 10;

/**
 * QA Accuracy Test — structured ground-truth protocol.
 *
 * Not for end users. Walks a tester through 4 known postures for 10s
 * each, samples the live analysis engine's overall score + per-metric
 * score during each phase, and at the end computes whether each phase
 * moved in the medically-expected direction relative to the "straight"
 * baseline. This gives a real percentage instead of a guess — no lab
 * equipment needed, just a person willing to hold four positions.
 */
export function QAAccuracyTest({ analysis, camActive, isAr = false, cs, onClose }) {
  const [phaseIdx, setPhaseIdx] = useState(-1); // -1 = intro screen
  const [secondsLeft, setSecondsLeft] = useState(PHASE_SECONDS);
  const [samples, setSamples] = useState({}); // { phaseId: [ {overall, metrics}, ... ] }
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const samplesRef = useRef({});
  const tickRef = useRef(null);

  const bg = cs?.card || "#0b1420";
  const border = cs?.border || "rgba(148,163,184,.15)";
  const text = cs?.text || "#e6edf3";
  const muted = cs?.muted || "#94a3b8";

  // Sample the live analysis result every ~500ms while a phase is running
  useEffect(() => {
    if (!running || phaseIdx < 0 || phaseIdx >= PHASES.length) return;
    if (!analysis || analysis.overall == null) return;
    const phaseId = PHASES[phaseIdx].id;
    samplesRef.current[phaseId] = samplesRef.current[phaseId] || [];
    samplesRef.current[phaseId].push({
      overall: analysis.overall,
      metrics: analysis.metrics || {},
      t: Date.now(),
    });
  }, [analysis, running, phaseIdx]);

  const startPhase = useCallback((idx) => {
    setPhaseIdx(idx);
    setSecondsLeft(PHASE_SECONDS);
    setRunning(true);
    samplesRef.current[PHASES[idx].id] = [];
  }, []);

  useEffect(() => {
    if (!running) return;
    clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(tickRef.current);
          setRunning(false);
          setSamples({ ...samplesRef.current });
          if (phaseIdx + 1 < PHASES.length) {
            setTimeout(() => startPhase(phaseIdx + 1), 900);
          } else {
            setDone(true);
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(tickRef.current);
  }, [running, phaseIdx, startPhase]);

  // ── Results computation ──────────────────────────────────────────
  function avgOverall(phaseId) {
    const arr = samples[phaseId] || samplesRef.current[phaseId] || [];
    if (!arr.length) return null;
    return arr.reduce((a, s) => a + (s.overall || 0), 0) / arr.length;
  }
  function avgMetric(phaseId, key) {
    const arr = samples[phaseId] || samplesRef.current[phaseId] || [];
    const vals = arr.map((s) => s.metrics?.[key]?.score).filter((v) => v != null);
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  const baselineOverall = avgOverall("straight");
  const results = PHASES.map((p) => {
    if (p.expect === "highest") {
      const isHighest = PHASES.every((other) => {
        if (other.id === p.id) return true;
        const o = avgOverall(other.id);
        return o == null || baselineOverall == null || baselineOverall >= o - 2; // 2pt tolerance for noise
      });
      return { ...p, value: baselineOverall, pass: baselineOverall != null && isHighest };
    }
    const metricScore = avgMetric(p.id, p.metricKey);
    const baselineMetricScore = avgMetric("straight", p.metricKey);
    const pass = metricScore != null && baselineMetricScore != null && metricScore < baselineMetricScore - 3; // must be meaningfully worse
    return { ...p, value: metricScore, baselineValue: baselineMetricScore, pass };
  });
  const passCount = results.filter((r) => r.pass).length;
  const accuracyPct = Math.round((passCount / PHASES.length) * 100);

  function copyResults() {
    const lines = [
      `Corvus QA Accuracy Test — ${new Date().toISOString()}`,
      `Overall: ${passCount}/${PHASES.length} phases correct (${accuracyPct}%)`,
      ...results.map((r) =>
        `- ${r.id}: ${r.pass ? "PASS" : "FAIL"} (baseline overall=${baselineOverall?.toFixed(1) ?? "?"}, ` +
        (r.metricKey ? `${r.metricKey} score ${r.baselineValue?.toFixed(1) ?? "?"} -> ${r.value?.toFixed(1) ?? "?"})` : `value=${r.value?.toFixed(1) ?? "?"})`)
      ),
    ];
    navigator.clipboard?.writeText(lines.join("\n"));
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 99500, background: "rgba(2,6,12,.85)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div dir={isAr ? "rtl" : "ltr"} style={{ width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto", background: bg, border: `1px solid ${border}`, borderRadius: 16, padding: 26, fontFamily: "'Inter',system-ui,sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: text }}>
            🧪 {isAr ? "اختبار دقة QA" : "QA Accuracy Test"}
          </h2>
          <button onClick={onClose} aria-label={isAr ? "إغلاق" : "Close"} style={{ background: "none", border: "none", color: muted, fontSize: 20, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        {!camActive && (
          <div style={{ padding: "12px 14px", background: "rgba(245,158,11,.1)", border: "1px solid rgba(245,158,11,.3)", borderRadius: 10, fontSize: 12.5, color: "#fbbf24", marginBottom: 16 }}>
            {isAr ? "لازم تبدأ الكاميرا الأول من الصفحة اللي وراها." : "Start the camera on the page behind this first."}
          </div>
        )}

        {phaseIdx === -1 && !done && (
          <>
            <p style={{ fontSize: 13, color: muted, lineHeight: 1.7, marginBottom: 18 }}>
              {isAr
                ? `هتعمل ٤ وضعيات، كل واحدة ${PHASE_SECONDS} ثواني. خليك في نفس المكان قدام الكاميرا طول الوقت.`
                : `You'll hold 4 postures, ${PHASE_SECONDS}s each. Stay in the same spot in front of the camera throughout.`}
            </p>
            {PHASES.map((p, i) => (
              <div key={p.id} style={{ fontSize: 12.5, color: text, padding: "7px 0", borderBottom: i < PHASES.length - 1 ? `1px solid ${border}` : "none" }}>
                {i + 1}. {isAr ? p.ar : p.en}
              </div>
            ))}
            <button
              onClick={() => startPhase(0)}
              disabled={!camActive}
              style={{ marginTop: 20, width: "100%", padding: "11px 0", borderRadius: 10, border: "none", background: camActive ? "linear-gradient(135deg,#1158c7,#0891b2)" : "rgba(148,163,184,.15)", color: camActive ? "#fff" : muted, fontWeight: 700, fontSize: 14, cursor: camActive ? "pointer" : "not-allowed" }}
            >
              {isAr ? "ابدأ الاختبار" : "Start test"}
            </button>
          </>
        )}

        {phaseIdx >= 0 && !done && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>
              {isAr ? `مرحلة ${phaseIdx + 1} من ${PHASES.length}` : `Phase ${phaseIdx + 1} of ${PHASES.length}`}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: text, marginBottom: 22, lineHeight: 1.5 }}>
              {isAr ? PHASES[phaseIdx].ar : PHASES[phaseIdx].en}
            </div>
            <div style={{ fontSize: 42, fontWeight: 800, color: "#60a5fa" }}>{secondsLeft}</div>
            <div style={{ fontSize: 11, color: muted, marginTop: 6 }}>
              {isAr ? "السكور الحالي:" : "Live score:"} {analysis?.overall != null ? Math.round(analysis.overall) : "—"}
            </div>
          </div>
        )}

        {done && (
          <>
            <div style={{ textAlign: "center", padding: "10px 0 22px" }}>
              <div style={{ fontSize: 38, fontWeight: 800, color: accuracyPct >= 75 ? "#34d399" : accuracyPct >= 50 ? "#fbbf24" : "#f87171" }}>
                {accuracyPct}%
              </div>
              <div style={{ fontSize: 12.5, color: muted, marginTop: 4 }}>
                {isAr ? `${passCount} من ${PHASES.length} مراحل صح` : `${passCount} of ${PHASES.length} phases correct`}
              </div>
            </div>
            {results.map((r) => (
              <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${border}`, fontSize: 12.5 }}>
                <span style={{ color: text }}>{isAr ? r.ar : r.en}</span>
                <span style={{ color: r.pass ? "#34d399" : "#f87171", fontWeight: 700 }}>{r.pass ? "✓" : "✗"}</span>
              </div>
            ))}
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={copyResults} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${border}`, background: "rgba(148,163,184,.06)", color: text, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                {isAr ? "انسخ النتيجة" : "Copy results"}
              </button>
              <button onClick={() => { setPhaseIdx(-1); setDone(false); setSamples({}); samplesRef.current = {}; }} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#1158c7,#0891b2)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                {isAr ? "اختبار تاني" : "Test again"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
