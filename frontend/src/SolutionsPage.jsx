import React, { useState, useRef } from "react";
import { motion, useInView } from "framer-motion";
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

const INDUSTRIES = [
  { icon:"🏦", name:"Banking & Finance", color:"#4f7cf9",
    problem:"Compliance teams and analysts spend 10+ hours/day at screens. Back and neck conditions are the #1 cause of sick leave.",
    solution:"Corvus monitors all desk-based staff silently, generates weekly ergonomic compliance reports, and flags high-risk employees before claims arise.",
    results:[["↓44%","Sick leave (musculoskeletal)"],["↓61%","Ergonomic injury claims"],["↑29%","HR compliance score"]],
    clients:"Used by 3 national banks across MENA",
  },
  { icon:"💻", name:"Technology & SaaS", color:"#22d3ee",
    problem:"Remote and hybrid engineers often work in non-ergonomic home setups. Burnout compounds posture neglect.",
    solution:"Deploy Corvus company-wide in 20 minutes via invite link. Engineers get an AI coach in their workflow — no meetings, no friction.",
    results:[["↓38%","Back pain complaints"],["4.1×","ROI in year 1"],["94%","Daily active rate"]],
    clients:"Trusted by 12 tech companies across Egypt and UAE",
  },
  { icon:"📞", name:"Telecoms & BPO", color:"#10d9a0",
    problem:"Call center agents sit for 8-hour shifts in fixed positions. Turnover is high — and poor ergonomics is a hidden driver.",
    solution:"Corvus integrates with shift management. HR sees real-time posture scores by team, with automatic break recommendations when fatigue is detected.",
    results:[["↓52%","Posture-related absences"],["↓19%","Staff turnover rate"],["↑35%","Agent satisfaction"]],
    clients:"Running in 2 major telecom call centers",
  },
  { icon:"🏥", name:"Healthcare & Clinics", color:"#818cf8",
    problem:"Clinicians and admin staff experience some of the highest rates of work-related musculoskeletal disorders globally.",
    solution:"Corvus tracks posture during documentation sessions and flags dangerous patterns. Integrates with occupational health protocols.",
    results:[["↓41%","MSK disorder incidence"],["↓28%","Physiotherapy costs"],["✅","Occupational health compliant"]],
    clients:"Piloted at Coventry University Egypt Faculty of Health Sciences",
  },
];

const PERSONAS = [
  { role:"HR Director", icon:"👩‍💼", color:"#4f7cf9",
    needs:["Company-wide risk visibility","Automated compliance reports","Legal audit trail for injury claims","ROI data for board reporting"],
    gets:"Full HR dashboard with department heatmaps, weekly PDF reports, custom risk thresholds, and 90-day trend data.",
  },
  { role:"Team Manager", icon:"🧑‍💻", color:"#22d3ee",
    needs:["Know which team members are at risk","Trigger interventions early","No added management overhead"],
    gets:"Real-time team posture feed, automatic Slack/Teams alerts when someone hits a risk threshold.",
  },
  { role:"Individual Employee", icon:"🙋", color:"#10d9a0",
    needs:["Fix my back pain","Understand my posture habits","Get coaching without seeing a physio"],
    gets:"Personal AI coach, daily posture score, personalised stretch programs, and weekly progress reports.",
  },
  { role:"IT / Security", icon:"🔐", color:"#818cf8",
    needs:["Zero video storage","SSO integration","GDPR compliance","Simple deployment"],
    gets:"On-device AI (no video leaves the machine), SAML SSO, AES-256 encryption, full audit logs.",
  },
];

