import React, { useState, useEffect, useRef } from "react";
import { motion, useInView } from "framer-motion";
import {
  LPV7_TOKENS, FONT_DISPLAY, FONT_MONO, TYPE, card, CALENDLY_URL,
  Reveal, Stagger, StaggerItem, AnimNum, SectionHead, LP_GLOBAL_CSS
} from "./lpShared.jsx";

const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || "m789pppp@gmail.com";


function Nav({ lang, setLang, onCTA }) {
  const [scrolled,     setScrolled]     = useState(false);
  const [mobileOpen,   setMobileOpen]   = useState(false);
  const [activeSection,setActiveSection]= useState("");

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 48);
    window.addEventListener("scroll", h, { passive:true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  useEffect(() => {
    const ids = ["features","casestudies","pricing","how"];
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if(e.isIntersecting) setActiveSection(e.target.id); }),
      { rootMargin:"-30% 0px -60% 0px" }
    );
    ids.forEach(id => { const el=document.getElementById(id); if(el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const h = () => { if(window.innerWidth>860) setMobileOpen(false); };
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  const ar = lang === "ar";

  const navItems = ar ? [
    { label:"المنتج",    href:"/product",      page:true },
    { label:"الحلول",   href:"/solutions",    page:true },
    { label:"الأسعار",  href:"/pricing",      page:true },
    { label:"كيف يعمل", href:"/how-it-works", page:true },
    { label:"الأسئلة",  href:"/faq",          page:true },
  ] : [
    { label:"Product",     href:"/product",      page:true },
    { label:"Solutions",   href:"/solutions",    page:true },
    { label:"Pricing",     href:"/pricing",      page:true },
    { label:"How it works",href:"/how-it-works", page:true },
    { label:"FAQ",         href:"/faq",          page:true },
  ];

  return (
    <>
      <nav style={{
        position:"fixed", top:0, left:0, right:0, zIndex:1000,
        background: scrolled || mobileOpen
          ? "rgba(3,8,18,.95)"
          : "rgba(3,8,18,.45)",
        backdropFilter:"blur(28px) saturate(180%)",
        WebkitBackdropFilter:"blur(28px) saturate(180%)",
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
              <div style={{ fontSize:9, color:"#475569", letterSpacing:".06em", textTransform:"uppercase", marginTop:1 }}>AI Posture Coaching</div>
            </div>
          </a>

          {/* ── Center links ── */}
          <div className="lp-nav-links" style={{ display:"flex", alignItems:"center", gap:1, flex:1, justifyContent:"center" }}>
            {navItems.map(({ label, href, page }) => {
              const active = window.location.pathname === href;
              return (
                <a key={label} href={href}
                  style={{
                    position:"relative", display:"flex", alignItems:"center",
                    color: active ? "#f1f5f9" : "#64748b",
                    textDecoration:"none", padding:"8px 14px", borderRadius:8,
                    fontSize:13.5, fontWeight: active ? 600 : 500,
                    transition:"color .2s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.color="#f1f5f9"}
                  onMouseLeave={e => e.currentTarget.style.color = active ? "#f1f5f9" : "#64748b"}>
                  {label}
                  {active && (
                    <span style={{
                      position:"absolute", bottom:2, left:"50%", transform:"translateX(-50%)",
                      width:20, height:2, borderRadius:2,
                      background:"linear-gradient(90deg,#1a56db,#0891b2)",
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
              color:"#64748b", padding:"6px 12px", borderRadius:8,
              cursor:"pointer", fontSize:12.5, fontWeight:500, fontFamily:"inherit",
              transition:"all .18s",
            }}
            onMouseEnter={e=>{e.currentTarget.style.color="#f1f5f9";e.currentTarget.style.borderColor="rgba(255,255,255,.18)"}}
            onMouseLeave={e=>{e.currentTarget.style.color="#64748b";e.currentTarget.style.borderColor="rgba(255,255,255,.09)"}}>
              {ar ? "EN" : "عربي"}
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
                <a key={href} href={href} onClick={()=>setMobileOpen(false)} style={{
                  color:"#94a3b8", textDecoration:"none", padding:"13px 4px",
                  fontSize:15, fontWeight:500, borderBottom:"1px solid rgba(255,255,255,.06)",
                  display:"flex", alignItems:"center", justifyContent:"space-between",
                  transition:"color .18s",
                }}
                onMouseEnter={e=>e.currentTarget.style.color="#f1f5f9"}
                onMouseLeave={e=>e.currentTarget.style.color="#94a3b8"}>
                  {label}
                  <span style={{ fontSize:12, color:"#334155" }}>›</span>
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
                marginTop:12, background:"transparent", border:"none",
                color:"#475569", fontSize:12.5, cursor:"pointer", textAlign:"center",
                fontFamily:"inherit",
              }}>{ar ? "Switch to English" : "التبديل للعربية"}</button>
            </div>
          </div>
        )}
      </nav>
      <style>{`@media(max-width:860px){.lp-nav-links,.lp-nav-actions{display:none!important}.lp-nav-burger{display:flex!important}}`}</style>
    </>
  );
}

// ── Hero ──────────────────────────────────────────────────────────


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

  const socials = [
    { icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>, href:"https://www.linkedin.com/in/mo-postureai", title:"LinkedIn" },
    { icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.261 5.636 5.9-5.636zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>, href:"https://x.com/corvusposture", title:"X (Twitter)" },
    { icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>, href:"https://youtube.com/@corvusai", title:"YouTube" },
    { icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>, href:"https://instagram.com/corvusai", title:"Instagram" },
  ];

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
                <div style={{ fontSize:9, color:"#334155", letterSpacing:".05em", textTransform:"uppercase" }}>AI Posture Coaching</div>
              </div>
            </div>

            {/* Tagline */}
            <p style={{ fontSize:13, color:"#475569", lineHeight:1.8, maxWidth:200, margin:"0 0 20px" }}>
              {ar
                ? "قلّل إجازات الأمراض وارفع إنتاجية فريقك. مبني لفرق MENA."
                : "Cut sick leave 47% and boost team productivity. Built for MENA teams."}
            </p>

            {/* Social icons */}
            <div style={{ display:"flex", gap:7 }}>
              {socials.map(({ icon, href, title }) => (
                <a key={title} href={href} title={title}
                  target="_blank" rel="noopener noreferrer"
                  style={{
                    width:34, height:34, borderRadius:9,
                    background:"rgba(255,255,255,.04)",
                    border:"1px solid rgba(255,255,255,.08)",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    color:"#475569", textDecoration:"none",
                    transition:"all .2s",
                  }}
                  onMouseEnter={e=>{
                    e.currentTarget.style.color="#e2e8f0";
                    e.currentTarget.style.background="rgba(255,255,255,.09)";
                    e.currentTarget.style.borderColor="rgba(255,255,255,.16)";
                  }}
                  onMouseLeave={e=>{
                    e.currentTarget.style.color="#475569";
                    e.currentTarget.style.background="rgba(255,255,255,.04)";
                    e.currentTarget.style.borderColor="rgba(255,255,255,.08)";
                  }}>
                  {icon}
                </a>
              ))}
            </div>

            {/* Trust badges */}
            <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginTop:18 }}>
              {["ISO 27001","AES-256","GDPR"].map(b=>(
                <span key={b} style={{
                  fontSize:9.5, color:"#334155", padding:"3px 8px",
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
                textTransform:"uppercase", color:"#334155", marginBottom:16,
              }}>{col.title}</div>
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {col.links.map(({ label, href, anchor }) => (
                  anchor
                    ? <button key={label}
                        onClick={() => scrollTo(href)}
                        style={{
                          background:"none", border:"none", padding:0, cursor:"pointer",
                          textAlign: ar ? "right" : "left", color:"#475569",
                          fontSize:13.5, fontWeight:400, fontFamily:"inherit",
                          transition:"color .18s",
                        }}
                        onMouseEnter={e=>e.currentTarget.style.color="#94a3b8"}
                        onMouseLeave={e=>e.currentTarget.style.color="#475569"}>
                        {label}
                      </button>
                    : <a key={label} href={href}
                        target={href.startsWith("http") ? "_blank" : undefined}
                        rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                        style={{ color:"#475569", fontSize:13.5, textDecoration:"none", transition:"color .18s" }}
                        onMouseEnter={e=>e.currentTarget.style.color="#94a3b8"}
                        onMouseLeave={e=>e.currentTarget.style.color="#475569"}>
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
          <span style={{ fontSize:12, color:"#334155" }}>
            © {new Date().getFullYear()} Corvus Health Intelligence.{" "}
            {ar ? "جميع الحقوق محفوظة." : "All rights reserved."}
          </span>
          <div style={{ display:"flex", gap:20, alignItems:"center" }}>
            <a href={`mailto:${SUPPORT_EMAIL}`}
              style={{ fontSize:12, color:"#334155", textDecoration:"none", transition:"color .18s" }}
              onMouseEnter={e=>e.currentTarget.style.color="#64748b"}
              onMouseLeave={e=>e.currentTarget.style.color="#334155"}>
              {SUPPORT_EMAIL}
            </a>
            <span style={{ fontSize:11.5, color:"#334155" }}>
              {ar ? "صُنع بـ ❤ في مصر" : "Made with ❤ in Egypt"}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ── Root ──────────────────────────────────────────────────────────

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
      color:LPV7_TOKENS.sub,
      features: ar
        ? ["جلسات غير محدودة","مدرب AI (10 رسائل/شهر)","سلسلة وأهداف","توقع الألم","المتصدرين","بطاقة مشاركة"]
        : ["Unlimited sessions","AI Coach (10 msgs/mo)","Streak & Goals","Pain prediction","Leaderboard","Share card"],
    },
    {
      id:"professional", name: ar?"احترافي":"Pro",
      priceUSD:{ monthly:19.99, yearly:159.99 }, priceEGP:{ monthly:399, yearly:3190 },
      popular:true, color:LPV7_TOKENS.blue,
      features: ar
        ? ["كل Basic","رؤى AI","تقارير كاملة","مقارنة الجلسات","تصدير CSV/PDF","تقرير أسبوعي","تنبيهات الشذوذ"]
        : ["Everything in Basic","AI Insights","Full Reports","Session compare","Export CSV/PDF","Weekly report","Anomaly alerts"],
    },
    {
      id:"elite", name: ar?"إيليت":"Elite",
      priceUSD:{ monthly:39.99, yearly:299.99 }, priceEGP:{ monthly:699, yearly:5590 },
      color:LPV7_TOKENS.green,
      features: ar
        ? ["كل Pro","مدرب AI غير محدود","AI تنبؤي","تقرير PDF","دعم أولوية","معايرة","سرد الجلسة"]
        : ["Everything in Pro","AI Coach unlimited","Predictive AI","PDF report","Priority support","Calibration","Session narrative"],
    },
  ];

  const b2bPlans = [
    {
      id:"b2b_starter", name: ar?"ستارتر":"Starter",
      priceUSD:{ monthly:79, yearly:758 }, priceEGP:{ monthly:2499, yearly:23990 },
      color:LPV7_TOKENS.sub,
      features: ar
        ? ["حتى 30 موظف","كشف 33 نقطة بالـAI","تقارير PDF","لوحة تحليلات HR","تجربة مجانية 7 أيام","دعم بالبريد"]
        : ["Up to 30 employees","33-point AI pose detection","PDF reports","HR analytics dashboard","7-day free trial","Email support"],
    },
    {
      id:"b2b_growth", name: ar?"جروث":"Growth",
      priceUSD:{ monthly:199, yearly:1910 }, priceEGP:{ monthly:6999, yearly:67190 },
      popular:true, color:LPV7_TOKENS.blue,
      features: ar
        ? ["حتى 100 موظف","FaceMesh 478 نقطة","وضع رأس ثلاثي الأبعاد","تنبيهات Slack/Teams","تقرير HR تنفيذي","دعم أولوية + SLA"]
        : ["Up to 100 employees","FaceMesh 478 landmarks","3D head pose","Slack/Teams alerts","Executive HR reports","Priority support + SLA"],
    },
    {
      id:"b2b_enterprise", name: ar?"إنتربرايز":"Enterprise",
      priceUSD:{ monthly:null, yearly:null, startingAt:499 }, priceEGP:{ monthly:null, yearly:null },
      isEnterprise:true, color:LPV7_TOKENS.green,
      features: ar
        ? ["موظفون غير محدودون","AI clinical narrative","SAML SSO / Azure AD","White-label","SLA مخصص","مدير نجاح مخصص"]
        : ["Unlimited employees","AI clinical narrative","SAML SSO / Azure AD","White-label","Custom SLA","Dedicated success manager"],
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
                <button key={b} onClick={() => setBilling(b)} style={{
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

        <Stagger key={`${localMode}-${billing}`} className="lp-pricing-grid" style={{ alignItems:"start" }}>
          {plans.map((p) => (
            <StaggerItem key={p.id}>
              <div className={p.popular ? "lp-lift lp-glow" : "lp-lift"} style={{
                ...card(p.popular),
                border: p.popular ? `1px solid rgba(79,124,249,.45)` : `1px solid ${LPV7_TOKENS.border}`,
                position:"relative", height:"100%", display:"flex", flexDirection:"column",
                padding:"clamp(28px,2.6vw,36px)",
                transform: p.popular ? "scale(1.035)" : "none",
              }} className={p.popular ? "lp-lift lp-popular-card" : "lp-lift"}>
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
                    marginBottom:10, textTransform:"uppercase", letterSpacing:".06em" }}>
                    {p.name}
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
                            <span style={{ fontSize:14.5, color:LPV7_TOKENS.muted }}>{ar ? "ج.م./شهر" : "EGP/mo"}</span>
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
                            <span style={{ fontSize:14.5, color:LPV7_TOKENS.muted }}>/{ar ? "شهر" : "mo"}</span>
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
      </div>
      <style>{`
        @media(max-width:600px){.lp-pricing-grid{grid-template-columns:1fr!important}
        .lp-pricing-grid > div > div{transform:none!important}}`}</style>
    </section>
  );
}

// ── Testimonials ──────────────────────────────────────────────────
function StandalonePage({ lang, setLang, onCTA, title, children }) {
  const T = LPV7_TOKENS;
  return (
    <>
      <style>{LP_GLOBAL_CSS}</style>
      <div style={{ background:T.bg, minHeight:"100vh", color:T.text, fontFamily:FONT_DISPLAY }}>
        <Nav lang={lang} setLang={setLang} onCTA={onCTA}/>
        <div style={{ paddingTop:80 }}>
          {children}
        </div>
        <Footer lang={lang}/>
      </div>
    </>
  );
}

export default function PricingPageStandalone() {
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem("lp_lang") || "en"; } catch { return "en"; }
  });
  const onCTA = () => window.location.href = "/auth#signup";
  return (
    <StandalonePage lang={lang} setLang={setLang} onCTA={onCTA}>
      <Pricing lang={lang} onCTA={onCTA} isEgypt={false} setCurrencyOverride={()=>{}}/>
    </StandalonePage>
  );
}
