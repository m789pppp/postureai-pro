import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageShell } from "./StandaloneLayout.jsx";

const T = {
  bg:"#030b14", bg1:"#040d18", card:"#0d1f33",
  border:"rgba(148,163,184,.08)",
  text:"#e8f0ff", sub:"#94a3b8", muted:"#475569",
  blue:"#4f7cf9", indigo:"#818cf8", sky:"#22d3ee", green:"#10d9a0",
  gHero:"linear-gradient(130deg,#818cf8 0%,#22d3ee 45%,#10d9a0 100%)",
};
const FD = "'IBM Plex Sans Arabic','Segoe UI',system-ui,sans-serif";
const FM = "'IBM Plex Mono','Segoe UI',monospace";

function Reveal({ children, delay=0 }) {
  const ref = useRef(null);
  const inView = React.useInView ? React.useInView(ref, { once:true }) : true;
  return <div ref={ref}>{children}</div>;
}

const CATEGORIES = [
  {
    id:"general", label:"General", icon:"💬", color:"#4f7cf9",
    faqs:[
      ["What is Corvus PostureAI?","Corvus is an AI-powered workplace posture monitoring platform. It uses your webcam to analyse body posture in real time — no special hardware needed. It's designed for HR teams and individual employees who want to reduce musculoskeletal risk and improve workplace health."],
      ["Who is Corvus for?","Corvus has two audiences: HR admins who manage teams of 10–5,000+ employees and want company-wide ergonomic visibility; and individuals who want to monitor and improve their own posture independently."],
      ["Is it available in Arabic?","Yes. Corvus is fully bilingual — Arabic and English. The AI coach, dashboard, reports, and all UI elements switch language instantly. Arabic is the primary language for MENA markets."],
      ["Which countries is Corvus available in?","Corvus is available globally. Pricing is displayed in EGP for Egypt and USD for all other markets. We're currently focused on Egypt, Saudi Arabia, and UAE."],
    ],
  },
  {
    id:"privacy", label:"Privacy & Security", icon:"🔒", color:"#10d9a0",
    faqs:[
      ["Does Corvus record or store video?","No. This is a core design principle. All video processing happens on the employee's device using on-device AI (MediaPipe). Only numerical posture scores are transmitted — no video, no images, ever."],
      ["Is employee data private from managers?","Yes. Individual scores are visible to the employee and HR admins. Managers see aggregated team data only, not individual sessions. Employees can also pause tracking at any time."],
      ["What data is stored?","Corvus stores posture scores, session timestamps, AI coaching conversations, and HR reports. All data is encrypted with AES-256 at rest and TLS 1.3 in transit."],
      ["Is Corvus GDPR compliant?","Corvus is built with GDPR principles — data minimisation, purpose limitation, and user rights (access, deletion, export). We are ISO 27001 aligned. Enterprise customers can request a Data Processing Agreement."],
      ["Can employees delete their data?","Yes. Employees can request full data deletion from their profile settings. HR admins can also delete individual employee records from the dashboard."],
    ],
  },
  {
    id:"technical", label:"Technical", icon:"⚙️", color:"#818cf8",
    faqs:[
      ["What camera do I need?","Any webcam works — including built-in laptop cameras. Minimum 720p is recommended for best accuracy. Corvus adapts its confidence scoring based on video quality."],
      ["Does it work on all browsers?","Corvus works on Chrome, Edge, and Firefox (desktop). Safari has limited WebRTC support. Mobile browsers are not currently supported for posture sessions, though the dashboard and reports are fully mobile-responsive."],
      ["What are the system requirements?","A modern browser, a webcam, and a stable internet connection. No installation, no plugins, no app download. The AI runs entirely in-browser via WebAssembly."],
      ["How accurate is the posture detection?","Corvus achieves ~96% accuracy against clinical ergonomic assessments for forward head posture and shoulder asymmetry. Accuracy decreases in poor lighting or when the camera is positioned at extreme angles."],
      ["Does it work with SSO / Active Directory?","Yes. Enterprise plans support SAML 2.0 and OAuth 2.0 for SSO. Auto-provisioning is supported for SAP SuccessFactors, Workday, and BambooHR. Contact us to set up your integration."],
    ],
  },
  {
    id:"pricing", label:"Pricing & Plans", icon:"💳", color:"#f59e0b",
    faqs:[
      ["Is there a free trial?","Yes. All plans include a 14-day free trial — no credit card required. You get full access to all features for your plan tier during the trial."],
      ["What's the difference between Individual and Company plans?","Individual plans are for single users. Company (HR) plans add the HR dashboard, team management, department reporting, bulk user import, weekly auto-reports, and API access."],
      ["Can I change plans later?","Yes. You can upgrade or downgrade at any time. Downgrades take effect at the end of your billing period. Upgrades are instant with pro-rated billing."],
      ["Do you offer discounts for NGOs or universities?","Yes. We offer 50% discounts for verified educational institutions and NGOs. Contact us with your organisation details to apply."],
      ["What payment methods are accepted?","We accept all major credit cards, Vodafone Cash, Fawry, and bank transfer for annual plans. Egyptian customers can pay in EGP via PayMob."],
    ],
  },
  {
    id:"hr", label:"For HR Teams", icon:"🏢", color:"#22d3ee",
    faqs:[
      ["How do I add employees?","Three ways: (1) Send individual invite links by email, (2) Upload a CSV with employee names and emails, (3) Auto-provision via SSO if your HR system is connected."],
      ["Can I set up departments and teams?","Yes. The HR dashboard supports unlimited department hierarchies. You can assign managers, set department-level alert thresholds, and compare performance across teams."],
      ["What reports does HR receive?","Weekly PDF reports with company-wide posture trends, department risk heatmaps, individual high-risk flags, and ROI calculations based on estimated sick leave reduction. Reports are auto-generated every Monday at 8am."],
      ["Can I set custom alert thresholds?","Yes. HR admins can set risk score thresholds per department. When an employee's score drops below the threshold for 3+ consecutive sessions, an automatic alert is sent to the HR admin and optionally to the employee's manager."],
      ["How does Corvus integrate with our HR system?","Via REST API and webhooks. Pre-built connectors exist for SAP, Workday, and BambooHR. Custom webhooks can push risk alerts to Slack, Microsoft Teams, or any endpoint you specify."],
    ],
  },
];

