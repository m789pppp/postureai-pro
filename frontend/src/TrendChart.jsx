/**
 * TrendChart — 30-day posture trend with linear regression line
 * Shows: daily avg scores, 7-day rolling avg, regression line + verdict
 */
import React, { useMemo } from "react";

// ── Linear regression ─────────────────────────────────────────────
function linReg(pts) {
  const n = pts.length;
  if (n < 2) return null;
  const sx = pts.reduce((a, p) => a + p.x, 0);
  const sy = pts.reduce((a, p) => a + p.y, 0);
  const sx2 = pts.reduce((a, p) => a + p.x ** 2, 0);
  const sxy = pts.reduce((a, p) => a + p.x * p.y, 0);
  const denom = n * sx2 - sx ** 2;
  if (Math.abs(denom) < 0.0001) return null;
  const m = (n * sxy - sx * sy) / denom;
  const b = (sy - m * sx) / n;
  return { m, b, predict: x => m * x + b };
}

// ── Rolling average ───────────────────────────────────────────────
function rolling(arr, w) {
  return arr.map((_, i) => {
    const slice = arr.slice(Math.max(0, i - w + 1), i + 1).filter(v => v !== null);
    return slice.length ? slice.reduce((a, v) => a + v, 0) / slice.length : null;
  });
}

function sc(s) {
  return s >= 75 ? "#10b981" : s >= 50 ? "#f59e0b" : "#ef4444";
}

