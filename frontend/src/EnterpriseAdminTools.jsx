/**
 * EnterpriseAdminTools.jsx — Corvus Phase 12
 * Super-admin: feature flags, system health, user impersonation, announcements, DB management
 */
import { useState, useEffect } from "react";

const FEATURE_FLAGS = [
  { id:"ff_ai_coaching",       label:"AI Coaching",          desc:"Enable AI coach panel for all users",         enabled:true,  rollout:100, env:"all" },
  { id:"ff_predictive_ai",     label:"Predictive AI",        desc:"Predictive risk model on dashboard",          enabled:true,  rollout:80,  env:"all" },
  { id:"ff_workforce",         label:"Workforce Analytics",  desc:"HR workforce analytics module",               enabled:true,  rollout:100, env:"all" },
  { id:"ff_api_marketplace",   label:"API Marketplace",      desc:"Self-serve API key management",               enabled:true,  rollout:50,  env:"all" },
  { id:"ff_white_label",       label:"White-Label Mode",     desc:"Custom branding for enterprise orgs",         enabled:true,  rollout:100, env:"enterprise" },
  { id:"ff_multi_tenant",      label:"Multi-Tenant Manager", desc:"Super-admin multi-org panel",                 enabled:true,  rollout:100, env:"internal" },
  { id:"ff_audit_system",      label:"Audit System",         desc:"Full compliance audit trail",                 enabled:true,  rollout:100, env:"enterprise" },
  { id:"ff_gemini_v15",        label:"Gemini 1.5 Flash",     desc:"Use Gemini 1.5 Flash for AI analysis",        enabled:false, rollout:0,   env:"beta" },
  { id:"ff_3d_posture",        label:"3D Posture Model",     desc:"Three.js 3D avatar posture visualization",    enabled:false, rollout:0,   env:"beta" },
  { id:"ff_mobile_app",        label:"Mobile App Mode",      desc:"Responsive mobile-first layout",              enabled:true,  rollout:100, env:"all" },
  { id:"ff_new_onboarding",    label:"New Onboarding v2",    desc:"Redesigned onboarding wizard",                enabled:true,  rollout:30,  env:"all" },
  { id:"ff_paymob_v3",         label:"PayMob API v3",        desc:"Upgrade to PayMob v3 payment API",            enabled:false, rollout:0,   env:"staging" },
];

const MOCK_HEALTH = {
  services: [
    { name:"API Gateway",        status:"healthy", latency:38,  uptime:99.98, load:42 },
    { name:"Analysis Engine",    status:"healthy", latency:142, uptime:99.95, load:61 },
    { name:"Gemini AI Proxy",    status:"healthy", latency:890, uptime:99.80, load:35 },
    { name:"Firebase Firestore", status:"healthy", latency:22,  uptime:99.99, load:28 },
    { name:"Redis Cache",        status:"healthy", latency:4,   uptime:100,   load:19 },
    { name:"Stripe Payments",    status:"healthy", latency:210, uptime:99.99, load:8 },
    { name:"SendGrid Email",     status:"degraded",latency:1200,uptime:99.20, load:5 },
    { name:"PDF Generator",      status:"healthy", latency:2100,uptime:99.90, load:12 },
    { name:"WebSocket Server",   status:"healthy", latency:28,  uptime:99.97, load:47 },
  ],
  db: { reads:8420, writes:1240, errors:3, cacheHitRate:94 },
  queue: { pending:12, processing:4, failed:1, avgWait:"1.2s" },
};

const MOCK_USERS_SAMPLE = [
  { uid:"u_s1", email:"sarah@acme.com",     name:"Sarah Johnson", plan:"enterprise", org:"Acme Corp",    lastSeen:"2m ago",    sessions:341 },
  { uid:"u_m1", email:"m.ali@techv.io",     name:"Mohamed Ali",   plan:"scale",      org:"TechVentures", lastSeen:"1h ago",    sessions:89 },
  { uid:"u_c1", email:"cto@startupxyz.com", name:"Chris Park",    plan:"growth",     org:"StartupXYZ",   lastSeen:"3h ago",    sessions:22 },
  { uid:"u_o1", email:"ops@healthfirst.org",name:"Olivia Reyes",  plan:"enterprise", org:"HealthFirst",  lastSeen:"Yesterday", sessions:512 },
];

