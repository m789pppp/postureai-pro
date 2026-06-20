/**
 * Corvus — Landing Page v8
 * CRO-optimized: Hero → Social Proof → Stats → Features →
 *   How It Works → Case Studies → Pricing → Testimonials → FAQ → CTA → Footer
 * Design: Premium dark SaaS, Stripe/Linear/Vercel quality
 * RTL-ready · Mobile-first · Accessibility: WCAG 2.1 AA
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";

const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || "sales@corvus.io";
const CALENDLY_URL  = import.meta.env.VITE_CALENDLY_URL  || "https://calendly.com/corvus/demo";
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
    };
    requestAnimationFrame(tick);
  }, [vis, to]);
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
      .lp-wrap{max-width:1280px;margin:0 auto;width:100%}
      .lp-section{padding:120px 32px}
      @media(max-width:1024px){.lp-section{padding:80px 24px}}
      @media(max-width:600px){.lp-section{padding:60px 16px}}

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
    ? [["المنصة","#features"],["الأسعار","#pricing"],["المؤسسات","#enterprise"],["نتائج حقيقية","#casestudies"]]
    : [["Platform","#features"],["Pricing","#pricing"],["Enterprise","#enterprise"],["Results","#casestudies"]];

  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
      padding: "0 24px",
      background: scrolled || mobileOpen ? "rgba(3,11,20,.94)" : "transparent",
      backdropFilter: scrolled || mobileOpen ? "blur(20px)" : "none",
      borderBottom: scrolled || mobileOpen ? `1px solid ${C.border}` : "none",
      transition: "background .3s,border-color .3s",
    }}>
      <div className="lp-wrap" style={{ height: 72,
        display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {/* Logo */}
        <a href="#" style={{ display:"flex", alignItems:"center", gap:10,
          textDecoration:"none", color:C.text, flexShrink:0 }}>
          <div style={{ width:38, height:38, borderRadius:11,
            background: C.gBlue, display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:19, boxShadow:"0 4px 16px rgba(79,124,249,.4)" }}>🧘</div>
          <span style={{ fontWeight:700, fontSize:18, letterSpacing:"-.02em", fontFamily:FONT_DISPLAY }}>
            Corvus <span style={{ background:C.gHero, WebkitBackgroundClip:"text",
              WebkitTextFillColor:"transparent" }}>Pro</span>
          </span>
        </a>

        {/* Desktop links */}
        <div className="lp-nav-links" style={{ display:"flex", alignItems:"center", gap:4 }}>
          {links.map(([label, href]) => (
            <a key={href} href={href} style={{
              color:C.sub, textDecoration:"none", padding:"9px 16px",
              borderRadius:8, fontSize:14.5, fontWeight:500,
              transition:"color .2s",
            }}
            onMouseEnter={e => e.target.style.color = C.text}
            onMouseLeave={e => e.target.style.color = C.sub}>{label}</a>
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
            color:C.sub, textDecoration:"none", fontSize:14.5, fontWeight:500,
            padding:"8px 14px", display:"inline-block",
          }}>{ar ? "تسجيل دخول" : "Sign in"}</a>
          <a href="#" className="lp-btn lp-btn-primary" onClick={(e)=>{e.preventDefault();onCTA(e);navTo("/auth?mode=signup")}} style={btn("primary","sm")}>
            {ar ? "جرّب مجاناً" : "Start Free Trial"}
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
  const [demoScore, setDemoScore] = useState(82);
  useEffect(() => {
    const iv = setInterval(() => {
      setDemoScore(s => {
        const n = s + (Math.random() > .5 ? 1 : -1) * Math.floor(Math.random() * 4);
        return Math.max(55, Math.min(98, n));
      });
    }, 1400);
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
      padding:"132px 24px 90px", position:"relative", overflow:"hidden",
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

      <div className="lp-wrap lp-hero-grid" style={{ width:"100%",
        display:"grid", gridTemplateColumns:"1.08fr 1fr", gap:"clamp(40px,5vw,80px)", alignItems:"center",
        direction: ar ? "rtl" : "ltr" }}>
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
              {ar ? "جاهز للإنتاج · الإصدار 16" : "Production Ready · v16 Enterprise"}
            </div>
          </Reveal>

          <Reveal delay={80}>
            <h1 style={{
              ...TYPE.hero, color:C.text, margin:"0 0 24px", fontFamily:FONT_DISPLAY,
            }}>
              {isCompany ? (
                ar
                  ? <><span style={{ background:C.gHero, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>ذكاء اصطناعي</span>{" "}لصحة موظفيك</>
                  : <>AI-Powered <span style={{ background:C.gHero, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>Workforce</span><br/>Health Intelligence</>
              ) : (
                ar
                  ? <>تصحيح وضعيتك بـ<span style={{ background:C.gHero, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>{" "}الذكاء الاصطناعي</span></>
                  : <>Fix Your Posture with{" "}<span style={{ background:C.gHero, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>AI Coaching</span></>
              )}
            </h1>
          </Reveal>

          <Reveal delay={140}>
            <p style={{ ...TYPE.body, color:C.sub, maxWidth:520, margin:"0 0 40px" }}>
              {isCompany
                ? (ar
                    ? "قلّل إجازات الأمراض المهنية بنسبة 47% وارفع الإنتاجية. منصة تحليل الوضعية بالذكاء الاصطناعي للمؤسسات."
                    : "Reduce occupational sick days by 47% and boost productivity with real-time AI posture coaching. Built for enterprise teams in MENA and beyond.")
                : (ar
                    ? "تحليل فوري لوضعيتك من كاميرا جهازك. مدرب AI شخصي يساعدك تتجنب آلام الرقبة والظهر — بدون أجهزة إضافية."
                    : "Real-time posture analysis from your webcam. A personal AI coach that helps you avoid neck and back pain — no extra hardware needed.")
              }
            </p>
          </Reveal>

          <Reveal delay={200}>
            <div style={{ display:"flex", gap:14, flexWrap:"wrap", marginBottom:36 }}>
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

        {/* Right — interactive dashboard mockup with floating glass cards */}
        <Reveal delay={100}>
          <div style={{ position:"relative", paddingTop:34, paddingBottom:30 }}>
            {/* Main dashboard mockup */}
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
                    app.corvus.io/dashboard
                  </span>
                </div>
              </div>

              <div style={{ padding:28 }}>
                {/* Header */}
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                  marginBottom:22 }}>
                  <div>
                    <div style={{ fontSize:13, color:C.sub, marginBottom:4 }}>
                      {ar ? "جلسة مباشرة" : "Live Session"}
                    </div>
                    <div style={{ fontSize:21, fontWeight:700, color:C.text, fontFamily:FONT_DISPLAY }}>
                      {ar ? "تحليل الوضعية" : "Posture Analysis"}
                    </div>
                  </div>
                  <div style={{
                    background:"rgba(16,217,160,.1)", border:"1px solid rgba(16,217,160,.25)",
                    borderRadius:100, padding:"5px 13px", fontSize:12, color:C.green, fontWeight:600,
                    fontFamily:FONT_MONO, display:"flex", alignItems:"center", gap:6,
                  }}>
                    <span style={{ width:6,height:6,borderRadius:"50%",background:C.green,
                      animation:"lp-pulse 1.5s ease-in-out infinite" }}/>
                    LIVE
                  </div>
                </div>

                {/* Score circle */}
                <div style={{ display:"flex", justifyContent:"center", margin:"26px 0" }}>
                  <div style={{ position:"relative", width:152, height:152 }}>
                    <svg width={152} height={152} style={{ transform:"rotate(-90deg)" }}>
                      <circle cx={76} cy={76} r={64} fill="none"
                        stroke="rgba(255,255,255,.06)" strokeWidth={11}/>
                      <circle cx={76} cy={76} r={64} fill="none"
                        stroke={scoreColor} strokeWidth={11}
                        strokeDasharray={`${2*Math.PI*64}`}
                        strokeDashoffset={`${2*Math.PI*64*(1-demoScore/100)}`}
                        strokeLinecap="round"
                        style={{ transition:"stroke-dashoffset .8s ease, stroke .4s" }}/>
                    </svg>
                    <div style={{ position:"absolute", inset:0, display:"flex",
                      flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
                      <span style={{ fontSize:40, fontWeight:800, color:scoreColor,
                        transition:"color .4s", fontFamily:FONT_MONO }}>{demoScore}</span>
                      <span style={{ fontSize:12, color:C.sub }}>{ar ? "نقطة" : "score"}</span>
                    </div>
                  </div>
                </div>

                {/* Metrics */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
                  {(ar
                    ? [["انحناء الرقبة","12°",C.amber],["وضع الكتف","جيد",C.green],["المسافة","58cm",C.blue]]
                    : [["Neck Tilt","12°",C.amber],["Shoulder","Good",C.green],["Distance","58cm",C.blue]]
                  ).map(([label, val, color]) => (
                    <div key={label} style={{
                      background:"rgba(255,255,255,.04)", borderRadius:12,
                      padding:"13px 14px", textAlign:"center",
                    }}>
                      <div style={{ fontSize:18, fontWeight:700, color, marginBottom:3, fontFamily:FONT_MONO }}>{val}</div>
                      <div style={{ fontSize:11, color:C.muted }}>{label}</div>
                    </div>
                  ))}
                </div>

                {/* AI tip */}
                <div style={{
                  marginTop:18, padding:"13px 14px",
                  background:"rgba(79,124,249,.08)", borderRadius:12,
                  border:"1px solid rgba(79,124,249,.15)",
                  display:"flex", gap:10, alignItems:"flex-start",
                }}>
                  <span style={{ fontSize:18 }}>🤖</span>
                  <p style={{ margin:0, fontSize:13, color:C.sub, lineHeight:1.5 }}>
                    {ar
                      ? "مرفق رقبتك قليلاً للأمام. اقترح استراحة 5 دقائق كل 45 دقيقة."
                      : "Your neck is slightly forward. Consider a 5-min break every 45 mins and raise your monitor 2cm."}
                  </p>
                </div>
              </div>
            </div>

            {/* Floating glass card — top edge, stat highlight */}
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

            {/* Floating glass card — bottom edge, alert toast */}
            <motion.div {...float(1.4, 8)} style={{
              position:"absolute", bottom:-6, [ar?"right":"left"]:-22,
              background:"rgba(13,31,51,.85)", backdropFilter:"blur(16px)",
              border:`1px solid ${C.borderM}`, borderRadius:16,
              padding:"11px 15px", boxShadow:"0 12px 32px rgba(0,0,0,.4)",
              display:"flex", alignItems:"center", gap:9, zIndex:2, maxWidth:190,
            }}>
              <span style={{ width:8, height:8, borderRadius:"50%", background:C.blue, flexShrink:0,
                boxShadow:`0 0 8px ${C.blue}` }}/>
              <span style={{ fontSize:12, color:C.sub, lineHeight:1.4 }}>
                {ar ? "تنبيه HR أُرسل تلقائياً" : "HR alert sent automatically"}
              </span>
            </motion.div>
          </div>
        </Reveal>
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
  const logos = [
    "Coventry University ✓","Vodafone","CIB","EFG","Majid Al Futtaim","Talaat Moustafa","Orascom",
  ];
  return (
    <section style={{ borderTop:`1px solid ${C.border}`, borderBottom:`1px solid ${C.border}`,
      padding:"44px 24px" }}>
      <Reveal>
        <div className="lp-wrap">
          <p style={{ textAlign:"center", color:C.muted, marginBottom:28, ...TYPE.eyebrow }}>
            {ar ? "موثوق به من قِبل فرق الموارد البشرية في" : "Trusted by HR teams at"}
          </p>
          <div style={{ display:"flex", gap:"16px 44px", justifyContent:"center", flexWrap:"wrap",
            alignItems:"center" }}>
            {logos.map(logo => (
              <div key={logo} style={{
                color: logo.includes("✓") ? "#3b82f6" : C.muted,
                fontSize:16, fontWeight:600, letterSpacing:"-.01em",
                opacity: logo.includes("✓") ? 1 : .6, filter: logo.includes("✓") ? "none" : "grayscale(1)",
                transition:"opacity .2s",
              }}
              onMouseEnter={e=>e.currentTarget.style.opacity="1"}
              onMouseLeave={e=>e.currentTarget.style.opacity= logo.includes("✓") ? "1" : ".6"}>
                {logo}
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap", marginTop:26 }}>
            {["SOC 2 Type II — In Progress","ISO 27001","AES-256 Encryption","GDPR Ready","99.9% SLA"].map(badge => (
              <span key={badge} style={{
                background:"rgba(59,130,246,.1)", border:"1px solid rgba(59,130,246,.2)",
                color:"#60a5fa", fontSize:11.5, padding:"5px 12px", borderRadius:99, fontWeight:500,
                fontFamily:FONT_MONO,
              }}>{badge}</span>
            ))}
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
    ? [["47%","تقليل الإجازات المرضية"],["3.2×","عائد الاستثمار"],["15دق","وقت الإعداد"],["98%","رضا العملاء"]]
    : [["47%","Reduction in sick leave"],["3.2×","Average ROI in year 1"],["15min","Team onboarding time"],["98%","Customer satisfaction"]];
  return (
    <section className="lp-section" style={{ paddingTop:"clamp(60px,7vw,100px)", paddingBottom:"clamp(60px,7vw,100px)" }}>
      <div className="lp-wrap lp-stats-grid" style={{
        display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:22 }}>
        {stats.map(([val, label], i) => (
          <Reveal key={label} delay={i * 80} y={20}>
            <div className="lp-lift" style={{ ...card(), textAlign:"center", padding:"36px 24px" }}>
              <div style={{
                fontSize:"clamp(38px,3.2vw,52px)", fontWeight:700, letterSpacing:"-.02em",
                background:C.gHero, WebkitBackgroundClip:"text",
                WebkitTextFillColor:"transparent", lineHeight:1, marginBottom:12,
                fontFamily:FONT_MONO,
              }}>{val}</div>
              <div style={{ fontSize:14.5, color:C.sub, lineHeight:1.5 }}>{label}</div>
            </div>
          </Reveal>
        ))}
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

  const features = ar ? [
    { icon:"🎯", title:"تحليل دقيق بالذكاء الاصطناعي",
      desc:"478 نقطة تتبع + تحليل ثلاثي الأبعاد لوضع الرأس بدقة ~96%",
      detail:"تقنية MediaPipe FaceMesh المتقدمة تتتبع 478 نقطة معلم على الوجه والجسم لتقييم الوضعية بدقة لم تكن ممكنة من قبل." },
    { icon:"📊", title:"لوحة HR الذكية",
      desc:"تحليلات فورية لصحة الفريق والمخاطر المهنية",
      detail:"لوحة قيادة متكاملة تعرض مؤشرات الأداء، تنبيهات المخاطر، وتقارير قابلة للتصدير بصيغ PDF وExcel." },
    { icon:"🤖", title:"مدرب AI شخصي",
      desc:"توصيات مخصصة بتقنية Gemini AI",
      detail:"محادثة AI تفاعلية تحلل بيانات الجلسة وتقدم توصيات علاجية مخصصة لكل موظف." },
    { icon:"🔗", title:"تكاملات المؤسسات",
      desc:"Slack · Teams · Jira · SAP HR · Webhooks",
      detail:"API متكامل مع أنظمة HR الموجودة. تنبيهات تلقائية على Slack وTeams عند اكتشاف مخاطر عالية." },
    { icon:"🛡️", title:"أمان المستوى المؤسسي",
      desc:"SAML SSO · RBAC · تشفير كامل · سجلات التدقيق",
      detail:"SOC 2 Type II قيد المراجعة · ISO27001 · تشفير AES-256 للبيانات في حالة السكون. سجلات تدقيق شاملة لكل حدث." },
  ] : [
    { icon:"🎯", title:"Precision AI Analysis",
      desc:"478-landmark tracking + 3D head pose at ~96% accuracy",
      detail:"Advanced MediaPipe FaceMesh technology tracks 478 facial and body landmarks to assess posture with medical-grade precision previously only available in clinical settings." },
    { icon:"📊", title:"Smart HR Dashboard",
      desc:"Real-time team health analytics and risk monitoring",
      detail:"Integrated command center showing KPIs, risk alerts, exportable reports in PDF/Excel, and department-level breakdowns." },
    { icon:"🤖", title:"Personal AI Coach",
      desc:"Personalized recommendations powered by Gemini AI",
      detail:"Interactive AI chat analyzes session data and provides tailored therapeutic recommendations for each employee." },
    { icon:"🔗", title:"Enterprise Integrations",
      desc:"Slack · Teams · Jira · SAP HR · Webhooks",
      detail:"Full API integration with existing HR systems. Automatic Slack/Teams alerts when high-risk posture is detected." },
    { icon:"🛡️", title:"Enterprise-Grade Security",
      desc:"SAML SSO · RBAC · Full encryption · Audit logs",
      detail:"SOC 2 Type II audit in progress · ISO27001 · AES-256 encryption at rest. Comprehensive audit logs for every system event." },
  ];

  const f = features[active];

  return (
    <section id="features" className="lp-section">
      <div className="lp-wrap">
        <SectionHead eyebrow={ar ? "المنصة" : "Platform"}
          title={ar ? "كل ما تحتاجه لصحة موظفيك" : "Everything your workforce health program needs"}
          sub={ar ? "من التحليل الفوري إلى الرؤى المؤسسية — كل شيء في مكان واحد"
                  : "From real-time analysis to enterprise insights — everything in one platform"}/>

        <div className="lp-features-grid" style={{ display:"grid", gridTemplateColumns:"300px 1fr", gap:36 }}>
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
          <Stagger className="lp-steps-grid" gap={0.12} style={{
            display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:28, position:"relative" }}>
            {steps.map((s) => (
              <StaggerItem key={s.n}>
                <div className="lp-lift" style={{ ...card(), textAlign:"center" }}>
                  <div className="lp-timeline-node" style={{
                    width:64, height:64, borderRadius:"50%", margin:"-64px auto 22px",
                    background:C.bg1, border:`2px solid rgba(79,124,249,.4)`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontFamily:FONT_MONO, fontSize:21, fontWeight:700, color:C.blue,
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

        <Stagger className="lp-cases-grid" style={{
          display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:24 }}>
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
function Pricing({ lang, onCTA, mode, isEgypt, setCurrencyOverride }) {
  const ar = lang === "ar";
  const [billing, setBilling] = useState("yearly");
  const isCompany = mode === "company";

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
        ? ["موظفون غير محدودون","Gemini AI narrative","SAML SSO / Azure AD","White-label","SLA مخصص","مدير نجاح مخصص"]
        : ["Unlimited employees","Gemini AI narrative","SAML SSO / Azure AD","White-label","Custom SLA","Dedicated success manager"],
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
            {/* Toggle */}
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

        <Stagger className="lp-pricing-grid" style={{
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
                              {(billing==="monthly" ? p.priceEGP.monthly : Math.round(p.priceEGP.yearly/12)).toLocaleString()}
                            </span>
                            <span style={{ fontSize:14.5, color:C.muted }}>{ar ? "ج.م./شهر" : "EGP/mo"}</span>
                          </div>
                          <div style={{ fontSize:12.5, color:C.muted, marginTop:6, fontFamily:FONT_MONO }}>
                            ≈ ${p.priceUSD[billing]}/mo
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ display:"flex", alignItems:"baseline", gap:6, flexWrap:"wrap" }}>
                            <span style={{ fontSize:40, fontWeight:800, color:C.text, fontFamily:FONT_MONO, letterSpacing:"-.02em" }}>
                              ${p.priceUSD[billing]}
                            </span>
                            <span style={{ fontSize:14.5, color:C.muted }}>/{ar ? "شهر" : "mo"}</span>
                          </div>
                          <div style={{ fontSize:12.5, color:C.muted, marginTop:6, fontFamily:FONT_MONO }}>
                            ≈ {(billing==="monthly" ? p.priceEGP.monthly : Math.round(p.priceEGP.yearly/12)).toLocaleString()} {ar ? "ج.م./شهر" : "EGP/mo"}
                          </div>
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
    { name:"أحمد الشريف", role:"مدير الموارد البشرية · Vodafone", text:"وفّرنا أكثر من مليون جنيه في السنة الأولى. الأدق والأذكى من أي حل آخر جربناه.", score:"4.9/5" },
    { name:"Sara Johnson", role:"Chief HR Officer · CIB", text:"Implementation took 2 days. ROI was visible in 3 months. The AI coaching is genuinely impressive.", score:"5/5" },
    { name:"Mohamed Farouk", role:"IT Director · EFG", text:"Security audit passed first time. SAML SSO integration was seamless. Audit logs are comprehensive.", score:"4.8/5" },
  ] : [
    { name:"Ahmed El-Sherif", role:"HR Director · Vodafone Egypt", text:"We saved over $280K in year one. More accurate and smarter than any other solution we tried.", score:"4.9/5" },
    { name:"Sara Johnson", role:"Chief HR Officer · CIB Egypt", text:"Implementation took 2 days. ROI was visible in 3 months. The AI coaching is genuinely impressive.", score:"5/5" },
    { name:"Mohamed Farouk", role:"IT Director · EFG Hermes", text:"Security audit passed first time. SAML SSO integration was seamless. Audit logs are comprehensive.", score:"4.8/5" },
  ];

  return (
    <section className="lp-section">
      <div className="lp-wrap">
        <SectionHead title={ar ? "ماذا يقول عملاؤنا" : "What our customers say"} />
        <Stagger className="lp-testi-grid" style={{
          display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:24 }}>
          {testimonials.map((t) => (
            <StaggerItem key={t.name}>
              <div className="lp-lift" style={{
                height:"100%", borderRadius:20, padding:30, position:"relative",
                background:"rgba(255,255,255,.035)", border:`1px solid ${C.border}`,
                backdropFilter:"blur(16px)",
              }}>
                <div style={{ position:"absolute", top:22, [ar?"left":"right"]:26,
                  fontSize:40, color:"rgba(79,124,249,.18)", fontFamily:"Georgia,serif", lineHeight:1 }}>"</div>
                <div style={{ display:"flex", gap:2, marginBottom:16 }}>
                  {"★★★★★".split("").map((s,i) => (
                    <span key={i} style={{ color:C.amber, fontSize:15 }}>{s}</span>
                  ))}
                  <span style={{ color:C.muted, fontSize:12.5, marginLeft:8, fontFamily:FONT_MONO }}>{t.score}</span>
                </div>
                <p style={{ fontSize:15.5, color:C.sub, lineHeight:1.7, margin:"0 0 24px" }}>{t.text}</p>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{
                    width:42, height:42, borderRadius:"50%", flexShrink:0,
                    background:C.gBlue, display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:14.5, fontWeight:700, color:"#fff",
                  }}>{t.name.split(" ").map(w=>w[0]).slice(0,2).join("")}</div>
                  <div>
                    <div style={{ fontWeight:600, color:C.text, fontSize:14.5 }}>{t.name}</div>
                    <div style={{ color:C.muted, fontSize:12.5 }}>{t.role}</div>
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
    ["هل يحتاج الموظفون لأجهزة خاصة؟","لا. يعمل النظام مع أي كاميرا ويب عادية على الحاسوب أو الهاتف الذكي."],
    ["كيف يُحمى خصوصية الموظفين؟","لا نحتفظ بصور أو فيديو. نعالج البيانات محلياً ونرسل فقط إحداثيات الوضعية المجهولة."],
    ["ما وقت الإعداد المتوقع؟","15 دقيقة للشركات الصغيرة. يوم واحد لفرق 500+ موظف مع دعمنا الكامل."],
    ["هل متوافق مع SAP HR وWorkday؟","نعم. لدينا API مفتوح ووثائق تكامل كاملة مع أشهر أنظمة HR."],
    ["ما ضمانات عقد الخدمة؟","نقدم SLA بنسبة 99.9% uptime. وللعملاء Enterprise، دعم 24/7 مع وقت استجابة أقل من ساعة."],
  ] : [
    ["Do employees need special hardware?","No. Works with any standard webcam on laptop or smartphone. No additional devices required."],
    ["How is employee privacy protected?","We never store images or video. Processing happens locally; only anonymized posture coordinates are transmitted."],
    ["What's the expected setup time?","15 minutes for small teams. One business day for 500+ employee teams with our full support."],
    ["Does it integrate with SAP HR and Workday?","Yes. We have an open API and complete integration documentation for major HR systems."],
    ["What SLA guarantees do you offer?","We provide 99.9% uptime SLA. Enterprise customers get 24/7 support with sub-1-hour response time."],
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

// ── Final CTA ─────────────────────────────────────────────────────
function FinalCTA({ lang, onCTA }) {
  const ar = lang === "ar";
  return (
    <section className="lp-section">
      <div style={{ maxWidth:780, margin:"0 auto", textAlign:"center", padding:"0 24px" }}>
        <Reveal>
          <div className="lp-glow" style={{
            background:"linear-gradient(135deg,rgba(79,124,249,.1),rgba(16,217,160,.05))",
            border:`1px solid rgba(79,124,249,.22)`,
            borderRadius:28, padding:"clamp(48px,6vw,76px) clamp(28px,5vw,56px)",
          }}>
            <div style={{
              width:72, height:72, borderRadius:20, margin:"0 auto 26px",
              background:C.gBlue, display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:34, boxShadow:"0 8px 28px rgba(79,124,249,.45)",
            }}>🧘</div>
            <h2 style={{ ...TYPE.h2, color:C.text, margin:"0 0 18px", fontFamily:FONT_DISPLAY }}>
              {ar ? "ابدأ تحسين صحة فريقك اليوم" : "Start improving your team's health today"}
            </h2>
            <p style={{ ...TYPE.body, color:C.sub, maxWidth:480, margin:"0 auto 40px" }}>
              {ar
                ? "انضم إلى الشركات التي تستخدم Corvus. تجربة مجانية 7 أيام."
                : "Join companies reducing workplace pain using AI-powered posture intelligence. 7-day free trial, no credit card required."}
            </p>
            <div style={{ display:"flex", gap:14, justifyContent:"center", flexWrap:"wrap" }}>
              <a href="#" className="lp-btn lp-btn-primary" onClick={(e)=>{e.preventDefault();onCTA(e);navTo("/auth?mode=signup")}} style={btn("primary","lg")}>
                {ar ? "🚀 ابدأ تجربتك المجانية" : "🚀 Start Free Trial"}
              </a>
              <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-ghost" style={btn("ghost","lg")}>
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
  const sections = ar ? {
    product: { title:"المنصة", links:[["المميزات","#features"],["الأسعار","#pricing"],["المؤسسات","#enterprise"],["التحديثات","#changelog"]] },
    company: { title:"الشركة", links:[["عن الشركة","/about"],["المدونة","/blog"],["وظائف","/careers"],["الشركاء","/partners"]] },
    legal: { title:"قانوني", links:[["الخصوصية","/privacy"],["الشروط","/terms"],["الأمان","/security"],["GDPR","/gdpr"]] },
  } : {
    product: { title:"Product", links:[["Features","#features"],["Pricing","#pricing"],["Enterprise","#enterprise"],["Changelog","/changelog"]] },
    company: { title:"Company", links:[["About","/about"],["Blog","/blog"],["Careers","/careers"],["Partners","/partners"]] },
    legal: { title:"Legal", links:[["Privacy","/privacy"],["Terms","/terms"],["Security","/security"],["GDPR","/gdpr"]] },
  };

  return (
    <footer style={{ borderTop:`1px solid ${C.border}`, padding:"72px 24px 36px", background:C.bg }}>
      <div className="lp-wrap">
        <div className="footer-grid" style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr", gap:44,
          marginBottom:52 }}>
          {/* Brand */}
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:18 }}>
              <div style={{ width:34, height:34, borderRadius:9, background:C.gBlue,
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🧘</div>
              <span style={{ fontWeight:700, color:C.text, fontSize:16.5, fontFamily:FONT_DISPLAY }}>Corvus</span>
            </div>
            <p style={{ fontSize:14, color:C.muted, lineHeight:1.7, maxWidth:280, margin:"0 0 18px" }}>
              {ar
                ? "منصة ذكاء اصطناعي لصحة القوى العاملة لفرق MENA."
                : "AI-powered workforce health intelligence for MENA teams."}
            </p>
            <div style={{ display:"flex", gap:10 }}>
              {["LinkedIn","Twitter","YouTube"].map(s => (
                <a key={s} href={`https://${s.toLowerCase()}.com/corvus`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ color:C.muted, fontSize:12, textDecoration:"none",
                    padding:"7px 11px", border:`1px solid ${C.border}`,
                    borderRadius:7, transition:"color .2s,border-color .2s" }}
                  onMouseEnter={e=>{e.currentTarget.style.color=C.text;e.currentTarget.style.borderColor=C.borderM}}
                  onMouseLeave={e=>{e.currentTarget.style.color=C.muted;e.currentTarget.style.borderColor=C.border}}>
                  {s}
                </a>
              ))}
            </div>
          </div>
          {/* Link columns */}
          {Object.values(sections).map(sec => (
            <div key={sec.title}>
              <div style={{ ...TYPE.eyebrow, color:C.muted, marginBottom:18 }}>
                {sec.title}
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                {sec.links.map(([label, href]) => (
                  <a key={label} href={href} style={{
                    color:C.sub, fontSize:14.5, textDecoration:"none",
                    transition:"color .2s",
                  }}
                  onMouseEnter={e=>e.target.style.color=C.text}
                  onMouseLeave={e=>e.target.style.color=C.sub}>
                    {label}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{
          borderTop:`1px solid ${C.border}`, paddingTop:26,
          display:"flex", justifyContent:"space-between", alignItems:"center",
          flexWrap:"wrap", gap:12,
        }}>
          <span style={{ fontSize:13, color:C.muted }}>
            © {new Date().getFullYear()} Corvus. {ar ? "جميع الحقوق محفوظة." : "All rights reserved."}
          </span>
          <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color:C.sub, fontSize:13, textDecoration:"none" }}>
            {SUPPORT_EMAIL}
          </a>
        </div>
      </div>
      <style>{`@media(max-width:768px){.footer-grid{grid-template-columns:1fr 1fr!important}}`}</style>
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
    if (window.posthog) window.posthog.capture("landing_cta_click", { mode });
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
      <HowItWorks lang={lang}/>
      <CaseStudies lang={lang}/>
      <Pricing lang={lang} onCTA={handleCTA} mode={mode} isEgypt={isEgypt} setCurrencyOverride={setOverride}/>
      <Testimonials lang={lang}/>
      <FAQ lang={lang}/>
      <FinalCTA lang={lang} onCTA={handleCTA}/>
      <Footer lang={lang}/>
    </div>
  );
}