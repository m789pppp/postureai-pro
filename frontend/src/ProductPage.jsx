import React, { useState, useEffect, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { PageShell } from "./StandaloneLayout.jsx";

const T = {
  bg:"#030b14", bg1:"#040d18", card:"#0d1f33",
  border:"rgba(148,163,184,.08)", borderHi:"rgba(79,124,249,.25)",
  text:"#e8f0ff", sub:"#94a3b8", muted:"#475569",
  blue:"#4f7cf9", indigo:"#818cf8", sky:"#22d3ee", green:"#10d9a0",
  gBlue:"linear-gradient(135deg,#4f7cf9,#22d3ee)",
  gHero:"linear-gradient(130deg,#818cf8 0%,#22d3ee 45%,#10d9a0 100%)",
};
const FD = "'IBM Plex Sans Arabic','Segoe UI',system-ui,sans-serif";
const FM = "'IBM Plex Mono','Segoe UI',monospace";

function Reveal({ children, delay=0, y=24 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once:true, margin:"-60px" });
  return (
    <motion.div ref={ref}
      initial={{ opacity:0, y }}
      animate={inView ? { opacity:1, y:0 } : {}}
      transition={{ duration:.55, delay, ease:[0.22,1,0.36,1] }}>
      {children}
    </motion.div>
  );
}

const FEATURES = [
  {
    icon:"🎯", color:"#4f7cf9",
    title:"Precision AI Posture Analysis",
    badge:"Core Engine",
    desc:"478-landmark MediaPipe tracking delivers ~96% accuracy — comparable to clinical-grade ergonomic assessments.",
    specs:[
      ["Landmarks tracked","478 face + body points"],
      ["Head pose accuracy","~96% vs clinical baseline"],
      ["Latency","< 40ms real-time"],
      ["Camera required","Any webcam — no hardware"],
    ],
    bullets:["Forward head posture detection (Hansraj 2014 formula)","Shoulder asymmetry & neck tilt analysis","OSHA-compliant elbow angle monitoring","Fatigue curve scoring (Richter 2011)"],
  },
  {
    icon:"📊", color:"#22d3ee",
    title:"Smart HR Dashboard",
    badge:"For HR Admins",
    desc:"Real-time workforce health visibility. From individual risk flags to department-level trends — all in one view.",
    specs:[
      ["Data refresh","Real-time"],
      ["Export formats","PDF, Excel, CSV"],
      ["Departments","Unlimited"],
      ["Historical data","90 days rolling"],
    ],
    bullets:["Live posture scores per employee","Risk heatmaps by department","Weekly auto-generated PDF reports","Custom alert thresholds"],
  },
  {
    icon:"🤖", color:"#10d9a0",
    title:"AI Coach — Powered by Groq",
    badge:"AI Layer",
    desc:"Every employee gets a personal AI physiotherapy coach. Evidence-based recommendations, delivered in seconds.",
    specs:[
      ["Model","Llama 3.1 8B (Groq)"],
      ["Response time","< 2 seconds"],
      ["Languages","Arabic + English"],
      ["Fallback","48-intent local AI"],
    ],
    bullets:["Session-aware therapeutic advice","Scientific citation support","Personalized stretch programs","Progressive overload tracking"],
  },
  {
    icon:"🔗", color:"#818cf8",
    title:"Enterprise Integrations",
    badge:"For IT Teams",
    desc:"Plug into your existing stack in minutes. REST API + webhooks + native connectors for major HR platforms.",
    specs:[
      ["API","REST + Webhooks"],
      ["SSO","SAML 2.0 + OAuth"],
      ["HR Systems","SAP, Workday, BambooHR"],
      ["Messaging","Slack, MS Teams"],
    ],
    bullets:["Auto-provision users from HR system","Real-time Slack/Teams risk alerts","Jira ticket creation for ergonomic issues","Full audit log via webhooks"],
  },
  {
    icon:"🛡️", color:"#f59e0b",
    title:"Enterprise Security",
    badge:"Compliance",
    desc:"Built for organizations that take data seriously. On-device AI means video never leaves the employee's machine.",
    specs:[
      ["Encryption","AES-256 at rest + TLS 1.3"],
      ["Auth","MFA + SAML SSO + RBAC"],
      ["Video storage","None — on-device only"],
      ["Compliance","ISO 27001 aligned, GDPR ready"],
    ],
    bullets:["Zero video transmitted or stored","Role-based access (4 tiers)","Comprehensive audit trails","Data residency controls"],
  },
];

