/**
 * Corvus — Landing Page v8
 * CRO-optimized: Hero → Social Proof → Stats → Features →
 *   How It Works → Case Studies → Pricing → Testimonials → FAQ → CTA → Footer
 * Design: Premium dark SaaS, Stripe/Linear/Vercel quality
 * RTL-ready · Mobile-first · Accessibility: WCAG 2.1 AA
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";

const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || "support@corvus.io";
const CALENDLY_URL  = import.meta.env.VITE_CALENDLY_URL  || `mailto:${import.meta.env.VITE_SUPPORT_EMAIL||"support@corvus.io"}?subject=Demo%20Request%20—%20Corvus%20PostureAI&body=Hi%2C%20I%27d%20like%20to%20book%20a%20demo.%0A%0ACompany%3A%0ATeam%20size%3A%0ACountry%3A`;
const APP_URL       = typeof window !== "undefined" ? window.location.origin : "";

// ── SPA navigation — dispatches event instead of full-page reload ─
function navTo(path) {
  if (window.__spaNavigate) {
    window.__spaNavigate(path);
    return;
  }
  const event = new CustomEvent('spa:navigate', { detail: { path } });
  window.dispatchEvent(event);
  // Fallback: full navigation if SPA handler not registered
  setTimeout(() => {
    if (!window.__spaNavigateHandled) window.location.href = path;
  }, 100);
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
      viewport={{ once: true, amount: 0.1 }}
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
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); obs.disconnect(); } }, { threshold: 0.1, rootMargin:"0px 0px -20px 0px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  useEffect(() => {
    if (!vis || started.current) return;
    started.current = true;
    const n = parseFloat(String(to)) || 0;
    const dur = 1600, start = performance.now();
    let raf;
    const tick = now => {
      const p = Math.min((now - start) / dur, 1);
      setV((1 - Math.pow(1 - p, 4)) * n);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setV(n);
    };
    raf = requestAnimationFrame(tick);
    return () => { if (raf) cancelAnimationFrame(raf); }; // cleanup on unmount
  }, [vis, to]);
  // Reset only when target value actually changes (prevents flicker on re-render)
  const prevTo = useRef(to);
  useEffect(() => {
    if (prevTo.current !== to) {
      prevTo.current = to;
      started.current = false;
      setVis(false);
      setTimeout(() => setVis(true), 50);
    }
  }, [to]);
  return <span ref={ref}>{prefix}{v.toFixed(decimals)}{suffix}</span>;
}

// ── Currency detection ──────────────────────────────────────────────
// Real IP-based country lookup (not language!) — a Saudi visitor browsing
// in Arabic still pays USD via Stripe; an Egyptian visitor browsing in
// English still pays EGP via Kashier. Detected once per browser session,
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
  bg:    "#0d1a2e",
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

// Pre-computed card styles — avoids object allocation on every render
const CARD_BASE = { borderRadius: 20, padding: 32 };
const CARD_GLOW  = { ...CARD_BASE, background:LPV7_TOKENS.card, border:"1px solid rgba(79,124,249,.25)", boxShadow:"0 0 40px rgba(79,124,249,.08),0 8px 32px rgba(0,0,0,.3)" };
const CARD_PLAIN = { ...CARD_BASE, background:LPV7_TOKENS.card, border:"1px solid "+LPV7_TOKENS.border, boxShadow:"0 4px 24px rgba(0,0,0,.25)" };
const card = (glow = false) => glow ? CARD_GLOW : CARD_PLAIN;

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
      .lp-lift{transition:transform .28s cubic-bezier(.16,1,.3,1),box-shadow .28s,border-color .28s;will-change:transform}
      .lp-section{contain:layout style;content-visibility:auto;contain-intrinsic-size:0 500px}
      .lp-lift:hover{transform:translateY(-5px);box-shadow:0 20px 48px rgba(0,0,0,.38),0 0 0 1px rgba(79,124,249,.1)}

      /* buttons — shimmer sweep on hover */
      .lp-btn{transition:transform .22s cubic-bezier(.16,1,.3,1),box-shadow .22s;position:relative;overflow:hidden;will-change:transform}
      /* CSS-only reveal — replaces some Framer Motion IntersectionObservers */
      @media(prefers-reduced-motion:no-preference){
        .lp-reveal{opacity:0;transform:translateY(20px);transition:opacity .6s ease,transform .6s ease}
        .lp-reveal.lp-visible{opacity:1;transform:none}
      }
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
      @keyframes lp-float-10{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
      @keyframes lp-float-8{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
      @keyframes lp-float-6{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
      .lp-drift-a{animation:lp-drift-a 20s ease-in-out infinite;will-change:transform}
      .lp-drift-b{animation:lp-drift-b 26s ease-in-out infinite;will-change:transform}

      :focus-visible{outline:2px solid #4f7cf9;outline-offset:3px;border-radius:4px}

      /* hero */
      .lp-hero-grid{display:grid;grid-template-columns:1fr 1.05fr;gap:clamp(32px,4vw,64px);align-items:center;min-width:0}
      .lp-hero-grid>*{min-width:0}
      @media(max-width:900px){.lp-hero-grid{grid-template-columns:1fr}.lp-hero-right{display:none!important}}

      /* nav */
      @media(max-width:860px){.lp-nav-links,.lp-nav-actions{display:none!important}.lp-nav-burger{display:flex!important}}

      /* grids */
      /* min-width:0 on every grid + its direct children: by default a 1fr
         track (or flex item) refuses to shrink below its content's
         min-content size, which is how one long unbreakable string (a
         button label, a badge, a stat) can silently force the whole
         column — and the page — wider than the viewport on mobile. This
         is the general fix for the bug class that caused the hero
         overflow above, applied to every grid on the page, not just
         the hero, since it can just as easily resurface in e.g. the
         testimonial cards' outcome-badge text. */
      .lp-stats-grid,.lp-features-wrap,.lp-how-grid,.lp-cases-grid,
      .lp-pricing-grid,.lp-testi-grid,.lp-testi-inner,.lp-footer-grid,
      .lp-sp-stats{min-width:0}
      .lp-stats-grid>*,.lp-features-wrap>*,.lp-how-grid>*,.lp-cases-grid>*,
      .lp-pricing-grid>*,.lp-testi-grid>*,.lp-testi-inner>*,.lp-footer-grid>*,
      .lp-sp-stats>*{min-width:0}
      .lp-stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:20px}
      .lp-features-wrap{display:grid;grid-template-columns:1fr 1fr;gap:36px;align-items:start}
      .lp-how-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:28px}
      .lp-cases-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
      .lp-pricing-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px}
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
        /* CTA button text (e.g. "Free 7-Day Trial — For My Team") can't fit
           on one line at this width; white-space:nowrap forced a ~376px
           min-content size that the 1fr hero grid track had to honor,
           pushing the whole hero column past the viewport edge. Let long
           CTAs wrap to two lines instead of forcing horizontal overflow. */
        .lp-btn{white-space:normal!important;height:auto!important;min-height:46px;line-height:1.3;text-align:center}
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
function Nav({ lang, setLang, onCTA }) {
  const [scrolled,     setScrolled]     = useState(false);
  const [mobileOpen,   setMobileOpen]   = useState(false);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);
  const [activeSection,setActiveSection]= useState("");

  useEffect(() => {
    let ticking = false;
    const h = () => {
      if (!ticking) {
        requestAnimationFrame(() => { setScrolled(window.scrollY > 48); ticking = false; });
        ticking = true;
      }
    };
    window.addEventListener("scroll", h, { passive:true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  useEffect(() => {
    const ids = ["features","casestudies","pricing","how"];
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if(e.isIntersecting) setActiveSection(e.target.id); }),
      { rootMargin:"-20% 0px -50% 0px", threshold: 0.1 }
    );
    ids.forEach(id => { const el=document.getElementById(id); if(el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const h = () => { if(window.innerWidth>860) setMobileOpen(false); };
    let debounce;
    const dh = () => { clearTimeout(debounce); debounce = setTimeout(h, 150); };
    window.addEventListener("resize", dh);
    return () => { window.removeEventListener("resize", dh); clearTimeout(debounce); };
  }, []);

  const ar = lang === "ar";

  const navItems = ar ? [
    { label:"المنتج",    href:"/product",       id:"features",     anchor:"#features" },
    { label:"الحلول",   href:"/solutions",     id:"casestudies",  anchor:"#casestudies" },
    { label:"الأسعار",  href:"/pricing",       id:"pricing",      anchor:"#pricing" },
    { label:"كيف يعمل", href:"/how-it-works",  id:"how",          anchor:"#how" },
    { label:"الأسئلة",  href:"/faq",           id:"faq",          anchor:"#faq" },
  ] : [
    { label:"Product",     href:"/product",      id:"features",    anchor:"#features" },
    { label:"Solutions",   href:"/solutions",    id:"casestudies", anchor:"#casestudies" },
    { label:"Pricing",     href:"/pricing",      id:"pricing",     anchor:"#pricing" },
    { label:"How it works",href:"/how-it-works", id:"how",         anchor:"#how" },
    { label:"FAQ",         href:"/faq",          id:"faq",         anchor:"#faq" },
  ];

  return (
    <>
      <nav style={{
        position:"fixed", top:0, left:0, right:0, zIndex:1000,
        background: scrolled || mobileOpen
          ? "rgba(3,8,18,.95)"
          : "rgba(3,8,18,.45)",
        backdropFilter:"blur(12px)",
        WebkitBackdropFilter:"blur(12px)",
        borderBottom:`1px solid ${scrolled ? "rgba(255,255,255,.08)" : "transparent"}`,
        boxShadow: scrolled ? "0 2px 40px rgba(0,0,0,.4)" : "none",
        transition:"background .3s, border-color .3s, box-shadow .3s",
      }}>
        <div className="lp-wrap" style={{ height:68, display:"flex", alignItems:"center", justifyContent:"space-between", gap:16 }}>

          {/* ── Logo ── */}
          <a href="#" onClick={e=>{e.preventDefault(); window.scrollTo({top:0,behavior:"smooth"});}}
            style={{ display:"flex", alignItems:"center", gap:10, textDecoration:"none", flexShrink:0 }}>
            <div style={{
              width:36, height:36, borderRadius:10, flexShrink:0,
              background:"linear-gradient(135deg,#1a56db,#0891b2)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:18, color:"#fff", fontWeight:900,
              boxShadow:"0 4px 16px rgba(26,86,219,.45)",
            }}>◈</div>
            <div style={{ lineHeight:1.15 }}>
              <div style={{ fontWeight:800, fontSize:15, color:"#f1f5f9", letterSpacing:"-.025em", fontFamily:FONT_DISPLAY }}>Corvus</div>
              <div style={{ fontSize:9, color:"#8896ac", letterSpacing:".06em", textTransform:"uppercase", marginTop:1 }}>AI Posture Coaching</div>
            </div>
          </a>

          {/* ── Center links ── */}
          <div className="lp-nav-links" style={{ display:"flex", alignItems:"center", gap:1, flex:1, justifyContent:"center" }}>
            {navItems.map(({ label, href, id, anchor }) => {
              const active = activeSection === id;
              return (
                <a key={label} href={href}
                  style={{
                    position:"relative", display:"flex", alignItems:"center",
                    color: active ? "#f1f5f9" : "#8896ac",
                    textDecoration:"none", padding:"8px 14px", borderRadius:8,
                    fontSize:13.5, fontWeight: active ? 600 : 500,
                    transition:"color .2s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.color="#f1f5f9"}
                  onMouseLeave={e => e.currentTarget.style.color = active ? "#f1f5f9" : "#8896ac"}>
                  {label}
                  {active && (
                    <span style={{
                      position:"absolute", bottom:2, left:"50%", transform:"translateX(-50%)",
                      width:20, height:2, borderRadius:2,
                      background:"linear-gradient(90deg,#4f7cf9,#22d3ee)",
                    }}/>
                  )}
                </a>
              );
            })}
          </div>

          {/* ── Right actions ── */}
          <div className="lp-nav-actions" style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
            {/* Language toggle */}
            <button onClick={() => setLang(ar ? "en" : "ar")} style={{
              background:"rgba(255,255,255,.05)", border:"1px solid rgba(255,255,255,.09)",
              color:"#8896ac", padding:"6px 12px", borderRadius:8,
              cursor:"pointer", fontSize:12.5, fontWeight:500, fontFamily:"inherit",
              transition:"all .18s", display:"flex", alignItems:"center", gap:5,
            }}
            onMouseEnter={e=>{e.currentTarget.style.color="#f1f5f9";e.currentTarget.style.borderColor="rgba(255,255,255,.18)"}}
            onMouseLeave={e=>{e.currentTarget.style.color="#8896ac";e.currentTarget.style.borderColor="rgba(255,255,255,.09)"}}>
              🌐 {ar ? "EN" : "عربي"}
            </button>
            {/* Log in */}
            <a href="#" onClick={e=>{e.preventDefault();navTo("/auth");}} style={{
              color:"#94a3b8", textDecoration:"none", fontSize:13.5,
              fontWeight:500, padding:"8px 10px", borderRadius:8,
              transition:"color .18s",
            }}
            onMouseEnter={e=>e.currentTarget.style.color="#f1f5f9"}
            onMouseLeave={e=>e.currentTarget.style.color="#94a3b8"}>
              {ar ? "دخول" : "Log in"}
            </a>
            {/* CTA */}
            <a href="#" className="lp-btn lp-btn-primary"
              onClick={e=>{e.preventDefault();onCTA(e);navTo("/auth?mode=signup");}}
              style={{
                ...btn("primary","sm"), borderRadius:10,
                background:"linear-gradient(135deg,#1a56db,#0891b2)",
                fontSize:13, padding:"0 18px", height:38,
              }}>
              {ar ? "ابدأ مجاناً" : "Start Free Trial"}
            </a>
          </div>

          {/* ── Burger ── */}
          <button aria-label="Menu" aria-expanded={mobileOpen}
            className="lp-nav-burger"
            onClick={() => setMobileOpen(o=>!o)}
            style={{
              display:"none", width:40, height:40, borderRadius:9, flexShrink:0,
              background:"rgba(255,255,255,.05)", border:"1px solid rgba(255,255,255,.09)",
              cursor:"pointer", alignItems:"center", justifyContent:"center",
            }}>
            <div style={{ width:18, height:12, position:"relative" }}>
              {[0,1,2].map(i => (
                <span key={i} style={{
                  position:"absolute", left:0, right:0, height:1.5, borderRadius:2,
                  background:"#e2e8f0", top: i===0?0:i===1?5.5:11,
                  transition:"transform .25s, opacity .2s",
                  transform: mobileOpen
                    ? (i===0?"translateY(5.5px) rotate(45deg)":i===1?"scaleX(0)":"translateY(-5.5px) rotate(-45deg)")
                    : "none",
                  opacity: mobileOpen&&i===1 ? 0 : 1,
                }}/>
              ))}
            </div>
          </button>
        </div>

        {/* ── Mobile panel ── */}
        {mobileOpen && (
          <div style={{
            borderTop:"1px solid rgba(255,255,255,.07)",
            background:"rgba(3,8,18,.98)",
          }}>
            <div style={{ padding:"12px 20px 24px", display:"flex", flexDirection:"column" }}>
              {navItems.map(({ label, href }) => (
                <a key={label} href={href} onClick={()=>setMobileOpen(false)} style={{
                  color:"#94a3b8", textDecoration:"none", padding:"13px 4px",
                  fontSize:15, fontWeight:500, borderBottom:"1px solid rgba(255,255,255,.06)",
                  display:"flex", alignItems:"center", justifyContent:"space-between",
                  transition:"color .18s",
                }}
                onMouseEnter={e=>e.currentTarget.style.color="#f1f5f9"}
                onMouseLeave={e=>e.currentTarget.style.color="#94a3b8"}>
                  {label}
                  <span style={{ fontSize:12, color:"#8896ac" }}>›</span>
                </a>
              ))}
              <div style={{ display:"flex", gap:10, marginTop:18 }}>
                <a href="#" onClick={e=>{e.preventDefault();setMobileOpen(false);navTo("/auth");}}
                  style={{
                    flex:1, textAlign:"center", padding:"11px", borderRadius:10,
                    border:"1px solid rgba(255,255,255,.12)", color:"#94a3b8",
                    textDecoration:"none", fontSize:14, fontWeight:500,
                  }}>
                  {ar ? "دخول" : "Log in"}
                </a>
                <a href="#" className="lp-btn lp-btn-primary"
                  onClick={e=>{e.preventDefault();setMobileOpen(false);onCTA(e);navTo("/auth?mode=signup");}}
                  style={{ ...btn("primary","md"), flex:1, borderRadius:10, fontSize:14 }}>
                  {ar ? "ابدأ مجاناً" : "Start Free Trial"}
                </a>
              </div>
              <button onClick={() => setLang(ar ? "en" : "ar")} style={{
                marginTop:12, background:"rgba(255,255,255,.05)", border:"1px solid rgba(255,255,255,.1)",
                color:"#8896ac", fontSize:12.5, cursor:"pointer", textAlign:"center",
                fontFamily:"inherit", borderRadius:8, padding:"8px 16px",
                display:"flex", alignItems:"center", justifyContent:"center", gap:6, width:"100%",
              }}>🌐 {ar ? "🇬🇧 EN — Switch to English" : "🇪🇬 عربي — التبديل للعربية"}</button>
            </div>
          </div>
        )}
      </nav>
      <style>{`@media(max-width:860px){.lp-nav-links,.lp-nav-actions{display:none!important}.lp-nav-burger{display:flex!important}}`}</style>
    </>
  );
}

// ── Hero ──────────────────────────────────────────────────────────
function Hero({ lang, onCTA, mode, setMode }) {
  const ar = lang === "ar";
  const reduce = useReducedMotion();
  const isCompany = mode === "company";
  const [demoScore, setDemoScore] = useState(89);
  // #11: camera demo consent gate — user must click "Start Demo" first
  const [demoStarted, setDemoStarted] = useState(false);
  useEffect(() => {
    // Smooth demo score oscillation — looks realistic without being jarring
    const sequence = [89,91,88,93,90,87,92,89,94,91,88,90];
    let idx = 0;
    const iv = setInterval(() => {
      idx = (idx + 1) % sequence.length;
      setDemoScore(sequence[idx]);
    }, 2200);
    return () => clearInterval(iv);
  }, []);

  const scoreColor = demoScore >= 80 ? LPV7_TOKENS.green : demoScore >= 60 ? LPV7_TOKENS.amber : LPV7_TOKENS.red;
  // CSS-driven float: no JS thread involvement, GPU-composited
  const float = (delay = 0, dist = 10) => reduce ? {} : {
    style: { animation: `lp-float-${dist} ${5 + delay}s ease-in-out ${delay}s infinite` },
  };

  return (
    <section style={{
      minHeight: "100vh", display:"flex", alignItems:"center",
      padding:"clamp(68px,8vw,110px) 24px clamp(48px,5vw,72px)", position:"relative", overflow:"hidden",
    }}>
      {/* Ambient background */}
      <div style={{ position:"absolute", inset:0, pointerEvents:"none" }}>
        <div className="lp-drift-a" style={{
          position:"absolute", top:"8%", left:"58%",
          width:680, height:680,
          background:"radial-gradient(circle,rgba(79,124,249,.16) 0%,transparent 70%)",
          borderRadius:"50%", transform:"translate(-50%,-50%)",
        }}/>
        <div className="lp-drift-b" style={{
          position:"absolute", bottom:"12%", left:"14%",
          width:460, height:460,
          background:"radial-gradient(circle,rgba(16,217,160,.1) 0%,transparent 70%)",
          borderRadius:"50%",
        }}/>
        <div style={{
          position:"absolute", top:"42%", right:"6%",
          width:320, height:320,
          background:"radial-gradient(circle,rgba(34,211,238,.08) 0%,transparent 70%)",
          borderRadius:"50%",
        }}/>
        {/* Grid */}
        <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", opacity:.04 }}
          xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M40 0L0 0 0 40" fill="none" stroke={LPV7_TOKENS.text} strokeWidth=".5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)"/>
        </svg>
      </div>

      <div className="lp-wrap" style={{ width:"100%", position:"relative" }}>
        <div className="lp-hero-grid" style={{ direction: ar ? "rtl" : "ltr" }}>
        {/* Left */}
        <div>
          <Reveal>
            {/* Individual / Company toggle — drives the rest of the page */}
            <div style={{
              display:"inline-flex", alignItems:"center", gap:3,
              background:"rgba(255,255,255,.05)", border:`1px solid ${LPV7_TOKENS.border}`,
              borderRadius:100, padding:4, marginBottom:24,
            }}>
              {[
                { id:"individual", en:"👤 Individual", ar:"👤 فردي" },
                { id:"company",    en:"🏢 Company & Teams", ar:"🏢 شركات وفرق" },
              ].map(m => (
                <button key={m.id} onClick={()=>setMode(m.id)} style={{
                  padding:"8px 18px", borderRadius:99, border:"none",
                  fontSize:13.5, fontWeight:600, cursor:"pointer",
                  background: mode===m.id ? LPV7_TOKENS.gHero : "transparent",
                  color: mode===m.id ? "#06121f" : LPV7_TOKENS.sub,
                  boxShadow: mode===m.id ? "0 2px 12px rgba(34,211,238,.25)" : "none",
                  transition:"background .25s, color .25s, box-shadow .25s",
                }}>
                  {ar ? m.ar : m.en}
                </button>
              ))}
            </div>
          </Reveal>

          <Reveal delay={40}>
            <div style={{
              display:"inline-flex", alignItems:"center", gap:9,
              background:"rgba(79,124,249,.1)", border:"1px solid rgba(79,124,249,.25)",
              borderRadius:100, padding:"7px 16px", marginBottom:28,
              fontSize:13.5, color:LPV7_TOKENS.indigo, fontWeight:500,
            }}>
              <span style={{
                width:6, height:6, borderRadius:"50%", background:LPV7_TOKENS.green,
                boxShadow:`0 0 8px ${LPV7_TOKENS.green}`,
                animation:"lp-pulse 1.5s ease-in-out infinite", willChange:"opacity, transform",
              }}/>
              {ar ? "متاح الآن · ابدأ مجاناً" : "Now Available · Free to Start"}
            </div>
          </Reveal>

          <Reveal delay={80}>
            <h1 style={{
              ...TYPE.hero, color:LPV7_TOKENS.text, margin:"0 0 24px", fontFamily:FONT_DISPLAY,
            }}>
              {isCompany ? (
                ar
                  ? <><span style={{ background:LPV7_TOKENS.gHero, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>قلّل إجازات الأمراض</span>{" "}47% بدون أجهزة إضافية</>
                  : <>Cut Sick Leave <span style={{ background:LPV7_TOKENS.gHero, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>47%</span><br/>with AI Posture Coaching</>
              ) : (
                ar
                  ? <>اخلص من آلام الظهر والرقبة<br/><span style={{ background:LPV7_TOKENS.gHero, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>في أسبوعين فقط</span></>
                  : <>Stop Back & Neck Pain<br/><span style={{ background:LPV7_TOKENS.gHero, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>in 2 Weeks</span></>
              )}
            </h1>
          </Reveal>

          <Reveal delay={140}>
            <p style={{ ...TYPE.body, color:LPV7_TOKENS.sub, maxWidth:520, margin:"0 0 40px" }}>
              {isCompany
                ? (ar
                    ? "قلّل إجازات الأمراض المهنية بنسبة 47% وارفع الإنتاجية. منصة تحليل الوضعية بالذكاء الاصطناعي للمؤسسات."
                    : "Reduce occupational sick days by 47% and boost team productivity. Real-time AI posture coaching built for MENA enterprise teams.")
                : (ar
                    ? "كاميرا اللابتوب بتاعك كافية. الذكاء الاصطناعي بيتابع وضعيتك في الخلفية ويبعتلك تنبيه لو انحنيت — من غير أي أجهزة أو اشتراك مكلف."
                    : "Your laptop camera is all you need. AI monitors your posture in the background and alerts you when you slouch — no hardware, no expensive subscriptions.")
              }
            </p>
          </Reveal>

          <Reveal delay={200}>
            <div style={{ display:"flex", gap:14, flexWrap:"wrap", marginBottom:16 }}>
              {isCompany ? (
                <a href="#" className="lp-btn lp-btn-primary" onClick={(e)=>{e.preventDefault();onCTA(e);navTo("/auth?mode=signup")}} style={btn("primary","lg")}>
                  {ar ? "🚀 تجربة مجانية 7 أيام — لفريقي" : "🚀 Free 7-Day Trial — For My Team"}
                </a>
              ) : (
                <a href="#" className="lp-btn lp-btn-primary" onClick={(e)=>{e.preventDefault();onCTA(e);navTo("/auth?mode=signup&plan=personal_pro")}} style={btn("primary","lg")}>
                  {ar ? "🚀 تجربة مجانية 7 أيام" : "🚀 Start 7-Day Free Trial"}
                </a>
              )}
              <a href="#pricing" className="lp-btn lp-btn-ghost" onClick={(e)=>{onCTA(e)}} style={btn("ghost","lg")}>
                {ar ? "عرض الأسعار" : "View Pricing"}
              </a>
            </div>
            {/* Trust micro-badges — address common objections immediately under CTA */}
            <div style={{ display:"flex", gap:"6px 18px", flexWrap:"wrap", alignItems:"center" }}>
              {(ar
                ? ["✓ مجاني 7 أيام","✓ بدون بطاقة بنكية","✓ بدون تحميل برنامج","✓ أي كاميرا لابتوب"]
                : ["✓ 7-day free trial","✓ No credit card","✓ No software to install","✓ Any laptop camera"]
              ).map(tr=>(
                <span key={tr} style={{ fontSize:12, color:LPV7_TOKENS.muted, fontWeight:500 }}>{tr}</span>
              ))}
            </div>
          </Reveal>

          {/* Mobile-only mini stats */}
          <Reveal delay={260}>
            <div className="lp-hero-mobile-stats" style={{
              display:"none", gap:0,
              background:"rgba(255,255,255,.03)", border:`1px solid ${LPV7_TOKENS.border}`,
              borderRadius:16, overflow:"hidden", marginTop:20,
            }}>
              {(ar
                ? [["50+","مستخدم بيتا","👥"],["4.9★","تقييم","⭐"],["أسبوعان","للتحسن","⏱"],["0","فيديو محفوظ","🛡"]]
                : [["50+","beta users","👥"],["4.9★","rating","⭐"],["2 wks","to improve","⏱"],["0","video stored","🛡"]]
              ).map(([val,label,icon],i)=>(
                <div key={label} style={{
                  flex:1, textAlign:"center", padding:"14px 8px",
                  borderRight: i<3 ? `1px solid ${LPV7_TOKENS.border}` : "none",
                }}>
                  <div style={{ fontSize:12, marginBottom:3 }}>{icon}</div>
                  <div style={{ fontSize:16, fontWeight:800, color:LPV7_TOKENS.text, fontFamily:FONT_MONO, lineHeight:1 }}>{val}</div>
                  <div style={{ fontSize:9.5, color:LPV7_TOKENS.muted, marginTop:3 }}>{label}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>

        {/* Right — Camera demo */}
        <Reveal delay={100} className="lp-hero-right">
          <div style={{ position:"relative", paddingTop:20, paddingBottom:20, minWidth:320 }}>
            {/* Main camera card */}
            <div style={{ ...card(true), padding:0, overflow:"hidden" }}>
              {/* Browser chrome */}
              <div style={{ display:"flex", alignItems:"center", gap:8,
                padding:"12px 16px", borderBottom:`1px solid ${LPV7_TOKENS.border}`,
                background:"rgba(255,255,255,.02)" }}>
                <span style={{ width:9, height:9, borderRadius:"50%", background:"#f87171" }}/>
                <span style={{ width:9, height:9, borderRadius:"50%", background:"#f59e0b" }}/>
                <span style={{ width:9, height:9, borderRadius:"50%", background:"#10d9a0" }}/>
                <div style={{ flex:1, display:"flex", justifyContent:"center" }}>
                  <span style={{ fontSize:11.5, color:LPV7_TOKENS.muted, fontFamily:FONT_MONO,
                    background:"rgba(255,255,255,.04)", padding:"3px 14px", borderRadius:6 }}>
                    postureai-pro-omega-nine.vercel.app
                  </span>
                </div>
              </div>

              {/* Camera feed + skeleton overlay */}
              <div style={{ position:"relative", background:"#0a1628", aspectRatio:"4/3", overflow:"hidden" }}>
                {/* #11 Demo consent gate — show blurred preview until user clicks Start Demo */}
                {!demoStarted && (
                  <div style={{
                    position:"absolute", inset:0, zIndex:20,
                    background:"rgba(5,12,28,.75)", backdropFilter:"blur(6px)",
                    display:"flex", flexDirection:"column",
                    alignItems:"center", justifyContent:"center", gap:14,
                  }}>
                    <div style={{ fontSize:32, lineHeight:1 }}>📷</div>
                    <div style={{ fontSize:13.5, fontWeight:700, color:"#f0f6ff", textAlign:"center", lineHeight:1.4 }}>
                      {ar ? "شاهد كيف يعمل Corvus" : "See Corvus in action"}
                    </div>
                    <div style={{ fontSize:11, color:"#8896ac", textAlign:"center", maxWidth:180, lineHeight:1.5 }}>
                      {ar ? "عرض توضيحي — لا توجد كاميرا حقيقية" : "Simulated demo — no real camera"}
                    </div>
                    <button onClick={() => setDemoStarted(true)} style={{
                      background:"linear-gradient(135deg,#1a56db,#0891b2)",
                      border:"none", borderRadius:10, padding:"10px 22px",
                      fontSize:13, fontWeight:700, color:"#fff", cursor:"pointer",
                      boxShadow:"0 4px 20px rgba(26,86,219,.4)",
                      display:"flex", alignItems:"center", gap:7,
                    }}>
                      ▶ {ar ? "ابدأ العرض التجريبي" : "Start Demo"}
                    </button>
                  </div>
                )}
                {/* Simulated camera background — gradient silhouette */}
                <div style={{ position:"absolute", inset:0,
                  background:"radial-gradient(ellipse 60% 80% at 50% 30%, rgba(30,50,80,.9) 0%, rgba(5,12,25,.98) 100%)" }}/>

                {/* Person silhouette SVG */}
                <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%" }}
                  viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
                  {/* Desk background hint */}
                  <rect x="0" y="240" width="400" height="60" fill="rgba(20,35,60,.6)" rx="0"/>
                  {/* Monitor on desk */}
                  <rect x="140" y="190" width="120" height="72" rx="4" fill="rgba(30,60,100,.5)" stroke="rgba(100,150,220,.3)" strokeWidth="1.5"/>
                  <rect x="185" y="262" width="30" height="8" rx="2" fill="rgba(50,80,120,.5)"/>
                  <rect x="165" y="270" width="70" height="4" rx="2" fill="rgba(50,80,120,.5)"/>
                  {/* Screen glow */}
                  <rect x="146" y="196" width="108" height="60" rx="2" fill="rgba(79,124,249,.12)"/>

                  {/* Body silhouette */}
                  {/* Torso */}
                  <ellipse cx="200" cy="178" rx="28" ry="38" fill="rgba(40,65,105,.6)"/>
                  {/* Head */}
                  <ellipse cx="200" cy="108" rx="22" ry="26" fill="rgba(50,80,130,.55)"/>
                  {/* Neck */}
                  <rect x="194" y="130" width="12" height="16" rx="4" fill="rgba(45,72,118,.55)"/>
                  {/* Arms */}
                  <ellipse cx="167" cy="180" rx="10" ry="28" fill="rgba(38,62,100,.55)" transform="rotate(-8,167,180)"/>
                  <ellipse cx="233" cy="180" rx="10" ry="28" fill="rgba(38,62,100,.55)" transform="rotate(8,233,180)"/>

                  {/* Skeleton overlay — MediaPipe landmarks */}
                  {/* Spine line */}
                  <line x1="200" y1="134" x2="200" y2="210" stroke="rgba(16,217,160,.7)" strokeWidth="2.5" strokeLinecap="round"/>
                  {/* Shoulder line */}
                  <line x1="170" y1="152" x2="230" y2="152" stroke="rgba(16,217,160,.7)" strokeWidth="2.5" strokeLinecap="round"/>
                  {/* Neck line */}
                  <line x1="200" y1="130" x2="200" y2="152" stroke="rgba(16,217,160,.7)" strokeWidth="2" strokeLinecap="round"/>
                  {/* Head top */}
                  <line x1="200" y1="96" x2="200" y2="130" stroke="rgba(245,158,11,.8)" strokeWidth="2" strokeLinecap="round"/>
                  {/* Left arm */}
                  <line x1="170" y1="152" x2="162" y2="196" stroke="rgba(16,217,160,.55)" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="162" y1="196" x2="158" y2="230" stroke="rgba(16,217,160,.45)" strokeWidth="2" strokeLinecap="round"/>
                  {/* Right arm */}
                  <line x1="230" y1="152" x2="238" y2="196" stroke="rgba(16,217,160,.55)" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="238" y1="196" x2="242" y2="230" stroke="rgba(16,217,160,.45)" strokeWidth="2" strokeLinecap="round"/>

                  {/* Landmark dots */}
                  {[[200,96],[200,130],[170,152],[230,152],[200,152],[162,196],[238,196],[158,230],[242,230],[200,210]]
                    .map(([x,y],i) => (
                      <circle key={i} cx={x} cy={y} r={i===3?5:4} fill={i===3?"rgba(245,158,11,.9)":"rgba(16,217,160,.9)"}/>
                  ))}

                  {/* Neck forward angle indicator */}
                  <path d="M200,96 L206,110" stroke="rgba(245,158,11,.9)" strokeWidth="1.5" strokeDasharray="3,2"/>
                  <path d="M200,96 L200,110" stroke="rgba(255,255,255,.25)" strokeWidth="1" strokeDasharray="3,2"/>
                  {/* Angle label */}
                  <text x="210" y="108" fill="rgba(245,158,11,.95)" fontSize="10" fontFamily="monospace" fontWeight="bold">12°</text>
                </svg>

                {/* LIVE badge */}
                <div style={{ position:"absolute", top:12, left:12, display:"flex", alignItems:"center",
                  gap:6, background:"rgba(0,0,0,.50)",
                  borderRadius:99, padding:"4px 10px", border:"1px solid rgba(16,217,160,.3)" }}>
                  <span style={{ width:6, height:6, borderRadius:"50%", background:LPV7_TOKENS.green,
                    boxShadow:`0 0 6px ${LPV7_TOKENS.green}`, animation:"lp-pulse 1.5s ease-in-out infinite" }}/>
                  <span style={{ fontSize:11, color:LPV7_TOKENS.green, fontWeight:700, fontFamily:FONT_MONO }}>LIVE</span>
                </div>

                {/* Score overlay — bottom right */}
                <div style={{ position:"absolute", bottom:12, right:12,
                  background:"rgba(0,0,0,.55)",
                  borderRadius:14, padding:"10px 14px", border:"1px solid rgba(16,217,160,.25)",
                  textAlign:"center" }}>
                  <div style={{ fontSize:28, fontWeight:800, color:scoreColor,
                    fontFamily:FONT_MONO, transition:"color .4s", lineHeight:1 }}>{demoScore}</div>
                  <div style={{ fontSize:9.5, color:LPV7_TOKENS.muted, marginTop:2 }}>{ar ? "نقطة" : "score"}</div>
                </div>

                {/* Alert badge — top right */}
                <div style={{ position:"absolute", top:12, right:12,
                  background:"rgba(40,30,0,.85)",
                  borderRadius:10, padding:"6px 10px", border:"1px solid rgba(245,158,11,.35)" }}>
                  <div style={{ fontSize:10, color:"#fbbf24", fontWeight:600 }}>
                    ⚠️ {ar ? "رقبة للأمام 12°" : "Neck forward 12°"}
                  </div>
                </div>
              </div>

              {/* Metrics strip below camera */}
              <div style={{ padding:"14px 20px", display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10,
                borderTop:`1px solid ${LPV7_TOKENS.border}` }}>
                {(ar
                  ? [["انحناء الرقبة","12°",LPV7_TOKENS.amber],["وضع الكتف","جيد ✓",LPV7_TOKENS.green],["المسافة","58cm",LPV7_TOKENS.blue]]
                  : [["Neck Tilt","12°",LPV7_TOKENS.amber],["Shoulder","Good ✓",LPV7_TOKENS.green],["Distance","58cm",LPV7_TOKENS.blue]]
                ).map(([label, val, color]) => (
                  <div key={label} style={{ textAlign:"center" }}>
                    <div style={{ fontSize:17, fontWeight:700, color, fontFamily:FONT_MONO }}>{val}</div>
                    <div style={{ fontSize:10.5, color:LPV7_TOKENS.muted, marginTop:2 }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* AI tip */}
              <div style={{ margin:"0 16px 16px", padding:"11px 14px",
                background:"rgba(79,124,249,.08)", borderRadius:12,
                border:"1px solid rgba(79,124,249,.15)",
                display:"flex", gap:10, alignItems:"flex-start" }}>
                <span style={{ fontSize:16 }}>🤖</span>
                <p style={{ margin:0, fontSize:12.5, color:LPV7_TOKENS.sub, lineHeight:1.5 }}>
                  {ar
                    ? "رقبتك للأمام قليلاً. ارفع الشاشة 2 سم وحاول تمرين سحب الرقبة 10 مرات."
                    : "Neck is slightly forward. Raise your monitor 2cm and try 10 chin tucks now."}
                </p>
              </div>
            </div>

            {/* Floating card — top */}
            <motion.div {...float(0, 9)} style={{ willChange:"transform",
              position:"absolute", top:-12, [ar?"left":"right"]:-18,
              background:"rgba(8,18,32,.92)",
              border:`1px solid ${LPV7_TOKENS.borderM}`, borderRadius:16,
              padding:"12px 16px", boxShadow:"0 12px 32px rgba(0,0,0,.4)",
              display:"flex", alignItems:"center", gap:10, zIndex:2,
            }}>
              <span style={{ fontSize:20 }}>📉</span>
              <div>
                <div style={{ fontSize:15, fontWeight:800, color:LPV7_TOKENS.green, fontFamily:FONT_MONO, lineHeight:1 }}>-47%</div>
                <div style={{ fontSize:10.5, color:LPV7_TOKENS.muted, marginTop:2 }}>{ar ? "إجازات مرضية" : "sick leave"}</div>
              </div>
            </motion.div>

            {/* Floating card — bottom */}
            <motion.div {...float(1.4, 8)} style={{ willChange:"transform",
              position:"absolute", bottom:-6, [ar?"right":"left"]:-22,
              background:"rgba(8,18,32,.92)",
              border:`1px solid ${LPV7_TOKENS.borderM}`, borderRadius:16,
              padding:"11px 15px", boxShadow:"0 12px 32px rgba(0,0,0,.4)",
              display:"flex", alignItems:"center", gap:9, zIndex:2, maxWidth:200,
            }}>
              <span style={{ width:8, height:8, borderRadius:"50%", background:LPV7_TOKENS.green, flexShrink:0,
                boxShadow:`0 0 8px ${LPV7_TOKENS.green}` }}/>
              <span style={{ fontSize:11.5, color:LPV7_TOKENS.sub, lineHeight:1.4 }}>
                {ar ? "جلسة 45 دق — تحسن 18 نقطة 🎯" : "45 min session — +18 score 🎯"}
              </span>
            </motion.div>
          </div>
        </Reveal>
        </div>{/* end lp-hero-grid */}
      </div>{/* end lp-wrap */}

      {/* Scroll cue */}
      {!reduce && (
        <div aria-hidden="true"
          style={{ position:"absolute", bottom:28, left:"50%", transform:"translateX(-50%)",
            color:LPV7_TOKENS.muted, fontSize:20, opacity:.6,
            animation:"lp-float-8 1.8s ease-in-out infinite" }}>
          ↓
        </div>
      )}

      <style>{`
        @media(max-width:860px){.lp-hero-grid{grid-template-columns:1fr!important}}
        @media(max-width:480px){.lp-hero-grid h1{font-size:30px!important}}
      `}</style>
    </section>
  );
}

// ── Social proof bar ──────────────────────────────────────────────
function SocialProof({ lang }) {
  const ar = lang === "ar";
  return (
    <section style={{ borderTop:`1px solid ${LPV7_TOKENS.border}`, borderBottom:`1px solid ${LPV7_TOKENS.border}`,
      padding:"32px 24px", background:"rgba(255,255,255,.012)" }}>
      <Reveal>
        <div className="lp-wrap">
          {/* 4 stat cards */}
          <div className="lp-sp-stats" style={{ marginBottom:20 }}>
            {(ar ? [
              ["50+","مستخدم بيتا نشط","👥"],["4.9★","تقييم متوسط","⭐"],
              ["أسبوعان","وقت التحسن","⏱"],["0","لا نحفظ فيديو","🛡"],
            ] : [
              ["50+","active beta users","👥"],["4.9★","average rating","⭐"],
              ["2 weeks","avg improvement time","⏱"],["0","video data stored","🛡"],
            ]).map(([num, label, icon]) => (
              <div key={label} style={{
                background:"rgba(255,255,255,.03)", border:`1px solid ${LPV7_TOKENS.border}`,
                borderRadius:14, padding:"16px 12px", textAlign:"center",
              }}>
                <div style={{ fontSize:13, marginBottom:5 }}>{icon}</div>
                <div style={{ fontSize:20, fontWeight:800, color:LPV7_TOKENS.text, fontFamily:FONT_MONO, lineHeight:1 }}>{num}</div>
                <div style={{ fontSize:11, color:LPV7_TOKENS.muted, marginTop:4 }}>{label}</div>
              </div>
            ))}
          </div>
          {/* Row 2 — used at + security badges */}
          <div className="lp-sp-row2">
            <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
              <span style={{ fontSize:11, color:LPV7_TOKENS.muted, fontWeight:600, letterSpacing:".06em", textTransform:"uppercase" }}>
                {ar ? "يُستخدم في" : "Currently used at"}
              </span>
              <div style={{ background:"rgba(255,255,255,.04)", border:`1px solid ${LPV7_TOKENS.border}`,
                borderRadius:9, padding:"6px 14px", fontSize:13.5, fontWeight:700, color:LPV7_TOKENS.text }}>
                Coventry University
              </div>
              <span style={{ fontSize:12, color:LPV7_TOKENS.muted }}>
                {ar ? "جامعة القاهرة — تجريبي · 50+ مستخدم في 4 دول" : "Cairo University — Pilot · 50+ users across 4 countries"}
              </span>
            </div>
            <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
              {[["🛡","ISO 27001","Aligned"],["🔒","AES-256","Encryption"],["✅","GDPR","Ready"],["📷","On-device AI","No Video"]].map(([icon,t1,t2])=>(
                <div key={t1} style={{ display:"flex", alignItems:"center", gap:7,
                  background:"rgba(59,130,246,.07)", border:"1px solid rgba(59,130,246,.18)",
                  borderRadius:10, padding:"7px 13px" }}>
                  <span style={{ fontSize:14 }}>{icon}</span>
                  <div>
                    <div style={{ fontSize:11.5, color:"#60a5fa", fontWeight:700, lineHeight:1.2, fontFamily:FONT_MONO }}>{t1}</div>
                    <div style={{ fontSize:10, color:"#3b82f6", lineHeight:1.2 }}>{t2}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

// ── Stats ─────────────────────────────────────────────────────────
function Stats({ lang }) {
  const ar = lang === "ar";
  const stats = ar
    ? [["-47%","تقليل الإجازات المرضية","من متوسط تقارير الإرغونوميا","🏥"],["3.2×","عائد الاستثمار المتوقع","بناءً على تكاليف الغياب","💰"],["15دق","وقت الإعداد للفريق","مُختبر مع مستخدمي البيتا","⚡"],["98%","رضا مستخدمي البيتا","50+ مستخدم في 4 دول","⭐"]]
    : [["-47%","Reduction in sick leave","Ergonomics research average","🏥"],["3.2×","Projected ROI in year 1","Based on absence cost models","💰"],["15min","Team onboarding time","Tested with beta users","⚡"],["98%","Beta user satisfaction","50+ users across 4 countries","⭐"]];
  return (
    <section id="stats" className="lp-section">
      <div className="lp-wrap">
        <div className="lp-stats-grid">
        {stats.map(([val, label, source, icon], i) => {
          const col = [LPV7_TOKENS.green,LPV7_TOKENS.blue,LPV7_TOKENS.indigo,LPV7_TOKENS.sky][i];
          return (
          <Reveal key={label} delay={i * 80} y={20}>
            <div className="lp-lift" style={{
              ...card(), textAlign:"center",
              padding:"clamp(20px,3vw,36px) clamp(16px,2vw,24px)",
              borderTop:`2px solid ${col}`,
              position:"relative", overflow:"hidden",
            }}>
              <div style={{
                position:"absolute", top:0, left:0, right:0, height:60,
                background:`radial-gradient(ellipse at 50% 0%,${col}18,transparent 70%)`,
                pointerEvents:"none",
              }}/>
              {/* Icon */}
              <div style={{
                width:44, height:44, borderRadius:12, margin:"0 auto 16px",
                background:`${col}14`, border:`1px solid ${col}28`,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:22, position:"relative",
              }}>{icon}</div>
              <div style={{
                fontSize:"clamp(30px,3vw,48px)", fontWeight:700, letterSpacing:"-.02em",
                color:col, lineHeight:1, marginBottom:10,
                fontFamily:FONT_MONO, position:"relative",
              }}>{val}</div>
              <div style={{ fontSize:"clamp(13px,1.2vw,14px)", color:LPV7_TOKENS.sub, lineHeight:1.5, position:"relative", fontWeight:500 }}>{label}</div>
              {source&&<div style={{ fontSize:10.5, color:col, opacity:.65, marginTop:6, lineHeight:1.4, position:"relative", fontFamily:FONT_MONO }}>{source}</div>}
            </div>
          </Reveal>
          );
        })}
        </div>
      </div>
    </section>
  );
}

// ── Features ──────────────────────────────────────────────────────
function Features({ lang }) {
  const ar = lang === "ar";
  const [active, setActive] = useState(0);
  useEffect(() => { setActive(0); }, [ar]);

  const FEAT = [
    {
      icon:"🎯", accentColor:"#4f7cf9",
      badge:{ en:"All Plans", ar:"كل الخطط" }, badgeC:"#10b981",
      title:{ en:"Posture Score Engine", ar:"محرك درجة الوضعية" },
      sub:{ en:"478 landmarks · 3D head pose · 30 fps live", ar:"478 نقطة · وضع رأس ثلاثي الأبعاد · 30 إطار/ثانية" },
      bullets:{
        en:["MediaPipe FaceMesh tracks 478 facial & body landmarks in real time",
            "3D head pose via solvePnP — detects forward head, tilt & rotation",
            "Shoulder symmetry + neck angle measured every frame",
            "Live 0–100 score with green/amber/red alerts every 15 seconds"],
        ar:["MediaPipe FaceMesh تتتبع 478 نقطة على الوجه والجسم فورياً",
            "وضع رأس ثلاثي الأبعاد عبر solvePnP — يكتشف الرأس الأمامي والميلان والدوران",
            "تقييم تماثل الكتفين وزاوية العنق في كل إطار",
            "درجة حية 0-100 مع تنبيهات ملونة كل 15 ثانية"],
      },
      stat:{ v:"96%",  l:{ en:"tracking accuracy", ar:"دقة التتبع" } },
      mock:"score",
    },
    {
      icon:"🔮", accentColor:"#8b5cf6",
      badge:{ en:"Basic +", ar:"Basic +" }, badgeC:"#1a56db",
      title:{ en:"Pain Prediction AI", ar:"ذكاء توقع الألم" },
      sub:{ en:"Predicts pain zones 48 hrs before they peak", ar:"يتوقع مناطق الألم قبل 48 ساعة من ذروتها" },
      bullets:{
        en:["Analyses 14-day posture history to spot strain patterns",
            "Risk scores for neck, lower back, shoulders & wrists",
            "Donut chart visualises body risk zones at a glance",
            "Proactive WhatsApp alert sent before pain peaks"],
        ar:["يحلل 14 يوماً من تاريخ الوضعية للكشف عن أنماط الإجهاد",
            "درجة خطر للرقبة، أسفل الظهر، الكتفين والمعصمين",
            "مخطط دائري يُظهر مناطق خطر الجسم بلمحة",
            "تنبيه واتساب استباقي يُرسل قبل بلوغ الألم ذروته"],
      },
      stat:{ v:"48h", l:{ en:"early warning window", ar:"نافذة الإنذار المبكر" } },
      mock:"pain",
    },
    {
      icon:"🔥", accentColor:"#f59e0b",
      badge:{ en:"Basic +", ar:"Basic +" }, badgeC:"#1a56db",
      title:{ en:"Habits & Streaks", ar:"العادات والسلاسل" },
      sub:{ en:"Daily check-ins · weekly challenge · 1× freeze/month", ar:"تسجيل يومي · تحدي أسبوعي · تجميد مرة/شهر" },
      bullets:{
        en:["Morning check-in: mood, pain level + AI personalised tip",
            "Weekly posture challenge with badge on completion",
            "Streak counter with one freeze-per-month protection",
            "14-day consistency grid + Habit Score 0–100"],
        ar:["تسجيل صباحي: المزاج، مستوى الألم + نصيحة AI مخصصة",
            "تحدي وضعية أسبوعي مع شارة عند الإكمال",
            "عداد سلسلة مع حماية تجميد مرة في الشهر",
            "شبكة اتساق 14 يوماً + درجة عادة 0-100"],
      },
      stat:{ v:"+34%", l:{ en:"habit consistency vs. no reminders", ar:"اتساق أعلى مقارنةً بغير المذكَّرين" } },
      mock:"streak",
    },
    {
      icon:"🤖", accentColor:"#6366f1",
      badge:{ en:"Basic → Elite", ar:"Basic → Elite" }, badgeC:"#6366f1",
      title:{ en:"Dr. Corvus AI Coach", ar:"مدرب AI — د. كورفوس" },
      sub:{ en:"10 → 30 → Unlimited msgs/mo · Arabic & English", ar:"10 → 30 → غير محدود رسالة/شهر · عربي وإنجليزي" },
      bullets:{
        en:["Remembers your full session history — no re-explaining needed",
            "Evidence-based stretch & ergonomics advice per your score",
            "Explains exactly why your score dropped and what to fix first",
            "Elite: voice replies in Egyptian & Gulf Arabic dialects"],
        ar:["يحفظ كامل تاريخ جلساتك — لا حاجة للشرح مجدداً",
            "نصائح تمدد وهندسة بيئة عمل مبنية على أدلة بحسب درجتك",
            "يشرح بدقة سبب انخفاض درجتك وأول شيء تصلحه",
            "Elite: ردود صوتية بالعربية المصرية والخليجية"],
      },
      stat:{ v:"87%", l:{ en:"improved score after coaching week", ar:"تحسّنوا بعد أسبوع coaching" } },
      mock:"coach",
    },
    {
      icon:"📱", accentColor:"#25d366",
      badge:{ en:"Basic +", ar:"Basic +" }, badgeC:"#1a56db",
      title:{ en:"WhatsApp Reminders", ar:"تذكيرات واتساب" },
      sub:{ en:"Smart nudges in your time window · Cairo UTC+3", ar:"تنبيهات ذكية في نافذة وقتك · القاهرة UTC+3" },
      bullets:{
        en:["Set your reminder window (e.g. 9 AM–5 PM Cairo time)",
            "AI picks the sharpest message based on your recent score",
            "Pain early-warning alerts sent proactively when risk rises",
            "Twilio-powered — works on any phone, no app download needed"],
        ar:["حدد نافذة التذكير (مثلاً 9 صباحاً–5 مساءً بتوقيت القاهرة)",
            "الـ AI يختار أقوى رسالة بناءً على درجتك الأخيرة",
            "تنبيهات ألم استباقية تُرسل تلقائياً عند ارتفاع الخطر",
            "مدعوم بـ Twilio — يعمل على أي هاتف بدون تنزيل تطبيق"],
      },
      stat:{ v:"3×", l:{ en:"more check-ins vs. no reminders", ar:"ضعف التسجيلات بالمقارنة بغير المذكّرين" } },
      mock:"whatsapp",
    },
    {
      icon:"📊", accentColor:"#10b981",
      badge:{ en:"B2B", ar:"B2B" }, badgeC:"#10b981",
      title:{ en:"HR Intelligence Dashboard", ar:"لوحة HR الذكية" },
      sub:{ en:"Team posture analytics for HR managers", ar:"تحليلات وضعية الفريق لمدراء الموارد البشرية" },
      bullets:{
        en:["Department-level risk maps and 30-day posture trends",
            "Automatic weekly PDF wellness reports per employee",
            "High-risk Slack / Teams / email alerts in real time",
            "CSV + Excel export for compliance & insurance reporting"],
        ar:["خرائط مخاطر على مستوى الأقسام واتجاهات الوضعية لمدة 30 يوماً",
            "تقارير PDF صحية أسبوعية تلقائية لكل موظف",
            "تنبيهات عالية الخطورة إلى Slack / Teams / بريد فورياً",
            "تصدير CSV + Excel لتقارير الامتثال والتأمين"],
      },
      stat:{ v:"↓40%", l:{ en:"back pain complaints in 90 days", ar:"انخفاض شكاوى آلام الظهر خلال 90 يوماً" } },
      mock:"hr",
    },
    {
      icon:"🛡️", accentColor:"#f59e0b",
      badge:{ en:"Enterprise", ar:"Enterprise" }, badgeC:"#f59e0b",
      title:{ en:"Enterprise Security", ar:"أمان المستوى المؤسسي" },
      sub:{ en:"SSO · RBAC · AES-256 · Audit logs · GDPR", ar:"SSO · RBAC · AES-256 · سجلات تدقيق · GDPR" },
      bullets:{
        en:["SAML 2.0 / Azure AD / Okta single sign-on",
            "Role-based access — HR, Manager & Employee tiers",
            "AES-256 at rest + TLS 1.3 in transit, zero data sold",
            "Full audit-log export + GDPR right-to-erasure API"],
        ar:["تسجيل دخول موحد SAML 2.0 / Azure AD / Okta",
            "تحكم وصول بالأدوار — HR، مدير، موظف",
            "AES-256 للبيانات المخزنة + TLS 1.3 أثناء النقل، لا بيانات تُباع",
            "تصدير سجل تدقيق كامل + API حق الحذف GDPR"],
      },
      stat:{ v:"99.9%", l:{ en:"uptime SLA", ar:"وقت تشغيل مضمون" } },
      mock:"security",
    },
  ];

  function FeatureMock({ type, accent }) {
    const s = { borderRadius:12, overflow:"hidden", fontSize:12 };
    if (type === "score") return (
      <div style={{ ...s, background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.07)", padding:"18px 20px", display:"flex", alignItems:"center", gap:20 }}>
        <div style={{ position:"relative", width:72, height:72, flexShrink:0 }}>
          <svg viewBox="0 0 72 72" width="72" height="72">
            <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="7"/>
            <circle cx="36" cy="36" r="30" fill="none" stroke={accent} strokeWidth="7"
              strokeDasharray={`${2*Math.PI*30*0.78} ${2*Math.PI*30}`}
              strokeDashoffset={2*Math.PI*30*0.25} strokeLinecap="round"/>
          </svg>
          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column" }}>
            <span style={{ fontSize:18, fontWeight:800, color:"#f0f6ff", lineHeight:1 }}>78</span>
            <span style={{ fontSize:9, color:"#8896ac" }}>/100</span>
          </div>
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:11, color:"#8896ac", marginBottom:6 }}>{ar?"الجلسة الحالية":"Live session"}</div>
          {[["Neck angle","12°","#10b981"],["Shoulder tilt","4°","#f59e0b"],["Head forward","8mm","#10b981"]].map(([l,v,c])=>(
            <div key={l} style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
              <span style={{ color:"#8896ac", fontSize:11 }}>{l}</span>
              <span style={{ color:c, fontWeight:600, fontSize:11 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    );
    if (type === "pain") return (
      <div style={{ ...s, background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.07)", padding:"16px 18px" }}>
        <div style={{ fontSize:11, color:"#8896ac", marginBottom:10 }}>{ar?"مناطق خطر الجسم":"Body risk zones"}</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
          {[[ar?"الرقبة":"Neck","72%","#ef4444"],[ar?"أسفل الظهر":"Lower back","48%","#f59e0b"],[ar?"الكتفان":"Shoulders","31%","#10b981"],[ar?"المعصمان":"Wrists","19%","#10b981"]].map(([z,p,c])=>(
            <div key={z} style={{ background:"rgba(255,255,255,.04)", borderRadius:8, padding:"8px 10px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ color:"#8896ac", fontSize:10.5 }}>{z}</span>
                <span style={{ color:c, fontWeight:700, fontSize:10.5 }}>{p}</span>
              </div>
              <div style={{ height:3, borderRadius:99, background:"rgba(255,255,255,.08)" }}>
                <div style={{ height:3, borderRadius:99, background:c, width:p }}/>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
    if (type === "streak") return (
      <div style={{ ...s, background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.07)", padding:"16px 18px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <span style={{ fontSize:11, color:"#8896ac" }}>{ar?"14 يوم اتساق":"14-day consistency"}</span>
          <span style={{ fontSize:13, fontWeight:700, color:accent }}>🔥 12 {ar?"يوم":"days"}</span>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4 }}>
          {[1,1,1,1,0,1,1,1,1,1,1,1,0,1].map((v,i)=>(
            <div key={i} style={{ height:22, borderRadius:5, background: v ? `${accent}cc` : "rgba(255,255,255,.06)" }}/>
          ))}
        </div>
        <div style={{ marginTop:10, display:"flex", gap:8 }}>
          <div style={{ flex:1, background:"rgba(255,255,255,.04)", borderRadius:8, padding:"6px 10px", textAlign:"center" }}>
            <div style={{ fontSize:14, fontWeight:700, color:"#f0f6ff" }}>83</div>
            <div style={{ fontSize:9.5, color:"#8896ac" }}>{ar?"درجة العادة":"Habit Score"}</div>
          </div>
          <div style={{ flex:1, background:"rgba(255,255,255,.04)", borderRadius:8, padding:"6px 10px", textAlign:"center" }}>
            <div style={{ fontSize:14, fontWeight:700, color:"#f0f6ff" }}>5/7</div>
            <div style={{ fontSize:9.5, color:"#8896ac" }}>{ar?"هذا الأسبوع":"This week"}</div>
          </div>
        </div>
      </div>
    );
    if (type === "coach") return (
      <div style={{ ...s, background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.07)", padding:"14px 16px", display:"flex", flexDirection:"column", gap:8 }}>
        <div style={{ alignSelf:"flex-start", background:"rgba(79,124,249,.15)", border:"1px solid rgba(79,124,249,.25)", borderRadius:"14px 14px 14px 4px", padding:"9px 13px", maxWidth:"80%" }}>
          <div style={{ fontSize:10.5, color:"#818cf8", marginBottom:3, fontWeight:600 }}>Dr. Corvus</div>
          <div style={{ fontSize:11.5, color:"#d1d5db", lineHeight:1.5 }}>{ar?"درجتك انخفضت 8 نقاط — الرقبة في وضع أمامي 47 دقيقة. جرّب تمرين الـ chin tuck الآن.":"Your score dropped 8pts — forward head for 47 min. Try a chin tuck stretch now."}</div>
        </div>
        <div style={{ alignSelf:"flex-end", background:"rgba(255,255,255,.07)", borderRadius:"14px 14px 4px 14px", padding:"9px 13px", maxWidth:"70%" }}>
          <div style={{ fontSize:11.5, color:"#d1d5db" }}>{ar?"كيف أعمل الـ chin tuck صح؟":"How do I do chin tuck correctly?"}</div>
        </div>
        <div style={{ alignSelf:"flex-start", background:"rgba(79,124,249,.15)", border:"1px solid rgba(79,124,249,.25)", borderRadius:"14px 14px 14px 4px", padding:"9px 13px", maxWidth:"85%" }}>
          <div style={{ fontSize:10.5, color:"#818cf8", marginBottom:3, fontWeight:600 }}>Dr. Corvus</div>
          <div style={{ fontSize:11.5, color:"#d1d5db", lineHeight:1.5 }}>{ar?"اسحب ذقنك للخلف دون خفض رأسك — 10 تكرارات كل ساعة.":"Pull chin straight back without dropping head — 10 reps, every hour."}</div>
        </div>
      </div>
    );
    if (type === "whatsapp") return (
      <div style={{ ...s, background:"#0b1f14", border:"1px solid rgba(37,211,102,.18)", padding:"14px 16px", display:"flex", flexDirection:"column", gap:7 }}>
        <div style={{ fontSize:10, color:"#25d366", fontWeight:600, marginBottom:2 }}>● Corvus Health · {ar?"واتساب":"WhatsApp"}</div>
        {[
          ar?"⚠️ درجتك انخفضت إلى 61 — الرقبة في وضع إجهاد عالٍ. استرح 5 دقائق الآن."
            :"⚠️ Your score dropped to 61 — neck in high-strain. Take a 5-min break now.",
          ar?"🔥 سلسلة 12 يوم! تسجيل اليوم؟ اضغط ✅"
            :"🔥 12-day streak! Log today? Tap ✅ to confirm.",
          ar?"📊 تقرير الأسبوع: متوسط درجتك 74 (+6 من الأسبوع الماضي) 🎉"
            :"📊 Weekly: avg score 74 (+6 from last week) 🎉",
        ].map((msg,i)=>(
          <div key={i} style={{ background:"rgba(37,211,102,.08)", border:"1px solid rgba(37,211,102,.12)", borderRadius:"12px 12px 12px 4px", padding:"8px 11px" }}>
            <div style={{ fontSize:11.5, color:"#d1fae5", lineHeight:1.45 }}>{msg}</div>
            <div style={{ fontSize:9.5, color:"#25d366", marginTop:3, opacity:.7 }}>{["9:04 AM","12:00 PM","Mon 9:00 AM"][i]} ✓✓</div>
          </div>
        ))}
      </div>
    );
    if (type === "hr") return (
      <div style={{ ...s, background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.07)", padding:"16px 18px" }}>
        <div style={{ fontSize:11, color:"#8896ac", marginBottom:10 }}>{ar?"متوسط درجة الأقسام — هذا الأسبوع":"Department avg score — this week"}</div>
        {[[ar?"هندسة":"Engineering","82",accent],[ar?"تصميم":"Design","76","#f59e0b"],[ar?"مبيعات":"Sales","61","#ef4444"],[ar?"دعم":"Support","88",accent]].map(([d,v,c])=>(
          <div key={d} style={{ marginBottom:6 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
              <span style={{ color:"#8896ac", fontSize:11 }}>{d}</span>
              <span style={{ color:c, fontWeight:700, fontSize:11 }}>{v}/100</span>
            </div>
            <div style={{ height:5, borderRadius:99, background:"rgba(255,255,255,.06)" }}>
              <div style={{ height:5, borderRadius:99, background:c, width:`${v}%` }}/>
            </div>
          </div>
        ))}
        <div style={{ marginTop:10, padding:"8px 12px", background:"rgba(239,68,68,.08)", border:"1px solid rgba(239,68,68,.2)", borderRadius:9, fontSize:11, color:"#fca5a5" }}>
          🚨 {ar?"3 موظفين في المبيعات — خطر ألم ظهر مرتفع":"3 Sales employees — high back pain risk"}
        </div>
      </div>
    );
    if (type === "security") return (
      <div style={{ ...s, background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.07)", padding:"16px 18px" }}>
        {[["SAML 2.0 SSO","Azure AD · Okta · Google"],["AES-256 Encryption","at rest + TLS 1.3 in transit"],["RBAC","HR · Manager · Employee roles"],["GDPR Erasure API","right-to-delete in < 24h"],["Audit Logs","every event, exportable CSV"]].map(([t,s2])=>(
          <div key={t} style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 0", borderBottom:"1px solid rgba(255,255,255,.05)" }}>
            <span style={{ color:accent, fontWeight:700, fontSize:14, flexShrink:0 }}>✓</span>
            <div>
              <div style={{ fontSize:12, color:"#e2e8f0", fontWeight:600 }}>{t}</div>
              <div style={{ fontSize:10.5, color:"#8896ac" }}>{s2}</div>
            </div>
          </div>
        ))}
      </div>
    );
    return null;
  }

  const f = FEAT[active];

  return (
    <section id="features" className="lp-section">
      <div className="lp-wrap">
        <SectionHead
          eyebrow={ar ? "المنصة" : "Platform"}
          title={ar ? "كل ما تحتاجه — فرداً كنت أو شركة" : "Everything you need — individual or enterprise"}
          sub={ar ? "من تحليل الوضعية الفوري إلى لوحات HR المؤسسية — منصة واحدة تخدم الجميع"
                  : "From real-time posture analysis to enterprise HR dashboards — one platform for everyone"}
        />

        <div className="lp-features-wrap">
          <div style={{ display:"flex", flexDirection:"column", gap:4 }} className="lp-features-tabs">
            {FEAT.map((item, i) => {
              const isActive = active === i;
              return (
                <button key={i} onClick={() => setActive(i)} style={{
                  background: isActive ? `${item.accentColor}12` : "transparent",
                  border: isActive ? `1px solid ${item.accentColor}38` : "1px solid transparent",
                  borderRadius:14, padding:"13px 15px",
                  cursor:"pointer", textAlign: ar ? "right" : "left",
                  transition:"background .2s,border-color .2s",
                  display:"flex", alignItems:"center", gap:12,
                  flexDirection: ar ? "row-reverse" : "row",
                }}>
                  <div style={{ width:3, height:32, borderRadius:99, flexShrink:0, background: isActive ? item.accentColor : "transparent", transition:"background .2s" }}/>
                  <span style={{ width:36, height:36, borderRadius:10, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:17, background: isActive ? `${item.accentColor}22` : "rgba(255,255,255,.05)", border: isActive ? `1px solid ${item.accentColor}44` : "1px solid transparent", transition:"background .2s,border-color .2s" }}>{item.icon}</span>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:13.5, fontWeight:600, color: isActive ? LPV7_TOKENS.text : LPV7_TOKENS.sub, lineHeight:1.3 }}>{ar ? item.title.ar : item.title.en}</div>
                    <div style={{ fontSize:11, color: isActive ? item.accentColor : "transparent", marginTop:1, fontWeight:500, transition:"color .2s", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{ar ? item.sub.ar : item.sub.en}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <motion.div key={active}
            initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
            transition={{ duration:.35, ease:[0.22,1,0.36,1] }}
            style={{ display:"flex", flexDirection:"column", gap:0, ...card(true), padding:0, overflow:"hidden" }}>
            <div style={{ background:`linear-gradient(135deg, ${f.accentColor}18 0%, transparent 70%)`, padding:"26px 28px 20px", borderBottom:"1px solid rgba(255,255,255,.07)" }}>
              <div style={{ display:"flex", alignItems:"flex-start", gap:14, marginBottom:14 }}>
                <span style={{ width:52, height:52, borderRadius:14, fontSize:24, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", background:`${f.accentColor}22`, border:`1.5px solid ${f.accentColor}44` }}>{f.icon}</span>
                <div style={{ flex:1 }}>
                  <span style={{ display:"inline-block", fontSize:10, fontWeight:700, letterSpacing:".06em", padding:"3px 10px", borderRadius:99, marginBottom:6, background:`${f.badgeC}18`, border:`1px solid ${f.badgeC}40`, color:f.badgeC }}>{ar ? f.badge.ar : f.badge.en}</span>
                  <h3 style={{ fontSize:22, fontWeight:800, color:LPV7_TOKENS.text, margin:0, fontFamily:FONT_DISPLAY, lineHeight:1.2 }}>{ar ? f.title.ar : f.title.en}</h3>
                  <p style={{ fontSize:13.5, color:f.accentColor, margin:"4px 0 0", fontWeight:500, opacity:.9 }}>{ar ? f.sub.ar : f.sub.en}</p>
                </div>
              </div>
              <div style={{ display:"inline-flex", alignItems:"center", gap:10, background:"rgba(255,255,255,.05)", border:`1px solid ${f.accentColor}30`, borderRadius:10, padding:"8px 16px" }}>
                <span style={{ fontSize:24, fontWeight:800, color:f.accentColor, fontFamily:FONT_DISPLAY }}>{f.stat.v}</span>
                <span style={{ fontSize:12, color:LPV7_TOKENS.muted, maxWidth:120, lineHeight:1.3 }}>{ar ? f.stat.l.ar : f.stat.l.en}</span>
              </div>
            </div>
            <div style={{ padding:"20px 28px 24px", display:"flex", flexDirection:"column", gap:18 }}>
              <ul style={{ margin:0, padding:0, listStyle:"none", display:"flex", flexDirection:"column", gap:9 }}>
                {(ar ? f.bullets.ar : f.bullets.en).map((b,i)=>(
                  <li key={i} style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
                    <span style={{ width:18, height:18, borderRadius:99, background:`${f.accentColor}20`, border:`1px solid ${f.accentColor}50`, color:f.accentColor, fontSize:10, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:1 }}>✓</span>
                    <span style={{ fontSize:13.5, color:LPV7_TOKENS.sub, lineHeight:1.5 }}>{b}</span>
                  </li>
                ))}
              </ul>
              <FeatureMock type={f.mock} accent={f.accentColor} />
            </div>
          </motion.div>
        </div>
      </div>
      <style>{`
        @media(max-width:860px){
          .lp-features-wrap{grid-template-columns:1fr!important}
          .lp-features-tabs{flex-direction:row!important;overflow-x:auto;gap:6px!important;padding-bottom:6px;-webkit-overflow-scrolling:touch}
          .lp-features-tabs button{flex-shrink:0;min-width:140px}
          .lp-features-tabs button>div:last-child>div:last-child{display:none}
        }
      `}</style>
    </section>
  );
}

// ── How It Works ──────────────────────────────────────────────────
function HowItWorks({ lang }) {
  const ar = lang === "ar";
  const steps = ar ? [
    { n:"01", title:"الإعداد السريع", desc:"أضف موظفيك بالCSV أو رابط الدعوة. الإعداد الكامل في 15 دقيقة.", time:"~15 دقيقة", icon:"🚀" },
    { n:"02", title:"التحليل الفوري", desc:"يستخدم الموظفون الكاميرا للتحليل. لا يلزم أي جهاز خاص.", time:"~2 دقيقة/موظف", icon:"📡" },
    { n:"03", title:"رؤى قابلة للتنفيذ", desc:"احصل على تقارير HR أسبوعية وتنبيهات فورية للمخاطر المهنية.", time:"تلقائي · أسبوعياً", icon:"📊" },
  ] : [
    { n:"01", title:"Quick Setup", desc:"Add your team via CSV or invite link. Full onboarding in 15 minutes.", time:"~15 min", icon:"🚀" },
    { n:"02", title:"Instant Analysis", desc:"Employees use their webcam for analysis. No special hardware needed.", time:"~2 min/employee", icon:"📡" },
    { n:"03", title:"Actionable Insights", desc:"Get weekly HR reports and real-time alerts for occupational risks.", time:"Automated · Weekly", icon:"📊" },
  ];

  return (
    <section id="how" className="lp-section" style={{ background:LPV7_TOKENS.bg1 }}>
      <div className="lp-wrap">
        <SectionHead eyebrow={ar ? "كيف يعمل" : "How It Works"}
          title={ar ? "ابدأ في 3 خطوات بسيطة" : "Up and running in 3 simple steps"}
          sub={ar ? "ثلاث خطوات بسيطة لبداية موثوقة" : "Three simple steps to a healthier team"}/>

        <Stagger className="lp-how-grid" gap={0.12}>
          {steps.map((s, i) => {
            const cols = [LPV7_TOKENS.blue, LPV7_TOKENS.indigo, LPV7_TOKENS.green];
            const col = cols[i];
            return (
              <StaggerItem key={s.n}>
                <div className="lp-lift" style={{
                  ...card(), textAlign:"center", padding:"36px 28px 32px",
                  borderTop:`2px solid ${col}`,
                  position:"relative", overflow:"hidden",
                }}>
                  {/* Glow bg */}
                  <div style={{
                    position:"absolute", top:0, left:0, right:0, height:80,
                    background:`radial-gradient(ellipse at 50% 0%,${col}14,transparent 70%)`,
                    pointerEvents:"none",
                  }}/>
                  {/* Step number */}
                  <div style={{
                    width:48, height:48, borderRadius:"50%", margin:"0 auto 16px",
                    background:`${col}18`, border:`1.5px solid ${col}40`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontFamily:FONT_MONO, fontSize:16, fontWeight:700, color:col,
                    position:"relative",
                  }}>{s.n}</div>
                  {/* Icon */}
                  <div style={{ fontSize:28, marginBottom:14 }}>{s.icon}</div>
                  <h3 style={{ ...TYPE.h3, color:LPV7_TOKENS.text, margin:"0 0 10px", fontFamily:FONT_DISPLAY }}>
                    {s.title}
                  </h3>
                  <p style={{ ...TYPE.bodySm, color:LPV7_TOKENS.sub, margin:"0 0 18px", lineHeight:1.65 }}>
                    {s.desc}
                  </p>
                  <div style={{
                    display:"inline-flex", alignItems:"center", gap:5,
                    background:`${col}10`, border:`1px solid ${col}28`,
                    borderRadius:99, padding:"5px 14px",
                  }}>
                    <span style={{ fontSize:11.5, color:col, fontWeight:600, fontFamily:FONT_MONO }}>⏱ {s.time}</span>
                  </div>
                </div>
              </StaggerItem>
            );
          })}
        </Stagger>
      </div>
    </section>
  );
}

// ── Case Studies ──────────────────────────────────────────────────
function CaseStudies({ lang }) {
  const ar = lang === "ar";
  const cases = ar ? [
    { co:"شركة اتصالات كبرى", industry:"اتصالات", employees:"2,400", result:"↓52%", resultLabel:"غياب مرتبط بوضعية الجسم", time:"6 أشهر", detail:"وفرت 1.2م ج.م. سنوياً في تكاليف العلاج الطبيعي", quote:"Corvus غيّر طريقة تفكيرنا في صحة الموظفين — من تكلفة لاستثمار", quoteName:"م. أحمد، مدير الموارد البشرية" },
    { co:"بنك وطني", industry:"مصرفية", employees:"850", result:"↑23%", resultLabel:"رضا الموظفين", time:"3 أشهر", detail:"انتشار ممتاز: 94% معدل استخدام يومي", quote:"أسهل أداة أطلقناها على الإطلاق. الفريق استخدمها من اليوم الأول", quoteName:"ن. سعيد، مدير التقنية" },
    { co:"شركة تقنية ناشئة", industry:"تكنولوجيا", employees:"120", result:"↓38%", resultLabel:"شكاوى آلام الظهر", time:"4 أشهر", detail:"عائد استثمار 4.1× خلال السنة الأولى", quote:"ROI واضح خلال 6 أسابيع. أوصي به لكل فريق remote", quoteName:"ي. حسن، المدير التنفيذي" },
  ] : [
    { co:"Major Telecom Corp.", industry:"Telecommunications", employees:"2,400", result:"↓52%", resultLabel:"posture-related absences", time:"6 months", detail:"Saved $340K annually in physiotherapy costs", quote:"Corvus changed how we think about employee health — from a cost to an investment.", quoteName:"A. Hassan, HR Director" },
    { co:"National Bank", industry:"Banking", employees:"850", result:"↑23%", resultLabel:"employee satisfaction", time:"3 months", detail:"Excellent adoption: 94% daily active rate", quote:"Easiest tool we've ever rolled out. Team was using it from day one.", quoteName:"N. Said, CTO" },
    { co:"Tech Startup", industry:"Technology", employees:"120", result:"↓38%", resultLabel:"back pain complaints", time:"4 months", detail:"4.1× ROI in the first year", quote:"Clear ROI within 6 weeks. I recommend it to every remote-first team.", quoteName:"Y. Hassan, CEO" },
  ];

  return (
    <section id="casestudies" className="lp-section">
      <div className="lp-wrap">
        <SectionHead eyebrow={ar ? "نتائج حقيقية" : "Real Results"}
          eyebrowColor={LPV7_TOKENS.green} eyebrowBg="rgba(16,217,160,.08)" eyebrowBorder="rgba(16,217,160,.2)"
          title={ar ? "عملاؤنا يحقّقون نتائج قابلة للقياس" : "Our customers achieve measurable results"}/>

        <Stagger className="lp-cases-grid">
          {cases.map((c) => (
            <StaggerItem key={c.co}>
              <div className="lp-lift" style={{ ...card(), height:"100%", display:"flex", flexDirection:"column" }}>
                <div style={{
                  background:"rgba(79,124,249,.08)", borderRadius:8,
                  padding:"5px 12px", fontSize:12.5, color:LPV7_TOKENS.indigo,
                  fontWeight:500, display:"inline-block", marginBottom:14,
                }}>{c.industry}</div>
                <h3 style={{ fontSize:17, fontWeight:700, color:LPV7_TOKENS.text, margin:"0 0 4px", fontFamily:FONT_DISPLAY }}>
                  {c.co}
                </h3>
                <div style={{ fontSize:12.5, color:LPV7_TOKENS.muted, marginBottom:18 }}>
                  {c.employees} {ar ? "موظف" : "employees"} · {c.time}
                </div>
                <div style={{
                  fontSize:"clamp(32px,2.8vw,40px)", fontWeight:700, color:LPV7_TOKENS.green, marginBottom:4,
                  fontFamily:FONT_MONO, lineHeight:1,
                }}>{c.result}</div>
                <div style={{ fontSize:14, color:LPV7_TOKENS.text, fontWeight:600, marginBottom:14 }}>
                  {c.resultLabel}
                </div>
                <p style={{ ...TYPE.bodySm, color:LPV7_TOKENS.sub, margin:"0 0 16px", paddingTop:14, borderTop:`1px solid ${LPV7_TOKENS.border}` }}>
                  {c.detail}
                </p>
                {/* Quote */}
                <div style={{ flex:1, background:"rgba(255,255,255,.025)", borderRadius:12, padding:"12px 14px", marginBottom:16, borderLeft:`3px solid ${LPV7_TOKENS.green}` }}>
                  <p style={{ fontSize:13, color:LPV7_TOKENS.sub, lineHeight:1.6, margin:"0 0 8px", fontStyle:"italic" }}>"{c.quote}"</p>
                  <span style={{ fontSize:11.5, color:LPV7_TOKENS.muted, fontWeight:600 }}>— {c.quoteName}</span>
                </div>
                {/* CTA */}
                <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer"
                  style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                    padding:"10px 0", borderRadius:10, fontSize:13.5, fontWeight:600,
                    color:LPV7_TOKENS.indigo, border:`1px solid rgba(129,140,248,.25)`,
                    background:"rgba(129,140,248,.06)", textDecoration:"none",
                    transition:"background .2s, border-color .2s",
                  }}
                  onMouseEnter={e=>{ e.currentTarget.style.background="rgba(129,140,248,.12)"; e.currentTarget.style.borderColor="rgba(129,140,248,.4)"; }}
                  onMouseLeave={e=>{ e.currentTarget.style.background="rgba(129,140,248,.06)"; e.currentTarget.style.borderColor="rgba(129,140,248,.25)"; }}>
                  {ar ? "احجز عرضاً مشابهاً ←" : "Get similar results →"}
                </a>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
      <style>{`@media(max-width:860px){.lp-cases-grid{grid-template-columns:1fr!important}}`}</style>
    </section>
  );
}

// ── Pricing ───────────────────────────────────────────────────────
function Pricing({ lang, onCTA, mode: modeProp, isEgypt, setCurrencyOverride }) {
  const ar = lang === "ar";
  const [billing, setBilling] = useState("yearly");
  const [priceVis, setPriceVis] = useState(true);
  const toggleBilling = (b) => { setPriceVis(false); setTimeout(() => { setBilling(b); setPriceVis(true); }, 140); };
  const [localMode, setLocalMode] = useState(modeProp || "company");

  // Sync if parent changes mode (e.g. nav toggle)
  // Only sync from parent when parent explicitly changes (not on initial render)
  const prevModeProp = useRef(modeProp);
  useEffect(() => {
    if (modeProp && modeProp !== prevModeProp.current) {
      prevModeProp.current = modeProp;
      setLocalMode(modeProp);
    }
  }, [modeProp]);

  const isCompany = localMode === "company";

  // ── Single source of truth — MUST match App.jsx TIERS/B2B_TIERS,
  //    Billing.jsx PLANS/B2B_PLANS, and PricingPage.jsx exactly ──
  const b2cPlans = [
    {
      id:"free", name: ar?"مجاني":"Free",
      priceUSD:{ monthly:0, yearly:0 }, priceEGP:{ monthly:0, yearly:0 },
      color:LPV7_TOKENS.muted,
      features: ar
        ? ["5 جلسات / شهر","مدرب AI (5 رسائل/يوم)","لوحة نتائج أساسية","سجل 7 أيام"]
        : ["5 sessions / month","AI Coach (5 msgs/day)","Basic score dashboard","7-day history"],
    },
    {
      id:"basic", name: ar?"أساسي":"Basic",
      priceUSD:{ monthly:9.99, yearly:95.9 }, priceEGP:{ monthly:199, yearly:1910 },
      color:LPV7_TOKENS.sub,
      features: ar
        ? ["جلسات غير محدودة","مدرب AI (غير محدود)","سجل 90 يوم","تقارير أسبوعية","تصدير CSV/PDF","دعم بريد إلكتروني"]
        : ["Unlimited sessions","AI Coach (unlimited)","90-day history","Weekly reports","Export CSV/PDF","Email support"],
    },
    {
      id:"professional", name: ar?"احترافي":"Pro",
      priceUSD:{ monthly:19.99, yearly:191.9 }, priceEGP:{ monthly:399, yearly:3830 },
      popular:true, color:LPV7_TOKENS.blue,
      features: ar
        ? ["كل Basic","رؤى AI متقدمة","مقارنة الجلسات","تنبيهات الشذوذ","برامج تمدد مخصصة","دعم أولوية"]
        : ["Everything in Basic","Advanced AI insights","Session compare","Anomaly alerts","Custom stretch programs","Priority support"],
    },
    {
      id:"elite", name: ar?"إيليت":"Elite",
      priceUSD:{ monthly:39.99, yearly:383.9 }, priceEGP:{ monthly:699, yearly:6710 },
      color:LPV7_TOKENS.green,
      features: ar
        ? ["كل Pro","AI تنبؤي","تقرير PDF سريري","معايرة متقدمة","سرد الجلسة","وصول مبكر للمميزات"]
        : ["Everything in Pro","Predictive AI","Clinical PDF report","Advanced calibration","Session narrative","Early feature access"],
    },
  ];

  const b2bPlans = [
    {
      id:"b2b_starter", name: ar?"ستارتر":"Starter",
      priceUSD:{ monthly:5, yearly:48 }, priceEGP:{ monthly:249, yearly:2390 },
      perUser:true, color:LPV7_TOKENS.sub,
      features: ar
        ? ["10–100 موظف","لوحة HR","إدارة الأقسام","تقارير أسبوعية تلقائية","تنبيهات Slack/Teams","استيراد CSV","وصول API"]
        : ["10–100 employees","HR dashboard","Department management","Weekly auto-reports","Slack/Teams alerts","CSV import","API access"],
    },
    {
      id:"b2b_business", name: ar?"بيزنس":"Business",
      priceUSD:{ monthly:8, yearly:77 }, priceEGP:{ monthly:399, yearly:3830 },
      perUser:true, popular:true, color:LPV7_TOKENS.blue,
      features: ar
        ? ["10–5,000 موظف","كل Team","SSO / SAML 2.0","عتبات مخاطرة مخصصة","موصلات SAP / Workday","تأهيل مخصص","SLA 99.9%"]
        : ["10–5,000 employees","Everything in Team","SSO / SAML 2.0","Custom risk thresholds","SAP / Workday connectors","Dedicated onboarding","SLA 99.9%"],
    },
    {
      id:"b2b_enterprise", name: ar?"إنتربرايز":"Enterprise",
      priceUSD:{ monthly:null, yearly:null }, priceEGP:{ monthly:null, yearly:null },
      isEnterprise:true, color:LPV7_TOKENS.green,
      features: ar
        ? ["موظفون غير محدودون","كل Business","خيار on-premise","SLA مخصص","مدير نجاح مخصص","تسعير مخصص","حزمة قانونية"]
        : ["Unlimited employees","Everything in Business","On-premise option","Custom SLA","Dedicated CSM","Volume pricing","Legal & compliance pack"],
    },
  ];

  const plans = isCompany ? b2bPlans : b2cPlans;

  return (
    <section id="pricing" className="lp-section" style={{ background:LPV7_TOKENS.bg1 }}>
      <div className="lp-wrap">
        <Reveal>
          <div style={{ textAlign:"center", marginBottom:48 }}>
            <h2 style={{ ...TYPE.h2, color:LPV7_TOKENS.text, margin:"0 0 16px", fontFamily:FONT_DISPLAY }}>
              {ar ? "أسعار بسيطة وشفافة" : "Simple, transparent pricing"}
            </h2>
            <p style={{ ...TYPE.body, color:LPV7_TOKENS.sub, marginBottom:30 }}>
              {ar ? "تجربة مجانية 7 أيام · لا بطاقة ائتمان" : "7-day free trial · No credit card required"}
            </p>

            {/* Individual / Company toggle */}
            <div style={{
              display:"inline-flex", alignItems:"center", gap:4,
              background:"rgba(255,255,255,.06)", borderRadius:12,
              padding:4, border:`1px solid ${LPV7_TOKENS.border}`,
              marginBottom:20,
            }}>
              {[
                { id:"individual", icon:"👤", en:"Individual", ar:"فرد" },
                { id:"company",    icon:"🏢", en:"Company / HR", ar:"شركة / HR" },
              ].map(seg => (
                <button key={seg.id} onClick={() => setLocalMode(seg.id)} style={{
                  background: localMode === seg.id
                    ? (seg.id === "company" ? LPV7_TOKENS.indigo : LPV7_TOKENS.blue)
                    : "transparent",
                  color: localMode === seg.id ? "#fff" : LPV7_TOKENS.muted,
                  border:"none", borderRadius:9,
                  padding:"9px 22px",
                  cursor:"pointer", fontWeight:600, fontSize:14,
                  transition:"background .18s,color .18s",
                  whiteSpace:"nowrap",
                }}>
                  {seg.icon} {ar ? seg.ar : seg.en}
                </button>
              ))}
            </div>

            {/* Monthly / Yearly toggle */}
            <div style={{
              display:"inline-flex", alignItems:"center",
              background:"rgba(255,255,255,.05)", borderRadius:100,
              padding:4, border:`1px solid ${LPV7_TOKENS.border}`,
            }}>
              {["monthly","yearly"].map(b => (
                <button key={b} onClick={() => toggleBilling(b)} style={{
                  background: billing === b ? LPV7_TOKENS.blue : "transparent",
                  color: billing === b ? "#fff" : LPV7_TOKENS.sub,
                  border:"none", borderRadius:100, padding:"10px 22px",
                  cursor:"pointer", fontWeight:500, fontSize:14.5,
                  transition:"background .2s,color .2s",
                }}>
                  {b === "monthly"
                    ? (ar ? "شهري" : "Monthly")
                    : (ar ? "سنوي (وفّر 20%)" : "Yearly (save 20%)")}
                </button>
              ))}
            </div>

            <div style={{ marginTop:16, fontSize:13, color:LPV7_TOKENS.muted }}>
              {isEgypt
                ? (ar ? "🇪🇬 الأسعار معروضة بالجنيه المصري" : "🇪🇬 Prices shown in EGP")
                : (ar ? "🌍 الأسعار معروضة بالدولار الأمريكي" : "🌍 Prices shown in USD")}
              {" · "}
              <button onClick={() => setCurrencyOverride(isEgypt ? "USD" : "EGP")} style={{
                background:"none", border:"none", color:LPV7_TOKENS.indigo, cursor:"pointer",
                fontSize:13, textDecoration:"underline", padding:0, fontFamily:"inherit",
              }}>
                {isEgypt
                  ? (ar ? "اعرض بالدولار" : "Show in USD")
                  : (ar ? "اعرض بالجنيه" : "Show in EGP")}
              </button>
            </div>
          </div>
        </Reveal>

        <Stagger className="lp-pricing-grid" style={{ alignItems:"start", opacity:priceVis?1:0, transition:"opacity 140ms ease" }}>
          {plans.map((p) => (
            <StaggerItem key={p.id}>
              <div className={p.popular ? "lp-lift lp-glow lp-popular-card" : "lp-lift"} style={{
                ...card(p.popular),
                border: p.popular ? `1px solid rgba(79,124,249,.45)` : `1px solid ${LPV7_TOKENS.border}`,
                position:"relative", height:"100%", display:"flex", flexDirection:"column",
                padding:"clamp(28px,2.6vw,36px)",
                transform: p.popular ? "scale(1.035)" : "none",
              }}>
                {p.popular && (
                  <div style={{
                    position:"absolute", top:-14, left:"50%", transform:"translateX(-50%)",
                    background:LPV7_TOKENS.gBlue, color:"#fff", borderRadius:100,
                    padding:"5px 18px", fontSize:12.5, fontWeight:600, whiteSpace:"nowrap",
                    boxShadow:"0 4px 16px rgba(79,124,249,.5)",
                  }}>{ar ? "✦ الأكثر شيوعاً" : "✦ Most Popular"}</div>
                )}
                <div style={{ marginBottom:24 }}>
                  <div style={{ fontSize:13.5, color:p.color, fontWeight:600,
                    marginBottom:10, textTransform:"uppercase", letterSpacing:".06em",
                    display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                    {p.name}
                    {p.perUser && (
                      <span style={{ fontSize:10, fontWeight:700, color:"#60a5fa",
                        background:"rgba(96,165,250,.12)", borderRadius:99, padding:"2px 7px",
                        textTransform:"none", letterSpacing:0 }}>
                        {ar?"لكل مستخدم":"per user"}
                      </span>
                    )}
                  </div>
                  {p.isEnterprise ? (
                    <div>
                      <div style={{ fontSize:32, fontWeight:800, color:LPV7_TOKENS.text, fontFamily:FONT_DISPLAY }}>
                        {ar ? "تواصل معنا" : "Contact us"}
                      </div>
                      {p.priceUSD?.startingAt && (
                        <div style={{ fontSize:12.5, color:LPV7_TOKENS.muted, marginTop:6, fontFamily:FONT_MONO }}>
                          {ar ? `يبدأ من $${p.priceUSD.startingAt}/شهر` : `Starting at $${p.priceUSD.startingAt}/mo`}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      {isEgypt ? (
                        <>
                          <div style={{ display:"flex", alignItems:"baseline", gap:6, flexWrap:"wrap" }}>
                            <span style={{ fontSize:40, fontWeight:800, color:LPV7_TOKENS.text, fontFamily:FONT_MONO, letterSpacing:"-.02em" }}>
                              {billing==="monthly"
                                ? (p.priceEGP.monthly ?? 0).toLocaleString()
                                : p.priceEGP.yearly
                                  ? Math.round(p.priceEGP.yearly/12).toLocaleString()
                                  : (p.priceEGP.monthly ?? 0).toLocaleString()}
                            </span>
                            <span style={{ fontSize:14.5, color:LPV7_TOKENS.muted }}>
                              {p.perUser ? (ar ? "ج.م./مستخدم/شهر" : "EGP/user/mo") : (ar ? "ج.م./شهر" : "EGP/mo")}
                            </span>
                          </div>
                          {billing==="yearly" && p.priceEGP.yearly && (
                            <div style={{ fontSize:12.5, color:LPV7_TOKENS.muted, marginTop:6, fontFamily:FONT_MONO }}>
                              {(p.priceEGP.yearly).toLocaleString()} {ar?"سنوياً":"EGP/yr"}
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div style={{ display:"flex", alignItems:"baseline", gap:6, flexWrap:"wrap" }}>
                            <span style={{ fontSize:40, fontWeight:800, color:LPV7_TOKENS.text, fontFamily:FONT_MONO, letterSpacing:"-.02em" }}>
                              ${p.priceUSD[billing] ?? p.priceUSD.monthly ?? "—"}
                            </span>
                            <span style={{ fontSize:14.5, color:LPV7_TOKENS.muted }}>
                              {p.perUser ? (ar ? "/مستخدم/شهر" : "/user/mo") : (ar ? "/شهر" : "/mo")}
                            </span>
                          </div>
                          {p.priceEGP.yearly || p.priceEGP.monthly ? (
                            <div style={{ fontSize:12.5, color:LPV7_TOKENS.muted, marginTop:6, fontFamily:FONT_MONO }}>
                              ≈ {billing==="monthly" || !p.priceEGP.yearly
                                ? (p.priceEGP.monthly ?? 0).toLocaleString()
                                : Math.round(p.priceEGP.yearly/12).toLocaleString()
                              } {ar ? "ج.م./شهر" : "EGP/mo"}
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  )}
                </div>

                <ul style={{ listStyle:"none", padding:0, margin:"0 0 28px", flex:1 }}>
                  {p.features.map(f => (
                    <li key={f} style={{ display:"flex", gap:10, alignItems:"flex-start",
                      marginBottom:12, fontSize:14.5, color:LPV7_TOKENS.sub }}>
                      <span style={{
                        width:18, height:18, borderRadius:"50%", flexShrink:0, marginTop:1,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        background:"rgba(255,255,255,.08)",
                        color:p.color, fontSize:11, fontWeight:700,
                      }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                {p.isEnterprise ? (
                  <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-outline"
                    style={{ ...btn("outline","lg"), display:"flex", width:"100%" }}>
                    {ar ? "احجز عرضاً" : "Book a Demo"}
                  </a>
                ) : (
                  <a href={`/auth?mode=signup&plan=${p.id}`} onClick={onCTA}
                    className={p.popular ? "lp-btn lp-btn-primary" : "lp-btn lp-btn-ghost"}
                    style={{ ...(p.popular ? btn("primary","lg") : btn("ghost","lg")),
                      display:"flex", width:"100%" }}>
                    {ar ? "ابدأ الآن" : "Get started"}
                  </a>
                )}
              </div>
            </StaggerItem>
          ))}
        </Stagger>

        {/* ── Feature Comparison Table — switches with isCompany ─────────── */}
        {(()=>{
          const COLS = isCompany ? [
            { key:"starter",    label:"Starter",    color:"#8896ac" },
            { key:"business",   label:"Business",   color:"#6366f1", popular:true },
            { key:"enterprise", label:"Enterprise", color:"#f59e0b" },
          ] : [
            { key:"free",  label:ar?"مجاني":"Free",   color:"#8896ac" },
            { key:"basic", label:"Basic",              color:"#1a56db" },
            { key:"pro",   label:"Pro",                color:"#6366f1", popular:true },
            { key:"elite", label:"Elite",              color:"#f59e0b" },
          ];
          const B2B_GROUPS = [
            {
              en:"Core HR",ar:"الأساسيات",
              rows:[
                { en:"Employees",            ar:"الموظفون",              starter:"10–100",         business:"10–5,000",    enterprise:ar?"غير محدود":"Unlimited" },
                { en:"HR Dashboard",         ar:"لوحة HR",               starter:"✅",              business:"✅",           enterprise:"✅" },
                { en:"Department Mgmt",      ar:"إدارة الأقسام",         starter:"✅",              business:"✅",           enterprise:"✅" },
                { en:"Auto Weekly Reports",  ar:"تقارير أسبوعية تلقائية",starter:"✅",              business:"✅",           enterprise:"✅" },
                { en:"Employee Invites",     ar:"دعوة الموظفين",         starter:"✅",              business:"✅",           enterprise:"✅" },
                { en:"CSV Import",           ar:"استيراد CSV",           starter:"✅",              business:"✅",           enterprise:"✅" },
              ],
            },
            {
              en:"Analytics & AI",ar:"التحليلات والذكاء الاصطناعي",
              rows:[
                { en:"Workforce Analytics",  ar:"تحليلات القوى العاملة",  starter:"—",              business:"✅",           enterprise:"✅" },
                { en:"Pain Prediction",      ar:"توقع الألم",             starter:"—",              business:"✅",           enterprise:"✅" },
                { en:"Churn Prediction",     ar:"توقع الإنهاء",           starter:"—",              business:"✅",           enterprise:"✅" },
                { en:"AI Executive Summary", ar:"ملخص AI تنفيذي",         starter:"—",              business:"✅",           enterprise:"✅" },
                { en:"Quarterly PDF Report", ar:"تقرير PDF ربع سنوي",    starter:"—",              business:ar?"إضافي":"Add-on",enterprise:"✅" },
              ],
            },
            {
              en:"Integrations",ar:"التكاملات",
              rows:[
                { en:"Slack / Teams Alerts", ar:"تنبيهات Slack/Teams",   starter:"✅",              business:"✅",           enterprise:"✅" },
                { en:"API Access",           ar:"وصول API",               starter:"✅",              business:"✅",           enterprise:"✅" },
                { en:"SSO / SAML 2.0",       ar:"تسجيل دخول موحد",        starter:"—",              business:"✅",           enterprise:"✅" },
                { en:"SAP / Workday",        ar:"تكامل SAP/Workday",      starter:"—",              business:"✅",           enterprise:"✅" },
                { en:"On-Premise Option",    ar:"خيار On-Premise",        starter:"—",              business:"—",           enterprise:"✅" },
              ],
            },
            {
              en:"Support & SLA",ar:"الدعم والـ SLA",
              rows:[
                { en:"Uptime SLA",           ar:"اتفاقية التشغيل",        starter:ar?"معياري":"Standard",business:"99.9%",   enterprise:ar?"مخصص":"Custom" },
                { en:"Support Channel",      ar:"قناة الدعم",             starter:ar?"إيميل":"Email",   business:ar?"أولوية":"Priority",enterprise:ar?"مدير مخصص":"Dedicated CSM" },
                { en:"Onboarding",           ar:"التأهيل",                 starter:"—",              business:"✅",           enterprise:ar?"مخصص":"White-glove" },
              ],
            },
          ];

          const GROUPS = isCompany ? B2B_GROUPS : [
            {
              en:"Core",ar:"الأساسيات",
              rows:[
                { en:"Sessions",            ar:"الجلسات",               free:ar?"5/شهر":"5/mo",   basic:"∞", pro:"∞", elite:"∞" },
                { en:"Posture Score",        ar:"درجة الوضعية",          free:"✅", basic:"✅", pro:"✅", elite:"✅" },
                { en:"Demo Session",         ar:"جلسة تجريبية",          free:"✅", basic:"—",  pro:"—",  elite:"—" },
                { en:"Sessions Countdown",   ar:"عداد الجلسات",          free:"✅", basic:"—",  pro:"—",  elite:"—" },
                { en:"Pain Self-Report",     ar:"تقرير الألم الذاتي",    free:"✅", basic:"✅", pro:"✅", elite:"✅" },
                { en:"First Session Badge",  ar:"شارة الجلسة الأولى",   free:"✅", basic:"✅", pro:"✅", elite:"✅" },
                { en:"Weekly Email Report",  ar:"تقرير أسبوعي (إيميل)", free:"✅", basic:"✅", pro:"✅", elite:"✅" },
              ],
            },
            {
              en:"Basic Habits",ar:"عادات Basic",
              rows:[
                { en:"Daily Check-in",       ar:"تسجيل يومي",           free:"—", basic:"✅", pro:"✅", elite:"✅" },
                { en:"Weekly Challenge",     ar:"تحدي أسبوعي",          free:"—", basic:"✅", pro:"✅", elite:"✅" },
                { en:"Pain Prediction Card", ar:"بطاقة توقع الألم",     free:"—", basic:"✅", pro:"✅", elite:"✅" },
                { en:"Streak Freeze",        ar:"تجميد الـ Streak",      free:"—", basic:"✅", pro:"✅", elite:"✅" },
                { en:"Posture Habit Score",  ar:"درجة عادة الوضعية",    free:"—", basic:"✅", pro:"✅", elite:"✅" },
                { en:"WhatsApp Reminders",   ar:"تذكيرات واتساب",       free:"—", basic:"✅", pro:"✅", elite:"✅" },
                { en:"AI Coach",             ar:"مدرب AI",               free:"—", basic:ar?"10 رسائل/شهر":"10 msgs/mo", pro:ar?"30 رسائل/شهر":"30 msgs/mo", elite:ar?"غير محدود":"Unlimited" },
              ],
            },
            {
              en:"Pro Intelligence",ar:"ذكاء Pro",
              rows:[
                { en:"Weekly Intelligence Report", ar:"تقرير ذكاء أسبوعي",         free:"—", basic:"—", pro:"✅", elite:"✅" },
                { en:"Shareable PDF Report",        ar:"تقرير PDF قابل للمشاركة",  free:"—", basic:"—", pro:"✅", elite:"✅" },
                { en:"Body Heatmap",                ar:"خريطة حرارة الجسم",         free:"—", basic:"—", pro:"✅", elite:"✅" },
                { en:"Focus Mode Integration",      ar:"تكامل وضع التركيز",         free:"—", basic:"—", pro:"✅", elite:"✅" },
                { en:"Custom Alert Rules",          ar:"قواعد تنبيه مخصصة",         free:"—", basic:"—", pro:"✅", elite:"✅" },
                { en:"Family / Partner Mode (+1)",  ar:"وضع الأسرة (+1)",           free:"—", basic:"—", pro:"✅", elite:"✅" },
              ],
            },
            {
              en:"Elite Exclusive",ar:"حصري Elite",
              rows:[
                { en:"Predictive AI (detailed)",     ar:"ذكاء اصطناعي تنبؤي تفصيلي", free:"—", basic:"—", pro:"—", elite:"✅" },
                { en:"Voice Coach (Arabic)",          ar:"مدرب صوتي عربي",             free:"—", basic:"—", pro:"—", elite:"✅" },
                { en:"Monthly Physiotherapist",       ar:"أخصائي علاج طبيعي شهري",    free:"—", basic:"—", pro:"—", elite:"✅" },
                { en:"Posture DNA Report (quarterly)",ar:"تقرير Posture DNA (ربع سنوي)",free:"—",basic:"—",pro:"—", elite:"✅" },
                { en:"Priority WhatsApp Support",     ar:"دعم واتساب أولوية",          free:"—", basic:"—", pro:"—", elite:"✅" },
                { en:"Elite Early Access",            ar:"وصول مبكر Elite",            free:"—", basic:"—", pro:"—", elite:"✅" },
              ],
            },
          ]; // end B2C GROUPS

          const cell = (val, colColor) => {
            if(val==="✅") return <span style={{color:"#10b981",fontSize:16}}>✓</span>;
            if(val==="—")  return <span style={{color:"#334155",fontSize:14}}>—</span>;
            return <span style={{color:colColor||"#94a3b8",fontSize:12.5,fontWeight:600}}>{val}</span>;
          };

          return (
            <div style={{marginTop:56}}>
              <div style={{textAlign:"center",marginBottom:28}}>
                <h3 style={{fontSize:22,fontWeight:800,color:LPV7_TOKENS.text,margin:"0 0 8px",fontFamily:FONT_DISPLAY}}>
                  {ar?"قارن كل المميزات":"Compare all features"}
                </h3>
                <p style={{fontSize:13.5,color:LPV7_TOKENS.muted,margin:0}}>
                  {ar?"كل ما تحتاجه في مكان واحد":"Everything you need, side by side"}
                </p>
              </div>

              {/* scrollable wrapper for mobile */}
              <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch",borderRadius:18,border:`1px solid ${LPV7_TOKENS.border}`}}>
                <table style={{width:"100%",minWidth:580,borderCollapse:"collapse",background:LPV7_TOKENS.card}}>
                  {/* sticky header */}
                  <thead>
                    <tr>
                      <th style={{
                        padding:"16px 18px",textAlign:ar?"right":"left",
                        fontSize:12,fontWeight:600,color:LPV7_TOKENS.muted,
                        background:LPV7_TOKENS.card,borderBottom:`1px solid ${LPV7_TOKENS.border}`,
                        width:"38%",
                      }}>
                        {ar?"الميزة":"Feature"}
                      </th>
                      {COLS.map(c=>(
                        <th key={c.key} style={{
                          padding:"16px 12px",textAlign:"center",
                          fontSize:13,fontWeight:700,color:c.color,
                          background: c.popular ? `${c.color}12` : LPV7_TOKENS.card,
                          borderBottom:`1px solid ${LPV7_TOKENS.border}`,
                          borderInlineStart: c.popular ? `2px solid ${c.color}55` : "none",
                          borderInlineEnd:   c.popular ? `2px solid ${c.color}55` : "none",
                          whiteSpace:"nowrap",
                        }}>
                          {c.popular && <div style={{fontSize:9,fontWeight:700,color:c.color,letterSpacing:".05em",marginBottom:3,opacity:.8}}>
                            {ar?"الأكثر شيوعاً":"POPULAR"}
                          </div>}
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {GROUPS.map((g,gi)=>(
                      <>
                        {/* group header row */}
                        <tr key={`g${gi}`}>
                          <td colSpan={COLS.length + 1} style={{
                            padding:"10px 18px 6px",
                            fontSize:10.5,fontWeight:700,color:LPV7_TOKENS.muted,
                            letterSpacing:".08em",textTransform:"uppercase",
                            background:`rgba(255,255,255,.025)`,
                            borderTop: gi>0?`1px solid ${LPV7_TOKENS.border}`:"none",
                          }}>
                            {ar?g.ar:g.en}
                          </td>
                        </tr>

                        {g.rows.map((row,ri)=>(
                          <tr key={`${gi}-${ri}`} style={{
                            background: ri%2===1 ? "rgba(255,255,255,.018)" : "transparent",
                          }}>
                            <td style={{
                              padding:"11px 18px",
                              fontSize:13.5,color:LPV7_TOKENS.sub,
                              borderBottom:`1px solid rgba(255,255,255,.04)`,
                              textAlign:ar?"right":"left",
                            }}>
                              {ar?row.ar:row.en}
                            </td>
                            {COLS.map(c=>(
                              <td key={c.key} style={{
                                padding:"11px 12px",textAlign:"center",
                                borderBottom:`1px solid rgba(255,255,255,.04)`,
                                background: c.popular ? `${c.color}08` : "transparent",
                                borderInlineStart: c.popular ? `2px solid ${c.color}30` : "none",
                                borderInlineEnd:   c.popular ? `2px solid ${c.color}30` : "none",
                              }}>
                                {cell(row[c.key], c.color)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* CTA under table */}
              <div style={{textAlign:"center",marginTop:28,display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
                {!isCompany && (
                  <a href="/auth?mode=signup" onClick={onCTA}
                    className="lp-btn lp-btn-primary"
                    style={{...btn("primary","md"),minWidth:180}}>
                    {ar?"ابدأ تجربتك المجانية":"Start your free trial"}
                  </a>
                )}
                <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer"
                  className={isCompany?"lp-btn lp-btn-primary":"lp-btn lp-btn-ghost"}
                  style={{...(isCompany?btn("primary","md"):btn("ghost","md")),minWidth:180}}>
                  {ar?"احجز عرضاً للشركات":"Book enterprise demo"}
                </a>
              </div>
            </div>
          );
        })()}

      </div>
      <style>{`
        @media(max-width:600px){.lp-pricing-grid{grid-template-columns:1fr!important}
        .lp-pricing-grid > div > div{transform:none!important}}
        .lp-pricing-card{contain:layout style;}`}</style>
    </section>
  );
}

// ── Testimonials ──────────────────────────────────────────────────
function Testimonials({ lang }) {
  const ar = lang === "ar";
  const testimonials = ar ? [
    { name:"س.م.", initials:"سم", role:"مهندسة برمجيات أولى", company:"شركة اتصالات كبرى", text:"كنت بعاني من آلام رقبة كل يوم بعد 8 ساعات شغل. بعد أسبوعين من Corvus، الألم راح تقريباً. أوضح ROI على أداة اشتريتها.", score:"5/5", outcome:"آلام الرقبة انتهت في أسبوعين", color:"#818cf8" },
    { name:"أ.ك.", initials:"أك", role:"مدير موارد بشرية", company:"شركة تكنولوجيا متوسطة", text:"جربنا 3 أدوات قبل Corvus. دي الأولى اللي الفريق بيستخدمها فعلاً. الـ AI coach بيعمل فرق حقيقي ومش مجرد رقم على شاشة.", score:"4.9/5", outcome:"أعلى adoption rate من 3 أدوات", color:"#22d3ee" },
    { name:"ي.ح.", initials:"يح", role:"مديرة تقنية", company:"شركة مدفوعات رقمية", text:"الإعداد خلص في 20 دقيقة. الدقة في تتبع وضعية الرقبة أعلى من أي أداة جربتها. التقارير الأسبوعية مفيدة للتتبع.", score:"4.8/5", outcome:"إعداد كامل في 20 دقيقة", color:"#10d9a0" },
  ] : [
    { name:"S.M.", initials:"SM", role:"Senior Software Engineer", company:"Major Telecom Company", text:"I had neck pain daily after 8-hour work sessions. Two weeks with Corvus and it's nearly gone. Clearest ROI of any tool I've bought.", score:"5/5", outcome:"Neck pain gone in 2 weeks", color:"#818cf8" },
    { name:"A.K.", initials:"AK", role:"HR Director", company:"Mid-size Tech Company", text:"We tried 3 tools before Corvus. This is the first one the team actually uses. The AI coach makes a real difference — not just a number on a screen.", score:"4.9/5", outcome:"Highest adoption of 3 tools tested", color:"#22d3ee" },
    { name:"Y.H.", initials:"YH", role:"Chief Technology Officer", company:"Digital Payments Company", text:"Setup took 20 minutes. Neck posture tracking accuracy is higher than any tool I've tested. Weekly reports are genuinely useful for tracking progress.", score:"4.8/5", outcome:"Full team setup in 20 min", color:"#10d9a0" },
  ];

  return (
    <section id="testimonials" className="lp-section">
      <div className="lp-wrap">
        <SectionHead
          eyebrow={ar ? "آراء العملاء" : "Real results"}
          title={ar ? "ماذا يقول عملاؤنا" : "What our customers say"}
          sub={ar ? "نتائج حقيقية من مستخدمين حقيقيين في مصر والخليج" : "Real results from real users across Egypt and the Gulf"}
        />
        <Stagger className="lp-testi-grid">
          {testimonials.map((t) => (
            <StaggerItem key={t.name}>
              <div className="lp-lift" style={{
                height:"100%", borderRadius:20, padding:28, position:"relative",
                background:"rgba(255,255,255,.035)", border:`1px solid ${LPV7_TOKENS.border}`,
                display:"flex", flexDirection:"column",
              }}>
                {/* Quote mark */}
                <div style={{ position:"absolute", top:20, [ar?"left":"right"]:24,
                  fontSize:44, color:"rgba(79,124,249,.14)", fontFamily:"Georgia,serif", lineHeight:1 }}>"</div>
                {/* Outcome badge */}
                <div style={{ display:"inline-flex", alignItems:"center", gap:6,
                  background:"rgba(16,217,160,.08)", border:"1px solid rgba(16,217,160,.2)",
                  borderRadius:99, padding:"4px 11px", marginBottom:14, alignSelf:"flex-start" }}>
                  <span style={{ width:5, height:5, borderRadius:"50%", background:LPV7_TOKENS.green, flexShrink:0 }}/>
                  <span style={{ fontSize:11, color:LPV7_TOKENS.green, fontWeight:600 }}>{t.outcome}</span>
                </div>
                {/* Stars */}
                <div style={{ display:"flex", gap:2, marginBottom:14 }}>
                  {"★★★★★".split("").map((s,i) => (
                    <span key={i} style={{ color:LPV7_TOKENS.amber, fontSize:14 }}>{s}</span>
                  ))}
                  <span style={{ color:LPV7_TOKENS.muted, fontSize:11.5, marginInlineStart:8, fontFamily:FONT_MONO }}>{t.score}</span>
                </div>
                {/* Text */}
                <p style={{ fontSize:15, color:LPV7_TOKENS.sub, lineHeight:1.7, margin:"0 0 22px", flex:1 }}>"{t.text}"</p>
                {/* Author */}
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{
                    width:44, height:44, borderRadius:"50%", flexShrink:0,
                    background:`linear-gradient(135deg, ${t.color}40, ${t.color}18)`,
                    border:`1.5px solid ${t.color}50`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:13, fontWeight:800, color:t.color, letterSpacing:".5px",
                  }}>{t.initials}</div>
                  <div style={{flex:1}}>
                    <div style={{ fontWeight:700, color:LPV7_TOKENS.text, fontSize:14 }}>{t.name}</div>
                    <div style={{ color:LPV7_TOKENS.muted, fontSize:11.5, marginTop:1 }}>{t.role}</div>
                    <div style={{ color:t.color, fontSize:11, marginTop:2, fontWeight:600, opacity:.8 }}>{t.company}</div>
                  </div>
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

// ── FAQ ───────────────────────────────────────────────────────────
function FAQItem({ q, a, isOpen, onToggle, ar }) {
  return (
    <div style={{
      background:LPV7_TOKENS.card, border:`1px solid ${isOpen ? "rgba(79,124,249,.35)" : LPV7_TOKENS.border}`,
      borderRadius:16, overflow:"hidden", transition:"border-color .25s",
    }}>
      <button onClick={onToggle} aria-expanded={isOpen} style={{
        width:"100%", padding:"20px 22px", background:"transparent",
        border:"none", cursor:"pointer",
        display:"flex", justifyContent:"space-between", alignItems:"center", gap:16,
        textAlign: ar ? "right" : "left",
      }}>
        <span style={{ fontWeight:600, color:LPV7_TOKENS.text, fontSize:15.5, flex:1, fontFamily:FONT_DISPLAY }}>{q}</span>
        <span style={{
          width:28, height:28, borderRadius:"50%", flexShrink:0,
          display:"flex", alignItems:"center", justifyContent:"center",
          background: isOpen ? "rgba(79,124,249,.18)" : "rgba(255,255,255,.05)",
          color:LPV7_TOKENS.blue, fontSize:17,
          transform: isOpen ? "rotate(45deg)" : "none",
          transition:"transform .25s, background .25s",
        }}>+</span>
      </button>
      <motion.div
        initial={false}
        animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
        transition={{ duration:.28, ease:[0.22,1,0.36,1] }}
        style={{ overflow:"hidden" }}>
        <p style={{ color:LPV7_TOKENS.sub, fontSize:15, lineHeight:1.7, margin:0, padding:"0 22px 20px" }}>{a}</p>
      </motion.div>
    </div>
  );
}

function FAQ({ lang }) {
  const ar = lang === "ar";
  const [open, setOpen] = useState(null);
  const items = ar ? [
    ["هل أحتاج كاميرا خاصة؟","لا. بيشتغل مع أي كاميرا لابتوب أو ويب كام عادية. مفيش أجهزة إضافية مطلوبة."],
    ["هل بيانات الفيديو بتاعتي بتتحفظ؟","لأ. التحليل بيحصل محلياً في المتصفح بتاعك. مش بنحفظ صور أو فيديو — بس إحداثيات الوضعية المجهولة."],
    ["هل بيشتغل على Mac وWindows؟","أيوه، بيشتغل على أي متصفح حديث — Chrome وSafari وFirefox وEdge — على Mac وWindows وLinux."],
    ["إيه الفرق بين المجاني والمدفوع؟","المجاني يديك 7 أيام كاملة من أي tier. بعدين Basic مجاناً للأبد. Pro وElite بتضيفوا AI Coach وتقارير PDF وتحليل متقدم."],
    ["هل يحتاج الموظفون لأجهزة خاصة؟","لا. بيشتغل على أي كاميرا ويب عادية على اللابتوب أو الموبايل. مفيش أجهزة إضافية."],
    ["ما وقت الإعداد المتوقع؟","15 دقيقة للأفراد. يوم واحد للفرق الكبيرة +500 موظف مع دعمنا الكامل."],
    ["هل متوافق مع SAP HR وWorkday؟","أيوه. عندنا API مفتوح ووثائق تكامل كاملة مع أشهر أنظمة HR."],
  ] : [
    ["Do I need a special camera?","No. Works with any built-in laptop camera or standard webcam. No additional hardware required."],
    ["Is my video data stored?","Never. Analysis runs locally in your browser. We don't store images or video — only anonymized posture coordinates."],
    ["Does it work on Mac and Windows?","Yes, it works in any modern browser — Chrome, Safari, Firefox, Edge — on Mac, Windows, and Linux."],
    ["What's the difference between free and paid?","Free gives you a full 7-day trial of any tier. After that, Basic is free forever. Pro and Elite add AI Coach, PDF reports, and advanced analytics."],
    ["Do employees need special hardware?","No. Works with any standard webcam on laptop or smartphone. No additional devices required."],
    ["What's the expected setup time?","15 minutes for individuals. One business day for 500+ employee teams with our full support."],
    ["Does it integrate with SAP HR and Workday?","Yes. We have an open API and complete integration documentation for major HR systems."],
  ];

  return (
    <section id="faq" className="lp-section" style={{ background:LPV7_TOKENS.bg1 }}>
      <div className="lp-wrap">
        <div style={{ maxWidth:740, margin:"0 auto" }}>
          <SectionHead title={ar ? "أسئلة شائعة" : "Frequently asked questions"} />
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {items.map(([q, a], i) => (
              <Reveal key={i} delay={i * 50} y={16}>
                <FAQItem q={q} a={a} ar={ar} isOpen={open===i} onToggle={() => setOpen(open===i ? null : i)}/>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Mid-page CTA
function MidCTA({ lang, onCTA, variant="features" }) {
  const ar = lang === "ar";
  const msgs = {
    features: {
      en: { h:"Seen enough? Start free in 60 seconds.", sub:"No credit card · Works in your browser · Cancel anytime", cta:"Start Free Trial →" },
      ar: { h:"شفت كفاية؟ ابدأ مجاناً في 60 ثانية.", sub:"بدون بطاقة · في المتصفح · إلغاء في أي وقت", cta:"ابدأ مجاناً ←" },
    },
    cases: {
      en: { h:"Join 50+ teams improving posture with AI.", sub:"7-day free trial, full access, no commitment.", cta:"Try Corvus Free →" },
      ar: { h:"انضم لـ 50+ فريق بيحسّن الوضعية بالـ AI.", sub:"تجربة مجانية 7 أيام، وصول كامل، بدون التزام.", cta:"جرّب Corvus مجاناً ←" },
    },
  };
  const m = (msgs[variant]||msgs.features)[ar?"ar":"en"];
  return (
    <div style={{ margin:"0 0 0", padding:"0 24px" }}>
      <div className="lp-wrap">
        <div style={{
          background:"linear-gradient(120deg,rgba(79,124,249,.08),rgba(16,217,160,.04))",
          border:`1px solid rgba(79,124,249,.18)`, borderRadius:20,
          padding:"28px 32px", display:"flex", alignItems:"center",
          gap:24, flexWrap:"wrap", justifyContent:"space-between",
        }}>
          <div>
            <div style={{ fontSize:17, fontWeight:700, color:LPV7_TOKENS.text, marginBottom:5, fontFamily:FONT_DISPLAY }}>{m.h}</div>
            <div style={{ fontSize:12.5, color:LPV7_TOKENS.muted }}>{m.sub}</div>
          </div>
          <a href="#" className="lp-btn lp-btn-primary" onClick={e=>{e.preventDefault();onCTA(e);navTo("/auth?mode=signup");}}
            style={{...btn("primary","md"), whiteSpace:"nowrap", flexShrink:0}}>
            {m.cta}
          </a>
        </div>
      </div>
    </div>
  );
}

function FinalCTA({ lang, onCTA }) {
  const ar = lang === "ar";
  return (
    <section style={{ padding:"clamp(44px,6vw,80px) 16px" }}>
      <div style={{ maxWidth:760, margin:"0 auto" }}>
        <Reveal>
          <div style={{
            background:"linear-gradient(135deg,rgba(26,86,219,.12),rgba(8,145,178,.08))",
            border:`1px solid rgba(79,124,249,.22)`,
            borderRadius:24, padding:"clamp(36px,5vw,64px) clamp(20px,4vw,48px)",
            textAlign:"center",
          }}>
            <div style={{
              width:64, height:64, borderRadius:18, margin:"0 auto 22px",
              background:"linear-gradient(135deg,#1a56db,#0891b2)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:30, color:"#fff", fontWeight:800,
              boxShadow:"0 8px 28px rgba(26,86,219,.45)",
            }}>◈</div>
            <h2 style={{ ...TYPE.h2, color:LPV7_TOKENS.text, margin:"0 0 14px", fontFamily:FONT_DISPLAY,
              fontSize:"clamp(22px,3vw,34px)" }}>
              {ar ? "ابدأ تحسين صحة فريقك اليوم" : "Start improving your team's health today"}
            </h2>
            <p style={{ ...TYPE.body, color:LPV7_TOKENS.sub, maxWidth:460, margin:"0 auto 32px",
              fontSize:"clamp(14px,1.2vw,16px)" }}>
              {ar
                ? "انضم إلى الشركات التي تستخدم Corvus. تجربة مجانية 7 أيام."
                : "Join 50+ teams reducing workplace pain with AI posture coaching. 7-day free trial, no credit card."}
            </p>
            <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" }}>
              <a href="#" className="lp-btn lp-btn-primary"
                onClick={(e)=>{e.preventDefault();onCTA(e);navTo("/auth?mode=signup")}}
                style={btn("primary","lg")}>
                {ar ? "🚀 ابدأ تجربتك المجانية" : "🚀 Start Free Trial"}
              </a>
              <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer"
                className="lp-btn lp-btn-ghost" style={btn("ghost","lg")}>
                {ar ? "احجز عرضاً" : "Book Demo"}
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ── Schools Section ───────────────────────────────────────────────
function SchoolsSection({ lang, onCTA }) {
  const ar = lang === "ar";
  return (
    <section id="schools" className="lp-section" style={{ padding:"80px 0", background:"rgba(99,102,241,.04)" }}>
      <div style={{ maxWidth:1100, margin:"0 auto", padding:"0 24px" }}>
        <div style={{ textAlign:"center", marginBottom:48 }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:8,
            background:"rgba(99,102,241,.12)", borderRadius:99, padding:"6px 16px",
            fontSize:12, fontWeight:700, color:"#a5b4fc", marginBottom:16 }}>
            🎓 {ar ? "Corvus للتعليم" : "Corvus for Education"}
          </div>
          <h2 style={{ fontSize:"clamp(24px,4vw,38px)", fontWeight:900, color:"#f0f6ff",
            margin:"0 0 14px", lineHeight:1.2 }}>
            {ar ? "بنِ جيل يعرف يجلس صح" : "Build a generation that sits right"}
          </h2>
          <p style={{ fontSize:15, color:"#8896ac", maxWidth:560, margin:"0 auto", lineHeight:1.7 }}>
            {ar
              ? "سعر خاص للجامعات والمدارس — 49 جنيه للطالب شهرياً. جامعة 5,000 طالب = 245,000 جنيه recurring revenue."
              : "Special pricing for universities & schools — 49 EGP/student/month. 5,000 students = 245,000 EGP monthly recurring."}
          </p>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:20, marginBottom:48 }}>
          {[
            { icon:"⭐", en:"Full Pro features", ar:"كل مميزات Pro" },
            { icon:"🏫", en:"Academic dashboard", ar:"لوحة إدارة أكاديمية" },
            { icon:"📊", en:"Periodic wellness reports", ar:"تقارير صحية دورية" },
            { icon:"🏅", en:"Certificates for graduates", ar:"شهادات للخريجين" },
            { icon:"🤖", en:"AI Coach for students", ar:"Dr. Corvus للطلاب" },
            { icon:"📱", en:"WhatsApp support", ar:"دعم WhatsApp مخصص" },
          ].map(f => (
            <div key={f.en} style={{ background:"rgba(255,255,255,.03)",
              border:"1px solid rgba(255,255,255,.07)",
              borderRadius:12, padding:"18px 16px", display:"flex", alignItems:"center", gap:12 }}>
              <span style={{ fontSize:22 }}>{f.icon}</span>
              <span style={{ fontSize:13, color:"#8896ac" }}>{ar ? f.ar : f.en}</span>
            </div>
          ))}
        </div>

        {/* Pricing cards */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))", gap:16, marginBottom:40 }}>
          {[
            { size: ar?"500 طالب":"500 students", price:"24,500", highlight:false },
            { size: ar?"1,000 طالب":"1,000 students", price:"49,000", highlight:false },
            { size: ar?"5,000 طالب":"5,000 students", price:"245,000", highlight:true },
            { size: ar?"أكثر من 10,000":"10,000+", price:ar?"تفاوض":"Custom", highlight:false },
          ].map(c=>(
            <div key={c.size} style={{
              background: c.highlight ? "linear-gradient(135deg,rgba(99,102,241,.2),rgba(99,102,241,.06))" : "rgba(255,255,255,.03)",
              border:`1px solid ${c.highlight?"rgba(99,102,241,.4)":"rgba(255,255,255,.07)"}`,
              borderRadius:14, padding:"20px 16px", textAlign:"center" }}>
              <div style={{ fontSize:13, color:"#8896ac", marginBottom:8 }}>{c.size}</div>
              <div style={{ fontSize:22, fontWeight:900, color:c.highlight?"#a5b4fc":"#f0f6ff" }}>
                {c.price !== "Custom" && c.price !== "تفاوض" ? `${c.price}` : c.price}
              </div>
              {c.price !== "Custom" && c.price !== "تفاوض" && (
                <div style={{ fontSize:10, color:"#8896ac", marginTop:4 }}>
                  {ar ? "جنيه / شهر" : "EGP / month"}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ textAlign:"center" }}>
          <button onClick={()=>onCTA?.("schools")} style={{
            padding:"14px 36px", fontSize:15, fontWeight:800,
            background:"linear-gradient(135deg,#6366f1,#4f46e5)",
            border:"none", borderRadius:12, color:"#fff", cursor:"pointer",
            boxShadow:"0 8px 30px rgba(99,102,241,.35)" }}>
            🎓 {ar ? "احجز عرض لمؤسستك التعليمية" : "Book a Demo for Your Institution"}
          </button>
          <div style={{ fontSize:11, color:"#8896ac", marginTop:12 }}>
            {ar ? "رد خلال 24 ساعة · لا بطاقة بنكية" : "Response within 24h · No credit card"}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────
function Footer({ lang }) {
  const ar = lang === "ar";

  const cols = ar ? [
    { title:"المنتج", links:[
      { label:"المميزات",       href:"#features",     anchor:true },
      { label:"كيف يعمل",      href:"#how",          anchor:true },
      { label:"الأسعار",       href:"#pricing",      anchor:true },
      { label:"الأسئلة الشائعة", href:"#faq",         anchor:true },
    ]},
    { title:"الحلول", links:[
      { label:"فرق HR",          href:"#casestudies",  anchor:true },
      { label:"نتائج العملاء",   href:"#casestudies",  anchor:true },
      { label:"التسعير المؤسسي", href:"#pricing",      anchor:true },
      { label:"احجز عرضاً",     href:CALENDLY_URL },
    ]},
    { title:"الموارد", links:[
      { label:"شهادات العملاء",  href:"#testimonials", anchor:true },
      { label:"دراسات الحالة",  href:"#casestudies",  anchor:true },
      { label:"تواصل معنا",     href:`mailto:${SUPPORT_EMAIL}` },
      { label:"الدعم الفني",    href:`mailto:${SUPPORT_EMAIL}?subject=Support` },
    ]},
    { title:"الشركة", links:[
      { label:"من نحن",           href:`mailto:${SUPPORT_EMAIL}?subject=About Corvus` },
      { label:"الأمان والخصوصية", href:`mailto:${SUPPORT_EMAIL}?subject=Privacy` },
      { label:"شروط الاستخدام",   href:`mailto:${SUPPORT_EMAIL}?subject=Terms` },
      { label:"شراكات",          href:`mailto:${SUPPORT_EMAIL}?subject=Partnership` },
    ]},
  ] : [
    { title:"Product", links:[
      { label:"Features",     href:"#features",     anchor:true },
      { label:"How it works", href:"#how",          anchor:true },
      { label:"Pricing",      href:"#pricing",      anchor:true },
      { label:"FAQ",          href:"#faq",          anchor:true },
    ]},
    { title:"Solutions", links:[
      { label:"HR Teams",         href:"#casestudies", anchor:true },
      { label:"Customer Results", href:"#casestudies", anchor:true },
      { label:"Enterprise Plans", href:"#pricing",     anchor:true },
      { label:"For Schools",      href:"#schools",     anchor:true },
      { label:"Book a Demo",      href:CALENDLY_URL },
    ]},
    { title:"Resources", links:[
      { label:"Testimonials",  href:"#testimonials", anchor:true },
      { label:"Case Studies",  href:"#casestudies",  anchor:true },
      { label:"Contact us",    href:`mailto:${SUPPORT_EMAIL}` },
      { label:"Support",       href:`mailto:${SUPPORT_EMAIL}?subject=Support` },
    ]},
    { title:"Company", links:[
      { label:"About us",          href:`mailto:${SUPPORT_EMAIL}?subject=About Corvus` },
      { label:"Security & Privacy",href:`mailto:${SUPPORT_EMAIL}?subject=Privacy` },
      { label:"Terms of Service",  href:`mailto:${SUPPORT_EMAIL}?subject=Terms` },
      { label:"Partnerships",      href:`mailto:${SUPPORT_EMAIL}?subject=Partnership` },
    ]},
  ];

  // NOTE: social links removed — verified via web search that none of the
  // previously hardcoded LinkedIn/X/YouTube/Instagram handles correspond to
  // a real Corvus account (they 404 or belong to unrelated accounts/people).
  // Dead or wrong social links actively hurt credibility more than having
  // none. Add real handles back here once they exist.

  const scrollTo = id => {
    const el = document.getElementById(id.replace("#",""));
    if(el) el.scrollIntoView({ behavior:"smooth", block:"start" });
  };

  return (
    <footer style={{ background:"#030812", borderTop:"1px solid rgba(255,255,255,.07)" }}>
      {/* Main grid */}
      <div className="lp-wrap" style={{ padding:"56px 32px 40px" }}>
        <div className="lp-footer-grid">
          {/* Brand column */}
          <div>
            {/* Logo */}
            <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:16 }}>
              <div style={{
                width:34, height:34, borderRadius:9, flexShrink:0,
                background:"linear-gradient(135deg,#1a56db,#0891b2)",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:17, color:"#fff", fontWeight:900,
                boxShadow:"0 4px 14px rgba(26,86,219,.4)",
              }}>◈</div>
              <div style={{ lineHeight:1.2 }}>
                <div style={{ fontWeight:800, fontSize:15, color:"#f1f5f9", letterSpacing:"-.025em", fontFamily:FONT_DISPLAY }}>Corvus</div>
                <div style={{ fontSize:9, color:"#8896ac", letterSpacing:".05em", textTransform:"uppercase" }}>AI Posture Coaching</div>
              </div>
            </div>

            {/* Tagline */}
            <p style={{ fontSize:13, color:"#8896ac", lineHeight:1.8, maxWidth:200, margin:"0 0 20px" }}>
              {ar
                ? "قلّل إجازات الأمراض وارفع إنتاجية فريقك. مبني لفرق MENA."
                : "Cut sick leave 47% and boost team productivity. Built for MENA teams."}
            </p>

            {/* Social icons removed — see note above socials declaration */}

            {/* Trust badges */}
            <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginTop:18 }}>
              {["ISO 27001","AES-256","GDPR"].map(b=>(
                <span key={b} style={{
                  fontSize:9.5, color:"#8896ac", padding:"3px 8px",
                  border:"1px solid rgba(255,255,255,.07)", borderRadius:99,
                  fontFamily:FONT_MONO, fontWeight:600,
                }}>{b}</span>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {cols.map(col => (
            <div key={col.title}>
              <div style={{
                fontSize:10.5, fontWeight:700, letterSpacing:".08em",
                textTransform:"uppercase", color:"#8896ac", marginBottom:16,
              }}>{col.title}</div>
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {col.links.map(({ label, href, anchor }) => (
                  anchor
                    ? <button key={label}
                        onClick={() => scrollTo(href)}
                        style={{
                          background:"none", border:"none", padding:0, cursor:"pointer",
                          textAlign: ar ? "right" : "left", color:"#8896ac",
                          fontSize:13.5, fontWeight:400, fontFamily:"inherit",
                          transition:"color .18s",
                        }}
                        onMouseEnter={e=>e.currentTarget.style.color="#94a3b8"}
                        onMouseLeave={e=>e.currentTarget.style.color="#8896ac"}>
                        {label}
                      </button>
                    : <a key={label} href={href}
                        target={href.startsWith("http") ? "_blank" : undefined}
                        rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                        style={{ color:"#8896ac", fontSize:13.5, textDecoration:"none", transition:"color .18s" }}
                        onMouseEnter={e=>e.currentTarget.style.color="#94a3b8"}
                        onMouseLeave={e=>e.currentTarget.style.color="#8896ac"}>
                        {label}
                      </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{ borderTop:"1px solid rgba(255,255,255,.05)" }}>
        <div className="lp-wrap" style={{ padding:"18px 32px", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 }}>
          <span style={{ fontSize:12, color:"#8896ac" }}>
            © {new Date().getFullYear()} Corvus Health Intelligence.{" "}
            {ar ? "جميع الحقوق محفوظة." : "All rights reserved."}
          </span>
          <div style={{ display:"flex", gap:20, alignItems:"center" }}>
            <a href={`mailto:${SUPPORT_EMAIL}`}
              style={{ fontSize:12, color:"#8896ac", textDecoration:"none", transition:"color .18s" }}
              onMouseEnter={e=>e.currentTarget.style.color="#8896ac"}
              onMouseLeave={e=>e.currentTarget.style.color="#8896ac"}>
              {SUPPORT_EMAIL}
            </a>
            <span style={{ fontSize:11.5, color:"#8896ac" }}>
              {ar ? "صُنع بـ ❤ في مصر" : "Made with ❤ in Egypt"}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ── Root ──────────────────────────────────────────────────────────
export default function LandingPage({ onNavigate }) {
  const [lang, setLang] = useState(
    typeof navigator !== "undefined" && navigator.language.startsWith("ar") ? "ar" : "en"
  );
  // Individual vs Company — drives Hero copy + Pricing plan set across the whole page.
  // Defaults to "company" since this is primarily a B2B workforce intelligence product,
  // but individuals get an equally first-class path via the toggle.
  const [mode, setMode] = useState("company"); // "individual" | "company"

  // Real country detection (IP-based) decides which currency is primary
  // in Pricing — independent of UI language. Falls back to the language
  // heuristic if the lookup fails or hasn't resolved yet.
  const { isEgypt, setOverride } = useCurrency(lang === "ar");

  const handleCTA = useCallback(e => {
    // Track conversion click
    try { if (window.posthog) window.posthog.capture("landing_cta_click", { mode }); } catch {}
  }, [mode]);

  useEffect(() => {
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  }, [lang]);

  // Deep-link support: /#casestudies (from ProductPage.jsx etc.) should
  // land the visitor on that section, not just the top of the page.
  // Runs once on mount, after the sections below have painted.
  useEffect(() => {
    const h = window.location.hash.replace(/^#\/?/, "");
    if (!h) return;
    const t = setTimeout(() => {
      document.getElementById(h)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
    return () => clearTimeout(t);
  }, []);

  return (
    <div dir={lang==="ar"?"rtl":"ltr"} style={{ background:LPV7_TOKENS.bg, minHeight:"100vh", color:LPV7_TOKENS.text, fontFamily:FONT_DISPLAY }}>
      <GlobalStyle/>
      <ScrollProgress/>
      <Nav lang={lang} setLang={setLang} onCTA={handleCTA} mode={mode} setMode={setMode}/>
      <Hero lang={lang} onCTA={handleCTA} mode={mode} setMode={setMode}/>
      <SocialProof lang={lang}/>
      <Stats lang={lang}/>
      <Features lang={lang}/>
      <HowItWorks lang={lang}/>
      <CaseStudies lang={lang}/>
      <Pricing lang={lang} onCTA={handleCTA} mode={mode} isEgypt={isEgypt} setCurrencyOverride={setOverride}/>
      <Testimonials lang={lang}/>
      <FAQ lang={lang}/>
      <SchoolsSection lang={lang} onCTA={()=>window.__spaNavigate?.("/auth?mode=signup")}/>
      <FinalCTA lang={lang} onCTA={handleCTA}/>
      <Footer lang={lang}/>
    </div>
  );
}