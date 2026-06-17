/**
 * Corvus — ShareCard v2
 * Fixes:
 * ✅ No external images — pure canvas (eliminates all CORS issues)
 * ✅ roundRect polyfill — works on Chrome <99, Safari, Firefox
 * ✅ drawCard wrapped in try/catch — never silently blank
 * ✅ Fallback SVG if canvas fails
 * ✅ toDataURL with error guard
 * ✅ Arabic name support
 */
import React, { useRef, useEffect, useState, useCallback } from "react";

// ── roundRect polyfill (Chrome <99, Safari <15.4) ─────────────────
function roundRectPolyfill(ctx, x, y, w, h, r) {
  const rad = typeof r === "number" ? r : 8;
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

function rr(ctx, x, y, w, h, r = 10) {
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
  } else {
    roundRectPolyfill(ctx, x, y, w, h, r);
  }
}

// ── Pure canvas draw — no external images ─────────────────────────
function drawCard(canvas, data) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  const W = 640, H = 340;
  canvas.width = W; canvas.height = H;

  try {
    // ── Background gradient ──────────────────────────────────────
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#080e1e");
    bg.addColorStop(1, "#0d1527");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // ── Subtle grid pattern ──────────────────────────────────────
    ctx.strokeStyle = "rgba(99,102,241,0.04)";
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 32) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y = 0; y < H; y += 32) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

    // ── Card border ──────────────────────────────────────────────
    ctx.strokeStyle = "rgba(99,102,241,0.35)";
    ctx.lineWidth = 1.5;
    rr(ctx, 4, 4, W-8, H-8, 18); ctx.stroke();

    // ── Left: score ring ─────────────────────────────────────────
    const cx = 155, cy = 170, r = 95;
    const score = Math.min(100, Math.max(0, data.score || 0));
    const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";
    const grade = score >= 90 ? "Excellent" : score >= 75 ? "Good" :
                  score >= 60 ? "Fair" : score >= 40 ? "Needs Work" : "Poor";
    const gradeAr = score >= 90 ? "ممتاز" : score >= 75 ? "جيد" :
                    score >= 60 ? "مقبول" : score >= 40 ? "يحتاج عمل" : "ضعيف";

    // Glow behind ring
    const glow = ctx.createRadialGradient(cx, cy, r-20, cx, cy, r+20);
    glow.addColorStop(0, color + "22");
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(cx - r - 20, cy - r - 20, (r+20)*2, (r+20)*2);

    // Track
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2);
    ctx.strokeStyle = "rgba(255,255,255,0.06)"; ctx.lineWidth = 14; ctx.stroke();

    // Progress arc
    const endAngle = -Math.PI/2 + (score/100) * Math.PI*2;
    ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI/2, endAngle);
    ctx.strokeStyle = color; ctx.lineWidth = 14; ctx.lineCap = "round"; ctx.stroke();

    // Score number
    ctx.fillStyle = "#f0f6ff";
    ctx.font = "bold 56px -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(score, cx, cy - 4);
    ctx.font = "14px -apple-system,sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillText("/100", cx, cy + 30);

    // Grade text above ring
    ctx.font = "bold 13px -apple-system,sans-serif";
    ctx.fillStyle = color;
    ctx.fillText(data.isAr ? gradeAr : grade, cx, cy - r - 18);

    // ── Right panel ──────────────────────────────────────────────
    const rx = 282, ry = 38;
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";

    // Brand name
    ctx.font = "bold 26px -apple-system,sans-serif";
    ctx.fillStyle = "#f0f6ff";
    ctx.fillText("Corvus", rx, ry + 26);

    // Tagline
    ctx.font = "13px -apple-system,sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillText(data.isAr ? "تحليل وضعية الجسم بالذكاء الاصطناعي" : "AI-Powered Posture Analysis", rx, ry + 50);

    // Divider
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(rx, ry + 64); ctx.lineTo(W - 28, ry + 64); ctx.stroke();

    // Stats boxes
    const stats = [
      { label: data.isAr ? "الجلسات" : "Sessions",   val: String(data.sessions || 0)       },
      { label: data.isAr ? "متوسط"   : "Avg Score",  val: `${data.avg_score || score}`      },
      { label: data.isAr ? "التواصل" : "Streak",     val: `${data.streak || 0}d`            },
    ];
    stats.forEach((s, i) => {
      const bx = rx + i * 104, by = ry + 76;
      ctx.fillStyle = "rgba(255,255,255,0.035)";
      rr(ctx, bx, by, 96, 56, 10); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.07)";
      ctx.lineWidth = 0.8;
      rr(ctx, bx, by, 96, 56, 10); ctx.stroke();

      ctx.textAlign = "center";
      ctx.font = "bold 20px -apple-system,sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.fillText(s.val, bx + 48, by + 28);
      ctx.font = "10px -apple-system,sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillText(s.label, bx + 48, by + 44);
    });

    // User name (if provided)
    if (data.name) {
      ctx.textAlign = "left";
      ctx.font = "bold 14px -apple-system,sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      const displayName = data.name.length > 22 ? data.name.slice(0, 22) + "…" : data.name;
      ctx.fillText(`👤 ${displayName}`, rx, ry + 166);
    }

    // CTA button (drawn)
    const ctaY = ry + (data.name ? 182 : 166);
    ctx.fillStyle = "rgba(99,102,241,0.18)";
    rr(ctx, rx, ctaY, 310, 40, 10); ctx.fill();
    ctx.strokeStyle = "rgba(99,102,241,0.4)";
    ctx.lineWidth = 1;
    rr(ctx, rx, ctaY, 310, 40, 10); ctx.stroke();
    ctx.font = "13px -apple-system,sans-serif";
    ctx.fillStyle = "#a5b4fc";
    ctx.textAlign = "center";
    ctx.fillText("🌐 corvus-omega.vercel.app", rx + 155, ctaY + 24);

    // Date
    ctx.textAlign = "right"; ctx.textBaseline = "alphabetic";
    ctx.font = "10px -apple-system,sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillText(new Date().toLocaleDateString("en-US", { day:"2-digit", month:"short", year:"numeric" }), W - 20, H - 16);

    return true;
  } catch (err) {
    console.error("[ShareCard] Canvas draw error:", err);
    return false;
  }
}

