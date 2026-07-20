import { useState, useRef, useEffect, useCallback } from "react";
import { playSuccessChime, playPostureAlert } from "./PostureUtils.jsx";

// ── Desk-friendly guided break routine ──────────────────────────────
// Each entry: icon, name/desc (EN+AR), and a duration in seconds.
const EXERCISES = [
  { icon:"🔄", en:"Neck Rolls",          ar:"تدوير الرقبة",
    dens:"Slowly roll your head in a full circle — 5 times each direction.",
    dar:"دوّر رأسك ببطء في دائرة كاملة — 5 مرات في كل اتجاه.", dur:30 },
  { icon:"💪", en:"Shoulder Shrugs",     ar:"رفع الكتفين",
    dens:"Lift both shoulders up to your ears, hold 3s, then release. Repeat 10×.",
    dar:"ارفع كتفيك ناحية أذنيك، اثبت 3 ثوانٍ ثم أرخِ. كرّر 10 مرات.", dur:20 },
  { icon:"🙆", en:"Chest Opener",        ar:"فتح الصدر",
    dens:"Clasp your hands behind your back and gently lift — open the chest.",
    dar:"شبّك يديك خلف ظهرك وارفعهما بلطف — افتح صدرك للأمام.", dur:30 },
  { icon:"🌀", en:"Seated Spinal Twist", ar:"لَف العمود الفقري",
    dens:"Sit tall, twist gently to one side, hold, then the other. 15s each.",
    dar:"اجلس مستقيماً، لُف جذعك بلطف لجهة ثم الأخرى. 15 ثانية لكل جهة.", dur:30 },
  { icon:"✋", en:"Wrist & Finger Stretch", ar:"إطالة الرسغ والأصابع",
    dens:"Extend each arm, gently pull the fingers back, then flex. Ease typing strain.",
    dar:"مُدّ ذراعك واسحب أصابعك للخلف بلطف ثم اثنِها. يخفّف إجهاد الكتابة.", dur:20 },
  { icon:"👁️", en:"Eyes: 20-20-20",     ar:"العينان: 20-20-20",
    dens:"Look at something ~6 metres away for 20 seconds to rest your eyes.",
    dar:"انظر إلى شيء يبعد ~6 أمتار لمدة 20 ثانية لإراحة عينيك.", dur:20 },
  { icon:"🧍", en:"Stand & Reach",       ar:"قِف وامتدّ",
    dens:"Stand up, reach both arms overhead and stretch tall. Take a deep breath.",
    dar:"قِف، ارفع ذراعيك لأعلى وامتدّ لأقصى ارتفاع. خذ نفساً عميقاً.", dur:20 },
];