function FaqItem({ q, a, color, isOpen, onToggle }) {
  return (
    <div style={{ borderBottom:"1px solid rgba(148,163,184,.06)" }}>
      <button onClick={onToggle} style={{
        width:"100%", textAlign:"left", background:"none", border:"none",
        cursor:"pointer", padding:"20px 0", display:"flex",
        justifyContent:"space-between", alignItems:"center", gap:16,
        fontFamily:FD,
      }}>
        <span style={{ fontSize:15.5, fontWeight:600, color:T.text, lineHeight:1.5 }}>{q}</span>
        <motion.span animate={{ rotate: isOpen ? 45 : 0 }} transition={{ duration:.2 }}
          style={{ fontSize:22, color: isOpen ? color : T.muted, flexShrink:0, lineHeight:1 }}>+</motion.span>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ height:0, opacity:0 }} animate={{ height:"auto", opacity:1 }}
            exit={{ height:0, opacity:0 }} transition={{ duration:.25 }}
            style={{ overflow:"hidden" }}>
            <p style={{ fontSize:15, color:T.sub, lineHeight:1.8, margin:"0 0 20px", paddingRight:32 }}>{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FAQPage() {
  const [lang, setLang] = useState(() => { try { return localStorage.getItem("lp_lang")||"en"; } catch { return "en"; } });
  const [activeCategory, setActiveCategory] = useState("general");
  const [openItem, setOpenItem] = useState(0);
  const [search, setSearch] = useState("");

  const activeCat = CATEGORIES.find(c => c.id === activeCategory);

  const filtered = search.trim()
    ? CATEGORIES.flatMap(cat => cat.faqs.filter(([q, a]) =>
        q.toLowerCase().includes(search.toLowerCase()) ||
        a.toLowerCase().includes(search.toLowerCase())
      ).map(faq => ({ ...faq, color:cat.color, cat:cat.label })))
    : null;

  return (
    <PageShell lang={lang} setLang={setLang} activePage="faq">
      <style>{`
        body{background:#030b14}
        .faq-wrap{max-width:1000px;margin:0 auto;padding:0 32px}
        .faq-search:focus{outline:none;border-color:rgba(79,124,249,.5)!important;box-shadow:0 0 0 3px rgba(79,124,249,.1)}
        .faq-cat-btn{transition:all .18s;cursor:pointer;font-family:inherit;border:none}
        @media(max-width:860px){.faq-layout{grid-template-columns:1fr!important}.faq-wrap{padding:0 20px}}
        @media(max-width:600px){.faq-wrap{padding:0 16px}}
      `}</style>

      {/* ── Hero ── */}
      <div style={{ padding:"96px 0 64px", textAlign:"center", position:"relative" }}>
        <div style={{ position:"absolute", inset:0, pointerEvents:"none",
          background:"radial-gradient(ellipse 70% 50% at 50% -10%,rgba(34,211,238,.08),transparent)" }}/>
        <div className="faq-wrap" style={{ position:"relative" }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:8, marginBottom:24,
            padding:"6px 16px", borderRadius:99,
            background:"rgba(34,211,238,.08)", border:"1px solid rgba(34,211,238,.2)" }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:T.sky, display:"inline-block" }}/>
            <span style={{ fontSize:12, fontWeight:700, letterSpacing:".08em", textTransform:"uppercase", color:T.sky, fontFamily:FM }}>
              FAQ
            </span>
          </div>
          <h1 style={{ fontSize:"clamp(36px,5vw,60px)", fontWeight:800, color:T.text,
            margin:"0 0 18px", letterSpacing:"-.03em", lineHeight:1.08, fontFamily:FD }}>
            Got questions?{" "}
            <span style={{ background:T.gHero, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
              We have answers.
            </span>
          </h1>
          <p style={{ fontSize:17, color:T.sub, maxWidth:500, margin:"0 auto 36px", lineHeight:1.75 }}>
            Everything you need to know about Corvus — from privacy and pricing
            to technical specs and HR integrations.
          </p>

          {/* Search */}
          <div style={{ maxWidth:480, margin:"0 auto", position:"relative" }}>
            <span style={{ position:"absolute", left:16, top:"50%", transform:"translateY(-50%)",
              fontSize:16, color:T.muted, pointerEvents:"none" }}>🔍</span>
            <input className="faq-search" value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Search all questions..."
              style={{
                width:"100%", padding:"14px 16px 14px 44px",
                background:T.card, border:"1px solid rgba(148,163,184,.12)",
                borderRadius:12, fontSize:15, color:T.text,
                fontFamily:FD, transition:"border-color .2s, box-shadow .2s",
                boxSizing:"border-box",
              }}/>
          </div>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="faq-wrap" style={{ paddingBottom:96 }}>
        {search.trim() ? (
          // Search results
          <div>
            <div style={{ fontSize:13, color:T.muted, marginBottom:24 }}>
              {filtered.length} result{filtered.length!==1?"s":""} for "{search}"
            </div>
            {filtered.length === 0 ? (
              <div style={{ textAlign:"center", padding:"60px 0", color:T.muted }}>
                <div style={{ fontSize:40, marginBottom:16 }}>🤷</div>
                <p>No questions match "{search}".<br/>
                  Try a different keyword or <a href="mailto:m789pppp@gmail.com" style={{ color:T.blue }}>contact us directly</a>.
                </p>
              </div>
            ) : filtered.map(([q, a, color, cat], i) => (
              <FaqItem key={i} q={q} a={a} color={T.blue}
                isOpen={openItem===i} onToggle={()=>setOpenItem(openItem===i?null:i)}/>
            ))}
          </div>
        ) : (
          // Category layout
          <div className="faq-layout" style={{ display:"grid", gridTemplateColumns:"220px 1fr", gap:48 }}>

            {/* Sidebar */}
            <div>
              <div style={{ position:"sticky", top:88, display:"flex", flexDirection:"column", gap:4 }}>
                {CATEGORIES.map(cat => (
                  <button key={cat.id} className="faq-cat-btn"
                    onClick={()=>{ setActiveCategory(cat.id); setOpenItem(0); }}
                    style={{
                      display:"flex", alignItems:"center", gap:10,
                      padding:"11px 14px", borderRadius:10, textAlign:"left",
                      background: activeCategory===cat.id ? `${cat.color}10` : "transparent",
                      border: activeCategory===cat.id ? `1px solid ${cat.color}25` : "1px solid transparent",
                      color: activeCategory===cat.id ? T.text : T.muted,
                      fontSize:13.5, fontWeight: activeCategory===cat.id ? 600 : 500,
                    }}>
                    <span style={{ fontSize:16 }}>{cat.icon}</span>
                    {cat.label}
                    <span style={{ marginLeft:"auto", fontSize:11.5, color:T.muted,
                      background:"rgba(255,255,255,.05)", borderRadius:99, padding:"2px 7px" }}>
                      {cat.faqs.length}
                    </span>
                  </button>
                ))}

                <div style={{ marginTop:24, padding:"20px 16px", borderRadius:12,
                  background:T.bg1, border:"1px solid rgba(148,163,184,.07)" }}>
                  <div style={{ fontSize:13, fontWeight:600, color:T.text, marginBottom:8 }}>Still have questions?</div>
                  <p style={{ fontSize:12.5, color:T.muted, lineHeight:1.6, margin:"0 0 12px" }}>
                    Can't find what you're looking for? We respond within 24 hours.
                  </p>
                  <a href="mailto:m789pppp@gmail.com" style={{
                    display:"block", textAlign:"center", padding:"9px", borderRadius:8,
                    background:"linear-gradient(135deg,#1a56db,#0891b2)", color:"#fff",
                    textDecoration:"none", fontSize:13, fontWeight:600,
                  }}>Contact us →</a>
                </div>
              </div>
            </div>

            {/* Questions */}
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:28,
                paddingBottom:20, borderBottom:"1px solid rgba(148,163,184,.07)" }}>
                <div style={{ width:40, height:40, borderRadius:10, fontSize:20,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  background:`${activeCat.color}12`, border:`1px solid ${activeCat.color}25` }}>
                  {activeCat.icon}
                </div>
                <div>
                  <div style={{ fontSize:18, fontWeight:700, color:T.text, fontFamily:FD }}>{activeCat.label}</div>
                  <div style={{ fontSize:12.5, color:T.muted }}>{activeCat.faqs.length} questions</div>
                </div>
              </div>

              <AnimatePresence mode="wait">
                <motion.div key={activeCategory}
                  initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
                  exit={{ opacity:0 }} transition={{ duration:.25 }}>
                  {activeCat.faqs.map(([q, a], i) => (
                    <FaqItem key={q} q={q} a={a} color={activeCat.color}
                      isOpen={openItem===i} onToggle={()=>setOpenItem(openItem===i?null:i)}/>
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom CTA ── */}
      <div style={{ background:T.bg1, borderTop:"1px solid rgba(148,163,184,.06)", padding:"72px 0", textAlign:"center" }}>
        <div className="faq-wrap">
          <h2 style={{ fontSize:"clamp(24px,3vw,38px)", fontWeight:800, color:T.text,
            margin:"0 0 14px", fontFamily:FD }}>Ready to get started?</h2>
          <p style={{ fontSize:16, color:T.sub, margin:"0 auto 32px", maxWidth:400, lineHeight:1.7 }}>
            14-day free trial. No credit card. Cancel anytime.
          </p>
          <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" }}>
            <a href="/auth?mode=signup" style={{
              padding:"13px 28px", borderRadius:12, fontSize:15, fontWeight:700,
              background:"linear-gradient(135deg,#1a56db,#0891b2)", color:"#fff",
              textDecoration:"none", boxShadow:"0 4px 20px rgba(26,86,219,.35)",
              display:"inline-flex", alignItems:"center",
            }}>Start Free Trial</a>
            <a href="/pricing" style={{
              padding:"13px 28px", borderRadius:12, fontSize:15, fontWeight:600,
              background:"rgba(255,255,255,.05)", color:T.sub,
              border:"1px solid rgba(255,255,255,.1)", textDecoration:"none",
              display:"inline-flex", alignItems:"center",
            }}>See Pricing</a>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
