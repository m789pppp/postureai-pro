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


function StandaloneNav({ lang, setLang }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const ar = lang === "ar";
  const T = LPV7_TOKENS;

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 48);
    window.addEventListener("scroll", h, { passive:true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  const navItems = ar ? [
    { label:"المنتج",    href:"/#features" },
    { label:"الحلول",   href:"/#casestudies" },
    { label:"الأسعار",  href:"/#pricing" },
    { label:"كيف يعمل", href:"/#how" },
    { label:"الأسئلة",  href:"/#faq" },
  ] : [
    { label:"Product",      href:"/#features" },
    { label:"Solutions",    href:"/#casestudies" },
    { label:"Pricing",      href:"/#pricing" },
    { label:"How it works", href:"/#how" },
    { label:"FAQ",          href:"/#faq" },
  ];

  const btnStyle = {
    display:"inline-flex", alignItems:"center", justifyContent:"center", gap:8,
    height:38, padding:"0 18px", borderRadius:10, fontWeight:600,
    fontSize:13, cursor:"pointer", border:"none", textDecoration:"none",
    background:"linear-gradient(135deg,#1a56db,#0891b2)", color:"#fff",
    boxShadow:"0 4px 16px rgba(26,86,219,.35)", transition:"opacity .2s",
    fontFamily:"inherit", whiteSpace:"nowrap",
  };

  return (
    <>
      <nav style={{
        position:"fixed", top:0, left:0, right:0, zIndex:1000,
        background: scrolled||mobileOpen ? "rgba(3,8,18,.95)" : "rgba(3,8,18,.55)",
        backdropFilter:"blur(28px) saturate(180%)",
        WebkitBackdropFilter:"blur(28px) saturate(180%)",
        borderBottom:`1px solid ${scrolled ? "rgba(255,255,255,.08)" : "transparent"}`,
        boxShadow: scrolled ? "0 2px 40px rgba(0,0,0,.4)" : "none",
        transition:"background .3s, border-color .3s, box-shadow .3s",
      }}>
        <div style={{
          maxWidth:1180, margin:"0 auto", padding:"0 32px",
          height:68, display:"flex", alignItems:"center",
          justifyContent:"space-between", gap:16,
        }}>

          {/* Logo → home */}
          <a href="/" style={{ display:"flex", alignItems:"center", gap:10, textDecoration:"none", flexShrink:0 }}>
            <div style={{
              width:36, height:36, borderRadius:10, flexShrink:0,
              background:"linear-gradient(135deg,#1a56db,#0891b2)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:18, color:"#fff", fontWeight:900,
              boxShadow:"0 4px 16px rgba(26,86,219,.45)",
            }}>◈</div>
            <div style={{ lineHeight:1.15 }}>
              <div style={{ fontWeight:800, fontSize:15, color:"#f1f5f9", letterSpacing:"-.025em", fontFamily:FONT_DISPLAY }}>Corvus</div>
              <div style={{ fontSize:9, color:"#475569", letterSpacing:".06em", textTransform:"uppercase", marginTop:1 }}>AI Posture Coaching</div>
            </div>
          </a>

          {/* Center nav links */}
          <div style={{ display:"flex", alignItems:"center", gap:1, flex:1, justifyContent:"center" }} className="sa-nav-links">
            {navItems.map(({ label, href }) => (
              <a key={label} href={href} style={{
                position:"relative", display:"flex", alignItems:"center",
                color:"#64748b", textDecoration:"none",
                padding:"8px 14px", borderRadius:8,
                fontSize:13.5, fontWeight:500, transition:"color .2s",
              }}
              onMouseEnter={e=>e.currentTarget.style.color="#f1f5f9"}
              onMouseLeave={e=>e.currentTarget.style.color="#64748b"}>
                {label}
              </a>
            ))}
          </div>

          {/* Right: lang + login + CTA */}
          <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }} className="sa-nav-actions">
            <button onClick={()=>setLang(ar?"en":"ar")} style={{
              background:"rgba(255,255,255,.05)", border:"1px solid rgba(255,255,255,.09)",
              color:"#64748b", padding:"6px 12px", borderRadius:8,
              cursor:"pointer", fontSize:12.5, fontWeight:500, fontFamily:"inherit",
              transition:"all .18s",
            }}
            onMouseEnter={e=>{e.currentTarget.style.color="#f1f5f9";e.currentTarget.style.borderColor="rgba(255,255,255,.18)"}}
            onMouseLeave={e=>{e.currentTarget.style.color="#64748b";e.currentTarget.style.borderColor="rgba(255,255,255,.09)"}}>
              {ar ? "EN" : "عربي"}
            </button>
            <a href="/auth" style={{
              color:"#94a3b8", textDecoration:"none", fontSize:13.5,
              fontWeight:500, padding:"8px 10px", borderRadius:8, transition:"color .18s",
            }}
            onMouseEnter={e=>e.currentTarget.style.color="#f1f5f9"}
            onMouseLeave={e=>e.currentTarget.style.color="#94a3b8"}>
              {ar ? "دخول" : "Log in"}
            </a>
            <a href="/auth?mode=signup" style={btnStyle}
              onMouseEnter={e=>e.currentTarget.style.opacity=".88"}
              onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
              {ar ? "ابدأ مجاناً" : "Start Free Trial"}
            </a>
          </div>

          {/* Burger */}
          <button onClick={()=>setMobileOpen(o=>!o)}
            style={{
              display:"none", width:40, height:40, borderRadius:9, flexShrink:0,
              background:"rgba(255,255,255,.05)", border:"1px solid rgba(255,255,255,.09)",
              cursor:"pointer", alignItems:"center", justifyContent:"center",
            }} className="sa-nav-burger">
            <div style={{ width:18, height:12, position:"relative" }}>
              {[0,1,2].map(i=>(
                <span key={i} style={{
                  position:"absolute", left:0, right:0, height:1.5, borderRadius:2,
                  background:"#e2e8f0", top:i===0?0:i===1?5.5:11,
                  transition:"transform .25s, opacity .2s",
                  transform:mobileOpen?(i===0?"translateY(5.5px) rotate(45deg)":i===1?"scaleX(0)":"translateY(-5.5px) rotate(-45deg)"):"none",
                  opacity:mobileOpen&&i===1?0:1,
                }}/>
              ))}
            </div>
          </button>
        </div>

        {/* Mobile panel */}
        {mobileOpen && (
          <div style={{ borderTop:"1px solid rgba(255,255,255,.07)", background:"rgba(3,8,18,.98)" }}>
            <div style={{ padding:"12px 20px 24px", display:"flex", flexDirection:"column" }}>
              {navItems.map(({label,href})=>(
                <a key={label} href={href} onClick={()=>setMobileOpen(false)} style={{
                  color:"#94a3b8", textDecoration:"none", padding:"13px 4px",
                  fontSize:15, fontWeight:500, borderBottom:"1px solid rgba(255,255,255,.06)",
                  display:"flex", alignItems:"center", justifyContent:"space-between",
                }}>
                  {label}<span style={{fontSize:12,color:"#334155"}}>›</span>
                </a>
              ))}
              <div style={{ display:"flex", gap:10, marginTop:18 }}>
                <a href="/auth" style={{
                  flex:1, textAlign:"center", padding:"11px", borderRadius:10,
                  border:"1px solid rgba(255,255,255,.12)", color:"#94a3b8",
                  textDecoration:"none", fontSize:14, fontWeight:500,
                }}>{ar?"دخول":"Log in"}</a>
                <a href="/auth?mode=signup" style={{...btnStyle, flex:1, height:44, borderRadius:10, fontSize:14}}>
                  {ar?"ابدأ مجاناً":"Start Free Trial"}
                </a>
              </div>
            </div>
          </div>
        )}
      </nav>
      <style>{`
        @media(max-width:860px){
          .sa-nav-links,.sa-nav-actions{display:none!important}
          .sa-nav-burger{display:flex!important}
        }
        @media(max-width:1024px){
          .sa-nav-links a{padding:8px 10px!important;font-size:13px!important}
        }
      `}</style>
    </>
  );
}


