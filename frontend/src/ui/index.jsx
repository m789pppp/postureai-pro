/**
 * Corvus — UI Library v3
 * Complete system: Mobile Polish + States + Smooth UX
 * ─────────────────────────────────────────────────────────────────
 * Exports:
 *  Atoms:    Btn, Badge, Spinner, Ring, Skeleton, SkeletonCard,
 *            MetRow, BarChart, TierBadge, Divider
 *  States:   EmptyState, ErrorState, LoadingState, ZeroDashboard
 *            OnboardingFlow, SkeletonHome, SkeletonTable, SkeletonProfile
 *  Feedback: Toasts, Modal, OfflineBanner, ProgressBar
 *  Motion:   Confetti, SuccessCheck, PulseRing, CountUp, Ripple
 *  Layout:   BottomSheet, SafeView, ResponsiveGrid
 */
import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────
// TOKENS (local copy — single-file self-contained)
// ─────────────────────────────────────────────────────────────────
const UI_TOKENS = {
  bg:"#070b12", surface:"#0c1220", card:"#101827",
  border:"rgba(255,255,255,.06)", borderHov:"rgba(255,255,255,.12)",
  text:"#f1f5f9", sub:"#94a3b8", muted:"#64748b",
  blue:"#6366f1", blueDim:"rgba(99,102,241,.12)", blueBorder:"rgba(99,102,241,.25)",
  green:"#10b981", greenDim:"rgba(16,185,129,.08)", greenBorder:"rgba(16,185,129,.2)",
  amber:"#f59e0b", amberDim:"rgba(245,158,11,.08)",
  red:"#ef4444", redDim:"rgba(239,68,68,.08)",
  sky:"#38bdf8", purple:"#a78bfa",
};
const sc = v => v>=75?UI_TOKENS.green:v>=50?UI_TOKENS.amber:UI_TOKENS.red;

// ─────────────────────────────────────────────────────────────────
// GLOBAL STYLES (injected once)
// ─────────────────────────────────────────────────────────────────
const UI_CSS = `
@keyframes spin      {to{transform:rotate(360deg)}}
@keyframes sk-wave   {0%,100%{opacity:.5}50%{opacity:1}}
@keyframes fade-up   {from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes fade-in   {from{opacity:0}to{opacity:1}}
@keyframes scale-in  {from{transform:scale(.92);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes scale-out {from{transform:scale(1);opacity:1}to{transform:scale(.92);opacity:0}}
@keyframes slide-up  {from{transform:translateY(100%)}to{transform:translateY(0)}}
@keyframes slide-down{from{transform:translateY(0)}to{transform:translateY(100%)}}
@keyframes pop       {0%{transform:scale(0)}60%{transform:scale(1.15)}100%{transform:scale(1)}}
@keyframes confetti  {0%{transform:translateY(0) rotate(0);opacity:1}100%{transform:translateY(120px) rotate(720deg);opacity:0}}
@keyframes ripple    {from{transform:scale(0);opacity:.4}to{transform:scale(2.5);opacity:0}}
@keyframes check-draw{from{stroke-dashoffset:30}to{stroke-dashoffset:0}}
@keyframes pulse-ring{0%{transform:scale(1);opacity:.8}100%{transform:scale(1.6);opacity:0}}
@keyframes count-up  {from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes toast-r   {from{transform:translateX(110%);opacity:0}to{transform:none;opacity:1}}
@keyframes toast-l   {from{transform:translateX(-110%);opacity:0}to{transform:none;opacity:1}}
@keyframes shimmer   {0%{background-position:-200% 0}100%{background-position:200% 0}}
@keyframes float-particle{0%{transform:translateY(0) translateX(0) scale(1);opacity:.9}
  50%{transform:translateY(-60px) translateX(var(--dx,20px)) scale(.8);opacity:.7}
  100%{transform:translateY(-120px) translateX(var(--dx2,40px)) scale(.3);opacity:0}}
.ui-row-hov:hover{background:rgba(255,255,255,.025)!important;transition:background .15s}
.ui-btn-hov:hover:not(:disabled){filter:brightness(1.1);transform:translateY(-1px);transition:all .18s ease}
.ui-card-hov:hover{border-color:rgba(99,102,241,.3)!important;transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.3);transition:all .18s ease}
`;
let _cssInjected = false;
function injectCSS() {
  if (_cssInjected || typeof document === "undefined") return;
  const el = document.createElement("style");
  el.textContent = UI_CSS;
  document.head.appendChild(el);
  _cssInjected = true;
}

// ─────────────────────────────────────────────────────────────────
// RESPONSIVE HOOK
// ─────────────────────────────────────────────────────────────────
export function useBreakpoint() {
  const [bp, setBp] = useState(() => {
    if (typeof window === "undefined") return "desktop";
    const w = window.innerWidth;
    return w < 480 ? "mobile" : w < 768 ? "phablet" : w < 1024 ? "tablet" : "desktop";
  });
  useEffect(() => {
    const fn = () => {
      const w = window.innerWidth;
      setBp(w < 480 ? "mobile" : w < 768 ? "phablet" : w < 1024 ? "tablet" : "desktop");
    };
    window.addEventListener("resize", fn, { passive: true });
    return () => window.removeEventListener("resize", fn);
  }, []);
  return {
    bp,
    isMobile:  bp === "mobile" || bp === "phablet",
    isTablet:  bp === "tablet",
    isDesktop: bp === "desktop",
    isTouch:   bp === "mobile" || bp === "phablet" || bp === "tablet",
  };
}

