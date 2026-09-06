import { useState, useRef, useEffect, useCallback } from "react";
import { playSuccessChime, playPostureAlert } from "./PostureUtils.jsx";
import { routineFor, POSTURE_REFERENCE, postureChecklist, CREDIT } from "./lib/exerciseMedia.js";
import { Icon } from "./LiveUI.jsx";

// ── Desk-friendly guided break routine ──────────────────────────────
// The routine itself lives in lib/exerciseMedia.js alongside its illustrations
// and their licence obligations, so a picture can never drift away from the
// credit the licence requires it to carry.

/**
 * Fallback for the sitting reference.
 *
 * The photo diagram is a file on disk, and a file on disk can be missing: an
 * older deployment that predates it, a CDN that serves the SPA's index.html for
 * an unknown path (200 OK, undecodable as an image), a stalled network. The
 * <img> still reserves its box from the width/height attributes, so the failure
 * mode was a blank white rectangle three hundred pixels tall on the last screen
 * of the break — the screen whose whole job is to show what good sitting looks
 * like. This is the same four rules drawn in code, so there is always a
 * diagram. Schematic on purpose: it is not pretending to be the photograph.
 */
function PostureDiagramSVG({ isAr }) {
  const ink = "#334155", accent = "#0ea5e9", soft = "#94a3b8";
  return (
    <svg viewBox="0 0 300 340" width="100%" height="300" role="img"
      aria-label={isAr
        ? "رسم تخطيطي للجلسة الصحيحة: الشاشة في مستوى العين، الكوع والركبة ٩٠°، الظهر مدعوم، القدمان على الأرض"
        : "Schematic of correct seated posture: screen at eye level, elbows and knees at 90 degrees, back supported, feet flat"}
      style={{ display:"block", margin:"0 auto" }}>
      {/* floor, desk */}
      <line x1="20"  y1="300" x2="286" y2="300" stroke={ink} strokeWidth="2" strokeLinecap="round"/>
      <line x1="150" y1="200" x2="286" y2="200" stroke={ink} strokeWidth="2" strokeLinecap="round"/>
      <line x1="280" y1="200" x2="280" y2="300" stroke={ink} strokeWidth="2"/>
      {/* monitor — its top edge sits on the eye line */}
      <rect x="200" y="100" width="76" height="64" rx="4" fill="none" stroke={ink} strokeWidth="2"/>
      <line x1="238" y1="164" x2="238" y2="190" stroke={ink} strokeWidth="2"/>
      <line x1="220" y1="190" x2="256" y2="190" stroke={ink} strokeWidth="2" strokeLinecap="round"/>
      {/* eye-level guide */}
      <line x1="112" y1="100" x2="198" y2="100" stroke={accent} strokeWidth="1.4" strokeDasharray="5 4"/>
      <text x="128" y="93" fontSize="9.5" fill={soft} letterSpacing=".04em">
        {isAr ? "مستوى العين" : "eye level"}
      </text>
      {/* chair: back post, lumbar curve, seat, column, wheels */}
      <line x1="64" y1="222" x2="150" y2="222" stroke={ink} strokeWidth="2" strokeLinecap="round"/>
      <line x1="64" y1="222" x2="64"  y2="140" stroke={ink} strokeWidth="2" strokeLinecap="round"/>
      <path d="M60 208 q11 -12 0 -24" stroke={accent} strokeWidth="3.5" fill="none" strokeLinecap="round"/>
      <line x1="106" y1="222" x2="106" y2="264" stroke={ink} strokeWidth="2"/>
      <line x1="84"  y1="264" x2="130" y2="264" stroke={ink} strokeWidth="2" strokeLinecap="round"/>
      <circle cx="84"  cy="270" r="5.5" fill="none" stroke={ink} strokeWidth="2"/>
      <circle cx="130" cy="270" r="5.5" fill="none" stroke={ink} strokeWidth="2"/>
      {/* ear-over-shoulder plumb line */}
      <line x1="92" y1="80" x2="92" y2="228" stroke={accent} strokeWidth="1.1" strokeDasharray="4 5"/>
      {/* body: head at eye level, trunk vertical, thigh level, shin vertical */}
      <circle cx="92" cy="100" r="16" fill="none" stroke={ink} strokeWidth="2.5"/>
      <line x1="92"  y1="116" x2="92"  y2="222" stroke={ink} strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="92"  y1="222" x2="162" y2="222" stroke={ink} strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="162" y1="222" x2="162" y2="296" stroke={ink} strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="162" y1="296" x2="188" y2="296" stroke={ink} strokeWidth="2.5" strokeLinecap="round"/>
      {/* arm: upper arm down the side, forearm level on the desk */}
      <line x1="94" y1="128" x2="94"  y2="196" stroke={ink} strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="94" y1="196" x2="158" y2="196" stroke={ink} strokeWidth="2.5" strokeLinecap="round"/>
      {/* the two right angles the checklist names */}
      <path d="M94 184 h12 v12" fill="none" stroke={accent} strokeWidth="1.6"/>
      <text x="110" y="192" fontSize="11" fill={accent} fontWeight="700">90°</text>
      <path d="M150 222 v12 h12" fill="none" stroke={accent} strokeWidth="1.6"/>
      <text x="170" y="243" fontSize="11" fill={accent} fontWeight="700">90°</text>
    </svg>
  );
}

