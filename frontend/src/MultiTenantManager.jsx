/**
 * MultiTenantManager.jsx — Corvus
 * Manage all tenants/organizations from one super-admin panel
 *
 * Wired to the real backend 2026-07-25. Previously this was 100% mock
 * data (MOCK_TENANTS, a fake action log, a Provision button with no
 * onClick at all). The backend already had POST/PATCH /api/admin/tenants
 * for provisioning and editing, but no GET — nothing could ever list
 * tenants back, so this screen had nothing real to render. Added the
 * missing list endpoint and wired everything here to it.
 *
 * Honesty note: seat activity, health score, storage, and API-call
 * volume per tenant have no real data source anywhere in the backend —
 * rather than invent numbers, those columns/fields are left out
 * entirely. Suspend/Activate, Add Seats, and Extend Trial call the
 * real PATCH endpoint. Email Admin / Reset SSO / Export Data / Delete
 * Org have no backend implementation yet, so they're shown disabled
 * with a note instead of silently doing nothing.
 */
import { useState, useMemo, useEffect } from "react";
import { apiFetch } from "./services/api.js";
import { useBodyScrollLock } from "./lib/useBodyScrollLock.js";

const PLAN_COLORS = { starter:"#64748b", growth:"#6366f1", scale:"#0ea5e9", enterprise:"#f59e0b" };
const STATUS_COLORS = { active:"#10b981", at_risk:"#f59e0b", suspended:"#ef4444", trial:"#8b5cf6" };
const REGIONS = ["all","us-east","us-west","eu-west","ap-south"];
const NOT_WIRED = ["Email Admin","Reset SSO","Export Data","Delete Org"];

