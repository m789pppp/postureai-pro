import React, { useState, useEffect } from "react";

// ── Tokens (mirror LandingPageV7) ─────────────────────────────────
const T = {
  bg:"#030b14", bg1:"#040d18", card:"#0d1f33",
  border:"rgba(148,163,184,.08)", borderM:"rgba(148,163,184,.16)",
  text:"#e8f0ff", sub:"#94a3b8", muted:"#475569",
  blue:"#4f7cf9", indigo:"#818cf8", sky:"#22d3ee", green:"#10d9a0",
};
const FD = "'IBM Plex Sans Arabic','Segoe UI',system-ui,sans-serif";
const FM = "'IBM Plex Mono','Segoe UI',monospace";
const SUPPORT = import.meta.env.VITE_SUPPORT_EMAIL || "m789pppp@gmail.com";

// ── Nav links → all go to landing page anchors ────────────────────
const NAV_EN = [
  { label:"Product",      href:"/#features" },
  { label:"Solutions",    href:"/#casestudies" },
  { label:"Pricing",      href:"/#pricing" },
  { label:"How it works", href:"/#how" },
  { label:"FAQ",          href:"/#faq" },
];
const NAV_AR = [
  { label:"المنتج",    href:"/#features" },
  { label:"الحلول",   href:"/#casestudies" },
  { label:"الأسعار",  href:"/#pricing" },
  { label:"كيف يعمل", href:"/#how" },
  { label:"الأسئلة",  href:"/#faq" },
];

// ── CTA button style ──────────────────────────────────────────────
const ctaStyle = {
  display:"inline-flex", alignItems:"center", justifyContent:"center",
  height:38, padding:"0 18px", borderRadius:10, fontWeight:700,
  fontSize:13.5, cursor:"pointer", border:"none", textDecoration:"none",
  background:"linear-gradient(135deg,#1a56db,#0891b2)", color:"#fff",
  boxShadow:"0 4px 16px rgba(26,86,219,.35)", transition:"opacity .18s, transform .18s",
  fontFamily:"inherit", whiteSpace:"nowrap", letterSpacing:"-.01em",
};