export default function BreakPage({ cs, lang="en", onExit, muted=false, alertCauses=[],
  cameraOff=false, sessionPaused=false }) {
  const isAr = lang === "ar";
  const dir  = isAr ? "rtl" : "ltr";
  // Ordered by what the session that just ended actually flagged. It was a
  // fixed array in a fixed order, so a user whose whole session was rounded
  // shoulders opened on the same exercise as everyone else.
  const [EXERCISES] = useState(() => routineFor(alertCauses));
  const [idx, setIdx]         = useState(0);
  const [secs, setSecs]       = useState(EXERCISES[0].dur);
  const [running, setRunning] = useState(false);
  const [doneSet, setDoneSet] = useState(() => new Set());
  const [finished, setFinished] = useState(false);
  // An <img> that fails still holds its box open, so a missing file renders as
  // a blank white plate rather than as nothing. Track the failure and swap in
  // something real instead.
  const [refImgFailed, setRefImgFailed] = useState(false);
  const [exImgFailed,  setExImgFailed]  = useState({});
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
    <div dir={dir} style={{ minHeight:"100dvh", background:cs?.bg||"#050b16", color:text,
      fontFamily:"'IBM Plex Sans Arabic','Inter',system-ui,sans-serif", display:"flex", flexDirection:"column", alignItems:"center" }}>
      {/* Header */}
      <div style={{ width:"100%", maxWidth:560, display:"flex", alignItems:"center",
        justifyContent:"space-between", padding:"16px 18px", borderBottom:`1px solid ${border}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:9 }}>
          <span style={{ width:34, height:34, borderRadius:10, flexShrink:0,
            background:`${ACCENT}1a`, display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
            <Icon name="leaf" size={18} color={ACCENT}/>
          </span>
          <div>
            <div style={{ fontSize:15, fontWeight:800 }}>{isAr?"استراحة الحركة":"Movement Break"}</div>
            <div style={{ fontSize:11, color:muted2 }}>{isAr?"دقيقتان تعيدان ضبط وضعيتك":"Two minutes to reset your posture"}</div>
          </div>
        </div>
        <button onClick={onExit} style={{ background:"rgba(148,163,184,.1)", border:`1px solid ${border}`,
          borderRadius:9, padding:"7px 13px", fontSize:12, color:muted2, cursor:"pointer",
          display:"inline-flex", alignItems:"center", gap:6, whiteSpace:"nowrap" }}>
          <Icon name={isAr?"forward":"back"} size={13} color={muted2}/>
          {isAr?"العودة للجلسة":"Back to session"}
        </button>
      </div>

      {/* The camera is released when a break starts. Standing up to stretch in
          front of your own laptop is the exact moment "is this thing still
          watching me?" occurs to someone, and the only answer they will
          believe is one the app states plainly. */}
      {cameraOff && (
        <div style={{ width:"100%", maxWidth:560, padding:"10px 18px 0" }}>
          <div style={{ display:"flex", alignItems:"center", gap:9, padding:"9px 12px",
            background:"rgba(16,185,129,.08)", border:"1px solid rgba(16,185,129,.22)",
            borderRadius:11, fontSize:11.5, color:"#6ee7b7", fontWeight:600, lineHeight:1.5 }}>
            <Icon name="cameraOff" size={14} color="#6ee7b7" style={{ flexShrink:0 }}/>
            <span>{sessionPaused
              ? (isAr ? "الكاميرا اتقفلت والجلسة اتوقفت مؤقتاً — هتكمل من نفس المكان لما ترجع."
                      : "Camera off and your session is paused — it picks up where you left off.")
              : (isAr ? "الكاميرا اتقفلت طول الاستراحة."
                      : "The camera is off for the whole break.")}</span>
          </div>
        </div>
      )}

      <div style={{ width:"100%", maxWidth:560, padding:"20px 18px", flex:1 }}>
        {finished ? (
          <div style={{ ...box, padding:"40px 24px", textAlign:"center" }}>
            <div style={{ width:60, height:60, borderRadius:"50%", margin:"0 auto 14px",
              background:"rgba(16,185,129,.12)", border:"1px solid rgba(16,185,129,.28)",
              display:"flex", alignItems:"center", justifyContent:"center" }}>
              <Icon name="checkCircle" size={30} color="#10b981"/>
            </div>
            <div style={{ fontSize:19, fontWeight:800, marginBottom:6 }}>{isAr?"انتهت الاستراحة!":"Break complete!"}</div>
            <div style={{ fontSize:13, color:muted2, marginBottom:20, lineHeight:1.6 }}>
              {isAr?"عمل رائع — جسمك شاكرك. ارجع لجلستك بوضعية أفضل.":"Great job — your body thanks you. Head back with a fresher posture."}
            </div>

            {/* The reference goes HERE, at the one moment it is actionable: the
                user is standing up from a break and about to sit back down. A
                posture diagram on a settings page is a picture; the same diagram
                three seconds before someone sits is an instruction. */}
            <div style={{ borderTop:`1px solid ${border}`, paddingTop:18, marginBottom:22 }}>
              <div style={{ fontSize:12, fontWeight:700, color:muted2, marginBottom:12,
                letterSpacing:".04em", textTransform:"uppercase" }}>
                {isAr?"ارجع تقعد كده":"Sit back down like this"}
              </div>
              <div style={{ background:"#fff", borderRadius:14, padding:"12px 10px 6px",
                display:"inline-block", maxWidth:"100%", width: refImgFailed ? "min(300px,100%)" : "auto" }}>
                {refImgFailed ? (
                  <PostureDiagramSVG isAr={isAr}/>
                ) : (
                  <img src={POSTURE_REFERENCE.src} alt={isAr?POSTURE_REFERENCE.alt.ar:POSTURE_REFERENCE.alt.en}
                    width={POSTURE_REFERENCE.width} height={POSTURE_REFERENCE.height}
                    /* eager, not lazy: this is the only picture on the screen
                       it appears on, and it is already in view when the screen
                       mounts — lazy just delayed it. */
                    loading="eager" decoding="async"
                    onError={()=>setRefImgFailed(true)}
                    onLoad={e=>{ if(!e.currentTarget.naturalWidth) setRefImgFailed(true); }}
                    style={{ display:"block", height:300, width:"auto", maxWidth:"100%", objectFit:"contain", margin:"0 auto 6px" }}/>
                )}
                <div style={{ fontSize:8.5, color:"#64748b", marginTop:4 }}>
                  {refImgFailed
                    ? (isAr ? "رسم تخطيطي" : "Schematic diagram")
                    : <>{POSTURE_REFERENCE.credit.author} ·{" "}
                        <a href={POSTURE_REFERENCE.credit.licenceUrl} target="_blank" rel="noopener noreferrer"
                          style={{ color:"#64748b" }}>{POSTURE_REFERENCE.credit.licence}</a></>}
                </div>
              </div>
              {/* The diagram's labels are baked into the image in English. This
                  list is the same information in the user's own language — and
                  it is also the only version a screen reader can reach, since
                  text inside an image reaches neither. */}
              <ul style={{ listStyle:"none", padding:0, margin:"14px 0 0", textAlign:isAr?"right":"left",
                maxWidth:340, marginInline:"auto" }}>
                {postureChecklist(isAr).map(line=>(
                  <li key={line} style={{ fontSize:12, color:muted2, lineHeight:1.9,
                    display:"flex", gap:8, flexDirection:isAr?"row-reverse":"row" }}>
                    <Icon name="checkCircle" size={13} color="#10b981" style={{ flexShrink:0, marginTop:4 }}/>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
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
              {/* The illustration. These are medical line illustrations drawn on
                  white, so they sit on a white plate rather than being dropped
                  onto the dark card, where they would read as a broken cut-out.
                  `loading="eager"` because the very next thing that happens is a
                  countdown — an image that fades in three seconds late is an
                  image the user has already stopped looking for. */}
              {/* A failed illustration used to leave a blank white plate above
                  the exercise name. Nothing is better than an empty frame — the
                  name, the description and the rep count already carry the
                  instruction. */}
              {ex.img && !exImgFailed[ex.id] && (
                <div style={{ background:"#fff", borderRadius:14, padding:"10px 8px 6px",
                  marginBottom:12, display:"inline-block", maxWidth:"100%" }}>
                  <img src={ex.img} alt={isAr?ex.ar:ex.en} loading="eager" decoding="async"
                    onError={()=>setExImgFailed(m=>({...m,[ex.id]:true}))}
                    onLoad={e=>{ if(!e.currentTarget.naturalWidth) setExImgFailed(m=>({...m,[ex.id]:true})); }}
                    style={{ display:"block", height:176, maxWidth:"100%", objectFit:"contain", margin:"0 auto" }}/>
                  {/* Licence term, not decoration — see lib/exerciseMedia.js. */}
                  <div style={{ fontSize:8.5, color:"#64748b", marginTop:4, lineHeight:1.4 }}>
                    <a href={CREDIT.authorUrl} target="_blank" rel="noopener noreferrer"
                      style={{ color:"#64748b" }}>{CREDIT.author}</a>
                    {" · "}
                    <a href={CREDIT.licenceUrl} target="_blank" rel="noopener noreferrer"
                      style={{ color:"#64748b" }}>{CREDIT.licence}</a>
                    {CREDIT.changed && (isAr ? " · معدّلة الحجم" : " · resized")}
                  </div>
                </div>
              )}
              <div style={{ fontSize:19, fontWeight:800, margin:"4px 0 8px" }}>{ex.icon} {isAr?ex.ar:ex.en}</div>
              <div style={{ fontSize:13, color:muted2, lineHeight:1.7, maxWidth:380, margin:"0 auto 10px" }}>
                {isAr?ex.dar:ex.dens}
              </div>
              {/* The count on its own line — it used to be the tail of a sentence
                  someone was trying to read while already moving. */}
              <div style={{ display:"inline-block", fontSize:12, fontWeight:700, color:ACCENT,
                background:`${ACCENT}14`, border:`1px solid ${ACCENT}30`, borderRadius:99,
                padding:"4px 12px", marginBottom:18 }}>
                {isAr?ex.repsAr:ex.reps}
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
                {isAr?"→ السابق":"← Prev"}
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
