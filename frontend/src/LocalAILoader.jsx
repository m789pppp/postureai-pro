/**
 * LocalAILoader — shows download progress for the local AI model
 * First time: ~500MB download, then cached forever in browser
 */
import { useState, useEffect } from "react";
import { initLocalAI, onLocalAIStatus, getLocalAIStatus } from "./localAI.js";

export default function LocalAILoader({ dark, lang, onReady, autoStart = false }) {
  const isAr = lang === "ar";
  const [status, setStatus] = useState(getLocalAIStatus());
  const [started, setStarted] = useState(autoStart);

  useEffect(() => {
    const unsub = onLocalAIStatus(setStatus);
    return unsub;
  }, []);

  useEffect(() => {
    if (started && !status.ready && !status.loading) {
      initLocalAI().then(() => {
        if (onReady) onReady();
      }).catch(() => {});
    }
  }, [started]);

  useEffect(() => {
    if (status.ready && onReady) onReady();
  }, [status.ready]);

  const c = {
    bg:     dark ? "rgba(15,23,42,.95)" : "#ffffff",
    border: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)",
    text:   dark ? "#f0f6ff" : "#0f172a",
    muted:  dark ? "rgba(255,255,255,.4)" : "#64748b",
    track:  dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)",
    fill:   "linear-gradient(90deg,#1a56db,#0891b2)",
  };

  if (status.ready) return null;

  return (
    <div style={{
      background:c.bg, border:`1px solid ${c.border}`,
      borderRadius:14, padding:"20px 22px",
      fontFamily:"'Inter',system-ui,sans-serif",
    }}>
      {!started ? (
        <>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
            <div style={{fontSize:22}}>🧠</div>
            <div>
              <div style={{fontSize:14,fontWeight:700,color:c.text}}>
                {isAr?"AI محلي مجاني":"Free Local AI"}
              </div>
              <div style={{fontSize:12,color:c.muted}}>
                {isAr?"تحميل مرة واحدة • يعمل بدون إنترنت":"One-time download • Works offline"}
              </div>
            </div>
          </div>

          <div style={{fontSize:12.5,color:c.muted,marginBottom:14,lineHeight:1.6}}>
            {isAr
              ?"نموذج Qwen2.5 (500MB) بيتحمل مرة واحدة ويتخزن في المتصفح. بعدها بيشتغل فوراً بدون أي تكلفة."
              :"Qwen2.5 model (~500MB) downloads once and stays in your browser. Then works instantly, forever free."}
          </div>

          <button onClick={() => setStarted(true)} style={{
            width:"100%", padding:"11px",
            background:"linear-gradient(135deg,#1a56db,#0891b2)",
            border:"none", borderRadius:9, fontSize:14, fontWeight:700,
            color:"#fff", cursor:"pointer", fontFamily:"inherit",
            boxShadow:"0 4px 16px rgba(26,86,219,.3)",
          }}>
            {isAr?"تحميل AI المجاني →":"Download Free AI →"}
          </button>
        </>
      ) : (
        <>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
            <div style={{
              width:32,height:32,border:"3px solid rgba(26,86,219,.2)",
              borderTopColor:"#1a56db",borderRadius:"50%",
              animation:"spin 1s linear infinite",flexShrink:0,
            }}/>
            <div>
              <div style={{fontSize:13.5,fontWeight:700,color:c.text}}>
                {isAr?"جاري تحميل AI...":"Loading AI model..."}
              </div>
              <div style={{fontSize:11.5,color:c.muted}}>
                {isAr?"مرة واحدة فقط — بعدها فوري":"One time only — instant after"}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{background:c.track,borderRadius:99,height:6,overflow:"hidden",marginBottom:8}}>
            <div style={{
              height:"100%",background:c.fill,
              width:`${status.progress}%`,
              borderRadius:99,
              transition:"width .3s ease",
            }}/>
          </div>

          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:c.muted}}>
            <span>{isAr?"~500MB":"~500MB"}</span>
            <span style={{fontWeight:600,color:"#1a56db"}}>{status.progress}%</span>
          </div>

          {status.error && (
            <div style={{
              marginTop:12,padding:"10px 12px",
              background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.2)",
              borderRadius:8,fontSize:12.5,color:"#f87171",
            }}>
              ⚠️ {status.error}
            </div>
          )}
        </>
      )}
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
    </div>
  );
}