// ─────────────────────────────────────────────────────────────────
// SAFE AREA VIEW (iOS notch / Android nav)
// ─────────────────────────────────────────────────────────────────
export function SafeView({ children, style, top = true, bottom = true }) {
  return (
    <div style={{
      paddingTop:    top    ? "env(safe-area-inset-top,0px)"    : 0,
      paddingBottom: bottom ? "env(safe-area-inset-bottom,0px)" : 0,
      paddingLeft:   "env(safe-area-inset-left,0px)",
      paddingRight:  "env(safe-area-inset-right,0px)",
      ...style,
    }}>{children}</div>
  );
}

// ─────────────────────────────────────────────────────────────────
// RESPONSIVE GRID
// ─────────────────────────────────────────────────────────────────
export function ResponsiveGrid({ cols = { mobile:1, tablet:2, desktop:3 }, gap = 14, children, style }) {
  const { bp } = useBreakpoint();
  const c = cols[bp] || cols.desktop || 3;
  return (
    <div style={{ display:"grid", gridTemplateColumns:`repeat(${c},1fr)`, gap, ...style }}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// RIPPLE (attaches to any button click)
// ─────────────────────────────────────────────────────────────────
export function Ripple({ color = "rgba(255,255,255,.25)" }) {
  const [ripples, setRipples] = useState([]);
  const add = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();
    setRipples(r => [...r, { id, x, y }]);
    setTimeout(() => setRipples(r => r.filter(rp => rp.id !== id)), 600);
  }, []);
  return { ripples, addRipple: add, RippleEls: (
    <>
      {ripples.map(rp => (
        <span key={rp.id} style={{
          position:"absolute", left:rp.x, top:rp.y,
          width:40, height:40, marginLeft:-20, marginTop:-20,
          borderRadius:"50%", background:color, pointerEvents:"none",
          animation:"ripple .6s ease-out forwards",
        }}/>
      ))}
    </>
  )};
}

