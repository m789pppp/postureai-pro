/**
 * Corvus — Symptom Correlation Engine v1
 * Daily self-reported symptom check-in, cross-referenced against real
 * posture session data. Complements the live, metrics-only pain_prediction
 * shown during a session with an after-the-fact, explainable correlation.
 */
import { useState, useEffect, useCallback } from "react";
import { SymptomAPI } from "./services/api.js";

const border = "1px solid rgba(255,255,255,.08)";
const card   = { background:"rgba(255,255,255,.03)", border, borderRadius:16, padding:20 };
const btnPrimary = { background:"#0f766e", color:"#fff", border:"none", borderRadius:10, padding:"10px 18px", fontSize:13, fontWeight:700, cursor:"pointer" };
const btnGhost   = { background:"transparent", color:"#94a3b8", border, borderRadius:10, padding:"9px 16px", fontSize:13, fontWeight:600, cursor:"pointer" };

const SYMPTOMS = [
  { type:"headache",      en:"Headache",       ar:"صداع",           icon:"🤕" },
  { type:"neck_pain",      en:"Neck pain",       ar:"ألم رقبة",       icon:"🦴" },
  { type:"back_pain",      en:"Back pain",       ar:"ألم ظهر",        icon:"🔻" },
  { type:"shoulder_pain",  en:"Shoulder pain",   ar:"ألم كتف",        icon:"💪" },
  { type:"eye_strain",     en:"Eye strain",      ar:"إجهاد عين",      icon:"👁️" },
  { type:"wrist_pain",     en:"Wrist pain",      ar:"ألم معصم",       icon:"✋" },
];

const CAUSE_LABEL = {
  neck:    { en:"neck lean",       ar:"ميل الرقبة" },
  yaw:     { en:"head rotation",   ar:"دوران الرأس" },
  dist:    { en:"screen distance", ar:"مسافة الشاشة" },
  posture: { en:"general posture", ar:"وضعية عامة" },
};

