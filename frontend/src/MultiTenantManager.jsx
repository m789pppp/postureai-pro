/**
 * MultiTenantManager.jsx — Corvus Phase 12
 * Manage all tenants/organizations from one super-admin panel
 */
import { useState, useMemo } from "react";

const MOCK_TENANTS = [
  { id:"t1", name:"Acme Corp",       domain:"acme.com",       plan:"enterprise", seats:240, activeSeats:198, health:94, status:"active",   region:"us-east",   mrr:4800, admin:"sarah@acme.com",     created:"2025-01-12", storage:"4.2GB", apiCalls:182400 },
  { id:"t2", name:"TechVentures",   domain:"techventures.io", plan:"scale",      seats:80,  activeSeats:67,  health:88, status:"active",   region:"eu-west",   mrr:1590, admin:"m.ali@techv.io",     created:"2025-03-05", storage:"1.8GB", apiCalls:49200 },
  { id:"t3", name:"HealthFirst",    domain:"healthfirst.org", plan:"enterprise", seats:500, activeSeats:412, health:91, status:"active",   region:"us-west",   mrr:9200, admin:"ops@healthfirst.org", created:"2024-11-20", storage:"11.4GB", apiCalls:394000 },
  { id:"t4", name:"StartupXYZ",     domain:"startupxyz.com", plan:"growth",     seats:15,  activeSeats:14,  health:97, status:"active",   region:"us-east",   mrr:199,  admin:"cto@startupxyz.com",  created:"2026-02-14", storage:"0.3GB", apiCalls:8100 },
  { id:"t5", name:"GlobalLogistics",domain:"globallog.com",  plan:"enterprise", seats:180, activeSeats:102, health:71, status:"at_risk",  region:"ap-south",  mrr:3800, admin:"it@globallog.com",    created:"2025-06-08", storage:"3.1GB", apiCalls:72100 },
  { id:"t6", name:"MediCare Plus",  domain:"medicareplus.io",plan:"scale",      seats:60,  activeSeats:0,   health:0,  status:"suspended",region:"eu-west",   mrr:0,    admin:"admin@medicareplus.io",created:"2025-09-01", storage:"0.9GB", apiCalls:0 },
  { id:"t7", name:"RetailChain Co", domain:"retailchain.com",plan:"enterprise", seats:320, activeSeats:289, health:96, status:"active",   region:"us-east",   mrr:6400, admin:"hr@retailchain.com",  created:"2024-08-30", storage:"7.8GB", apiCalls:256000 },
];

const PLAN_COLORS = { starter:"#64748b", growth:"#6366f1", scale:"#0ea5e9", enterprise:"#f59e0b" };
const STATUS_COLORS = { active:"#10b981", at_risk:"#f59e0b", suspended:"#ef4444", trial:"#8b5cf6" };
const REGIONS = ["all","us-east","us-west","eu-west","ap-south"];