// ─────────────────────────────────────────────────────────────────
// BUTTON
// ─────────────────────────────────────────────────────────────────
export function Btn({ children, onClick, variant = "primary", size = "md",
                      disabled, loading, style, cs, bg, icon }) {
  injectCSS();
  const [pressed, setPressed] = useState(false);
  const { ripples, addRipple, RippleEls } = Ripple({ color:"rgba(255,255,255,.2)" });

  const sizes = { sm:"6px 12px", md:"9px 20px", lg:"12px 28px" };
  const fonts = { sm:11, md:13, lg:15 };

  const variants = {
    primary: { background:"linear-gradient(135deg,#6366f1,#0891b2)", color:"white",
               border:"none", boxShadow:"0 4px 16px rgba(99,102,241,.35)" },
    secondary:{ background:UI_TOKENS.blueDim, color:UI_TOKENS.blue,
                border:`1px solid ${UI_TOKENS.blueBorder}` },
    ghost:   { background:"transparent", color:UI_TOKENS.muted,
               border:`1px solid ${UI_TOKENS.border}` },
    danger:  { background:UI_TOKENS.redDim, color:UI_TOKENS.red,
               border:`1px solid rgba(239,68,68,.2)` },
    success: { background:UI_TOKENS.greenDim, color:UI_TOKENS.green,
               border:`1px solid ${UI_TOKENS.greenBorder}` },
    amber:   { background:UI_TOKENS.amberDim, color:UI_TOKENS.amber,
               border:`1px solid rgba(245,158,11,.2)` },
  };

  const v = variants[variant] || variants.primary;

  return (
    <button
      disabled={disabled || loading}
      onClick={e => { addRipple(e); onClick?.(e); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      className="ui-btn-hov"
      style={{
        ...v,
        padding: sizes[size],
        fontSize: fonts[size],
        fontWeight: 600,
        fontFamily: "'DM Sans',system-ui,sans-serif",
        borderRadius: 9,
        cursor: disabled || loading ? "not-allowed" : "pointer",
        opacity: disabled ? .45 : 1,
        display: "inline-flex", alignItems:"center", gap:6,
        position:"relative", overflow:"hidden",
        transform: pressed ? "scale(.97)" : "none",
        transition: "transform .1s",
        ...(bg ? { background: bg } : {}),
        ...style,
      }}>
      {loading ? <Spinner size={fonts[size]+1} color="currentColor"/> : icon}
      {children}
      {RippleEls}
    </button>
  );
}
export const scoreColor = sc;

// ─────────────────────────────────────────────────────────────────
// BADGE
// ─────────────────────────────────────────────────────────────────
export function Badge({ label, color, bg, border, dot }) {
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:4,
      fontSize:9.5, fontWeight:700, letterSpacing:".05em",
      padding:"2px 8px", borderRadius:99,
      color:color||UI_TOKENS.muted, background:bg||"rgba(100,116,139,.1)",
      border:`1px solid ${border||"transparent"}`,
    }}>
      {dot && <span style={{ width:5, height:5, borderRadius:"50%", background:color, flexShrink:0 }}/>}
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────
// SPINNER
// ─────────────────────────────────────────────────────────────────
export function Spinner({ size = 20, color = "#6366f1", thick = 2.5 }) {
  injectCSS();
  return (
    <div style={{
      width:size, height:size, flexShrink:0,
      border:`${thick}px solid rgba(255,255,255,.08)`,
      borderTop:`${thick}px solid ${color}`,
      borderRadius:"50%",
      animation:"spin .75s linear infinite",
    }}/>
  );
}

// ─────────────────────────────────────────────────────────────────
// SKELETON (shimmer variant)
// ─────────────────────────────────────────────────────────────────
export function Skeleton({ w = "100%", h = 14, r = 6, style }) {
  injectCSS();
  return (
    <div style={{
      width:w, height:h, borderRadius:r,
      background:"linear-gradient(90deg,rgba(255,255,255,.04) 25%,rgba(255,255,255,.08) 50%,rgba(255,255,255,.04) 75%)",
      backgroundSize:"200% 100%",
      animation:"shimmer 1.6s ease infinite",
      ...style,
    }}/>
  );
}

// ─────────────────────────────────────────────────────────────────
// SKELETON CARD (full card shimmer)
// ─────────────────────────────────────────────────────────────────
export function SkeletonCard({ h = 120, rows = 0, style }) {
  return (
    <div style={{
      background:UI_TOKENS.card, border:`1px solid ${UI_TOKENS.border}`,
      borderRadius:16, padding:"16px 18px",
      display:"flex", flexDirection:"column", gap:10,
      ...style,
    }}>
      <Skeleton h={h} r={10}/>
      {Array.from({length:rows}).map((_,i) => (
        <Skeleton key={i} h={12} r={6} w={i%2===0?"100%":"65%"}/>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SKELETON — HOME PAGE
// ─────────────────────────────────────────────────────────────────
export function SkeletonHome() {
  injectCSS();
  return (
    <div style={{ padding:"54px 16px 80px", maxWidth:520, margin:"0 auto",
      display:"flex", flexDirection:"column", gap:12 }}>
      {/* greeting */}
      <div style={{ background:UI_TOKENS.card, border:`1px solid ${UI_TOKENS.border}`,
        borderRadius:20, padding:"20px 20px", display:"flex",
        justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ flex:1, display:"flex", flexDirection:"column", gap:10 }}>
          <Skeleton h={10} w={80} r={4}/>
          <Skeleton h={22} w={160} r={8}/>
          <Skeleton h={10} w={200} r={4}/>
          <Skeleton h={18} w={80} r={99}/>
        </div>
        <div style={{ width:72, height:72, borderRadius:"50%", flexShrink:0,
          background:"linear-gradient(90deg,rgba(255,255,255,.04) 25%,rgba(255,255,255,.08) 50%,rgba(255,255,255,.04) 75%)",
          backgroundSize:"200% 100%", animation:"shimmer 1.6s ease infinite" }}/>
      </div>
      {/* CTA button */}
      <Skeleton h={68} r={20}/>
      {/* modes */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
        {[0,1,2].map(i=><Skeleton key={i} h={68} r={12}/>)}
      </div>
      {/* stats */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
        {[0,1,2].map(i=><Skeleton key={i} h={90} r={14}/>)}
      </div>
      {/* chart */}
      <Skeleton h={88} r={16}/>
      {/* shortcuts */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        {[0,1,2,3].map(i=><Skeleton key={i} h={72} r={16}/>)}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SKELETON — TABLE
// ─────────────────────────────────────────────────────────────────
export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div style={{ background:UI_TOKENS.card, border:`1px solid ${UI_TOKENS.border}`, borderRadius:14, overflow:"hidden" }}>
      {/* header */}
      <div style={{ display:"grid", gridTemplateColumns:`repeat(${cols},1fr)`,
        padding:"10px 18px", borderBottom:`1px solid ${UI_TOKENS.border}`, gap:12 }}>
        {Array.from({length:cols}).map((_,i)=><Skeleton key={i} h={8} r={4}/>)}
      </div>
      {/* rows */}
      {Array.from({length:rows}).map((_,ri)=>(
        <div key={ri} style={{ display:"grid", gridTemplateColumns:`repeat(${cols},1fr)`,
          padding:"13px 18px", borderBottom:ri<rows-1?`1px solid ${UI_TOKENS.border}`:"none", gap:12, alignItems:"center" }}>
          {Array.from({length:cols}).map((_,ci)=>(
            <Skeleton key={ci} h={ci===0?32:10} w={ci===0?"100%":["100%","70%","55%","40%"][ci%4]} r={ci===0?8:4}/>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SKELETON — PROFILE PAGE
// ─────────────────────────────────────────────────────────────────
export function SkeletonProfile() {
  return (
    <div style={{ padding:"54px 16px 80px", maxWidth:480, margin:"0 auto",
      display:"flex", flexDirection:"column", gap:14 }}>
      {/* avatar + name */}
      <div style={{ display:"flex", alignItems:"center", gap:14 }}>
        <Skeleton w={64} h={64} r={20}/>
        <div style={{ flex:1, display:"flex", flexDirection:"column", gap:8 }}>
          <Skeleton h={16} w={140} r={6}/>
          <Skeleton h={10} w={200} r={4}/>
          <Skeleton h={18} w={80} r={99}/>
        </div>
      </div>
      {/* stats row */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
        {[0,1,2].map(i=><Skeleton key={i} h={76} r={12}/>)}
      </div>
      {/* tabs */}
      <div style={{ display:"flex", gap:6 }}>
        {[0,1,2].map(i=><Skeleton key={i} h={32} w={80} r={99}/>)}
      </div>
      {/* content */}
      {[0,1,2,3].map(i=><Skeleton key={i} h={56} r={12}/>)}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────
export function EmptyState({ icon = "📭", title, desc, action, cs, minimal }) {
  injectCSS();
  if (minimal) return (
    <div style={{ padding:"24px 16px", textAlign:"center" }}>
      <div style={{ fontSize:28, marginBottom:8, opacity:.6 }}>{icon}</div>
      {title && <div style={{ fontSize:12, fontWeight:600, color:UI_TOKENS.muted }}>{title}</div>}
    </div>
  );
  return (
    <div style={{ textAlign:"center", padding:"48px 20px",
      animation:"fade-up .35s ease both" }}>
      <div style={{ fontSize:44, marginBottom:14, filter:"drop-shadow(0 4px 12px rgba(0,0,0,.3))",
        animation:"pop .4s cubic-bezier(.34,1.56,.64,1) both" }}>{icon}</div>
      {title && <div style={{ fontSize:15, fontWeight:700, color:UI_TOKENS.text,
        marginBottom:6, letterSpacing:"-.02em" }}>{title}</div>}
      {desc && <div style={{ fontSize:12, color:UI_TOKENS.muted, lineHeight:1.7,
        marginBottom:action?18:0, maxWidth:260, margin:"0 auto" }}>{desc}</div>}
      {action && <div style={{ marginTop:18 }}>{action}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ERROR STATE
// ─────────────────────────────────────────────────────────────────
export function ErrorState({ error, onRetry, isAr }) {
  injectCSS();
  return (
    <div style={{ textAlign:"center", padding:"40px 20px", animation:"fade-up .3s ease" }}>
      <div style={{ fontSize:40, marginBottom:12 }}>⚠️</div>
      <div style={{ fontSize:14, fontWeight:700, color:UI_TOKENS.red, marginBottom:6 }}>
        {isAr ? "حدث خطأ" : "Something went wrong"}
      </div>
      <div style={{ fontSize:11, color:UI_TOKENS.muted, marginBottom:16, lineHeight:1.6,
        fontFamily:"'DM Mono',monospace", background:"rgba(239,68,68,.05)",
        border:"1px solid rgba(239,68,68,.15)", borderRadius:8,
        padding:"8px 12px", maxWidth:300, margin:"0 auto 16px" }}>
        {error?.message || String(error) || "Unknown error"}
      </div>
      {onRetry && (
        <Btn onClick={onRetry} variant="ghost" size="sm">
          ↻ {isAr?"أعد المحاولة":"Retry"}
        </Btn>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// LOADING STATE (full-page)
// ─────────────────────────────────────────────────────────────────
export function LoadingState({ label, isAr }) {
  injectCSS();
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
      justifyContent:"center", padding:"60px 20px", gap:14, animation:"fade-in .3s ease" }}>
      <div style={{ position:"relative", width:48, height:48 }}>
        <Spinner size={48} color="#6366f1" thick={3}/>
        <div style={{ position:"absolute", inset:0, display:"flex",
          alignItems:"center", justifyContent:"center", fontSize:18 }}>◈</div>
      </div>
      <div style={{ fontSize:12, color:UI_TOKENS.muted, fontWeight:500 }}>
        {label || (isAr ? "جارٍ التحميل…" : "Loading…")}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ZERO STATE DASHBOARD (first-time user)
// ─────────────────────────────────────────────────────────────────
export function ZeroDashboard({ isAr, onStart }) {
  injectCSS();
  const steps = isAr ? [
    { icon:"🎯", title:"ابدأ جلستك الأولى",    desc:"فتح الكاميرا وحلل وضعيتك فوراً" },
    { icon:"📊", title:"شاهد تقاريرك",          desc:"تتبع تقدمك يومياً وأسبوعياً" },
    { icon:"🤖", title:"احصل على نصائح AI",     desc:"مدرب ذكاء اصطناعي يحلل وضعيتك" },
  ] : [
    { icon:"🎯", title:"Start your first session", desc:"Open camera and analyze posture live" },
    { icon:"📊", title:"See your reports",          desc:"Track daily & weekly progress" },
    { icon:"🤖", title:"Get AI coaching",           desc:"Personalized posture tips from AI" },
  ];
  return (
    <div style={{ padding:"32px 20px", textAlign:"center", animation:"fade-up .35s ease" }}>
      {/* illustration */}
      <div style={{ fontSize:64, marginBottom:8, lineHeight:1,
        animation:"pop .5s cubic-bezier(.34,1.56,.64,1) both" }}>🏃</div>
      <div style={{ fontSize:20, fontWeight:800, color:UI_TOKENS.text, letterSpacing:"-.04em",
        marginBottom:6 }}>
        {isAr ? "ابدأ رحلتك مع Corvus" : "Your journey starts here"}
      </div>
      <div style={{ fontSize:13, color:UI_TOKENS.muted, marginBottom:28, lineHeight:1.7 }}>
        {isAr
          ? "لا توجد جلسات بعد — ابدأ جلستك الأولى الآن واكتشف كيف يمكن تحسين صحتك"
          : "No sessions yet — start your first session and discover how to improve your posture"}
      </div>
      {/* steps */}
      <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:24, textAlign:"left" }}>
        {steps.map((s,i) => (
          <div key={i} style={{
            background:UI_TOKENS.card, border:`1px solid ${UI_TOKENS.border}`,
            borderRadius:14, padding:"14px 16px",
            display:"flex", alignItems:"center", gap:14,
            animation:`fade-up .35s ${i*.08}s ease both`,
          }}>
            <div style={{ width:40, height:40, borderRadius:12, flexShrink:0,
              background:`rgba(99,102,241,.12)`,
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>
              {s.icon}
            </div>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:UI_TOKENS.text, marginBottom:2 }}>{s.title}</div>
              <div style={{ fontSize:11, color:UI_TOKENS.muted }}>{s.desc}</div>
            </div>
            <div style={{ marginLeft:"auto", fontSize:16, color:"rgba(255,255,255,.15)" }}>›</div>
          </div>
        ))}
      </div>
      {onStart && (
        <Btn onClick={onStart} size="lg" style={{ width:"100%", justifyContent:"center" }}>
          ▶ {isAr ? "ابدأ الآن" : "Start First Session"}
        </Btn>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ONBOARDING FLOW (step-by-step wizard)
// ─────────────────────────────────────────────────────────────────
export function OnboardingWizard({ steps, onComplete, isAr }) {
  injectCSS();
  const [step, setStep] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const s = steps[step];

  const next = () => {
    setLeaving(true);
    setTimeout(() => {
      setLeaving(false);
      if (step < steps.length - 1) setStep(step+1);
      else onComplete?.();
    }, 200);
  };
  const skip = () => { setLeaving(true); setTimeout(()=>onComplete?.(), 200); };

  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,.85)",
      backdropFilter:"blur(12px)", zIndex:9900,
      display:"flex", alignItems:"flex-end", justifyContent:"center",
    }}>
      <div style={{
        background:UI_TOKENS.surface, border:`1px solid ${UI_TOKENS.border}`,
        borderRadius:"24px 24px 0 0", width:"100%", maxWidth:480,
        padding:"28px 24px 32px",
        animation: leaving ? "slide-down .2s ease both" : "slide-up .35s cubic-bezier(.16,1,.3,1) both",
      }}>
        {/* progress dots */}
        <div style={{ display:"flex", justifyContent:"center", gap:6, marginBottom:24 }}>
          {steps.map((_,i) => (
            <div key={i} style={{
              width: i===step ? 20 : 6, height:6, borderRadius:99,
              background: i<=step ? UI_TOKENS.blue : UI_TOKENS.border,
              transition:"all .3s ease",
            }}/>
          ))}
        </div>
        {/* content */}
        <div style={{ textAlign:"center", animation:"fade-up .25s ease both" }}>
          <div style={{ fontSize:56, marginBottom:12, lineHeight:1 }}>{s.icon}</div>
          <div style={{ fontSize:18, fontWeight:800, color:UI_TOKENS.text, letterSpacing:"-.03em",
            marginBottom:8 }}>{s.title}</div>
          <div style={{ fontSize:13, color:UI_TOKENS.muted, lineHeight:1.7,
            marginBottom:24 }}>{s.desc}</div>
        </div>
        {/* actions */}
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <Btn onClick={next} size="lg" style={{ width:"100%", justifyContent:"center" }}>
            {step < steps.length-1 ? (isAr ? "التالي →" : "Next →") : (isAr ? "ابدأ 🚀" : "Get Started 🚀")}
          </Btn>
          <button onClick={skip} style={{ background:"none", border:"none",
            fontSize:12, color:UI_TOKENS.muted, cursor:"pointer", padding:"4px" }}>
            {isAr ? "تخطى" : "Skip"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SUCCESS CHECK ANIMATION
// ─────────────────────────────────────────────────────────────────
export function SuccessCheck({ size = 64, color = "#10b981", onDone, delay = 600 }) {
  injectCSS();
  const [show, setShow] = useState(true);
  useEffect(() => {
    if (onDone) { const t = setTimeout(onDone, delay+400); return () => clearTimeout(t); }
  }, [onDone, delay]);
  if (!show) return null;
  return (
    <div style={{
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      gap:10, animation:"pop .4s cubic-bezier(.34,1.56,.64,1) both",
    }}>
      <svg width={size} height={size} viewBox="0 0 52 52">
        <circle cx="26" cy="26" r="25" fill={`${color}18`}
          stroke={color} strokeWidth="2"/>
        <path fill="none" stroke={color} strokeWidth="3.5"
          strokeLinecap="round" strokeLinejoin="round"
          d="M14.5 27l8 8 15-16"
          style={{ strokeDasharray:30, animation:`check-draw .4s ${delay*.001}s ease both` }}/>
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// PULSE RING (for live/active indicators)
// ─────────────────────────────────────────────────────────────────
export function PulseRing({ color = "#10b981", size = 10 }) {
  injectCSS();
  return (
    <div style={{ position:"relative", width:size, height:size, flexShrink:0 }}>
      <div style={{ position:"absolute", inset:0, borderRadius:"50%",
        border:`2px solid ${color}`, animation:"pulse-ring 1.4s ease infinite" }}/>
      <div style={{ position:"absolute", inset:2, borderRadius:"50%", background:color }}/>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// COUNT UP (animated number)
// ─────────────────────────────────────────────────────────────────
export function CountUp({ to, duration = 1200, suffix = "", style }) {
  injectCSS();
  const [val, setVal] = useState(0);
  const frame = useRef(null);
  useEffect(() => {
    const start = performance.now();
    const tick = now => {
      const p = Math.min((now-start)/duration, 1);
      const ease = 1 - Math.pow(1-p, 3);
      setVal(Math.round(ease * to));
      if (p < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [to, duration]);
  return <span style={{ animation:"count-up .3s ease both", ...style }}>{val}{suffix}</span>;
}

// ─────────────────────────────────────────────────────────────────
// CONFETTI (achievement unlock)
// ─────────────────────────────────────────────────────────────────
export function Confetti({ count = 28, onDone }) {
  injectCSS();
  const colors = ["#6366f1","#10b981","#f59e0b","#ef4444","#38bdf8","#a78bfa","#fb923c"];
  const shapes = ["■","●","▲","◆","★"];
  const [active, setActive] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => { setActive(false); onDone?.(); }, 2000);
    return () => clearTimeout(t);
  }, [onDone]);
  if (!active) return null;
  return (
    <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:9999, overflow:"hidden" }}>
      {Array.from({length:count}).map((_,i) => {
        const x = Math.random()*100;
        const dx  = (Math.random()-0.5)*80;
        const dx2 = (Math.random()-0.5)*120;
        const col = colors[i%colors.length];
        const shape = shapes[i%shapes.length];
        const dur = 1.2 + Math.random()*.8;
        const delay = Math.random()*.5;
        return (
          <div key={i} style={{
            position:"absolute", top:`${-5+Math.random()*20}%`, left:`${x}%`,
            fontSize:10+Math.random()*8, color:col, fontWeight:900,
            animation:`float-particle ${dur}s ${delay}s ease-out forwards`,
            "--dx":`${dx}px`, "--dx2":`${dx2}px`,
          }}>{shape}</div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ACHIEVEMENT TOAST (unlocked badge)
// ─────────────────────────────────────────────────────────────────
export function AchievementToast({ title, desc, icon = "🏆", onClose, isAr }) {
  injectCSS();
  const [show, setShow]     = useState(true);
  const [confetti, setConf] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => { setShow(false); setTimeout(onClose, 400); }, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <>
      {confetti && <Confetti count={24} onDone={() => setConf(false)}/>}
      <div style={{
        position:"fixed", bottom:88, [isAr?"left":"right"]:16, zIndex:9998,
        background:"linear-gradient(135deg,rgba(167,139,250,.15),rgba(99,102,241,.1))",
        border:"1px solid rgba(167,139,250,.35)",
        borderRadius:18, padding:"14px 16px", maxWidth:280,
        backdropFilter:"blur(20px)",
        boxShadow:"0 8px 32px rgba(0,0,0,.5)",
        display:"flex", gap:12, alignItems:"flex-start",
        animation: show ? "fade-up .35s cubic-bezier(.16,1,.3,1) both" : "scale-out .2s ease both",
      }}>
        <div style={{ width:44, height:44, borderRadius:14, flexShrink:0,
          background:"rgba(167,139,250,.15)",
          display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>
          {icon}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:10, fontWeight:700, color:"#c4b5fd",
            letterSpacing:".08em", textTransform:"uppercase", marginBottom:2 }}>
            {isAr ? "إنجاز جديد 🎉" : "Achievement Unlocked 🎉"}
          </div>
          <div style={{ fontSize:13, fontWeight:700, color:UI_TOKENS.text, marginBottom:2 }}>{title}</div>
          <div style={{ fontSize:11, color:UI_TOKENS.muted, lineHeight:1.4 }}>{desc}</div>
        </div>
        <button onClick={() => { setShow(false); setTimeout(onClose,400); }}
          style={{ background:"none", border:"none", color:UI_TOKENS.muted,
            cursor:"pointer", fontSize:14, flexShrink:0, padding:"0 0 0 4px" }}>×</button>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// PROGRESS BAR
// ─────────────────────────────────────────────────────────────────
export function ProgressBar({ value, max = 100, color, label, showPct, h = 6 }) {
  const pct = Math.min(100, Math.round((value/max)*100));
  const col = color || (pct>=75?UI_TOKENS.green:pct>=50?UI_TOKENS.amber:UI_TOKENS.red);
  return (
    <div>
      {(label||showPct) && (
        <div style={{ display:"flex", justifyContent:"space-between",
          marginBottom:6, fontSize:11, color:UI_TOKENS.muted }}>
          {label && <span>{label}</span>}
          {showPct && <span style={{ fontWeight:600, color:col }}>{pct}%</span>}
        </div>
      )}
      <div style={{ height:h, background:UI_TOKENS.border, borderRadius:99, overflow:"hidden" }}>
        <div style={{
          height:"100%", width:`${pct}%`, background:col,
          borderRadius:99, transition:"width .7s cubic-bezier(.16,1,.3,1)",
          boxShadow: pct>0 ? `0 0 8px ${col}50` : "none",
        }}/>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// BOTTOM SHEET (mobile-native feel)
// ─────────────────────────────────────────────────────────────────
export function BottomSheet({ open, onClose, children, title, maxH = "82vh" }) {
  injectCSS();
  const [closing, setClosing] = useState(false);
  const startY = useRef(null);
  const close = useCallback(() => {
    setClosing(true);
    setTimeout(() => { setClosing(false); onClose?.(); }, 260);
  }, [onClose]);

  // swipe-down to close
  const onTouchStart = e => { startY.current = e.touches[0].clientY; };
  const onTouchEnd   = e => {
    if (startY.current && e.changedTouches[0].clientY - startY.current > 60) close();
    startY.current = null;
  };

  if (!open && !closing) return null;
  return (
    <div style={{
      position:"fixed", inset:0, zIndex:9800,
      background: open && !closing ? "rgba(0,0,0,.6)" : "rgba(0,0,0,0)",
      backdropFilter: open && !closing ? "blur(4px)" : "none",
      transition:"background .26s, backdrop-filter .26s",
      display:"flex", alignItems:"flex-end", justifyContent:"center",
    }} onClick={e => e.target===e.currentTarget&&close()}>
      <div
        onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
        style={{
          background:UI_TOKENS.surface, borderTop:`1px solid ${UI_TOKENS.border}`,
          borderRadius:"24px 24px 0 0",
          width:"100%", maxWidth:520,
          maxHeight:maxH, overflowY:"auto",
          paddingBottom:"env(safe-area-inset-bottom,16px)",
          animation: closing ? "slide-down .26s ease both" : "slide-up .32s cubic-bezier(.16,1,.3,1) both",
        }}>
        {/* drag handle */}
        <div style={{ display:"flex", justifyContent:"center", padding:"12px 0 0" }}>
          <div style={{ width:36, height:4, background:UI_TOKENS.border, borderRadius:99 }}/>
        </div>
        {title && (
          <div style={{ padding:"12px 20px 8px", display:"flex",
            justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontSize:15, fontWeight:700, color:UI_TOKENS.text }}>{title}</span>
            <button onClick={close} style={{ background:"none", border:"none",
              color:UI_TOKENS.muted, cursor:"pointer", fontSize:20, lineHeight:1 }} aria-label="Close">×</button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// MODAL (desktop overlay)
// ─────────────────────────────────────────────────────────────────
export function Modal({ children, onClose, cs, maxWidth = 500, title }) {
  injectCSS();
  const [closing, setClosing] = useState(false);
  const close = useCallback(() => {
    setClosing(true);
    setTimeout(() => { setClosing(false); onClose?.(); }, 200);
  }, [onClose]);

  useEffect(() => {
    const fn = e => e.key==="Escape" && close();
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [close]);

  return (
    <div
      onClick={e => e.target===e.currentTarget && close()}
      style={{
        position:"fixed", inset:0,
        background:"rgba(0,0,0,.75)",
        backdropFilter:"blur(12px)",
        WebkitBackdropFilter:"blur(12px)",
        display:"flex", alignItems:"center", justifyContent:"center",
        zIndex:9500, padding:16,
      }}>
      <div style={{
        background: cs?.card || UI_TOKENS.surface,
        border:`1px solid ${cs?.border || UI_TOKENS.border}`,
        borderRadius:22,
        width:`min(${maxWidth}px,96vw)`,
        maxHeight:"92vh", overflowY:"auto",
        animation: closing ? "scale-out .2s ease both" : "scale-in .25s cubic-bezier(.16,1,.3,1) both",
      }}>
        {title && (
          <div style={{ padding:"18px 20px 14px", borderBottom:`1px solid ${UI_TOKENS.border}`,
            display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontSize:15, fontWeight:700, color:UI_TOKENS.text }}>{title}</span>
            <button onClick={close} style={{ background:"none", border:"none",
              color:UI_TOKENS.muted, cursor:"pointer", fontSize:20, lineHeight:1 }} aria-label="Close">×</button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// TOASTS
// ─────────────────────────────────────────────────────────────────
const TOAST_META = {
  success:{ bg:"linear-gradient(135deg,#059669,#047857)", icon:"✓", glow:"rgba(5,150,105,.4)" },
  error:  { bg:"linear-gradient(135deg,#dc2626,#b91c1c)", icon:"✕", glow:"rgba(220,38,38,.4)" },
  warn:   { bg:"linear-gradient(135deg,#d97706,#b45309)", icon:"⚠", glow:"rgba(217,119,6,.4)" },
  info:   { bg:"linear-gradient(135deg,#6366f1,#4f46e5)", icon:"ℹ", glow:"rgba(99,102,241,.4)" },
};
export function Toasts({ toasts = [], dismiss, isAr = false }) {
  injectCSS();
  return (
    <div style={{
      position:"fixed", bottom:88, [isAr?"left":"right"]:16, zIndex:9999,
      display:"flex", flexDirection:"column-reverse", gap:8,
      maxWidth:320, pointerEvents:"none",
    }}>
      {toasts.map(t => {
        const m = TOAST_META[t.type] || TOAST_META.info;
        return (
          <div key={t.id} onClick={()=>dismiss?.(t.id)}
            style={{
              background:m.bg, color:"white",
              padding:"11px 14px", borderRadius:13,
              fontSize:12.5, fontWeight:500,
              cursor:"pointer",
              boxShadow:`0 6px 24px ${m.glow}`,
              display:"flex", gap:9, alignItems:"flex-start",
              animation:`${isAr?"toast-l":"toast-r"} .25s cubic-bezier(.16,1,.3,1) both`,
              direction:isAr?"rtl":"ltr",
              pointerEvents:"auto",
              maxWidth:"100%",
            }}>
            <span style={{ flexShrink:0, fontSize:13, fontWeight:900,
              width:20, height:20, borderRadius:99,
              background:"rgba(255,255,255,.18)",
              display:"flex", alignItems:"center", justifyContent:"center" }}>{m.icon}</span>
            <span style={{ flex:1, lineHeight:1.45 }}>{t.text||t.msg}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// OFFLINE BANNER
// ─────────────────────────────────────────────────────────────────
export function OfflineBanner({ lang = "en" }) {
  injectCSS();
  const [show, setShow] = useState(false);
  const [back, setBack] = useState(false);
  useEffect(() => {
    const on  = () => { setShow(false); setBack(true); setTimeout(()=>setBack(false),3000); };
    const off = () => setShow(true);
    window.addEventListener("online",  on);
    window.addEventListener("offline", off);
    setShow(!navigator.onLine);
    return () => { window.removeEventListener("online",on); window.removeEventListener("offline",off); };
  }, []);
  if (back) return (
    <div style={{
      position:"fixed", top:0, left:0, right:0, zIndex:9999,
      background:"linear-gradient(135deg,#059669,#047857)", color:"white",
      textAlign:"center", padding:"9px 16px", fontSize:12, fontWeight:600,
      animation:"fade-up .3s ease",
    }}>
      ✓ {lang==="ar" ? "تم الاتصال بالإنترنت" : "Back online — syncing…"}
    </div>
  );
  if (!show) return null;
  return (
    <div style={{
      position:"fixed", top:0, left:0, right:0, zIndex:9999,
      background:"linear-gradient(135deg,#d97706,#b45309)", color:"white",
      textAlign:"center", padding:"9px 16px", fontSize:12, fontWeight:600,
    }}>
      ⚡ {lang==="ar" ? "أنت غير متصل — البيانات محفوظة محلياً" : "Offline — data saved locally, will sync when back"}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SCORE RING
// ─────────────────────────────────────────────────────────────────
export function Ring({ score, size = 78, strokeWidth = 6 }) {
  injectCSS();
  const r     = (size/2) - strokeWidth;
  const circ  = 2 * Math.PI * r;
  const dash  = Math.max(0, Math.min(100, score||0)) / 100 * circ;
  const col   = sc(score||0);
  return (
    <svg width={size} height={size} style={{ transform:"rotate(-90deg)", flexShrink:0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke="rgba(148,163,184,.08)" strokeWidth={strokeWidth}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={col} strokeWidth={strokeWidth}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition:"stroke-dasharray .7s cubic-bezier(.16,1,.3,1)" }}/>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────
// METRIC ROW
// ─────────────────────────────────────────────────────────────────
export function MetRow({ label, value, unit, score: s, cs }) {
  const col = s>=75?UI_TOKENS.green:s>=50?UI_TOKENS.amber:s>0?UI_TOKENS.red:"rgba(148,163,184,.25)";
  const icon = s>=75?"✅":s>=50?"⚠️":s>0?"❌":"○";
  return (
    <div style={{ padding:"8px 0", borderBottom:`1px solid ${UI_TOKENS.border}` }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ fontSize:11 }}>{icon}</span>
          <span style={{ fontSize:11.5, color:s>0?UI_TOKENS.text:UI_TOKENS.muted, fontWeight:s>0?500:400 }}>{label}</span>
        </div>
        <span style={{ fontSize:12, fontWeight:700, color:col }}>
          {value!=null?value:"—"}{unit&&value!=null?unit:""}
        </span>
      </div>
      <div style={{ height:4, borderRadius:99, background:"rgba(255,255,255,.06)", overflow:"hidden" }}>
        <div style={{ height:"100%", width:s>0?`${Math.min(100,s)}%`:"0%",
          background:`linear-gradient(90deg,${col}88,${col})`,
          borderRadius:99, transition:"width .5s cubic-bezier(.4,0,.2,1)" }}/>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// BAR CHART
// ─────────────────────────────────────────────────────────────────
export function BarChart({ data, color = "#6366f1", cs, height = 44 }) {
  if (!data?.length) return null;
  const max = Math.max(...data.map(d=>d.v||0), 1);
  return (
    // direction:"ltr" is intentional: this is a time-series chart, and
    // chronological order (oldest→newest, left→right) must stay fixed
    // regardless of UI language. Without it, this flex row inherits
    // direction:rtl from the Arabic UI and the browser auto-mirrors the
    // bars — the most recent session (last item, e.g. "S10") ends up on
    // the visual LEFT instead of the chart's chronological end, making
    // Session History read backwards for Arabic users.
    <div dir="ltr" style={{ display:"flex", alignItems:"flex-end", gap:4, height }}>
      {data.map((d,i) => (
        <div key={i} style={{ flex:1, display:"flex", flexDirection:"column",
          alignItems:"center", gap:3 }}>
          <div style={{
            width:"100%", borderRadius:"3px 3px 0 0", background:color,
            height:Math.max(2, Math.round(((d.v||0)/max)*height)),
            transition:"height .5s ease", opacity:.85,
          }} title={`${d.l}: ${d.v||0}`}/>
          {d.l&&<div style={{ fontSize:7, color:cs?.muted||UI_TOKENS.muted,
            overflow:"hidden", whiteSpace:"nowrap" }}>{d.l}</div>}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// TIER BADGE
// ─────────────────────────────────────────────────────────────────
export function TierBadge({ tier, isTrial }) {
  const m = {
    elite:        {bg:"rgba(167,139,250,.12)",text:"#c4b5fd",border:"rgba(167,139,250,.25)"},
    professional: {bg:"rgba(56,189,248,.12)", text:"#7dd3fc",border:"rgba(56,189,248,.25)"},
    standard:     {bg:"rgba(99,102,241,.12)", text:"#a5b4fc",border:"rgba(99,102,241,.25)"},
  }[tier] || {bg:"rgba(99,102,241,.1)",text:"#a5b4fc",border:"rgba(99,102,241,.2)"};
  return (
    <div style={{ background:m.bg, color:m.text, border:`1px solid ${m.border}`,
      borderRadius:99, padding:"2px 9px", fontSize:9.5, fontWeight:700,
      display:"inline-flex", alignItems:"center", gap:4 }}>
      {tier?.toUpperCase()}
      {isTrial && <span style={{ opacity:.7, fontSize:9 }}>⏱</span>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// DIVIDER
// ─────────────────────────────────────────────────────────────────
export function Divider({ label, my = 16 }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, margin:`${my}px 0` }}>
      <div style={{ flex:1, height:1, background:UI_TOKENS.border }}/>
      {label && <span style={{ fontSize:10, color:UI_TOKENS.muted, fontWeight:600,
        letterSpacing:".08em", textTransform:"uppercase", flexShrink:0 }}>{label}</span>}
      <div style={{ flex:1, height:1, background:UI_TOKENS.border }}/>
    </div>
  );
}

// ── Avatar — user profile picture with fallback initials ──────────
export function Avatar({ name = "", photo = "", size = 36, style = {} }) {
  const initials = name.split(" ").slice(0, 2).map(w => w[0]?.toUpperCase() || "").join("");
  if (photo) {
    return (
      <img
        src={photo} alt={name}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, ...style }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: "linear-gradient(135deg,#6366f1,#0891b2)",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontSize: size * 0.38, fontWeight: 700,
      userSelect: "none", ...style,
    }}>
      {initials || "?"}
    </div>
  );
}

// ── SectionHeader — consistent section title + subtitle + action ──
export function SectionHeader({ title, sub, action, style = {} }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      marginBottom: 12, gap: 8, ...style,
    }}>
      <div>
        {title && (
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--color-text, #111)" }}>
            {title}
          </p>
        )}
        {sub && (
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--color-muted, #888)" }}>
            {sub}
          </p>
        )}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}


// ── Re-exports from interactions.jsx ─────────────────────────────
export {
  ConfettiCanvas, RippleBtn, AnimatedNumber, ScorePulse, HoverCard, StreakFlame, ScoreReveal, PageTransition, SwipeHint, LiveDot, useToast, useAchievement,
} from "./interactions.jsx";

// ── Re-exports from states.jsx ────────────────────────────────────
export {
  SkeletonBox, SkeletonText, SkeletonStat, SkeletonChart, SkeletonShortcut, SkeletonHero, SkeletonTableRows, HomePageSkeleton, ZeroStateSessions, ZeroStateAnalytics, ZeroStateLeaderboard, OnboardingSteps, OnboardingWelcome, ErrorNetwork, ErrorPermission, PageLoader, InlineLoader,
} from "./states.jsx";

