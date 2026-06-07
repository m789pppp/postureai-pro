/**
 * PostureAI Pro — Shareable Score Card
 * Generates a visual score card users can share on LinkedIn/Twitter/WhatsApp.
 * Uses canvas to render → download as PNG or share via Web Share API.
 */
import React, { useRef, useEffect, useState } from "react";

function drawCard(canvas, data, dark = true) {
  const ctx = canvas.getContext("2d");
  const W = 600, H = 320;
  canvas.width = W; canvas.height = H;

  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0b1120");
  bg.addColorStop(1, "#0f172a");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  // Border
  ctx.strokeStyle = "rgba(99,102,241,0.4)";
  ctx.lineWidth = 1.5;
  ctx.roundRect?.(4, 4, W-8, H-8, 16);
  ctx.stroke();

  // Score ring
  const cx = 140, cy = 160, r = 90;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2);
  ctx.strokeStyle = "rgba(255,255,255,0.06)"; ctx.lineWidth = 16;
  ctx.stroke();

  const score = Math.min(100, Math.max(0, data.score || 0));
  const angle  = (score / 100) * Math.PI * 2 - Math.PI / 2;
  const color  = score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI/2, angle);
  ctx.strokeStyle = color; ctx.lineWidth = 16; ctx.lineCap = "round";
  ctx.stroke();

  // Score text
  ctx.fillStyle = "#eef2ff"; ctx.font = "bold 52px -apple-system,sans-serif";
  ctx.textAlign = "center"; ctx.fillText(score, cx, cy + 10);
  ctx.font = "14px -apple-system,sans-serif";
  ctx.fillStyle = "#64748b"; ctx.fillText("/100", cx, cy + 34);

  // Grade
  const grade = score >= 90 ? "Excellent" : score >= 75 ? "Good" :
                score >= 60 ? "Fair" : score >= 40 ? "Needs Work" : "Poor";
  ctx.font = "bold 15px -apple-system,sans-serif";
  ctx.fillStyle = color; ctx.fillText(grade, cx, cy - r - 20);

  // Right panel
  const rx = 290, ry = 60;
  ctx.fillStyle = "#eef2ff"; ctx.font = "bold 22px -apple-system,sans-serif";
  ctx.textAlign = "left"; ctx.fillText("PostureAI Pro", rx, ry);

  ctx.fillStyle = "#64748b"; ctx.font = "13px -apple-system,sans-serif";
  ctx.fillText("AI Posture Analysis", rx, ry + 22);

  // Stats
  const stats = [
    { label: "Sessions", val: data.sessions || 0 },
    { label: "Avg Score",val: `${data.avg_score || score}%` },
    { label: "Streak",   val: `${data.streak || 1} days` },
  ];
  stats.forEach((s, i) => {
    const sx = rx + (i * 100), sy = ry + 65;
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.roundRect?.(sx, sy, 88, 56, 10); ctx.fill();
    ctx.fillStyle = "#e2e8f0"; ctx.font = "bold 18px -apple-system,sans-serif";
    ctx.textAlign = "center"; ctx.fillText(s.val, sx+44, sy+28);
    ctx.fillStyle = "#475569"; ctx.font = "11px -apple-system,sans-serif";
    ctx.fillText(s.label, sx+44, sy+46);
  });

  // CTA
  ctx.fillStyle = "rgba(99,102,241,0.15)";
  ctx.roundRect?.(rx, ry + 150, 290, 42, 10); ctx.fill();
  ctx.fillStyle = "#a5b4fc"; ctx.font = "13px -apple-system,sans-serif";
  ctx.textAlign = "center"; ctx.fillText("🧠 app.postureai.io", rx+145, ry+177);

  // Date
  ctx.fillStyle = "#334155"; ctx.font = "11px -apple-system,sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(new Date().toLocaleDateString("en-EG", {day:"2-digit",month:"short",year:"numeric"}), W-24, H-16);
}

export function ShareCard({ score, sessions, avgScore, streak, lang, onClose }) {
  const canvasRef = useRef(null);
  const [copied,  setCopied]  = useState(false);
  const [sharing, setSharing] = useState(false);
  const isAr = lang === "ar";

  const data = { score, sessions, avg_score: avgScore, streak };

  useEffect(() => {
    if (canvasRef.current) drawCard(canvasRef.current, data);
  }, [score, sessions, avgScore, streak]);

  const download = () => {
    const a = document.createElement("a");
    a.href = canvasRef.current.toDataURL("image/png");
    a.download = `postureai-score-${score}.png`;
    a.click();
  };

  const share = async () => {
    setSharing(true);
    try {
      const blob = await new Promise(res => canvasRef.current.toBlob(res));
      const file  = new File([blob], "posture-score.png", { type:"image/png" });
      const text  = isAr
        ? `حققت نتيجة ${score}/100 في وضعية الجسم على PostureAI Pro 🧠💪\nجرّب مجاناً: app.postureai.io`
        : `I scored ${score}/100 on posture health with PostureAI Pro 🧠💪\nTry free: app.postureai.io`;
      if (navigator.canShare?.({ files:[file] })) {
        await navigator.share({ text, files:[file], title:"My PostureAI Score" });
      } else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch (_) {}
    setSharing(false);
  };

  const overlay = { position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:16 };
  const box = { background:"#0b1120",border:"1px solid rgba(148,163,184,.12)",borderRadius:20,padding:"28px 24px",maxWidth:680,width:"100%" };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={box} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <h3 style={{margin:0,color:"#eef2ff",fontSize:18,fontWeight:700}}>
            {isAr ? "🎉 شارك إنجازك!" : "🎉 Share your score!"}
          </h3>
          <button onClick={onClose} style={{background:"rgba(255,255,255,.06)",border:"none",borderRadius:8,color:"#94a3b8",cursor:"pointer",padding:"6px 12px",fontSize:13}}>
            {isAr ? "إغلاق" : "Close"}
          </button>
        </div>

        {/* Canvas preview */}
        <canvas ref={canvasRef} style={{width:"100%",height:"auto",borderRadius:12,border:"1px solid rgba(148,163,184,.08)",display:"block"}} />

        <div style={{display:"flex",gap:10,marginTop:16}}>
          <button onClick={download} style={{flex:1,padding:12,borderRadius:10,border:"1px solid rgba(148,163,184,.15)",background:"rgba(255,255,255,.04)",color:"#e2e8f0",cursor:"pointer",fontSize:14,fontWeight:500}}>
            ⬇️ {isAr ? "تحميل PNG" : "Download PNG"}
          </button>
          <button onClick={share} disabled={sharing} style={{flex:1,padding:12,borderRadius:10,border:"none",background:"linear-gradient(135deg,#6366f1,#0891b2)",color:"#fff",cursor:"pointer",fontSize:14,fontWeight:600}}>
            {sharing ? "..." : copied ? `✅ ${isAr?"تم النسخ":"Copied!"}` : `🔗 ${isAr?"شارك":"Share"}`}
          </button>
        </div>

        <p style={{textAlign:"center",color:"#334155",fontSize:11,marginTop:10}}>
          {isAr ? "شارك على LinkedIn أو Twitter أو WhatsApp" : "Share on LinkedIn · Twitter · WhatsApp"}
        </p>
      </div>
    </div>
  );
}
