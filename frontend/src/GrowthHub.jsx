/**
 * GrowthHub.jsx — Corvus Phase 13
 * Public roadmap, changelog, status page, affiliate/partner program — all in one Growth hub
 */
import { useState } from "react";

const ROADMAP_ITEMS = [
  { id:"r1",  status:"shipped",     quarter:"Q1 2026", title:"API Marketplace",              votes:284, category:"platform",    desc:"Self-serve API key management with docs, SDKs, and usage analytics." },
  { id:"r2",  status:"shipped",     quarter:"Q1 2026", title:"White-Label Mode",              votes:198, category:"enterprise",  desc:"Full branding customisation: logo, colors, domain, email templates." },
  { id:"r3",  status:"shipped",     quarter:"Q2 2026", title:"Multi-Tenant Manager",          votes:176, category:"enterprise",  desc:"Super-admin panel to manage all orgs from one place." },
  { id:"r4",  status:"in_progress", quarter:"Q2 2026", title:"Usage-Based Billing",           votes:341, category:"billing",     desc:"Metered billing per frame, report, API call — with dunning automation." },
  { id:"r5",  status:"in_progress", quarter:"Q2 2026", title:"Mobile App (iOS & Android)",   votes:512, category:"product",     desc:"Native mobile apps with camera-based posture analysis on the go." },
  { id:"r6",  status:"in_progress", quarter:"Q3 2026", title:"Churn Prediction Engine",      votes:289, category:"analytics",   desc:"ML-powered health scores and intervention playbooks." },
  { id:"r7",  status:"planned",     quarter:"Q3 2026", title:"3D Posture Avatar",             votes:423, category:"product",     desc:"Three.js 3D body model that mirrors your posture in real-time." },
  { id:"r8",  status:"planned",     quarter:"Q3 2026", title:"Slack / Teams Integration",    votes:388, category:"integrations",desc:"Get posture alerts and weekly reports directly in Slack or Teams." },
  { id:"r9",  status:"planned",     quarter:"Q3 2026", title:"Posture AI for Mobile Camera", votes:301, category:"product",     desc:"Analyse posture from smartphone camera while working remotely." },
  { id:"r10", status:"planned",     quarter:"Q4 2026", title:"EHR Integration (HL7/FHIR)",   votes:178, category:"enterprise",  desc:"Push posture data into hospital systems for clinical use cases." },
  { id:"r11", status:"planned",     quarter:"Q4 2026", title:"Zapier / Make.com Connector",  votes:265, category:"integrations",desc:"No-code automation triggers for posture events." },
  { id:"r12", status:"considering", quarter:"2027",    title:"Hardware Sensor Integration",  votes:149, category:"product",     desc:"Connect to wearable sensors for richer posture data beyond camera." },
];

const CHANGELOG = [
  { version:"v50.0", date:"2026-06-01", type:"major",   title:"Phase 12 — Enterprise Scale", items:["API Marketplace with 15 endpoints","White-Label configuration panel","Multi-Tenant Manager for super-admins","Audit System (SOC2/HIPAA/GDPR/ISO)","Enterprise Admin Tools with feature flags"] },
  { version:"v43.0", date:"2026-04-15", type:"major",   title:"Phase 11 — Billing & Design", items:["Billing Dashboard with Stripe","Design System tokens","Advanced Analytics (808-line rebuild)","PayMob v2 integration for MENA"] },
  { version:"v12.0", date:"2026-02-20", type:"major",   title:"Phase 10 — AI Layer",         items:["OnboardingWizard multi-step","AIInsights real-time panel","PredictiveAI risk modeling","WorkforceAnalytics for HR","EnterpriseRBAC & SSO"] },
  { version:"v8.4",  date:"2026-01-10", type:"minor",   title:"Performance & Fixes",         items:["50% faster frame analysis","Fixed calibration on ultrawide","Redis cache hit rate improved to 94%"] },
  { version:"v8.0",  date:"2025-12-01", type:"major",   title:"Gamification",                items:["Leaderboards & streaks","Achievement badges system","Team challenges"] },
];

const SERVICES_STATUS = [
  { name:"API & Analysis",     status:"operational" },
  { name:"Web App",            status:"operational" },
  { name:"Billing",            status:"operational" },
  { name:"Email Delivery",     status:"degraded"    },
  { name:"Webhooks",           status:"operational" },
  { name:"AI (Local AI)",  status:"operational" },
];

const AFFILIATES = [
  { id:"a1", name:"Wellness Blog Pro", email:"contact@wellnessblog.com", clicks:1240, signups:48, revenue:432, tier:"silver", joined:"2026-01-15" },
  { id:"a2", name:"ErgoDesk YouTube",  email:"ergodesk@creator.io",      clicks:3840, signups:142,revenue:1890,tier:"gold",   joined:"2025-11-08" },
  { id:"a3", name:"HR Tech Weekly",    email:"partner@hrtech.news",       clicks:820,  signups:21, revenue:189, tier:"bronze", joined:"2026-03-22" },
];

