import React, { useState, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { PageShell } from "./StandaloneLayout.jsx";

const T = {
  bg:"#030b14", bg1:"#040d18", card:"#0d1f33",
  border:"rgba(148,163,184,.08)",
  text:"#e8f0ff", sub:"#94a3b8", muted:"#475569",
  blue:"#4f7cf9", indigo:"#818cf8", sky:"#22d3ee", green:"#10d9a0",
  amber:"#f59e0b",
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
    desc:"478-landmark MediaPipe tracking delivers ~96% accuracy — comparable to clinical-grade ergonomic assessments. Runs entirely in-browser, no video ever leaves the device.",
    specs:[["Landmarks tracked","478 points"],["Head pose accuracy","~96%"],["Latency","< 40ms"],["Camera required","Any webcam"]],
    bullets:["Forward head posture detection (Hansraj 2014)","Shoulder asymmetry & neck tilt","OSHA-compliant elbow angle monitoring","Fatigue curve scoring (Richter 2011)"],
  },
  {
    icon:"📊", color:"#22d3ee",
    title:"Smart HR Dashboard",
    badge:"For HR Admins",
    desc:"Real-time workforce health visibility across every department. From individual risk flags to company-wide trends — all in one view with weekly auto-reports.",
    specs:[["Data refresh","Real-time"],["Export formats","PDF, Excel, CSV"],["Departments","Unlimited"],["History","90 days rolling"]],
    bullets:["Live posture scores per employee","Risk heatmaps by department","Weekly auto-generated PDF reports","Custom alert thresholds per team"],
  },
  {
    icon:"🤖", color:"#10d9a0",
    title:"AI Coach — Powered by Groq",
    badge:"AI Layer",
    desc:"Every employee gets a personal AI physiotherapy coach. Evidence-based recommendations backed by scientific citations, delivered in under 2 seconds.",
    specs:[["Model","Llama 3.1 8B"],["Response time","< 2 sec"],["Languages","AR + EN"],["Fallback","48-intent local AI"]],
    bullets:["Session-aware therapeutic advice","Scientific citation support","Personalised stretch programs","Progressive overload tracking"],
  },
  {
    icon:"🔗", color:"#818cf8",
    title:"Enterprise Integrations",
    badge:"For IT Teams",
    desc:"Plug into your existing stack in minutes. REST API, webhooks, and native connectors for SAP, Workday, Slack, and Microsoft Teams.",
    specs:[["API","REST + Webhooks"],["SSO","SAML 2.0 + OAuth"],["HR Systems","SAP, Workday"],["Messaging","Slack, MS Teams"]],
    bullets:["Auto-provision users from HR system","Real-time Slack/Teams risk alerts","Jira ticket creation for ergonomic issues","Full audit log via webhooks"],
  },
  {
    icon:"🛡️", color:"#f59e0b",
    title:"Enterprise Security",
    badge:"Compliance",
    desc:"On-device AI means video never leaves the employee's machine. AES-256 encryption, SAML SSO, 4-tier RBAC, and full audit trails.",
    specs:[["Encryption","AES-256 + TLS 1.3"],["Auth","MFA + SAML + RBAC"],["Video storage","None — on-device"],["Compliance","ISO 27001 aligned"]],
    bullets:["Zero video transmitted or stored","Role-based access (4 tiers)","Comprehensive audit trails","Data residency controls"],
  },
];

