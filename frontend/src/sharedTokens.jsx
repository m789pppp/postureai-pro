// ── sharedTokens.jsx — single source of truth for all LP tokens/helpers ──
import React, { useState, useEffect, useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || "m789pppp@gmail.com";
const CALENDLY_URL  = import.meta.env.VITE_CALENDLY_URL  || `mailto:${import.meta.env.VITE_SUPPORT_EMAIL||"m789pppp@gmail.com"}?subject=Demo%20Request%20—%20Corvus%20PostureAI&body=Hi%2C%20I%27d%20like%20to%20book%20a%20demo.%0A%0ACompany%3A%0ATeam%20size%3A%0ACountry%3A`;
const APP_URL       = typeof window !== "undefined" ? window.location.origin : "";

// ── SPA navigation — dispatches event instead of full-page reload ─
function navTo(path) {
  const event = new CustomEvent('spa:navigate', { detail: { path } });
  if (window.dispatchEvent(event) && window.__spaNavigate) {
    window.__spaNavigate(path);
  } else {
    window.location.href = path;
  }
}

// ── Scroll-triggered reveal (Framer Motion) ────────────────────────
// Same external API as before (children, delay, y) so every call site
// elsewhere in this file keeps working unchanged — now spring-eased.
function Reveal({ children, delay = 0, y = 28, style = {}, className }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      style={style}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, delay: delay / 1000, ease: [0.22, 1, 0.36, 1] }}
    >{children}</motion.div>
  );
}

// Stagger container — wraps a group of children so they cascade in
// one after another on scroll, instead of each needing its own delay.
function Stagger({ children, gap = 0.08, style = {}, className }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      style={style}
      initial={reduce ? false : "hidden"}
      whileInView="show"
      viewport={{ once: true, amount: 0.15 }}
      variants={{ hidden:{}, show:{ transition:{ staggerChildren: gap } } }}
    >{children}</motion.div>
  );
}
function StaggerItem({ children, y = 24, style = {}, className }) {
  return (
    <motion.div
      className={className}
      style={style}
      variants={{ hidden:{ opacity:0, y }, show:{ opacity:1, y:0,
        transition:{ duration:.55, ease:[0.22,1,0.36,1] } } }}
    >{children}</motion.div>
  );
}

function AnimNum({ to, suffix = "", prefix = "", decimals = 0 }) {
  const ref = useRef(null);
  const [vis, setVis] = useState(false);
  const [v, setV] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); obs.disconnect(); } }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  useEffect(() => {
    if (!vis || started.current) return;
    started.current = true;
    const n = parseFloat(String(to)) || 0;
    const dur = 1600, start = performance.now();
    const tick = now => {
      const p = Math.min((now - start) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 4);
      setV(ease * n);
      if (p < 1) requestAnimationFrame(tick);
      else setV(n); // land exactly on target value
    };
    requestAnimationFrame(tick);
  }, [vis, to]);
  // Reset so counter re-animates if 'to' changes after already played
  useEffect(() => { started.current = false; setV(0); }, [to]);
  return <span ref={ref}>{prefix}{v.toFixed(decimals)}{suffix}</span>;
}

// ── Currency detection ──────────────────────────────────────────────
// Real IP-based country lookup (not language!) — a Saudi visitor browsing
// in Arabic still pays USD via Stripe; an Egyptian visitor browsing in
// English still pays EGP via PayMob. Detected once per browser session,
// cached, with a silent fallback to the language heuristic if the lookup
// fails (ad-blockers, offline, slow network) — never breaks the page.
function useCurrency(arFallback) {
  const [country, setCountry] = useState(() => {
    try { return sessionStorage.getItem("corvus_geo_country") || null; } catch { return null; }
  });
  const [override, setOverrideState] = useState(() => {
    try { return sessionStorage.getItem("corvus_currency_override") || null; } catch { return null; }
  });

  useEffect(() => {
    if (country) return; // already cached this session
    let cancelled = false;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    fetch("https://get.geojs.io/v1/ip/country.json", { signal: ctrl.signal })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (cancelled || !data?.country) return;
        setCountry(data.country);
        try { sessionStorage.setItem("corvus_geo_country", data.country); } catch {}
      })
      .catch(() => {}) // silent — falls back to language heuristic below
      .finally(() => clearTimeout(t));
    return () => { cancelled = true; ctrl.abort(); clearTimeout(t); };
  }, [country]);

  const setOverride = (code) => {
    setOverrideState(code);
    try { sessionStorage.setItem("corvus_currency_override", code); } catch {}
  };

  const isEgypt = override ? override === "EGP" : (country ? country === "EG" : arFallback);
  return { isEgypt, setOverride };
}