// ═══════════════════════════════════════════════════════════════════
// SharedNav
// ═══════════════════════════════════════════════════════════════════
export function SharedNav({ lang, setLang, activePage }) {
  const [scrolled, setScrolled]   = useState(false);
  const [open, setOpen]           = useState(false);
  const ar = lang === "ar";
  const items = ar ? NAV_AR : NAV_EN;

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", h, { passive:true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  useEffect(() => {
    const h = () => { if (window.innerWidth > 860) setOpen(false); };
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  // Lock body scroll when mobile menu open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <style>{`
        .sn-link { color:#64748b; text-decoration:none; padding:8px 13px; border-radius:8px;
          font-size:13.5px; font-weight:500; transition:color .18s; position:relative;
          display:flex; align-items:center; }
        .sn-link:hover { color:#f1f5f9 !important; }
        .sn-link.active { color:#e8f0ff; font-weight:600; }
        .sn-link.active::after { content:""; position:absolute; bottom:2px; left:50%;
          transform:translateX(-50%); width:18px; height:2px; border-radius:2px;
          background:linear-gradient(90deg,#4f7cf9,#22d3ee); }
        .sn-wrap { max-width:1180px; margin:0 auto; padding:0 32px;
          height:68px; display:flex; align-items:center; justify-content:space-between; gap:16px; }
        .sn-center { display:flex; align-items:center; gap:2px; flex:1; justify-content:center; }
        .sn-right  { display:flex; align-items:center; gap:8px; flex-shrink:0; }
        .sn-burger { display:none; width:40px; height:40px; border-radius:9px;
          background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.09);
          cursor:pointer; align-items:center; justify-content:center; flex-shrink:0; }
        @media(max-width:860px){
          .sn-center,.sn-right { display:none !important; }
          .sn-burger { display:flex !important; }
          .sn-wrap { padding:0 20px; }
        }
        @media(max-width:1024px){
          .sn-link { padding:8px 10px !important; font-size:13px !important; }
          .sn-wrap { padding:0 24px; }
        }
      `}</style>

      <nav style={{
        position:"fixed", top:0, left:0, right:0, zIndex:1000,
        background: scrolled||open ? "rgba(3,8,18,.96)" : "rgba(3,8,18,.5)",
        backdropFilter:"blur(28px) saturate(180%)",
        WebkitBackdropFilter:"blur(28px) saturate(180%)",
        borderBottom:`1px solid ${scrolled ? "rgba(255,255,255,.09)" : "transparent"}`,
        boxShadow: scrolled ? "0 2px 32px rgba(0,0,0,.45)" : "none",
        transition:"background .3s, border-color .3s, box-shadow .3s",
      }}>
        <div className="sn-wrap">

          {/* ── Logo ── */}
          <a href="/" style={{ display:"flex", alignItems:"center", gap:10, textDecoration:"none", flexShrink:0 }}>
            <div style={{
              width:36, height:36, borderRadius:10, flexShrink:0,
              background:"linear-gradient(135deg,#1a56db,#0891b2)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:18, color:"#fff", fontWeight:900,
              boxShadow:"0 4px 14px rgba(26,86,219,.4)",
            }}>◈</div>
            <div style={{ lineHeight:1.2 }}>
              <div style={{ fontWeight:800, fontSize:15, color:"#f1f5f9", letterSpacing:"-.025em", fontFamily:FD }}>Corvus</div>
              <div style={{ fontSize:9, color:"#475569", letterSpacing:".06em", textTransform:"uppercase" }}>AI Posture Coaching</div>
            </div>
          </a>

          {/* ── Center links ── */}
          <nav className="sn-center" aria-label="Main navigation">
            {items.map(({ label, href }) => {
              const isActive = activePage && href.includes(activePage);
              return (
                <a key={label} href={href} className={`sn-link${isActive?" active":""}`}>
                  {label}
                </a>
              );
            })}
          </nav>

          {/* ── Right actions ── */}
          <div className="sn-right">
            {/* Lang toggle */}
            <button onClick={() => { setLang(ar?"en":"ar"); try{localStorage.setItem("lp_lang",ar?"en":"ar");}catch{} }}
              style={{
                background:"rgba(255,255,255,.05)", border:"1px solid rgba(255,255,255,.09)",
                color:"#64748b", padding:"6px 12px", borderRadius:8,
                cursor:"pointer", fontSize:12.5, fontWeight:500, fontFamily:"inherit",
                transition:"all .18s",
              }}
              onMouseEnter={e=>{e.currentTarget.style.color="#f1f5f9";e.currentTarget.style.borderColor="rgba(255,255,255,.2)"}}
              onMouseLeave={e=>{e.currentTarget.style.color="#64748b";e.currentTarget.style.borderColor="rgba(255,255,255,.09)"}}>
              {ar?"EN":"عربي"}
            </button>
            {/* Log in */}
            <a href="/auth" style={{
              color:"#94a3b8", textDecoration:"none", fontSize:13.5,
              fontWeight:500, padding:"8px 10px", borderRadius:8, transition:"color .18s",
            }}
            onMouseEnter={e=>e.currentTarget.style.color="#f1f5f9"}
            onMouseLeave={e=>e.currentTarget.style.color="#94a3b8"}>
              {ar?"دخول":"Log in"}
            </a>
            {/* CTA */}
            <a href="/auth?mode=signup" style={ctaStyle}
              onMouseEnter={e=>{e.currentTarget.style.opacity=".88";e.currentTarget.style.transform="translateY(-1px)"}}
              onMouseLeave={e=>{e.currentTarget.style.opacity="1";e.currentTarget.style.transform="none"}}>
              {ar?"ابدأ مجاناً":"Start Free Trial"}
            </a>
          </div>

          {/* ── Burger ── */}
          <button className="sn-burger" onClick={()=>setOpen(o=>!o)} aria-label="Menu">
            <div style={{ width:18, height:12, position:"relative" }}>
              {[0,1,2].map(i=>(
                <span key={i} style={{
                  position:"absolute", left:0, right:0, height:1.5, borderRadius:2,
                  background:"#e2e8f0", top:i===0?0:i===1?5.5:11,
                  transition:"transform .25s, opacity .2s",
                  transform:open?(i===0?"translateY(5.5px) rotate(45deg)":i===1?"scaleX(0)":"translateY(-5.5px) rotate(-45deg)"):"none",
                  opacity:open&&i===1?0:1,
                }}/>
              ))}
            </div>
          </button>
        </div>

        {/* ── Mobile panel ── */}
        {open && (
          <div style={{ borderTop:"1px solid rgba(255,255,255,.07)", background:"rgba(3,8,18,.99)" }}>
            <div style={{ padding:"8px 20px 28px", display:"flex", flexDirection:"column" }}>
              {items.map(({label,href})=>(
                <a key={label} href={href} onClick={()=>setOpen(false)} style={{
                  color:"#94a3b8", textDecoration:"none", padding:"14px 4px",
                  fontSize:15, fontWeight:500,
                  borderBottom:"1px solid rgba(255,255,255,.05)",
                  display:"flex", alignItems:"center", justifyContent:"space-between",
                  transition:"color .18s",
                }}
                onMouseEnter={e=>e.currentTarget.style.color="#f1f5f9"}
                onMouseLeave={e=>e.currentTarget.style.color="#94a3b8"}>
                  {label}
                  <span style={{color:"#334155",fontSize:13}}>›</span>
                </a>
              ))}
              <div style={{ display:"flex", gap:10, marginTop:20 }}>
                <a href="/auth" style={{
                  flex:1, textAlign:"center", padding:"12px", borderRadius:10,
                  border:"1px solid rgba(255,255,255,.12)", color:"#94a3b8",
                  textDecoration:"none", fontSize:14, fontWeight:500,
                }}>
                  {ar?"دخول":"Log in"}
                </a>
                <a href="/auth?mode=signup" style={{...ctaStyle, flex:1, height:46, borderRadius:10, fontSize:14}}>
                  {ar?"ابدأ مجاناً":"Start Free Trial"}
                </a>
              </div>
              <button onClick={()=>setLang(ar?"en":"ar")} style={{
                marginTop:14, background:"transparent", border:"none",
                color:"#475569", fontSize:12.5, cursor:"pointer", fontFamily:"inherit",
              }}>{ar?"Switch to English":"التبديل للعربية"}</button>
            </div>
          </div>
        )}
      </nav>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SharedFooter
// ═══════════════════════════════════════════════════════════════════
export function SharedFooter({ lang }) {
  const ar = lang === "ar";

  const cols = ar ? [
    { title:"المنتج", links:[["المميزات","/#features"],["كيف يعمل","/#how"],["الأسعار","/#pricing"]] },
    { title:"الحلول", links:[["للشركات","/#casestudies"],["للأفراد","/#pricing"],["شراكات",`mailto:${SUPPORT}?subject=Partnership`]] },
    { title:"الدعم",  links:[["الأسئلة الشائعة","/#faq"],["تواصل معنا",`mailto:${SUPPORT}`],["حجز عرض",`mailto:${SUPPORT}?subject=Demo`]] },
    { title:"قانوني", links:[["الخصوصية",`mailto:${SUPPORT}?subject=Privacy`],["الشروط",`mailto:${SUPPORT}?subject=Terms`],["الأمان",`mailto:${SUPPORT}?subject=Security`]] },
  ] : [
    { title:"Product",  links:[["Features","/#features"],["How it works","/#how"],["Pricing","/#pricing"]] },
    { title:"Solutions",links:[["For Teams","/#casestudies"],["For Individuals","/#pricing"],["Partnerships",`mailto:${SUPPORT}?subject=Partnership`]] },
    { title:"Support",  links:[["FAQ","/#faq"],["Contact us",`mailto:${SUPPORT}`],["Book a Demo",`mailto:${SUPPORT}?subject=Demo`]] },
    { title:"Legal",    links:[["Privacy",`mailto:${SUPPORT}?subject=Privacy`],["Terms",`mailto:${SUPPORT}?subject=Terms`],["Security",`mailto:${SUPPORT}?subject=Security`]] },
  ];

  return (
    <>
      <style>{`
        .sf-wrap { max-width:1180px; margin:0 auto; padding:0 32px; }
        .sf-grid { display:grid; grid-template-columns:1.6fr 1fr 1fr 1fr; gap:40px 32px; }
        .sf-link { color:#475569; text-decoration:none; font-size:13.5px; display:block;
          margin-bottom:10px; transition:color .18s; line-height:1.5; }
        .sf-link:hover { color:#94a3b8 !important; }
        @media(max-width:1024px){ .sf-grid { grid-template-columns:1fr 1fr 1fr; gap:28px 20px; } }
        @media(max-width:640px){
          .sf-grid { grid-template-columns:1fr 1fr; gap:24px 16px; }
          .sf-wrap { padding:0 20px; }
        }
      `}</style>

      <footer style={{
        borderTop:`1px solid rgba(148,163,184,.07)`,
        background:T.bg1,
        padding:"64px 0 40px",
        marginTop:0,
      }}>
        <div className="sf-wrap">
          <div className="sf-grid">

            {/* ── Brand column ── */}
            <div>
              <a href="/" style={{ display:"flex", alignItems:"center", gap:9, textDecoration:"none", marginBottom:18 }}>
                <div style={{
                  width:34, height:34, borderRadius:9,
                  background:"linear-gradient(135deg,#1a56db,#0891b2)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:16, color:"#fff", fontWeight:900,
                  boxShadow:"0 4px 12px rgba(26,86,219,.3)",
                }}>◈</div>
                <div>
                  <div style={{ fontWeight:800, fontSize:15, color:"#f1f5f9", letterSpacing:"-.02em", fontFamily:FD }}>Corvus</div>
                  <div style={{ fontSize:9, color:"#334155", letterSpacing:".06em", textTransform:"uppercase" }}>AI Posture Coaching</div>
                </div>
              </a>
              <p style={{ fontSize:13.5, color:"#475569", lineHeight:1.7, maxWidth:220, marginBottom:24 }}>
                {ar
                  ? "منصة ذكاء اصطناعي لمراقبة وضعية الجسم في بيئات العمل."
                  : "AI-powered workplace posture monitoring for healthier, more productive teams."}
              </p>
              {/* Trust badges */}
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {[["🛡","ISO 27001"],["🔒","AES-256"],["✅","GDPR"]].map(([icon,label])=>(
                  <div key={label} style={{
                    display:"flex", alignItems:"center", gap:5,
                    background:"rgba(79,124,249,.06)", border:"1px solid rgba(79,124,249,.14)",
                    borderRadius:8, padding:"5px 10px",
                  }}>
                    <span style={{fontSize:11}}>{icon}</span>
                    <span style={{fontSize:10.5, color:"#4f7cf9", fontWeight:600, fontFamily:FM}}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Link columns ── */}
            {cols.map(col => (
              <div key={col.title}>
                <div style={{ fontSize:11, fontWeight:700, color:"#334155", letterSpacing:".08em",
                  textTransform:"uppercase", marginBottom:18, fontFamily:FM }}>
                  {col.title}
                </div>
                {col.links.map(([label, href]) => (
                  <a key={label} href={href} className="sf-link">{label}</a>
                ))}
              </div>
            ))}
          </div>

          {/* ── Bottom bar ── */}
          <div style={{
            marginTop:52, paddingTop:24,
            borderTop:"1px solid rgba(148,163,184,.06)",
            display:"flex", alignItems:"center", justifyContent:"space-between",
            flexWrap:"wrap", gap:12,
          }}>
            <span style={{ fontSize:12.5, color:"#334155" }}>
              © 2025 Corvus Health Intelligence.{" "}
              {ar ? "جميع الحقوق محفوظة." : "All rights reserved."}
            </span>
            <span style={{ fontSize:12, color:"#1e3a5f", fontWeight:500 }}>
              {ar ? "صُنع بـ ❤️ في مصر" : "Made with ❤️ in Egypt"}
            </span>
          </div>
        </div>
      </footer>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PageShell — wraps every standalone page
// ═══════════════════════════════════════════════════════════════════
export function PageShell({ lang, setLang, activePage, children }) {
  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        html { scroll-behavior:smooth; }
        body { background:#030b14; color:#e8f0ff; overflow-x:hidden;
          font-family:'IBM Plex Sans Arabic','Segoe UI',system-ui,sans-serif; }
        .lp-wrap  { max-width:1180px; margin:0 auto; padding:0 32px; }
        .lp-section { padding:clamp(56px,7vw,100px) 32px; }
        .lp-lift { transition:transform .22s ease, box-shadow .22s ease; }
        .lp-lift:hover { transform:translateY(-3px); box-shadow:0 12px 40px rgba(0,0,0,.4); }
        @media(max-width:1024px){
          .lp-wrap { padding:0 20px; }
          .lp-section { padding:56px 20px; }
        }
        @media(max-width:720px){
          .lp-wrap { padding:0 16px; }
          .lp-section { padding:44px 16px; }
        }
      `}</style>
      <div style={{ background:T.bg, minHeight:"100vh", color:T.text,
        fontFamily:FD, display:"flex", flexDirection:"column" }}>
        <SharedNav lang={lang} setLang={setLang} activePage={activePage}/>
        <main style={{ paddingTop:68, flex:1 }}>
          {children}
        </main>
        <SharedFooter lang={lang}/>
      </div>
    </>
  );
}
