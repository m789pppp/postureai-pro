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
      .lp-wrap{max-width:1200px;margin:0 auto;width:100%}
      .lp-section{padding:64px 32px}
      @media(max-width:1024px){.lp-section{padding:48px 24px}}
      @media(max-width:600px){.lp-section{padding:36px 16px}}

      .lp-lift{transition:transform .3s cubic-bezier(.16,1,.3,1),border-color .3s}
      .lp-lift:hover{transform:translateY(-6px)}

      .lp-glow{position:relative;isolation:isolate}
      .lp-glow::before{content:"";position:absolute;inset:-1.5px;border-radius:inherit;
        background:linear-gradient(135deg,rgba(79,124,249,.55),rgba(34,211,238,.45));
        opacity:0;transition:opacity .35s;z-index:-1;filter:blur(16px)}
      .lp-glow:hover::before{opacity:1}

      .lp-btn:hover{transform:translateY(-2px)}
      .lp-btn-primary:hover{box-shadow:0 8px 32px rgba(79,124,249,.5)!important}
      .lp-btn-ghost:hover{background:rgba(255,255,255,.09)!important;border-color:${C.borderM}!important}
      .lp-btn-outline:hover{background:rgba(129,140,248,.08)!important}
      .lp-btn:active{transform:translateY(0)}

      @media(prefers-reduced-motion:reduce){
        .lp-lift,.lp-btn,.lp-glow::before{transition:none!important}
      }
      :focus-visible{outline:2px solid ${C.indigo};outline-offset:3px}
    `}</style>
  );
}

// ── Navigation ────────────────────────────────────────────────────
function Nav({ lang, setLang, onCTA }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);
  useEffect(() => {
    const h = () => { if (window.innerWidth > 860) setMobileOpen(false); };
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  const ar = lang === "ar";

  const navItems = ar ? [
    { label:"المنتج", href:"#features", hasDropdown:true },
    { label:"الحلول", href:"#casestudies", hasDropdown:true },
    { label:"الأسعار", href:"#pricing", hasDropdown:false },
    { label:"الموارد", href:"#", hasDropdown:true },
    { label:"الشركة", href:"#", hasDropdown:true },
  ] : [
    { label:"Product", href:"#features", hasDropdown:true },
    { label:"Solutions", href:"#casestudies", hasDropdown:true },
    { label:"Pricing", href:"#pricing", hasDropdown:false },
    { label:"Resources", href:"#", hasDropdown:true },
    { label:"Company", href:"#", hasDropdown:true },
  ];

  return (
    <nav style={{
      position:"fixed", top:0, left:0, right:0, zIndex:1000,
      padding:"0 32px",
      background: scrolled || mobileOpen ? "rgba(3,11,20,.95)" : "rgba(3,11,20,.6)",
      backdropFilter:"blur(20px)",
      borderBottom:`1px solid ${scrolled ? C.border : "transparent"}`,
      transition:"background .3s, border-color .3s",
    }}>
      <div className="lp-wrap" style={{
        height:68, display:"flex", alignItems:"center",
        justifyContent:"space-between", gap:24,
      }}>

        {/* ── Logo ── */}
        <a href="#" onClick={e=>e.preventDefault()} style={{
          display:"flex", alignItems:"center", gap:9,
          textDecoration:"none", flexShrink:0,
        }}>
          <div style={{
            width:34, height:34, borderRadius:9,
            background:"linear-gradient(135deg,#1a56db,#0891b2)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:17, boxShadow:"0 4px 14px rgba(79,124,249,.45)",
          }}>◈</div>
          <div style={{ lineHeight:1 }}>
            <div style={{ fontWeight:800, fontSize:15.5, color:C.text,
              fontFamily:FONT_DISPLAY, letterSpacing:"-.02em" }}>Corvus</div>
            <div style={{ fontSize:9.5, color:C.muted, fontWeight:500,
              letterSpacing:".04em", textTransform:"uppercase" }}>AI Posture Coaching</div>
          </div>
        </a>

        {/* ── Center nav links ── */}
        <div className="lp-nav-links" style={{
          display:"flex", alignItems:"center", gap:2,
          flex:1, justifyContent:"center",
        }}>
          {navItems.map(item => (
            <div key={item.label} style={{ position:"relative" }}
              onMouseEnter={() => item.hasDropdown && setActiveDropdown(item.label)}
              onMouseLeave={() => setActiveDropdown(null)}>
              <a href={item.href} style={{
                display:"flex", alignItems:"center", gap:4,
                color: activeDropdown===item.label ? C.text : C.sub,
                textDecoration:"none", padding:"8px 14px",
                borderRadius:8, fontSize:14, fontWeight:500,
                transition:"color .18s",
              }}
              onMouseEnter={e=>e.currentTarget.style.color=C.text}
              onMouseLeave={e=>e.currentTarget.style.color= activeDropdown===item.label ? C.text : C.sub}>
                {item.label}
                {item.hasDropdown && (
                  <svg width="11" height="7" viewBox="0 0 11 7" fill="none"
                    style={{ marginTop:1, transition:"transform .2s",
                      transform: activeDropdown===item.label ? "rotate(180deg)" : "none" }}>
                    <path d="M1 1L5.5 5.5L10 1" stroke={C.sub} strokeWidth="1.6" strokeLinecap="round"/>
                  </svg>
                )}
              </a>
            </div>
          ))}
        </div>

        {/* ── Right actions ── */}
        <div className="lp-nav-actions" style={{
          display:"flex", alignItems:"center", gap:8, flexShrink:0,
        }}>
          <button onClick={() => setLang(ar ? "en" : "ar")} style={{
            background:"transparent", border:`1px solid ${C.border}`,
            color:C.muted, padding:"6px 12px", borderRadius:7,
            cursor:"pointer", fontSize:12.5, fontWeight:500,
            transition:"border-color .18s, color .18s",
          }}
          onMouseEnter={e=>{e.currentTarget.style.color=C.text;e.currentTarget.style.borderColor=C.borderM}}
          onMouseLeave={e=>{e.currentTarget.style.color=C.muted;e.currentTarget.style.borderColor=C.border}}>
            {ar ? "EN" : "عربي"}
          </button>
          <a href="#" onClick={(e)=>{e.preventDefault();navTo("/auth")}} style={{
            color:C.sub, textDecoration:"none", fontSize:14, fontWeight:500,
            padding:"8px 12px", borderRadius:8, transition:"color .18s",
          }}
          onMouseEnter={e=>e.currentTarget.style.color=C.text}
          onMouseLeave={e=>e.currentTarget.style.color=C.sub}>
            {ar ? "تسجيل دخول" : "Log in"}
          </a>
          <a href="#" className="lp-btn lp-btn-primary"
            onClick={(e)=>{e.preventDefault();onCTA(e);navTo("/auth?mode=signup")}}
            style={{
              ...btn("primary","sm"),
              background:"linear-gradient(135deg,#1a56db,#0891b2)",
              boxShadow:"0 4px 18px rgba(26,86,219,.4)",
              borderRadius:10,
            }}>
            {ar ? "ابدأ مجاناً" : "Start Free Trial"}
          </a>
        </div>

        {/* Mobile burger */}
        <button aria-label="Open menu" aria-expanded={mobileOpen}
          className="lp-nav-burger" onClick={() => setMobileOpen(o => !o)}
          style={{
            display:"none", width:38, height:38, borderRadius:8, flexShrink:0,
            background:"rgba(255,255,255,.06)", border:`1px solid ${C.border}`,
            cursor:"pointer", alignItems:"center", justifyContent:"center",
          }}>
          <div style={{ width:17, height:12, position:"relative" }}>
            {[0,1,2].map(i => (
              <span key={i} style={{
                position:"absolute", left:0, right:0, height:1.5, borderRadius:2,
                background:C.text, top: i===0?0:i===1?5:10,
                transition:"transform .22s, opacity .18s",
                transform: mobileOpen
                  ? (i===0?"translateY(5px) rotate(45deg)":i===1?"scaleX(0)":"translateY(-5px) rotate(-45deg)")
                  : "none",
                opacity: mobileOpen&&i===1 ? 0 : 1,
              }}/>
            ))}
          </div>
        </button>
      </div>

      {/* Mobile panel */}
      {mobileOpen && (
        <motion.div
          initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:"auto" }}
          transition={{ duration:.22, ease:[0.22,1,0.36,1] }}
          style={{ overflow:"hidden", borderTop:`1px solid ${C.border}` }}>
          <div style={{ padding:"16px 24px 24px", display:"flex", flexDirection:"column", gap:4 }}>
            {navItems.map(item => (
              <a key={item.label} href={item.href} onClick={() => setMobileOpen(false)} style={{
                color:C.sub, textDecoration:"none", padding:"12px 6px",
                fontSize:15, fontWeight:500, borderBottom:`1px solid ${C.border}`,
              }}>{item.label}</a>
            ))}
            <a href="#" className="lp-btn lp-btn-primary"
              onClick={(e)=>{e.preventDefault();onCTA(e);navTo("/auth?mode=signup")}}
              style={{ ...btn("primary","lg"), width:"100%", marginTop:16 }}>
              {ar ? "ابدأ مجاناً" : "Start Free Trial"}
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
  const [neckAngle, setNeckAngle] = useState(15);
  useEffect(() => {
    const iv = setInterval(() => {
      setDemoScore(s => {
        const n = s + (Math.random() > .5 ? 1 : -1) * Math.floor(Math.random() * 3);
        return Math.max(60, Math.min(98, n));
      });
      setNeckAngle(a => {
        const n = a + (Math.random() > .5 ? 1 : -1);
        return Math.max(8, Math.min(18, n));
      });
    }, 1600);
    return () => clearInterval(iv);
  }, []);

  const scoreColor = demoScore >= 80 ? C.green : demoScore >= 60 ? C.amber : C.red;
  const float = (delay = 0, dist = 8) => reduce ? {} : {
    animate: { y: [0, -dist, 0] },
    transition: { duration: 5, repeat: Infinity, ease: "easeInOut", delay },
  };

  return (
    <section style={{
      minHeight:"100vh", display:"flex", alignItems:"center",
      padding:"100px 32px 64px", position:"relative", overflow:"hidden",
      background:C.bg,
    }}>
      {/* ── Ambient background glows (match image) ── */}
      <div style={{ position:"absolute", inset:0, pointerEvents:"none", overflow:"hidden" }}>
        {/* Blue glow center-right */}
        <div className="lp-drift-a" style={{
          position:"absolute", top:"10%", left:"55%",
          width:700, height:700,
          background:"radial-gradient(circle,rgba(79,124,249,.18) 0%,transparent 65%)",
          borderRadius:"50%", transform:"translate(-50%,-50%)",
        }}/>
        {/* Green glow bottom-left */}
        <div className="lp-drift-b" style={{
          position:"absolute", bottom:"5%", left:"8%",
          width:500, height:500,
          background:"radial-gradient(circle,rgba(16,217,160,.12) 0%,transparent 65%)",
          borderRadius:"50%",
        }}/>
        {/* Cyan glow far right */}
        <div style={{
          position:"absolute", top:"35%", right:"2%",
          width:350, height:350,
          background:"radial-gradient(circle,rgba(34,211,238,.09) 0%,transparent 65%)",
          borderRadius:"50%",
        }}/>
        {/* Subtle dot-grid overlay */}
        <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", opacity:.035 }}
          xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dotgrid" width="32" height="32" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill={C.sub}/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dotgrid)"/>
        </svg>
      </div>

      {/* ── Hero 3-column grid ── */}
      <div className="lp-wrap" style={{ width:"100%", position:"relative" }}>
        <div className="lp-hero-grid" style={{
          display:"grid",
          gridTemplateColumns:"1fr 1.1fr 220px",
          gap:"clamp(20px,3vw,36px)",
          alignItems:"start",
          direction: ar ? "rtl" : "ltr",
        }}>

          {/* ══ COL 1 — Hero copy ══ */}
          <div style={{ paddingTop:8 }}>

            {/* Individual / Company toggle — matches image */}
            <Reveal>
              <div style={{
                display:"inline-flex", alignItems:"center", gap:3,
                background:"rgba(255,255,255,.05)", border:`1px solid ${C.border}`,
                borderRadius:100, padding:3, marginBottom:20,
              }}>
                {[
                  { id:"individual", en:"👤 Individual", ar:"👤 فردي" },
                  { id:"company",    en:"🏢 Company / HR", ar:"🏢 شركات وفرق" },
                ].map(m => (
                  <button key={m.id} onClick={()=>setMode(m.id)} style={{
                    padding:"7px 16px", borderRadius:99, border:"none",
                    fontSize:13, fontWeight:600, cursor:"pointer",
                    background: mode===m.id
                      ? "linear-gradient(135deg,#1a56db,#0891b2)"
                      : "transparent",
                    color: mode===m.id ? "#fff" : C.sub,
                    boxShadow: mode===m.id ? "0 2px 12px rgba(26,86,219,.35)" : "none",
                    transition:"background .22s, color .22s, box-shadow .22s",
                  }}>
                    {ar ? m.ar : m.en}
                  </button>
                ))}
              </div>
            </Reveal>

            {/* "Now Available" pill */}
            <Reveal delay={30}>
              <div style={{
                display:"inline-flex", alignItems:"center", gap:8,
                background:"rgba(16,217,160,.08)",
                border:"1px solid rgba(16,217,160,.2)",
                borderRadius:100, padding:"6px 14px", marginBottom:22,
              }}>
                <span style={{
                  width:6, height:6, borderRadius:"50%", background:C.green,
                  boxShadow:`0 0 8px ${C.green}`,
                  animation:"lp-pulse 1.5s ease-in-out infinite",
                  flexShrink:0,
                }}/>
                <span style={{ fontSize:12.5, color:C.green, fontWeight:600, letterSpacing:".04em" }}>
                  {ar ? "متاح الآن · ابدأ مجاناً" : "NOW AVAILABLE · FREE TO START"}
                </span>
              </div>
            </Reveal>

            {/* Headline */}
            <Reveal delay={60}>
              <h1 style={{
                fontSize:"clamp(36px,4vw,58px)", fontWeight:800,
                lineHeight:1.08, letterSpacing:"-.03em",
                color:C.text, margin:"0 0 20px", fontFamily:FONT_DISPLAY,
              }}>
                {isCompany ? (
                  ar ? (
                    <><span style={{ background:C.gHero, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>قلّل إجازات الأمراض</span>{" "}47%{"\n"}مع تدريب الوضعية بالذكاء الاصطناعي</>
                  ) : (
                    <>Cut Sick Leave <span style={{ background:C.gHero, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>47%</span><br/>with <span style={{ background:C.gHero, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>AI Posture Coaching</span></>
                  )
                ) : (
                  ar ? (
                    <>اخلص من آلام الظهر<br/><span style={{ background:C.gHero, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>في أسبوعين فقط</span></>
                  ) : (
                    <>Stop Back Pain<br/><span style={{ background:C.gHero, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>in 2 Weeks</span></>
                  )
                )}
              </h1>
            </Reveal>

            {/* Subtext */}
            <Reveal delay={120}>
              <p style={{ fontSize:"clamp(15px,1.2vw,17px)", color:C.sub, lineHeight:1.7, maxWidth:440, margin:"0 0 32px" }}>
                {isCompany
                  ? (ar
                      ? "قلّل إجازات الأمراض المهنية بنسبة 47% وارفع الإنتاجية. منصة تحليل الوضعية بالذكاء الاصطناعي للمؤسسات."
                      : "Reduce occupational sick days by 47% and boost team productivity. Real-time AI posture coaching built for MENA enterprise teams.")
                  : (ar
                      ? "كاميرا اللابتوب بتاعك كافية. الذكاء الاصطناعي بيتابع وضعيتك في الخلفية ويبعتلك تنبيه لو انحنيت."
                      : "Your laptop camera is all you need. AI monitors your posture in the background and alerts you when you slouch — no hardware needed.")
                }
              </p>
            </Reveal>

            {/* CTAs */}
            <Reveal delay={180}>
              <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:28 }}>
                <a href="#" className="lp-btn lp-btn-primary"
                  onClick={(e)=>{e.preventDefault();onCTA(e);navTo("/auth?mode=signup")}}
                  style={{
                    ...btn("primary","lg"),
                    background:"linear-gradient(135deg,#1a56db,#0891b2)",
                    boxShadow:"0 6px 24px rgba(26,86,219,.45)",
                    borderRadius:12,
                  }}>
                  {isCompany
                    ? (ar ? "🚀 تجربة مجانية 7 أيام — لفريقي" : "🚀 Free 7-Day Trial — For My Team")
                    : (ar ? "🚀 تجربة مجانية 7 أيام" : "🚀 Start 7-Day Free Trial")}
                </a>
                <a href="#pricing" className="lp-btn lp-btn-ghost"
                  onClick={e=>onCTA(e)}
                  style={{
                    ...btn("ghost","lg"),
                    border:`1px solid ${C.borderM}`,
                    borderRadius:12,
                  }}>
                  {ar ? "عرض الأسعار" : "View Pricing"}
                </a>
            </div>
            {/* Trust badges row — below CTAs, exactly like image */}
            <div style={{ display:"flex", gap:"4px 20px", flexWrap:"wrap", alignItems:"center" }}>
              {(ar
                ? ["✓ مجاني 7 أيام","✓ بدون بطاقة بنكية","✓ بدون تحميل برنامج","✓ أي كاميرا لابتوب"]
                : ["✓ 7-day free trial","✓ No credit card","✓ No software to install","✓ Any laptop camera"]
              ).map(tr=>(
                <span key={tr} style={{ fontSize:12.5, color:C.muted, fontWeight:500 }}>{tr}</span>
              ))}
            </div>
          </Reveal>
        </div>{/* end col 1 */}

        {/* ══ COL 2 — Camera feed card ══ */}
        <Reveal delay={100}>
          <div style={{
            background:C.card,
            border:`1px solid rgba(79,124,249,.28)`,
            borderRadius:20, overflow:"hidden",
            boxShadow:"0 0 48px rgba(79,124,249,.1), 0 8px 32px rgba(0,0,0,.4)",
          }}>
            {/* Browser chrome */}
            <div style={{
              display:"flex", alignItems:"center", gap:6, padding:"10px 14px",
              borderBottom:`1px solid ${C.border}`,
              background:"rgba(255,255,255,.02)",
            }}>
              <span style={{ width:9, height:9, borderRadius:"50%", background:"#f87171" }}/>
              <span style={{ width:9, height:9, borderRadius:"50%", background:"#f59e0b" }}/>
              <span style={{ width:9, height:9, borderRadius:"50%", background:"#10d9a0" }}/>
              <div style={{ flex:1, display:"flex", justifyContent:"center" }}>
                <span style={{
                  fontSize:11, color:C.muted, fontFamily:FONT_MONO,
                  background:"rgba(255,255,255,.04)", padding:"3px 14px", borderRadius:6,
                }}>corvus-ai • live analysis</span>
              </div>
            </div>

            {/* Camera viewport */}
            <div style={{ position:"relative", background:"#050e1c", aspectRatio:"4/3", overflow:"hidden" }}>
              {/* Dark radial bg */}
              <div style={{ position:"absolute", inset:0,
                background:"radial-gradient(ellipse 70% 85% at 45% 40%, rgba(12,28,58,.95) 0%, rgba(2,5,14,1) 100%)" }}/>

              {/* Seated person + skeleton — matches uploaded image exactly */}
              <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%" }}
                viewBox="0 0 400 320" preserveAspectRatio="xMidYMid meet">

                {/* ── Desk & chair ── */}
                {/* Desk surface */}
                <rect x="60" y="228" width="280" height="8" rx="3" fill="rgba(20,42,80,.85)" stroke="rgba(79,124,249,.2)" strokeWidth="1"/>
                {/* Desk legs */}
                <rect x="80" y="236" width="8" height="84" rx="2" fill="rgba(15,32,62,.7)"/>
                <rect x="312" y="236" width="8" height="84" rx="2" fill="rgba(15,32,62,.7)"/>
                {/* Chair seat */}
                <rect x="148" y="235" width="104" height="14" rx="5" fill="rgba(18,36,70,.8)" stroke="rgba(79,124,249,.15)" strokeWidth="1"/>
                {/* Chair back */}
                <rect x="165" y="182" width="70" height="58" rx="5" fill="rgba(14,28,56,.7)" stroke="rgba(79,124,249,.12)" strokeWidth="1"/>
                {/* Chair legs */}
                <line x1="158" y1="249" x2="148" y2="290" stroke="rgba(18,36,70,.8)" strokeWidth="4" strokeLinecap="round"/>
                <line x1="242" y1="249" x2="252" y2="290" stroke="rgba(18,36,70,.8)" strokeWidth="4" strokeLinecap="round"/>

                {/* ── Monitor on desk ── */}
                <rect x="148" y="148" width="104" height="72" rx="4" fill="rgba(16,38,78,.75)" stroke="rgba(79,124,249,.35)" strokeWidth="1.5"/>
                {/* Screen glow */}
                <rect x="154" y="154" width="92" height="60" rx="2" fill="rgba(79,124,249,.1)"/>
                {/* Screen content lines */}
                <rect x="164" y="163" width="52" height="3" rx="1" fill="rgba(79,124,249,.5)"/>
                <rect x="164" y="171" width="36" height="2" rx="1" fill="rgba(79,124,249,.3)"/>
                <rect x="164" y="178" width="44" height="2" rx="1" fill="rgba(79,124,249,.2)"/>
                <rect x="164" y="185" width="30" height="2" rx="1" fill="rgba(79,124,249,.15)"/>
                {/* Monitor stand */}
                <rect x="192" y="220" width="16" height="10" rx="2" fill="rgba(20,42,80,.8)"/>
                <rect x="178" y="228" width="44" height="4" rx="2" fill="rgba(20,42,80,.7)"/>

                {/* ── Person body (seated silhouette) ── */}
                {/* Head */}
                <ellipse cx="200" cy="88" rx="28" ry="32" fill="rgba(28,52,100,.75)" stroke="rgba(79,124,249,.15)" strokeWidth="1"/>
                {/* Neck */}
                <rect x="192" y="118" width="16" height="20" rx="5" fill="rgba(24,46,90,.7)"/>
                {/* Torso */}
                <ellipse cx="200" cy="168" rx="32" ry="38" fill="rgba(22,44,88,.75)"/>
                {/* Left arm — bent forward toward desk */}
                <ellipse cx="162" cy="170" rx="11" ry="30" fill="rgba(20,40,80,.7)" transform="rotate(-8,162,170)"/>
                <ellipse cx="145" cy="210" rx="10" ry="22" fill="rgba(18,36,70,.65)" transform="rotate(15,145,210)"/>
                {/* Right arm */}
                <ellipse cx="238" cy="170" rx="11" ry="30" fill="rgba(20,40,80,.7)" transform="rotate(8,238,170)"/>
                <ellipse cx="255" cy="210" rx="10" ry="22" fill="rgba(18,36,70,.65)" transform="rotate(-15,255,210)"/>

                {/* ── Green skeleton overlay ── */}
                {/* Spine */}
                <line x1="200" y1="136" x2="200" y2="205" stroke="rgba(16,217,160,.85)" strokeWidth="3" strokeLinecap="round"/>
                {/* Shoulder bar */}
                <line x1="165" y1="150" x2="235" y2="150" stroke="rgba(16,217,160,.85)" strokeWidth="3" strokeLinecap="round"/>
                {/* Neck to shoulders */}
                <line x1="200" y1="136" x2="200" y2="150" stroke="rgba(16,217,160,.8)" strokeWidth="2.5" strokeLinecap="round"/>
                {/* Left arm */}
                <line x1="165" y1="150" x2="152" y2="195" stroke="rgba(16,217,160,.65)" strokeWidth="2.5" strokeLinecap="round"/>
                <line x1="152" y1="195" x2="142" y2="228" stroke="rgba(16,217,160,.5)" strokeWidth="2" strokeLinecap="round"/>
                {/* Right arm */}
                <line x1="235" y1="150" x2="248" y2="195" stroke="rgba(16,217,160,.65)" strokeWidth="2.5" strokeLinecap="round"/>
                <line x1="248" y1="195" x2="258" y2="228" stroke="rgba(16,217,160,.5)" strokeWidth="2" strokeLinecap="round"/>
                {/* Hip bar */}
                <line x1="175" y1="205" x2="225" y2="205" stroke="rgba(16,217,160,.7)" strokeWidth="2.5" strokeLinecap="round"/>

                {/* Amber neck line — forward tilt */}
                <line x1="200" y1="86" x2="200" y2="136" stroke="rgba(245,158,11,.9)" strokeWidth="2.5" strokeLinecap="round"/>

                {/* ── Landmark dots ── */}
                {/* Head top (amber — problem area) */}
                <circle cx="200" cy="72" r="7" fill="rgba(245,158,11,.95)" style={{filter:"drop-shadow(0 0 6px rgba(245,158,11,.8))"}}/>
                {/* Neck base (amber) */}
                <circle cx="200" cy="136" r="6" fill="rgba(245,158,11,.9)" style={{filter:"drop-shadow(0 0 4px rgba(245,158,11,.6))"}}/>
                {/* Shoulders (green) */}
                <circle cx="165" cy="150" r="5.5" fill="rgba(16,217,160,.95)" style={{filter:"drop-shadow(0 0 4px rgba(16,217,160,.6))"}}/>
                <circle cx="235" cy="150" r="5.5" fill="rgba(16,217,160,.95)" style={{filter:"drop-shadow(0 0 4px rgba(16,217,160,.6))"}}/>
                {/* Spine center */}
                <circle cx="200" cy="150" r="4.5" fill="rgba(16,217,160,.88)"/>
                <circle cx="200" cy="180" r="4" fill="rgba(16,217,160,.8)"/>
                {/* Hips */}
                <circle cx="175" cy="205" r="4.5" fill="rgba(16,217,160,.85)"/>
                <circle cx="225" cy="205" r="4.5" fill="rgba(16,217,160,.85)"/>
                {/* Elbows */}
                <circle cx="152" cy="195" r="4" fill="rgba(16,217,160,.75)"/>
                <circle cx="248" cy="195" r="4" fill="rgba(16,217,160,.75)"/>
                {/* Wrists */}
                <circle cx="142" cy="228" r="3.5" fill="rgba(16,217,160,.6)"/>
                <circle cx="258" cy="228" r="3.5" fill="rgba(16,217,160,.6)"/>

                {/* ── Neck angle indicator ── exactly like image */}
                {/* Vertical reference line */}
                <line x1="200" y1="72" x2="200" y2="108" stroke="rgba(255,255,255,.2)" strokeWidth="1.2" strokeDasharray="4,3"/>
                {/* Angle line */}
                <line x1="200" y1="72" x2={200+neckAngle*1.4} y2="108" stroke="rgba(245,158,11,.9)" strokeWidth="1.5" strokeDasharray="4,3"/>
                {/* Angle arc */}
                <path d={`M200,88 Q${204+neckAngle*.6},82 ${200+neckAngle*1.1},76`}
                  fill="none" stroke="rgba(245,158,11,.5)" strokeWidth="1" strokeDasharray="2,2"/>
                {/* Angle label */}
                <text x={208+neckAngle*1.2} y="88" fill="rgba(245,158,11,.95)"
                  fontSize="13" fontFamily="monospace" fontWeight="bold">{neckAngle}°</text>
              </svg>

              {/* LIVE + warning — single pill like image */}
              <div style={{
                position:"absolute", top:10, left:10,
                display:"flex", alignItems:"center", gap:6,
                background:"rgba(0,0,0,.72)", backdropFilter:"blur(12px)",
                borderRadius:99, padding:"5px 12px",
                border:"1px solid rgba(16,217,160,.3)",
              }}>
                <span style={{
                  width:7, height:7, borderRadius:"50%", background:C.green,
                  boxShadow:`0 0 8px ${C.green}`,
                  animation:"lp-pulse 1.5s ease-in-out infinite", flexShrink:0,
                }}/>
                <span style={{ fontSize:11, color:C.green, fontWeight:700, fontFamily:FONT_MONO }}>LIVE</span>
                <span style={{ fontSize:10.5, color:"rgba(255,255,255,.7)", fontFamily:FONT_MONO }}>
                  {ar ? "رقبة للأمام" : "Neck forward"} {neckAngle}°
                </span>
                <span style={{ fontSize:12 }}>⚠️</span>
              </div>
            </div>

            {/* 3-metric strip */}
            <div style={{
              padding:"12px 18px", display:"grid", gridTemplateColumns:"1fr 1fr 1fr",
              gap:8, borderTop:`1px solid ${C.border}`,
              background:"rgba(255,255,255,.015)",
            }}>
              {(ar
                ? [["انحناء الرقبة",`${neckAngle}°`,C.amber],["وضع الكتف","جيد ✓",C.green],["المسافة","58cm",C.blue]]
                : [["Neck Tilt",`${neckAngle}°`,C.amber],["Shoulder","Good ✓",C.green],["Distance","58cm",C.blue]]
              ).map(([label,val,color])=>(
                <div key={label} style={{ textAlign:"center" }}>
                  <div style={{ fontSize:16, fontWeight:700, color, fontFamily:FONT_MONO }}>{val}</div>
                  <div style={{ fontSize:10, color:C.muted, marginTop:2 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* AI tip */}
            <div style={{
              margin:"0 14px 14px", padding:"10px 13px",
              background:"rgba(79,124,249,.07)", borderRadius:12,
              border:"1px solid rgba(79,124,249,.15)",
              display:"flex", gap:8, alignItems:"flex-start",
            }}>
              <span style={{ fontSize:14, flexShrink:0, marginTop:1 }}>🤖</span>
              <p style={{ margin:0, fontSize:12, color:C.sub, lineHeight:1.55 }}>
                {ar
                  ? "رقبتك للأمام قليلاً. ارفع الشاشة 2 سم وحاول تمرين سحب الرقبة 10 مرات."
                  : "Neck is slightly forward. Raise your monitor 2cm and try 10 chin tucks now."}
              </p>
            </div>
          </div>
        </Reveal>

        {/* ══ COL 3 — Metrics panel ══ */}
        <div style={{ display:"flex", flexDirection:"column", gap:8, paddingTop:4 }}>

          {/* -47% card */}
          <motion.div {...float(0,7)} style={{
            background:C.card, border:`1px solid ${C.border}`,
            borderRadius:16, padding:"14px 14px 12px",
            backdropFilter:"blur(12px)",
          }}>
            <div style={{ fontSize:26, fontWeight:800, color:C.green,
              fontFamily:FONT_MONO, lineHeight:1 }}>-47%</div>
            <div style={{ fontSize:10, color:C.muted, marginTop:4, lineHeight:1.3 }}>
              {ar ? "إجازات مرضية" : "sick leave"}
            </div>
            <svg width="100%" height="24" viewBox="0 0 120 24" preserveAspectRatio="none"
              style={{ display:"block", marginTop:8 }}>
              <defs>
                <linearGradient id="m47g" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.green} stopOpacity=".4"/>
                  <stop offset="100%" stopColor={C.green} stopOpacity="0"/>
                </linearGradient>
              </defs>
              <path d="M0,20 L20,17 L40,13 L60,15 L80,8 L100,4 L120,1"
                fill="none" stroke={C.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M0,20 L20,17 L40,13 L60,15 L80,8 L100,4 L120,1 L120,24 L0,24 Z"
                fill="url(#m47g)"/>
            </svg>
          </motion.div>

          {/* Corvus Pro label */}
          <div style={{
            background:C.card, border:`1px solid ${C.border}`,
            borderRadius:16, padding:"12px 14px",
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:5 }}>
              <div style={{
                width:18, height:18, borderRadius:5, flexShrink:0,
                background:"linear-gradient(135deg,#1a56db,#0891b2)",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:10, color:"#fff",
              }}>◈</div>
              <span style={{ fontSize:11.5, fontWeight:700, color:C.text, fontFamily:FONT_DISPLAY }}>
                Corvus Pro
              </span>
            </div>
            <div style={{ fontSize:9.5, color:C.muted, fontFamily:FONT_MONO }}>
              {new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"numeric",year:"2-digit"})}
              {", "}
              {new Date().toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}
            </div>
          </div>

          {/* Score donut */}
          <div style={{
            background:C.card, border:`1px solid ${C.border}`,
            borderRadius:16, padding:"16px 14px", textAlign:"center",
          }}>
            <div style={{ position:"relative", width:78, height:78, margin:"0 auto 8px" }}>
              <svg width="78" height="78" style={{ transform:"rotate(-90deg)" }}>
                <circle cx="39" cy="39" r="31" fill="none"
                  stroke="rgba(255,255,255,.05)" strokeWidth="7"/>
                <circle cx="39" cy="39" r="31" fill="none"
                  stroke={scoreColor} strokeWidth="7"
                  strokeDasharray={`${(demoScore/100)*194.8} 194.8`}
                  strokeLinecap="round"
                  style={{ transition:"stroke-dasharray .8s ease, stroke .4s" }}/>
              </svg>
              <div style={{
                position:"absolute", inset:0,
                display:"flex", alignItems:"center", justifyContent:"center",
              }}>
                <span style={{
                  fontSize:22, fontWeight:800, color:scoreColor,
                  fontFamily:FONT_MONO, lineHeight:1,
                  transition:"color .4s",
                }}>{demoScore}</span>
              </div>
            </div>
            <div style={{ fontSize:10, color:C.muted, letterSpacing:".04em" }}>
              {ar ? "النقطة" : "score"}
            </div>
          </div>

          {/* Trend chart card */}
          <motion.div {...float(1.5,6)} style={{
            background:C.card, border:`1px solid ${C.border}`,
            borderRadius:16, padding:"12px 14px",
          }}>
            <svg width="100%" height="42" viewBox="0 0 120 42" preserveAspectRatio="none"
              style={{ display:"block" }}>
              <defs>
                <linearGradient id="trendG2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.green} stopOpacity=".3"/>
                  <stop offset="100%" stopColor={C.green} stopOpacity="0"/>
                </linearGradient>
              </defs>
              <path d="M0,36 L20,31 L40,23 L60,27 L80,14 L100,8 L120,3"
                fill="none" stroke={C.green} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M0,36 L20,31 L40,23 L60,27 L80,14 L100,8 L120,3 L120,42 L0,42 Z"
                fill="url(#trendG2)"/>
            </svg>
            <div style={{ fontSize:9.5, color:C.muted, marginTop:4, textAlign:"center" }}>
              {ar ? "+18 نقطة / 45 دق" : "+18 score / 45 min"}
            </div>
          </motion.div>

        </div>{/* end col 3 */}
      </div>{/* end 3-col grid */}
      </div>

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
        @keyframes lp-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(1.4)}}
        @keyframes lp-drift-a{0%,100%{transform:translate(-50%,-50%)}50%{transform:translate(-46%,-54%)}}
        @keyframes lp-drift-b{0%,100%{transform:translate(0,0)}50%{transform:translate(3%,-4%)}}
        .lp-drift-a{animation:lp-drift-a 16s ease-in-out infinite}
        .lp-drift-b{animation:lp-drift-b 20s ease-in-out infinite}
        @media(prefers-reduced-motion:reduce){.lp-drift-a,.lp-drift-b{animation:none}}
        @media(max-width:860px){.lp-hero-grid{grid-template-columns:1fr!important;gap:56px!important}}
      `}</style>
    </section>
  );
}