export default function SolutionsPage() {
  const [lang, setLang] = useState(() => { try { return localStorage.getItem("lp_lang")||"en"; } catch { return "en"; } });
  const [activeIndustry, setActiveIndustry] = useState(0);
  const ind = INDUSTRIES[activeIndustry];

  return (
    <PageShell lang={lang} setLang={setLang} activePage="casestudies">
      <style>{`
        body{background:#030b14}
        .sol-wrap{max-width:1100px;margin:0 auto;padding:0 32px}
        .sol-industry-tab{transition:all .2s;cursor:pointer;border:none;font-family:inherit}
        .sol-industry-tab:hover{border-color:rgba(255,255,255,.2)!important;color:#e8f0ff!important}
        .sol-persona-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:20px}
        @media(max-width:1024px){.sol-persona-grid{grid-template-columns:1fr 1fr}}
        @media(max-width:640px){.sol-persona-grid{grid-template-columns:1fr}.sol-wrap{padding:0 16px}}
        @media(max-width:860px){.sol-wrap{padding:0 20px}}
      `}</style>

      {/* ── Hero ── */}
      <div style={{ padding:"96px 0 72px", textAlign:"center", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0, pointerEvents:"none",
          background:"radial-gradient(ellipse 80% 50% at 50% -10%,rgba(16,217,160,.1),transparent)" }}/>
        <div className="sol-wrap" style={{ position:"relative" }}>
          <Reveal>
            <div style={{ display:"inline-flex", alignItems:"center", gap:8, marginBottom:24,
              padding:"6px 16px", borderRadius:99,
              background:"rgba(16,217,160,.08)", border:"1px solid rgba(16,217,160,.2)" }}>
              <span style={{ width:6, height:6, borderRadius:"50%", background:T.green, display:"inline-block" }}/>
              <span style={{ fontSize:12, fontWeight:700, letterSpacing:".08em", textTransform:"uppercase", color:T.green, fontFamily:FM }}>
                Solutions
              </span>
            </div>
          </Reveal>
          <Reveal delay={.08}>
            <h1 style={{
              fontSize:"clamp(38px,5vw,66px)", fontWeight:800, color:T.text,
              margin:"0 0 20px", letterSpacing:"-.03em", lineHeight:1.06, fontFamily:FD,
            }}>
              The right fit for{" "}
              <span style={{ background:T.gHero, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
                every team
              </span>
            </h1>
          </Reveal>
          <Reveal delay={.14}>
            <p style={{ fontSize:18, color:T.sub, maxWidth:560, margin:"0 auto", lineHeight:1.75 }}>
              Whether you're an HR director at a 2,000-person bank or a CTO at a 50-person startup —
              Corvus adapts to your industry, team structure, and compliance needs.
            </p>
          </Reveal>
        </div>
      </div>

      {/* ── Industry selector ── */}
      <div style={{ background:T.bg1, borderTop:"1px solid rgba(148,163,184,.06)", borderBottom:"1px solid rgba(148,163,184,.06)" }}>
        <div className="sol-wrap">
          <div style={{ display:"flex", gap:0, overflowX:"auto", padding:"4px 0" }}>
            {INDUSTRIES.map((ind, i) => (
              <button key={ind.name} className="sol-industry-tab"
                onClick={() => setActiveIndustry(i)}
                style={{
                  padding:"18px 24px", fontSize:14, fontWeight:500,
                  color: activeIndustry===i ? T.text : T.muted,
                  background:"transparent",
                  borderBottom: activeIndustry===i ? `2px solid ${ind.color}` : "2px solid transparent",
                  whiteSpace:"nowrap",
                }}>
                {ind.icon} {ind.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Industry detail ── */}
      <div className="sol-wrap" style={{ padding:"72px 0" }}>
        <motion.div key={activeIndustry}
          initial={{ opacity:0, y:16 }}
          animate={{ opacity:1, y:0 }}
          transition={{ duration:.4 }}
          style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:64, alignItems:"start" }}>

          {/* Left */}
          <div>
            <div style={{ fontSize:48, marginBottom:20 }}>{ind.icon}</div>
            <h2 style={{ fontSize:"clamp(24px,2.5vw,36px)", fontWeight:800, color:T.text,
              margin:"0 0 8px", fontFamily:FD, letterSpacing:"-.02em" }}>
              {ind.name}
            </h2>
            <div style={{ fontSize:12, color:ind.color, fontWeight:600, fontFamily:FM,
              letterSpacing:".06em", textTransform:"uppercase", marginBottom:24 }}>
              {ind.clients}
            </div>
            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:11, fontWeight:700, color:T.muted, textTransform:"uppercase",
                letterSpacing:".08em", marginBottom:10, fontFamily:FM }}>The Problem</div>
              <p style={{ fontSize:16, color:T.sub, lineHeight:1.75, margin:0 }}>{ind.problem}</p>
            </div>
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:T.muted, textTransform:"uppercase",
                letterSpacing:".08em", marginBottom:10, fontFamily:FM }}>How Corvus Helps</div>
              <p style={{ fontSize:16, color:T.sub, lineHeight:1.75, margin:0 }}>{ind.solution}</p>
            </div>
          </div>

          {/* Right — results */}
          <div>
            <div style={{ background:T.card, border:`1px solid ${ind.color}20`,
              borderRadius:20, padding:32, marginBottom:20,
              boxShadow:`0 0 60px ${ind.color}08` }}>
              <div style={{ fontSize:13, fontWeight:700, color:ind.color, fontFamily:FM,
                letterSpacing:".06em", textTransform:"uppercase", marginBottom:24 }}>
                Measured Results
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16 }}>
                {ind.results.map(([val, label]) => (
                  <div key={label} style={{ textAlign:"center",
                    background:`${ind.color}08`, borderRadius:12, padding:"20px 12px",
                    border:`1px solid ${ind.color}18` }}>
                    <div style={{ fontSize:28, fontWeight:800, color:ind.color,
                      fontFamily:FM, letterSpacing:"-.02em", marginBottom:6, lineHeight:1 }}>
                      {val}
                    </div>
                    <div style={{ fontSize:11.5, color:T.muted, lineHeight:1.4 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            <a href={`mailto:m789pppp@gmail.com?subject=Corvus Demo — ${ind.name}`}
              style={{
                display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                padding:"14px", borderRadius:12, fontSize:15, fontWeight:700,
                background:"linear-gradient(135deg,#1a56db,#0891b2)", color:"#fff",
                textDecoration:"none", boxShadow:"0 4px 20px rgba(26,86,219,.35)",
              }}>
              Book a demo for {ind.name} →
            </a>
          </div>
        </motion.div>
      </div>

      {/* ── Who uses Corvus ── */}
      <div style={{ background:T.bg1, borderTop:"1px solid rgba(148,163,184,.06)", padding:"80px 0" }}>
        <div className="sol-wrap">
          <Reveal>
            <div style={{ textAlign:"center", marginBottom:52 }}>
              <div style={{ fontSize:12, fontWeight:700, color:T.indigo, fontFamily:FM,
                letterSpacing:".1em", textTransform:"uppercase", marginBottom:14 }}>
                Who uses Corvus
              </div>
              <h2 style={{ fontSize:"clamp(26px,2.8vw,40px)", fontWeight:800, color:T.text,
                margin:0, fontFamily:FD, letterSpacing:"-.025em" }}>
                Built for every stakeholder
              </h2>
            </div>
          </Reveal>

          <div className="sol-persona-grid">
            {PERSONAS.map((p, i) => (
              <Reveal key={p.role} delay={i*.08}>
                <div style={{ background:T.card, border:`1px solid ${p.color}18`,
                  borderRadius:18, padding:"28px 24px", height:"100%",
                  borderTop:`2px solid ${p.color}` }}>
                  <div style={{ fontSize:32, marginBottom:14 }}>{p.icon}</div>
                  <div style={{ fontSize:16, fontWeight:700, color:T.text, marginBottom:6, fontFamily:FD }}>{p.role}</div>
                  <div style={{ fontSize:11, color:p.color, fontWeight:600, fontFamily:FM,
                    textTransform:"uppercase", letterSpacing:".06em", marginBottom:18 }}>
                    What they need
                  </div>
                  <ul style={{ listStyle:"none", padding:0, margin:"0 0 20px", display:"flex", flexDirection:"column", gap:8 }}>
                    {p.needs.map(n => (
                      <li key={n} style={{ display:"flex", gap:8, fontSize:13.5, color:T.sub, lineHeight:1.5 }}>
                        <span style={{ color:p.color, flexShrink:0 }}>›</span>{n}
                      </li>
                    ))}
                  </ul>
                  <div style={{ padding:"12px 14px", borderRadius:10,
                    background:`${p.color}08`, border:`1px solid ${p.color}18` }}>
                    <div style={{ fontSize:11, color:p.color, fontWeight:700, fontFamily:FM,
                      textTransform:"uppercase", letterSpacing:".06em", marginBottom:6 }}>
                      What they get
                    </div>
                    <p style={{ fontSize:13, color:T.sub, margin:0, lineHeight:1.6 }}>{p.gets}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      {/* ── CTA ── */}
      <div style={{ padding:"80px 0", textAlign:"center" }}>
        <div className="sol-wrap">
          <Reveal>
            <h2 style={{ fontSize:"clamp(26px,3vw,42px)", fontWeight:800, color:T.text,
              margin:"0 0 16px", fontFamily:FD }}>
              Find the right plan for your team
            </h2>
            <p style={{ fontSize:17, color:T.sub, margin:"0 auto 36px", maxWidth:460, lineHeight:1.7 }}>
              Individual, team, or enterprise — we have a plan that fits your size and budget.
            </p>
            <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" }}>
              <a href="/pricing" style={{
                padding:"13px 28px", borderRadius:12, fontSize:15.5, fontWeight:700,
                background:"linear-gradient(135deg,#1a56db,#0891b2)", color:"#fff",
                textDecoration:"none", boxShadow:"0 4px 20px rgba(26,86,219,.35)",
                display:"inline-flex", alignItems:"center", gap:8,
              }}>See Pricing →</a>
              <a href="/auth?mode=signup" style={{
                padding:"13px 28px", borderRadius:12, fontSize:15.5, fontWeight:600,
                background:"rgba(255,255,255,.05)", color:T.sub,
                border:"1px solid rgba(255,255,255,.1)", textDecoration:"none",
                display:"inline-flex", alignItems:"center",
              }}>Start Free Trial</a>
            </div>
          </Reveal>
        </div>
      </div>
    </PageShell>
  );
}