const STATUS_DOT = { healthy:"#10b981", degraded:"#f59e0b", down:"#ef4444" };

export function EnterpriseAdminTools({ profile, cs, lang, onClose }) {
  const [tab, setTab]         = useState("flags");
  const [flags, setFlags]     = useState(FEATURE_FLAGS);
  const [health]              = useState(MOCK_HEALTH);
  const [userSearch, setUserSearch] = useState("");
  const [impersonating, setImpersonating] = useState(null);
  const [announcement, setAnnouncement]   = useState({ title:"", body:"", type:"info", targets:"all" });
  const [announcements, setAnnouncements] = useState([
    { id:"a1", title:"Scheduled maintenance", body:"Brief 5-min downtime Jun 10 02:00 UTC", type:"warning", sent:"2026-06-01", targets:"all" },
  ]);
  const [tick, setTick] = useState(0);

  // Simulate live metrics
  useEffect(() => {
    const t = setInterval(() => setTick(n => n+1), 3000);
    return () => clearInterval(t);
  }, []);

  const toggleFlag = (id) => setFlags(p => p.map(f => f.id===id ? { ...f, enabled:!f.enabled, rollout:!f.enabled?100:0 } : f));
  const setRollout = (id, v) => setFlags(p => p.map(f => f.id===id ? { ...f, rollout:parseInt(v), enabled:parseInt(v)>0 } : f));

  const sendAnnouncement = () => {
    if (!announcement.title || !announcement.body) return;
    setAnnouncements(p => [{ id:"a"+Date.now(), ...announcement, sent:new Date().toISOString().slice(0,10) }, ...p]);
    setAnnouncement({ title:"", body:"", type:"info", targets:"all" });
  };

  const filteredUsers = MOCK_USERS_SAMPLE.filter(u => {
    const q = userSearch.toLowerCase();
    return !q || u.email.includes(q) || u.name.toLowerCase().includes(q) || u.org.toLowerCase().includes(q);
  });

  const tabs = [
    { id:"flags",        label:"Feature Flags", icon:"🚩" },
    { id:"health",       label:"System Health", icon:"💚" },
    { id:"users",        label:"User Mgmt",     icon:"👤" },
    { id:"announce",     label:"Announcements", icon:"📢" },
    { id:"db",           label:"DB Tools",      icon:"🗄" },
  ];

  const envColors = { all:"#10b981", enterprise:"#f59e0b", internal:"#6366f1", beta:"#8b5cf6", staging:"#0ea5e9" };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.78)", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:cs.card, borderRadius:20, width:"100%", maxWidth:1100, height:"90vh", display:"flex", flexDirection:"column", overflow:"hidden", border:`1px solid ${cs.border}`, boxShadow:"0 32px 80px rgba(0,0,0,0.5)" }}>

        {/* Header */}
        <div style={{ padding:"20px 28px 0", borderBottom:`1px solid ${cs.border}`, background:"linear-gradient(135deg,rgba(16,185,129,0.07),rgba(99,102,241,0.04))" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:44, height:44, borderRadius:12, background:"linear-gradient(135deg,#10b981,#6366f1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>🛠</div>
              <div>
                <div style={{ fontWeight:800, fontSize:20, color:cs.text }}>Enterprise Admin Tools</div>
                <div style={{ fontSize:12, color:cs.textDim }}>Feature flags · System health · User management · Announcements</div>
              </div>
            </div>
            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              {impersonating && (
                <div style={{ background:"rgba(239,68,68,0.12)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:10, padding:"6px 14px", fontSize:12, color:"#ef4444", fontWeight:700 }}>
                  👤 Impersonating: {impersonating.name}
                  <button onClick={() => setImpersonating(null)} style={{ background:"none", border:"none", color:"#ef4444", cursor:"pointer", marginLeft:8, fontSize:14 }}>✕</button>
                </div>
              )}
              <div style={{ textAlign:"center", padding:"6px 14px", background:"rgba(16,185,129,0.1)", borderRadius:10 }}>
                <div style={{ fontSize:17, fontWeight:800, color:"#10b981" }}>{flags.filter(f=>f.enabled).length}/{flags.length}</div>
                <div style={{ fontSize:10, color:cs.textDim }}>Flags On</div>
              </div>
              <button onClick={onClose} style={{ background:"rgba(255,255,255,0.07)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:10, padding:"8px 14px", cursor:"pointer", fontSize:13 }}>✕</button>
            </div>
          </div>
          <div style={{ display:"flex", gap:4 }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ background:tab===t.id?"rgba(16,185,129,0.12)":"transparent", border:"none", color:tab===t.id?"#10b981":cs.textDim, padding:"8px 14px", cursor:"pointer", borderRadius:"8px 8px 0 0", fontWeight:tab===t.id?700:500, fontSize:13, borderBottom:tab===t.id?"2px solid #10b981":"2px solid transparent" }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:"auto", padding:24 }}>

          {/* ── FEATURE FLAGS ── */}
          {tab==="flags" && (
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                <div style={{ fontWeight:700, color:cs.text, fontSize:16 }}>🚩 Feature Flags</div>
                <div style={{ fontSize:12, color:cs.textDim }}>{flags.filter(f=>f.enabled).length} active · {flags.filter(f=>!f.enabled).length} disabled</div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {flags.map(f => (
                  <div key={f.id} style={{ background:cs.bg, borderRadius:12, padding:"14px 16px", border:`1px solid ${f.enabled?`${envColors[f.env]}44`:cs.border}`, display:"flex", alignItems:"center", gap:14 }}>
                    {/* Toggle */}
                    <div onClick={() => toggleFlag(f.id)} style={{ width:44, height:24, borderRadius:12, background:f.enabled?"#10b981":"rgba(255,255,255,0.1)", cursor:"pointer", position:"relative", transition:"background .2s", flexShrink:0 }}>
                      <div style={{ position:"absolute", top:3, left:f.enabled?22:3, width:18, height:18, borderRadius:"50%", background:"#fff", transition:"left .2s" }} />
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                        <span style={{ fontWeight:700, color:cs.text, fontSize:14 }}>{f.label}</span>
                        <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20, background:`${envColors[f.env]}18`, color:envColors[f.env] }}>{f.env}</span>
                      </div>
                      <div style={{ fontSize:11, color:cs.textDim, marginTop:2 }}>{f.desc}</div>
                    </div>
                    {/* Rollout slider */}
                    <div style={{ display:"flex", alignItems:"center", gap:8, minWidth:160 }}>
                      <input type="range" min={0} max={100} value={f.rollout} onChange={e => setRollout(f.id, e.target.value)} style={{ flex:1, accentColor:"#10b981" }} />
                      <span style={{ fontSize:12, fontWeight:700, color:f.enabled?"#10b981":cs.textDim, width:36, textAlign:"right" }}>{f.rollout}%</span>
                    </div>
                    <code style={{ fontSize:10, color:cs.textDim, background:"rgba(0,0,0,0.2)", padding:"2px 8px", borderRadius:5, whiteSpace:"nowrap" }}>{f.id}</code>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── SYSTEM HEALTH ── */}
          {tab==="health" && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
                {[
                  { label:"DB Reads/min",  value:(health.db.reads + (tick%3)*12).toLocaleString(), color:"#0ea5e9" },
                  { label:"DB Writes/min", value:(health.db.writes + (tick%5)*4).toLocaleString(), color:"#6366f1" },
                  { label:"Cache Hit Rate",value:`${health.db.cacheHitRate}%`, color:"#10b981" },
                  { label:"Queue Pending", value:health.queue.pending, color:"#f59e0b" },
                  { label:"Queue Failed",  value:health.queue.failed,  color:"#ef4444" },
                  { label:"DB Errors",     value:health.db.errors,     color:"#ef4444" },
                ].map(m => (
                  <div key={m.label} style={{ background:cs.bg, borderRadius:12, padding:"12px 16px", border:`1px solid ${cs.border}`, flex:"1 1 140px" }}>
                    <div style={{ fontSize:20, fontWeight:800, color:m.color }}>{m.value}</div>
                    <div style={{ fontSize:11, color:cs.textDim, marginTop:4 }}>{m.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ background:cs.bg, borderRadius:14, border:`1px solid ${cs.border}`, overflow:"hidden" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead>
                    <tr style={{ background:"rgba(255,255,255,0.02)" }}>
                      {["Service","Status","Latency","Uptime","Load"].map(h => (
                        <th key={h} style={{ padding:"10px 16px", textAlign:"left", fontSize:11, fontWeight:600, color:cs.textDim, borderBottom:`1px solid ${cs.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {health.services.map(s => (
                      <tr key={s.name} style={{ borderBottom:`1px solid ${cs.border}` }}>
                        <td style={{ padding:"12px 16px", fontWeight:600, color:cs.text, fontSize:13 }}>{s.name}</td>
                        <td style={{ padding:"12px 16px" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                            <div style={{ width:8, height:8, borderRadius:"50%", background:STATUS_DOT[s.status], boxShadow:s.status==="healthy"?"0 0 6px #10b981":undefined }} />
                            <span style={{ fontSize:12, color:STATUS_DOT[s.status], fontWeight:600 }}>{s.status}</span>
                          </div>
                        </td>
                        <td style={{ padding:"12px 16px", fontSize:12, color:s.latency>1000?"#ef4444":s.latency>500?"#f59e0b":"#10b981", fontWeight:600 }}>{s.latency}ms</td>
                        <td style={{ padding:"12px 16px", fontSize:12, color:cs.text }}>{s.uptime}%</td>
                        <td style={{ padding:"12px 16px" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            <div style={{ flex:1, height:6, background:"rgba(255,255,255,0.08)", borderRadius:3, minWidth:60 }}>
                              <div style={{ height:"100%", borderRadius:3, background:s.load>80?"#ef4444":s.load>60?"#f59e0b":"#10b981", width:`${s.load + (tick % 7) - 3}%`, transition:"width .5s" }} />
                            </div>
                            <span style={{ fontSize:11, color:cs.textDim, width:28 }}>{s.load}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── USER MANAGEMENT ── */}
          {tab==="users" && (
            <div>
              <div style={{ display:"flex", gap:10, marginBottom:16, alignItems:"center" }}>
                <input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="🔍 Search users…" style={{ flex:1, background:"rgba(255,255,255,0.05)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:9, padding:"8px 13px", fontSize:13, outline:"none" }} />
                <button style={{ background:"linear-gradient(135deg,#10b981,#6366f1)", border:"none", color:"#fff", borderRadius:9, padding:"8px 18px", cursor:"pointer", fontWeight:700, fontSize:13 }}>+ Create User</button>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {filteredUsers.map(u => (
                  <div key={u.uid} style={{ background:cs.bg, borderRadius:12, padding:16, border:`1px solid ${cs.border}`, display:"flex", gap:14, alignItems:"center" }}>
                    <div style={{ width:40, height:40, borderRadius:"50%", background:"linear-gradient(135deg,#6366f1,#0ea5e9)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:700, color:"#fff", flexShrink:0 }}>
                      {u.name[0]}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, color:cs.text, fontSize:14 }}>{u.name}</div>
                      <div style={{ fontSize:11, color:cs.textDim }}>{u.email} · {u.org} · {u.sessions} sessions</div>
                    </div>
                    <span style={{ fontSize:11, fontWeight:700, padding:"3px 9px", borderRadius:20, background:"rgba(245,158,11,0.12)", color:"#f59e0b" }}>{u.plan}</span>
                    <span style={{ fontSize:11, color:cs.textDim }}>{u.lastSeen}</span>
                    <div style={{ display:"flex", gap:6 }}>
                      <button onClick={() => setImpersonating(u)} style={{ background:"rgba(99,102,241,0.1)", border:"1px solid rgba(99,102,241,0.3)", color:"#6366f1", borderRadius:7, padding:"5px 11px", cursor:"pointer", fontSize:11, fontWeight:600 }}>👤 Impersonate</button>
                      <button style={{ background:"transparent", border:`1px solid ${cs.border}`, color:cs.textDim, borderRadius:7, padding:"5px 11px", cursor:"pointer", fontSize:11 }}>Edit</button>
                      <button style={{ background:"rgba(239,68,68,0.07)", border:"1px solid rgba(239,68,68,0.2)", color:"#ef4444", borderRadius:7, padding:"5px 11px", cursor:"pointer", fontSize:11 }}>Suspend</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── ANNOUNCEMENTS ── */}
          {tab==="announce" && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div style={{ fontWeight:700, color:cs.text, fontSize:16 }}>📢 System Announcements</div>
              <div style={{ background:cs.bg, borderRadius:14, padding:20, border:`1px solid ${cs.border}` }}>
                <div style={{ fontWeight:600, color:cs.text, marginBottom:14, fontSize:14 }}>Compose Announcement</div>
                <div style={{ marginBottom:12 }}>
                  <label style={{ fontSize:12, fontWeight:600, color:cs.textDim, display:"block", marginBottom:5 }}>Title</label>
                  <input value={announcement.title} onChange={e => setAnnouncement(p => ({...p,title:e.target.value}))} placeholder="Scheduled maintenance window" style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:9, padding:"9px 13px", fontSize:13, outline:"none", boxSizing:"border-box" }} />
                </div>
                <div style={{ marginBottom:12 }}>
                  <label style={{ fontSize:12, fontWeight:600, color:cs.textDim, display:"block", marginBottom:5 }}>Message</label>
                  <textarea value={announcement.body} onChange={e => setAnnouncement(p => ({...p,body:e.target.value}))} rows={3} placeholder="Brief maintenance from 02:00–02:05 UTC on June 10…" style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:9, padding:"9px 13px", fontSize:13, outline:"none", resize:"vertical", boxSizing:"border-box" }} />
                </div>
                <div style={{ display:"flex", gap:10, marginBottom:14 }}>
                  <div style={{ flex:1 }}>
                    <label style={{ fontSize:12, fontWeight:600, color:cs.textDim, display:"block", marginBottom:5 }}>Type</label>
                    <select value={announcement.type} onChange={e => setAnnouncement(p => ({...p,type:e.target.value}))} style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:9, padding:"9px 13px", fontSize:13, outline:"none" }}>
                      {["info","warning","critical","success"].map(t => <option key={t} value={t} style={{ background:"#1e293b" }}>{t}</option>)}
                    </select>
                  </div>
                  <div style={{ flex:1 }}>
                    <label style={{ fontSize:12, fontWeight:600, color:cs.textDim, display:"block", marginBottom:5 }}>Target</label>
                    <select value={announcement.targets} onChange={e => setAnnouncement(p => ({...p,targets:e.target.value}))} style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:9, padding:"9px 13px", fontSize:13, outline:"none" }}>
                      {["all","enterprise","scale","growth","starter","admins"].map(t => <option key={t} value={t} style={{ background:"#1e293b" }}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <button onClick={sendAnnouncement} style={{ background:"linear-gradient(135deg,#10b981,#0ea5e9)", border:"none", color:"#fff", borderRadius:10, padding:"10px 24px", cursor:"pointer", fontWeight:700, fontSize:13 }}>📢 Send Announcement</button>
              </div>

              {/* Sent announcements */}
              <div style={{ fontWeight:700, color:cs.text, fontSize:14 }}>Sent</div>
              {announcements.map(a => (
                <div key={a.id} style={{ background:cs.bg, borderRadius:12, padding:16, border:`1px solid ${a.type==="warning"?"rgba(245,158,11,0.3)":a.type==="critical"?"rgba(239,68,68,0.3)":cs.border}` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                    <div style={{ fontWeight:700, color:cs.text }}>{a.title}</div>
                    <div style={{ display:"flex", gap:8 }}>
                      <span style={{ fontSize:11, padding:"2px 9px", borderRadius:20, background:"rgba(255,255,255,0.07)", color:cs.textDim }}>{a.targets}</span>
                      <span style={{ fontSize:11, color:cs.textDim }}>{a.sent}</span>
                    </div>
                  </div>
                  <div style={{ fontSize:13, color:cs.textDim }}>{a.body}</div>
                </div>
              ))}
            </div>
          )}

          {/* ── DB TOOLS ── */}
          {tab==="db" && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div style={{ fontWeight:700, color:cs.text, fontSize:16 }}>🗄 Database Tools</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                {[
                  { title:"Firestore Backup", desc:"Trigger manual Firestore export to GCS", icon:"💾", action:"Run Backup", color:"#0ea5e9" },
                  { title:"Redis Flush Cache", desc:"Clear all Redis cache keys (use with caution)", icon:"🧹", action:"Flush Cache", color:"#f59e0b", danger:true },
                  { title:"Index Rebuild",     desc:"Rebuild Firestore composite indexes",          icon:"🔄", action:"Rebuild Indexes", color:"#6366f1" },
                  { title:"Orphan Cleanup",    desc:"Delete orphaned user data from Firestore",     icon:"🗑", action:"Run Cleanup", color:"#ef4444", danger:true },
                  { title:"Session Archiver",  desc:"Archive sessions older than 2 years to GCS",  icon:"📦", action:"Archive Now", color:"#10b981" },
                  { title:"DB Health Check",   desc:"Run full Firestore consistency check",         icon:"✅", action:"Run Check", color:"#10b981" },
                ].map(tool => (
                  <div key={tool.title} style={{ background:cs.bg, borderRadius:12, padding:18, border:`1px solid ${tool.danger?"rgba(239,68,68,0.2)":cs.border}` }}>
                    <div style={{ fontSize:28, marginBottom:8 }}>{tool.icon}</div>
                    <div style={{ fontWeight:700, color:cs.text, fontSize:14, marginBottom:4 }}>{tool.title}</div>
                    <div style={{ fontSize:12, color:cs.textDim, marginBottom:12, lineHeight:1.5 }}>{tool.desc}</div>
                    <button style={{ background:`${tool.color}18`, border:`1px solid ${tool.color}55`, color:tool.color, borderRadius:8, padding:"8px 16px", cursor:"pointer", fontWeight:700, fontSize:12 }}>{tool.action}</button>
                  </div>
                ))}
              </div>

              {/* Live DB metrics */}
              <div style={{ background:cs.bg, borderRadius:14, padding:20, border:`1px solid ${cs.border}` }}>
                <div style={{ fontWeight:700, color:cs.text, marginBottom:14, fontSize:14 }}>📊 Live Metrics</div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
                  {[
                    { label:"Reads / min",    value:(health.db.reads + (tick%3)*12).toLocaleString(), color:"#0ea5e9" },
                    { label:"Writes / min",   value:(health.db.writes + (tick%5)*4).toLocaleString(), color:"#6366f1" },
                    { label:"Cache Hit Rate", value:`${health.db.cacheHitRate}%`,                     color:"#10b981" },
                    { label:"Errors / min",   value:health.db.errors,                                  color:"#ef4444" },
                  ].map(m => (
                    <div key={m.label} style={{ textAlign:"center" }}>
                      <div style={{ fontSize:22, fontWeight:800, color:m.color }}>{m.value}</div>
                      <div style={{ fontSize:11, color:cs.textDim, marginTop:4 }}>{m.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
