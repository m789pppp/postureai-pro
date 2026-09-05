import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  PROTOCOL, PHASE_SECONDS, SETTLE_SECONDS, METRIC_UNITS,
  evaluateRun, aggregate, loadTrials, saveTrials, clearTrials, fmtPct,
} from "./lib/qaAccuracy.js";

/**
 * QA validation protocol — internal tool, not for end users.
 *
 * Replaces a version that reported a single "accuracy %" from four phases,
 * every one of which was a deliberate fault. A detector that flagged
 * absolutely everything scored 100% on it, and there was no way to tell.
 *
 * What changed, in order of how badly it mattered:
 *
 *  - Half the phases are now CONTROLS: good posture held differently, where
 *    the engine must stay quiet. False positives were invisible before.
 *  - Ground truth is the engine's OWN alert list, not a score compared to a
 *    threshold invented in this file. The question is "did the product tell
 *    the user about this?", which is the question that matters.
 *  - Unreliable frames are dropped. The engine returns score 90 for a metric
 *    it could not measure; averaging those in biased the result against
 *    exactly the postures that are hardest to track.
 *  - The first three seconds of each phase are discarded — the tester is
 *    still moving into position.
 *  - The old phase 2 asked whether `neck_lean` moved when you bend your neck
 *    DOWN. neck_lean is lateral; flexion shows up in fhp_index. It was
 *    failing a working engine.
 *  - Every proportion carries a confidence interval, and trials accumulate
 *    across runs so it narrows with evidence instead of by assertion.
 */
