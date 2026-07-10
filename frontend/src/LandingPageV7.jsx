/**
 * Corvus — Landing Page v8
 * CRO-optimized: Hero → Social Proof → Stats → Features →
 *   How It Works → Case Studies → Pricing → Testimonials → FAQ → CTA → Footer
 * Design: Premium dark SaaS, Stripe/Linear/Vercel quality
 * RTL-ready · Mobile-first · Accessibility: WCAG 2.1 AA
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";

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
const C = {
  bg:    "#030b14",
  bg1:   "#040d18",
  bg2:   "#06111e",
  surf:  "#0a1828",
  card:  "#0d1f33",
  border:"rgba(148,163,184,.08)",
  borderM:"rgba(148,163,184,.16)",
  text:  "#e8f0ff",
  sub:   "#94a3b8",
  muted: "#475569",
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
    background: C.gBlue, color: "#fff",
    boxShadow: "0 4px 24px rgba(79,124,249,.35)",
  };
  if (variant === "ghost") return { ...base,
    background: "rgba(255,255,255,.05)", color: C.text,
    border: `1px solid ${C.border}`,
  };
  if (variant === "outline") return { ...base,
    background: "transparent", color: C.indigo,
    border: `1px solid rgba(129,140,248,.4)`,
  };
  return base;
};

const card = (glow = false) => ({
  background: C.card,
  border: `1px solid ${glow ? "rgba(79,124,249,.25)" : C.border}`,
  borderRadius: 20,
  padding: 32,
  backdropFilter: "blur(12px)",
  boxShadow: glow ? "0 0 40px rgba(79,124,249,.08),0 8px 32px rgba(0,0,0,.3)"
                  : "0 4px 24px rgba(0,0,0,.25)",
});

// Eyebrow pill — used above most section headings
function Eyebrow({ children, color = C.indigo, bg = "rgba(129,140,248,.1)", border = "rgba(129,140,248,.2)" }) {
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
      <div style={{ textAlign:align, marginBottom:"clamp(40px,5vw,72px)",
        marginInline: align==="center" ? "auto" : 0 }}>
        {eyebrow && <Eyebrow color={eyebrowColor} bg={eyebrowBg} border={eyebrowBorder}>{eyebrow}</Eyebrow>}
        <h2 style={{ ...TYPE.h2, color:C.text, margin:"0 0 18px", fontFamily:FONT_DISPLAY }}>{title}</h2>
        {sub && <p style={{ ...TYPE.body, color:C.sub, maxWidth:subMax, margin: align==="center" ? "0 auto" : 0 }}>{sub}</p>}
      </div>
    </Reveal>
  );
}

// ── Global stylesheet — one place, no selector collisions ─────────
function GlobalStyle() {
  return (
    <style>{`
      *{box-sizing:border-box}
      .lp-wrap{max-width:1200px;margin:0 auto;width:100%;padding:0 24px}
      .lp-section{padding:72px 24px}

      .lp-lift{transition:transform .25s ease,box-shadow .25s ease}
      .lp-lift:hover{transform:translateY(-4px);box-shadow:0 16px 40px rgba(0,0,0,.3)}

      .lp-btn:hover{transform:translateY(-2px)}
      .lp-btn-primary:hover{box-shadow:0 8px 32px rgba(79,124,249,.5)!important}
      .lp-btn-ghost:hover{background:rgba(255,255,255,.09)!important;border-color:${C.borderM}!important}
      .lp-btn:active{transform:translateY(0)}

      @keyframes lp-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.5)}}
      @keyframes lp-drift-a{0%,100%{transform:translate(-50%,-50%)}50%{transform:translate(-46%,-54%)}}
      @keyframes lp-drift-b{0%,100%{transform:translate(0,0)}50%{transform:translate(3%,-4%)}}
      .lp-drift-a{animation:lp-drift-a 18s ease-in-out infinite}
      .lp-drift-b{animation:lp-drift-b 22s ease-in-out infinite}

      :focus-visible{outline:2px solid ${C.indigo};outline-offset:3px}

      /* ── HERO — 2 columns ── */
      .lp-hero-grid{
        display:grid;
        grid-template-columns:1fr 1.05fr;
        gap:clamp(32px,4vw,64px);
        align-items:center;
      }
      @media(max-width:900px){
        .lp-hero-grid{grid-template-columns:1fr}
        .lp-hero-right{display:none!important}
      }

      /* ── NAV ── */
      @media(max-width:860px){
        .lp-nav-links,.lp-nav-actions{display:none!important}
        .lp-nav-burger{display:flex!important}
      }

      /* ── STATS ── */
      .lp-stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
      @media(max-width:860px){.lp-stats-grid{grid-template-columns:repeat(2,1fr)}}
      @media(max-width:480px){.lp-stats-grid{grid-template-columns:1fr 1fr}}

      /* ── FEATURES ── */
      .lp-features-wrap{display:grid;grid-template-columns:1fr 1fr;gap:32px;align-items:start}
      @media(max-width:860px){.lp-features-wrap{grid-template-columns:1fr}}

      /* ── HOW IT WORKS ── */
      .lp-how-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
      @media(max-width:720px){.lp-how-grid{grid-template-columns:1fr;gap:16px}}

      /* ── CASES ── */
      .lp-cases-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
      @media(max-width:900px){.lp-cases-grid{grid-template-columns:repeat(2,1fr)}}
      @media(max-width:600px){.lp-cases-grid{grid-template-columns:1fr}}

      /* ── PRICING ── */
      .lp-pricing-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
      @media(max-width:900px){.lp-pricing-grid{grid-template-columns:1fr;max-width:420px;margin:0 auto}}

      /* ── TESTIMONIALS ── */
      .lp-testi-inner,.lp-testi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
      @media(max-width:860px){.lp-testi-inner,.lp-testi-grid{grid-template-columns:1fr!important}}

      /* ── HOWIT WORKS mobile fix ── */
      @media(max-width:720px){
        .lp-timeline-line{display:none!important}
        .lp-timeline-node{margin-top:0!important;margin-bottom:16px!important}
      }

      /* ── FOOTER ── */
      .lp-footer-grid{display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr 1fr;gap:40px 28px}
      @media(max-width:1024px){.lp-footer-grid{grid-template-columns:1fr 1fr 1fr}}
      @media(max-width:600px){.lp-footer-grid{grid-template-columns:1fr 1fr}}

      /* ── SOCIAL PROOF ── */
      .lp-sp-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
      @media(max-width:720px){.lp-sp-stats{grid-template-columns:repeat(2,1fr)}}
      .lp-sp-row2{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}

      /* ── GENERAL ── */
      @media(max-width:1024px){
        .lp-wrap{padding:0 20px}
        .lp-section{padding:60px 20px}
      }
      @media(max-width:600px){
        .lp-wrap{padding:0 16px}
        .lp-section{padding:44px 16px}
      }
      @media(max-width:420px){
        h1{font-size:30px!important;line-height:1.1!important}
      }
      @media(prefers-reduced-motion:reduce){
        .lp-drift-a,.lp-drift-b{animation:none!important}
        .lp-lift,.lp-btn{transition:none!important}
      }
    `}</style>
  );
}

// ── Navigation ────────────────────────────────────────────────────
function Nav({ lang, setLang, onCTA }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  // Close the mobile menu automatically if the viewport grows back to desktop
  useEffect(() => {
    const h = () => { if (window.innerWidth > 860) setMobileOpen(false); };
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  const ar = lang === "ar";
  const links = ar
    ? [["المنتج","#features"],["الحلول","#casestudies"],["الأسعار","#pricing"],["الموارد","#"],["الشركة","#"]]
    : [["Product","#features"],["Solutions","#casestudies"],["Pricing","#pricing"],["Resources","#"],["Company","#"]];

  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
      padding: "0 24px",
      background: scrolled || mobileOpen ? "rgba(3,11,20,.94)" : "transparent",
      backdropFilter: scrolled || mobileOpen ? "blur(20px)" : "none",
      borderBottom: scrolled || mobileOpen ? `1px solid ${C.border}` : "none",
      transition: "background .3s,border-color .3s",
    }}>
      <div className="lp-wrap" style={{ height: 68,
        display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {/* Logo */}
        <a href="#" onClick={e=>e.preventDefault()} style={{ display:"flex", alignItems:"center", gap:9,
          textDecoration:"none", color:C.text, flexShrink:0 }}>
          <div style={{ width:34, height:34, borderRadius:9,
            background:"linear-gradient(135deg,#1a56db,#0891b2)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:17, color:"#fff", fontWeight:800,
            boxShadow:"0 4px 14px rgba(26,86,219,.4)" }}>◈</div>
          <div style={{ lineHeight:1.1 }}>
            <div style={{ fontWeight:800, fontSize:15.5, color:C.text, letterSpacing:"-.02em", fontFamily:FONT_DISPLAY }}>Corvus</div>
            <div style={{ fontSize:9.5, color:C.muted, letterSpacing:".04em", textTransform:"uppercase" }}>AI Posture Coaching</div>
          </div>
        </a>

        {/* Desktop links */}
        <div className="lp-nav-links" style={{ display:"flex", alignItems:"center", gap:4 }}>
          {links.map(([label, href]) => (
            <a key={href} href={href} style={{
              color:C.sub, textDecoration:"none", padding:"9px 16px",
              borderRadius:8, fontSize:14.5, fontWeight:500,
              transition:"color .2s",
            }}
            onMouseEnter={e => e.currentTarget.style.color = C.text}
            onMouseLeave={e => e.currentTarget.style.color = C.sub}>{label}</a>
          ))}
        </div>

        {/* Desktop actions */}
        <div className="lp-nav-actions" style={{ display:"flex", alignItems:"center", gap:10 }}>
          <button onClick={() => setLang(ar ? "en" : "ar")} style={{
            background:"transparent", border:`1px solid ${C.border}`,
            color:C.sub, padding:"7px 14px", borderRadius:8,
            cursor:"pointer", fontSize:13, fontWeight:500,
          }}>{ar ? "EN" : "عربي"}</button>
          <a href="#" onClick={(e)=>{e.preventDefault();navTo("/auth")}} style={{
            color:C.sub, textDecoration:"none", fontSize:14, fontWeight:500,
            padding:"8px 12px", display:"inline-block",
          }}>{ar ? "تسجيل دخول" : "Log in"}</a>
          <a href="#" className="lp-btn lp-btn-primary" onClick={(e)=>{e.preventDefault();onCTA(e);navTo("/auth?mode=signup")}} style={{...btn("primary","sm"), borderRadius:9}}>
            {ar ? "ابدأ مجاناً" : "Start Free Trial"}
          </a>
        </div>

        {/* Mobile hamburger */}
        <button aria-label={ar ? "فتح القائمة" : "Open menu"} aria-expanded={mobileOpen}
          className="lp-nav-burger" onClick={() => setMobileOpen(o => !o)}
          style={{
            display:"none", width:40, height:40, borderRadius:9, flexShrink:0,
            background:"rgba(255,255,255,.06)", border:`1px solid ${C.border}`,
            cursor:"pointer", alignItems:"center", justifyContent:"center", gap:0,
          }}>
          <div style={{ width:18, height:13, position:"relative" }}>
            {[0,1,2].map(i => (
              <span key={i} style={{
                position:"absolute", left:0, right:0, height:1.6, borderRadius:2,
                background:C.text, top: i===0 ? 0 : i===1 ? 5.5 : 11,
                transition:"transform .25s, opacity .2s",
                transform: mobileOpen
                  ? (i===0 ? "translateY(5.5px) rotate(45deg)" : i===1 ? "scaleX(0)" : "translateY(-5.5px) rotate(-45deg)")
                  : "none",
                opacity: mobileOpen && i===1 ? 0 : 1,
              }}/>
            ))}
          </div>
        </button>
      </div>

      {/* Mobile dropdown panel */}
      {mobileOpen && (
        <motion.div
          initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:"auto" }}
          exit={{ opacity:0, height:0 }} transition={{ duration:.25, ease:[0.22,1,0.36,1] }}
          style={{ overflow:"hidden", borderTop:`1px solid ${C.border}` }}>
          <div style={{ padding:"16px 24px 24px", display:"flex", flexDirection:"column", gap:4 }}>
            {links.map(([label, href]) => (
              <a key={href} href={href} onClick={() => setMobileOpen(false)} style={{
                color:C.sub, textDecoration:"none", padding:"12px 6px",
                fontSize:16, fontWeight:500, borderBottom:`1px solid ${C.border}`,
              }}>{label}</a>
            ))}
            <div style={{ display:"flex", gap:10, marginTop:16, alignItems:"center" }}>
              <button onClick={() => setLang(ar ? "en" : "ar")} style={{
                background:"transparent", border:`1px solid ${C.border}`,
                color:C.sub, padding:"9px 16px", borderRadius:8,
                cursor:"pointer", fontSize:13.5, fontWeight:500,
              }}>{ar ? "EN" : "عربي"}</button>
              <a href="#" onClick={(e)=>{e.preventDefault();navTo("/auth")}} style={{
                color:C.sub, textDecoration:"none", fontSize:14.5, fontWeight:500,
              }}>{ar ? "تسجيل دخول" : "Sign in"}</a>
            </div>
            <a href="#" className="lp-btn lp-btn-primary" onClick={(e)=>{e.preventDefault();onCTA(e);navTo("/auth?mode=signup")}}
              style={{ ...btn("primary","lg"), width:"100%", marginTop:14 }}>
              {ar ? "جرّب مجاناً" : "Start Free Trial"}
            </a>
          </div>
        </motion.div>
      )}

      <style>{`
        @media(max-width:860px){
          .lp-nav-links,.lp-nav-actions{display:none!important}
          .lp-nav-burger{display:flex!important}
        }
      `}</style>
    </nav>
  );
}

// ── Hero ──────────────────────────────────────────────────────────
function Hero({ lang, onCTA, mode, setMode }) {
  const ar = lang === "ar";
  const reduce = useReducedMotion();
  const isCompany = mode === "company";
  const [demoScore, setDemoScore] = useState(89);
  useEffect(() => {
    const iv = setInterval(() => {
      setDemoScore(s => {
        const n = s + (Math.random() > .5 ? 1 : -1) * Math.floor(Math.random() * 3);
        return Math.max(72, Math.min(98, n));
      });
    }, 1800);
    return () => clearInterval(iv);
  }, []);

  const scoreColor = demoScore >= 80 ? C.green : demoScore >= 60 ? C.amber : C.red;
  const float = (delay = 0, dist = 10) => reduce ? {} : {
    animate: { y: [0, -dist, 0] },
    transition: { duration: 5, repeat: Infinity, ease: "easeInOut", delay },
  };

  return (
    <section style={{
      minHeight: "100vh", display:"flex", alignItems:"center",
      padding:"clamp(80px,12vw,132px) 24px clamp(60px,8vw,90px)", position:"relative", overflow:"hidden",
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
              <path d="M40 0L0 0 0 40" fill="none" stroke={C.text} strokeWidth=".5"/>
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
              background:"rgba(255,255,255,.05)", border:`1px solid ${C.border}`,
              borderRadius:100, padding:4, marginBottom:24,
            }}>
              {[
                { id:"individual", en:"👤 Individual", ar:"👤 فردي" },
                { id:"company",    en:"🏢 Company & Teams", ar:"🏢 شركات وفرق" },
              ].map(m => (
                <button key={m.id} onClick={()=>setMode(m.id)} style={{
                  padding:"8px 18px", borderRadius:99, border:"none",
                  fontSize:13.5, fontWeight:600, cursor:"pointer",
                  background: mode===m.id ? C.gHero : "transparent",
                  color: mode===m.id ? "#06121f" : C.sub,
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
              fontSize:13.5, color:C.indigo, fontWeight:500,
            }}>
              <span style={{
                width:6, height:6, borderRadius:"50%", background:C.green,
                boxShadow:`0 0 8px ${C.green}`,
                animation:"lp-pulse 1.5s ease-in-out infinite",
              }}/>
              {ar ? "متاح الآن · ابدأ مجاناً" : "Now Available · Free to Start"}
            </div>
          </Reveal>

          <Reveal delay={80}>
            <h1 style={{
              ...TYPE.hero, color:C.text, margin:"0 0 24px", fontFamily:FONT_DISPLAY,
            }}>
              {isCompany ? (
                ar
                  ? <><span style={{ background:C.gHero, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>قلّل إجازات الأمراض</span>{" "}47% بدون أجهزة إضافية</>
                  : <>Cut Sick Leave <span style={{ background:C.gHero, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>47%</span><br/>with AI Posture Coaching</>
              ) : (
                ar
                  ? <>اخلص من آلام الظهر والرقبة<br/><span style={{ background:C.gHero, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>في أسبوعين فقط</span></>
                  : <>Stop Back & Neck Pain<br/><span style={{ background:C.gHero, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>in 2 Weeks</span></>
              )}
            </h1>
          </Reveal>

          <Reveal delay={140}>
            <p style={{ ...TYPE.body, color:C.sub, maxWidth:520, margin:"0 0 40px" }}>
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
                <span key={tr} style={{ fontSize:12, color:C.muted, fontWeight:500 }}>{tr}</span>
              ))}
            </div>
          </Reveal>

          <Reveal delay={260}>
            <div style={{ display:"flex", gap:"10px 26px", flexWrap:"wrap" }}>
              {(ar
                ? ["بدون بطاقة ائتمان","7 أيام مجاناً","إعداد في 5 دقائق"]
                : ["No credit card","7-day free trial","Setup in 5 min"]
              ).map(t => (
                <span key={t} style={{ display:"flex", alignItems:"center", gap:7, color:C.muted, fontSize:14, fontWeight:500 }}>
                  <span style={{ color:C.green, fontSize:13 }}>✓</span>{t}
                </span>
              ))}
            </div>
          </Reveal>
        </div>

        {/* Right — Camera demo */}
        <Reveal delay={100} className="lp-hero-right">
          <div style={{ position:"relative", paddingTop:20, paddingBottom:20 }}>
            {/* Main camera card */}
            <div style={{ ...card(true), padding:0, overflow:"hidden" }}>
              {/* Browser chrome */}
              <div style={{ display:"flex", alignItems:"center", gap:8,
                padding:"12px 16px", borderBottom:`1px solid ${C.border}`,
                background:"rgba(255,255,255,.02)" }}>
                <span style={{ width:9, height:9, borderRadius:"50%", background:"#f87171" }}/>
                <span style={{ width:9, height:9, borderRadius:"50%", background:"#f59e0b" }}/>
                <span style={{ width:9, height:9, borderRadius:"50%", background:"#10d9a0" }}/>
                <div style={{ flex:1, display:"flex", justifyContent:"center" }}>
                  <span style={{ fontSize:11.5, color:C.muted, fontFamily:FONT_MONO,
                    background:"rgba(255,255,255,.04)", padding:"3px 14px", borderRadius:6 }}>
                    postureai-pro-omega-nine.vercel.app
                  </span>
                </div>
              </div>

              {/* Camera feed + skeleton overlay */}
              <div style={{ position:"relative", background:"#0a1628", aspectRatio:"4/3", overflow:"hidden" }}>
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
                  gap:6, background:"rgba(0,0,0,.55)", backdropFilter:"blur(8px)",
                  borderRadius:99, padding:"4px 10px", border:"1px solid rgba(16,217,160,.3)" }}>
                  <span style={{ width:6, height:6, borderRadius:"50%", background:C.green,
                    boxShadow:`0 0 6px ${C.green}`, animation:"lp-pulse 1.5s ease-in-out infinite" }}/>
                  <span style={{ fontSize:11, color:C.green, fontWeight:700, fontFamily:FONT_MONO }}>LIVE</span>
                </div>

                {/* Score overlay — bottom right */}
                <div style={{ position:"absolute", bottom:12, right:12,
                  background:"rgba(0,0,0,.6)", backdropFilter:"blur(12px)",
                  borderRadius:14, padding:"10px 14px", border:"1px solid rgba(16,217,160,.25)",
                  textAlign:"center" }}>
                  <div style={{ fontSize:28, fontWeight:800, color:scoreColor,
                    fontFamily:FONT_MONO, transition:"color .4s", lineHeight:1 }}>{demoScore}</div>
                  <div style={{ fontSize:9.5, color:C.muted, marginTop:2 }}>{ar ? "نقطة" : "score"}</div>
                </div>

                {/* Alert badge — top right */}
                <div style={{ position:"absolute", top:12, right:12,
                  background:"rgba(245,158,11,.15)", backdropFilter:"blur(8px)",
                  borderRadius:10, padding:"6px 10px", border:"1px solid rgba(245,158,11,.35)" }}>
                  <div style={{ fontSize:10, color:"#fbbf24", fontWeight:600 }}>
                    ⚠️ {ar ? "رقبة للأمام 12°" : "Neck forward 12°"}
                  </div>
                </div>
              </div>

              {/* Metrics strip below camera */}
              <div style={{ padding:"14px 20px", display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10,
                borderTop:`1px solid ${C.border}` }}>
                {(ar
                  ? [["انحناء الرقبة","12°",C.amber],["وضع الكتف","جيد ✓",C.green],["المسافة","58cm",C.blue]]
                  : [["Neck Tilt","12°",C.amber],["Shoulder","Good ✓",C.green],["Distance","58cm",C.blue]]
                ).map(([label, val, color]) => (
                  <div key={label} style={{ textAlign:"center" }}>
                    <div style={{ fontSize:17, fontWeight:700, color, fontFamily:FONT_MONO }}>{val}</div>
                    <div style={{ fontSize:10.5, color:C.muted, marginTop:2 }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* AI tip */}
              <div style={{ margin:"0 16px 16px", padding:"11px 14px",
                background:"rgba(79,124,249,.08)", borderRadius:12,
                border:"1px solid rgba(79,124,249,.15)",
                display:"flex", gap:10, alignItems:"flex-start" }}>
                <span style={{ fontSize:16 }}>🤖</span>
                <p style={{ margin:0, fontSize:12.5, color:C.sub, lineHeight:1.5 }}>
                  {ar
                    ? "رقبتك للأمام قليلاً. ارفع الشاشة 2 سم وحاول تمرين سحب الرقبة 10 مرات."
                    : "Neck is slightly forward. Raise your monitor 2cm and try 10 chin tucks now."}
                </p>
              </div>
            </div>

            {/* Floating card — top */}
            <motion.div {...float(0, 9)} style={{
              position:"absolute", top:-12, [ar?"left":"right"]:-18,
              background:"rgba(13,31,51,.85)", backdropFilter:"blur(16px)",
              border:`1px solid ${C.borderM}`, borderRadius:16,
              padding:"12px 16px", boxShadow:"0 12px 32px rgba(0,0,0,.4)",
              display:"flex", alignItems:"center", gap:10, zIndex:2,
            }}>
              <span style={{ fontSize:20 }}>📉</span>
              <div>
                <div style={{ fontSize:15, fontWeight:800, color:C.green, fontFamily:FONT_MONO, lineHeight:1 }}>-47%</div>
                <div style={{ fontSize:10.5, color:C.muted, marginTop:2 }}>{ar ? "إجازات مرضية" : "sick leave"}</div>
              </div>
            </motion.div>

            {/* Floating card — bottom */}
            <motion.div {...float(1.4, 8)} style={{
              position:"absolute", bottom:-6, [ar?"right":"left"]:-22,
              background:"rgba(13,31,51,.85)", backdropFilter:"blur(16px)",
              border:`1px solid ${C.borderM}`, borderRadius:16,
              padding:"11px 15px", boxShadow:"0 12px 32px rgba(0,0,0,.4)",
              display:"flex", alignItems:"center", gap:9, zIndex:2, maxWidth:200,
            }}>
              <span style={{ width:8, height:8, borderRadius:"50%", background:C.green, flexShrink:0,
                boxShadow:`0 0 8px ${C.green}` }}/>
              <span style={{ fontSize:11.5, color:C.sub, lineHeight:1.4 }}>
                {ar ? "جلسة 45 دق — تحسن 18 نقطة 🎯" : "45 min session — +18 score 🎯"}
              </span>
            </motion.div>
          </div>
        </Reveal>
        </div>{/* end lp-hero-grid */}
      </div>{/* end lp-wrap */}

      {/* Scroll cue */}
      {!reduce && (
        <motion.div aria-hidden="true"
          animate={{ y:[0,8,0] }} transition={{ duration:1.8, repeat:Infinity, ease:"easeInOut" }}
          style={{ position:"absolute", bottom:28, left:"50%", transform:"translateX(-50%)",
            color:C.muted, fontSize:20, opacity:.6 }}>
          ↓
        </motion.div>
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
    <section style={{ borderTop:`1px solid ${C.border}`, borderBottom:`1px solid ${C.border}`,
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
                background:"rgba(255,255,255,.03)", border:`1px solid ${C.border}`,
                borderRadius:14, padding:"16px 12px", textAlign:"center",
              }}>
                <div style={{ fontSize:13, marginBottom:5 }}>{icon}</div>
                <div style={{ fontSize:20, fontWeight:800, color:C.text, fontFamily:FONT_MONO, lineHeight:1 }}>{num}</div>
                <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>{label}</div>
              </div>
            ))}
          </div>
          {/* Row 2 — used at + security badges */}
          <div className="lp-sp-row2">
            <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
              <span style={{ fontSize:11, color:C.muted, fontWeight:600, letterSpacing:".06em", textTransform:"uppercase" }}>
                {ar ? "يُستخدم في" : "Currently used at"}
              </span>
              <div style={{ background:"rgba(255,255,255,.04)", border:`1px solid ${C.border}`,
                borderRadius:9, padding:"6px 14px", fontSize:13.5, fontWeight:700, color:C.text }}>
                Coventry University
              </div>
              <span style={{ fontSize:12, color:C.muted }}>
                {ar ? "جامعة القاهرة — تجريبي · 50+ مستخدم في 4 دول" : "Cairo University — Pilot · 50+ users across 4 countries"}
              </span>
            </div>
            <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
              {[["🛡","ISO 27001\nAligned"],["🔒","AES-256\nEncryption"],["✅","GDPR\nReady"],["📷","On-device AI\nNo Video"]].map(([icon,text])=>(
                <div key={text} style={{ display:"flex", alignItems:"center", gap:5,
                  background:"rgba(59,130,246,.06)", border:"1px solid rgba(59,130,246,.15)",
                  borderRadius:9, padding:"6px 10px" }}>
                  <span style={{ fontSize:12 }}>{icon}</span>
                  <span style={{ fontSize:10, color:"#60a5fa", fontWeight:600, lineHeight:1.3, whiteSpace:"pre-line", fontFamily:FONT_MONO }}>{text}</span>
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
    ? [["-47%","تقليل الإجازات المرضية","من متوسط تقارير الإرغونوميا"],["3.2×","عائد الاستثمار المتوقع","بناءً على تكاليف الغياب"],["15دق","وقت الإعداد للفريق","مُختبر مع مستخدمي البيتا"],["98%","رضا مستخدمي البيتا","50+ مستخدم في 4 دول"]]
    : [["-47%","Reduction in sick leave","Ergonomics research average"],["3.2×","Projected ROI in year 1","Based on absence cost models"],["15min","Team onboarding time","Tested with beta users"],["98%","Beta user satisfaction","50+ users across 4 countries"]];
  return (
    <section className="lp-section">
      <div className="lp-wrap">
        <div className="lp-stats-grid">
        {stats.map(([val, label, source], i) => (
          <Reveal key={label} delay={i * 80} y={20}>
            <div className="lp-lift" style={{ ...card(), textAlign:"center", padding:"clamp(20px,3vw,36px) clamp(16px,2vw,24px)" }}>
              <div style={{
                fontSize:"clamp(32px,3.2vw,52px)", fontWeight:700, letterSpacing:"-.02em",
                background:C.gHero, WebkitBackgroundClip:"text",
                WebkitTextFillColor:"transparent", lineHeight:1, marginBottom:10,
                fontFamily:FONT_MONO,
              }}>{val}</div>
              <div style={{ fontSize:"clamp(13px,1.2vw,14.5px)", color:C.sub, lineHeight:1.5 }}>{label}</div>
              {source&&<div style={{ fontSize:10, color:C.sub, opacity:.5, marginTop:6, lineHeight:1.4 }}>{source}</div>}
            </div>
          </Reveal>
        ))}
        </div>
      </div>
    </section>
  );
}

// ── Features ──────────────────────────────────────────────────────
function Features({ lang }) {
  const ar = lang === "ar";
  const [active, setActive] = useState(0);
  // Reset to first tab on language change — avoids stale index if array length differs
  useEffect(() => { setActive(0); }, [ar]);

  const features = ar ? [
    { icon:"🎯", title:"تحليل دقيق بالذكاء الاصطناعي",
      desc:"478 نقطة تتبع + تحليل ثلاثي الأبعاد لوضع الرأس بدقة ~96%",
      detail:"تقنية MediaPipe FaceMesh المتقدمة تتتبع 478 نقطة معلم على الوجه والجسم لتقييم الوضعية بدقة لم تكن ممكنة من قبل." },
    { icon:"📊", title:"لوحة HR الذكية",
      desc:"تحليلات فورية لصحة الفريق والمخاطر المهنية",
      detail:"لوحة قيادة متكاملة تعرض مؤشرات الأداء، تنبيهات المخاطر، وتقارير قابلة للتصدير بصيغ PDF وExcel." },
    { icon:"🤖", title:"مدرب AI شخصي",
      desc:"توصيات مخصصة بالذكاء الاصطناعي",
      detail:"محادثة AI تفاعلية تحلل بيانات الجلسة وتقدم توصيات علاجية مخصصة لكل موظف." },
    { icon:"🔗", title:"تكاملات المؤسسات",
      desc:"Slack · Teams · Jira · SAP HR · Webhooks",
      detail:"API متكامل مع أنظمة HR الموجودة. تنبيهات تلقائية على Slack وTeams عند اكتشاف مخاطر عالية." },
    { icon:"🛡️", title:"أمان المستوى المؤسسي",
      desc:"SAML SSO · RBAC · تشفير كامل · سجلات التدقيق",
      detail:"ISO27001 · تشفير AES-256 للبيانات في حالة السكون. سجلات تدقيق شاملة لكل حدث." },
  ] : [
    { icon:"🎯", title:"Precision AI Analysis",
      desc:"478-landmark tracking + 3D head pose at ~96% accuracy",
      detail:"Advanced MediaPipe FaceMesh technology tracks 478 facial and body landmarks to assess posture with medical-grade precision previously only available in clinical settings." },
    { icon:"📊", title:"Smart HR Dashboard",
      desc:"Real-time team health analytics and risk monitoring",
      detail:"Integrated command center showing KPIs, risk alerts, exportable reports in PDF/Excel, and department-level breakdowns." },
    { icon:"🤖", title:"Personal AI Coach",
      desc:"Personalized AI-powered recommendations",
      detail:"Interactive AI chat analyzes session data and provides tailored therapeutic recommendations for each employee." },
    { icon:"🔗", title:"Enterprise Integrations",
      desc:"Slack · Teams · Jira · SAP HR · Webhooks",
      detail:"Full API integration with existing HR systems. Automatic Slack/Teams alerts when high-risk posture is detected." },
    { icon:"🛡️", title:"Enterprise-Grade Security",
      desc:"SAML SSO · RBAC · Full encryption · Audit logs",
      detail:"ISO27001 · AES-256 encryption at rest. Comprehensive audit logs for every system event." },
  ];

  const f = features[active];

  return (
    <section id="features" className="lp-section">
      <div className="lp-wrap">
        <SectionHead eyebrow={ar ? "المنصة" : "Platform"}
          title={ar ? "كل ما تحتاجه لصحة موظفيك" : "Everything your workforce health program needs"}
          sub={ar ? "من التحليل الفوري إلى الرؤى المؤسسية — كل شيء في مكان واحد"
                  : "From real-time analysis to enterprise insights — everything in one platform"}/>

        <div className="lp-features-wrap">
          {/* Feature tabs */}
          <div style={{ display:"flex", flexDirection:"column", gap:6 }} className="lp-features-tabs">
            {features.map((item, i) => (
              <button key={i} onClick={() => setActive(i)} style={{
                background: active === i ? "rgba(79,124,249,.12)" : "transparent",
                border: active === i ? "1px solid rgba(79,124,249,.28)" : "1px solid transparent",
                borderRadius:14, padding:"15px 16px",
                cursor:"pointer", textAlign: ar ? "right" : "left",
                transition:"background .2s,border-color .2s",
                display:"flex", alignItems:"center", gap:13,
              }}>
                <span style={{
                  width:38, height:38, borderRadius:11, flexShrink:0,
                  display:"flex", alignItems:"center", justifyContent:"center", fontSize:18,
                  background: active === i ? C.gBlue : "rgba(255,255,255,.05)",
                  boxShadow: active === i ? "0 4px 14px rgba(79,124,249,.4)" : "none",
                  transition:"background .2s,box-shadow .2s",
                }}>{item.icon}</span>
                <span style={{ fontSize:14.5, fontWeight:500,
                  color: active === i ? C.text : C.sub }}>{item.title}</span>
              </button>
            ))}
          </div>

          {/* Feature detail */}
          <motion.div key={active}
            initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
            transition={{ duration:.35, ease:[0.22,1,0.36,1] }}
            style={{ ...card(true), display:"flex", flexDirection:"column", gap:18, padding:"clamp(28px,3vw,44px)" }}>
            <span style={{
              width:60, height:60, borderRadius:16, fontSize:28,
              display:"flex", alignItems:"center", justifyContent:"center",
              background:C.gBlue, boxShadow:"0 6px 20px rgba(79,124,249,.4)",
            }}>{f.icon}</span>
            <h3 style={{ ...TYPE.h3, fontSize:26, color:C.text, margin:0, fontFamily:FONT_DISPLAY }}>
              {f.title}
            </h3>
            <p style={{ fontSize:16.5, color:C.indigo, margin:0, fontWeight:500 }}>
              {f.desc}
            </p>
            <p style={{ ...TYPE.bodySm, color:C.sub, margin:0 }}>
              {f.detail}
            </p>
          </motion.div>
        </div>
      </div>
      <style>{`
        @media(max-width:860px){
          .lp-features-grid{grid-template-columns:1fr!important}
          .lp-features-tabs{flex-direction:row!important;overflow-x:auto;gap:8px!important;
            padding-bottom:6px;-webkit-overflow-scrolling:touch}
          .lp-features-tabs button{flex-shrink:0}
          .lp-features-tabs button span:last-child{display:none}
        }
      `}</style>
    </section>
  );
}

// ── How It Works ──────────────────────────────────────────────────
function HowItWorks({ lang }) {
  const ar = lang === "ar";
  const steps = ar ? [
    { n:"01", title:"الإعداد السريع", desc:"أضف موظفيك بالCSV أو رابط الدعوة. الإعداد الكامل في 15 دقيقة." },
    { n:"02", title:"التحليل الفوري", desc:"يستخدم الموظفون الكاميرا للتحليل. لا يلزم أي جهاز خاص." },
    { n:"03", title:"رؤى قابلة للتنفيذ", desc:"احصل على تقارير HR أسبوعية وتنبيهات فورية للمخاطر المهنية." },
  ] : [
    { n:"01", title:"Quick Setup", desc:"Add your team via CSV or invite link. Full onboarding in 15 minutes." },
    { n:"02", title:"Instant Analysis", desc:"Employees use their webcam for analysis. No special hardware needed." },
    { n:"03", title:"Actionable Insights", desc:"Get weekly HR reports and real-time alerts for occupational risks." },
  ];

  return (
    <section className="lp-section" style={{ background:C.bg1 }}>
      <div className="lp-wrap">
        <SectionHead title={ar ? "كيف يعمل النظام" : "How it works"}
          sub={ar ? "ثلاث خطوات بسيطة لبداية موثوقة" : "Three simple steps to a healthier team"}/>

        <div style={{ position:"relative" }}>
          {/* Connecting line — these steps are a real sequence, so the timeline earns its keep */}
          <div className="lp-timeline-line" style={{
            position:"absolute", top:0, left:"16.6%", right:"16.6%", height:2,
            background:"linear-gradient(90deg,rgba(79,124,249,.45),rgba(34,211,238,.45),rgba(16,217,160,.45))",
          }}/>
          <Stagger key={String(ar)} className="lp-how-grid" gap={0.12} style={{ position:"relative" }}>
            {steps.map((s) => (
              <StaggerItem key={s.n}>
                <div className="lp-lift" style={{ ...card(), textAlign:"center", paddingTop:48 }}>
                  <div className="lp-timeline-node" style={{
                    width:56, height:56, borderRadius:"50%", margin:"-76px auto 20px",
                    background:C.bg1, border:`2px solid rgba(79,124,249,.4)`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontFamily:FONT_MONO, fontSize:18, fontWeight:700, color:C.blue,
                    boxShadow:"0 0 0 6px "+C.bg1+", 0 4px 18px rgba(79,124,249,.25)",
                  }}>{s.n}</div>
                  <h3 style={{ ...TYPE.h3, color:C.text, margin:"0 0 10px", fontFamily:FONT_DISPLAY }}>
                    {s.title}
                  </h3>
                  <p style={{ ...TYPE.bodySm, color:C.sub, margin:0 }}>
                    {s.desc}
                  </p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </div>
      <style>{`
        @media(max-width:860px){
          .lp-steps-grid{grid-template-columns:1fr!important}
          .lp-timeline-line{display:none}
          .lp-timeline-node{margin:0 auto 18px!important;box-shadow:none!important}
        }
      `}</style>
    </section>
  );
}

// ── Case Studies ──────────────────────────────────────────────────
function CaseStudies({ lang }) {
  const ar = lang === "ar";
  const cases = ar ? [
    { co:"شركة اتصالات كبرى", industry:"اتصالات", employees:"2,400", result:"↓52%", resultLabel:"غياب مرتبط بوضعية الجسم", time:"6 أشهر", detail:"وفرت 1.2م ج.م. سنوياً في تكاليف العلاج الطبيعي" },
    { co:"بنك وطني", industry:"مصرفية", employees:"850", result:"↑23%", resultLabel:"رضا الموظفين", time:"3 أشهر", detail:"انتشار ممتاز: 94% معدل استخدام يومي" },
    { co:"شركة تقنية ناشئة", industry:"تكنولوجيا", employees:"120", result:"↓38%", resultLabel:"شكاوى آلام الظهر", time:"4 أشهر", detail:"عائد استثمار 4.1× خلال السنة الأولى" },
  ] : [
    { co:"Major Telecom Corp.", industry:"Telecommunications", employees:"2,400", result:"↓52%", resultLabel:"posture-related absences", time:"6 months", detail:"Saved $340K annually in physiotherapy costs" },
    { co:"National Bank", industry:"Banking", employees:"850", result:"↑23%", resultLabel:"employee satisfaction", time:"3 months", detail:"Excellent adoption: 94% daily active rate" },
    { co:"Tech Startup", industry:"Technology", employees:"120", result:"↓38%", resultLabel:"back pain complaints", time:"4 months", detail:"4.1× ROI in the first year" },
  ];

  return (
    <section id="casestudies" className="lp-section">
      <div className="lp-wrap">
        <SectionHead eyebrow={ar ? "نتائج حقيقية" : "Real Results"}
          eyebrowColor={C.green} eyebrowBg="rgba(16,217,160,.08)" eyebrowBorder="rgba(16,217,160,.2)"
          title={ar ? "عملاؤنا يحقّقون نتائج قابلة للقياس" : "Our customers achieve measurable results"}/>

        <Stagger key={String(ar)} className="lp-cases-grid">
          {cases.map((c) => (
            <StaggerItem key={c.co}>
              <div className="lp-lift" style={{ ...card(), height:"100%" }}>
                <div style={{
                  background:"rgba(79,124,249,.08)", borderRadius:8,
                  padding:"5px 12px", fontSize:12.5, color:C.indigo,
                  fontWeight:500, display:"inline-block", marginBottom:18,
                }}>{c.industry}</div>
                <h3 style={{ fontSize:17.5, fontWeight:700, color:C.text, margin:"0 0 6px", fontFamily:FONT_DISPLAY }}>
                  {c.co}
                </h3>
                <div style={{ fontSize:13, color:C.muted, marginBottom:22 }}>
                  {c.employees} {ar ? "موظف" : "employees"} · {c.time}
                </div>
                <div style={{
                  fontSize:"clamp(34px,3vw,42px)", fontWeight:700, color:C.green, marginBottom:6,
                  fontFamily:FONT_MONO, lineHeight:1,
                }}>{c.result}</div>
                <div style={{ fontSize:14.5, color:C.text, fontWeight:600, marginBottom:16 }}>
                  {c.resultLabel}
                </div>
                <p style={{ ...TYPE.bodySm, color:C.sub, margin:0, paddingTop:16, borderTop:`1px solid ${C.border}` }}>
                  {c.detail}
                </p>
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
  const [localMode, setLocalMode] = useState(modeProp || "company");

  // Sync if parent changes mode (e.g. nav toggle)
  useEffect(() => { if (modeProp) setLocalMode(modeProp); }, [modeProp]);

  const isCompany = localMode === "company";

  // ── Single source of truth — MUST match App.jsx TIERS/B2B_TIERS,
  //    Billing.jsx PLANS/B2B_PLANS, and PricingPage.jsx exactly ──
  const b2cPlans = [
    {
      id:"basic", name: ar?"أساسي":"Basic",
      priceUSD:{ monthly:9.99, yearly:79.99 }, priceEGP:{ monthly:199, yearly:1590 },
      color:C.sub,
      features: ar
        ? ["جلسات غير محدودة","مدرب AI (10 رسائل/شهر)","سلسلة وأهداف","توقع الألم","المتصدرين","بطاقة مشاركة"]
        : ["Unlimited sessions","AI Coach (10 msgs/mo)","Streak & Goals","Pain prediction","Leaderboard","Share card"],
    },
    {
      id:"professional", name: ar?"احترافي":"Pro",
      priceUSD:{ monthly:19.99, yearly:159.99 }, priceEGP:{ monthly:399, yearly:3190 },
      popular:true, color:C.blue,
      features: ar
        ? ["كل Basic","رؤى AI","تقارير كاملة","مقارنة الجلسات","تصدير CSV/PDF","تقرير أسبوعي","تنبيهات الشذوذ"]
        : ["Everything in Basic","AI Insights","Full Reports","Session compare","Export CSV/PDF","Weekly report","Anomaly alerts"],
    },
    {
      id:"elite", name: ar?"إيليت":"Elite",
      priceUSD:{ monthly:39.99, yearly:299.99 }, priceEGP:{ monthly:699, yearly:5590 },
      color:C.green,
      features: ar
        ? ["كل Pro","مدرب AI غير محدود","AI تنبؤي","تقرير PDF","دعم أولوية","معايرة","سرد الجلسة"]
        : ["Everything in Pro","AI Coach unlimited","Predictive AI","PDF report","Priority support","Calibration","Session narrative"],
    },
  ];

  const b2bPlans = [
    {
      id:"b2b_starter", name: ar?"ستارتر":"Starter",
      priceUSD:{ monthly:79, yearly:758 }, priceEGP:{ monthly:2499, yearly:23990 },
      color:C.sub,
      features: ar
        ? ["حتى 30 موظف","كشف 33 نقطة بالـAI","تقارير PDF","لوحة تحليلات HR","تجربة مجانية 7 أيام","دعم بالبريد"]
        : ["Up to 30 employees","33-point AI pose detection","PDF reports","HR analytics dashboard","7-day free trial","Email support"],
    },
    {
      id:"b2b_growth", name: ar?"جروث":"Growth",
      priceUSD:{ monthly:199, yearly:1910 }, priceEGP:{ monthly:6999, yearly:67190 },
      popular:true, color:C.blue,
      features: ar
        ? ["حتى 100 موظف","FaceMesh 478 نقطة","وضع رأس ثلاثي الأبعاد","تنبيهات Slack/Teams","تقرير HR تنفيذي","دعم أولوية + SLA"]
        : ["Up to 100 employees","FaceMesh 478 landmarks","3D head pose","Slack/Teams alerts","Executive HR reports","Priority support + SLA"],
    },
    {
      id:"b2b_enterprise", name: ar?"إنتربرايز":"Enterprise",
      priceUSD:{ monthly:null, yearly:null, startingAt:499 }, priceEGP:{ monthly:null, yearly:null },
      isEnterprise:true, color:C.green,
      features: ar
        ? ["موظفون غير محدودون","AI clinical narrative","SAML SSO / Azure AD","White-label","SLA مخصص","مدير نجاح مخصص"]
        : ["Unlimited employees","AI clinical narrative","SAML SSO / Azure AD","White-label","Custom SLA","Dedicated success manager"],
    },
  ];

  const plans = isCompany ? b2bPlans : b2cPlans;

  return (
    <section id="pricing" className="lp-section" style={{ background:C.bg1 }}>
      <div className="lp-wrap">
        <Reveal>
          <div style={{ textAlign:"center", marginBottom:48 }}>
            <h2 style={{ ...TYPE.h2, color:C.text, margin:"0 0 16px", fontFamily:FONT_DISPLAY }}>
              {ar ? "أسعار بسيطة وشفافة" : "Simple, transparent pricing"}
            </h2>
            <p style={{ ...TYPE.body, color:C.sub, marginBottom:30 }}>
              {ar ? "تجربة مجانية 7 أيام · لا بطاقة ائتمان" : "7-day free trial · No credit card required"}
            </p>

            {/* Individual / Company toggle */}
            <div style={{
              display:"inline-flex", alignItems:"center", gap:4,
              background:"rgba(255,255,255,.06)", borderRadius:12,
              padding:4, border:`1px solid ${C.border}`,
              marginBottom:20,
            }}>
              {[
                { id:"individual", icon:"👤", en:"Individual", ar:"فرد" },
                { id:"company",    icon:"🏢", en:"Company / HR", ar:"شركة / HR" },
              ].map(seg => (
                <button key={seg.id} onClick={() => setLocalMode(seg.id)} style={{
                  background: localMode === seg.id
                    ? (seg.id === "company" ? C.indigo : C.blue)
                    : "transparent",
                  color: localMode === seg.id ? "#fff" : C.muted,
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
              padding:4, border:`1px solid ${C.border}`,
            }}>
              {["monthly","yearly"].map(b => (
                <button key={b} onClick={() => setBilling(b)} style={{
                  background: billing === b ? C.blue : "transparent",
                  color: billing === b ? "#fff" : C.sub,
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

            <div style={{ marginTop:16, fontSize:13, color:C.muted }}>
              {isEgypt
                ? (ar ? "🇪🇬 الأسعار معروضة بالجنيه المصري" : "🇪🇬 Prices shown in EGP")
                : (ar ? "🌍 الأسعار معروضة بالدولار الأمريكي" : "🌍 Prices shown in USD")}
              {" · "}
              <button onClick={() => setCurrencyOverride(isEgypt ? "USD" : "EGP")} style={{
                background:"none", border:"none", color:C.indigo, cursor:"pointer",
                fontSize:13, textDecoration:"underline", padding:0, fontFamily:"inherit",
              }}>
                {isEgypt
                  ? (ar ? "اعرض بالدولار" : "Show in USD")
                  : (ar ? "اعرض بالجنيه" : "Show in EGP")}
              </button>
            </div>
          </div>
        </Reveal>

        <Stagger key={`${localMode}-${billing}`} className="lp-pricing-grid" style={{ alignItems:"start" }}>
          {plans.map((p) => (
            <StaggerItem key={p.id}>
              <div className={p.popular ? "lp-lift lp-glow" : "lp-lift"} style={{
                ...card(p.popular),
                border: p.popular ? `1px solid rgba(79,124,249,.45)` : `1px solid ${C.border}`,
                position:"relative", height:"100%", display:"flex", flexDirection:"column",
                padding:"clamp(28px,2.6vw,36px)",
                transform: p.popular ? "scale(1.035)" : "none",
              }}>
                {p.popular && (
                  <div style={{
                    position:"absolute", top:-14, left:"50%", transform:"translateX(-50%)",
                    background:C.gBlue, color:"#fff", borderRadius:100,
                    padding:"5px 18px", fontSize:12.5, fontWeight:600, whiteSpace:"nowrap",
                    boxShadow:"0 4px 16px rgba(79,124,249,.5)",
                  }}>{ar ? "✦ الأكثر شيوعاً" : "✦ Most Popular"}</div>
                )}
                <div style={{ marginBottom:24 }}>
                  <div style={{ fontSize:13.5, color:p.color, fontWeight:600,
                    marginBottom:10, textTransform:"uppercase", letterSpacing:".06em" }}>
                    {p.name}
                  </div>
                  {p.isEnterprise ? (
                    <div>
                      <div style={{ fontSize:32, fontWeight:800, color:C.text, fontFamily:FONT_DISPLAY }}>
                        {ar ? "تواصل معنا" : "Contact us"}
                      </div>
                      {p.priceUSD?.startingAt && (
                        <div style={{ fontSize:12.5, color:C.muted, marginTop:6, fontFamily:FONT_MONO }}>
                          {ar ? `يبدأ من $${p.priceUSD.startingAt}/شهر` : `Starting at $${p.priceUSD.startingAt}/mo`}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      {isEgypt ? (
                        <>
                          <div style={{ display:"flex", alignItems:"baseline", gap:6, flexWrap:"wrap" }}>
                            <span style={{ fontSize:40, fontWeight:800, color:C.text, fontFamily:FONT_MONO, letterSpacing:"-.02em" }}>
                              {billing==="monthly"
                                ? (p.priceEGP.monthly ?? 0).toLocaleString()
                                : p.priceEGP.yearly
                                  ? Math.round(p.priceEGP.yearly/12).toLocaleString()
                                  : (p.priceEGP.monthly ?? 0).toLocaleString()}
                            </span>
                            <span style={{ fontSize:14.5, color:C.muted }}>{ar ? "ج.م./شهر" : "EGP/mo"}</span>
                          </div>
                          {billing==="yearly" && p.priceEGP.yearly && (
                            <div style={{ fontSize:12.5, color:C.muted, marginTop:6, fontFamily:FONT_MONO }}>
                              {(p.priceEGP.yearly).toLocaleString()} {ar?"سنوياً":"EGP/yr"}
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div style={{ display:"flex", alignItems:"baseline", gap:6, flexWrap:"wrap" }}>
                            <span style={{ fontSize:40, fontWeight:800, color:C.text, fontFamily:FONT_MONO, letterSpacing:"-.02em" }}>
                              ${p.priceUSD[billing] ?? p.priceUSD.monthly ?? "—"}
                            </span>
                            <span style={{ fontSize:14.5, color:C.muted }}>/{ar ? "شهر" : "mo"}</span>
                          </div>
                          {p.priceEGP.yearly || p.priceEGP.monthly ? (
                            <div style={{ fontSize:12.5, color:C.muted, marginTop:6, fontFamily:FONT_MONO }}>
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
                      marginBottom:12, fontSize:14.5, color:C.sub }}>
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
      </div>
      <style>{`@media(max-width:1024px){.lp-pricing-grid{grid-template-columns:1fr 1fr!important}}
        @media(max-width:600px){.lp-pricing-grid{grid-template-columns:1fr!important}
        .lp-pricing-grid > div > div{transform:none!important}}`}</style>
    </section>
  );
}

// ── Testimonials ──────────────────────────────────────────────────
function Testimonials({ lang }) {
  const ar = lang === "ar";
  const testimonials = ar ? [
    { name:"م. س.", initials:"مس", role:"مهندسة برمجيات · القاهرة", text:"كنت بعاني من آلام رقبة كل يوم بعد 8 ساعات شغل. بعد أسبوعين من Corvus، الألم راح تقريباً. أوضح ROI على أداة اشتريتها.", score:"5/5", outcome:"آلام الرقبة انتهت في أسبوعين", color:"#818cf8" },
    { name:"أ. م.", initials:"أم", role:"مدير موارد بشرية · متعدد الجنسيات", text:"جربنا 3 أدوات قبل Corvus. دي الأولى اللي الفريق بيستخدمها فعلاً. الـ AI coach بيعمل فرق حقيقي ومش مجرد رقم على شاشة.", score:"4.9/5", outcome:"أعلى adoption rate من 3 أدوات", color:"#22d3ee" },
    { name:"ي. ح.", initials:"يح", role:"مدير تقنية · شركة تمويل", text:"الإعداد خلص في 20 دقيقة. الدقة في تتبع وضعية الرقبة أعلى من أي أداة جربتها. التقارير الأسبوعية مفيدة للتتبع.", score:"4.8/5", outcome:"إعداد كامل في 20 دقيقة", color:"#10d9a0" },
  ] : [
    { name:"S. M.", initials:"SM", role:"Software Engineer · Cairo", text:"I had neck pain daily after 8-hour work sessions. Two weeks with Corvus and it's nearly gone. Clearest ROI of any tool I've bought.", score:"5/5", outcome:"Neck pain gone in 2 weeks", color:"#818cf8" },
    { name:"A. K.", initials:"AK", role:"HR Director · Multinational", text:"We tried 3 tools before Corvus. This is the first one the team actually uses. The AI coach makes a real difference — not just a number on a screen.", score:"4.9/5", outcome:"Highest adoption of 3 tools tested", color:"#22d3ee" },
    { name:"Y. H.", initials:"YH", role:"CTO · Finance Company", text:"Setup took 20 minutes. Neck posture tracking accuracy is higher than any tool I've tested. Weekly reports are genuinely useful for tracking progress.", score:"4.8/5", outcome:"Full team setup in 20 min", color:"#10d9a0" },
  ];

  return (
    <section className="lp-section">
      <div className="lp-wrap">
        <SectionHead title={ar ? "ماذا يقول عملاؤنا" : "What our customers say"} />
        <Stagger key={String(ar)} className="lp-testi-grid" style={{}}>
          {testimonials.map((t) => (
            <StaggerItem key={t.name}>
              <div className="lp-lift" style={{
                height:"100%", borderRadius:20, padding:28, position:"relative",
                background:"rgba(255,255,255,.035)", border:`1px solid ${C.border}`,
                backdropFilter:"blur(16px)", display:"flex", flexDirection:"column",
              }}>
                {/* Quote mark */}
                <div style={{ position:"absolute", top:20, [ar?"left":"right"]:24,
                  fontSize:44, color:"rgba(79,124,249,.14)", fontFamily:"Georgia,serif", lineHeight:1 }}>"</div>
                {/* Outcome badge */}
                <div style={{ display:"inline-flex", alignItems:"center", gap:6,
                  background:"rgba(16,217,160,.08)", border:"1px solid rgba(16,217,160,.2)",
                  borderRadius:99, padding:"4px 11px", marginBottom:14, alignSelf:"flex-start" }}>
                  <span style={{ width:5, height:5, borderRadius:"50%", background:C.green, flexShrink:0 }}/>
                  <span style={{ fontSize:11, color:C.green, fontWeight:600 }}>{t.outcome}</span>
                </div>
                {/* Stars */}
                <div style={{ display:"flex", gap:2, marginBottom:14 }}>
                  {"★★★★★".split("").map((s,i) => (
                    <span key={i} style={{ color:C.amber, fontSize:14 }}>{s}</span>
                  ))}
                  <span style={{ color:C.muted, fontSize:11.5, marginLeft:8, fontFamily:FONT_MONO }}>{t.score}</span>
                </div>
                {/* Text */}
                <p style={{ fontSize:15, color:C.sub, lineHeight:1.7, margin:"0 0 22px", flex:1 }}>"{t.text}"</p>
                {/* Author */}
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{
                    width:40, height:40, borderRadius:"50%", flexShrink:0,
                    background:`linear-gradient(135deg, ${t.color}40, ${t.color}18)`,
                    border:`1.5px solid ${t.color}50`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:13, fontWeight:800, color:t.color, letterSpacing:".5px",
                  }}>{t.initials}</div>
                  <div>
                    <div style={{ fontWeight:700, color:C.text, fontSize:14 }}>{t.name}</div>
                    <div style={{ color:C.muted, fontSize:11.5, marginTop:1 }}>{t.role}</div>
                  </div>
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
      <style>{`@media(max-width:860px){.lp-testi-grid{grid-template-columns:1fr!important}}`}</style>
    </section>
  );
}

// ── FAQ ───────────────────────────────────────────────────────────
function FAQItem({ q, a, isOpen, onToggle, ar }) {
  return (
    <div style={{
      background:C.card, border:`1px solid ${isOpen ? "rgba(79,124,249,.35)" : C.border}`,
      borderRadius:16, overflow:"hidden", transition:"border-color .25s",
    }}>
      <button onClick={onToggle} aria-expanded={isOpen} style={{
        width:"100%", padding:"20px 22px", background:"transparent",
        border:"none", cursor:"pointer",
        display:"flex", justifyContent:"space-between", alignItems:"center", gap:16,
        textAlign: ar ? "right" : "left",
      }}>
        <span style={{ fontWeight:600, color:C.text, fontSize:15.5, flex:1, fontFamily:FONT_DISPLAY }}>{q}</span>
        <span style={{
          width:28, height:28, borderRadius:"50%", flexShrink:0,
          display:"flex", alignItems:"center", justifyContent:"center",
          background: isOpen ? "rgba(79,124,249,.18)" : "rgba(255,255,255,.05)",
          color:C.blue, fontSize:17,
          transform: isOpen ? "rotate(45deg)" : "none",
          transition:"transform .25s, background .25s",
        }}>+</span>
      </button>
      <motion.div
        initial={false}
        animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
        transition={{ duration:.28, ease:[0.22,1,0.36,1] }}
        style={{ overflow:"hidden" }}>
        <p style={{ color:C.sub, fontSize:15, lineHeight:1.7, margin:0, padding:"0 22px 20px" }}>{a}</p>
      </motion.div>
    </div>
  );
}

function FAQ({ lang }) {
  const ar = lang === "ar";
  const [open, setOpen] = useState(0);
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
    <section className="lp-section" style={{ background:C.bg1 }}>
      <div style={{ maxWidth:740, margin:"0 auto", padding:"0 24px" }}>
        <SectionHead title={ar ? "أسئلة شائعة" : "Frequently asked questions"} />
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {items.map(([q, a], i) => (
            <Reveal key={i} delay={i * 50} y={16}>
              <FAQItem q={q} a={a} ar={ar} isOpen={open===i} onToggle={() => setOpen(open===i ? null : i)}/>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Mid-page CTA (between HowItWorks and CaseStudies) ─────────────
// ── Mid-page CTA (compact, appears after Features + after CaseStudies) ──
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
            <div style={{ fontSize:17, fontWeight:700, color:C.text, marginBottom:5, fontFamily:FONT_DISPLAY }}>{m.h}</div>
            <div style={{ fontSize:12.5, color:C.muted }}>{m.sub}</div>
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
            <h2 style={{ ...TYPE.h2, color:C.text, margin:"0 0 14px", fontFamily:FONT_DISPLAY,
              fontSize:"clamp(22px,3vw,34px)" }}>
              {ar ? "ابدأ تحسين صحة فريقك اليوم" : "Start improving your team's health today"}
            </h2>
            <p style={{ ...TYPE.body, color:C.sub, maxWidth:460, margin:"0 auto 32px",
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

// ── Footer ────────────────────────────────────────────────────────
function Footer({ lang }) {
  const ar = lang === "ar";

  const sections = ar ? [
    { title:"المنتج", links:[["المميزات","#features"],["الأسعار","#pricing"],["كيف يعمل","#how"],["التكاملات","#"]] },
    { title:"الحلول", links:[["فرق HR","#casestudies"],["الصحة المهنية","#features"],["الفرق عن بُعد","#"],["المؤسسات","#enterprise"]] },
    { title:"الموارد", links:[["المدونة","#"],["دراسات الحالة","#casestudies"],["الأدلة","#"],["مركز المساعدة","#"]] },
    { title:"الشركة", links:[["من نحن","#"],["الأمان","#"],["الخصوصية","#privacy"],["تواصل معنا",`mailto:${SUPPORT_EMAIL}`]] },
  ] : [
    { title:"Product", links:[["Features","#features"],["Pricing","#pricing"],["How it works","#how"],["Integrations","#"]] },
    { title:"Solutions", links:[["HR Teams","#casestudies"],["Occupational Health","#features"],["Remote Teams","#"],["Enterprise","#enterprise"]] },
    { title:"Resources", links:[["Blog","#"],["Case Studies","#casestudies"],["Guides","#"],["Help Center","#"]] },
    { title:"Company", links:[["About","#"],["Security","#"],["Privacy Policy","#privacy"],["Contact",`mailto:${SUPPORT_EMAIL}`]] },
  ];

  const socials = [
    { label:"in", title:"LinkedIn",  href:"https://www.linkedin.com/in/mo-postureai" },
    { label:"𝕏",  title:"X",        href:"https://x.com/corvusposture" },
    { label:"▶",  title:"YouTube",  href:"https://youtube.com/@corvusai" },
    { label:"◉",  title:"Instagram",href:"https://instagram.com/corvusai" },
  ];

  return (
    <footer style={{ borderTop:`1px solid ${C.border}`, padding:"52px 24px 28px", background:C.bg }}>
      <div className="lp-wrap">
        <div className="lp-footer-grid" style={{ marginBottom:44 }}>
          {/* Brand */}
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
              <div style={{ width:30, height:30, borderRadius:8, flexShrink:0,
                background:"linear-gradient(135deg,#1a56db,#0891b2)",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:15, color:"#fff" }}>◈</div>
              <span style={{ fontWeight:800, color:C.text, fontSize:15, fontFamily:FONT_DISPLAY, letterSpacing:"-.02em" }}>Corvus</span>
            </div>
            <p style={{ fontSize:12.5, color:C.muted, lineHeight:1.75, maxWidth:210, margin:"0 0 16px" }}>
              {ar ? "للفرق في MENA. قلّل إجازات الأمراض وارفع الإنتاجية." : "Built for MENA teams. Improve posture, boost productivity."}
            </p>
            <div style={{ display:"flex", gap:6 }}>
              {socials.map(({ label, title, href }) => (
                <a key={label} href={href} title={title} target="_blank" rel="noopener noreferrer"
                  style={{ width:32, height:32, borderRadius:8,
                    background:"rgba(255,255,255,.05)", border:`1px solid ${C.border}`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    color:C.muted, fontSize:12, fontWeight:700, textDecoration:"none",
                    transition:"all .18s" }}
                  onMouseEnter={e=>{e.currentTarget.style.color=C.text;e.currentTarget.style.borderColor=C.borderM;e.currentTarget.style.background="rgba(255,255,255,.09)"}}
                  onMouseLeave={e=>{e.currentTarget.style.color=C.muted;e.currentTarget.style.borderColor=C.border;e.currentTarget.style.background="rgba(255,255,255,.05)"}}>
                  {label}
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {sections.map(sec => (
            <div key={sec.title}>
              <div style={{
                fontSize:11, fontWeight:700, letterSpacing:".08em",
                textTransform:"uppercase", color:C.muted, marginBottom:16,
              }}>
                {sec.title}
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:11 }}>
                {sec.links.map(([label, href]) => {
                  const isPlaceholder = href === "#" || href.startsWith("#privacy") || href.startsWith("#terms") || href.startsWith("#security") || href.startsWith("#gdpr") || href.startsWith("#how");
                  if (isPlaceholder) {
                    return (
                      <button key={label}
                        onClick={e=>{
                          e.preventDefault();
                          // Real section anchors scroll smoothly; pure "#" placeholders do nothing
                          if (href.length > 1) {
                            const el = document.querySelector(href);
                            if (el) el.scrollIntoView({ behavior:"smooth" });
                          }
                        }}
                        style={{
                          color:C.sub, fontSize:14, textDecoration:"none",
                          background:"none", border:"none", padding:0, cursor:"pointer",
                          textAlign: ar ? "right" : "left", transition:"color .18s",
                        }}
                        onMouseEnter={e=>e.currentTarget.style.color=C.text}
                        onMouseLeave={e=>e.currentTarget.style.color=C.sub}>
                        {label}
                      </button>
                    );
                  }
                  return (
                    <a key={label} href={href}
                      target={href.startsWith("http") ? "_blank" : undefined}
                      rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                      style={{ color:C.sub, fontSize:14, textDecoration:"none", transition:"color .18s" }}
                      onMouseEnter={e=>e.currentTarget.style.color=C.text}
                      onMouseLeave={e=>e.currentTarget.style.color=C.sub}>
                      {label}
                    </a>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div style={{
          borderTop:`1px solid ${C.border}`, paddingTop:24,
          display:"flex", justifyContent:"space-between", alignItems:"center",
          flexWrap:"wrap", gap:12, direction: ar ? "rtl" : "ltr",
        }}>
          <span style={{ fontSize:12.5, color:C.muted }}>
            © {new Date().getFullYear()} Corvus.{" "}
            {ar ? "جميع الحقوق محفوظة." : "All rights reserved."}
          </span>
          <div style={{ display:"flex", gap:20, alignItems:"center" }}>
            <span style={{ fontSize:12, color:C.muted, opacity:.7 }}>
              {ar ? "صُنع بـ ❤ في مصر" : "Made with ❤ in Egypt"}
            </span>
            <a href={`mailto:${SUPPORT_EMAIL}`}
              style={{ fontSize:12.5, color:C.sub, textDecoration:"none" }}
              onMouseEnter={e=>e.currentTarget.style.color=C.text}
              onMouseLeave={e=>e.currentTarget.style.color=C.sub}>
              {SUPPORT_EMAIL}
            </a>
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

  return (
    <div style={{ background:C.bg, minHeight:"100vh", color:C.text, fontFamily:FONT_DISPLAY }}>
      <GlobalStyle/>
      <Nav lang={lang} setLang={setLang} onCTA={handleCTA} mode={mode} setMode={setMode}/>
      <Hero lang={lang} onCTA={handleCTA} mode={mode} setMode={setMode}/>
      <SocialProof lang={lang}/>
      <Stats lang={lang}/>
      <Features lang={lang}/>
      <MidCTA lang={lang} onCTA={handleCTA} variant="features"/>
      <HowItWorks lang={lang}/>
      <MidCTA lang={lang} onCTA={handleCTA}/>
      <CaseStudies lang={lang}/>
      <MidCTA lang={lang} onCTA={handleCTA} variant="cases"/>
      <Pricing lang={lang} onCTA={handleCTA} mode={mode} isEgypt={isEgypt} setCurrencyOverride={setOverride}/>
      <Testimonials lang={lang}/>
      <FAQ lang={lang}/>
      <FinalCTA lang={lang} onCTA={handleCTA}/>
      <Footer lang={lang}/>
    </div>
  );
}