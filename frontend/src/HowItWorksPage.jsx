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

const STEPS = [
  { n:"01", icon:"📋", color:"#4f7cf9", time:"5 min", title:"Create your organisation",
    desc:"Sign up, choose your plan, and create your company workspace. Add your logo, set your timezone, and configure your department structure.",
    details:["Choose Individual or Company plan","Set up department hierarchy","Configure notification preferences","Invite your IT admin for SSO setup"],
    code:`// Invite your team via CSV
POST /api/v1/org/invite
{ "emails": ["team@company.com"],
  "role": "employee",
  "department": "Engineering" }`,
  },
  { n:"02", icon:"👥", color:"#22d3ee", time:"10 min", title:"Onboard your team",
    desc:"Send invite links or upload a CSV. Employees get a 2-minute onboarding flow — no training sessions, no IT tickets.",
    details:["Bulk invite via CSV upload","Individual invite links","SAML SSO auto-provisioning","Mobile-friendly onboarding flow"],
    code:`// Bulk import employees
POST /api/v1/employees/bulk
{ "file": "team.csv",
  "send_invite": true,
  "default_role": "employee" }`,
  },
  { n:"03", icon:"📷", color:"#10d9a0", time:"2 min/day", title:"Employees run daily check-ins",
    desc:"Each employee opens Corvus in their browser, enables their webcam for 60 seconds, and gets an instant posture score. No app install. No hardware.",
    details:["Browser-based — no install","60-second daily session","478-landmark AI analysis","Instant score + coaching tips"],
    code:`// On-device analysis (no upload)
mediapipe.analyze(webcamFrame)
→ { score: 82, risks: ["FHP"],
    advice: "Raise monitor 4cm",
    fatigue: "low" }`,
  },
  { n:"04", icon:"📊", color:"#818cf8", time:"Automated", title:"HR reviews weekly reports",
    desc:"Every Monday, HR admins receive an auto-generated PDF with department risk scores, trending issues, and recommended interventions.",
    details:["Auto PDF every Monday 8am","Department risk heatmap","Individual risk flags","ROI calculation vs sick leave"],
    code:`// Webhook on high-risk detection
POST your-endpoint
{ "employee_id": "emp_123",
  "risk_level": "high",
  "issue": "forward_head_posture",
  "recommended_action": "ergonomic_review" }`,
  },
  { n:"05", icon:"🤖", color:"#f59e0b", time:"Always on", title:"AI Coach works in the background",
    desc:"Corvus' AI coach monitors trends, sends nudges, and adapts recommendations based on each employee's history. Like a physio in their pocket.",
    details:["Personalised stretch programs","Progress tracking over time","Evidence-based recommendations","Arabic and English support"],
    code:`// AI Coach response (Groq)
{ "message": "Your neck angle improved
    3° this week. Try this stretch...",
  "citation": "Hansraj 2014",
  "next_session": "tomorrow 9am" }`,
  },
];

const FAQS_HOW = [
  ["Does the webcam record video?","No. All processing happens on the employee's device using on-device AI. No video is ever transmitted or stored. Corvus only sends numerical posture scores to the server."],
  ["What if an employee has poor lighting?","Corvus uses confidence scoring. If lighting drops below threshold, the session is flagged as low-confidence and excluded from reports rather than generating inaccurate data."],
  ["How long does a daily session take?","60 seconds for a standard check-in. Employees can optionally do a 5-minute extended session for more detailed analysis."],
  ["Can employees opt out?","Yes. HR admins can configure whether sessions are mandatory or voluntary. Individual employees can pause their tracking at any time."],
];

