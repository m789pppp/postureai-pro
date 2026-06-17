/**
 * Corvus — Landing Page v7
 * CRO-optimized: Hero → Social Proof → Benefits → Features →
 *   How It Works → Case Studies → Pricing → FAQ → Testimonials → CTA → Footer
 * Design: Premium dark SaaS, Stripe/Linear quality
 * RTL-ready · Mobile-first · Accessibility: WCAG 2.1 AA
 */
import React, { useState, useEffect, useRef, useCallback } from "react";

const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || "sales@corvus.io";
const CALENDLY_URL  = import.meta.env.VITE_CALENDLY_URL  || "https://calendly.com/corvus/demo";
const APP_URL       = typeof window !== "undefined" ? window.location.origin : "";

// ── Scroll-triggered reveal ───────────────────────────────────────

// ── SPA navigation — dispatches event instead of full-page reload ─
function navTo(path) {
  // If running inside the SPA (App.jsx), dispatch event
  const event = new CustomEvent('spa:navigate', { detail: { path } });
  if (window.dispatchEvent(event) && window.__spaNavigate) {
    window.__spaNavigate(path);
  } else {
    // Fallback: real navigation (works when landing is standalone)
    window.location.href = path;
  }
}

function useInView(threshold = 0.12) {
  const ref = useRef(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVis(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, vis];
}

function Reveal({ children, delay = 0, y = 32, style = {} }) {
  const [ref, vis] = useInView();
  return (
    <div ref={ref} style={{
      transition: `opacity .65s cubic-bezier(.22,1,.36,1) ${delay}ms, transform .65s cubic-bezier(.22,1,.36,1) ${delay}ms`,
      opacity: vis ? 1 : 0,
      transform: vis ? "none" : `translateY(${y}px)`,
      ...style,
    }}>{children}</div>
  );
}

function AnimNum({ to, suffix = "", prefix = "", decimals = 0 }) {
  const [ref, vis] = useInView();
  const [v, setV] = useState(0);
  const started = useRef(false);
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

// ── Design tokens ─────────────────────────────────────────────────
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

// ── Shared styles ─────────────────────────────────────────────────
const btn = (variant = "primary", size = "md") => {
  const sizes = { sm: "10px 20px", md: "13px 26px", lg: "16px 34px" };
  const base = {
    display: "inline-flex", alignItems: "center", gap: 8,
    padding: sizes[size], borderRadius: 10, fontWeight: 600,
    fontSize: size === "lg" ? 17 : 15, cursor: "pointer",
    transition: "all .2s", border: "none", textDecoration: "none",
    letterSpacing: "-.01em",
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
  borderRadius: 16,
  padding: 28,
  backdropFilter: "blur(12px)",
  boxShadow: glow ? "0 0 40px rgba(79,124,249,.08),0 8px 32px rgba(0,0,0,.3)"
                  : "0 4px 24px rgba(0,0,0,.25)",
});

// ── Navigation ────────────────────────────────────────────────────
function Nav({ lang, setLang, onCTA }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  const ar = lang === "ar";
  const links = ar
    ? [["المنصة","#features"],["الأسعار","#pricing"],["المؤسسات","#enterprise"],["نتائج حقيقية","#casestudies"]]
    : [["Platform","#features"],["Pricing","#pricing"],["Enterprise","#enterprise"],["Results","#casestudies"]];

  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
      padding: "0 24px",
      background: scrolled ? "rgba(3,11,20,.92)" : "transparent",
      backdropFilter: scrolled ? "blur(20px)" : "none",
      borderBottom: scrolled ? `1px solid ${C.border}` : "none",
      transition: "all .3s",
    }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", height: 68,
        display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {/* Logo */}
        <a href="#" style={{ display:"flex", alignItems:"center", gap:10,
          textDecoration:"none", color:C.text }}>
          <div style={{ width:36, height:36, borderRadius:10,
            background: C.gBlue, display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:18, boxShadow:"0 4px 16px rgba(79,124,249,.4)" }}>🧘</div>
          <span style={{ fontWeight:700, fontSize:17, letterSpacing:"-.02em" }}>
            Corvus <span style={{ background:C.gHero, WebkitBackgroundClip:"text",
              WebkitTextFillColor:"transparent" }}>Pro</span>
          </span>
        </a>

        {/* Desktop links */}
        <div style={{ display:"flex", alignItems:"center", gap:6,
          "@media(max-width:768px)":{ display:"none" } }}
          className="nav-links">
          {links.map(([label, href]) => (
            <a key={href} href={href} style={{
              color:C.sub, textDecoration:"none", padding:"8px 14px",
              borderRadius:8, fontSize:14, fontWeight:500,
              transition:"color .2s",
            }}
            onMouseEnter={e => e.target.style.color = C.text}
            onMouseLeave={e => e.target.style.color = C.sub}>{label}</a>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <button onClick={() => setLang(ar ? "en" : "ar")} style={{
            background:"transparent", border:`1px solid ${C.border}`,
            color:C.sub, padding:"6px 14px", borderRadius:8,
            cursor:"pointer", fontSize:13, fontWeight:500,
          }}>{ar ? "EN" : "عربي"}</button>
          <a href="#" onClick={(e)=>{e.preventDefault();navTo("/auth")}} style={{
            color:C.sub, textDecoration:"none", fontSize:14, fontWeight:500,
            padding:"8px 14px", display:"inline-block",
          }}>{ar ? "تسجيل دخول" : "Sign in"}</a>
          <a href="#" onClick={(e)=>{e.preventDefault();onCTA(e);navTo("/auth?mode=signup")}} style={btn("primary","sm")}>
            {ar ? "جرّب مجاناً" : "Start Free Trial"}
          </a>
        </div>
      </div>

      <style>{`
        @media(max-width:768px){.nav-links{display:none!important}}
      `}</style>
    </nav>
  );
}

// ── Hero ──────────────────────────────────────────────────────────
function Hero({ lang, onCTA }) {
  const ar = lang === "ar";
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

  return (
    <section style={{
      minHeight: "100vh", display:"flex", alignItems:"center",
      padding:"120px 24px 80px", position:"relative", overflow:"hidden",
    }}>
      {/* Ambient background */}
      <div style={{ position:"absolute", inset:0, pointerEvents:"none" }}>
        <div style={{
          position:"absolute", top:"15%", left:"60%",
          width:600, height:600,
          background:"radial-gradient(circle,rgba(79,124,249,.12) 0%,transparent 70%)",
          borderRadius:"50%", transform:"translate(-50%,-50%)",
        }}/>
        <div style={{
          position:"absolute", bottom:"20%", left:"20%",
          width:400, height:400,
          background:"radial-gradient(circle,rgba(16,217,160,.08) 0%,transparent 70%)",
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

      <div style={{ maxWidth:1180, margin:"0 auto", width:"100%",
        display:"grid", gridTemplateColumns:"1fr 1fr", gap:60, alignItems:"center",
        direction: ar ? "rtl" : "ltr" }}
        className="hero-grid">
        {/* Left */}
        <div>
          <Reveal>
            <div style={{
              display:"inline-flex", alignItems:"center", gap:8,
              background:"rgba(79,124,249,.1)", border:"1px solid rgba(79,124,249,.25)",
              borderRadius:100, padding:"6px 14px", marginBottom:24,
              fontSize:13, color:C.indigo, fontWeight:500,
            }}>
              <span style={{
                width:6, height:6, borderRadius:"50%", background:C.green,
                boxShadow:`0 0 8px ${C.green}`,
                animation:"pulse 1.5s ease-in-out infinite",
              }}/>
              {ar ? "جاهز للإنتاج · الإصدار 16" : "Production Ready · v16 Enterprise"}
            </div>
          </Reveal>

          <Reveal delay={80}>
            <h1 style={{
              fontSize:"clamp(36px,5vw,58px)", fontWeight:800,
              lineHeight:1.1, letterSpacing:"-.03em", color:C.text,
              margin:"0 0 20px",
            }}>
              {ar
                ? <><span style={{ background:C.gHero, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>ذكاء اصطناعي</span>{" "}لصحة موظفيك</>
                : <>AI-Powered <span style={{ background:C.gHero, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>Workforce</span><br/>Health Intelligence</>
              }
            </h1>
          </Reveal>

          <Reveal delay={140}>
            <p style={{ fontSize:18, color:C.sub, lineHeight:1.7, maxWidth:500, margin:"0 0 36px" }}>
              {ar
                ? "قلّل إجازات الأمراض المهنية بنسبة 47% وارفع الإنتاجية. منصة تحليل الوضعية بالذكاء الاصطناعي للمؤسسات."
                : "Reduce occupational sick days by 47% and boost productivity with real-time AI posture coaching. Built for enterprise teams in MENA and beyond."
              }
            </p>
          </Reveal>

          <Reveal delay={200}>
            <div style={{ display:"flex", gap:14, flexWrap:"wrap", marginBottom:40 }}>
              <a href="#" onClick={(e)=>{e.preventDefault();onCTA(e);navTo("/auth?mode=signup")}} style={btn("primary","lg")}>
                {ar ? "🚀 ابدأ مجاناً — لفريقي" : "🚀 Start Free — For My Team"}
              </a>
              <a href="#" onClick={(e)=>{e.preventDefault();onCTA(e);navTo("/auth?mode=signup&plan=personal_pro")}} style={btn("ghost","lg")}>
                {ar ? "👤 للاستخدام الشخصي" : "👤 Personal Use"}
              </a>
            </div>
          </Reveal>

          <Reveal delay={260}>
            <div style={{ display:"flex", gap:24, flexWrap:"wrap" }}>
              {(ar
                ? ["✓ بدون بطاقة ائتمان","✓ 7 أيام مجاناً","✓ إعداد في 5 دقائق"]
                : ["✓ No credit card","✓ 7-day free trial","✓ Setup in 5 min"]
              ).map(t => (
                <span key={t} style={{ color:C.muted, fontSize:14, fontWeight:500 }}>{t}</span>
              ))}
            </div>
          </Reveal>
        </div>

        {/* Right — live demo card */}
        <Reveal delay={100}>
          <div style={{ ...card(true), position:"relative" }}>
            {/* Header */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
              marginBottom:20 }}>
              <div>
                <div style={{ fontSize:13, color:C.sub, marginBottom:4 }}>
                  {ar ? "جلسة مباشرة" : "Live Session"}
                </div>
                <div style={{ fontSize:20, fontWeight:700, color:C.text }}>
                  {ar ? "تحليل الوضعية" : "Posture Analysis"}
                </div>
              </div>
              <div style={{
                background:"rgba(16,217,160,.1)", border:"1px solid rgba(16,217,160,.25)",
                borderRadius:100, padding:"4px 12px", fontSize:12, color:C.green, fontWeight:600,
              }}>● LIVE</div>
            </div>

            {/* Score circle */}
            <div style={{ display:"flex", justifyContent:"center", margin:"24px 0" }}>
              <div style={{ position:"relative", width:140, height:140 }}>
                <svg width={140} height={140} style={{ transform:"rotate(-90deg)" }}>
                  <circle cx={70} cy={70} r={58} fill="none"
                    stroke="rgba(255,255,255,.06)" strokeWidth={10}/>
                  <circle cx={70} cy={70} r={58} fill="none"
                    stroke={scoreColor} strokeWidth={10}
                    strokeDasharray={`${2*Math.PI*58}`}
                    strokeDashoffset={`${2*Math.PI*58*(1-demoScore/100)}`}
                    strokeLinecap="round"
                    style={{ transition:"stroke-dashoffset .8s ease, stroke .4s" }}/>
                </svg>
                <div style={{ position:"absolute", inset:0, display:"flex",
                  flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
                  <span style={{ fontSize:36, fontWeight:800, color:scoreColor,
                    transition:"color .4s" }}>{demoScore}</span>
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
                  background:"rgba(255,255,255,.04)", borderRadius:10,
                  padding:"12px 14px", textAlign:"center",
                }}>
                  <div style={{ fontSize:18, fontWeight:700, color, marginBottom:2 }}>{val}</div>
                  <div style={{ fontSize:11, color:C.muted }}>{label}</div>
                </div>
              ))}
            </div>

            {/* AI tip */}
            <div style={{
              marginTop:16, padding:"12px 14px",
              background:"rgba(79,124,249,.08)", borderRadius:10,
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

            <style>{`
              @keyframes pulse {
                0%,100%{opacity:1;transform:scale(1)}
                50%{opacity:.6;transform:scale(1.4)}
              }
            `}</style>
          </div>
        </Reveal>
      </div>

      <style>{`
        @media(max-width:768px){.hero-grid{grid-template-columns:1fr!important;gap:40px!important}}
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
      padding:"28px 24px", overflow:"hidden" }}>
      <div style={{ maxWidth:1180, margin:"0 auto" }}>
        <p style={{ textAlign:"center", color:C.muted, fontSize:13, marginBottom:20,
          letterSpacing:".08em", textTransform:"uppercase", fontWeight:500 }}>
          {ar ? "موثوق به من قِبل فرق الموارد البشرية في" : "Trusted by HR teams at"}
        </p>
        <div style={{ display:"flex", gap:40, justifyContent:"center", flexWrap:"wrap",
          alignItems:"center" }}>
          {logos.map(logo => (
            <div key={logo} style={{
              color: logo.includes("✓") ? "#3b82f6" : C.muted,
              fontSize:15, fontWeight:600, letterSpacing:"-.01em",
              opacity: logo.includes("✓") ? 1 : .6, filter: logo.includes("✓") ? "none" : "grayscale(1)",
              transition:"opacity .2s",
            }}
            onMouseEnter={e=>e.currentTarget.style.opacity="1"}
            onMouseLeave={e=>e.currentTarget.style.opacity= logo.includes("✓") ? "1" : ".6"}>
              {logo}
            </div>
          ))}
        </div>
        <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap", marginTop:20 }}>
          {["SOC 2 Type II — In Progress","ISO 27001","AES-256 Encryption","GDPR Ready","99.9% SLA"].map(badge => (
            <span key={badge} style={{
              background:"rgba(59,130,246,.1)", border:"1px solid rgba(59,130,246,.2)",
              color:"#60a5fa", fontSize:11, padding:"4px 10px", borderRadius:99, fontWeight:500
            }}>{badge}</span>
          ))}
        </div>
      </div>
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
    <section style={{ padding:"80px 24px" }}>
      <div style={{ maxWidth:1180, margin:"0 auto",
        display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:24 }}
        className="stats-grid">
        {stats.map(([val, label], i) => (
          <Reveal key={label} delay={i * 80}>
            <div style={{ ...card(), textAlign:"center" }}>
              <div style={{
                fontSize:46, fontWeight:800, letterSpacing:"-.03em",
                background:C.gHero, WebkitBackgroundClip:"text",
                WebkitTextFillColor:"transparent", lineHeight:1, marginBottom:8,
              }}>{val}</div>
              <div style={{ fontSize:14, color:C.sub, lineHeight:1.5 }}>{label}</div>
            </div>
          </Reveal>
        ))}
      </div>
      <style>{`@media(max-width:768px){.stats-grid{grid-template-columns:1fr 1fr!important}}`}</style>
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

  return (
    <section id="features" style={{ padding:"100px 24px" }}>
      <div style={{ maxWidth:1180, margin:"0 auto" }}>
        <Reveal>
          <div style={{ textAlign:"center", marginBottom:64 }}>
            <span style={{
              background:"rgba(129,140,248,.1)", border:"1px solid rgba(129,140,248,.2)",
              borderRadius:100, padding:"5px 16px", fontSize:13, color:C.indigo,
              fontWeight:500, display:"inline-block", marginBottom:16,
            }}>
              {ar ? "المنصة" : "Platform"}
            </span>
            <h2 style={{ fontSize:"clamp(28px,4vw,44px)", fontWeight:800,
              letterSpacing:"-.03em", color:C.text, margin:"0 0 16px" }}>
              {ar ? "كل ما تحتاجه لصحة موظفيك" : "Everything your workforce health program needs"}
            </h2>
            <p style={{ fontSize:17, color:C.sub, maxWidth:560, margin:"0 auto" }}>
              {ar
                ? "من التحليل الفوري إلى الرؤى المؤسسية — كل شيء في مكان واحد"
                : "From real-time analysis to enterprise insights — everything in one platform"}
            </p>
          </div>
        </Reveal>

        <div style={{ display:"grid", gridTemplateColumns:"240px 1fr", gap:32 }}
          className="features-grid">
          {/* Feature tabs */}
          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            {features.map((f, i) => (
              <button key={i} onClick={() => setActive(i)} style={{
                background: active === i ? "rgba(79,124,249,.12)" : "transparent",
                border: active === i ? "1px solid rgba(79,124,249,.25)" : "1px solid transparent",
                borderRadius:10, padding:"14px 16px",
                cursor:"pointer", textAlign:"left",
                transition:"all .2s",
                display:"flex", alignItems:"center", gap:10,
              }}>
                <span style={{ fontSize:20 }}>{f.icon}</span>
                <span style={{ fontSize:14, fontWeight:500,
                  color: active === i ? C.text : C.sub }}>{f.title}</span>
              </button>
            ))}
          </div>

          {/* Feature detail */}
          <div style={{ ...card(true), display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ fontSize:40 }}>{features[active].icon}</div>
            <h3 style={{ fontSize:24, fontWeight:700, color:C.text, margin:0 }}>
              {features[active].title}
            </h3>
            <p style={{ fontSize:16, color:C.indigo, margin:0, fontWeight:500 }}>
              {features[active].desc}
            </p>
            <p style={{ fontSize:15, color:C.sub, lineHeight:1.7, margin:0 }}>
              {features[active].detail}
            </p>
          </div>
        </div>
      </div>
      <style>{`@media(max-width:768px){.features-grid{grid-template-columns:1fr!important}}`}</style>
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
    <section style={{ padding:"100px 24px", background:C.bg1 }}>
      <div style={{ maxWidth:1180, margin:"0 auto" }}>
        <Reveal>
          <div style={{ textAlign:"center", marginBottom:64 }}>
            <h2 style={{ fontSize:"clamp(28px,4vw,44px)", fontWeight:800,
              letterSpacing:"-.03em", color:C.text, margin:"0 0 16px" }}>
              {ar ? "كيف يعمل النظام" : "How it works"}
            </h2>
            <p style={{ fontSize:17, color:C.sub }}>
              {ar ? "ثلاث خطوات بسيطة لبداية موثوقة" : "Three simple steps to a healthier team"}
            </p>
          </div>
        </Reveal>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:24 }}
          className="steps-grid">
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={i * 100}>
              <div style={{ ...card(), position:"relative" }}>
                <div style={{
                  fontSize:48, fontWeight:900, letterSpacing:"-.04em",
                  color:"rgba(79,124,249,.15)", lineHeight:1, marginBottom:16,
                }}>{s.n}</div>
                <h3 style={{ fontSize:20, fontWeight:700, color:C.text, margin:"0 0 10px" }}>
                  {s.title}
                </h3>
                <p style={{ fontSize:15, color:C.sub, lineHeight:1.6, margin:0 }}>
                  {s.desc}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
      <style>{`@media(max-width:768px){.steps-grid{grid-template-columns:1fr!important}}`}</style>
    </section>
  );
}

// ── Case Studies ──────────────────────────────────────────────────
function CaseStudies({ lang }) {
  const ar = lang === "ar";
  const cases = ar ? [
    { co:"شركة اتصالات كبرى", industry:"اتصالات", employees:"2,400", result:"↓52% غياب مرتبط بوضعية الجسم", time:"6 أشهر", detail:"وفرت 1.2م ج.م. سنوياً في تكاليف العلاج الطبيعي" },
    { co:"بنك وطني", industry:"مصرفية", employees:"850", result:"↑23% رضا الموظفين", time:"3 أشهر", detail:"انتشار ممتاز: 94% معدل استخدام يومي" },
    { co:"شركة تقنية ناشئة", industry:"تكنولوجيا", employees:"120", result:"↓38% شكاوى آلام الظهر", time:"4 أشهر", detail:"عائد استثمار 4.1× خلال السنة الأولى" },
  ] : [
    { co:"Major Telecom Corp.", industry:"Telecommunications", employees:"2,400", result:"↓52% posture-related absences", time:"6 months", detail:"Saved $340K annually in physiotherapy costs" },
    { co:"National Bank", industry:"Banking", employees:"850", result:"↑23% employee satisfaction", time:"3 months", detail:"Excellent adoption: 94% daily active rate" },
    { co:"Tech Startup", industry:"Technology", employees:"120", result:"↓38% back pain complaints", time:"4 months", detail:"4.1× ROI in the first year" },
  ];

  return (
    <section id="casestudies" style={{ padding:"100px 24px" }}>
      <div style={{ maxWidth:1180, margin:"0 auto" }}>
        <Reveal>
          <div style={{ textAlign:"center", marginBottom:64 }}>
            <span style={{
              background:"rgba(16,217,160,.08)", border:"1px solid rgba(16,217,160,.2)",
              borderRadius:100, padding:"5px 16px", fontSize:13, color:C.green,
              fontWeight:500, display:"inline-block", marginBottom:16,
            }}>
              {ar ? "نتائج حقيقية" : "Real Results"}
            </span>
            <h2 style={{ fontSize:"clamp(28px,4vw,44px)", fontWeight:800,
              letterSpacing:"-.03em", color:C.text, margin:"0 0 16px" }}>
              {ar ? "عملاؤنا يحقّقون نتائج قابلة للقياس" : "Our customers achieve measurable results"}
            </h2>
          </div>
        </Reveal>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:24 }}
          className="cases-grid">
          {cases.map((c, i) => (
            <Reveal key={c.co} delay={i * 100}>
              <div style={{ ...card(), height:"100%" }}>
                <div style={{
                  background:"rgba(79,124,249,.08)", borderRadius:8,
                  padding:"4px 10px", fontSize:12, color:C.indigo,
                  fontWeight:500, display:"inline-block", marginBottom:14,
                }}>{c.industry}</div>
                <h3 style={{ fontSize:17, fontWeight:700, color:C.text, margin:"0 0 6px" }}>
                  {c.co}
                </h3>
                <div style={{ fontSize:13, color:C.muted, marginBottom:18 }}>
                  {c.employees} {ar ? "موظف" : "employees"} · {c.time}
                </div>
                <div style={{
                  fontSize:22, fontWeight:800, color:C.green, marginBottom:10,
                }}>{c.result}</div>
                <p style={{ fontSize:14, color:C.sub, margin:0, lineHeight:1.6 }}>
                  {c.detail}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
      <style>{`@media(max-width:768px){.cases-grid{grid-template-columns:1fr!important}}`}</style>
    </section>
  );
}

// ── Pricing ───────────────────────────────────────────────────────
function Pricing({ lang, onCTA }) {
  const ar = lang === "ar";
  const [billing, setBilling] = useState("yearly");

  // Flat-rate pricing — matches TIERS in App.jsx exactly (single source of truth).
  // EGP shown for Egypt market, USD shown for Gulf/international (not per-seat — flat platform fee).
  const plans = [
    {
      id:"standard", name: ar?"ستارتر":"Starter",
      priceUSD:{ monthly:79, yearly:758 }, priceEGP:{ monthly:2499, yearly:23990 },
      color:C.sub,
      features: ar
        ? ["حتى 30 موظف","كشف 33 نقطة بالـAI","تقارير PDF","لوحة تحليلات HR","تجربة مجانية 7 أيام","دعم بالبريد"]
        : ["Up to 30 employees","33-point AI pose detection","PDF reports","HR analytics dashboard","7-day free trial","Email support"],
    },
    {
      id:"professional", name: ar?"جروث":"Growth",
      priceUSD:{ monthly:199, yearly:1910 }, priceEGP:{ monthly:6999, yearly:67190 },
      popular:true, color:C.blue,
      features: ar
        ? ["حتى 100 موظف","FaceMesh 478 نقطة","وضع رأس ثلاثي الأبعاد","تنبيهات Slack/Teams","تقرير HR تنفيذي","دعم أولوية + SLA"]
        : ["Up to 100 employees","FaceMesh 478 landmarks","3D head pose","Slack/Teams alerts","Executive HR reports","Priority support + SLA"],
    },
    {
      id:"elite", name: ar?"إنتربرايز":"Enterprise",
      priceUSD:{ monthly:null, yearly:null, startingAt:499 }, priceEGP:{ monthly:null, yearly:null },
      isEnterprise:true, color:C.green,
      features: ar
        ? ["موظفون غير محدودون","Gemini AI narrative","SAML SSO / Azure AD","White-label","SLA مخصص","مدير نجاح مخصص"]
        : ["Unlimited employees","Gemini AI narrative","SAML SSO / Azure AD","White-label","Custom SLA","Dedicated success manager"],
    },
  ];

  return (
    <section id="pricing" style={{ padding:"100px 24px", background:C.bg1 }}>
      <div style={{ maxWidth:1180, margin:"0 auto" }}>
        <Reveal>
          <div style={{ textAlign:"center", marginBottom:48 }}>
            <h2 style={{ fontSize:"clamp(28px,4vw,44px)", fontWeight:800,
              letterSpacing:"-.03em", color:C.text, margin:"0 0 16px" }}>
              {ar ? "أسعار بسيطة وشفافة" : "Simple, transparent pricing"}
            </h2>
            <p style={{ fontSize:17, color:C.sub, marginBottom:28 }}>
              {ar ? "ابدأ مجاناً · لا بطاقة ائتمان" : "Start free · No credit card required"}
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
                  border:"none", borderRadius:100, padding:"8px 20px",
                  cursor:"pointer", fontWeight:500, fontSize:14,
                  transition:"all .2s",
                }}>
                  {b === "monthly"
                    ? (ar ? "شهري" : "Monthly")
                    : (ar ? "سنوي (وفّر 20%)" : "Yearly (save 20%)")}
                </button>
              ))}
            </div>
          </div>
        </Reveal>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:20 }}
          className="pricing-grid">
          {plans.map((p, i) => (
            <Reveal key={p.id} delay={i * 80}>
              <div style={{
                ...card(p.popular),
                border: p.popular ? `1px solid rgba(79,124,249,.4)` : `1px solid ${C.border}`,
                position:"relative", height:"100%", display:"flex", flexDirection:"column",
              }}>
                {p.popular && (
                  <div style={{
                    position:"absolute", top:-12, left:"50%", transform:"translateX(-50%)",
                    background:C.gBlue, color:"#fff", borderRadius:100,
                    padding:"4px 16px", fontSize:12, fontWeight:600, whiteSpace:"nowrap",
                  }}>{ar ? "الأكثر شيوعاً" : "Most Popular"}</div>
                )}
                <div style={{ marginBottom:20 }}>
                  <div style={{ fontSize:13, color:p.color, fontWeight:600,
                    marginBottom:6, textTransform:"uppercase", letterSpacing:".06em" }}>
                    {p.name}
                  </div>
                  {p.isEnterprise ? (
                    <div>
                      <div style={{ fontSize:28, fontWeight:800, color:C.text }}>
                        {ar ? "تواصل معنا" : "Contact us"}
                      </div>
                      {p.priceUSD?.startingAt && (
                        <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>
                          {ar ? `يبدأ من $${p.priceUSD.startingAt}/شهر` : `Starting at $${p.priceUSD.startingAt}/mo`}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ display:"flex", alignItems:"baseline", gap:6, flexWrap:"wrap" }}>
                      <span style={{ fontSize:36, fontWeight:800, color:C.text }}>
                        ${p.priceUSD[billing]}
                      </span>
                      <span style={{ fontSize:14, color:C.muted }}>
                        /{ar ? "شهر" : "mo"}
                      </span>
                    <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>
                      ≈ {(billing==="monthly" ? p.priceEGP.monthly : Math.round(p.priceEGP.yearly/12)).toLocaleString()} {ar ? "ج.م./شهر" : "EGP/mo"}
                    </div>
                    </div>
                  )}
                </div>

                <ul style={{ listStyle:"none", padding:0, margin:"0 0 24px", flex:1 }}>
                  {p.features.map(f => (
                    <li key={f} style={{ display:"flex", gap:8, alignItems:"flex-start",
                      marginBottom:8, fontSize:14, color:C.sub }}>
                      <span style={{ color:p.color, marginTop:2, flexShrink:0 }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                {p.isEnterprise ? (
                  <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer"
                    style={{ ...btn("outline"), display:"block", textAlign:"center" }}>
                    {ar ? "احجز عرضاً" : "Book a Demo"}
                  </a>
                ) : (
                  <a href={`/auth?mode=signup&plan=${p.id}`} onClick={onCTA}
                    style={{ ...(p.popular ? btn("primary") : btn("ghost")),
                      display:"block", textAlign:"center" }}>
                    {ar ? "ابدأ الآن" : "Get started"}
                  </a>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
      <style>{`@media(max-width:1024px){.pricing-grid{grid-template-columns:1fr 1fr!important}}
        @media(max-width:600px){.pricing-grid{grid-template-columns:1fr!important}}`}</style>
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
    <section style={{ padding:"100px 24px" }}>
      <div style={{ maxWidth:1180, margin:"0 auto" }}>
        <Reveal>
          <h2 style={{ textAlign:"center", fontSize:"clamp(28px,4vw,44px)", fontWeight:800,
            letterSpacing:"-.03em", color:C.text, margin:"0 0 56px" }}>
            {ar ? "ماذا يقول عملاؤنا" : "What our customers say"}
          </h2>
        </Reveal>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:24 }}
          className="testimonials-grid">
          {testimonials.map((t, i) => (
            <Reveal key={t.name} delay={i * 100}>
              <div style={{ ...card(), height:"100%" }}>
                <div style={{ display:"flex", gap:2, marginBottom:14 }}>
                  {"★★★★★".split("").map((s,i) => (
                    <span key={i} style={{ color:C.amber, fontSize:16 }}>{s}</span>
                  ))}
                  <span style={{ color:C.muted, fontSize:13, marginLeft:8 }}>{t.score}</span>
                </div>
                <p style={{ fontSize:15, color:C.sub, lineHeight:1.7, margin:"0 0 20px",
                  fontStyle:"italic" }}>"{t.text}"</p>
                <div>
                  <div style={{ fontWeight:600, color:C.text, fontSize:15 }}>{t.name}</div>
                  <div style={{ color:C.muted, fontSize:13 }}>{t.role}</div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
      <style>{`@media(max-width:768px){.testimonials-grid{grid-template-columns:1fr!important}}`}</style>
    </section>
  );
}

// ── FAQ ───────────────────────────────────────────────────────────
function FAQ({ lang }) {
  const ar = lang === "ar";
  const [open, setOpen] = useState(null);
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
    <section style={{ padding:"100px 24px", background:C.bg1 }}>
      <div style={{ maxWidth:720, margin:"0 auto" }}>
        <Reveal>
          <h2 style={{ textAlign:"center", fontSize:"clamp(28px,4vw,40px)", fontWeight:800,
            letterSpacing:"-.03em", color:C.text, margin:"0 0 56px" }}>
            {ar ? "أسئلة شائعة" : "Frequently asked questions"}
          </h2>
        </Reveal>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {items.map(([q, a], i) => (
            <Reveal key={i} delay={i * 50}>
              <div style={{
                background:C.card, border:`1px solid ${open===i ? "rgba(79,124,249,.3)" : C.border}`,
                borderRadius:12, overflow:"hidden", transition:"border-color .2s",
              }}>
                <button onClick={() => setOpen(open===i ? null : i)} style={{
                  width:"100%", padding:"18px 20px", background:"transparent",
                  border:"none", cursor:"pointer",
                  display:"flex", justifyContent:"space-between", alignItems:"center",
                  textAlign:"left",
                }}>
                  <span style={{ fontWeight:600, color:C.text, fontSize:15, flex:1 }}>{q}</span>
                  <span style={{
                    color:C.blue, fontSize:20, transform: open===i ? "rotate(45deg)":"none",
                    transition:"transform .2s", marginLeft:12, flexShrink:0,
                  }}>+</span>
                </button>
                {open === i && (
                  <div style={{ padding:"0 20px 18px" }}>
                    <p style={{ color:C.sub, fontSize:15, lineHeight:1.7, margin:0 }}>{a}</p>
                  </div>
                )}
              </div>
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
    <section style={{ padding:"120px 24px" }}>
      <div style={{ maxWidth:760, margin:"0 auto", textAlign:"center" }}>
        <Reveal>
          <div style={{
            background:"linear-gradient(135deg,rgba(79,124,249,.08),rgba(16,217,160,.04))",
            border:`1px solid rgba(79,124,249,.2)`,
            borderRadius:24, padding:"64px 48px",
          }}>
            <div style={{ fontSize:48, marginBottom:20 }}>🧘</div>
            <h2 style={{ fontSize:"clamp(28px,4vw,40px)", fontWeight:800,
              letterSpacing:"-.03em", color:C.text, margin:"0 0 16px" }}>
              {ar ? "ابدأ تحسين صحة فريقك اليوم" : "Start improving your team's health today"}
            </h2>
            <p style={{ fontSize:17, color:C.sub, maxWidth:480, margin:"0 auto 36px" }}>
              {ar
                ? "انضم إلى أكثر من 200 شركة تستخدم Corvus. تجربة مجانية 7 أيام."
                : "Join 200+ companies using Corvus. 7-day free trial, no credit card required."}
            </p>
            <div style={{ display:"flex", gap:14, justifyContent:"center", flexWrap:"wrap" }}>
              <a href="#" onClick={(e)=>{e.preventDefault();onCTA(e);navTo("/auth?mode=signup")}} style={btn("primary","lg")}>
                {ar ? "🚀 ابدأ مجاناً الآن" : "🚀 Start Free Today"}
              </a>
              <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" style={btn("ghost","lg")}>
                {ar ? "تحدث مع المبيعات" : "Talk to Sales"}
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
    <footer style={{
      borderTop:`1px solid ${C.border}`, padding:"64px 24px 32px",
      background:C.bg,
    }}>
      <div style={{ maxWidth:1180, margin:"0 auto" }}>
        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr", gap:40,
          marginBottom:48 }} className="footer-grid">
          {/* Brand */}
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
              <div style={{ width:32, height:32, borderRadius:8, background:C.gBlue,
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🧘</div>
              <span style={{ fontWeight:700, color:C.text, fontSize:16 }}>Corvus</span>
            </div>
            <p style={{ fontSize:14, color:C.muted, lineHeight:1.7, maxWidth:280, margin:"0 0 16px" }}>
              {ar
                ? "منصة ذكاء اصطناعي لصحة القوى العاملة. موثوقة من قِبل 200+ شركة في منطقة MENA."
                : "AI-powered workforce health intelligence. Trusted by 200+ companies across MENA."}
            </p>
            <div style={{ display:"flex", gap:10 }}>
              {["LinkedIn","Twitter","YouTube"].map(s => (
                <a key={s} href={`https://${s.toLowerCase()}.com/corvus`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ color:C.muted, fontSize:12, textDecoration:"none",
                    padding:"6px 10px", border:`1px solid ${C.border}`,
                    borderRadius:6, transition:"color .2s" }}
                  onMouseEnter={e=>e.target.style.color=C.text}
                  onMouseLeave={e=>e.target.style.color=C.muted}>
                  {s}
                </a>
              ))}
            </div>
          </div>
          {/* Link columns */}
          {Object.values(sections).map(sec => (
            <div key={sec.title}>
              <div style={{ fontSize:12, fontWeight:600, color:C.muted,
                textTransform:"uppercase", letterSpacing:".08em", marginBottom:16 }}>
                {sec.title}
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {sec.links.map(([label, href]) => (
                  <a key={label} href={href} style={{
                    color:C.sub, fontSize:14, textDecoration:"none",
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
          borderTop:`1px solid ${C.border}`, paddingTop:24,
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

  const handleCTA = useCallback(e => {
    // Track conversion click
    if (window.posthog) window.posthog.capture("landing_cta_click");
  }, []);

  useEffect(() => {
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <div style={{ background:C.bg, minHeight:"100vh", color:C.text,
      fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <Nav lang={lang} setLang={setLang} onCTA={handleCTA}/>
      <Hero lang={lang} onCTA={handleCTA}/>
      <SocialProof lang={lang}/>
      <Stats lang={lang}/>
      <Features lang={lang}/>
      <HowItWorks lang={lang}/>
      <CaseStudies lang={lang}/>
      <Pricing lang={lang} onCTA={handleCTA}/>
      <Testimonials lang={lang}/>
      <FAQ lang={lang}/>
      <FinalCTA lang={lang} onCTA={handleCTA}/>
      <Footer lang={lang}/>
    </div>
  );
}