// ── Design tokens (brand colors — unchanged) ───────────────────────
const LPV7_TOKENS = {
  bg:    "#030b14",
  bg1:   "#040d18",
  bg2:   "#06111e",
  surf:  "#0a1828",
  card:  "#0d1f33",
  border:"rgba(148,163,184,.08)",
  borderM:"rgba(148,163,184,.16)",
  text:  "#e8f0ff",
  sub:   "#94a3b8",
  muted: "#8896ac",
  blue:  "#4f7cf9",
  indigo:"#818cf8",
  sky:   "#22d3ee",
  green: "#10d9a0",
  amber: "#f59e0b",
  red:   "#f87171",
  violet:"#a78bfa",
  gBlue: "linear-gradient(135deg,#4f7cf9,#22d3ee)",
  gHero: "linear-gradient(130deg,#818cf8 0%,#22d3ee 45%,#10d9a0 100%)",
  gCard: "linear-gradient(140deg,rgba(79,124,249,.08),rgba(34,211,238,.04))",
};

// ── Type & layout scale ─────────────────────────────────────────────
// font-display: characterful, bilingual (AR+LAT in one face) → IBM Plex Sans Arabic
// font-mono: precision data — scores, stats, badges → IBM Plex Mono
const FONT_DISPLAY = "'IBM Plex Sans Arabic','Segoe UI',system-ui,sans-serif";
const FONT_MONO    = "'IBM Plex Mono','Segoe UI',monospace";

const TYPE = {
  hero:    { fontSize:"clamp(40px,4.6vw + 14px,72px)", lineHeight:1.06, letterSpacing:"-.03em", fontWeight:800 },
  h2:      { fontSize:"clamp(28px,2.6vw + 14px,48px)", lineHeight:1.12, letterSpacing:"-.025em", fontWeight:800 },
  h3:      { fontSize:"clamp(19px,1vw + 14px,24px)",   lineHeight:1.25, letterSpacing:"-.015em", fontWeight:700 },
  body:    { fontSize:"clamp(16px,.3vw + 15px,18px)",  lineHeight:1.7 },
  bodySm:  { fontSize:15, lineHeight:1.65 },
  eyebrow: { fontSize:13, fontWeight:600, letterSpacing:".08em", textTransform:"uppercase" },
};

// ── Shared styles ─────────────────────────────────────────────────
const btn = (variant = "primary", size = "md") => {
  const sizes = { sm: { h:40, pad:"0 18px", fs:14 }, md: { h:46, pad:"0 24px", fs:15 }, lg: { h:52, pad:"0 32px", fs:16.5 } };
  const s = sizes[size];
  const base = {
    display: "inline-flex", alignItems: "center", justifyContent:"center", gap: 8,
    height: s.h, padding: s.pad, borderRadius: 12, fontWeight: 600,
    fontSize: s.fs, cursor: "pointer",
    transition: "transform .25s cubic-bezier(.16,1,.3,1), box-shadow .25s, background .25s, border-color .25s",
    border: "none", textDecoration: "none", letterSpacing: "-.01em", whiteSpace:"nowrap",
  };
  if (variant === "primary") return { ...base,
    background: LPV7_TOKENS.gBlue, color: "#fff",
    boxShadow: "0 4px 24px rgba(79,124,249,.35)",
  };
  if (variant === "ghost") return { ...base,
    background: "rgba(255,255,255,.05)", color: LPV7_TOKENS.text,
    border: `1px solid ${LPV7_TOKENS.border}`,
  };
  if (variant === "outline") return { ...base,
    background: "transparent", color: LPV7_TOKENS.indigo,
    border: `1px solid rgba(129,140,248,.4)`,
  };
  return base;
};