const STATUS_COLORS = { operational:"#10b981", degraded:"#f59e0b", down:"#ef4444" };
const ITEM_STATUS   = { shipped:"#10b981", in_progress:"#6366f1", planned:"#0ea5e9", considering:"#64748b" };
const TYPE_COLORS   = { major:"#6366f1", minor:"#0ea5e9", patch:"#64748b" };
const TIER_COLORS   = { gold:"#f59e0b", silver:"#94a3b8", bronze:"#cd7c2f" };
const CAT_COLORS    = { platform:"#6366f1", enterprise:"#f59e0b", billing:"#10b981", product:"#0ea5e9", analytics:"#8b5cf6", integrations:"#ec4899" };

export function GrowthHub({ profile, cs, lang, onClose }) {
  const [tab, setTab]       = useState("roadmap");
  const [voted, setVoted]   = useState({});
  const [items, setItems]   = useState(ROADMAP_ITEMS);
  const [catFilter, setCat] = useState("all");

  const vote = (id) => {
    if (voted[id]) return;
    setVoted(p => ({...p, [id]: true}));
    setItems(p => p.map(item => item.id===id ? {...item, votes:item.votes+1} : item));
  };

  const filtered = catFilter==="all" ? items : items.filter(i=>i.category===catFilter);
  const grouped  = ["in_progress","planned","shipped","considering"].reduce(
    (acc,s) => ({...acc, [s]: filtered.filter(i=>i.status===s)}), {}
  );

  const isAr = lang === "ar";
  const tabs = [
    { id:"roadmap",   label: isAr?"خارطة الطريق":"Roadmap",   icon:"🗺" },
    { id:"changelog", label: isAr?"سجل التحديثات":"Changelog", icon:"📋" },
    { id:"status",    label: isAr?"الحالة":"Status",    icon:"🟢" },
    { id:"affiliate", label: isAr?"الشراكة":"Affiliate", icon:"🤝" },
  ];

  const categories = ["all",...new Set(ROADMAP_ITEMS.map(i=>i.category))];

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:cs.card, borderRadius:20, width:"100%", maxWidth:1060, height:"88vh", display:"flex", flexDirection:"column", overflow:"hidden", border:`1px solid ${cs.border}`, boxShadow:"0 32px 80px rgba(0,0,0,0.5)" }}>

        {/* Header */}
        <div style={{ padding:"20px 28px 0", borderBottom:`1px solid ${cs.border}`, background:"linear-gradient(135deg,rgba(99,102,241,0.07),rgba(236,72,153,0.04))" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:44, height:44, borderRadius:12, background:"linear-gradient(135deg,#6366f1,#ec4899)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>🚀</div>
              <div>
                <div style={{ fontWeight:800, fontSize:20, color:cs.text }}>Growth Hub</div>
                <div style={{ fontSize:12, color:cs.muted||"#64748b" }}>
                  {isAr?"خارطة الطريق · التحديثات · الحالة · الشراكة":"Roadmap · Changelog · Status · Affiliate Program"}
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{ background:"rgba(255,255,255,0.07)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:10, padding:"8px 14px", cursor:"pointer", fontSize:13 }} aria-label="Close">✕</button>
          </div>
          <div style={{ display:"flex", gap:4 }}>
            {tabs.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{ background:tab===t.id?"rgba(99,102,241,0.12)":"transparent", border:"none", color:tab===t.id?"#6366f1":cs.muted||"#64748b", padding:"8px 14px", cursor:"pointer", borderRadius:"8px 8px 0 0", fontWeight:tab===t.id?700:500, fontSize:13, borderBottom:tab===t.id?"2px solid #6366f1":"2px solid transparent" }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:24 }}>

          {/* ── ROADMAP ── */}
          {tab==="roadmap" && (
            <div>
              {/* Category filters */}
              <div style={{ display:"flex", gap:6, marginBottom:20, flexWrap:"wrap" }}>
                {categories.map(c=>(
                  <button key={c} onClick={()=>setCat(c)} style={{ padding:"5px 13px", borderRadius:20, border:"1px solid", fontSize:11, cursor:"pointer", fontWeight:600, borderColor:catFilter===c?(CAT_COLORS[c]||"#6366f1"):cs.border, background:catFilter===c?`${CAT_COLORS[c]||"#6366f1"}18`:"transparent", color:catFilter===c?(CAT_COLORS[c]||"#6366f1"):cs.muted||"#64748b" }}>
                    {c}
                  </button>
                ))}
              </div>

              {[
                { key:"in_progress", label: isAr?"🔨 قيد التنفيذ":"🔨 In Progress" },
                { key:"planned",     label: isAr?"📅 مخطط":"📅 Planned" },
                { key:"shipped",     label: isAr?"✅ تم الإطلاق":"✅ Shipped" },
                { key:"considering", label: isAr?"💭 قيد الدراسة":"💭 Considering" },
              ].map(section=>{
                const sItems = grouped[section.key] || [];
                if (!sItems.length) return null;
                return (
                  <div key={section.key} style={{ marginBottom:24 }}>
                    <div style={{ fontWeight:700, color:cs.text, fontSize:15, marginBottom:12 }}>{section.label} ({sItems.length})</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                      {sItems.map(item=>(
                        <div key={item.id} style={{ background:cs.bg, borderRadius:12, padding:"14px 16px", border:`1px solid ${cs.border}`, display:"flex", gap:14, alignItems:"center" }}>
                          <div style={{ flex:1 }}>
                            <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:4 }}>
                              <span style={{ fontWeight:700, color:cs.text, fontSize:14 }}>{item.title}</span>
                              <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20, background:`${CAT_COLORS[item.category]||"#6366f1"}18`, color:CAT_COLORS[item.category]||"#6366f1" }}>{item.category}</span>
                              <span style={{ fontSize:10, color:cs.muted||"#64748b" }}>{item.quarter}</span>
                            </div>
                            <div style={{ fontSize:12, color:cs.muted||"#64748b", lineHeight:1.5 }}>{item.desc}</div>
                          </div>
                          <button onClick={()=>vote(item.id)} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2, background:voted[item.id]?"rgba(99,102,241,0.12)":"rgba(255,255,255,0.04)", border:`1px solid ${voted[item.id]?"#6366f1":cs.border}`, borderRadius:10, padding:"8px 14px", cursor:voted[item.id]?"default":"pointer", minWidth:56, transition:"all .2s" }}>
                            <span style={{ fontSize:16 }}>▲</span>
                            <span style={{ fontSize:12, fontWeight:700, color:voted[item.id]?"#6366f1":cs.text }}>{item.votes}</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── CHANGELOG ── */}
          {tab==="changelog" && (
            <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
              {CHANGELOG.map(entry=>(
                <div key={entry.version} style={{ background:cs.bg, borderRadius:14, padding:20, border:`1px solid ${cs.border}` }}>
                  <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:12 }}>
                    <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:20, background:`${TYPE_COLORS[entry.type]}18`, color:TYPE_COLORS[entry.type] }}>{entry.type}</span>
                    <span style={{ fontWeight:800, fontSize:16, color:cs.text }}>{entry.version}</span>
                    <span style={{ fontSize:12, fontWeight:700, color:"#6366f1" }}>{entry.title}</span>
                    <span style={{ fontSize:11, color:cs.muted||"#64748b", marginLeft:"auto" }}>{entry.date}</span>
                  </div>
                  <ul style={{ margin:0, padding:"0 0 0 18px", display:"flex", flexDirection:"column", gap:4 }}>
                    {entry.items.map((item,i)=>(
                      <li key={i} style={{ fontSize:13, color:cs.text, lineHeight:1.6 }}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {/* ── STATUS ── */}
          {tab==="status" && (
            <div style={{ display:"flex", flexDirection:"column", gap:16, maxWidth:700 }}>
              <div style={{ textAlign:"center", padding:"24px 0" }}>
                <div style={{ fontSize:48 }}>✅</div>
                <div style={{ fontSize:22, fontWeight:800, color:"#10b981", marginTop:8 }}>All Systems Operational</div>
                <div style={{ fontSize:13, color:cs.muted||"#64748b", marginTop:4 }}>Last checked: just now</div>
              </div>
              <div style={{ background:cs.bg, borderRadius:14, border:`1px solid ${cs.border}`, overflow:"hidden" }}>
                {SERVICES_STATUS.map((s,i)=>(
                  <div key={s.name} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 20px", borderBottom:i<SERVICES_STATUS.length-1?`1px solid ${cs.border}`:undefined }}>
                    <span style={{ fontSize:14, fontWeight:600, color:cs.text }}>{s.name}</span>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ width:8, height:8, borderRadius:"50%", background:STATUS_COLORS[s.status], boxShadow:s.status==="operational"?"0 0 6px #10b981":undefined }} />
                      <span style={{ fontSize:12, fontWeight:600, color:STATUS_COLORS[s.status] }}>
                        {s.status==="operational"?"Operational":s.status==="degraded"?"Degraded":"Down"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {/* 90-day uptime bars */}
              <div style={{ background:cs.bg, borderRadius:14, padding:20, border:`1px solid ${cs.border}` }}>
                <div style={{ fontWeight:700, color:cs.text, marginBottom:14, fontSize:14 }}>90-Day Uptime</div>
                {SERVICES_STATUS.map(s=>(
                  <div key={s.name} style={{ marginBottom:12 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                      <span style={{ fontSize:12, color:cs.text }}>{s.name}</span>
                      <span style={{ fontSize:12, fontWeight:700, color:"#10b981" }}>{s.status==="degraded"?"99.20%":"99.97%"}</span>
                    </div>
                    <div style={{ display:"flex", gap:1 }}>
                      {Array.from({length:90},(_,i)=>(
                        <div key={i} style={{ flex:1, height:20, borderRadius:2, background:s.status==="degraded"&&i===88?"#f59e0b":"#10b981", opacity:0.85 }} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── AFFILIATE ── */}
          {tab==="affiliate" && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:12 }}>
                {[
                  { label:"Commission Rate", value:"20%",    desc:"Recurring monthly",    color:"#6366f1" },
                  { label:"Cookie Window",   value:"90 days",desc:"Attribution period",   color:"#0ea5e9" },
                  { label:"Total Partners",  value:AFFILIATES.length, desc:"Active affiliates", color:"#10b981" },
                  { label:"Total Payouts",   value:"$2,511", desc:"This quarter",          color:"#f59e0b" },
                ].map(m=>(
                  <div key={m.label} style={{ background:cs.bg, borderRadius:14, padding:16, border:`1px solid ${cs.border}` }}>
                    <div style={{ fontSize:24, fontWeight:900, color:m.color }}>{m.value}</div>
                    <div style={{ fontSize:13, fontWeight:700, color:cs.text, marginTop:4 }}>{m.label}</div>
                    <div style={{ fontSize:11, color:cs.muted||"#64748b" }}>{m.desc}</div>
                  </div>
                ))}
              </div>

              <div style={{ fontWeight:700, color:cs.text, fontSize:15 }}>Partners</div>
              {AFFILIATES.map(a=>(
                <div key={a.id} style={{ background:cs.bg, borderRadius:12, padding:16, border:`1px solid ${cs.border}`, display:"flex", gap:14, alignItems:"center" }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:4 }}>
                      <span style={{ fontWeight:700, color:cs.text, fontSize:14 }}>{a.name}</span>
                      <span style={{ fontSize:11, fontWeight:700, padding:"2px 9px", borderRadius:20, background:`${TIER_COLORS[a.tier]}18`, color:TIER_COLORS[a.tier], textTransform:"uppercase" }}>{a.tier}</span>
                    </div>
                    <div style={{ fontSize:11, color:cs.muted||"#64748b" }}>{a.email} · Joined {a.joined}</div>
                  </div>
                  {[
                    { label:"Clicks", value:a.clicks.toLocaleString() },
                    { label:"Signups", value:a.signups },
                    { label:"Revenue", value:`$${a.revenue}` },
                  ].map(s=>(
                    <div key={s.label} style={{ textAlign:"center", padding:"6px 12px", background:"rgba(255,255,255,0.04)", borderRadius:8 }}>
                      <div style={{ fontSize:15, fontWeight:700, color:cs.text }}>{s.value}</div>
                      <div style={{ fontSize:10, color:cs.muted||"#64748b" }}>{s.label}</div>
                    </div>
                  ))}
                  <button style={{ background:"transparent", border:`1px solid ${cs.border}`, color:cs.muted||"#64748b", borderRadius:7, padding:"6px 12px", cursor:"pointer", fontSize:11 }}>Manage</button>
                </div>
              ))}

              <div style={{ background:"rgba(99,102,241,0.07)", border:"1px solid rgba(99,102,241,0.2)", borderRadius:12, padding:16 }}>
                <div style={{ fontWeight:700, color:cs.text, marginBottom:10, fontSize:14 }}>🔗 Affiliate Link Generator</div>
                <div style={{ display:"flex", gap:8 }}>
                  <input defaultValue={profile?.referral_code ? `https://corvus.com?ref=${profile.referral_code}` : `https://corvus.com?ref=${(profile?.uid||"").slice(0,8)}`} style={{ flex:1, background:"rgba(0,0,0,0.2)", border:`1px solid ${cs.border}`, color:"#a5f3fc", borderRadius:8, padding:"8px 13px", fontSize:12, fontFamily:"monospace", outline:"none" }} readOnly />
                  <button style={{ background:"linear-gradient(135deg,#6366f1,#ec4899)", border:"none", color:"#fff", borderRadius:8, padding:"8px 16px", cursor:"pointer", fontWeight:700, fontSize:12 }}>Copy</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