export function QAAccuracyTest({ analysis, camActive, isAr = false, cs, onClose }) {
  const [phaseIdx, setPhaseIdx] = useState(-1);
  const [msLeft, setMsLeft]     = useState(PHASE_SECONDS * 1000);
  const [running, setRunning]   = useState(false);
  const [report, setReport]     = useState(null);
  const [banked, setBanked]     = useState(() => loadTrials());
  const [detail, setDetail]     = useState(false);

  const framesRef  = useRef({});
  const startedRef = useRef(0);
  const rafRef     = useRef(null);
  const seenRef    = useRef(null);

  const bg     = cs?.card   || "#0b1420";
  const border = cs?.border || "rgba(148,163,184,.15)";
  const text   = cs?.text   || "#e6edf3";
  const muted  = cs?.muted  || "#94a3b8";
  const phase  = phaseIdx >= 0 ? PROTOCOL[phaseIdx] : null;

  // ── Sampling ────────────────────────────────────────────────────
  // Every distinct analysis object is one frame. `seenRef` stops the same
  // object being recorded twice when the effect re-runs for another reason —
  // a duplicated frame is a fabricated observation.
  useEffect(() => {
    if (!running || !phase || !analysis || analysis.overall == null) return;
    if (seenRef.current === analysis) return;
    seenRef.current = analysis;
    (framesRef.current[phase.id] ||= []).push({
      t: Date.now(),
      metrics: analysis.metrics || {},
      // The engine's own alert keys — the product's actual output, which is
      // what a validation run should be judging.
      alertKeys: (analysis.alerts?.detailed || []).map(a => a.key).filter(Boolean),
      // `alerts.detailed` is a property on an Array and does not survive JSON,
      // so it is absent whenever analysis came back from the cloud endpoint
      // instead of the on-device engine. Recorded per frame so the report can
      // refuse to publish a number it cannot compute.
      hasDetailed: !!analysis.alerts?.detailed,
    });
  }, [analysis, running, phase]);

  const startPhase = useCallback((idx) => {
    framesRef.current[PROTOCOL[idx].id] = [];
    startedRef.current = Date.now();
    setPhaseIdx(idx);
    setMsLeft(PHASE_SECONDS * 1000);
    setRunning(true);
  }, []);

  // A rAF countdown rather than setInterval: a 1s interval in a background
  // tab is throttled to once a minute, which silently stretched a 10-second
  // phase into minutes of "hold this position".
  useEffect(() => {
    if (!running) return;
    let alive = true;
    const tick = () => {
      if (!alive) return;
      const left = PHASE_SECONDS * 1000 - (Date.now() - startedRef.current);
      if (left <= 0) {
        setMsLeft(0);
        setRunning(false);
        const next = phaseIdx + 1;
        if (next < PROTOCOL.length) setTimeout(() => startPhase(next), 1200);
        else {
          const r = evaluateRun(framesRef.current);
          setReport(r);
          // An unusable run banks nothing — its trials would poison the
          // cumulative figure that is the number actually worth citing.
          if (!r.unusable) setBanked(saveTrials([...loadTrials(), ...r.trials]));
        }
        return;
      }
      setMsLeft(left);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { alive = false; cancelAnimationFrame(rafRef.current); };
  }, [running, phaseIdx, startPhase]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const secsLeft = Math.ceil(msLeft / 1000);
  const settling = running && (Date.now() - startedRef.current) < SETTLE_SECONDS * 1000;
  const cumulative = useMemo(() => aggregate(banked), [banked]);

  function exportJSON() {
    const blob = { generated: new Date().toISOString(), run: report, cumulative, trials: banked };
    navigator.clipboard?.writeText(JSON.stringify(blob, null, 2));
  }

  const L = (en, ar) => (isAr ? ar : en);
  const pct = v => (v == null ? "—" : `${Math.round(v * 100)}%`);
  const num = (v, d = 1) => (v == null ? "—" : v.toFixed(d));

  const headlineColor = report?.balanced == null ? muted
    : report.balanced >= 0.85 ? "#34d399" : report.balanced >= 0.65 ? "#fbbf24" : "#f87171";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 99500, background: "rgba(2,6,12,.85)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div dir={isAr ? "rtl" : "ltr"} style={{ width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", background: bg, border: `1px solid ${border}`, borderRadius: 16, padding: 24, fontFamily: "'Inter',system-ui,sans-serif" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16.5, fontWeight: 800, color: text }}>
            🧪 {L("Engine validation run", "اختبار التحقق من المحرك")}
          </h2>
          <button onClick={onClose} aria-label={L("Close", "إغلاق")} style={{ background: "none", border: "none", color: muted, fontSize: 20, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        {!camActive && (
          <div style={{ padding: "12px 14px", background: "rgba(245,158,11,.1)", border: "1px solid rgba(245,158,11,.3)", borderRadius: 10, fontSize: 12.5, color: "#fbbf24", marginBottom: 16 }}>
            {L("Start the camera on the page behind this first.", "لازم تبدأ الكاميرا الأول من الصفحة اللي وراها.")}
          </div>
        )}

        {/* ── Intro ── */}
        {phaseIdx === -1 && !report && (
          <>
            <p style={{ fontSize: 12.5, color: muted, lineHeight: 1.75, marginBottom: 12 }}>
              {L(`${PROTOCOL.length} postures, ${PHASE_SECONDS}s each. The first ${SETTLE_SECONDS}s of each are discarded while you settle. Stay in the same seat throughout.`,
                 `${PROTOCOL.length} وضعيات، كل واحدة ${PHASE_SECONDS} ثانية. أول ${SETTLE_SECONDS} ثواني بتتلغي وانت بتستقر. خليك في نفس المكان طول الوقت.`)}
            </p>
            {/* Saying plainly what this cannot measure is the difference
                between a QA tool and a marketing number. */}
            <div style={{ padding: "11px 13px", background: "rgba(99,102,241,.07)", border: "1px solid rgba(99,102,241,.2)", borderRadius: 10, fontSize: 11.5, color: muted, lineHeight: 1.7, marginBottom: 16 }}>
              {L("This measures whether the engine flags real faults and stays quiet on good posture — with the instructed posture as ground truth. It is NOT angular accuracy: there is no reference instrument behind a webcam, so no number here says the reported degrees are correct.",
                 "ده بيقيس هل المحرك بيكشف الأخطاء الحقيقية وبيسكت على الوضعية السليمة — والمرجع هنا هو الوضعية المطلوبة. مش دقة زوايا: مفيش جهاز مرجعي ورا الويب كام، فمفيش رقم هنا بيقول إن الدرجات المعروضة صح.")}
            </div>
            {PROTOCOL.map((p, i) => (
              <div key={p.id} style={{ fontSize: 12, color: text, padding: "7px 0", borderBottom: i < PROTOCOL.length - 1 ? `1px solid ${border}` : "none", display: "flex", gap: 8 }}>
                <span style={{ color: p.kind === "fault" ? "#f87171" : "#34d399", fontWeight: 700, minWidth: 58, fontSize: 10, paddingTop: 2 }}>
                  {p.kind === "fault" ? L("FAULT", "خطأ") : L("CONTROL", "ضبط")}
                </span>
                <span style={{ lineHeight: 1.5 }}>{L(p.en, p.ar)}</span>
              </div>
            ))}
            {cumulative.nTrials > 0 && (
              <div style={{ marginTop: 14, fontSize: 11.5, color: muted }}>
                {L(`${cumulative.nTrials} trials banked from previous runs — balanced accuracy ${fmtPct(cumulative.balanced, cumulative.balancedLo, cumulative.balancedHi)}`,
                   `${cumulative.nTrials} تجربة محفوظة من جولات سابقة — الدقة المتوازنة ${fmtPct(cumulative.balanced, cumulative.balancedLo, cumulative.balancedHi)}`)}
              </div>
            )}
            <button onClick={() => { framesRef.current = {}; startPhase(0); }} disabled={!camActive}
              style={{ marginTop: 18, width: "100%", padding: "11px 0", borderRadius: 10, border: "none", background: camActive ? "linear-gradient(135deg,#1158c7,#0891b2)" : "rgba(148,163,184,.15)", color: camActive ? "#fff" : muted, fontWeight: 700, fontSize: 14, cursor: camActive ? "pointer" : "not-allowed" }}>
              {L("Start run", "ابدأ الجولة")}
            </button>
          </>
        )}

        {/* ── Running ── */}
        {phase && !report && (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: phase.kind === "fault" ? "#f87171" : "#34d399", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 8 }}>
              {phase.kind === "fault" ? L("FAULT", "خطأ") : L("CONTROL", "ضبط")} · {phaseIdx + 1}/{PROTOCOL.length}
            </div>
            <div style={{ fontSize: 15.5, fontWeight: 700, color: text, marginBottom: 18, lineHeight: 1.55 }}>
              {L(phase.en, phase.ar)}
            </div>
            <div style={{ fontSize: 44, fontWeight: 800, color: settling ? muted : "#60a5fa" }}>{secsLeft}</div>
            <div style={{ fontSize: 11, color: settling ? "#fbbf24" : muted, marginTop: 6, minHeight: 16 }}>
              {settling
                ? L("settling — not recording yet", "بيستقر — لسه مش بيسجّل")
                : L(`recording · live score ${analysis?.overall != null ? Math.round(analysis.overall) : "—"}`,
                    `بيسجّل · السكور ${analysis?.overall != null ? Math.round(analysis.overall) : "—"}`)}
            </div>
          </div>
        )}

        {/* A run that cannot be scored says so instead of printing 0%. */}
        {report?.unusable && (
          <div style={{ padding: "14px 15px", background: "rgba(245,158,11,.1)", border: "1px solid rgba(245,158,11,.3)", borderRadius: 10, fontSize: 12.5, color: "#fbbf24", lineHeight: 1.75 }}>
            {L("This run can't be scored: the frames carried no structured alert data, which means analysis was running through the cloud endpoint rather than on-device. Switch to on-device analysis and run it again — scoring a cloud run would report 0% sensitivity against an engine that is working fine.",
               "الجولة دي مش هينفع تتحسب: الفريمات مجاش معاها بيانات التنبيهات، يعني التحليل كان شغال على السيرفر مش على الجهاز. حوّل للتحليل المحلي وشغّلها تاني — لو حسبناها هتطلع حساسية ٠٪ لمحرك شغال تمام.")}
            <button onClick={() => { framesRef.current = {}; setReport(null); setPhaseIdx(-1); }}
              style={{ display: "block", marginTop: 12, padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(245,158,11,.4)", background: "none", color: "#fbbf24", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
              {L("Back", "رجوع")}
            </button>
          </div>
        )}

        {/* ── Report ── */}
        {report && !report.unusable && (
          <>
            <div style={{ textAlign: "center", padding: "6px 0 18px" }}>
              <div style={{ fontSize: 34, fontWeight: 800, color: headlineColor }}>{pct(report.balanced)}</div>
              <div style={{ fontSize: 11.5, color: muted, marginTop: 3 }}>
                {L("balanced accuracy, this run", "الدقة المتوازنة، الجولة دي")}
              </div>
              {/* The interval is not an optional decoration. Seven trials
                  cannot support a precise percentage, and printing one without
                  its width is how a QA figure ends up in a brochure. */}
              <div style={{ fontSize: 11, color: muted, marginTop: 5 }}>
                95% CI {pct(report.balancedLo)}–{pct(report.balancedHi)} · {report.nTrials} {L("trials", "تجربة")}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              {[
                { label: L("Sensitivity", "الحساسية"), sub: L("faults caught", "أخطاء اتكشفت"), v: report.sensitivity },
                { label: L("Specificity", "النوعية"), sub: L("good posture left alone", "وضعية سليمة ما اتضايقتش"), v: report.specificity },
              ].map(c => (
                <div key={c.label} style={{ flex: 1, padding: "11px 12px", background: "rgba(148,163,184,.05)", border: `1px solid ${border}`, borderRadius: 10 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: text }}>{pct(c.v.p)}</div>
                  <div style={{ fontSize: 10.5, color: muted, marginTop: 2 }}>{c.label} · {c.v.k}/{c.v.n}</div>
                  <div style={{ fontSize: 9.5, color: muted, marginTop: 3, lineHeight: 1.4 }}>{c.sub}</div>
                </div>
              ))}
            </div>

            {cumulative.nTrials > report.nTrials && (
              <div style={{ padding: "11px 13px", background: "rgba(16,185,129,.06)", border: "1px solid rgba(16,185,129,.2)", borderRadius: 10, fontSize: 11.5, color: muted, lineHeight: 1.7, marginBottom: 16 }}>
                <strong style={{ color: text }}>{L("All runs", "كل الجولات")}:</strong>{" "}
                {fmtPct(cumulative.balanced, cumulative.balancedLo, cumulative.balancedHi)} · {cumulative.nTrials} {L("trials", "تجربة")}
                <div style={{ marginTop: 4, fontSize: 10.5 }}>
                  {L("Run it again to narrow the interval — this is the number worth citing, not a single run.",
                     "شغّلها تاني عشان المدى يضيق — ده الرقم اللي يستاهل يتقال، مش جولة واحدة.")}
                </div>
              </div>
            )}

            {/* Per-phase */}
            {PROTOCOL.map(p => {
              const r = report.perPhase[p.id];
              if (!r) return null;
              const ok = p.kind === "fault" ? r.flagged === true : r.flagged === false;
              return (
                <div key={p.id} style={{ padding: "9px 0", borderBottom: `1px solid ${border}`, fontSize: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <span style={{ color: text, lineHeight: 1.45 }}>{L(p.en, p.ar)}</span>
                    <span style={{ color: r.incomplete ? "#fbbf24" : ok ? "#34d399" : "#f87171", fontWeight: 700 }}>
                      {r.incomplete ? "—" : ok ? "✓" : "✗"}
                    </span>
                  </div>
                  <div style={{ fontSize: 10.5, color: muted, marginTop: 3, lineHeight: 1.5 }}>
                    {r.incomplete
                      ? L("no usable frames — not counted for or against the engine", "مفيش فريمات صالحة — مش محسوبة للمحرك ولا عليه")
                      : p.kind === "fault"
                        ? `${p.target}: ${num(r.baselineMeanValue)} → ${num(r.meanValue)}${METRIC_UNITS[p.target] || ""} · d=${num(r.d, 2)} · ${L("alert held", "التنبيه فضل")} ${pct(r.alertRate)}`
                        : `${L("alerts during this phase", "تنبيهات في المرحلة دي")}: ${pct(r.alertRate)}`}
                    {r.reliableRate != null && r.reliableRate < 0.8 && (
                      <span style={{ color: "#fbbf24" }}> · {L("only", "بس")} {pct(r.reliableRate)} {L("of frames were measurable", "من الفريمات كانت قابلة للقياس")}</span>
                    )}
                  </div>
                </div>
              );
            })}

            <button onClick={() => setDetail(d => !d)} style={{ marginTop: 12, background: "none", border: "none", color: "#60a5fa", fontSize: 11.5, fontWeight: 600, cursor: "pointer", padding: 0 }}>
              {detail ? L("Hide measurement detail", "إخفاء تفاصيل القياس") : L("Show measurement detail", "عرض تفاصيل القياس")}
            </button>

            {detail && (
              <div style={{ marginTop: 12, fontSize: 11, color: muted, lineHeight: 1.75 }}>
                <div style={{ fontWeight: 700, color: text, marginBottom: 4 }}>
                  {L("Noise floor at rest", "أرضية الضوضاء وانت ثابت")}
                </div>
                <div style={{ marginBottom: 10 }}>
                  {L("The engine cannot honestly detect a change smaller than this.",
                     "المحرك مش ممكن يكشف تغيّر أصغر من كده بصدق.")}
                  <br />
                  {Object.entries(report.noise).map(([k, v]) => `${k} ±${v.sd.toFixed(2)}${v.unit}`).join(" · ") || "—"}
                </div>

                <div style={{ fontWeight: 700, color: text, marginBottom: 4 }}>
                  {L("Repeatability — same posture, twice", "التكرارية — نفس الوضعية مرتين")}
                </div>
                <div style={{ marginBottom: 10 }}>
                  {Object.entries(report.repeat).map(([k, v]) => `${k} Δ${v.delta.toFixed(2)}${v.unit}`).join(" · ") || "—"}
                </div>

                <div style={{ fontWeight: 700, color: text, marginBottom: 4 }}>
                  {L("Cross-talk", "التداخل")}
                </div>
                <div style={{ marginBottom: 4 }}>
                  {L("Which other metrics moved during each fault. A clean engine moves the metric the fault is about and leaves the rest alone — the per-metric breakdown users see is only meaningful if that holds.",
                     "أنهي متريكات تانية اتحركت مع كل خطأ. المحرك النضيف بيحرّك المتريك بتاع الخطأ بس. التفصيل اللي اليوزر بيشوفه ملوش معنى غير كده.")}
                </div>
                {Object.entries(report.crosstalk).map(([phaseId, m]) => (
                  <div key={phaseId} style={{ marginBottom: 3 }}>
                    <span style={{ color: text }}>{phaseId}</span>: {Object.entries(m).map(([k, d]) => `${k} (d=${d.toFixed(1)})`).join(", ") || "—"}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 20, flexWrap: "wrap" }}>
              <button onClick={exportJSON} style={{ flex: "1 1 40%", padding: "10px 0", borderRadius: 10, border: `1px solid ${border}`, background: "rgba(148,163,184,.06)", color: text, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
                {L("Copy full report", "انسخ التقرير")}
              </button>
              <button onClick={() => { framesRef.current = {}; setReport(null); startPhase(0); }} style={{ flex: "1 1 40%", padding: "10px 0", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#1158c7,#0891b2)", color: "#fff", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
                {L("Run again", "جولة تانية")}
              </button>
              <button onClick={() => setBanked(clearTrials())} style={{ flex: "1 1 100%", padding: "8px 0", borderRadius: 10, border: `1px solid ${border}`, background: "none", color: muted, fontWeight: 600, fontSize: 11.5, cursor: "pointer" }}>
                {L("Reset banked trials", "امسح التجارب المحفوظة")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