export function MultiTenantManager({ profile, cs, lang, onClose }) {
  useBodyScrollLock();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("mrr");
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [tab, setTab] = useState("tenants");
  const [actionLog, setActionLog] = useState([]);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({ name:"", domain:"", admin_email:"", plan:"growth", seats:50, region:"us-east", white_label_domain:"", trial_days:14 });
  const [provisionError, setProvisionError] = useState("");
  const [provisionOk, setProvisionOk] = useState(false);

  const loadTenants = () => {
    setLoading(true); setLoadError("");
    apiFetch("/admin/tenants", { method:"GET" })
      .then(r => setTenants(r.tenants||[]))
      .catch(e => setLoadError(e?.message || "Couldn't load tenants"))
      .finally(() => setLoading(false));
  };
  useEffect(() => { loadTenants(); }, []);

  const filtered = useMemo(() => {
    return tenants
      .filter(t => {
        const q = search.toLowerCase();
        return (!q || (t.name||"").toLowerCase().includes(q) || (t.domain||"").includes(q) || (t.admin_email||"").includes(q))
          && (planFilter === "all" || t.plan === planFilter)
          && (regionFilter === "all" || t.region === regionFilter)
          && (statusFilter === "all" || t.status === statusFilter);
      })
      .sort((a, b) => {
        if (sortBy === "mrr") return (b.mrr||0) - (a.mrr||0);
        if (sortBy === "seats") return (b.seats||0) - (a.seats||0);
        if (sortBy === "name") return (a.name||"").localeCompare(b.name||"");
        return 0;
      });
  }, [tenants, search, planFilter, regionFilter, statusFilter, sortBy]);

  const totalMRR = tenants.reduce((s, t) => s + (t.mrr||0), 0);
  const totalSeats = tenants.reduce((s, t) => s + (t.seats||0), 0);
  const activeCount = tenants.filter(t => t.status === "active").length;

  const logAction = (tenant, action) => {
    setActionLog(p => [{ id: Date.now(), ts: new Date().toISOString().slice(0,16).replace("T"," "), tenant: tenant.name, action, by: profile?.email || "super-admin" }, ...p]);
  };

  const patchTenant = async (tenant, patch, actionLabel) => {
    setBusy(true);
    try {
      await apiFetch(`/admin/tenants/${tenant.org_id}`, { method:"PATCH", body:patch });
      setTenants(prev => prev.map(t => t.org_id===tenant.org_id ? { ...t, ...patch } : t));
      logAction(tenant, actionLabel);
    } catch(e) {
      logAction(tenant, `Failed: ${actionLabel} (${e?.message||"error"})`);
    }
    setBusy(false);
  };

  const submitProvision = async () => {
    setProvisionError(""); setProvisionOk(false);
    if (!form.name || !form.domain || !form.admin_email) { setProvisionError("Name, domain, and admin email are required"); return; }
    setBusy(true);
    try {
      await apiFetch("/admin/tenants", { method:"POST", body:{
        name:form.name, domain:form.domain, admin_email:form.admin_email,
        plan:form.plan, seats:Number(form.seats)||50, region:form.region,
        white_label_domain:form.white_label_domain, trial_days:Number(form.trial_days)||0,
      }});
      setProvisionOk(true);
      setForm({ name:"", domain:"", admin_email:"", plan:"growth", seats:50, region:"us-east", white_label_domain:"", trial_days:14 });
      loadTenants();
      setTimeout(()=>setProvisionOk(false), 3000);
    } catch(e) { setProvisionError(e?.message || "Couldn't provision tenant"); }
    setBusy(false);
  };

  const tabs = [
    { id:"tenants",    label:"Tenants",    icon:"🏢" },
    { id:"overview",   label:"Overview",   icon:"📊" },
    { id:"provision",  label:"Provision",  icon:"➕" },
    { id:"audit",      label:"Action Log", icon:"📋" },
  ];

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:cs.card, borderRadius:20, width:"100%", maxWidth:1140, height:"90dvh", display:"flex", flexDirection:"column", overflow:"hidden", border:`1px solid ${cs.border}`, boxShadow:"0 32px 80px rgba(0,0,0,0.5)" }}>

        {/* Header */}
        <div style={{ padding:"20px 28px 0", borderBottom:`1px solid ${cs.border}`, background:"linear-gradient(135deg,rgba(245,158,11,0.07),rgba(16,185,129,0.04))" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:44, height:44, borderRadius:12, background:"linear-gradient(135deg,#f59e0b,#10b981)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>🏢</div>
              <div>
                <div style={{ fontWeight:800, fontSize:20, color:cs.text }}>Multi-Tenant Manager</div>
                <div style={{ fontSize:12, color:cs.muted }}>Super-admin control for all organizations</div>
              </div>
            </div>
            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              {[
                { label:"Total MRR", value:`$${(totalMRR/1000).toFixed(1)}K`, color:"#f59e0b" },
                { label:"Organizations", value:tenants.length, color:"#10b981" },
                { label:"Total Seats", value:totalSeats, color:"#0ea5e9" },
              ].map(m => (
                <div key={m.label} style={{ textAlign:"center", padding:"6px 14px", background:"rgba(255,255,255,0.04)", borderRadius:10 }}>
                  <div style={{ fontSize:17, fontWeight:800, color:m.color }}>{m.value}</div>
                  <div style={{ fontSize:10, color:cs.muted }}>{m.label}</div>
                </div>
              ))}
              <button onClick={onClose} style={{ background:"rgba(255,255,255,0.07)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:10, padding:"8px 14px", cursor:"pointer", fontSize:13 }} aria-label="Close">✕</button>
            </div>
          </div>
          <div style={{ display:"flex", gap:4 }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ background:tab===t.id?"rgba(245,158,11,0.12)":"transparent", border:"none", color:tab===t.id?"#f59e0b":cs.muted, padding:"8px 14px", cursor:"pointer", borderRadius:"8px 8px 0 0", fontWeight:tab===t.id?700:500, fontSize:13, borderBottom:tab===t.id?"2px solid #f59e0b":"2px solid transparent" }}>
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
              <div style={{ display:"flex", gap:8, padding:"14px 20px", borderBottom:`1px solid ${cs.border}`, flexWrap:"wrap" }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search name, domain, admin…" style={{ flex:1, minWidth:200, background:"rgba(255,255,255,0.05)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:9, padding:"7px 12px", fontSize:13, outline:"none" }} />
                {[
                  { label:"Plan", value:planFilter, set:setPlanFilter, opts:["all","starter","growth","scale","enterprise"] },
                  { label:"Status", value:statusFilter, set:setStatusFilter, opts:["all","active","at_risk","suspended","trial"] },
                  { label:"Region", value:regionFilter, set:setRegionFilter, opts:REGIONS },
                  { label:"Sort", value:sortBy, set:setSortBy, opts:["mrr","seats","name"] },
                ].map(f => (
                  <select key={f.label} value={f.value} onChange={e => f.set(e.target.value)} style={{ background:"rgba(255,255,255,0.05)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:9, padding:"7px 11px", fontSize:12, outline:"none", cursor:"pointer" }}>
                    {f.opts.map(o => <option key={o} value={o} style={{ background:"#1e293b" }}>{f.label}: {o}</option>)}
                  </select>
                ))}
              </div>

              <div style={{ flex:1, overflowY:"auto" }}>
                {loading && <div style={{ padding:24, textAlign:"center", fontSize:12, color:cs.muted }}>Loading…</div>}
                {!loading && loadError && <div style={{ padding:24, textAlign:"center", fontSize:12, color:"#ef4444" }}>{loadError}</div>}
                {!loading && !loadError && filtered.length===0 && <div style={{ padding:24, textAlign:"center", fontSize:12, color:cs.muted }}>No organizations yet — provision one to get started</div>}
                {!loading && !loadError && filtered.length>0 && (
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                  <thead>
                    <tr style={{ background:"rgba(255,255,255,0.03)", position:"sticky", top:0 }}>
                      {["Organization","Plan","Status","Seats","MRR","Region","Actions"].map(h => (
                        <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontWeight:600, color:cs.muted, fontSize:11, borderBottom:`1px solid ${cs.border}`, whiteSpace:"nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(t => (
                      <tr key={t.org_id} onClick={() => setSelectedTenant(t)} style={{ borderBottom:`1px solid ${cs.border}`, cursor:"pointer", background:selectedTenant?.org_id===t.org_id?"rgba(245,158,11,0.06)":"transparent", transition:"background .1s" }}>
                        <td style={{ padding:"12px 14px" }}>
                          <div style={{ fontWeight:700, color:cs.text }}>{t.name}</div>
                          <div style={{ fontSize:11, color:cs.muted }}>{t.domain} · {t.admin_email}</div>
                        </td>
                        <td style={{ padding:"12px 14px" }}>
                          <span style={{ fontSize:11, fontWeight:700, padding:"3px 9px", borderRadius:20, background:`${PLAN_COLORS[t.plan]||cs.border}22`, color:PLAN_COLORS[t.plan]||cs.muted }}>{t.plan}</span>
                        </td>
                        <td style={{ padding:"12px 14px" }}>
                          <span style={{ fontSize:11, fontWeight:700, padding:"3px 9px", borderRadius:20, background:`${STATUS_COLORS[t.status]||cs.border}18`, color:STATUS_COLORS[t.status]||cs.muted }}>{(t.status||"").replace("_"," ")}</span>
                        </td>
                        <td style={{ padding:"12px 14px", color:cs.text }}>{t.seats}</td>
                        <td style={{ padding:"12px 14px", fontWeight:700, color:cs.text }}>${(t.mrr||0).toLocaleString()}</td>
                        <td style={{ padding:"12px 14px", color:cs.muted, fontSize:11 }}>{t.region}</td>
                        <td style={{ padding:"12px 14px" }}>
                          <div style={{ display:"flex", gap:4 }}>
                            <button onClick={e => { e.stopPropagation(); setSelectedTenant(t); }} style={{ background:"transparent", border:`1px solid ${cs.border}`, color:cs.muted, borderRadius:6, padding:"4px 9px", cursor:"pointer", fontSize:11 }}>View</button>
                            {t.status==="active" ? (
                              <button onClick={e => { e.stopPropagation(); patchTenant(t,{status:"suspended"},"Tenant suspended"); }} disabled={busy} style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.25)", color:"#ef4444", borderRadius:6, padding:"4px 9px", cursor:"pointer", fontSize:11 }}>Suspend</button>
                            ) : (
                              <button onClick={e => { e.stopPropagation(); patchTenant(t,{status:"active"},"Tenant reactivated"); }} disabled={busy} style={{ background:"rgba(16,185,129,0.08)", border:"1px solid rgba(16,185,129,0.25)", color:"#10b981", borderRadius:6, padding:"4px 9px", cursor:"pointer", fontSize:11 }}>Activate</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                )}
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
                  { label:"At Risk",           value:tenants.filter(t=>t.status==="at_risk").length, icon:"⚠️", color:"#f59e0b" },
                  { label:"Suspended",         value:tenants.filter(t=>t.status==="suspended").length, icon:"🚫", color:"#ef4444" },
                ].map(m => (
                  <div key={m.label} style={{ background:cs.bg, borderRadius:14, padding:16, border:`1px solid ${cs.border}` }}>
                    <div style={{ fontSize:24 }}>{m.icon}</div>
                    <div style={{ fontSize:22, fontWeight:800, color:m.color, marginTop:8 }}>{m.value}</div>
                    <div style={{ fontSize:12, color:cs.muted }}>{m.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ background:cs.bg, borderRadius:14, padding:20, border:`1px solid ${cs.border}`, marginBottom:16 }}>
                <div style={{ fontWeight:700, color:cs.text, marginBottom:14, fontSize:15 }}>Plan Distribution</div>
                {["enterprise","scale","growth","starter"].map(plan => {
                  const count = tenants.filter(t => t.plan===plan).length;
                  const pct = tenants.length ? Math.round((count/tenants.length)*100) : 0;
                  return (
                    <div key={plan} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                      <div style={{ width:90, fontSize:12, fontWeight:600, color:PLAN_COLORS[plan], textTransform:"capitalize" }}>{plan}</div>
                      <div style={{ flex:1, height:10, background:"rgba(255,255,255,0.06)", borderRadius:5, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${pct}%`, background:PLAN_COLORS[plan], borderRadius:5 }} />
                      </div>
                      <div style={{ width:40, fontSize:12, color:cs.muted, textAlign:"right" }}>{count} org{count!==1?"s":""}</div>
                    </div>
                  );
                })}
              </div>

              <div style={{ background:cs.bg, borderRadius:14, padding:20, border:`1px solid ${cs.border}` }}>
                <div style={{ fontWeight:700, color:cs.text, marginBottom:14, fontSize:15 }}>⚠️ Needs Attention</div>
                {tenants.filter(t => t.status !== "active").length===0 && <div style={{ fontSize:12, color:cs.muted }}>Nothing needs attention right now</div>}
                {tenants.filter(t => t.status !== "active").map(t => (
                  <div key={t.org_id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:`1px solid ${cs.border}` }}>
                    <div>
                      <div style={{ fontWeight:700, color:cs.text, fontSize:13 }}>{t.name}</div>
                      <div style={{ fontSize:11, color:cs.muted }}>{t.domain} · {(t.status||"").replace("_"," ")}</div>
                    </div>
                    <button onClick={() => { setTab("tenants"); setSelectedTenant(t); }} style={{ background:"transparent", border:`1px solid ${cs.border}`, color:cs.muted, borderRadius:7, padding:"4px 11px", cursor:"pointer", fontSize:11 }}>View</button>
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
                { key:"name",        label:"Organization Name *", placeholder:"Acme Corp" },
                { key:"domain",      label:"Primary Domain *",    placeholder:"acme.com" },
                { key:"admin_email", label:"Admin Email *",       placeholder:"admin@acme.com" },
              ].map(f => (
                <div key={f.key} style={{ marginBottom:14 }}>
                  <label style={{ fontSize:12, fontWeight:600, color:cs.muted, display:"block", marginBottom:5 }}>{f.label}</label>
                  <input value={form[f.key]} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))} placeholder={f.placeholder} style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:9, padding:"9px 13px", fontSize:13, outline:"none", boxSizing:"border-box" }} />
                </div>
              ))}

              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:12, fontWeight:600, color:cs.muted, display:"block", marginBottom:5 }}>Plan</label>
                <select value={form.plan} onChange={e=>setForm(p=>({...p,plan:e.target.value}))} style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:9, padding:"9px 13px", fontSize:13, outline:"none" }}>
                  {["starter","growth","scale","enterprise"].map(p => <option key={p} value={p} style={{ background:"#1e293b", textTransform:"capitalize" }}>{p}</option>)}
                </select>
              </div>

              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:12, fontWeight:600, color:cs.muted, display:"block", marginBottom:5 }}>Seats Limit</label>
                <input type="number" value={form.seats} onChange={e=>setForm(p=>({...p,seats:e.target.value}))} style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:9, padding:"9px 13px", fontSize:13, outline:"none", boxSizing:"border-box" }} />
              </div>

              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:12, fontWeight:600, color:cs.muted, display:"block", marginBottom:5 }}>Region</label>
                <select value={form.region} onChange={e=>setForm(p=>({...p,region:e.target.value}))} style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:9, padding:"9px 13px", fontSize:13, outline:"none" }}>
                  {["us-east","us-west","eu-west","ap-south"].map(r => <option key={r} value={r} style={{ background:"#1e293b" }}>{r}</option>)}
                </select>
              </div>

              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:12, fontWeight:600, color:cs.muted, display:"block", marginBottom:5 }}>White-label Domain (optional)</label>
                <input value={form.white_label_domain} onChange={e=>setForm(p=>({...p,white_label_domain:e.target.value}))} placeholder="app.acmecorp.com" style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:9, padding:"9px 13px", fontSize:13, outline:"none", boxSizing:"border-box" }} />
              </div>

              <div style={{ marginBottom:20 }}>
                <label style={{ fontSize:12, fontWeight:600, color:cs.muted, display:"block", marginBottom:5 }}>Trial Period (days, 0 = no trial)</label>
                <input type="number" value={form.trial_days} onChange={e=>setForm(p=>({...p,trial_days:e.target.value}))} style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:9, padding:"9px 13px", fontSize:13, outline:"none", boxSizing:"border-box" }} />
              </div>

              {provisionError && <div style={{ color:"#ef4444", fontSize:12, marginBottom:12 }}>{provisionError}</div>}
              <button onClick={submitProvision} disabled={busy} style={{ background:provisionOk?"#10b981":"linear-gradient(135deg,#f59e0b,#10b981)", border:"none", color:"#fff", borderRadius:12, padding:"12px 28px", cursor:"pointer", fontWeight:800, fontSize:14 }}>
                {provisionOk ? "✓ Provisioned!" : busy ? "Provisioning…" : "🚀 Provision Tenant"}
              </button>

              <div style={{ marginTop:16, padding:14, background:"rgba(16,185,129,0.06)", border:"1px solid rgba(16,185,129,0.2)", borderRadius:10, fontSize:12, color:cs.muted, lineHeight:1.7 }}>
                This creates the org record in Firestore and returns its org_id — it does not yet send an admin welcome email, configure SSO, or set up billing automatically.
              </div>
            </div>
          )}

          {/* ── ACTION LOG ── */}
          {tab==="audit" && (
            <div style={{ flex:1, overflowY:"auto", padding:24 }}>
              <div style={{ fontWeight:700, color:cs.text, fontSize:16, marginBottom:16 }}>📋 This Session's Actions</div>
              <div style={{ fontSize:12, color:cs.muted, marginBottom:16 }}>Provision and update calls are also recorded server-side in the admin audit log — this is just a local view of what you've done this session.</div>
              {actionLog.length===0 && <div style={{ fontSize:12, color:cs.muted }}>No actions yet this session</div>}
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {actionLog.map(log => (
                  <div key={log.id} style={{ background:cs.bg, borderRadius:10, padding:"12px 16px", border:`1px solid ${cs.border}`, display:"flex", gap:14, alignItems:"flex-start" }}>
                    <div style={{ fontSize:10, color:cs.muted, whiteSpace:"nowrap", marginTop:2, fontFamily:"monospace" }}>{log.ts}</div>
                    <div style={{ flex:1 }}>
                      <span style={{ fontWeight:700, color:"#f59e0b" }}>{log.tenant}</span>
                      <span style={{ color:cs.muted }}> — </span>
                      <span style={{ color:cs.text, fontSize:13 }}>{log.action}</span>
                    </div>
                    <div style={{ fontSize:11, color:cs.muted, whiteSpace:"nowrap" }}>by {log.by}</div>
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
                <button onClick={() => setSelectedTenant(null)} style={{ background:"transparent", border:"none", color:cs.muted, cursor:"pointer", fontSize:18 }}>✕</button>
              </div>

              {[
                ["Domain",   selectedTenant.domain],
                ["Admin",    selectedTenant.admin_email],
                ["Plan",     selectedTenant.plan],
                ["Region",   selectedTenant.region],
                ["Created",  (selectedTenant.created_at||"").slice(0,10)],
                ["Seats",    selectedTenant.seats],
                ["Trial days", selectedTenant.trial_days ?? "—"],
                ["MRR",      `$${(selectedTenant.mrr||0).toLocaleString()}`],
              ].map(([k,v]) => (
                <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${cs.border}`, fontSize:13 }}>
                  <span style={{ color:cs.muted }}>{k}</span>
                  <span style={{ color:cs.text, fontWeight:600 }}>{v}</span>
                </div>
              ))}

              <div style={{ margin:"16px 0 10px", fontWeight:700, color:cs.text, fontSize:13 }}>Actions</div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                <button onClick={() => patchTenant(selectedTenant, { seats:(selectedTenant.seats||0)+10 }, "Seat limit +10")} disabled={busy} style={{ background:"rgba(255,255,255,0.04)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:8, padding:"8px 12px", cursor:"pointer", fontSize:12, fontWeight:600, textAlign:"left" }}>💺 Add 10 Seats</button>
                <button onClick={() => patchTenant(selectedTenant, { trial_days:(selectedTenant.trial_days||0)+7 }, "Trial extended 7 days")} disabled={busy} style={{ background:"rgba(255,255,255,0.04)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:8, padding:"8px 12px", cursor:"pointer", fontSize:12, fontWeight:600, textAlign:"left" }}>⏱ Extend Trial +7 days</button>
                {NOT_WIRED.map(label => (
                  <button key={label} disabled title="Not implemented yet" style={{ background:"rgba(255,255,255,0.02)", border:`1px dashed ${cs.border}`, color:cs.muted, borderRadius:8, padding:"8px 12px", cursor:"not-allowed", fontSize:12, fontWeight:600, textAlign:"left", opacity:0.6 }}>
                    {label==="Email Admin"?"📧":label==="Reset SSO"?"🔑":label==="Export Data"?"📊":"🗑"} {label} <span style={{fontSize:10}}>— not wired yet</span>
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
