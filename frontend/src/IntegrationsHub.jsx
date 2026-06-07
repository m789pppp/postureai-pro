/**
 * IntegrationsHub.jsx — PostureAI Phase 15
 * Native connectors: Slack, Microsoft Teams, Zapier, Make.com, Google Sheets, Webhooks
 */
import { useState } from "react";

const INTEGRATIONS = [
  {
    id:"slack", name:"Slack", icon:"💬", category:"messaging", status:"available",
    desc:"Send posture alerts, weekly digests, and team leaderboard updates to any Slack channel.",
    features:["Real-time alerts when score drops below threshold","Monday weekly team digest","Monthly leaderboard announcement","@mention on streak milestones"],
    setupSteps:["Connect your Slack workspace","Choose a channel for alerts","Set your score threshold","Choose which events to send"],
    configFields:[
      { key:"channel",   label:"Slack Channel",     placeholder:"#posture-alerts",    type:"text" },
      { key:"threshold", label:"Alert Threshold",   placeholder:"70",                  type:"number" },
      { key:"weekly",    label:"Weekly Digest",      placeholder:"",                    type:"toggle" },
      { key:"leaderboard",label:"Monthly Leaderboard",placeholder:"",                  type:"toggle" },
    ],
    color:"#4A154B", docs:"https://docs.postureai.com/integrations/slack",
  },
  {
    id:"teams", name:"Microsoft Teams", icon:"🟦", category:"messaging", status:"available",
    desc:"Post posture insights and alerts directly to your Microsoft Teams channels.",
    features:["Adaptive card alerts","Weekly health summary","HR compliance reports","Direct messages to at-risk employees"],
    setupSteps:["Add PostureAI app to your Teams","Authenticate with Microsoft","Choose target team and channel","Configure alert rules"],
    configFields:[
      { key:"webhook_url",label:"Teams Webhook URL", placeholder:"https://outlook.office.com/webhook/...", type:"text" },
      { key:"threshold",  label:"Alert Threshold",   placeholder:"70",    type:"number" },
    ],
    color:"#5558AF", docs:"https://docs.postureai.com/integrations/teams",
  },
  {
    id:"zapier", name:"Zapier", icon:"⚡", category:"automation", status:"available",
    desc:"Connect PostureAI to 5,000+ apps. Trigger workflows on posture events without code.",
    features:["Trigger on score drop","New session completed","Alert triggered","Weekly report ready","User joined org"],
    setupSteps:["Search 'PostureAI' on Zapier","Choose a trigger event","Connect your PostureAI account","Build your Zap"],
    configFields:[
      { key:"api_key", label:"API Key", placeholder:"pak_live_...", type:"text" },
    ],
    zapierUrl:"https://zapier.com/apps/postureai",
    color:"#FF4A00", docs:"https://docs.postureai.com/integrations/zapier",
  },
  {
    id:"make", name:"Make.com", icon:"🟣", category:"automation", status:"available",
    desc:"Visual automation scenarios for PostureAI. More powerful than Zapier for complex flows.",
    features:["All Zapier triggers +","Batch data processing","Multi-step scenarios","Data transformation","Error handling"],
    setupSteps:["Install PostureAI module on Make","Add API credentials","Build your scenario"],
    configFields:[
      { key:"api_key", label:"API Key", placeholder:"pak_live_...", type:"text" },
    ],
    makeUrl:"https://make.com/en/integrations/postureai",
    color:"#6D00CC", docs:"https://docs.postureai.com/integrations/make",
  },
  {
    id:"sheets", name:"Google Sheets", icon:"📊", category:"data", status:"available",
    desc:"Auto-export session data to Google Sheets for custom reporting and HR dashboards.",
    features:["Daily session export","Real-time score updates","Team analytics sheet","Custom column mapping"],
    setupSteps:["Connect your Google account","Choose or create a spreadsheet","Map data columns","Set export frequency"],
    configFields:[
      { key:"sheet_id",  label:"Spreadsheet ID",    placeholder:"1BxiM...",      type:"text" },
      { key:"frequency", label:"Export Frequency",  placeholder:"daily",         type:"select", options:["realtime","hourly","daily","weekly"] },
    ],
    color:"#34A853", docs:"https://docs.postureai.com/integrations/sheets",
  },
  {
    id:"hr_systems", name:"HR Systems", icon:"👔", category:"enterprise", status:"enterprise",
    desc:"Sync posture health scores with BambooHR, Workday, and SAP SuccessFactors.",
    features:["Employee wellness metrics","Automated compliance reports","HRIS field mapping","SSO with HR identity provider"],
    setupSteps:["Contact enterprise sales","Provide your HRIS details","Configure field mapping","Test with pilot group"],
    configFields:[
      { key:"hris",       label:"HRIS System",   placeholder:"BambooHR / Workday / SAP", type:"select", options:["BambooHR","Workday","SAP SuccessFactors","ADP","Other"] },
      { key:"api_url",    label:"HRIS API URL",  placeholder:"https://api.bamboohr.com/...", type:"text" },
      { key:"api_key",    label:"HRIS API Key",  placeholder:"•••••",                    type:"password" },
    ],
    color:"#0F4C81", docs:"https://docs.postureai.com/integrations/hr",
  },
  {
    id:"jira", name:"Jira / Linear", icon:"🔵", category:"productivity", status:"beta",
    desc:"Create ergonomics tickets automatically when posture alerts fire repeatedly.",
    features:["Auto-create Jira issues","Tag with employee and team","Link to session data","Close on improvement"],
    configFields:[
      { key:"jira_url", label:"Jira URL",     placeholder:"https://yourorg.atlassian.net", type:"text" },
      { key:"project",  label:"Project Key",  placeholder:"EHS",                           type:"text" },
      { key:"token",    label:"API Token",    placeholder:"•••••",                         type:"password" },
    ],
    color:"#0052CC", docs:"https://docs.postureai.com/integrations/jira",
  },
  {
    id:"webhooks", name:"Custom Webhooks", icon:"🔗", category:"developer", status:"available",
    desc:"Send any PostureAI event to your own endpoint. Full control, JSON payload.",
    features:["15 event types","HMAC signature verification","Retry on failure (3x)","Event payload explorer"],
    configFields:[
      { key:"url",    label:"Endpoint URL",  placeholder:"https://yourapp.com/webhooks/posture", type:"text" },
      { key:"secret", label:"Signing Secret",placeholder:"auto-generated",                        type:"text" },
    ],
    color:"#6366F1", docs:"https://docs.postureai.com/integrations/webhooks",
  },
];