const card = (glow = false) => ({
  background: LPV7_TOKENS.card,
  border: `1px solid ${glow ? "rgba(79,124,249,.25)" : LPV7_TOKENS.border}`,
  borderRadius: 20,
  padding: 32,
  backdropFilter: "blur(12px)",
  boxShadow: glow ? "0 0 40px rgba(79,124,249,.08),0 8px 32px rgba(0,0,0,.3)"
                  : "0 4px 24px rgba(0,0,0,.25)",
});

// Eyebrow pill — used above most section headings
function Eyebrow({ children, color = LPV7_TOKENS.indigo, bg = "rgba(129,140,248,.1)", border = "rgba(129,140,248,.2)" }) {
  return (
    <span style={{
      background:bg, border:`1px solid ${border}`, borderRadius:100,
      padding:"6px 16px", display:"inline-block", marginBottom:18,
      color, ...TYPE.eyebrow,
    }}>{children}</span>
  );
}

// Section heading block — eyebrow + title + optional sub, centered
function SectionHead({ eyebrow, eyebrowColor, eyebrowBg, eyebrowBorder, title, sub, subMax = 560, align = "center" }) {
  return (
    <Reveal>
      <div style={{ textAlign:align, marginBottom:"clamp(32px,4vw,56px)",
        marginInline: align==="center" ? "auto" : 0 }}>
        {eyebrow && <Eyebrow color={eyebrowColor} bg={eyebrowBg} border={eyebrowBorder}>{eyebrow}</Eyebrow>}
        <h2 style={{ ...TYPE.h2, color:LPV7_TOKENS.text, margin:"0 0 18px", fontFamily:FONT_DISPLAY }}>{title}</h2>
        {sub && <p style={{ ...TYPE.body, color:LPV7_TOKENS.sub, maxWidth:subMax, margin: align==="center" ? "0 auto" : 0 }}>{sub}</p>}
      </div>
    </Reveal>
  );
}

