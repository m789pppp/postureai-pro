// ── lpShared.js — shared tokens, helpers, and micro-components ────
// Imported by LandingPageV7.jsx and all standalone nav pages
import { useState, useEffect, useRef } from "react";
import { motion, useInView } from "framer-motion";

export const CALENDLY_URL = import.meta.env.VITE_CALENDLY_URL ||
  `mailto:${import.meta.env.VITE_SUPPORT_EMAIL||"m789pppp@gmail.com"}?subject=Demo%20Request%20—%20Corvus%20PostureAI&body=Hi%2C%20I%27d%20like%20to%20book%20a%20demo.%0A%0ACompany%3A%0ATeam%20size%3A%0ACountry%3A`;

export const LPV7_TOKENS = {
  bg:    "#030b14", bg1:   "#040d18", bg2:   "#06111e",
  surf:  "#0a1828", card:  "#0d1f33",
  border:"rgba(148,163,184,.08)", borderM:"rgba(148,163,184,.16)",
  text:  "#e8f0ff", sub:   "#94a3b8", muted: "#475569",
  blue:  "#4f7cf9", indigo:"#818cf8", sky:   "#22d3ee",
  green: "#10d9a0", amber: "#f59e0b", red:   "#f87171", violet:"#a78bfa",
  gBlue: "linear-gradient(135deg,#4f7cf9,#22d3ee)",
  gHero: "linear-gradient(130deg,#818cf8 0%,#22d3ee 45%,#10d9a0 100%)",
  gCard: "linear-gradient(140deg,rgba(79,124,249,.08),rgba(34,211,238,.04))",
};

export const FONT_DISPLAY = "'IBM Plex Sans Arabic','Segoe UI',system-ui,sans-serif";
export const FONT_MONO    = "'IBM Plex Mono','Segoe UI',monospace";

export const TYPE = {
  hero:    { fontSize:"clamp(40px,4.6vw + 14px,72px)", lineHeight:1.06, letterSpacing:"-.03em", fontWeight:800 },
  h2:      { fontSize:"clamp(28px,2.6vw + 14px,48px)", lineHeight:1.1,  letterSpacing:"-.025em", fontWeight:800 },
  h3:      { fontSize:"clamp(17px,1.4vw + 8px,22px)",  lineHeight:1.25, letterSpacing:"-.01em",  fontWeight:700 },
  body:    { fontSize:"clamp(15px,1.1vw + 8px,17px)",  lineHeight:1.7 },
  bodySm:  { fontSize:"clamp(13px,.9vw + 7px,15px)",   lineHeight:1.65 },
  label:   { fontSize:12, fontWeight:600, letterSpacing:".08em", textTransform:"uppercase" },
};

export const card = (glow = false) => ({
  background: LPV7_TOKENS.card,
  border: `1px solid ${glow ? "rgba(79,124,249,.25)" : LPV7_TOKENS.border}`,
  borderRadius: 20,
  padding: 32,
  backdropFilter: "blur(12px)",
  boxShadow: glow ? "0 0 40px rgba(79,124,249,.08),0 8px 32px rgba(0,0,0,.3)" : "0 4px 24px rgba(0,0,0,.25)",
});

export const btn = (variant = "primary", size = "md") => {
  const sizes = { sm:{ h:40, pad:"0 18px", fs:14 }, md:{ h:46, pad:"0 24px", fs:15 }, lg:{ h:52, pad:"0 32px", fs:16.5 } };
  const s = sizes[size];
  const base = {
    display:"inline-flex", alignItems:"center", justifyContent:"center", gap:8,
    height:s.h, padding:s.pad, borderRadius:12, fontWeight:600,
    fontSize:s.fs, cursor:"pointer",
    transition:"transform .25s cubic-bezier(.16,1,.3,1), box-shadow .25s, background .25s, border-color .25s",
    border:"none", textDecoration:"none", letterSpacing:"-.01em", whiteSpace:"nowrap",
  };
  if (variant === "primary") return { ...base, background:LPV7_TOKENS.gBlue, color:"#fff", boxShadow:"0 4px 24px rgba(79,124,249,.35)" };
  if (variant === "ghost")   return { ...base, background:"rgba(255,255,255,.05)", color:LPV7_TOKENS.text, border:`1px solid ${LPV7_TOKENS.border}` };
  if (variant === "outline") return { ...base, background:"transparent", color:LPV7_TOKENS.indigo, border:"1px solid rgba(129,140,248,.4)" };
  return base;
};

export const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || "m789pppp@gmail.com";

