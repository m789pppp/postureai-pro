import React, { useState, useEffect, useRef } from "react";
import { motion, useInView } from "framer-motion";
import {
  LPV7_TOKENS, FONT_DISPLAY, FONT_MONO, TYPE, card, CALENDLY_URL,
  Reveal, Stagger, StaggerItem, AnimNum, SectionHead, LP_GLOBAL_CSS
} from "./lpShared.jsx";


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
                <a key={id} href={href}
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

        <Stagger key={String(ar)} className="lp-cases-grid">
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
function Testimonials({ lang }) {
  const ar = lang === "ar";
  const testimonials = ar ? [
    { name:"سارة محمود", initials:"سم", role:"مهندسة برمجيات أولى", company:"Vodafone مصر", text:"كنت بعاني من آلام رقبة كل يوم بعد 8 ساعات شغل. بعد أسبوعين من Corvus، الألم راح تقريباً. أوضح ROI على أداة اشتريتها.", score:"5/5", outcome:"آلام الرقبة انتهت في أسبوعين", color:"#818cf8" },
    { name:"أحمد كريم", initials:"أك", role:"مدير موارد بشرية", company:"Orange Business", text:"جربنا 3 أدوات قبل Corvus. دي الأولى اللي الفريق بيستخدمها فعلاً. الـ AI coach بيعمل فرق حقيقي ومش مجرد رقم على شاشة.", score:"4.9/5", outcome:"أعلى adoption rate من 3 أدوات", color:"#22d3ee" },
    { name:"ياسمين حسن", initials:"يح", role:"مديرة تقنية", company:"Fawry", text:"الإعداد خلص في 20 دقيقة. الدقة في تتبع وضعية الرقبة أعلى من أي أداة جربتها. التقارير الأسبوعية مفيدة للتتبع.", score:"4.8/5", outcome:"إعداد كامل في 20 دقيقة", color:"#10d9a0" },
  ] : [
    { name:"Sara Mahmoud", initials:"SM", role:"Senior Software Engineer", company:"Vodafone Egypt", text:"I had neck pain daily after 8-hour work sessions. Two weeks with Corvus and it's nearly gone. Clearest ROI of any tool I've bought.", score:"5/5", outcome:"Neck pain gone in 2 weeks", color:"#818cf8" },
    { name:"Ahmed Karim", initials:"AK", role:"HR Director", company:"Orange Business", text:"We tried 3 tools before Corvus. This is the first one the team actually uses. The AI coach makes a real difference — not just a number on a screen.", score:"4.9/5", outcome:"Highest adoption of 3 tools tested", color:"#22d3ee" },
    { name:"Yasmine Hassan", initials:"YH", role:"Chief Technology Officer", company:"Fawry", text:"Setup took 20 minutes. Neck posture tracking accuracy is higher than any tool I've tested. Weekly reports are genuinely useful for tracking progress.", score:"4.8/5", outcome:"Full team setup in 20 min", color:"#10d9a0" },
  ];

  return (
    <section id="testimonials" className="lp-section">
      <div className="lp-wrap">
        <SectionHead
          eyebrow={ar ? "آراء العملاء" : "Real results"}
          title={ar ? "ماذا يقول عملاؤنا" : "What our customers say"}
          sub={ar ? "نتائج حقيقية من مستخدمين حقيقيين في مصر والخليج" : "Real results from real users across Egypt and the Gulf"}
        />
        <Stagger key={String(ar)} className="lp-testi-grid">
          {testimonials.map((t) => (
            <StaggerItem key={t.name}>
              <div className="lp-lift" style={{
                height:"100%", borderRadius:20, padding:28, position:"relative",
                background:"rgba(255,255,255,.035)", border:`1px solid ${LPV7_TOKENS.border}`,
                backdropFilter:"blur(16px)", display:"flex", flexDirection:"column",
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
                  <span style={{ color:LPV7_TOKENS.muted, fontSize:11.5, marginLeft:8, fontFamily:FONT_MONO }}>{t.score}</span>
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

export default function SolutionsPage() {
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem("lp_lang") || "en"; } catch { return "en"; }
  });
  const onCTA = () => window.location.href = "/auth#signup";
  return (
    <StandalonePage lang={lang} setLang={setLang} onCTA={onCTA}>
      <CaseStudies lang={lang}/>
      <Testimonials lang={lang}/>
    </StandalonePage>
  );
}