// ── Fallback SVG (if canvas completely fails) ─────────────────────
function FallbackCard({ score, isAr }) {
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ width:"100%", aspectRatio:"16/8.5", background:"linear-gradient(135deg,#080e1e,#0d1527)", border:"1px solid rgba(99,102,241,.3)", borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:8 }}>
      <div style={{ fontSize:52, fontWeight:900, color }}>{score}</div>
      <div style={{ fontSize:14, color:"rgba(255,255,255,.5)" }}>Corvus</div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────
export function ShareCard({ score, sessions, avgScore, streak, name, lang, onClose }) {
  const canvasRef  = useRef(null);
  const [copied,   setCopied]   = useState(false);
  const [sharing,  setSharing]  = useState(false);
  const [canvasFailed, setCanvasFailed] = useState(false);
  const isAr = lang === "ar";

  const data = { score, sessions, avg_score: avgScore, streak, name, isAr };

  const render = useCallback(() => {
    if (!canvasRef.current) return;
    const ok = drawCard(canvasRef.current, data);
    if (!ok) setCanvasFailed(true);
  }, [score, sessions, avgScore, streak, name, isAr]);

  useEffect(() => { render(); }, [render]);

  // ── Safe toDataURL ────────────────────────────────────────────
  const getDataURL = () => {
    try {
      const url = canvasRef.current?.toDataURL("image/png");
      // Detect blank canvas: all-transparent = very small base64
      if (!url || url.length < 200) return null;
      return url;
    } catch { return null; }
  };

  const download = () => {
    const url = getDataURL();
    if (!url) { alert(isAr ? "تعذّر تصدير الصورة" : "Could not export image"); return; }
    const a  = document.createElement("a");
    a.href   = url;
    a.download = `corvus-score-${score}.png`;
    a.click();
  };

  const share = async () => {
    setSharing(true);
    const text = isAr
      ? `حققت نتيجة ${score}/100 في وضعية الجسم على Corvus 🧠💪\nجرّب مجاناً: corvus-omega.vercel.app`
      : `I scored ${score}/100 on posture health with Corvus 🧠💪\nTry free: corvus-omega.vercel.app`;
    try {
      const url  = getDataURL();
      if (url && navigator.canShare) {
        const res  = await fetch(url);
        const blob = await res.blob();
        const file = new File([blob], "posture-score.png", { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ text, files: [file], title: "My Corvus Score" });
          setSharing(false); return;
        }
      }
      // Fallback: copy text
      await navigator.clipboard.writeText(text);
      setCopied(true); setTimeout(() => setCopied(false), 2500);
    } catch (_) {
      try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch {}
    }
    setSharing(false);
  };

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.8)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(12px)" }}
      onClick={onClose}>
      <div style={{ background:"#080e1e",border:"1px solid rgba(148,163,184,.12)",borderRadius:20,padding:"24px 22px",maxWidth:700,width:"100%",boxShadow:"0 24px 80px rgba(0,0,0,.7)" }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
          <div>
            <div style={{ fontSize:17,fontWeight:800,color:"#f0f6ff" }}>{isAr ? "🎉 شارك إنجازك!" : "🎉 Share your score!"}</div>
            <div style={{ fontSize:11,color:"rgba(255,255,255,.3)",marginTop:3 }}>{isAr ? "شارك على LinkedIn أو Twitter أو WhatsApp" : "Share on LinkedIn · Twitter · WhatsApp"}</div>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,color:"#94a3b8",cursor:"pointer",padding:"7px 14px",fontSize:13,fontWeight:500 }}>
            {isAr ? "إغلاق" : "Close"}
          </button>
        </div>

        {/* Canvas / Fallback */}
        {canvasFailed
          ? <FallbackCard score={score} isAr={isAr}/>
          : <canvas ref={canvasRef} style={{ width:"100%",height:"auto",borderRadius:12,border:"1px solid rgba(148,163,184,.08)",display:"block" }}/>
        }

        {/* Actions */}
        <div style={{ display:"flex",gap:10,marginTop:16 }}>
          <button onClick={download} style={{ flex:1,padding:"11px",borderRadius:10,border:"1px solid rgba(148,163,184,.15)",background:"rgba(255,255,255,.04)",color:"#e2e8f0",cursor:"pointer",fontSize:14,fontWeight:500 }}>
            ⬇️ {isAr ? "تحميل PNG" : "Download PNG"}
          </button>
          <button onClick={share} disabled={sharing} style={{ flex:1,padding:"11px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#6366f1,#0891b2)",color:"#fff",cursor:sharing?"not-allowed":"pointer",fontSize:14,fontWeight:700 }}>
            {sharing ? "..." : copied ? `✅ ${isAr?"تم النسخ":"Copied!"}` : `🔗 ${isAr?"شارك":"Share"}`}
          </button>
        </div>

      </div>
    </div>
  );
}