export default function TrendChart({ sessions = [], cs, lang, onClose }) {
  const isAr = lang === "ar";
  const W = 580, H = 220, PAD = { t: 16, r: 20, b: 36, l: 44 };
  const CW = W - PAD.l - PAD.r;
  const CH = H - PAD.t - PAD.b;

  const data = useMemo(() => {
    // Build 30-day array
    const days = [];
    const now  = new Date();
    for (let i = 29; i >= 0; i--) {
      const d   = new Date(now); d.setDate(d.getDate() - i);
      const ds  = d.toDateString();
      const day_sessions = sessions.filter(s => {
        const sd = s.created_at?.toDate?.() ?? new Date(s.created_at || 0);
        return sd.toDateString() === ds;
      });
      const avg = day_sessions.length
        ? Math.round(day_sessions.reduce((a, s) => a + (s.avg_score || 0), 0) / day_sessions.length)
        : null;
      days.push({
        idx: 29 - i,
        date: d,
        label: d.toLocaleDateString(isAr ? "ar-EG" : "en-US", { month: "short", day: "numeric" }),
        avg,
        count: day_sessions.length,
      });
    }

    // Rolling 7-day
    const avgs   = days.map(d => d.avg);
    const roll7  = rolling(avgs, 7);

    // Regression — only on days that have data
    const regPts = days.filter(d => d.avg !== null).map(d => ({ x: d.idx, y: d.avg }));
    const reg    = linReg(regPts);

    // Trend verdict
    let verdict = null, verdictColor = "#64748b";
    if (reg && regPts.length >= 5) {
      const slope30 = reg.m * 30;
      if      (slope30 > 8)  { verdict = isAr ? "📈 وضعيتك تتحسن بشكل واضح" : "📈 Clear improvement trend";        verdictColor = "#10b981"; }
      else if (slope30 > 2)  { verdict = isAr ? "📈 تحسن تدريجي" : "📈 Gradual improvement";                        verdictColor = "#10b981"; }
      else if (slope30 > -2) { verdict = isAr ? "➡️ مستقرة — لا تغيير واضح" : "➡️ Stable — no clear change";       verdictColor = "#f59e0b"; }
      else if (slope30 > -8) { verdict = isAr ? "📉 تراجع طفيف — انتبه" : "📉 Slight decline — pay attention";      verdictColor = "#f59e0b"; }
      else                   { verdict = isAr ? "📉 تراجع واضح — راجع عاداتك" : "📉 Clear decline — review habits"; verdictColor = "#ef4444"; }
    }

    const filled = days.filter(d => d.avg !== null);
    const overallAvg = filled.length ? Math.round(filled.reduce((a, d) => a + d.avg, 0) / filled.length) : 0;
    const best  = filled.length ? Math.max(...filled.map(d => d.avg)) : 0;
    const worst = filled.length ? Math.min(...filled.map(d => d.avg)) : 0;

    return { days, roll7, reg, regPts, verdict, verdictColor, overallAvg, best, worst };
  }, [sessions, isAr]);

  // ── SVG helpers ──────────────────────────────────────────────────
  const xPos = idx => PAD.l + (idx / 29) * CW;
  const yPos = v   => PAD.t + CH - ((Math.min(100, Math.max(0, v)) / 100) * CH);

  const yGridLines = [0, 25, 50, 75, 100];

  const dayDots = data.days.filter(d => d.avg !== null);

  // Regression line endpoints
  let regLine = null;
  if (data.reg && data.regPts.length >= 5) {
    const x0 = data.regPts[0].x, x1 = data.regPts[data.regPts.length - 1].x;
    regLine = {
      x1: xPos(x0), y1: yPos(data.reg.predict(x0)),
      x2: xPos(x1), y2: yPos(data.reg.predict(x1)),
    };
  }

  // Rolling 7-day polyline
  const roll7Points = data.days
    .map((d, i) => data.roll7[i] !== null ? `${xPos(d.idx)},${yPos(data.roll7[i])}` : null)
    .filter(Boolean).join(" ");

  // Area fill path under daily dots
  const areaPath = (() => {
    const pts = dayDots;
    if (!pts.length) return "";
    let p = `M ${xPos(pts[0].idx)},${yPos(pts[0].avg)}`;
    pts.slice(1).forEach(d => { p += ` L ${xPos(d.idx)},${yPos(d.avg)}`; });
    p += ` L ${xPos(pts[pts.length-1].idx)},${PAD.t+CH} L ${xPos(pts[0].idx)},${PAD.t+CH} Z`;
    return p;
  })();

  if (data.days.filter(d => d.avg !== null).length === 0) {
    return (
      <div style={{ position:"fixed",inset:0,zIndex:1800,background:"rgba(0,0,0,.78)",backdropFilter:"blur(12px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20 }}>
        <div style={{ background:"rgba(8,14,28,.98)",border:"1px solid rgba(255,255,255,.08)",borderRadius:18,padding:"40px 28px",maxWidth:360,textAlign:"center" }}>
          <div style={{ fontSize:44,marginBottom:14 }}>📊</div>
          <div style={{ fontSize:17,fontWeight:800,color:"#f0f6ff",marginBottom:8 }}>{isAr?"لا توجد بيانات بعد":"No data yet"}</div>
          <div style={{ fontSize:13,color:"#64748b",marginBottom:22 }}>{isAr?"أكمل بعض الجلسات لتظهر الاتجاهات":"Complete some sessions to see trends"}</div>
          <button onClick={onClose} style={{ padding:"10px 28px",background:"#3b82f6",color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer" }}>OK</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position:"fixed",inset:0,zIndex:1800,background:"rgba(0,0,0,.82)",backdropFilter:"blur(14px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16,overflowY:"auto" }}>
      <div style={{ background:"rgba(6,12,24,.99)",border:"1px solid rgba(255,255,255,.08)",borderRadius:20,width:"100%",maxWidth:660,maxHeight:"92vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 32px 80px rgba(0,0,0,.7)" }}>

        {/* Header */}
        <div style={{ padding:"20px 24px 16px",borderBottom:"1px solid rgba(255,255,255,.06)",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0 }}>
          <div>
            <div style={{ fontSize:17,fontWeight:800,color:"#f0f6ff" }}>{isAr?"مسار الـ 30 يوم":"30-Day Trend"}</div>
            <div style={{ fontSize:12,color:"#64748b",marginTop:2 }}>{isAr?"متوسط النقاط اليومي + خط الاتجاه":"Daily avg score + regression trend line"}</div>
          </div>
          <button onClick={onClose} style={{ width:32,height:32,borderRadius:"50%",background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",color:"#94a3b8",fontSize:16,cursor:"pointer" }} aria-label="Close">✕</button>
        </div>

        <div style={{ overflowY:"auto",padding:"20px 24px 28px" }}>

          {/* Verdict banner */}
          {data.verdict && (
            <div style={{ background:`${data.verdictColor}12`,border:`1px solid ${data.verdictColor}35`,borderRadius:12,padding:"12px 16px",marginBottom:20,display:"flex",alignItems:"center",gap:12 }}>
              <div style={{ fontSize:15,fontWeight:700,color:data.verdictColor,flex:1 }}>{data.verdict}</div>
              {data.reg && (
                <div style={{ fontSize:11,color:"#64748b",textAlign:"right" }}>
                  {isAr?"الميل":"slope"}: {data.reg.m > 0 ? "+" : ""}{(data.reg.m).toFixed(2)}{isAr?" نقطة/يوم":" pts/day"}
                </div>
              )}
            </div>
          )}

          {/* SVG Chart */}
          <div style={{ background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.06)",borderRadius:14,padding:"16px 8px 8px",marginBottom:20,overflowX:"auto" }}>
            <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display:"block",maxWidth:"100%" }}>
              {/* Y grid lines */}
              {yGridLines.map(v => (
                <g key={v}>
                  <line x1={PAD.l} y1={yPos(v)} x2={PAD.l+CW} y2={yPos(v)}
                    stroke="rgba(255,255,255,.05)" strokeWidth={v===50?1.5:1} strokeDasharray={v===50?"4,4":""}/>
                  <text x={PAD.l-6} y={yPos(v)+4} textAnchor="end" fill="rgba(255,255,255,.3)" fontSize={9} fontFamily="system-ui">{v}</text>
                </g>
              ))}

              {/* Area fill */}
              {areaPath && <path d={areaPath} fill="rgba(59,130,246,.06)"/>}

              {/* Rolling 7-day line */}
              {roll7Points && (
                <polyline points={roll7Points} fill="none" stroke="rgba(99,102,241,.6)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5,3"/>
              )}

              {/* Regression line */}
              {regLine && (
                <line x1={regLine.x1} y1={regLine.y1} x2={regLine.x2} y2={regLine.y2}
                  stroke={data.verdictColor} strokeWidth={2.5} strokeLinecap="round" opacity={0.85}/>
              )}

              {/* Daily dots + connecting line */}
              {dayDots.length > 1 && (
                <polyline
                  points={dayDots.map(d => `${xPos(d.idx)},${yPos(d.avg)}`).join(" ")}
                  fill="none" stroke="rgba(148,163,184,.35)" strokeWidth={1.5} strokeLinejoin="round"/>
              )}
              {dayDots.map((d, i) => {
                const x = xPos(d.idx), y = yPos(d.avg);
                const c = sc(d.avg);
                return (
                  <g key={i}>
                    <circle cx={x} cy={y} r={4.5} fill={c} stroke="rgba(6,12,24,.8)" strokeWidth={1.5}/>
                    {/* Show score label for latest and best */}
                    {(i === dayDots.length-1 || d.avg === data.best) && (
                      <text x={x} y={y-10} textAnchor="middle" fill={c} fontSize={9} fontWeight={700} fontFamily="system-ui">{d.avg}</text>
                    )}
                  </g>
                );
              })}

              {/* X axis labels — every 5 days */}
              {data.days.filter((_, i) => i % 5 === 0 || i === 29).map(d => (
                <text key={d.idx} x={xPos(d.idx)} y={H-8} textAnchor="middle"
                  fill="rgba(255,255,255,.3)" fontSize={9} fontFamily="system-ui">
                  {d.date.toLocaleDateString(isAr?"ar-EG":"en-US",{month:"short",day:"numeric"})}
                </text>
              ))}

              {/* Legend */}
              <g transform={`translate(${PAD.l+4},${PAD.t})`}>
                <circle cx={6} cy={6} r={4} fill="#3b82f6"/>
                <text x={14} y={10} fill="rgba(255,255,255,.45)" fontSize={9} fontFamily="system-ui">{isAr?"يومي":"Daily"}</text>
                <line x1={60} y1={6} x2={76} y2={6} stroke="rgba(99,102,241,.6)" strokeWidth={2} strokeDasharray="4,3"/>
                <text x={80} y={10} fill="rgba(255,255,255,.45)" fontSize={9} fontFamily="system-ui">{isAr?"متوسط 7 أيام":"7-day avg"}</text>
                <line x1={150} y1={6} x2={166} y2={6} stroke={data.verdictColor} strokeWidth={2.5}/>
                <text x={170} y={10} fill="rgba(255,255,255,.45)" fontSize={9} fontFamily="system-ui">{isAr?"خط الاتجاه":"Trend"}</text>
              </g>
            </svg>
          </div>

          {/* Stats row */}
          <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16 }}>
            {[
              { label:isAr?"متوسط الشهر":"Month avg",   value:data.overallAvg||"—", color:sc(data.overallAvg) },
              { label:isAr?"أفضل يوم":"Best day",        value:data.best||"—",       color:"#10b981" },
              { label:isAr?"أصعب يوم":"Worst day",       value:data.worst||"—",      color:sc(data.worst) },
              { label:isAr?"أيام نشطة":"Active days",    value:`${data.days.filter(d=>d.avg!==null).length}/30`, color:"#3b82f6" },
            ].map((s,i)=>(
              <div key={i} style={{ background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)",borderRadius:10,padding:"12px 10px",textAlign:"center" }}>
                <div style={{ fontSize:22,fontWeight:900,color:s.color,lineHeight:1 }}>{s.value}</div>
                <div style={{ fontSize:10,color:"#64748b",marginTop:4,fontWeight:500 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Weekly breakdown */}
          <div style={{ fontSize:11,fontWeight:600,color:"#64748b",textTransform:"uppercase",letterSpacing:".07em",marginBottom:10 }}>
            {isAr?"ملخص أسبوعي":"Weekly Breakdown"}
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
            {[0,1,2,3].map(w=>{
              const wDays = data.days.slice(w*7, w*7+7).filter(d=>d.avg!==null);
              if(!wDays.length) return null;
              const wAvg  = Math.round(wDays.reduce((a,d)=>a+d.avg,0)/wDays.length);
              const wStart= data.days[w*7].date.toLocaleDateString(isAr?"ar-EG":"en-US",{month:"short",day:"numeric"});
              const wEnd  = data.days[Math.min(w*7+6,29)].date.toLocaleDateString(isAr?"ar-EG":"en-US",{month:"short",day:"numeric"});
              const prevW = w>0 ? data.days.slice((w-1)*7,w*7).filter(d=>d.avg!==null) : [];
              const prevAvg = prevW.length ? Math.round(prevW.reduce((a,d)=>a+d.avg,0)/prevW.length) : null;
              const diff  = prevAvg!==null ? wAvg - prevAvg : null;
              return(
                <div key={w} style={{ display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.06)",borderRadius:10 }}>
                  <div style={{ fontSize:11,color:"#64748b",width:90,flexShrink:0 }}>{wStart} – {wEnd}</div>
                  <div style={{ flex:1,height:6,background:"rgba(255,255,255,.06)",borderRadius:99,overflow:"hidden" }}>
                    <div style={{ width:`${wAvg}%`,height:"100%",background:sc(wAvg),borderRadius:99,transition:"width .6s" }}/>
                  </div>
                  <div style={{ fontSize:16,fontWeight:800,color:sc(wAvg),width:36,textAlign:"right" }}>{wAvg}</div>
                  {diff!==null&&(
                    <span style={{ fontSize:10,fontWeight:700,borderRadius:99,padding:"1px 6px",background:diff>=0?"rgba(16,185,129,.15)":"rgba(239,68,68,.15)",color:diff>=0?"#10b981":"#ef4444",flexShrink:0 }}>
                      {diff>=0?"+":""}{diff}
                    </span>
                  )}
                  <div style={{ fontSize:10,color:"#64748b",flexShrink:0 }}>{wDays.length}{isAr?" يوم":" days"}</div>
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}