export default function HowItWorksPage() {
  const [lang, setLang] = useState(() => { try { return localStorage.getItem("lp_lang")||"en"; } catch { return "en"; } });
  const [openFaq, setOpenFaq] = useState(null);

  return (
    <PageShell lang={lang} setLang={setLang} activePage="how">
      <style>{`
        body{background:#030b14}
        .hiw-wrap{max-width:1000px;margin:0 auto;padding:0 32px}
        .hiw-code{font-family:'IBM Plex Mono','Segoe UI',monospace;font-size:12.5px;
          line-height:1.7;color:#94a3b8;white-space:pre;overflow-x:auto}
        @media(max-width:860px){.hiw-wrap{padding:0 20px}.hiw-step-grid{grid-template-columns:1fr!important;gap:32px!important}}
        @media(max-width:600px){.hiw-wrap{padding:0 16px}}
      `}</style>

      {/* ── Hero ── */}
      <div style={{ padding:"96px 0 72px", textAlign:"center", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0, pointerEvents:"none",
          background:"radial-gradient(ellipse 80% 50% at 50% -10%,rgba(129,140,248,.1),transparent)" }}/>
        <div className="hiw-wrap" style={{ position:"relative" }}>
          <Reveal>
            <div style={{ display:"inline-flex", alignItems:"center", gap:8, marginBottom:24,
              padding:"6px 16px", borderRadius:99,
              background:"rgba(129,140,248,.08)", border:"1px solid rgba(129,140,248,.2)" }}>
              <span style={{ width:6, height:6, borderRadius:"50%", background:T.indigo, display:"inline-block" }}/>
              <span style={{ fontSize:12, fontWeight:700, letterSpacing:".08em", textTransform:"uppercase", color:T.indigo, fontFamily:FM }}>
                How It Works
              </span>
            </div>
          </Reveal>
          <Reveal delay={.08}>
            <h1 style={{ fontSize:"clamp(38px,5vw,64px)", fontWeight:800, color:T.text,
              margin:"0 0 20px", letterSpacing:"-.03em", lineHeight:1.06, fontFamily:FD }}>
              From signup to{" "}
              <span style={{ background:T.gHero, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
                insights in 15 minutes
              </span>
            </h1>
          </Reveal>
          <Reveal delay={.14}>
            <p style={{ fontSize:18, color:T.sub, maxWidth:540, margin:"0 auto 40px", lineHeight:1.75 }}>
              No hardware. No installation. No training sessions.
              Five steps from zero to a fully-monitored team.
            </p>
          </Reveal>
          {/* Time badges */}
          <Reveal delay={.2}>
            <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap" }}>
              {[["⚡","Setup","~15 min"],["📷","Per session","60 sec"],["📊","Reports","Weekly auto"],["🤖","AI Coach","Always on"]].map(([icon,label,val])=>(
                <div key={label} style={{
                  display:"flex", alignItems:"center", gap:8,
                  padding:"9px 16px", borderRadius:99,
                  background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.08)",
                }}>
                  <span style={{ fontSize:14 }}>{icon}</span>
                  <span style={{ fontSize:12.5, color:T.muted }}>{label}:</span>
                  <span style={{ fontSize:12.5, color:T.text, fontWeight:600, fontFamily:FM }}>{val}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>

      {/* ── Steps ── */}
      <div className="hiw-wrap" style={{ paddingBottom:80 }}>
        {STEPS.map((step, i) => (
          <Reveal key={step.n} delay={.05}>
            <div style={{
              display:"grid", gridTemplateColumns:"80px 1fr 1fr", gap:40,
              padding:"52px 0", borderTop:"1px solid rgba(148,163,184,.06)",
              alignItems:"start",
            }} className="hiw-step-grid">

              {/* Number */}
              <div style={{ paddingTop:4 }}>
                <div style={{
                  width:64, height:64, borderRadius:18,
                  background:`${step.color}12`, border:`1.5px solid ${step.color}30`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  flexDirection:"column", gap:2,
                }}>
                  <span style={{ fontSize:22 }}>{step.icon}</span>
                </div>
                <div style={{ fontSize:11, color:step.color, fontWeight:700, fontFamily:FM,
                  marginTop:10, textAlign:"center", letterSpacing:".04em" }}>
                  {step.n}
                </div>
              </div>

              {/* Content */}
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                  <h2 style={{ fontSize:"clamp(18px,2vw,24px)", fontWeight:700, color:T.text,
                    margin:0, fontFamily:FD }}>{step.title}</h2>
                  <span style={{
                    fontSize:11, fontWeight:600, fontFamily:FM, color:step.color,
                    background:`${step.color}12`, border:`1px solid ${step.color}25`,
                    borderRadius:99, padding:"3px 10px", whiteSpace:"nowrap",
                  }}>⏱ {step.time}</span>
                </div>
                <p style={{ fontSize:15.5, color:T.sub, lineHeight:1.75, margin:"0 0 20px" }}>{step.desc}</p>
                <ul style={{ listStyle:"none", padding:0, margin:0, display:"flex", flexDirection:"column", gap:8 }}>
                  {step.details.map(d => (
                    <li key={d} style={{ display:"flex", gap:8, fontSize:14, color:T.muted, lineHeight:1.5 }}>
                      <span style={{ color:step.color, flexShrink:0 }}>✓</span>{d}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Code block */}
              <div style={{
                background:"#020810", border:`1px solid ${step.color}18`,
                borderRadius:14, padding:"20px 22px", overflow:"hidden",
              }}>
                <div style={{ display:"flex", gap:6, marginBottom:14 }}>
                  {["#ff5f57","#febc2e","#28c840"].map(c=>(
                    <div key={c} style={{ width:10, height:10, borderRadius:"50%", background:c }}/>
                  ))}
                </div>
                <pre className="hiw-code">{step.code}</pre>
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      {/* ── Architecture callout ── */}
      <div style={{ background:T.bg1, borderTop:"1px solid rgba(148,163,184,.06)", padding:"72px 0" }}>
        <div className="hiw-wrap">
          <Reveal>
            <h2 style={{ fontSize:"clamp(22px,2.5vw,34px)", fontWeight:800, color:T.text,
              margin:"0 0 40px", fontFamily:FD, letterSpacing:"-.02em" }}>
              Under the hood
            </h2>
          </Reveal>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16 }}>
            {[
              { icon:"📡", color:"#4f7cf9", title:"On-device AI", desc:"MediaPipe runs entirely in the browser. 478 landmarks, zero video upload, < 40ms latency." },
              { icon:"🧠", color:"#22d3ee", title:"Groq LLM", desc:"llama-3.1-8b-instant powers the AI coach. Responses in < 2 seconds with scientific citation support." },
              { icon:"🔥", color:"#10d9a0", title:"Firebase + Flask", desc:"Auth, Firestore, and a Python backend for score storage, HR reports, and webhook delivery." },
            ].map((item,i) => (
              <Reveal key={item.title} delay={i*.08}>
                <div style={{ background:T.card, border:`1px solid ${item.color}18`,
                  borderRadius:16, padding:"24px 22px", borderTop:`2px solid ${item.color}` }}>
                  <div style={{ fontSize:28, marginBottom:12 }}>{item.icon}</div>
                  <div style={{ fontSize:15, fontWeight:700, color:T.text, marginBottom:8, fontFamily:FD }}>{item.title}</div>
                  <p style={{ fontSize:13.5, color:T.muted, lineHeight:1.65, margin:0 }}>{item.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      {/* ── FAQ ── */}
      <div className="hiw-wrap" style={{ padding:"72px 0" }}>
        <Reveal>
          <h2 style={{ fontSize:"clamp(22px,2.5vw,34px)", fontWeight:800, color:T.text,
            margin:"0 0 36px", fontFamily:FD }}>Common questions</h2>
        </Reveal>
        {FAQS_HOW.map(([q, a], i) => (
          <div key={q} style={{ borderTop:"1px solid rgba(148,163,184,.07)", padding:"20px 0" }}>
            <button onClick={() => setOpenFaq(openFaq===i ? null : i)}
              style={{ width:"100%", textAlign:"left", background:"none", border:"none",
                cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center",
                gap:16, fontFamily:"inherit" }}>
              <span style={{ fontSize:15.5, fontWeight:600, color:T.text }}>{q}</span>
              <span style={{ fontSize:20, color:T.muted, flexShrink:0, transition:"transform .2s",
                transform: openFaq===i ? "rotate(45deg)" : "none" }}>+</span>
            </button>
            {openFaq===i && (
              <motion.p initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }}
                style={{ fontSize:14.5, color:T.sub, lineHeight:1.75, margin:"14px 0 4px", paddingRight:32 }}>
                {a}
              </motion.p>
            )}
          </div>
        ))}
      </div>

      {/* ── CTA ── */}
      <div style={{ background:T.bg1, borderTop:"1px solid rgba(148,163,184,.06)", padding:"80px 0", textAlign:"center" }}>
        <div className="hiw-wrap">
          <Reveal>
            <h2 style={{ fontSize:"clamp(24px,3vw,40px)", fontWeight:800, color:T.text,
              margin:"0 0 14px", fontFamily:FD }}>Try it yourself — free</h2>
            <p style={{ fontSize:16, color:T.sub, margin:"0 auto 32px", maxWidth:420, lineHeight:1.7 }}>
              15 minutes from now, your team could have their first posture report.
            </p>
            <a href="/auth?mode=signup" style={{
              display:"inline-flex", alignItems:"center", gap:8,
              padding:"14px 32px", borderRadius:12, fontSize:15.5, fontWeight:700,
              background:"linear-gradient(135deg,#1a56db,#0891b2)", color:"#fff",
              textDecoration:"none", boxShadow:"0 4px 20px rgba(26,86,219,.35)",
            }}>Start Free Trial →</a>
          </Reveal>
        </div>
      </div>
    </PageShell>
  );
}