export function MultiTenantManager({ profile, cs, lang, onClose }) {
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("mrr");
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [tab, setTab] = useState("tenants");
  const [actionLog, setActionLog] = useState([
    { id:1, ts:"2026-06-02 08:14", tenant:"Acme Corp",    action:"Seat limit increased 200→240",  by:"admin@corvus.com" },
    { id:2, ts:"2026-06-01 17:33", tenant:"MediCare Plus",action:"Tenant suspended (payment fail)",by:"billing-bot" },
    { id:3, ts:"2026-06-01 11:20", tenant:"HealthFirst",  action:"Plan upgraded scale→enterprise", by:"admin@corvus.com" },
    { id:4, ts:"2026-05-31 09:05", tenant:"StartupXYZ",  action:"Trial extended 14 days",         by:"admin@corvus.com" },
  ]);

  const filtered = useMemo(() => {
    return MOCK_TENANTS
      .filter(t => {
        const q = search.toLowerCase();
        return (!q || t.name.toLowerCase().includes(q) || t.domain.includes(q) || t.admin.includes(q))
          && (planFilter === "all" || t.plan === planFilter)
          && (regionFilter === "all" || t.region === regionFilter)
          && (statusFilter === "all" || t.status === statusFilter);
      })
      .sort((a, b) => {
        if (sortBy === "mrr") return b.mrr - a.mrr;
        if (sortBy === "seats") return b.seats - a.seats;
        if (sortBy === "health") return b.health - a.health;
        if (sortBy === "name") return a.name.localeCompare(b.name);
        return 0;
      });
  }, [search, planFilter, regionFilter, statusFilter, sortBy]);

  const totalMRR = MOCK_TENANTS.reduce((s, t) => s + t.mrr, 0);
  const totalSeats = MOCK_TENANTS.reduce((s, t) => s + t.seats, 0);
  const activeCount = MOCK_TENANTS.filter(t => t.status === "active").length;

  const doAction = (tenant, action) => {
    setActionLog(p => [{ id: Date.now(), ts: new Date().toISOString().slice(0,16).replace("T"," "), tenant: tenant.name, action, by: profile?.email || "super-admin" }, ...p]);
  };

  const tabs = [
    { id:"tenants",    label:"Tenants",    icon:"🏢" },
    { id:"overview",   label:"Overview",   icon:"📊" },
    { id:"provision",  label:"Provision",  icon:"➕" },
    { id:"audit",      label:"Action Log", icon:"📋" },
  ];

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:cs.card, borderRadius:20, width:"100%", maxWidth:1140, height:"90vh", display:"flex", flexDirection:"column", overflow:"hidden", border:`1px solid ${cs.border}`, boxShadow:"0 32px 80px rgba(0,0,0,0.5)" }}>

        {/* Header */}
        <div style={{ padding:"20px 28px 0", borderBottom:`1px solid ${cs.border}`, background:"linear-gradient(135deg,rgba(245,158,11,0.07),rgba(16,185,129,0.04))" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:44, height:44, borderRadius:12, background:"linear-gradient(135deg,#f59e0b,#10b981)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>🏢</div>
              <div>
                <div style={{ fontWeight:800, fontSize:20, color:cs.text }}>Multi-Tenant Manager</div>
                <div style={{ fontSize:12, color:cs.textDim }}>Super-admin control for all organizations</div>
              </div>
            </div>
            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              {[
                { label:"Total MRR", value:`$${(totalMRR/1000).toFixed(1)}K`, color:"#f59e0b" },
                { label:"Organizations", value:MOCK_TENANTS.length, color:"#10b981" },
                { label:"Total Seats", value:totalSeats, color:"#0ea5e9" },
              ].map(m => (
                <div key={m.label} style={{ textAlign:"center", padding:"6px 14px", background:"rgba(255,255,255,0.04)", borderRadius:10 }}>
                  <div style={{ fontSize:17, fontWeight:800, color:m.color }}>{m.value}</div>
                  <div style={{ fontSize:10, color:cs.textDim }}>{m.label}</div>
                </div>
              ))}
              <button onClick={onClose} style={{ background:"rgba(255,255,255,0.07)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:10, padding:"8px 14px", cursor:"pointer", fontSize:13 }}>✕</button>
            </div>
          </div>
          <div style={{ display:"flex", gap:4 }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ background:tab===t.id?"rgba(245,158,11,0.12)":"transparent", border:"none", color:tab===t.id?"#f59e0b":cs.textDim, padding:"8px 14px", cursor:"pointer", borderRadius:"8px 8px 0 0", fontWeight:tab===t.id?700:500, fontSize:13, borderBottom:tab===t.id?"2px solid #f59e0b":"2px solid transparent" }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex:1, overflow:"hidden", display:"flex" }}>

          {/* ── TENANTS TABLE ── */}
          {tab==="tenants" && (
            <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
              {/* Filters */}
              <div style={{ display:"flex", gap:8, padding:"14px 20px", borderBottom:`1px solid ${cs.border}`, flexWrap:"wrap" }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search name, domain, admin…" style={{ flex:1, minWidth:200, background:"rgba(255,255,255,0.05)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:9, padding:"7px 12px", fontSize:13, outline:"none" }} />
                {[
                  { label:"Plan", value:planFilter, set:setPlanFilter, opts:["all","starter","growth","scale","enterprise"] },
                  { label:"Status", value:statusFilter, set:setStatusFilter, opts:["all","active","at_risk","suspended","trial"] },
                  { label:"Region", value:regionFilter, set:setRegionFilter, opts:REGIONS },
                  { label:"Sort", value:sortBy, set:setSortBy, opts:["mrr","seats","health","name"] },
                ].map(f => (
                  <select key={f.label} value={f.value} onChange={e => f.set(e.target.value)} style={{ background:"rgba(255,255,255,0.05)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:9, padding:"7px 11px", fontSize:12, outline:"none", cursor:"pointer" }}>
                    {f.opts.map(o => <option key={o} value={o} style={{ background:"#1e293b" }}>{f.label}: {o}</option>)}
                  </select>
                ))}
              </div>

              {/* Table */}
              <div style={{ flex:1, overflowY:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                  <thead>
                    <tr style={{ background:"rgba(255,255,255,0.03)", position:"sticky", top:0 }}>
                      {["Organization","Plan","Status","Seats","Health","MRR","Region","Actions"].map(h => (
                        <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontWeight:600, color:cs.textDim, fontSize:11, borderBottom:`1px solid ${cs.border}`, whiteSpace:"nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(t => (
                      <tr key={t.id} onClick={() => setSelectedTenant(t)} style={{ borderBottom:`1px solid ${cs.border}`, cursor:"pointer", background:selectedTenant?.id===t.id?"rgba(245,158,11,0.06)":"transparent", transition:"background .1s" }}>
                        <td style={{ padding:"12px 14px" }}>
                          <div style={{ fontWeight:700, color:cs.text }}>{t.name}</div>
                          <div style={{ fontSize:11, color:cs.textDim }}>{t.domain} · {t.admin}</div>
                        </td>
                        <td style={{ padding:"12px 14px" }}>
                          <span style={{ fontSize:11, fontWeight:700, padding:"3px 9px", borderRadius:20, background:`${PLAN_COLORS[t.plan]}22`, color:PLAN_COLORS[t.plan] }}>{t.plan}</span>
                        </td>
                        <td style={{ padding:"12px 14px" }}>
                          <span style={{ fontSize:11, fontWeight:700, padding:"3px 9px", borderRadius:20, background:`${STATUS_COLORS[t.status]}18`, color:STATUS_COLORS[t.status] }}>{t.status.replace("_"," ")}</span>
                        </td>
                        <td style={{ padding:"12px 14px", color:cs.text }}>
                          <div>{t.activeSeats}/{t.seats}</div>
                          <div style={{ height:4, background:"rgba(255,255,255,0.08)", borderRadius:2, marginTop:4, width:60 }}>
                            <div style={{ height:"100%", borderRadius:2, background:t.activeSeats/t.seats>0.8?"#10b981":"#f59e0b", width:`${(t.activeSeats/t.seats)*100}%` }} />
                          </div>
                        </td>
                        <td style={{ padding:"12px 14px" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                            <div style={{ fontSize:14, fontWeight:700, color:t.health>90?"#10b981":t.health>70?"#f59e0b":"#ef4444" }}>{t.health}%</div>
                          </div>
                        </td>
                        <td style={{ padding:"12px 14px", fontWeight:700, color:cs.text }}>${t.mrr.toLocaleString()}</td>
                        <td style={{ padding:"12px 14px", color:cs.textDim, fontSize:11 }}>{t.region}</td>
                        <td style={{ padding:"12px 14px" }}>
                          <div style={{ display:"flex", gap:4 }}>
                            <button onClick={e => { e.stopPropagation(); setSelectedTenant(t); }} style={{ background:"transparent", border:`1px solid ${cs.border}`, color:cs.textDim, borderRadius:6, padding:"4px 9px", cursor:"pointer", fontSize:11 }}>View</button>
                            {t.status==="active" ? (
                              <button onClick={e => { e.stopPropagation(); doAction(t,"Tenant suspended"); }} style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.25)", color:"#ef4444", borderRadius:6, padding:"4px 9px", cursor:"pointer", fontSize:11 }}>Suspend</button>
                            ) : (
                              <button onClick={e => { e.stopPropagation(); doAction(t,"Tenant reactivated"); }} style={{ background:"rgba(16,185,129,0.08)", border:"1px solid rgba(16,185,129,0.25)", color:"#10b981", borderRadius:6, padding:"4px 9px", cursor:"pointer", fontSize:11 }}>Activate</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── OVERVIEW ── */}
          {tab==="overview" && (
            <div style={{ flex:1, overflowY:"auto", padding:24 }}>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:12, marginBottom:20 }}>
                {[
                  { label:"Monthly Revenue",  value:`$${totalMRR.toLocaleString()}`, icon:"💰", color:"#f59e0b" },
                  { label:"Active Orgs",       value:activeCount, icon:"✅", color:"#10b981" },
                  { label:"At Risk",           value:MOCK_TENANTS.filter(t=>t.status==="at_risk").length, icon:"⚠️", color:"#f59e0b" },
                  { label:"Suspended",         value:MOCK_TENANTS.filter(t=>t.status==="suspended").length, icon:"🚫", color:"#ef4444" },
                  { label:"Total API Calls",   value:`${(MOCK_TENANTS.reduce((s,t)=>s+t.apiCalls,0)/1000).toFixed(0)}K`, icon:"📡", color:"#0ea5e9" },
                  { label:"Total Storage",     value:"29.5GB", icon:"💾", color:"#8b5cf6" },
                ].map(m => (
                  <div key={m.label} style={{ background:cs.bg, borderRadius:14, padding:16, border:`1px solid ${cs.border}` }}>
                    <div style={{ fontSize:24 }}>{m.icon}</div>
                    <div style={{ fontSize:22, fontWeight:800, color:m.color, marginTop:8 }}>{m.value}</div>
                    <div style={{ fontSize:12, color:cs.textDim }}>{m.label}</div>
                  </div>
                ))}
              </div>

              {/* Plan breakdown */}
              <div style={{ background:cs.bg, borderRadius:14, padding:20, border:`1px solid ${cs.border}`, marginBottom:16 }}>
                <div style={{ fontWeight:700, color:cs.text, marginBottom:14, fontSize:15 }}>Plan Distribution</div>
                {["enterprise","scale","growth","starter"].map(plan => {
                  const count = MOCK_TENANTS.filter(t => t.plan===plan).length;
                  const pct = Math.round((count/MOCK_TENANTS.length)*100);
                  return (
                    <div key={plan} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                      <div style={{ width:90, fontSize:12, fontWeight:600, color:PLAN_COLORS[plan], textTransform:"capitalize" }}>{plan}</div>
                      <div style={{ flex:1, height:10, background:"rgba(255,255,255,0.06)", borderRadius:5, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${pct}%`, background:PLAN_COLORS[plan], borderRadius:5 }} />
                      </div>
                      <div style={{ width:40, fontSize:12, color:cs.textDim, textAlign:"right" }}>{count} org{count!==1?"s":""}</div>
                    </div>
                  );
                })}
              </div>

              {/* Health warnings */}
              <div style={{ background:cs.bg, borderRadius:14, padding:20, border:`1px solid ${cs.border}` }}>
                <div style={{ fontWeight:700, color:cs.text, marginBottom:14, fontSize:15 }}>⚠️ Needs Attention</div>
                {MOCK_TENANTS.filter(t => t.health < 80 || t.status !== "active").map(t => (
                  <div key={t.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:`1px solid ${cs.border}` }}>
                    <div>
                      <div style={{ fontWeight:700, color:cs.text, fontSize:13 }}>{t.name}</div>
                      <div style={{ fontSize:11, color:cs.textDim }}>{t.domain} · {t.status.replace("_"," ")}</div>
                    </div>
                    <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                      <span style={{ fontSize:12, fontWeight:700, color:STATUS_COLORS[t.status] }}>{t.health}% health</span>
                      <button onClick={() => { setTab("tenants"); setSelectedTenant(t); }} style={{ background:"transparent", border:`1px solid ${cs.border}`, color:cs.textDim, borderRadius:7, padding:"4px 11px", cursor:"pointer", fontSize:11 }}>View</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── PROVISION ── */}
          {tab==="provision" && (
            <div style={{ flex:1, overflowY:"auto", padding:24, maxWidth:600 }}>
              <div style={{ fontWeight:700, color:cs.text, fontSize:16, marginBottom:20 }}>➕ Provision New Tenant</div>
              {[
                { label:"Organization Name *", placeholder:"Acme Corp" },
                { label:"Primary Domain *",    placeholder:"acme.com" },
                { label:"Admin Email *",       placeholder:"admin@acme.com" },
                { label:"Phone / Contact",     placeholder:"+1 555 000 0000" },
              ].map(f => (
                <div key={f.label} style={{ marginBottom:14 }}>
                  <label style={{ fontSize:12, fontWeight:600, color:cs.textDim, display:"block", marginBottom:5 }}>{f.label}</label>
                  <input placeholder={f.placeholder} style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:9, padding:"9px 13px", fontSize:13, outline:"none", boxSizing:"border-box" }} />
                </div>
              ))}

              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:12, fontWeight:600, color:cs.textDim, display:"block", marginBottom:5 }}>Plan</label>
                <select style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:9, padding:"9px 13px", fontSize:13, outline:"none" }}>
                  {["starter","growth","scale","enterprise"].map(p => <option key={p} value={p} style={{ background:"#1e293b", textTransform:"capitalize" }}>{p}</option>)}
                </select>
              </div>

              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:12, fontWeight:600, color:cs.textDim, display:"block", marginBottom:5 }}>Seats Limit</label>
                <input type="number" defaultValue={50} style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:9, padding:"9px 13px", fontSize:13, outline:"none", boxSizing:"border-box" }} />
              </div>

              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:12, fontWeight:600, color:cs.textDim, display:"block", marginBottom:5 }}>Region</label>
                <select style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:9, padding:"9px 13px", fontSize:13, outline:"none" }}>
                  {["us-east","us-west","eu-west","ap-south"].map(r => <option key={r} value={r} style={{ background:"#1e293b" }}>{r}</option>)}
                </select>
              </div>

              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:12, fontWeight:600, color:cs.textDim, display:"block", marginBottom:5 }}>White-label Domain (optional)</label>
                <input placeholder="app.acmecorp.com" style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:9, padding:"9px 13px", fontSize:13, outline:"none", boxSizing:"border-box" }} />
              </div>

              <div style={{ marginBottom:20 }}>
                <label style={{ fontSize:12, fontWeight:600, color:cs.textDim, display:"block", marginBottom:5 }}>Trial Period (days, 0 = no trial)</label>
                <input type="number" defaultValue={14} style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:9, padding:"9px 13px", fontSize:13, outline:"none", boxSizing:"border-box" }} />
              </div>

              <button style={{ background:"linear-gradient(135deg,#f59e0b,#10b981)", border:"none", color:"#fff", borderRadius:12, padding:"12px 28px", cursor:"pointer", fontWeight:800, fontSize:14 }}>
                🚀 Provision Tenant
              </button>

              <div style={{ marginTop:16, padding:14, background:"rgba(16,185,129,0.06)", border:"1px solid rgba(16,185,129,0.2)", borderRadius:10, fontSize:12, color:cs.textDim, lineHeight:1.7 }}>
                Provisioning will: create Firestore org, send admin welcome email, configure SSO domain allowlist, initialize billing in Stripe, and set up isolated data namespace.
              </div>
            </div>
          )}

          {/* ── ACTION LOG ── */}
          {tab==="audit" && (
            <div style={{ flex:1, overflowY:"auto", padding:24 }}>
              <div style={{ fontWeight:700, color:cs.text, fontSize:16, marginBottom:16 }}>📋 Super-Admin Action Log</div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {actionLog.map(log => (
                  <div key={log.id} style={{ background:cs.bg, borderRadius:10, padding:"12px 16px", border:`1px solid ${cs.border}`, display:"flex", gap:14, alignItems:"flex-start" }}>
                    <div style={{ fontSize:10, color:cs.textDim, whiteSpace:"nowrap", marginTop:2, fontFamily:"monospace" }}>{log.ts}</div>
                    <div style={{ flex:1 }}>
                      <span style={{ fontWeight:700, color:"#f59e0b" }}>{log.tenant}</span>
                      <span style={{ color:cs.textDim }}> — </span>
                      <span style={{ color:cs.text, fontSize:13 }}>{log.action}</span>
                    </div>
                    <div style={{ fontSize:11, color:cs.textDim, whiteSpace:"nowrap" }}>by {log.by}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TENANT DETAIL PANEL ── */}
          {selectedTenant && tab==="tenants" && (
            <div style={{ width:340, borderLeft:`1px solid ${cs.border}`, padding:20, overflowY:"auto", background:"rgba(0,0,0,0.15)" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                <div style={{ fontWeight:700, color:cs.text, fontSize:15 }}>{selectedTenant.name}</div>
                <button onClick={() => setSelectedTenant(null)} style={{ background:"transparent", border:"none", color:cs.textDim, cursor:"pointer", fontSize:18 }}>✕</button>
              </div>

              {[
                ["Domain",   selectedTenant.domain],
                ["Admin",    selectedTenant.admin],
                ["Plan",     selectedTenant.plan],
                ["Region",   selectedTenant.region],
                ["Created",  selectedTenant.created],
                ["Storage",  selectedTenant.storage],
                ["API Calls",selectedTenant.apiCalls.toLocaleString()],
                ["MRR",      `$${selectedTenant.mrr.toLocaleString()}`],
              ].map(([k,v]) => (
                <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${cs.border}`, fontSize:13 }}>
                  <span style={{ color:cs.textDim }}>{k}</span>
                  <span style={{ color:cs.text, fontWeight:600 }}>{v}</span>
                </div>
              ))}

              <div style={{ margin:"16px 0 10px", fontWeight:700, color:cs.text, fontSize:13 }}>Seat Usage</div>
              <div style={{ height:8, background:"rgba(255,255,255,0.08)", borderRadius:4, marginBottom:6 }}>
                <div style={{ height:"100%", borderRadius:4, background: selectedTenant.activeSeats/selectedTenant.seats>0.8?"#10b981":"#f59e0b", width:`${Math.min(100,(selectedTenant.activeSeats/selectedTenant.seats)*100)}%` }} />
              </div>
              <div style={{ fontSize:12, color:cs.textDim }}>{selectedTenant.activeSeats} of {selectedTenant.seats} seats active</div>

              <div style={{ margin:"16px 0 10px", fontWeight:700, color:cs.text, fontSize:13 }}>Actions</div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {[
                  { label:"📧 Email Admin",  action:"Admin emailed" },
                  { label:"🔑 Reset SSO",    action:"SSO reset triggered" },
                  { label:"💺 Add Seats",    action:"Seat limit +10" },
                  { label:"⏱ Extend Trial", action:"Trial extended 7 days" },
                  { label:"📊 Export Data", action:"Data export requested" },
                  { label:"🗑 Delete Org",  action:"Org deletion initiated", danger:true },
                ].map(a => (
                  <button key={a.label} onClick={() => doAction(selectedTenant, a.action)} style={{ background:a.danger?"rgba(239,68,68,0.08)":"rgba(255,255,255,0.04)", border:`1px solid ${a.danger?"rgba(239,68,68,0.3)":cs.border}`, color:a.danger?"#ef4444":cs.text, borderRadius:8, padding:"8px 12px", cursor:"pointer", fontSize:12, fontWeight:600, textAlign:"left" }}>
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
