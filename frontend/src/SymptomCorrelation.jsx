/**
 * Corvus — Symptom Correlation Engine v1
 * Daily self-reported symptom check-in, cross-referenced against real
 * posture session data. Complements the live, metrics-only pain_prediction
 * shown during a session with an after-the-fact, explainable correlation.
 */
import { useState, useEffect, useCallback } from "react";
import { db } from "./firebase.js";
import { doc, setDoc, getDoc, collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";

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

function todayStr() {
  return new Date().toISOString().slice(0,10);
}

export function SymptomCorrelation({ cs, lang="en", onClose }) {
  const isAr = lang === "ar";
  const [tab, setTab] = useState("checkin"); // checkin | history | insights
  const [selected, setSelected] = useState({}); // {type: severity}
  const [saving, setSaving] = useState(false);
  const [savedToday, setSavedToday] = useState(false);

  const [insights, setInsights] = useState(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [note, setNote] = useState(null);

  const [history, setHistory] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyPeriod, setHistoryPeriod] = useState("30d");

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
      // Write directly to Firestore — no Railway backend needed
      const uid = profile?.uid;
      if (!uid) throw new Error("No user");
      await setDoc(doc(db, "symptom_logs", `${uid}_${todayStr()}`), {
        uid, date: todayStr(), symptoms,
        saved_at: new Date().toISOString(),
      }, { merge: true });
      setSavedToday(true);
    } catch (e) {
      // silent — non-critical background feature
    } finally {
      setSaving(false);
    }
  };

  const loadInsights = useCallback(() => {
    setLoadingInsights(true);
    // Compute correlation locally from Firestore symptom logs + sessions
    (async () => {
      try {
        const uid = profile?.uid;
        if (!uid) { setInsights([]); return; }
        const cutoff = new Date(Date.now() - 90*24*3600000).toISOString().slice(0,10);
        const snap = await getDocs(query(
          collection(db, "symptom_logs"),
          where("uid","==",uid),
          where("date",">=",cutoff),
          orderBy("date","desc"),
          limit(90)
        ));
        const logs = snap.docs.map(d => d.data());
        // Count symptom frequency
        const freq = {};
        logs.forEach(l => l.symptoms?.forEach(s => { freq[s.type] = (freq[s.type]||0)+1; }));
        // Build insights from frequency
        const insights = Object.entries(freq)
          .sort((a,b)=>b[1]-a[1])
          .slice(0,4)
          .map(([type, count]) => {
            const sym = ["neck_pain","back_pain"].includes(type)
              ? { cause:"neck", strength: count > 10 ? "strong" : "moderate" }
              : { cause:"posture", strength: count > 5 ? "moderate" : "weak" };
            return { symptom_type: type, ...sym, occurrences: count, total_days: logs.length };
          });
        setInsights(insights);
        if (!logs.length) setNote(isAr?"سجّل أعراضك يومياً لمدة أسبوع لرؤية الربط":"Log symptoms daily for a week to see correlations");
      } catch { setInsights([]); }
      finally { setLoadingInsights(false); }
    })();
  }, []);

  const loadHistory = useCallback((period) => {
    setLoadingHistory(true);
    (async () => {
      try {
        const uid = profile?.uid;
        if (!uid) { setHistory([]); return; }
        const days = period === "30d" ? 30 : period === "7d" ? 7 : 14;
        const cutoff = new Date(Date.now() - days*24*3600000).toISOString().slice(0,10);
        const snap = await getDocs(query(
          collection(db, "symptom_logs"),
          where("uid","==",uid),
          where("date",">=",cutoff),
          orderBy("date","desc")
        ));
        setHistory(snap.docs.map(d => d.data()));
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
                    maxHeight:"88vh", overflowY:"auto", padding:24 }}>
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
                <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:18 }}>
                  {SYMPTOMS.map(s => {
                    const active = s.type in selected;
                    return (
                      <div key={s.type} style={{ ...card, padding:"12px 16px", display:"flex",
                                                  alignItems:"center", justifyContent:"space-between",
                                                  borderColor: active ? "rgba(15,118,110,.5)" : undefined,
                                                  cursor:"pointer" }}
                           onClick={()=>toggleSymptom(s.type)}>
                        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                          <span style={{ fontSize:18 }}>{s.icon}</span>
                          <span style={{ fontSize:13.5, fontWeight:600, color:"#e2e8f0" }}>{isAr?s.ar:s.en}</span>
                        </div>
                        {active && (
                          <div style={{ display:"flex", gap:4 }} onClick={e=>e.stopPropagation()}>
                            {[1,2,3,4,5].map(n => (
                              <button key={n} onClick={()=>setSeverity(s.type, n)}
                                style={{ width:24, height:24, borderRadius:"50%", border:"none", cursor:"pointer",
                                          background: n <= selected[s.type] ? "#0f766e" : "rgba(255,255,255,.08)",
                                          color: n <= selected[s.type] ? "#fff" : "#64748b", fontSize:10, fontWeight:700 }}>
                                {n}
                              </button>
                            ))}
                          </div>
                        )}
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
            {!loadingInsights && note && (
              <div style={{ ...card, textAlign:"center", color:"#94a3b8", fontSize:13 }}>{note}</div>
            )}
            {!loadingInsights && insights && insights.length === 0 && !note && (
              <div style={{ ...card, textAlign:"center", color:"#64748b" }}>
                {isAr ? "مفيش ربط واضح ظاهر لسه — سجّل كام يوم كمان" : "No clear correlation yet — log a few more days"}
              </div>
            )}
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {(insights||[]).map((ins, i) => {
                const sDef = SYMPTOMS.find(s=>s.type===ins.symptom);
                const worse = ins.direction === "worse";
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