// ── Social proof bar ──────────────────────────────────────────────
function SocialProof({ lang }) {
  const ar = lang === "ar";
  return (
    <section style={{
      borderTop:`1px solid ${C.border}`, borderBottom:`1px solid ${C.border}`,
      padding:"32px 24px", background:"rgba(255,255,255,.012)",
    }}>
      <Reveal>
        <div className="lp-wrap">
          {/* Row 1 — 4 trust stats */}
          <div style={{
            display:"grid", gridTemplateColumns:"repeat(4,1fr)",
            gap:16, marginBottom:24, textAlign:"center",
          }}>
            {(ar ? [
              ["50+","مستخدم بيتا نشط","👥"],
              ["4.9★","تقييم متوسط","⭐"],
              ["أسبوعان","وقت التحسن","⏱"],
              ["0","لا نحفظ فيديو","🛡"],
            ] : [
              ["50+","active beta users","👥"],
              ["4.9★","average rating","⭐"],
              ["2 weeks","avg improvement time","⏱"],
              ["0","video data stored","🛡"],
            ]).map(([num, label, icon]) => (
              <div key={label} style={{
                background:"rgba(255,255,255,.03)", border:`1px solid ${C.border}`,
                borderRadius:14, padding:"16px 12px",
                display:"flex", flexDirection:"column", alignItems:"center", gap:6,
              }}>
                <span style={{ fontSize:13 }}>{icon}</span>
                <div style={{ fontSize:20, fontWeight:800, color:C.text, fontFamily:FONT_MONO, lineHeight:1 }}>{num}</div>
                <div style={{ fontSize:11, color:C.muted }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Row 2 — Used at + security badges */}
          <div style={{
            display:"flex", alignItems:"center", justifyContent:"space-between",
            flexWrap:"wrap", gap:"12px 24px",
          }}>
            {/* Left: used at */}
            <div style={{ display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
              <span style={{ fontSize:11, color:C.muted, fontWeight:600, letterSpacing:".06em", textTransform:"uppercase" }}>
                {ar ? "يُستخدم في" : "Currently used at"}
              </span>
              <div style={{
                background:"rgba(255,255,255,.04)", border:`1px solid ${C.border}`,
                borderRadius:10, padding:"7px 16px",
                fontSize:13.5, fontWeight:700, color:C.text,
              }}>Coventry University</div>
              <div style={{ fontSize:12.5, color:C.muted }}>
                {ar ? "جامعة القاهرة — تجريبي · 50+ مستخدم في 4 دول" : "Cairo University — Pilot · 50+ users across 4 countries"}
              </div>
            </div>

            {/* Right: security badges */}
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {[
                {icon:"🛡", text:"ISO 27001\nAligned"},
                {icon:"🔒", text:"AES-256\nEncryption"},
                {icon:"✅", text:"GDPR\nReady"},
                {icon:"📷", text:"On-device AI\nNo Video Stored"},
              ].map(b => (
                <div key={b.text} style={{
                  display:"flex", alignItems:"center", gap:6,
                  background:"rgba(59,130,246,.06)", border:"1px solid rgba(59,130,246,.15)",
                  borderRadius:10, padding:"7px 11px",
                }}>
                  <span style={{ fontSize:13 }}>{b.icon}</span>
                  <span style={{ fontSize:10, color:"#60a5fa", fontWeight:600, lineHeight:1.3,
                    whiteSpace:"pre-line", fontFamily:FONT_MONO }}>{b.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Reveal>
      <style>{`@media(max-width:860px){
        .lp-sp-stats{grid-template-columns:1fr 1fr!important}
        .lp-sp-row2{flex-direction:column!important}
      }`}</style>
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
    <section className="lp-section" style={{ paddingTop:"clamp(60px,7vw,100px)", paddingBottom:"clamp(60px,7vw,100px)" }}>
      <div className="lp-wrap lp-stats-grid" style={{
        display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:22 }}>
        {stats.map(([val, label, source], i) => {
          const spkPaths = [
            "M0,20 L14,17 L28,12 L42,15 L56,7 L70,4 L84,1",
            "M0,18 L14,15 L28,10 L42,13 L56,5 L70,3 L84,1",
            "M0,20 L14,16 L28,11 L42,14 L56,6 L70,3 L84,1",
            "M0,19 L14,16 L28,12 L42,14 L56,7 L70,4 L84,2",
          ];
          const spkColors = [C.green, C.indigo, C.sky, C.green];
          const sc = spkColors[i];
          return (
          <Reveal key={label} delay={i * 80} y={20}>
            <div className="lp-lift" style={{ ...card(), textAlign:"center", padding:"32px 24px 24px" }}>
              <div style={{
                fontSize:"clamp(38px,3.2vw,52px)", fontWeight:700, letterSpacing:"-.02em",
                background:C.gHero, WebkitBackgroundClip:"text",
                WebkitTextFillColor:"transparent", lineHeight:1, marginBottom:12,
                fontFamily:FONT_MONO,
              }}>{val}</div>
              <div style={{ fontSize:14.5, color:C.sub, lineHeight:1.5 }}>{label}</div>
              {source && <div style={{ fontSize:10, color:C.sub, opacity:.5, marginTop:6, lineHeight:1.4 }}>{source}</div>}
              {/* Sparkline */}
              <div style={{ display:"flex", justifyContent:"center", marginTop:18 }}>
                <svg width="84" height="22" viewBox="0 0 84 22" style={{ overflow:"visible" }}>
                  <defs>
                    <linearGradient id={`sg${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={sc} stopOpacity=".35"/>
                      <stop offset="100%" stopColor={sc} stopOpacity="0"/>
                    </linearGradient>
                  </defs>
                  <path d={spkPaths[i]} fill="none" stroke={sc} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d={spkPaths[i]+" L84,22 L0,22 Z"} fill={`url(#sg${i})`}/>
                </svg>
              </div>
            </div>
          </Reveal>
          );
        })}
      </div>
      <style>{`
        @media(max-width:860px){.lp-stats-grid{grid-template-columns:1fr 1fr!important}}
        @media(max-width:480px){.lp-stats-grid{grid-template-columns:1fr!important}}
      `}</style>
    </section>
  );
}

// ── Features ──────────────────────────────────────────────────────
function Features({ lang }) {
  const ar = lang === "ar";
  const [active, setActive] = useState(0);
  useEffect(() => { setActive(0); }, [ar]);

  const features = ar ? [
    { icon:"🎯", title:"تحليل دقيق بالذكاء الاصطناعي",
      desc:"478 نقطة تتبع + تحليل ثلاثي الأبعاد بدقة ~96%",
      detail:"تقنية MediaPipe FaceMesh المتقدمة تتتبع 478 نقطة معلم لتقييم الوضعية بدقة طبية." },
    { icon:"📊", title:"لوحة HR الذكية",
      desc:"تحليلات فورية لصحة الفريق والمخاطر المهنية",
      detail:"لوحة قيادة متكاملة تعرض مؤشرات الأداء، تنبيهات المخاطر، وتقارير PDF." },
    { icon:"🤖", title:"مدرب AI شخصي",
      desc:"توصيات مخصصة بالذكاء الاصطناعي",
      detail:"محادثة AI تفاعلية تحلل بيانات الجلسة وتقدم توصيات علاجية مخصصة." },
    { icon:"🔗", title:"تكاملات المؤسسات",
      desc:"Slack · Teams · Jira · SAP HR",
      detail:"API متكامل مع أنظمة HR الموجودة. تنبيهات تلقائية على Slack وTeams." },
    { icon:"🛡️", title:"أمان المستوى المؤسسي",
      desc:"SAML SSO · RBAC · تشفير كامل",
      detail:"ISO27001 · تشفير AES-256 · سجلات تدقيق شاملة." },
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
          title={ar ? "كل ما يحتاجه برنامج صحة موظفيك" : "Everything your workforce health program needs"}
          sub={ar ? "من التحليل الفوري إلى الرؤى المؤسسية — كل شيء في مكان واحد"
                  : "From real-time analysis to enterprise insights — everything in one platform"}/>

        <div style={{
          display:"grid", gridTemplateColumns:"1fr 1fr", gap:32, alignItems:"start",
        }} className="lp-features-wrap">

          {/* Left — Human body illustration + feature tabs */}
          <div>
            {/* SVG Human body with pose landmarks */}
            <div style={{
              background:"rgba(255,255,255,.025)", border:`1px solid ${C.border}`,
              borderRadius:20, padding:"28px 24px", marginBottom:20, textAlign:"center",
              position:"relative", overflow:"hidden",
            }}>
              {/* Glow behind figure */}
              <div style={{
                position:"absolute", top:"30%", left:"50%", transform:"translate(-50%,-50%)",
                width:280, height:280,
                background:"radial-gradient(circle,rgba(79,124,249,.14) 0%,transparent 70%)",
                borderRadius:"50%", pointerEvents:"none",
              }}/>
              <svg viewBox="0 0 220 340" width="180" height="280" style={{ display:"block", margin:"0 auto", position:"relative" }}>
                {/* Body glow */}
                <ellipse cx="110" cy="170" rx="60" ry="100" fill="rgba(79,124,249,.06)"/>

                {/* Body skeleton — standing pose */}
                {/* Head */}
                <circle cx="110" cy="42" r="26" fill="rgba(40,68,115,.7)" stroke="rgba(79,124,249,.3)" strokeWidth="1"/>
                {/* Neck */}
                <line x1="110" y1="68" x2="110" y2="88" stroke="rgba(16,217,160,.8)" strokeWidth="3" strokeLinecap="round"/>
                {/* Shoulders */}
                <line x1="60" y1="100" x2="160" y2="100" stroke="rgba(16,217,160,.8)" strokeWidth="3" strokeLinecap="round"/>
                {/* Spine */}
                <line x1="110" y1="88" x2="110" y2="190" stroke="rgba(16,217,160,.7)" strokeWidth="2.5" strokeLinecap="round"/>
                {/* Left arm */}
                <line x1="60" y1="100" x2="38" y2="165" stroke="rgba(16,217,160,.65)" strokeWidth="2.5" strokeLinecap="round"/>
                <line x1="38" y1="165" x2="28" y2="218" stroke="rgba(16,217,160,.5)" strokeWidth="2" strokeLinecap="round"/>
                {/* Right arm */}
                <line x1="160" y1="100" x2="182" y2="165" stroke="rgba(16,217,160,.65)" strokeWidth="2.5" strokeLinecap="round"/>
                <line x1="182" y1="165" x2="192" y2="218" stroke="rgba(16,217,160,.5)" strokeWidth="2" strokeLinecap="round"/>
                {/* Hips */}
                <line x1="80" y1="190" x2="140" y2="190" stroke="rgba(16,217,160,.75)" strokeWidth="2.5" strokeLinecap="round"/>
                {/* Left leg */}
                <line x1="80" y1="190" x2="72" y2="268" stroke="rgba(16,217,160,.6)" strokeWidth="2.5" strokeLinecap="round"/>
                <line x1="72" y1="268" x2="68" y2="330" stroke="rgba(16,217,160,.45)" strokeWidth="2" strokeLinecap="round"/>
                {/* Right leg */}
                <line x1="140" y1="190" x2="148" y2="268" stroke="rgba(16,217,160,.6)" strokeWidth="2.5" strokeLinecap="round"/>
                <line x1="148" y1="268" x2="152" y2="330" stroke="rgba(16,217,160,.45)" strokeWidth="2" strokeLinecap="round"/>

                {/* Landmark dots */}
                {[
                  [110,42],[110,68],[60,100],[160,100],[110,100],[110,145],[110,190],
                  [80,190],[140,190],[38,165],[182,165],[28,218],[192,218],
                  [72,268],[148,268],[68,330],[152,330]
                ].map(([x,y],i)=>(
                  <circle key={i} cx={x} cy={y} r={i===0?5:i<4?4.5:3.5}
                    fill={i<=1?"rgba(245,158,11,.9)":"rgba(16,217,160,.92)"}
                    style={{ filter: i<=1?"drop-shadow(0 0 5px rgba(245,158,11,.6))":"drop-shadow(0 0 3px rgba(16,217,160,.5))" }}/>
                ))}

                {/* Floating angle annotation */}
                <text x="125" y="52" fill="rgba(245,158,11,.9)" fontSize="10" fontFamily="monospace" fontWeight="bold">12°</text>
                <line x1="118" y1="52" x2="126" y2="52" stroke="rgba(245,158,11,.7)" strokeWidth="1" strokeDasharray="2,1"/>

                {/* Connecting lines for visual flair */}
                <circle cx="110" cy="88" r="4" fill="rgba(16,217,160,.9)"/>
                <circle cx="110" cy="190" r="4.5" fill="rgba(16,217,160,.9)"/>
              </svg>

              {/* Stats row below figure */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:16 }}>
                {[
                  [ar?"وقت الإعداد":"15 min","⏱", ar?"الإعداد الكامل":"Team onboarding time"],
                  [ar?"رضا المستخدمين":"98%","😊", ar?"اختُبر مع المستخدمين":"Beta user satisfaction"],
                ].map(([val, icon, label])=>(
                  <div key={label} style={{
                    background:"rgba(255,255,255,.03)", border:`1px solid ${C.border}`,
                    borderRadius:12, padding:"12px 10px", textAlign:"center",
                  }}>
                    <div style={{ fontSize:11, marginBottom:4 }}>{icon}</div>
                    <div style={{ fontSize:18, fontWeight:800, color:C.text, fontFamily:FONT_MONO, lineHeight:1 }}>{val}</div>
                    <div style={{ fontSize:10, color:C.muted, marginTop:4, lineHeight:1.3 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Feature tabs */}
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              {features.map((item, i) => (
                <button key={i} onClick={() => setActive(i)} style={{
                  background: active===i ? "rgba(79,124,249,.1)" : "transparent",
                  border: active===i ? "1px solid rgba(79,124,249,.25)" : `1px solid transparent`,
                  borderRadius:12, padding:"12px 14px",
                  cursor:"pointer", textAlign:ar?"right":"left",
                  display:"flex", alignItems:"center", gap:10,
                  transition:"background .2s, border-color .2s",
                }}>
                  <span style={{
                    width:34, height:34, borderRadius:9, flexShrink:0,
                    display:"flex", alignItems:"center", justifyContent:"center", fontSize:16,
                    background: active===i ? C.gBlue : "rgba(255,255,255,.04)",
                    transition:"background .2s",
                  }}>{item.icon}</span>
                  <div style={{ textAlign:"left" }}>
                    <div style={{ fontSize:13.5, fontWeight:600, color:active===i?C.text:C.sub }}>{item.title}</div>
                    <div style={{ fontSize:11.5, color:C.muted, marginTop:2 }}>{item.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right — active feature detail card */}
          <motion.div key={active}
            initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
            transition={{ duration:.32, ease:[0.22,1,0.36,1] }}>
            <div style={{
              background:"rgba(255,255,255,.03)", border:`1px solid rgba(79,124,249,.22)`,
              borderRadius:20, padding:"32px 28px",
              boxShadow:"0 0 40px rgba(79,124,249,.07)",
            }}>
              <span style={{
                width:56, height:56, borderRadius:16, fontSize:26,
                display:"flex", alignItems:"center", justifyContent:"center",
                background:C.gBlue, boxShadow:"0 6px 20px rgba(79,124,249,.35)",
                marginBottom:20,
              }}>{f.icon}</span>
              <h3 style={{ fontSize:22, fontWeight:700, color:C.text, margin:"0 0 10px", fontFamily:FONT_DISPLAY }}>
                {f.title}
              </h3>
              <p style={{ fontSize:15, color:C.indigo, margin:"0 0 16px", fontWeight:500 }}>
                {f.desc}
              </p>
              <p style={{ fontSize:14.5, color:C.sub, lineHeight:1.75, margin:"0 0 24px" }}>
                {f.detail}
              </p>
              <a href="#" style={{
                display:"inline-flex", alignItems:"center", gap:6,
                color:C.blue, fontSize:14, fontWeight:600, textDecoration:"none",
                transition:"gap .18s",
              }}
              onMouseEnter={e=>e.currentTarget.style.gap="10px"}
              onMouseLeave={e=>e.currentTarget.style.gap="6px"}>
                {ar ? "اعرف أكثر عن الـ AI ←" : "Learn more about our AI →"}
              </a>
            </div>
          </motion.div>
        </div>
      </div>
      <style>{`
        @media(max-width:860px){
          .lp-features-wrap{grid-template-columns:1fr!important}
        }
      `}</style>
    </section>
  );
}

// ── How It Works ──────────────────────────────────────────────────
function HowItWorks({ lang }) {
  const ar = lang === "ar";
  const steps = ar ? [
    { n:"01", icon:"👤", title:"الإعداد السريع", desc:"أضف فريقك بالـ CSV أو رابط الدعوة. الإعداد الكامل في 15 دقيقة." },
    { n:"02", icon:"📷", title:"التحليل الفوري", desc:"الموظفون يستخدمون الكاميرا للتحليل. لا يلزم أي جهاز خاص." },
    { n:"03", icon:"📊", title:"رؤى قابلة للتنفيذ", desc:"تقارير HR أسبوعية وتنبيهات فورية للمخاطر المهنية." },
  ] : [
    { n:"01", icon:"👤", title:"Quick Setup", desc:"Add your team via CSV or invite link. Full onboarding in 15 minutes." },
    { n:"02", icon:"📷", title:"Instant Analysis", desc:"Employees use their webcam for analysis. No special hardware needed." },
    { n:"03", icon:"📊", title:"Actionable Insights", desc:"Get weekly HR reports and real-time alerts for occupational risks." },
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
          <Stagger key={String(ar)} className="lp-steps-grid" gap={0.12} style={{
            display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:28, position:"relative" }}>
            {steps.map((s) => (
              <StaggerItem key={s.n}>
                <div className="lp-lift" style={{ ...card(), textAlign:"center", padding:"36px 24px" }}>
                  <div className="lp-timeline-node" style={{
                    width:64, height:64, borderRadius:"50%", margin:"-64px auto 20px",
                    background:C.bg1, border:`2px solid rgba(79,124,249,.4)`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:26,
                    boxShadow:"0 0 0 6px "+C.bg1+", 0 4px 18px rgba(79,124,249,.25)",
                  }}>{s.icon}</div>
                  <div style={{
                    fontSize:11, fontWeight:700, color:C.blue, fontFamily:FONT_MONO,
                    letterSpacing:".08em", marginBottom:8,
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

        <Stagger key={String(ar)} className="lp-cases-grid" style={{
          display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:24 }}>
          {cases.map((c, ci) => {
            // SVG background scenes: telecom tower / bank building / tech office — like image
            const bgSvgs = [
              <svg key="tc" style={{ position:"absolute", inset:0, width:"100%", height:"60%", opacity:.13, pointerEvents:"none" }} viewBox="0 0 260 180" preserveAspectRatio="xMidYMax meet">
                <rect x="120" y="10" width="20" height="170" fill="#4f7cf9" rx="2"/>
                <rect x="110" y="25" width="40" height="6" fill="#4f7cf9" rx="1"/>
                <rect x="100" y="42" width="60" height="5" fill="#4f7cf9" rx="1"/>
                <rect x="86" y="60" width="88" height="5" fill="#4f7cf9" rx="1"/>
                <line x1="130" y1="10" x2="86" y2="40" stroke="#4f7cf9" strokeWidth="1"/>
                <line x1="130" y1="10" x2="174" y2="40" stroke="#4f7cf9" strokeWidth="1"/>
                <rect x="40" y="120" width="180" height="60" fill="#4f7cf9" rx="3" opacity=".7"/>
                <rect x="60" y="100" width="140" height="28" fill="#4f7cf9" rx="2" opacity=".5"/>
              </svg>,
              <svg key="bk" style={{ position:"absolute", inset:0, width:"100%", height:"60%", opacity:.12, pointerEvents:"none" }} viewBox="0 0 260 180" preserveAspectRatio="xMidYMax meet">
                <rect x="30" y="75" width="200" height="105" fill="#818cf8" rx="3"/>
                <rect x="20" y="65" width="220" height="16" fill="#818cf8" rx="2"/>
                <rect x="80" y="50" width="100" height="20" fill="#818cf8" rx="2"/>
                <rect x="122" y="34" width="16" height="18" fill="#818cf8"/>
                {[50,78,106,134,162,190].map(x=><rect key={x} x={x} y={82} width="14" height="98" fill="rgba(255,255,255,.07)" rx="1"/>)}
                <rect x="102" y="148" width="56" height="32" fill="rgba(255,255,255,.05)" rx="2"/>
              </svg>,
              <svg key="of" style={{ position:"absolute", inset:0, width:"100%", height:"60%", opacity:.11, pointerEvents:"none" }} viewBox="0 0 260 180" preserveAspectRatio="xMidYMax meet">
                <rect x="10" y="10" width="240" height="170" fill="#22d3ee" rx="5"/>
                {[30,65,100,135,170,205].map(x=>[0,1,2,3].map(r=>(
                  <rect key={`${x}-${r}`} x={x} y={20+r*40} width="25" height="28" fill="rgba(255,255,255,.07)" rx="2"/>
                )))}
                <rect x="40" y="155" width="180" height="18" fill="rgba(255,255,255,.04)" rx="2"/>
              </svg>,
            ];

            return (
            <StaggerItem key={c.co}>
              <div className="lp-lift" style={{ ...card(), height:"100%", position:"relative", overflow:"hidden" }}>
                {/* Background scene */}
                {bgSvgs[ci]}
                {/* Gradient overlay for readability */}
                <div style={{ position:"absolute", inset:0, pointerEvents:"none",
                  background:"linear-gradient(180deg, rgba(13,31,51,.15) 0%, rgba(13,31,51,.75) 45%, rgba(13,31,51,.97) 100%)" }}/>
                {/* Content */}
                <div style={{ position:"relative", zIndex:1 }}>
                  <div style={{
                    background:"rgba(79,124,249,.1)", borderRadius:8,
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
              </div>
            </StaggerItem>
            );
          })}
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
  React.useEffect(() => { if (modeProp) setLocalMode(modeProp); }, [modeProp]);

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

        <Stagger key={`${localMode}-${billing}`} className="lp-pricing-grid" style={{
          display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:22, alignItems:"start" }}>
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
  const [idx, setIdx] = useState(0);

  const testimonials = ar ? [
    { name:"م. س.", initials:"SM", role:"مهندسة برمجيات · القاهرة", text:"كنت بعاني من آلام رقبة كل يوم بعد 8 ساعات شغل. بعد أسبوعين من Corvus، الألم راح تقريباً. أوضح ROI على أداة اشتريتها.", score:"5/5", color:"#818cf8" },
    { name:"ه. أ.", initials:"HA", role:"مدير موارد بشرية · دبي", text:"تحليلات HR عندنا أوضح من أي وقت. دلوقتي نقدر نمنع المشاكل قبل ما تبقى إجازات مرضية مكلفة.", score:"5/5", color:"#22d3ee" },
  ] : [
    { name:"S. M.", initials:"SM", role:"Software Engineer · Cairo", text:"I had neck pain daily after 8-hour work sessions. Two weeks with Corvus and it's nearly gone. Clearest ROI of any tool I've bought.", score:"5/5", color:"#818cf8" },
    { name:"H. A.", initials:"HA", role:"HR Manager · Dubai", text:"HR analytics are crystal clear. We can now prevent issues before they become costly sick leaves.", score:"5/5", color:"#22d3ee" },
  ];

  const prev = () => setIdx(i => (i - 1 + testimonials.length) % testimonials.length);
  const next = () => setIdx(i => (i + 1) % testimonials.length);

  const t = testimonials[idx];

  return (
    <section className="lp-section">
      <div className="lp-wrap">
        <SectionHead title={ar ? "ماذا يقول عملاؤنا" : "What our customers say"} />

        <div style={{ position:"relative", maxWidth:860, margin:"0 auto" }}>
          {/* Prev arrow */}
          <button onClick={prev} style={{
            position:"absolute", left:-20, top:"50%", transform:"translateY(-50%)",
            width:40, height:40, borderRadius:"50%", border:`1px solid ${C.border}`,
            background:"rgba(255,255,255,.04)", color:C.text, fontSize:18,
            cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
            zIndex:2, transition:"background .18s, border-color .18s",
          }}
          onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,.1)";e.currentTarget.style.borderColor=C.borderM}}
          onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,.04)";e.currentTarget.style.borderColor=C.border}}>
            ‹
          </button>

          {/* Card */}
          <motion.div key={idx}
            initial={{ opacity:0, x:30 }} animate={{ opacity:1, x:0 }}
            transition={{ duration:.32, ease:[0.22,1,0.36,1] }}
            style={{
              background:"rgba(255,255,255,.035)", border:`1px solid ${C.border}`,
              borderRadius:20, padding:"40px 52px",
              display:"grid", gridTemplateColumns:"1fr 1fr", gap:40,
              alignItems:"center",
            }}>
            {/* Left — stars + quote */}
            <div>
              <div style={{ display:"flex", gap:3, marginBottom:16 }}>
                {"★★★★★".split("").map((s,i)=>(
                  <span key={i} style={{ color:C.amber, fontSize:18 }}>{s}</span>
                ))}
                <span style={{ color:C.muted, fontSize:12, marginLeft:8, fontFamily:FONT_MONO, alignSelf:"center" }}>{t.score}</span>
              </div>
              <p style={{ fontSize:16, color:C.sub, lineHeight:1.75, margin:"0 0 24px", fontStyle:"italic" }}>
                "{t.text}"
              </p>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{
                  width:42, height:42, borderRadius:"50%",
                  background:`linear-gradient(135deg,${t.color}50,${t.color}20)`,
                  border:`1.5px solid ${t.color}60`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:13, fontWeight:800, color:t.color,
                }}>{t.initials}</div>
                <div>
                  <div style={{ fontWeight:700, color:C.text, fontSize:14 }}>{t.name}</div>
                  <div style={{ color:C.muted, fontSize:11.5, marginTop:2 }}>{t.role}</div>
                </div>
              </div>
            </div>

            {/* Right — outcome visual */}
            <div style={{
              background:"rgba(255,255,255,.03)", border:`1px solid ${C.border}`,
              borderRadius:16, padding:"28px 24px", textAlign:"center",
            }}>
              <div style={{ fontSize:36, marginBottom:12 }}>
                {idx === 0 ? "🧘" : "📊"}
              </div>
              <div style={{
                fontSize:28, fontWeight:800, color:C.green,
                fontFamily:FONT_MONO, lineHeight:1, marginBottom:8,
              }}>
                {idx === 0 ? "-47%" : "94%"}
              </div>
              <div style={{ fontSize:13, color:C.sub, lineHeight:1.5 }}>
                {idx === 0
                  ? (ar ? "تراجع آلام الرقبة في أسبوعين" : "Neck pain reduction in 2 weeks")
                  : (ar ? "معدل الاستخدام اليومي" : "Daily active rate")}
              </div>
              {/* Mini sparkline */}
              <svg width="100%" height="36" viewBox="0 0 140 36" style={{ display:"block", marginTop:14 }}>
                <defs>
                  <linearGradient id="testiGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.green} stopOpacity=".35"/>
                    <stop offset="100%" stopColor={C.green} stopOpacity="0"/>
                  </linearGradient>
                </defs>
                <path d="M0,30 L23,26 L46,20 L70,23 L93,12 L116,6 L140,2"
                  fill="none" stroke={C.green} strokeWidth="2" strokeLinecap="round"/>
                <path d="M0,30 L23,26 L46,20 L70,23 L93,12 L116,6 L140,2 L140,36 L0,36 Z"
                  fill="url(#testiGrad)"/>
              </svg>
            </div>
          </motion.div>

          {/* Next arrow */}
          <button onClick={next} style={{
            position:"absolute", right:-20, top:"50%", transform:"translateY(-50%)",
            width:40, height:40, borderRadius:"50%", border:`1px solid ${C.border}`,
            background:"rgba(255,255,255,.04)", color:C.text, fontSize:18,
            cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
            zIndex:2, transition:"background .18s, border-color .18s",
          }}
          onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,.1)";e.currentTarget.style.borderColor=C.borderM}}
          onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,.04)";e.currentTarget.style.borderColor=C.border}}>
            ›
          </button>

          {/* Dot navigation */}
          <div style={{ display:"flex", gap:8, justifyContent:"center", marginTop:24 }}>
            {testimonials.map((_,i) => (
              <button key={i} onClick={()=>setIdx(i)} style={{
                width: i===idx ? 24 : 8, height:8, borderRadius:4,
                background: i===idx ? C.blue : "rgba(255,255,255,.18)",
                border:"none", cursor:"pointer", padding:0,
                transition:"width .3s, background .3s",
              }}/>
            ))}
          </div>
        </div>
      </div>
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
    <section style={{ padding:"0 24px 0", marginBottom:0 }}>
      <div className="lp-wrap">
        <Reveal>
          <div style={{
            background:"linear-gradient(120deg,rgba(26,86,219,.85),rgba(8,145,178,.75))",
            borderRadius:20, padding:"28px 36px",
            display:"flex", alignItems:"center",
            gap:20, flexWrap:"wrap", justifyContent:"space-between",
            boxShadow:"0 8px 40px rgba(26,86,219,.3)",
            position:"relative", overflow:"hidden",
          }}>
            {/* Glow orb behind */}
            <div style={{
              position:"absolute", right:-60, top:-60,
              width:200, height:200,
              background:"radial-gradient(circle,rgba(255,255,255,.12),transparent 70%)",
              borderRadius:"50%", pointerEvents:"none",
            }}/>
            {/* Icon + text */}
            <div style={{ display:"flex", alignItems:"center", gap:16, flex:1, minWidth:260 }}>
              <div style={{
                width:44, height:44, borderRadius:12, flexShrink:0,
                background:"rgba(255,255,255,.15)",
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:20,
              }}>◈</div>
              <div>
                <div style={{ fontSize:16, fontWeight:700, color:"#fff", lineHeight:1.35 }}>
                  {ar ? "انضم لـ 50+ فريق يحسّن الوضعية بالذكاء الاصطناعي." : "Join 50+ teams improving posture with AI."}
                </div>
                <div style={{ fontSize:12.5, color:"rgba(255,255,255,.7)", marginTop:3 }}>
                  {ar ? "تجربة مجانية 7 أيام، وصول كامل، بدون التزام." : "7-day free trial, full access, no commitment."}
                </div>
              </div>
            </div>
            {/* CTA button */}
            <a href="#" onClick={(e)=>{e.preventDefault();onCTA(e);navTo("/auth?mode=signup");}}
              style={{
                background:"#fff", color:"#1a56db",
                padding:"12px 26px", borderRadius:12,
                fontSize:14.5, fontWeight:700,
                textDecoration:"none", flexShrink:0, whiteSpace:"nowrap",
                transition:"transform .18s, box-shadow .18s",
                boxShadow:"0 4px 16px rgba(0,0,0,.2)",
                display:"flex", alignItems:"center", gap:6,
              }}
              onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 8px 24px rgba(0,0,0,.3)"}}
              onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,.2)"}}>
              {ar ? "جرّب Corvus مجاناً" : "Try Corvus Free"} →
            </a>
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
    { title:"المنتج", links:[
      ["المميزات","#features"],
      ["كيف يعمل","#how"],
      ["الأسعار","#pricing"],
      ["التكاملات","#"],
    ]},
    { title:"الحلول", links:[
      ["فرق HR","#casestudies"],
      ["الصحة المهنية","#features"],
      ["العمل عن بُعد","#features"],
      ["للمؤسسات","#enterprise"],
    ]},
    { title:"الموارد", links:[
      ["المدوّنة","#"],
      ["دراسات الحالة","#casestudies"],
      ["الأدلة","#"],
      ["مركز المساعدة",`mailto:${SUPPORT_EMAIL}`],
    ]},
    { title:"الشركة", links:[
      ["من نحن",`mailto:${SUPPORT_EMAIL}?subject=About Corvus`],
      ["الأمان","#"],
      ["الخصوصية","#"],
      ["تواصل معنا",`mailto:${SUPPORT_EMAIL}`],
    ]},
  ] : [
    { title:"Product", links:[
      ["Features","#features"],
      ["How It Works","#how"],
      ["Pricing","#pricing"],
      ["Integrations","#"],
    ]},
    { title:"Solutions", links:[
      ["HR Teams","#casestudies"],
      ["Occupational Health","#features"],
      ["Remote Teams","#features"],
      ["Enterprise","#enterprise"],
    ]},
    { title:"Resources", links:[
      ["Blog","#"],
      ["Case Studies","#casestudies"],
      ["Guides","#"],
      ["Help Center",`mailto:${SUPPORT_EMAIL}`],
    ]},
    { title:"Company", links:[
      ["About",`mailto:${SUPPORT_EMAIL}?subject=About Corvus`],
      ["Security","#"],
      ["Privacy Policy","#"],
      ["Contact",`mailto:${SUPPORT_EMAIL}`],
    ]},
  ];

  const socials = [
    { label:"in", title:"LinkedIn",  href:"https://www.linkedin.com/in/mo-postureai" },
    { label:"𝕏",  title:"X",         href:"https://x.com/corvusposture" },
    { label:"▶",  title:"YouTube",   href:"https://youtube.com/@corvusai" },
    { label:"◉",  title:"Instagram", href:"https://instagram.com/corvusai" },
  ];

  return (
    <footer style={{ borderTop:`1px solid ${C.border}`, padding:"64px 24px 36px", background:C.bg }}>
      <div className="lp-wrap">
        {/* Main grid — 4 cols desktop, 2 cols tablet, 1 col mobile */}
        <div style={{
          display:"grid",
          gridTemplateColumns:"1.4fr 1fr 1fr 1fr 1fr",
          gap:"40px 32px",
          marginBottom:48,
        }}>
          {/* Brand column */}
          <div style={{ gridColumn:"span 1" }}>
            {/* Logo mark */}
            <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:16 }}>
              <div style={{
                width:32, height:32, borderRadius:8,
                background:"linear-gradient(135deg,#1a56db,#0891b2)",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:16, flexShrink:0,
              }}>◈</div>
              <span style={{ fontWeight:800, color:C.text, fontSize:16, fontFamily:FONT_DISPLAY, letterSpacing:"-.02em" }}>
                Corvus
              </span>
            </div>

            <p style={{ fontSize:13.5, color:C.muted, lineHeight:1.75, maxWidth:240, margin:"0 0 20px" }}>
              {ar
                ? "تحليل الوضعية بالذكاء الاصطناعي — للأفراد والفرق في منطقة MENA."
                : "AI posture analysis for individuals and teams across MENA."}
            </p>

            {/* Social icon buttons */}
            <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
              {socials.map(({ label, title, href }) => (
                <a key={label} href={href} title={title}
                  target="_blank" rel="noopener noreferrer"
                  style={{
                    width:34, height:34, borderRadius:9,
                    background:"rgba(255,255,255,.05)",
                    border:`1px solid ${C.border}`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    color:C.muted, fontSize:13, fontWeight:700,
                    textDecoration:"none",
                    transition:"color .18s, border-color .18s, background .18s",
                  }}
                  onMouseEnter={e=>{
                    e.currentTarget.style.color=C.text;
                    e.currentTarget.style.borderColor=C.borderM;
                    e.currentTarget.style.background="rgba(255,255,255,.09)";
                  }}
                  onMouseLeave={e=>{
                    e.currentTarget.style.color=C.muted;
                    e.currentTarget.style.borderColor=C.border;
                    e.currentTarget.style.background="rgba(255,255,255,.05)";
                  }}>
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