export default function BreakPage({ cs, lang="en", onExit, muted=false }) {
  const isAr = lang === "ar";
  const dir  = isAr ? "rtl" : "ltr";
  const [idx, setIdx]         = useState(0);
  const [secs, setSecs]       = useState(EXERCISES[0].dur);
  const [running, setRunning] = useState(false);
  const [doneSet, setDoneSet] = useState(() => new Set());
  const [finished, setFinished] = useState(false);
  const tickRef = useRef(null);

  const ex = EXERCISES[idx];
  const total = EXERCISES.length;

  const clearTick = () => { if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; } };
  useEffect(() => () => clearTick(), []);

  // Reset the countdown whenever we land on a new exercise.
  useEffect(() => { setSecs(EXERCISES[idx].dur); setRunning(false); clearTick(); }, [idx]);

  const goNext = useCallback(() => {
    setDoneSet(prev => { const n = new Set(prev); n.add(idx); return n; });
    if (idx < total - 1) setIdx(i => i + 1);
    else { clearTick(); setFinished(true); if (!muted) playSuccessChime(); }
  }, [idx, total, muted]);

  const start = () => {
    if (running) return;
    if (secs === 0) setSecs(ex.dur);
    setRunning(true);
    clearTick();
    tickRef.current = setInterval(() => {
      setSecs(prev => {
        if (prev <= 1) {
          clearTick();
          setRunning(false);
          if (!muted) playPostureAlert(0.15);
          // brief beat, then advance
          setTimeout(() => goNext(), 700);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };
  const pause = () => { setRunning(false); clearTick(); };

  const pct = ex.dur > 0 ? Math.round(((ex.dur - secs) / ex.dur) * 100) : 0;
  const card = cs?.card || "#0a1526";
  const border = cs?.border || "rgba(148,163,184,.15)";
  const text = cs?.text || "#f0f6ff";
  const muted2 = cs?.muted || "#64748b";
  const ACCENT = "#0ea5e9";

  const box = { background:card, border:`1px solid ${border}`, borderRadius:16 };
  const btn = (bg, col, extra={}) => ({ background:bg, color:col, border:"none", borderRadius:11,
    padding:"13px 0", fontSize:14, fontWeight:700, cursor:"pointer", ...extra });

  return (
    <div dir={dir} style={{ minHeight:"100vh", background:cs?.bg||"#050b16", color:text,
      fontFamily:"'Inter',system-ui,sans-serif", display:"flex", flexDirection:"column", alignItems:"center" }}>
      {/* Header */}
      <div style={{ width:"100%", maxWidth:560, display:"flex", alignItems:"center",
        justifyContent:"space-between", padding:"16px 18px", borderBottom:`1px solid ${border}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:9 }}>
          <span style={{ fontSize:20 }}>🧘</span>
          <div>
            <div style={{ fontSize:15, fontWeight:800 }}>{isAr?"استراحة الحركة":"Movement Break"}</div>
            <div style={{ fontSize:11, color:muted2 }}>{isAr?"دقيقتان تعيدان ضبط وضعيتك":"Two minutes to reset your posture"}</div>
          </div>
        </div>
        <button onClick={onExit} style={{ background:"rgba(148,163,184,.1)", border:`1px solid ${border}`,
          borderRadius:9, padding:"7px 13px", fontSize:12, color:muted2, cursor:"pointer" }}>
          {isAr?"العودة للجلسة →":"← Back to session"}
        </button>
      </div>

      <div style={{ width:"100%", maxWidth:560, padding:"20px 18px", flex:1 }}>
        {finished ? (
          <div style={{ ...box, padding:"40px 24px", textAlign:"center" }}>
            <div style={{ fontSize:52, marginBottom:12 }}>🎉</div>
            <div style={{ fontSize:19, fontWeight:800, marginBottom:6 }}>{isAr?"انتهت الاستراحة!":"Break complete!"}</div>
            <div style={{ fontSize:13, color:muted2, marginBottom:24, lineHeight:1.6 }}>
              {isAr?"عمل رائع — جسمك شاكرك. ارجع لجلستك بوضعية أفضل.":"Great job — your body thanks you. Head back with a fresher posture."}
            </div>
            <button onClick={onExit} style={btn(`linear-gradient(135deg,${ACCENT},#2563eb)`,"#fff",{ padding:"14px 40px", width:"auto" })}>
              {isAr?"العودة للجلسة":"Back to session"}
            </button>
          </div>
        ) : (
          <>
            {/* Progress */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
              <span style={{ fontSize:12, color:muted2, fontWeight:600 }}>
                {isAr?`تمرين ${idx+1} من ${total}`:`Exercise ${idx+1} of ${total}`}
              </span>
              <div style={{ display:"flex", gap:5 }}>
                {EXERCISES.map((_,i)=>(
                  <div key={i} style={{ width:i===idx?22:8, height:8, borderRadius:99, transition:"all .3s",
                    background: doneSet.has(i)?"#10b981" : i===idx?ACCENT : "rgba(148,163,184,.22)" }}/>
                ))}
              </div>
            </div>

            {/* Current exercise */}
            <div style={{ ...box, padding:"26px 22px", textAlign:"center", marginBottom:16 }}>
              <div style={{ fontSize:52, marginBottom:12 }}>{ex.icon}</div>
              <div style={{ fontSize:19, fontWeight:800, marginBottom:8 }}>{isAr?ex.ar:ex.en}</div>
              <div style={{ fontSize:13, color:muted2, lineHeight:1.7, maxWidth:380, margin:"0 auto 20px" }}>
                {isAr?ex.dar:ex.dens}
              </div>

              {/* Countdown ring */}
              <div style={{ position:"relative", width:120, height:120, margin:"0 auto 18px" }}>
                <div style={{ position:"absolute", inset:0, borderRadius:"50%",
                  background:`conic-gradient(${ACCENT} ${pct*3.6}deg, rgba(148,163,184,.14) 0deg)` }}/>
                <div style={{ position:"absolute", inset:8, borderRadius:"50%", background:card,
                  display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
                  <div style={{ fontSize:34, fontWeight:900, lineHeight:1, color: secs<=5&&running?"#f59e0b":text }}>{secs}</div>
                  <div style={{ fontSize:10, color:muted2, marginTop:2 }}>{isAr?"ثانية":"sec"}</div>
                </div>
              </div>

              {!running
                ? <button onClick={start} style={btn(`linear-gradient(135deg,${ACCENT},#2563eb)`,"#fff",{ width:"70%" })}>
                    {secs===ex.dur ? (isAr?"ابدأ التمرين":"Start exercise") : (isAr?"متابعة":"Resume")}
                  </button>
                : <button onClick={pause} style={btn("rgba(148,163,184,.12)",text,{ width:"70%", border:`1px solid ${border}` })}>
                    {isAr?"إيقاف مؤقت":"Pause"}
                  </button>}
            </div>

            {/* Nav controls */}
            <div style={{ display:"flex", gap:8, marginBottom:20 }}>
              <button onClick={()=>setIdx(i=>Math.max(0,i-1))} disabled={idx===0}
                style={btn("rgba(148,163,184,.08)",idx===0?"rgba(148,163,184,.3)":muted2,
                  { flex:1, fontSize:13, border:`1px solid ${border}`, cursor:idx===0?"not-allowed":"pointer" })}>
                {isAr?"← السابق":"← Prev"}
              </button>
              <button onClick={goNext}
                style={btn("rgba(14,165,233,.12)",ACCENT,{ flex:2, fontSize:13, border:"1px solid rgba(14,165,233,.3)" })}>
                {idx<total-1 ? (isAr?"التالي →":"Next →") : (isAr?"إنهاء →":"Finish →")}
              </button>
            </div>

            {/* Full list */}
            <div style={{ ...box, overflow:"hidden" }}>
              {EXERCISES.map((e,i)=>(
                <div key={i} onClick={()=>setIdx(i)} style={{ display:"flex", alignItems:"center", gap:11,
                  padding:"11px 14px", cursor:"pointer",
                  borderBottom:i<total-1?`1px solid ${border}`:"none",
                  background:i===idx?"rgba(14,165,233,.06)":"transparent" }}>
                  <span style={{ fontSize:18, width:24, textAlign:"center", flexShrink:0 }}>{e.icon}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12.5, fontWeight:600, color:text }}>{isAr?e.ar:e.en}</div>
                    <div style={{ fontSize:10, color:muted2 }}>{e.dur}{isAr?" ثانية":"s"}</div>
                  </div>
                  <span style={{ fontSize:13, flexShrink:0,
                    color: doneSet.has(i)?"#10b981" : i===idx?ACCENT : muted2 }}>
                    {doneSet.has(i) ? "✓" : i===idx ? "▶" : ""}
                  </span>
                </div>
              ))}
            </div>

            <button onClick={onExit} style={{ width:"100%", marginTop:14, background:"none", border:"none",
              fontSize:12, color:muted2, cursor:"pointer", padding:6 }}>
              {isAr?"تخطّي الاستراحة والعودة":"Skip break and go back"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