// ── Global stylesheet ─────────────────────────────────────────────
function GlobalStyle() {
  return (
    <style>{`
      *{box-sizing:border-box}
      html{scroll-behavior:smooth}
      ::selection{background:rgba(79,124,249,.32);color:#fff}

      .lp-wrap{max-width:1200px;margin:0 auto;width:100%;padding:0 32px}
      .lp-section{padding:60px 32px}

      /* cards */
      .lp-lift{transition:transform .28s cubic-bezier(.16,1,.3,1),box-shadow .28s,border-color .28s}
      .lp-lift:hover{transform:translateY(-5px);box-shadow:0 20px 48px rgba(0,0,0,.38),0 0 0 1px rgba(79,124,249,.1)}

      /* buttons — shimmer sweep on hover */
      .lp-btn{transition:transform .22s cubic-bezier(.16,1,.3,1),box-shadow .22s;position:relative;overflow:hidden}
      .lp-btn::after{content:"";position:absolute;inset:0;background:linear-gradient(105deg,transparent 38%,rgba(255,255,255,.16) 50%,transparent 62%);transform:translateX(-120%);transition:transform .55s ease;pointer-events:none}
      .lp-btn:hover::after{transform:translateX(120%)}
      .lp-btn:hover{transform:translateY(-2px)}
      .lp-btn:active{transform:translateY(0) scale(.97)}
      .lp-btn-primary{background:linear-gradient(135deg,#1a56db,#0891b2)!important;box-shadow:0 4px 20px rgba(26,86,219,.38)!important}
      .lp-btn-primary:hover{box-shadow:0 10px 36px rgba(26,86,219,.52)!important}
      .lp-btn-ghost:hover{background:rgba(255,255,255,.08)!important;border-color:rgba(148,163,184,.2)!important}

      /* animations */
      @keyframes lp-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.42;transform:scale(1.65)}}
      @keyframes lp-drift-a{0%,100%{transform:translate(-50%,-50%)}50%{transform:translate(-46%,-54%)}}
      @keyframes lp-drift-b{0%,100%{transform:translate(0,0)}50%{transform:translate(3%,-4%)}}
      .lp-drift-a{animation:lp-drift-a 20s ease-in-out infinite}
      .lp-drift-b{animation:lp-drift-b 26s ease-in-out infinite}

      :focus-visible{outline:2px solid #4f7cf9;outline-offset:3px;border-radius:4px}

      /* hero */
      .lp-hero-grid{display:grid;grid-template-columns:1fr 1.05fr;gap:clamp(32px,4vw,64px);align-items:center}
      @media(max-width:900px){.lp-hero-grid{grid-template-columns:1fr}.lp-hero-right{display:none!important}}

      /* nav */
      @media(max-width:860px){.lp-nav-links,.lp-nav-actions{display:none!important}.lp-nav-burger{display:flex!important}}

      /* grids */
      .lp-stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:20px}
      .lp-features-wrap{display:grid;grid-template-columns:1fr 1fr;gap:36px;align-items:start}
      .lp-how-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:28px}
      .lp-cases-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
      .lp-pricing-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
      .lp-testi-grid,.lp-testi-inner{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
      .lp-footer-grid{display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr 1fr;gap:32px 24px}
      .lp-sp-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
      .lp-sp-row2{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px}

      /* tablet */
      @media(max-width:1024px){
        .lp-wrap{padding:0 20px}.lp-section{padding:56px 20px}
        .lp-footer-grid{grid-template-columns:1.2fr 1fr 1fr;gap:28px 20px}
        .lp-stats-grid{grid-template-columns:repeat(2,1fr)}
        .lp-features-wrap{gap:24px}
        .lp-pricing-grid{grid-template-columns:1fr!important}
        .lp-how-grid{grid-template-columns:repeat(3,1fr);gap:16px}
        .lp-cases-grid{grid-template-columns:1fr 1fr!important}
        .lp-testi-grid,.lp-testi-inner{grid-template-columns:1fr 1fr!important}
        .lp-popular-card{transform:none!important}
        .lp-sp-row2{flex-direction:column;align-items:flex-start;gap:12px}
      }

      /* mobile */
      @media(max-width:720px){
        .lp-how-grid{grid-template-columns:1fr;gap:20px}
        .lp-testi-grid,.lp-testi-inner{grid-template-columns:1fr}
        .lp-timeline-line{display:none!important}
        .lp-timeline-node{margin-top:0!important;margin-bottom:16px!important}
      }
      @media(max-width:640px){
        .lp-wrap{padding:0 16px}.lp-section{padding:52px 16px}
        .lp-stats-grid{grid-template-columns:repeat(2,1fr);gap:10px}
        .lp-cases-grid{grid-template-columns:1fr}
        .lp-features-wrap{grid-template-columns:1fr}
        .lp-pricing-grid{grid-template-columns:1fr;max-width:400px;margin:0 auto}
        .lp-footer-grid{grid-template-columns:1fr 1fr}
        .lp-sp-stats{grid-template-columns:repeat(2,1fr)}
      }

      @media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}.lp-btn::after{display:none}}
      @media(max-width:640px){.lp-popular-card{transform:none!important}}
      @media(max-width:900px){.lp-hero-mobile-stats{display:flex!important}}
    `}</style>
  );
}


// ── Scroll progress bar ───────────────────────────────────────────
function ScrollProgress() {
  const [w, setW] = useState(0);
  useEffect(() => {
    const h = () => {
      const el = document.documentElement;
      const pct = el.scrollTop / (el.scrollHeight - el.clientHeight);
      setW(Math.round(pct * 100));
    };
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);
  return (
    <div style={{
      position:"fixed", top:0, left:0, right:0, height:2.5, zIndex:2000,
      background:"rgba(255,255,255,.04)",
    }}>
      <div style={{
        height:"100%", width:`${w}%`,
        background:"linear-gradient(90deg,#1a56db,#22d3ee,#10d9a0)",
        transition:"width .1s linear",
        boxShadow:"0 0 8px rgba(34,211,238,.5)",
      }}/>
    </div>
  );
}

// ── Navigation ────────────────────────────────────────────────────

export {
  SUPPORT_EMAIL, CALENDLY_URL, LPV7_TOKENS, FONT_DISPLAY, FONT_MONO,
  TYPE, btn, card, Eyebrow, SectionHead,
  Reveal, Stagger, StaggerItem, AnimNum,
};