export function SymptomCorrelation({ cs, lang="en", onClose }) {
  const isAr = lang === "ar";
  const [tab, setTab] = useState("checkin"); // checkin | history | insights
  const [selected, setSelected] = useState({}); // {type: severity}
  const [saving, setSaving] = useState(false);
  const [savedToday, setSavedToday] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [insights, setInsights] = useState(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [note, setNote] = useState(null);
  const [insightsError, setInsightsError] = useState("");

  const [history, setHistory] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyPeriod, setHistoryPeriod] = useState("30d");

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prevOverflow; };
  }, []);

  const toggleSymptom = (type) => {
    setSelected(prev => {
      const next = { ...prev };
      if (next[type]) delete next[type];
      else next[type] = 3;
      return next;
    });
  };
  const setSeverity = (type, sev) => setSelected(prev => ({ ...prev, [type]: sev }));

  const submit = async () => {
    const symptoms = Object.entries(selected).map(([type, severity]) => ({ type, severity }));
    if (symptoms.length === 0) return;
    setSaving(true);
    try {
      // Was writing straight to a Firestore `symptom_logs` collection,
      // bypassing the backend entirely (and referencing an undefined
      // `profile` variable in the process — this component is never
      // given a profile/uid prop, so every call here threw a
      // ReferenceError the instant a user tried to save a check-in).
      // The correlation engine below (SymptomAPI.correlation, already
      // used successfully by PredictiveAI.jsx) reads from the backend's
      // own store, not that Firestore collection, so even fixing the
      // crash in place would have left symptoms saved somewhere the
      // correlation engine never sees. Log through the same backend API
      // instead — auth is handled automatically via the Firebase ID
      // token, no uid needed here at all.
      await SymptomAPI.log({ symptoms });
      setSavedToday(true);
      setSaveError("");
    } catch (e) {
      // Was `catch (e) { /* silent */ }`. A failed save left the form looking
      // untouched with no message, so a user could log symptoms every day for a
      // month and have none of it stored — and the Insights tab's "log a few
      // more days" nudge would agree with them that they simply hadn't logged
      // enough yet. Every failure mode of this feature was invisible.
      console.warn("[SymptomCorrelation] save failed:", e?.message || e);
      setSaveError(e?.message || (isAr ? "تعذر الحفظ — جرّب تاني" : "Couldn't save — try again"));
    } finally {
      setSaving(false);
    }
  };

  const loadInsights = useCallback(() => {
    setLoadingInsights(true);
    (async () => {
      try {
        // Was reimplemented as a local symptom-frequency count that
        // returned {symptom_type, cause, strength, occurrences,
        // total_days} — a completely different shape than what the
        // render below actually reads (ins.symptom, ins.direction,
        // ins.score_gap, ins.avg_score_on_symptom_days/other_days,
        // ins.days_logged, ins.dominant_alert_cause). Every field the UI
        // needed was always undefined, so the "insights" tab could never
        // show a real correlation — every symptom silently fell through
        // to "No meaningful posture-score difference" regardless of the
        // actual data, and the two avg-score lines rendered the literal
        // word "undefined". Use the real backend correlation engine
        // (same one PredictiveAI.jsx already calls successfully), which
        // returns exactly the shape this UI expects.
        const d = await SymptomAPI.correlation("90d");
        const list = Array.isArray(d) ? d : (d?.insights || []);
        setInsights(list);
        setInsightsError("");
        if (!list.length) setNote(isAr?"سجّل أعراضك يومياً لمدة أسبوع لرؤية الربط":"Log symptoms daily for a week to see correlations");
      } catch (e) {
        // `catch { setInsights([]) }` turned every failure — a 500 from the
        // missing sessions composite index, a 403, an expired token — into the
        // same benign "log a few more days" nudge. That is how this feature
        // could be completely broken and look merely patient.
        console.warn("[SymptomCorrelation] insights failed:", e?.message || e);
        setInsights([]);
        setInsightsError(e?.message || (isAr ? "تعذر تحميل الربط" : "Couldn't load correlations"));
      }
      finally { setLoadingInsights(false); }
    })();
  }, [isAr]);

  const loadHistory = useCallback((period) => {
    setLoadingHistory(true);
    (async () => {
      try {
        // Was also direct-Firestore, with the same undefined-`profile`
        // crash, plus a separate bug: the day-count mapping only handled
        // "30d"/"7d" and fell through to 14 for anything else — so
        // selecting "90d" in the tab above actually fetched just 14
        // days. SymptomAPI.history(period) takes the "7d"/"30d"/"90d"
        // strings directly, so there's no local day-count math to get
        // wrong.
        const d = await SymptomAPI.history(period);
        const list = Array.isArray(d) ? d : (d?.logs || d?.history || d?.data || []);
        setHistory(list);
      } catch { setHistory([]); }
      finally { setLoadingHistory(false); }
    })();
  }, []);

  useEffect(() => { if (tab === "insights") loadInsights(); }, [tab, loadInsights]);
  useEffect(() => { if (tab === "history") loadHistory(historyPeriod); }, [tab, historyPeriod, loadHistory]);

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.65)", zIndex:900,
                  display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#0b1220", border, borderRadius:20, width:"100%", maxWidth:560,
                    maxHeight:"88dvh", overflowY:"auto", padding:24 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ fontSize:18, fontWeight:900, color:"#e2e8f0" }}>
            {isAr ? "🩹 ربط الأعراض بالوضعية" : "🩹 Symptom Correlation"}
          </div>
          <button onClick={onClose} style={btnGhost}>{isAr ? "إغلاق" : "Close"}</button>
        </div>

        <div style={{ display:"flex", gap:8, marginBottom:18 }}>
          <button onClick={()=>setTab("checkin")} style={{
            ...btnGhost, background: tab==="checkin" ? "rgba(15,118,110,.18)" : "transparent",
            color: tab==="checkin" ? "#5eead4" : "#94a3b8",
            border: tab==="checkin" ? "1px solid rgba(15,118,110,.4)" : border,
          }}>{isAr ? "تسجيل اليوم" : "Today's Check-in"}</button>
          <button onClick={()=>setTab("history")} style={{
            ...btnGhost, background: tab==="history" ? "rgba(15,118,110,.18)" : "transparent",
            color: tab==="history" ? "#5eead4" : "#94a3b8",
            border: tab==="history" ? "1px solid rgba(15,118,110,.4)" : border,
          }}>{isAr ? "السجل" : "History"}</button>
          <button onClick={()=>setTab("insights")} style={{
            ...btnGhost, background: tab==="insights" ? "rgba(15,118,110,.18)" : "transparent",
            color: tab==="insights" ? "#5eead4" : "#94a3b8",
            border: tab==="insights" ? "1px solid rgba(15,118,110,.4)" : border,
          }}>{isAr ? "الروابط المكتشفة" : "Insights"}</button>
        </div>

        {tab === "checkin" && (
          <div>
            {savedToday ? (
              <div style={{ ...card, textAlign:"center", color:"#5eead4", fontWeight:700 }}>
                {isAr ? "تم التسجيل ✓ — شكرًا" : "Logged for today ✓ — thanks"}
              </div>
            ) : (
              <>
                <div style={{ fontSize:12.5, color:"#94a3b8", marginBottom:14 }}>
                  {isAr ? "حسّيت بإيه النهاردة؟ (اختياري، بس بيحسّن دقة الربط مع بيانات وضعيتك)" :
                          "How are you feeling today? (optional, but sharpens the correlation with your posture data)"}
                </div>
                {/* A failed save used to leave the form looking untouched. */}
                {saveError && (
                  <div style={{ ...card, padding:"10px 14px", marginBottom:14, color:"#f87171", fontSize:12.5 }}>
                    {saveError}
                  </div>
                )}
                <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:18 }}>
                  {SYMPTOMS.map(s => {
                    const active = s.type in selected;
                    return (
                      <div key={s.type} style={{ ...card, padding:"12px 16px",
                                                  borderColor: active ? "rgba(15,118,110,.5)" : undefined,
                                                  cursor:"pointer" }}
                           onClick={()=>toggleSymptom(s.type)}>
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                            <span style={{ fontSize:18 }}>{s.icon}</span>
                            <span style={{ fontSize:13.5, fontWeight:600, color:"#e2e8f0" }}>{isAr?s.ar:s.en}</span>
                          </div>
                        </div>
                        {/* Always in the layout (fixed height) so selecting a
                            symptom never pushes the rows below it — only
                            visibility/interactivity toggles, not presence. */}
                        <div
                          onClick={e=>e.stopPropagation()}
                          style={{
                            display:"flex", gap:4, marginTop: active ? 10 : 0,
                            maxHeight: active ? 28 : 0, opacity: active ? 1 : 0,
                            overflow:"hidden", pointerEvents: active ? "auto" : "none",
                            transition:"max-height .18s ease, opacity .15s ease, margin-top .18s ease",
                          }}>
                          {[1,2,3,4,5].map(n => (
                            <button key={n} onClick={()=>setSeverity(s.type, n)}
                              style={{ width:24, height:24, borderRadius:"50%", border:"none", cursor:"pointer",
                                        background: n <= selected[s.type] ? "#0f766e" : "rgba(255,255,255,.08)",
                                        color: n <= selected[s.type] ? "#fff" : "#64748b", fontSize:10, fontWeight:700 }}>
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button style={{ ...btnPrimary, width:"100%" }} disabled={saving || Object.keys(selected).length===0} onClick={submit}>
                  {saving ? (isAr?"جاري الحفظ…":"Saving…") : (isAr?"حفظ تسجيل اليوم":"Save today's check-in")}
                </button>
              </>
            )}
          </div>
        )}

        {tab === "history" && (
          <div>
            <div style={{ display:"flex", gap:6, marginBottom:14 }}>
              {["7d","30d","90d"].map(p => (
                <button key={p} onClick={()=>setHistoryPeriod(p)} style={{
                  ...btnGhost, padding:"6px 12px", fontSize:12,
                  background: historyPeriod===p ? "rgba(15,118,110,.18)" : "transparent",
                  color: historyPeriod===p ? "#5eead4" : "#94a3b8",
                  border: historyPeriod===p ? "1px solid rgba(15,118,110,.4)" : border,
                }}>{p}</button>
              ))}
            </div>
            {loadingHistory && <div style={{ color:"#64748b" }}>{isAr?"جاري التحميل…":"Loading…"}</div>}
            {!loadingHistory && history && history.length === 0 && (
              <div style={{ ...card, textAlign:"center", color:"#64748b" }}>
                {isAr ? "لسه مفيش تسجيلات في الفترة دي" : "No check-ins logged in this period yet"}
              </div>
            )}
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {(history||[]).map((log, i) => (
                <div key={i} style={card}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                    <span style={{ fontWeight:800, color:"#e2e8f0", fontSize:13 }}>{log.date}</span>
                  </div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                    {(log.symptoms||[]).map((s, j) => {
                      const sDef = SYMPTOMS.find(d=>d.type===s.type);
                      return (
                        <span key={j} style={{ display:"inline-flex", alignItems:"center", gap:5,
                          background:"rgba(255,255,255,.05)", borderRadius:20, padding:"4px 10px", fontSize:12, color:"#cbd5e1" }}>
                          {sDef?.icon || "🩹"} {sDef ? (isAr?sDef.ar:sDef.en) : s.type}
                          <span style={{ color:"#5eead4", fontWeight:700 }}>{s.severity}/5</span>
                        </span>
                      );
                    })}
                  </div>
                  {log.notes && <div style={{ fontSize:12, color:"#94a3b8", marginTop:8 }}>{log.notes}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "insights" && (
          <div>
            {loadingInsights && <div style={{ color:"#64748b" }}>{isAr?"جاري التحليل…":"Analyzing…"}</div>}
            {/* An error is not "not enough data yet" — the two used to render
                identically, so a broken backend read as a patient one. */}
            {!loadingInsights && insightsError && (
              <div style={{ ...card, textAlign:"center", color:"#f87171", fontSize:13 }}>
                {isAr ? "تعذر تحميل الربط — جرّب تاني بعد شوية" : "Couldn't load correlations — try again shortly"}
                <div style={{ color:"#64748b", fontSize:11, marginTop:6 }}>{insightsError}</div>
              </div>
            )}
            {!loadingInsights && !insightsError && note && (
              <div style={{ ...card, textAlign:"center", color:"#94a3b8", fontSize:13 }}>{note}</div>
            )}
            {!loadingInsights && !insightsError && insights && insights.length === 0 && !note && (
              <div style={{ ...card, textAlign:"center", color:"#64748b" }}>
                {isAr ? "مفيش ربط واضح ظاهر لسه — سجّل كام يوم كمان" : "No clear correlation yet — log a few more days"}
              </div>
            )}
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {(insights||[]).map((ins, i) => {
                const sDef = SYMPTOMS.find(s=>s.type===ins.symptom);
                const worse = ins.direction === "worse";
                // Backend only includes an insight when |score_gap|>=3 or a
                // dominant cause was found, so "better" (score_gap<0, i.e.
                // posture score was actually *higher* on symptom days) is a
                // real, meaningful result too — not the same as
                // "no_difference". Previously both fell into the same
                // "no meaningful difference" copy, which misrepresented a
                // real (if counter-intuitive) correlation as no correlation.
                const better = ins.direction === "better";
                const causeLabel = ins.dominant_alert_cause ? (CAUSE_LABEL[ins.dominant_alert_cause]?.[isAr?"ar":"en"] || ins.dominant_alert_cause) : null;
                return (
                  <div key={i} style={card}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                      <span style={{ fontSize:18 }}>{sDef?.icon || "🩹"}</span>
                      <span style={{ fontWeight:800, color:"#e2e8f0" }}>{sDef ? (isAr?sDef.ar:sDef.en) : ins.symptom}</span>
                      <span style={{ marginInlineStart:"auto", fontSize:11, color:"#64748b" }}>
                        {ins.days_logged} {isAr?"يوم":"days"}
                      </span>
                    </div>
                    {worse ? (
                      <div style={{ fontSize:13, color:"#e2e8f0", lineHeight:1.6 }}>
                        {isAr
                          ? `في الأيام اللي حسّيت فيها بـ${isAr?sDef?.ar:sDef?.en}، متوسط سكور وضعيتك كان أقل بـ ${ins.score_gap} نقطة${causeLabel ? ` — والسبب الأكتر تكرارًا كان ${causeLabel}` : ""}.`
                          : `On days you reported ${sDef?.en?.toLowerCase()||ins.symptom}, your average posture score was ${ins.score_gap} points lower${causeLabel ? ` — most often driven by ${causeLabel}` : ""}.`}
                      </div>
                    ) : better ? (
                      <div style={{ fontSize:13, color:"#e2e8f0", lineHeight:1.6 }}>
                        {isAr
                          ? `في الأيام اللي حسّيت فيها بـ${isAr?sDef?.ar:sDef?.en}، متوسط سكور وضعيتك كان أعلى بـ ${Math.abs(ins.score_gap)} نقطة عن باقي الأيام.`
                          : `On days you reported ${sDef?.en?.toLowerCase()||ins.symptom}, your average posture score was actually ${Math.abs(ins.score_gap)} points higher than other days.`}
                      </div>
                    ) : (
                      <div style={{ fontSize:13, color:"#94a3b8", lineHeight:1.6 }}>
                        {isAr
                          ? `مفيش فرق كبير في سكور الوضعية في الأيام دي.`
                          : `No meaningful posture-score difference on those days.`}
                      </div>
                    )}
                    <div style={{ fontSize:11, color:"#64748b", marginTop:8 }}>
                      {isAr ? "متوسط في أيام العرض" : "Avg on symptom days"}: {ins.avg_score_on_symptom_days} ·{" "}
                      {isAr ? "متوسط باقي الأيام" : "Avg other days"}: {ins.avg_score_other_days}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SymptomCorrelation;