export function Reveal({ children, delay = 0, y = 28, style = {}, className }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div ref={ref} className={className} style={style}
      initial={{ opacity:0, y }} animate={inView ? { opacity:1, y:0 } : {}}
      transition={{ duration:.55, delay, ease:[0.22,1,0.36,1] }}>
      {children}
    </motion.div>
  );
}

export function Stagger({ children, gap = 0.08, style = {}, className }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  return (
    <motion.div ref={ref} className={className} style={style}
      initial="hidden" animate={inView ? "show" : "hidden"}
      variants={{ hidden:{}, show:{ transition:{ staggerChildren: gap } } }}>
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, y = 24, style = {}, className }) {
  return (
    <motion.div className={className} style={style}
      variants={{
        hidden:{ opacity:0, y },
        show:{ opacity:1, y:0, transition:{ duration:.5, ease:[0.22,1,0.36,1] } },
      }}>
      {children}
    </motion.div>
  );
}

export function AnimNum({ to, suffix = "", prefix = "", decimals = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let start = null;
    const dur = 1400;
    const step = ts => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / dur, 1);
      setVal(+(to * (p < .5 ? 2*p*p : 1-Math.pow(-2*p+2,2)/2)).toFixed(decimals));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, to, decimals]);
  return <span ref={ref}>{prefix}{val.toLocaleString()}{suffix}</span>;
}

export function SectionHead({ eyebrow, eyebrowColor, eyebrowBg, eyebrowBorder, title, sub, subMax = 560, align = "center" }) {
  const T = LPV7_TOKENS;
  return (
    <Reveal y={20}>
      <div style={{ textAlign: align, marginBottom:"clamp(32px,4vw,52px)" }}>
        {eyebrow && (
          <div style={{ display:"inline-flex", alignItems:"center", gap:7, marginBottom:14,
            padding:"5px 14px", borderRadius:99,
            background: eyebrowBg   || "rgba(79,124,249,.08)",
            border:     `1px solid ${eyebrowBorder || "rgba(79,124,249,.2)"}`,
          }}>
            <span style={{ width:5,height:5,borderRadius:"50%",background:eyebrowColor||T.blue,flexShrink:0 }}/>
            <span style={{ ...TYPE.label, color:eyebrowColor||T.blue }}>{eyebrow}</span>
          </div>
        )}
        <h2 style={{ ...TYPE.h2, color:T.text, margin:"0 0 16px", fontFamily:FONT_DISPLAY }}>{title}</h2>
        {sub && <p style={{ ...TYPE.body, color:T.sub, maxWidth:subMax, margin:"0 auto", lineHeight:1.7 }}>{sub}</p>}
      </div>
    </Reveal>
  );
}

// ── Shared page shell (Nav + Footer wrapper) ──────────────────────
export function PageShell({ children, lang, setLang }) {
  const T = LPV7_TOKENS;
  return (
    <div style={{ background:T.bg, minHeight:"100vh", color:T.text, fontFamily:FONT_DISPLAY }}>
      {children}
    </div>
  );
}

// ── Global CSS string used across pages ───────────────────────────
export const LP_GLOBAL_CSS = `
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
  body{background:#030b14;color:#e8f0ff;font-family:'IBM Plex Sans Arabic','Segoe UI',system-ui,sans-serif;line-height:1.6;overflow-x:hidden}
  .lp-wrap{max-width:1180px;margin:0 auto;padding:0 32px}
  .lp-section{padding:clamp(52px,7vw,96px) 32px}
  .lp-lift{transition:transform .22s ease,box-shadow .22s ease}
  .lp-lift:hover{transform:translateY(-3px);box-shadow:0 12px 40px rgba(0,0,0,.4)}
  .lp-btn{display:inline-flex;align-items:center;gap:8px;padding:13px 28px;border-radius:12px;font-weight:700;font-size:15px;text-decoration:none;border:none;cursor:pointer;transition:all .2s;font-family:inherit}
  .lp-btn-primary{background:linear-gradient(135deg,#4f7cf9,#22d3ee);color:#fff}
  .lp-btn-primary:hover{opacity:.9;transform:translateY(-1px)}
  .lp-btn-outline{background:rgba(79,124,249,.08);color:#818cf8;border:1px solid rgba(79,124,249,.25)}
  .lp-btn-outline:hover{background:rgba(79,124,249,.16);border-color:rgba(79,124,249,.5)}
  @media(max-width:1024px){.lp-wrap{padding:0 20px}.lp-section{padding:56px 20px}}
  @media(max-width:720px){.lp-wrap{padding:0 16px}.lp-section{padding:48px 16px}}
`;