const CAT_LABELS = { messaging:"💬 Messaging", automation:"⚡ Automation", data:"📊 Data", enterprise:"🏢 Enterprise", productivity:"🔵 Productivity", developer:"🔗 Developer" };
const STATUS_COLORS = { available:"#10b981", enterprise:"#f59e0b", beta:"#8b5cf6", coming_soon:"#64748b" };

export function IntegrationsHub({ profile, cs, lang, onClose }) {
  const [selected,    setSelected]    = useState(null);
  const [connected,   setConnected]   = useState({ slack: false, sheets: false });
  const [configs,     setConfigs]     = useState({});
  const [catFilter,   setCatFilter]   = useState("all");
  const [saving,      setSaving]      = useState(false);
  const [savedId,     setSavedId]     = useState(null);

  const filtered = catFilter === "all" ? INTEGRATIONS : INTEGRATIONS.filter(i => i.category === catFilter);

  const handleSave = async (id) => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 900));
    setConnected(p => ({ ...p, [id]: true }));
    setSavedId(id);
    setSaving(false);
    setTimeout(() => setSavedId(null), 2500);
  };

  const handleDisconnect = (id) => {
    setConnected(p => ({ ...p, [id]: false }));
    setConfigs(p => { const n = { ...p }; delete n[id]; return n; });
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.78)", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:cs.card, borderRadius:20, width:"100%", maxWidth:1120, height:"90vh", display:"flex", flexDirection:"column", overflow:"hidden", border:`1px solid ${cs.border}`, boxShadow:"0 32px 80px rgba(0,0,0,0.5)" }}>

        {/* Header */}
        <div style={{ padding:"20px 28px", borderBottom:`1px solid ${cs.border}`, background:"linear-gradient(135deg,rgba(99,102,241,0.07),rgba(14,165,233,0.04))", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:44, height:44, borderRadius:12, background:"linear-gradient(135deg,#6366f1,#0ea5e9)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>🔌</div>
            <div>
              <div style={{ fontWeight:800, fontSize:20, color:cs.text }}>Integrations Hub</div>
              <div style={{ fontSize:12, color:cs.textDim }}>Connect PostureAI to your existing tools</div>
            </div>
          </div>
          <div style={{ display:"flex", gap:10, alignItems:"center" }}>
            <div style={{ textAlign:"center", padding:"6px 14px", background:"rgba(16,185,129,0.1)", borderRadius:10 }}>
              <div style={{ fontSize:17, fontWeight:800, color:"#10b981" }}>{Object.values(connected).filter(Boolean).length}</div>
              <div style={{ fontSize:10, color:cs.textDim }}>Connected</div>
            </div>
            <button onClick={onClose} style={{ background:"rgba(255,255,255,0.07)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:10, padding:"8px 14px", cursor:"pointer", fontSize:13 }}>✕</button>
          </div>
        </div>

        <div style={{ flex:1, overflow:"hidden", display:"flex" }}>

          {/* Left: grid */}
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
            {/* Category filter */}
            <div style={{ display:"flex", gap:6, padding:"12px 18px", borderBottom:`1px solid ${cs.border}`, flexWrap:"wrap" }}>
              <button onClick={() => setCatFilter("all")} style={{ padding:"5px 13px", borderRadius:20, border:"1px solid", fontSize:11, cursor:"pointer", fontWeight:600, borderColor:catFilter==="all"?cs.text:cs.border, color:catFilter==="all"?cs.text:cs.textDim, background:catFilter==="all"?"rgba(255,255,255,0.08)":"transparent" }}>All ({INTEGRATIONS.length})</button>
              {Object.entries(CAT_LABELS).map(([k,l]) => (
                <button key={k} onClick={() => setCatFilter(k)} style={{ padding:"5px 13px", borderRadius:20, border:"1px solid", fontSize:11, cursor:"pointer", fontWeight:600, borderColor:catFilter===k?"#6366f1":cs.border, color:catFilter===k?"#6366f1":cs.textDim, background:catFilter===k?"rgba(99,102,241,0.12)":"transparent" }}>{l}</button>
              ))}
            </div>

            {/* Integration cards */}
            <div style={{ flex:1, overflowY:"auto", padding:16, display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:12, alignContent:"start" }}>
              {filtered.map(intg => {
                const isConnected = connected[intg.id];
                return (
                  <div key={intg.id} onClick={() => setSelected(intg)} style={{ background:cs.bg, borderRadius:14, padding:16, border:`2px solid ${selected?.id===intg.id?intg.color:cs.border}`, cursor:"pointer", transition:"all .15s", position:"relative" }}>
                    {intg.status !== "available" && (
                      <div style={{ position:"absolute", top:10, right:10, fontSize:9, fontWeight:700, padding:"2px 8px", borderRadius:20, background:`${STATUS_COLORS[intg.status]}18`, color:STATUS_COLORS[intg.status] }}>{intg.status}</div>
                    )}
                    <div style={{ fontSize:32, marginBottom:10 }}>{intg.icon}</div>
                    <div style={{ fontWeight:800, fontSize:14, color:cs.text, marginBottom:4 }}>{intg.name}</div>
                    <div style={{ fontSize:11, color:cs.textDim, lineHeight:1.5, marginBottom:12 }}>{intg.desc.slice(0,80)}...</div>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                      <span style={{ fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:20, background:isConnected?"rgba(16,185,129,0.12)":"rgba(255,255,255,0.06)", color:isConnected?"#10b981":cs.textDim }}>
                        {isConnected ? "✓ Connected" : CAT_LABELS[intg.category]?.split(" ")[1] || intg.category}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: detail */}
          {selected && (
            <div style={{ width:380, borderLeft:`1px solid ${cs.border}`, display:"flex", flexDirection:"column", overflow:"hidden" }}>
              {/* Integration header */}
              <div style={{ padding:"20px 20px 16px", borderBottom:`1px solid ${cs.border}`, background:`${selected.color}0A` }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
                  <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                    <span style={{ fontSize:32 }}>{selected.icon}</span>
                    <div>
                      <div style={{ fontWeight:800, fontSize:16, color:cs.text }}>{selected.name}</div>
                      <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20, background:`${STATUS_COLORS[selected.status]}18`, color:STATUS_COLORS[selected.status] }}>{selected.status}</span>
                    </div>
                  </div>
                  <button onClick={() => setSelected(null)} style={{ background:"transparent", border:"none", color:cs.textDim, cursor:"pointer", fontSize:18 }}>✕</button>
                </div>
                <p style={{ fontSize:13, color:cs.textDim, lineHeight:1.6, margin:0 }}>{selected.desc}</p>
              </div>

              <div style={{ flex:1, overflowY:"auto", padding:20 }}>
                {/* Features */}
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontWeight:700, color:cs.text, fontSize:13, marginBottom:8 }}>What you get</div>
                  {selected.features.map((f,i) => (
                    <div key={i} style={{ display:"flex", gap:8, fontSize:12, color:cs.textDim, marginBottom:6 }}>
                      <span style={{ color:"#10b981", flexShrink:0 }}>✓</span>{f}
                    </div>
                  ))}
                </div>

                {/* Config */}
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontWeight:700, color:cs.text, fontSize:13, marginBottom:10 }}>Configuration</div>
                  {selected.configFields.map(f => (
                    <div key={f.key} style={{ marginBottom:12 }}>
                      <label style={{ fontSize:11, fontWeight:600, color:cs.textDim, display:"block", marginBottom:4 }}>{f.label}</label>
                      {f.type === "toggle" ? (
                        <div onClick={() => setConfigs(p => ({ ...p, [selected.id]: { ...p[selected.id], [f.key]: !p[selected.id]?.[f.key] } }))}
                          style={{ width:44, height:24, borderRadius:12, background:configs[selected.id]?.[f.key]?selected.color:"rgba(255,255,255,0.1)", cursor:"pointer", position:"relative", transition:"background .2s" }}>
                          <div style={{ position:"absolute", top:3, left:configs[selected.id]?.[f.key]?22:3, width:18, height:18, borderRadius:"50%", background:"#fff", transition:"left .2s" }} />
                        </div>
                      ) : f.type === "select" ? (
                        <select value={configs[selected.id]?.[f.key]||""} onChange={e => setConfigs(p => ({ ...p, [selected.id]:{ ...p[selected.id], [f.key]:e.target.value } }))} style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:8, padding:"8px 12px", fontSize:12, outline:"none" }}>
                          <option value="" style={{ background:"#1e293b" }}>Select...</option>
                          {(f.options||[]).map(o => <option key={o} value={o} style={{ background:"#1e293b" }}>{o}</option>)}
                        </select>
                      ) : (
                        <input type={f.type} value={configs[selected.id]?.[f.key]||""} onChange={e => setConfigs(p => ({ ...p, [selected.id]:{ ...p[selected.id], [f.key]:e.target.value } }))} placeholder={f.placeholder} style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:8, padding:"8px 12px", fontSize:12, outline:"none", boxSizing:"border-box" }} />
                      )}
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {!connected[selected.id] ? (
                    <button onClick={() => handleSave(selected.id)} disabled={saving} style={{ background:`linear-gradient(135deg,${selected.color},${selected.color}cc)`, border:"none", color:"#fff", borderRadius:10, padding:"12px", cursor:"pointer", fontWeight:800, fontSize:14 }}>
                      {saving ? "Connecting…" : `Connect ${selected.name}`}
                    </button>
                  ) : (
                    <>
                      <div style={{ textAlign:"center", padding:"10px", background:"rgba(16,185,129,0.1)", borderRadius:10, color:"#10b981", fontWeight:700, fontSize:13 }}>
                        {savedId === selected.id ? "✓ Connected successfully!" : "✓ Connected"}
                      </div>
                      <button onClick={() => handleDisconnect(selected.id)} style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.25)", color:"#ef4444", borderRadius:10, padding:"10px", cursor:"pointer", fontWeight:600, fontSize:13 }}>Disconnect</button>
                    </>
                  )}
                  <a href={selected.docs} target="_blank" rel="noreferrer" style={{ textAlign:"center", fontSize:12, color:cs.textDim, textDecoration:"none", padding:"6px" }}>📚 View documentation →</a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