export default function ProductPage() {
  const [lang, setLang] = useState(() => { try { return localStorage.getItem("lp_lang")||"en"; } catch { return "en"; } });

  return (
    <PageShell lang={lang} setLang={setLang} activePage="features">
      <style>{`
        body { background:#030b14; }
        .pp-wrap { max-width:1120px; margin:0 auto; padding:0 40px; }
        .pp-feature { display:grid; grid-template-columns:1fr 1fr; gap:80px; align-items:center; padding:80px 0; border-top:1px solid rgba(148,163,184,.06); }
        .pp-feature.flip .pp-text { order:2; }
        .pp-feature.flip .pp-card { order:1; }
        .pp-stats-bar { display:grid; grid-template-columns:repeat(4,1fr); }
        @media(max-width:960px){
          .pp-feature { grid-template-columns:1fr !important; gap:40px !important; padding:56px 0 !important; }
          .pp-feature.flip .pp-text { order:0 !important; }
          .pp-feature.flip .pp-card { order:1 !important; }
          .pp-wrap { padding:0 24px; }
          .pp-stats-bar { grid-template-columns:repeat(2,1fr); }
        }
        @media(max-width:600px){
          .pp-wrap { padding:0 16px; }
          .pp-stats-bar { grid-template-columns:1fr 1fr; }
        }
      `}</style>

      {/* ── Hero ── */}
      <div style={{ padding:"100px 0 72px", textAlign:"center", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0, pointerEvents:"none",
          background:"radial-gradient(ellipse 80% 50% at 50% -10%,rgba(79,124,249,.13),transparent)" }}/>
        <div className="pp-wrap" style={{ position:"relative" }}>
          <Reveal>
            <div style={{ display:"inline-flex", alignItems:"center", gap:8, marginBottom:24,
              padding:"6px 18px", borderRadius:99,
              background:"rgba(79,124,249,.08)", border:"1px solid rgba(79,124,249,.2)" }}>
              <span style={{ width:6, height:6, borderRadius:"50%", background:T.blue, display:"inline-block" }}/>
              <span style={{ fontSize:12, fontWeight:700, letterSpacing:".1em", textTransform:"uppercase", color:T.blue, fontFamily:FM }}>Platform</span>
            </div>
          </Reveal>
          <Reveal delay={.08}>
            <h1 style={{ fontSize:"clamp(42px,5.5vw,72px)", fontWeight:800, color:T.text,
              margin:"0 0 22px", letterSpacing:"-.035em", lineHeight:1.05, fontFamily:FD }}>
              Built for how teams{" "}
              <span style={{ background:T.gHero, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
                actually work
              </span>
            </h1>
          </Reveal>
          <Reveal delay={.14}>
            <p style={{ fontSize:19, color:T.sub, maxWidth:600, margin:"0 auto 44px", lineHeight:1.75 }}>
              Five integrated layers — AI analysis, HR intelligence, coaching,
              integrations, and security — working together in real time.
            </p>
          </Reveal>
          <Reveal delay={.2}>
            <div style={{ display:"flex", gap:14, justifyContent:"center", flexWrap:"wrap" }}>
              <a href="/auth?mode=signup" style={{
                display:"inline-flex", alignItems:"center", gap:8, padding:"14px 30px",
                borderRadius:12, fontSize:16, fontWeight:700,
                background:"linear-gradient(135deg,#1a56db,#0891b2)", color:"#fff",
                textDecoration:"none", boxShadow:"0 4px 24px rgba(26,86,219,.4)",
                transition:"all .2s",
              }}
              onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 8px 32px rgba(26,86,219,.5)"}}
              onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="0 4px 24px rgba(26,86,219,.4)"}}>
                Start Free Trial
              </a>
              <a href="/#casestudies" style={{
                display:"inline-flex", alignItems:"center", gap:8, padding:"14px 30px",
                borderRadius:12, fontSize:16, fontWeight:600,
                background:"rgba(255,255,255,.05)", color:T.sub,
                border:"1px solid rgba(255,255,255,.1)", textDecoration:"none", transition:"all .2s",
              }}
              onMouseEnter={e=>{e.currentTarget.style.color=T.text;e.currentTarget.style.borderColor="rgba(255,255,255,.22)"}}
              onMouseLeave={e=>{e.currentTarget.style.color=T.sub;e.currentTarget.style.borderColor="rgba(255,255,255,.1)"}}>
                See results →
              </a>
            </div>
          </Reveal>
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div style={{ background:T.bg1, borderTop:"1px solid rgba(148,163,184,.06)", borderBottom:"1px solid rgba(148,163,184,.06)" }}>
        <div className="pp-wrap">
          <div className="pp-stats-bar">
            {[["478","Landmarks tracked"],["< 40ms","Analysis latency"],["~96%","Accuracy rate"],["0 bytes","Video stored"]].map(([val,label],i,arr)=>(
              <div key={label} style={{
                padding:"28px 0", textAlign:"center",
                borderRight: i<arr.length-1 ? "1px solid rgba(148,163,184,.06)" : "none",
              }}>
                <div style={{ fontSize:30, fontWeight:800, color:T.text, fontFamily:FM, letterSpacing:"-.02em", marginBottom:5 }}>{val}</div>
                <div style={{ fontSize:13, color:T.muted, fontWeight:500 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Feature blocks ── */}
      <div className="pp-wrap" style={{ paddingBottom:100 }}>
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} delay={.05}>
            <div className={`pp-feature${i%2!==0?" flip":""}`}>

              {/* Text side */}
              <div className="pp-text">
                <div style={{ display:"inline-flex", alignItems:"center", marginBottom:18,
                  padding:"4px 14px", borderRadius:99, fontSize:11.5, fontWeight:700,
                  letterSpacing:".08em", textTransform:"uppercase",
                  background:`${f.color}12`, border:`1px solid ${f.color}28`, color:f.color, fontFamily:FM,
                }}>{f.badge}</div>

                <h2 style={{ fontSize:"clamp(26px,2.8vw,38px)", fontWeight:800, color:T.text,
                  margin:"0 0 18px", letterSpacing:"-.025em", lineHeight:1.15, fontFamily:FD }}>
                  {f.title}
                </h2>

                <p style={{ fontSize:16.5, color:T.sub, lineHeight:1.8, margin:"0 0 28px" }}>
                  {f.desc}
                </p>

                <ul style={{ listStyle:"none", padding:0, margin:"0 0 32px", display:"flex", flexDirection:"column", gap:11 }}>
                  {f.bullets.map(b => (
                    <li key={b} style={{ display:"flex", alignItems:"flex-start", gap:10, fontSize:14.5, color:T.sub, lineHeight:1.55 }}>
                      <span style={{ color:f.color, fontSize:15, flexShrink:0, marginTop:1, fontWeight:700 }}>✓</span>
                      {b}
                    </li>
                  ))}
                </ul>

                <a href="/auth?mode=signup" style={{
                  display:"inline-flex", alignItems:"center", gap:8,
                  padding:"11px 22px", borderRadius:10, fontSize:14, fontWeight:600,
                  background:`${f.color}10`, border:`1px solid ${f.color}28`,
                  color:f.color, textDecoration:"none", transition:"all .2s",
                }}
                onMouseEnter={e=>{e.currentTarget.style.background=`${f.color}1e`;e.currentTarget.style.borderColor=`${f.color}50`}}
                onMouseLeave={e=>{e.currentTarget.style.background=`${f.color}10`;e.currentTarget.style.borderColor=`${f.color}28`}}>
                  Start free trial →
                </a>
              </div>

              {/* Specs card */}
              <div className="pp-card">
                <div style={{
                  background:T.card,
                  border:`1px solid ${f.color}22`,
                  borderRadius:22,
                  overflow:"hidden",
                  boxShadow:`0 0 80px ${f.color}0a, 0 8px 40px rgba(0,0,0,.35)`,
                }}>
                  {/* Card header */}
                  <div style={{
                    padding:"24px 28px",
                    background:`linear-gradient(135deg,${f.color}0e,transparent 60%)`,
                    borderBottom:`1px solid ${f.color}12`,
                    display:"flex", alignItems:"center", gap:14,
                  }}>
                    <div style={{
                      width:52, height:52, borderRadius:14, fontSize:24,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      background:`${f.color}12`, border:`1px solid ${f.color}22`, flexShrink:0,
                    }}>{f.icon}</div>
                    <div>
                      <div style={{ fontSize:11.5, color:f.color, fontWeight:700, fontFamily:FM, marginBottom:4, textTransform:"uppercase", letterSpacing:".06em" }}>
                        Technical Specs
                      </div>
                      <div style={{ fontSize:15, color:T.text, fontWeight:700, lineHeight:1.3 }}>{f.title}</div>
                    </div>
                  </div>

                  {/* Specs rows */}
                  {f.specs.map(([label, val], idx) => (
                    <div key={label} style={{
                      display:"flex", alignItems:"center", justifyContent:"space-between",
                      padding:"16px 28px",
                      borderBottom: idx < f.specs.length-1 ? "1px solid rgba(148,163,184,.05)" : "none",
                    }}>
                      <span style={{ fontSize:13.5, color:T.muted }}>{label}</span>
                      <span style={{
                        fontSize:13.5, color:T.text, fontWeight:600, fontFamily:FM,
                        background:`${f.color}08`, padding:"4px 12px", borderRadius:7,
                        border:`1px solid ${f.color}15`,
                      }}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </Reveal>
        ))}
      </div>

      {/* ── Bottom CTA ── */}
      <div style={{ background:T.bg1, borderTop:"1px solid rgba(148,163,184,.06)", padding:"88px 0", textAlign:"center" }}>
        <div className="pp-wrap">
          <Reveal>
            <h2 style={{ fontSize:"clamp(28px,3.5vw,48px)", fontWeight:800, color:T.text,
              margin:"0 0 18px", fontFamily:FD, letterSpacing:"-.025em" }}>
              Ready to see it in action?
            </h2>
            <p style={{ fontSize:18, color:T.sub, margin:"0 auto 40px", maxWidth:500, lineHeight:1.75 }}>
              Setup takes 15 minutes. No hardware. No installation. Just open your browser.
            </p>
            <a href="/auth?mode=signup" style={{
              display:"inline-flex", alignItems:"center", gap:8,
              padding:"15px 36px", borderRadius:12, fontSize:16.5, fontWeight:700,
              background:"linear-gradient(135deg,#1a56db,#0891b2)", color:"#fff",
              textDecoration:"none", boxShadow:"0 4px 24px rgba(26,86,219,.4)",
              transition:"all .2s",
            }}
            onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 8px 32px rgba(26,86,219,.5)"}}
            onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="0 4px 24px rgba(26,86,219,.4)"}}>
              Start Free Trial — No credit card required
            </a>
          </Reveal>
        </div>
      </div>
    </PageShell>
  );
}