function StandaloneFooter({ lang }) {
  const ar = lang === "ar";
  const T = LPV7_TOKENS;
  return (
    <footer style={{
      borderTop:`1px solid ${T.border}`,
      padding:"32px 32px",
      background:T.bg1,
    }}>
      <div style={{
        maxWidth:1180, margin:"0 auto",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        flexWrap:"wrap", gap:16,
      }}>
        <a href="/" style={{ display:"flex", alignItems:"center", gap:8, textDecoration:"none" }}>
          <div style={{
            width:28, height:28, borderRadius:8,
            background:"linear-gradient(135deg,#1a56db,#0891b2)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:14, color:"#fff", fontWeight:900,
          }}>◈</div>
          <span style={{ fontWeight:700, fontSize:14, color:T.text, fontFamily:FONT_DISPLAY }}>Corvus</span>
        </a>
        <div style={{ display:"flex", gap:24, flexWrap:"wrap" }}>
          {(ar
            ? [["الرئيسية","/"],[" المنتج","/#features"],["الأسعار","/#pricing"],["تواصل",`mailto:${SUPPORT_EMAIL}`]]
            : [["Home","/"],[" Product","/#features"],["Pricing","/#pricing"],["Contact",`mailto:${SUPPORT_EMAIL}`]]
          ).map(([label,href])=>(
            <a key={label} href={href} style={{
              color:T.muted, textDecoration:"none", fontSize:13, fontWeight:500,
              transition:"color .18s",
            }}
            onMouseEnter={e=>e.currentTarget.style.color=T.sub}
            onMouseLeave={e=>e.currentTarget.style.color=T.muted}>
              {label}
            </a>
          ))}
        </div>
        <span style={{ fontSize:12, color:T.muted }}>© 2025 Corvus Health Intelligence</span>
      </div>
    </footer>
  );
}


export { StandaloneNav, StandaloneFooter };