function FeatureBlock({ feature, index }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once:true, margin:"-80px" });
  const isEven = index % 2 === 0;

  return (
    <motion.div ref={ref}
      initial={{ opacity:0, y:32 }}
      animate={inView ? { opacity:1, y:0 } : {}}
      transition={{ duration:.6, delay:.1, ease:[0.22,1,0.36,1] }}
      style={{
        display:"grid", gridTemplateColumns:"1fr 1fr", gap:64,
        alignItems:"center", padding:"72px 0",
        borderTop:"1px solid rgba(148,163,184,.06)",
        direction: isEven ? "ltr" : "rtl",
      }}>

      {/* Text side */}
      <div style={{ direction:"ltr" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
          <div style={{
            padding:"4px 12px", borderRadius:99, fontSize:11, fontWeight:700,
            letterSpacing:".08em", textTransform:"uppercase",
            background:`${feature.color}14`, border:`1px solid ${feature.color}30`,
            color:feature.color, fontFamily:FM,
          }}>{feature.badge}</div>
        </div>

        <h2 style={{
          fontSize:"clamp(26px,2.4vw,36px)", fontWeight:800, color:T.text,
          margin:"0 0 16px", letterSpacing:"-.025em", lineHeight:1.15, fontFamily:FD,
        }}>{feature.title}</h2>

        <p style={{ fontSize:17, color:T.sub, lineHeight:1.75, margin:"0 0 28px" }}>
          {feature.desc}
        </p>

        <ul style={{ listStyle:"none", padding:0, margin:"0 0 32px", display:"flex", flexDirection:"column", gap:10 }}>
          {feature.bullets.map(b => (
            <li key={b} style={{ display:"flex", alignItems:"flex-start", gap:10, fontSize:14.5, color:T.sub, lineHeight:1.5 }}>
              <span style={{ color:feature.color, fontSize:16, flexShrink:0, marginTop:1 }}>✓</span>
              {b}
            </li>
          ))}
        </ul>

        <a href="/auth?mode=signup" style={{
          display:"inline-flex", alignItems:"center", gap:8,
          padding:"11px 22px", borderRadius:10, fontSize:14, fontWeight:600,
          background:`${feature.color}12`, border:`1px solid ${feature.color}30`,
          color:feature.color, textDecoration:"none", transition:"all .2s",
        }}
        onMouseEnter={e=>{e.currentTarget.style.background=`${feature.color}22`;e.currentTarget.style.borderColor=`${feature.color}55`}}
        onMouseLeave={e=>{e.currentTarget.style.background=`${feature.color}12`;e.currentTarget.style.borderColor=`${feature.color}30`}}>
          Start free trial →
        </a>
      </div>

      {/* Specs card */}
      <div style={{ direction:"ltr" }}>
        <div style={{
          background:T.card, border:`1px solid ${feature.color}20`,
          borderRadius:20, overflow:"hidden",
          boxShadow:`0 0 60px ${feature.color}08, 0 8px 32px rgba(0,0,0,.3)`,
        }}>
          {/* Card header */}
          <div style={{
            padding:"24px 28px",
            background:`linear-gradient(135deg,${feature.color}10,transparent)`,
            borderBottom:`1px solid ${feature.color}14`,
            display:"flex", alignItems:"center", gap:14,
          }}>
            <div style={{
              width:52, height:52, borderRadius:14, fontSize:24,
              display:"flex", alignItems:"center", justifyContent:"center",
              background:`${feature.color}14`, border:`1px solid ${feature.color}25`,
            }}>{feature.icon}</div>
            <div>
              <div style={{ fontSize:13, color:feature.color, fontWeight:700, fontFamily:FM, marginBottom:3 }}>
                Technical Specs
              </div>
              <div style={{ fontSize:15, color:T.text, fontWeight:600 }}>{feature.title}</div>
            </div>
          </div>
          {/* Specs table */}
          <div style={{ padding:"8px 0" }}>
            {feature.specs.map(([label, val], i) => (
              <div key={label} style={{
                display:"flex", alignItems:"center", justifyContent:"space-between",
                padding:"14px 28px",
                borderBottom: i < feature.specs.length-1 ? "1px solid rgba(148,163,184,.05)" : "none",
              }}>
                <span style={{ fontSize:13, color:T.muted, fontWeight:500 }}>{label}</span>
                <span style={{ fontSize:13.5, color:T.text, fontWeight:600, fontFamily:FM,
                  background:`${feature.color}0a`, padding:"3px 10px", borderRadius:6,
                  border:`1px solid ${feature.color}18` }}>
                  {val}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function ProductPage() {
  const [lang, setLang] = useState(() => { try { return localStorage.getItem("lp_lang")||"en"; } catch { return "en"; } });

  return (
    <PageShell lang={lang} setLang={setLang} activePage="features">
      <style>{`
        body{background:#030b14}
        .prod-wrap{max-width:1100px;margin:0 auto;padding:0 32px}
        @media(max-width:900px){
          .prod-feature-grid{grid-template-columns:1fr!important;direction:ltr!important;gap:32px!important;padding:48px 0!important}
          .prod-wrap{padding:0 20px}
        }
        @media(max-width:600px){.prod-wrap{padding:0 16px}}
      `}</style>

      {/* ── Hero ── */}
      <div style={{ padding:"96px 0 72px", textAlign:"center", position:"relative", overflow:"hidden" }}>
        {/* Ambient */}
        <div style={{ position:"absolute", inset:0, pointerEvents:"none",
          background:"radial-gradient(ellipse 80% 50% at 50% -10%,rgba(79,124,249,.12),transparent)" }}/>
        <div className="prod-wrap" style={{ position:"relative" }}>
          <Reveal>
            <div style={{ display:"inline-flex", alignItems:"center", gap:8, marginBottom:24,
              padding:"6px 16px", borderRadius:99,
              background:"rgba(79,124,249,.08)", border:"1px solid rgba(79,124,249,.2)" }}>
              <span style={{ width:6, height:6, borderRadius:"50%", background:T.blue, display:"inline-block" }}/>
              <span style={{ fontSize:12, fontWeight:700, letterSpacing:".08em", textTransform:"uppercase", color:T.blue, fontFamily:FM }}>
                Platform
              </span>
            </div>
          </Reveal>
          <Reveal delay={.08}>
            <h1 style={{
              fontSize:"clamp(40px,5vw,68px)", fontWeight:800, color:T.text,
              margin:"0 0 20px", letterSpacing:"-.03em", lineHeight:1.06, fontFamily:FD,
            }}>
              Built for how teams{" "}
              <span style={{ background:T.gHero, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
                actually work
              </span>
            </h1>
          </Reveal>
          <Reveal delay={.14}>
            <p style={{ fontSize:19, color:T.sub, maxWidth:580, margin:"0 auto 40px", lineHeight:1.7 }}>
              Five integrated layers — AI analysis, HR intelligence, coaching, integrations,
              and security — working together in real time.
            </p>
          </Reveal>
          <Reveal delay={.2}>
            <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" }}>
              <a href="/auth?mode=signup" style={{
                display:"inline-flex", alignItems:"center", gap:8,
                padding:"13px 28px", borderRadius:12, fontSize:15.5, fontWeight:700,
                background:"linear-gradient(135deg,#1a56db,#0891b2)", color:"#fff",
                textDecoration:"none", boxShadow:"0 4px 20px rgba(26,86,219,.4)",
                transition:"opacity .2s, transform .2s",
              }}
              onMouseEnter={e=>{e.currentTarget.style.opacity=".88";e.currentTarget.style.transform="translateY(-1px)"}}
              onMouseLeave={e=>{e.currentTarget.style.opacity="1";e.currentTarget.style.transform="none"}}>
                Start Free Trial
              </a>
              <a href="/#casestudies" style={{
                display:"inline-flex", alignItems:"center", gap:8,
                padding:"13px 28px", borderRadius:12, fontSize:15.5, fontWeight:600,
                background:"rgba(255,255,255,.05)", color:T.sub,
                border:"1px solid rgba(255,255,255,.1)", textDecoration:"none",
                transition:"all .2s",
              }}
              onMouseEnter={e=>{e.currentTarget.style.color=T.text;e.currentTarget.style.borderColor="rgba(255,255,255,.2)"}}
              onMouseLeave={e=>{e.currentTarget.style.color=T.sub;e.currentTarget.style.borderColor="rgba(255,255,255,.1)"}}>
                See case studies →
              </a>
            </div>
          </Reveal>
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div style={{ borderTop:"1px solid rgba(148,163,184,.06)", borderBottom:"1px solid rgba(148,163,184,.06)", background:T.bg1 }}>
        <div className="prod-wrap">
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:0 }}>
            {[["478","Landmarks tracked"],["< 40ms","Analysis latency"],["96%","Accuracy rate"],["0","Video stored"]].map(([val,label],i)=>(
              <div key={label} style={{
                padding:"28px 0", textAlign:"center",
                borderRight: i<3 ? "1px solid rgba(148,163,184,.06)" : "none",
              }}>
                <div style={{ fontSize:28, fontWeight:800, color:T.text, fontFamily:FM, letterSpacing:"-.02em", marginBottom:4 }}>{val}</div>
                <div style={{ fontSize:12.5, color:T.muted, fontWeight:500 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Feature blocks ── */}
      <div className="prod-wrap" style={{ paddingBottom:96 }}>
        {FEATURES.map((feature, i) => (
          <div key={feature.title} className="prod-feature-grid"
            style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:64,
              alignItems:"center", padding:"72px 0",
              borderTop:"1px solid rgba(148,163,184,.06)",
              direction: i%2===0 ? "ltr" : "rtl",
            }}>
            <FeatureBlock feature={feature} index={i}/>
          </div>
        ))}
      </div>

      {/* ── Bottom CTA ── */}
      <div style={{ background:T.bg1, borderTop:"1px solid rgba(148,163,184,.06)", padding:"80px 0", textAlign:"center" }}>
        <div className="prod-wrap">
          <Reveal>
            <h2 style={{ fontSize:"clamp(28px,3vw,44px)", fontWeight:800, color:T.text, margin:"0 0 16px", fontFamily:FD }}>
              Ready to see it in action?
            </h2>
            <p style={{ fontSize:17, color:T.sub, margin:"0 auto 36px", maxWidth:480, lineHeight:1.7 }}>
              Set up takes 15 minutes. No hardware. No installation. Just open your browser.
            </p>
            <a href="/auth?mode=signup" style={{
              display:"inline-flex", alignItems:"center", gap:8,
              padding:"14px 32px", borderRadius:12, fontSize:16, fontWeight:700,
              background:"linear-gradient(135deg,#1a56db,#0891b2)", color:"#fff",
              textDecoration:"none", boxShadow:"0 4px 20px rgba(26,86,219,.4)",
            }}>
              Start Free Trial — No credit card required
            </a>
          </Reveal>
        </div>
      </div>
    </PageShell>
  );
}
