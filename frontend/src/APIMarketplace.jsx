/**
 * APIMarketplace.jsx — Corvus Phase 12
 * Full API marketplace: key management, docs, usage analytics, webhooks, SDKs
 */
import { useState, useEffect, useCallback } from "react";

const PLANS_API = [
  { id:"api_free", name:"Free", price:0, reqs:1000, rps:2, color:"#6366f1", features:["REST API","Basic endpoints","Email support","1 webhook"] },
  { id:"growth",  name:"Growth",  price:49, reqs:50000, rps:10, color:"#0ea5e9", features:["Everything in Starter","Batch analysis","Webhooks (10)","Dashboard access","Priority support"], badge:"Popular" },
  { id:"scale",   name:"Scale",   price:199, reqs:500000, rps:50, color:"#10b981", features:["Everything in Growth","Dedicated rate limits","Custom models","SLA 99.9%","Slack support"], badge:"Best" },
  { id:"enterprise", name:"Enterprise", price:null, reqs:-1, rps:-1, color:"#f59e0b", features:["Unlimited requests","Custom RPS","On-prem option","White-label API","24/7 phone support"], badge:"Custom" },
];

const ENDPOINTS = [
  { method:"POST", path:"/v1/analyze/frame",    desc:"Analyze a single posture frame",       tier:"starter",    latency:"~180ms" },
  { method:"POST", path:"/v1/analyze/batch",    desc:"Analyze up to 50 frames at once",      tier:"growth",     latency:"~1.2s" },
  { method:"POST", path:"/v1/analyze/stream",   desc:"WebSocket real-time stream analysis",  tier:"growth",     latency:"~40ms" },
  { method:"GET",  path:"/v1/sessions",         desc:"List user sessions",                   tier:"starter",    latency:"~60ms" },
  { method:"GET",  path:"/v1/sessions/:id",     desc:"Get single session detail",            tier:"starter",    latency:"~45ms" },
  { method:"POST", path:"/v1/report/pdf",       desc:"Generate PDF health report",           tier:"starter",    latency:"~2.1s" },
  { method:"POST", path:"/v1/report/ai",        desc:"AI narrative report (local, free)",         tier:"growth",     latency:"~3.5s" },
  { method:"GET",  path:"/v1/users/:id/score",  desc:"Current posture score for a user",     tier:"starter",    latency:"~35ms" },
  { method:"GET",  path:"/v1/org/:id/analytics","desc":"Org-wide analytics aggregation",     tier:"scale",      latency:"~220ms" },
  { method:"POST", path:"/v1/webhooks",         desc:"Register a webhook endpoint",          tier:"starter",    latency:"~50ms" },
  { method:"GET",  path:"/v1/webhooks",         desc:"List registered webhooks",             tier:"starter",    latency:"~40ms" },
  { method:"POST", path:"/v1/alerts/rules",     desc:"Create posture alert rules",           tier:"growth",     latency:"~55ms" },
  { method:"GET",  path:"/v1/leaderboard",      desc:"Team posture leaderboard",             tier:"growth",     latency:"~90ms" },
  { method:"POST", path:"/v1/calibration",      desc:"Submit user calibration data",         tier:"starter",    latency:"~70ms" },
  { method:"DELETE",path:"/v1/users/:id/data",  desc:"GDPR erasure request",                 tier:"starter",    latency:"~300ms" },
];

const WEBHOOK_EVENTS = [
  "session.completed","score.dropped","alert.triggered","report.ready",
  "user.subscribed","user.churned","payment.confirmed","org.member.added",
];

const SDK_LANGS = [
  { id:"js",     label:"JavaScript", icon:"🟨", install:"npm install @corvus/sdk", snippet:`import Corvus from '@corvus/sdk';\n\nconst client = new Corvus({ apiKey: 'YOUR_KEY' });\n\nconst result = await client.analyze.frame({\n  image: frameBuffer,\n  mode: 'laptop',\n  userId: 'usr_123',\n});\nconsole.log(result.score, result.alerts);` },
  { id:"python", label:"Python",     icon:"🐍", install:"pip install corvus",      snippet:`from corvus import Corvus\n\nclient = Corvus(api_key="YOUR_KEY")\n\nresult = client.analyze.frame(\n    image=frame_bytes,\n    mode="laptop",\n    user_id="usr_123",\n)\nprint(result.score, result.alerts)` },
  { id:"curl",   label:"cURL",       icon:"⚡", install:"(built-in)",                snippet:`curl -X POST https://api.corvus.com/v1/analyze/frame \\\n  -H "Authorization: Bearer YOUR_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"image":"<base64>","mode":"laptop","userId":"usr_123"}'` },
];

const METHOD_COLORS = { GET:"#10b981", POST:"#6366f1", DELETE:"#ef4444", PUT:"#f59e0b", PATCH:"#0ea5e9" };

function fmtNum(n){ return n<0?"∞":n>=1e6?(n/1e6).toFixed(1)+"M":n>=1e3?(n/1e3).toFixed(0)+"K":n; }
function genKey(){ return "pak_live_"+Math.random().toString(36).slice(2,12)+Math.random().toString(36).slice(2,12); }

export function APIMarketplace({ profile, cs, lang, onClose }) {
  const isAr = lang==="ar";
  const [tab, setTab] = useState("overview");
  const [apiKeys, setApiKeys] = useState([
    { id:"k1", name:"Production", key:genKey(), created:"2026-05-01", lastUsed:"2026-05-31", requests:12840, plan:"growth", active:true },
    { id:"k2", name:"Staging",    key:genKey(), created:"2026-04-15", lastUsed:"2026-05-28", requests:3210,  plan:"starter", active:true },
  ]);
  const [showKey, setShowKey] = useState({});
  const [newKeyName, setNewKeyName] = useState("");
  const [showNewKey, setShowNewKey] = useState(false);
  const [createdKey, setCreatedKey] = useState(null);
  const [webhooks, setWebhooks] = useState([
    { id:"w1", url:"https://myapp.com/hooks/posture", events:["session.completed","alert.triggered"], active:true, lastDelivery:"2026-05-31 14:22", failures:0 },
  ]);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookEvents, setWebhookEvents] = useState([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState(null);
  const [sdkLang, setSdkLang] = useState("js");
  const [copied, setCopied] = useState("");
  const [usagePeriod, setUsagePeriod] = useState("7d");
  const [selectedPlan, setSelectedPlan] = useState("growth");

  // Mock usage data
  const usageData = [820,940,1100,880,1250,1380,1520,1200,1680,1750,1900,2100,1950,2300];

  const copy = (text, id) => {
    navigator.clipboard?.writeText(text).catch(()=>{});
    setCopied(id);
    setTimeout(()=>setCopied(""),1800);
  };

  const createKey = () => {
    if(!newKeyName.trim()) return;
    const k = { id:"k"+Date.now(), name:newKeyName.trim(), key:genKey(), created:new Date().toISOString().slice(0,10), lastUsed:"—", requests:0, plan:"starter", active:true };
    setApiKeys(prev=>[...prev,k]);
    setCreatedKey(k);
    setNewKeyName("");
    setShowNewKey(false);
  };

  const revokeKey = (id) => setApiKeys(prev=>prev.map(k=>k.id===id?{...k,active:false}:k));

  const addWebhook = () => {
    if(!webhookUrl || webhookEvents.length===0) return;
    setWebhooks(prev=>[...prev,{ id:"w"+Date.now(), url:webhookUrl, events:webhookEvents, active:true, lastDelivery:"—", failures:0 }]);
    setWebhookUrl(""); setWebhookEvents([]);
  };

  const tabs = [
    { id:"overview",  label:"Overview",   icon:"🏠" },
    { id:"keys",      label:"API Keys",   icon:"🔑" },
    { id:"endpoints", label:"Endpoints",  icon:"📡" },
    { id:"webhooks",  label:"Webhooks",   icon:"🔔" },
    { id:"sdks",      label:"SDKs",       icon:"📦" },
    { id:"usage",     label:"Usage",      icon:"📊" },
    { id:"plans",     label:"Plans",      icon:"💳" },
  ];

  const totalReqs = apiKeys.reduce((s,k)=>s+k.requests,0);
  const activeKeys = apiKeys.filter(k=>k.active).length;

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:cs.card, borderRadius:20, width:"100%", maxWidth:1100, height:"88vh", display:"flex", flexDirection:"column", overflow:"hidden", border:`1px solid ${cs.border}`, boxShadow:"0 32px 80px rgba(0,0,0,0.5)" }}>

        {/* Header */}
        <div style={{ padding:"20px 28px 0", borderBottom:`1px solid ${cs.border}`, background:`linear-gradient(135deg, rgba(99,102,241,0.08), rgba(16,185,129,0.05))` }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:44, height:44, borderRadius:12, background:"linear-gradient(135deg,#6366f1,#0ea5e9)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>🛒</div>
              <div>
                <div style={{ fontWeight:800, fontSize:20, color:cs.text }}>API Marketplace</div>
                <div style={{ fontSize:12, color:cs.textDim }}>Integrate Corvus into any platform</div>
              </div>
            </div>
            <div style={{ display:"flex", gap:12, alignItems:"center" }}>
              <div style={{ textAlign:"center", padding:"6px 14px", background:"rgba(99,102,241,0.1)", borderRadius:10 }}>
                <div style={{ fontSize:18, fontWeight:800, color:"#6366f1" }}>{fmtNum(totalReqs)}</div>
                <div style={{ fontSize:10, color:cs.textDim }}>Total Requests</div>
              </div>
              <div style={{ textAlign:"center", padding:"6px 14px", background:"rgba(16,185,129,0.1)", borderRadius:10 }}>
                <div style={{ fontSize:18, fontWeight:800, color:"#10b981" }}>{activeKeys}</div>
                <div style={{ fontSize:10, color:cs.textDim }}>Active Keys</div>
              </div>
              <button onClick={onClose} style={{ background:"rgba(255,255,255,0.08)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:10, padding:"8px 14px", cursor:"pointer", fontSize:13 }}>✕ Close</button>
            </div>
          </div>
          <div style={{ display:"flex", gap:4 }}>
            {tabs.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{ background:tab===t.id?"rgba(99,102,241,0.15)":"transparent", border:"none", color:tab===t.id?"#6366f1":cs.textDim, padding:"8px 14px", cursor:"pointer", borderRadius:"8px 8px 0 0", fontWeight:tab===t.id?700:500, fontSize:13, transition:"all .15s", borderBottom:tab===t.id?"2px solid #6366f1":"2px solid transparent" }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:"auto", padding:24 }}>

          {/* ─── OVERVIEW ─── */}
          {tab==="overview" && (
            <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:12 }}>
                {[
                  { label:"API Version", value:"v1.4.2", icon:"🔢", color:"#6366f1" },
                  { label:"Uptime (30d)",  value:"99.98%", icon:"✅", color:"#10b981" },
                  { label:"Avg Latency",  value:"142ms", icon:"⚡", color:"#f59e0b" },
                  { label:"Endpoints",    value:ENDPOINTS.length, icon:"📡", color:"#0ea5e9" },
                ].map(m=>(
                  <div key={m.label} style={{ background:cs.bg, borderRadius:14, padding:16, border:`1px solid ${cs.border}` }}>
                    <div style={{ fontSize:24 }}>{m.icon}</div>
                    <div style={{ fontSize:22, fontWeight:800, color:m.color, marginTop:6 }}>{m.value}</div>
                    <div style={{ fontSize:12, color:cs.textDim }}>{m.label}</div>
                  </div>
                ))}
              </div>

              {/* Quick Start */}
              <div style={{ background:cs.bg, borderRadius:14, padding:20, border:`1px solid ${cs.border}` }}>
                <div style={{ fontWeight:700, color:cs.text, marginBottom:14, fontSize:15 }}>🚀 Quick Start</div>
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {[
                    { step:1, label:"Get your API key", action:"Go to API Keys →", tab:"keys" },
                    { step:2, label:"Install the SDK", action:"View SDKs →", tab:"sdks" },
                    { step:3, label:"Call /v1/analyze/frame", action:"View Endpoints →", tab:"endpoints" },
                    { step:4, label:"Set up webhooks", action:"Configure Webhooks →", tab:"webhooks" },
                  ].map(s=>(
                    <div key={s.step} style={{ display:"flex", alignItems:"center", gap:12 }}>
                      <div style={{ width:28, height:28, borderRadius:"50%", background:"linear-gradient(135deg,#6366f1,#0ea5e9)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:"#fff", flexShrink:0 }}>{s.step}</div>
                      <div style={{ flex:1, color:cs.text, fontSize:14 }}>{s.label}</div>
                      <button onClick={()=>setTab(s.tab)} style={{ background:"transparent", border:`1px solid ${cs.border}`, color:"#6366f1", borderRadius:8, padding:"4px 12px", cursor:"pointer", fontSize:12, fontWeight:600 }}>{s.action}</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div style={{ background:cs.bg, borderRadius:14, padding:20, border:`1px solid ${cs.border}` }}>
                <div style={{ fontWeight:700, color:cs.text, marginBottom:12, fontSize:15 }}>🟢 System Status</div>
                {["API Gateway","Analysis Engine","Local AI Engine","Webhook Delivery","PDF Generation","Redis Cache"].map(s=>(
                  <div key={s} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${cs.border}` }}>
                    <span style={{ color:cs.text, fontSize:13 }}>{s}</span>
                    <span style={{ color:"#10b981", fontSize:12, fontWeight:600, background:"rgba(16,185,129,0.1)", padding:"2px 10px", borderRadius:20 }}>Operational</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── API KEYS ─── */}
          {tab==="keys" && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ fontWeight:700, color:cs.text, fontSize:16 }}>🔑 API Keys</div>
                <button onClick={()=>setShowNewKey(true)} style={{ background:"linear-gradient(135deg,#6366f1,#0ea5e9)", border:"none", color:"#fff", borderRadius:10, padding:"8px 18px", cursor:"pointer", fontWeight:700, fontSize:13 }}>+ New Key</button>
              </div>

              {createdKey && (
                <div style={{ background:"rgba(16,185,129,0.1)", border:"1px solid rgba(16,185,129,0.3)", borderRadius:12, padding:16 }}>
                  <div style={{ fontWeight:700, color:"#10b981", marginBottom:8 }}>✅ Key Created — Save it now, it won't be shown again!</div>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <code style={{ flex:1, background:"rgba(0,0,0,0.3)", padding:"8px 12px", borderRadius:8, color:"#10b981", fontSize:13, wordBreak:"break-all" }}>{createdKey.key}</code>
                    <button onClick={()=>copy(createdKey.key,"newkey")} style={{ background:"#10b981", border:"none", color:"#fff", borderRadius:8, padding:"8px 14px", cursor:"pointer", fontWeight:700, whiteSpace:"nowrap" }}>{copied==="newkey"?"Copied!":"Copy"}</button>
                  </div>
                  <button onClick={()=>setCreatedKey(null)} style={{ marginTop:10, background:"transparent", border:"none", color:cs.textDim, cursor:"pointer", fontSize:12 }}>Dismiss</button>
                </div>
              )}

              {showNewKey && (
                <div style={{ background:cs.bg, borderRadius:12, padding:16, border:`1px solid ${cs.border}` }}>
                  <div style={{ fontWeight:600, color:cs.text, marginBottom:10 }}>New API Key</div>
                  <div style={{ display:"flex", gap:8 }}>
                    <input value={newKeyName} onChange={e=>setNewKeyName(e.target.value)} placeholder="Key name (e.g. Production)" style={{ flex:1, background:"rgba(255,255,255,0.05)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:8, padding:"8px 12px", fontSize:13, outline:"none" }} onKeyDown={e=>e.key==="Enter"&&createKey()} />
                    <button onClick={createKey} style={{ background:"#6366f1", border:"none", color:"#fff", borderRadius:8, padding:"8px 18px", cursor:"pointer", fontWeight:700 }}>Create</button>
                    <button onClick={()=>setShowNewKey(false)} style={{ background:"transparent", border:`1px solid ${cs.border}`, color:cs.textDim, borderRadius:8, padding:"8px 14px", cursor:"pointer" }}>Cancel</button>
                  </div>
                </div>
              )}

              {apiKeys.map(k=>(
                <div key={k.id} style={{ background:cs.bg, borderRadius:14, padding:18, border:`1px solid ${k.active?cs.border:"rgba(239,68,68,0.3)"}`, opacity:k.active?1:0.6 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
                    <div>
                      <div style={{ fontWeight:700, color:cs.text, fontSize:15 }}>{k.name}</div>
                      <div style={{ fontSize:11, color:cs.textDim, marginTop:2 }}>Created {k.created} · Last used {k.lastUsed}</div>
                    </div>
                    <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                      <span style={{ fontSize:11, padding:"3px 10px", borderRadius:20, background:k.plan==="growth"?"rgba(14,165,233,0.15)":"rgba(99,102,241,0.15)", color:k.plan==="growth"?"#0ea5e9":"#6366f1", fontWeight:600 }}>{k.plan}</span>
                      {k.active ? (
                        <button onClick={()=>revokeKey(k.id)} style={{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)", color:"#ef4444", borderRadius:8, padding:"4px 12px", cursor:"pointer", fontSize:12, fontWeight:600 }}>Revoke</button>
                      ) : (
                        <span style={{ color:"#ef4444", fontSize:12, fontWeight:600 }}>Revoked</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <code style={{ flex:1, background:"rgba(0,0,0,0.2)", padding:"8px 12px", borderRadius:8, color:cs.textDim, fontSize:12, letterSpacing:1 }}>
                      {showKey[k.id] ? k.key : k.key.slice(0,14)+"•".repeat(24)+k.key.slice(-4)}
                    </code>
                    <button onClick={()=>setShowKey(p=>({...p,[k.id]:!p[k.id]}))} style={{ background:"transparent", border:`1px solid ${cs.border}`, color:cs.textDim, borderRadius:8, padding:"6px 12px", cursor:"pointer", fontSize:12 }}>{showKey[k.id]?"Hide":"Show"}</button>
                    <button onClick={()=>copy(k.key,"key_"+k.id)} style={{ background:"transparent", border:`1px solid ${cs.border}`, color:cs.textDim, borderRadius:8, padding:"6px 12px", cursor:"pointer", fontSize:12 }}>{copied==="key_"+k.id?"✓ Copied":"Copy"}</button>
                  </div>
                  <div style={{ marginTop:10, display:"flex", gap:16 }}>
                    <div style={{ fontSize:12, color:cs.textDim }}><b style={{ color:cs.text }}>{fmtNum(k.requests)}</b> requests this month</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ─── ENDPOINTS ─── */}
          {tab==="endpoints" && (
            <div style={{ display:"flex", gap:16, height:"100%" }}>
              <div style={{ width:360, display:"flex", flexDirection:"column", gap:6, overflowY:"auto" }}>
                {ENDPOINTS.map((ep,i)=>(
                  <button key={i} onClick={()=>setSelectedEndpoint(ep)} style={{ background:selectedEndpoint===ep?"rgba(99,102,241,0.12)":cs.bg, border:selectedEndpoint===ep?"1px solid #6366f1":`1px solid ${cs.border}`, borderRadius:10, padding:"10px 14px", cursor:"pointer", textAlign:"left", display:"flex", gap:10, alignItems:"center" }}>
                    <span style={{ fontSize:10, fontWeight:700, color:METHOD_COLORS[ep.method]||"#999", background:`${METHOD_COLORS[ep.method]}22`, padding:"2px 7px", borderRadius:5, flexShrink:0 }}>{ep.method}</span>
                    <div style={{ flex:1, overflow:"hidden" }}>
                      <div style={{ fontSize:12, color:cs.text, fontFamily:"monospace", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{ep.path}</div>
                      <div style={{ fontSize:10, color:cs.textDim, marginTop:2 }}>{ep.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
              <div style={{ flex:1, background:cs.bg, borderRadius:14, padding:20, border:`1px solid ${cs.border}`, overflowY:"auto" }}>
                {selectedEndpoint ? (
                  <>
                    <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:16 }}>
                      <span style={{ fontSize:13, fontWeight:700, color:METHOD_COLORS[selectedEndpoint.method], background:`${METHOD_COLORS[selectedEndpoint.method]}22`, padding:"4px 12px", borderRadius:8 }}>{selectedEndpoint.method}</span>
                      <code style={{ fontSize:16, color:cs.text, fontWeight:700 }}>{selectedEndpoint.path}</code>
                    </div>
                    <p style={{ color:cs.textDim, fontSize:14, marginBottom:16 }}>{selectedEndpoint.desc}</p>
                    <div style={{ display:"flex", gap:16, marginBottom:18 }}>
                      <div style={{ fontSize:12, color:cs.textDim }}>⏱ Avg latency: <b style={{ color:cs.text }}>{selectedEndpoint.latency}</b></div>
                      <div style={{ fontSize:12, color:cs.textDim }}>🔒 Min plan: <b style={{ color:"#6366f1" }}>{selectedEndpoint.tier}</b></div>
                    </div>
                    <div style={{ fontWeight:700, color:cs.text, marginBottom:8, fontSize:13 }}>Example Request</div>
                    <pre style={{ background:"rgba(0,0,0,0.3)", borderRadius:10, padding:14, color:"#a5f3fc", fontSize:12, overflowX:"auto", lineHeight:1.6 }}>{`curl -X ${selectedEndpoint.method} https://api.corvus.com${selectedEndpoint.path} \\
  -H "Authorization: Bearer pak_live_xxxxx" \\
  -H "Content-Type: application/json"${selectedEndpoint.method!=="GET"?` \\
  -d '{"userId":"usr_123","mode":"laptop"}'`:""}`}</pre>
                    <div style={{ fontWeight:700, color:cs.text, margin:"14px 0 8px", fontSize:13 }}>Example Response</div>
                    <pre style={{ background:"rgba(0,0,0,0.3)", borderRadius:10, padding:14, color:"#86efac", fontSize:12, overflowX:"auto", lineHeight:1.6 }}>{`{
  "success": true,
  "score": 78,
  "grade": "B",
  "alerts": ["neck_tilt_detected"],
  "recommendations": ["Raise monitor 5cm"],
  "sessionId": "sess_abc123",
  "ts": ${Date.now()}
}`}</pre>
                  </>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", color:cs.textDim }}>
                    <div style={{ fontSize:40, marginBottom:12 }}>📡</div>
                    <div style={{ fontSize:14 }}>Select an endpoint to view details</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── WEBHOOKS ─── */}
          {tab==="webhooks" && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div style={{ fontWeight:700, color:cs.text, fontSize:16 }}>🔔 Webhooks</div>
              <div style={{ background:cs.bg, borderRadius:14, padding:18, border:`1px solid ${cs.border}` }}>
                <div style={{ fontWeight:600, color:cs.text, marginBottom:12 }}>Add New Webhook</div>
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  <input value={webhookUrl} onChange={e=>setWebhookUrl(e.target.value)} placeholder="https://yourapp.com/webhook" style={{ background:"rgba(255,255,255,0.05)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:8, padding:"9px 13px", fontSize:13, outline:"none" }} />
                  <div style={{ fontWeight:600, color:cs.text, fontSize:13, marginTop:4 }}>Events to subscribe:</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                    {WEBHOOK_EVENTS.map(ev=>(
                      <button key={ev} onClick={()=>setWebhookEvents(p=>p.includes(ev)?p.filter(e=>e!==ev):[...p,ev])} style={{ padding:"5px 12px", borderRadius:20, border:"1px solid", fontSize:12, cursor:"pointer", fontWeight:600, borderColor:webhookEvents.includes(ev)?"#6366f1":cs.border, background:webhookEvents.includes(ev)?"rgba(99,102,241,0.15)":"transparent", color:webhookEvents.includes(ev)?"#6366f1":cs.textDim }}>{ev}</button>
                    ))}
                  </div>
                  <button onClick={addWebhook} style={{ background:"linear-gradient(135deg,#6366f1,#0ea5e9)", border:"none", color:"#fff", borderRadius:10, padding:"10px 20px", cursor:"pointer", fontWeight:700, fontSize:13, alignSelf:"flex-start" }}>Add Webhook</button>
                </div>
              </div>
              {webhooks.map(wh=>(
                <div key={wh.id} style={{ background:cs.bg, borderRadius:14, padding:18, border:`1px solid ${cs.border}` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                    <div>
                      <code style={{ fontSize:13, color:cs.text }}>{wh.url}</code>
                      <div style={{ fontSize:11, color:cs.textDim, marginTop:4 }}>Last delivery: {wh.lastDelivery} · Failures: {wh.failures}</div>
                    </div>
                    <span style={{ fontSize:11, padding:"3px 10px", borderRadius:20, background:"rgba(16,185,129,0.1)", color:"#10b981", fontWeight:600 }}>Active</span>
                  </div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                    {wh.events.map(ev=>(
                      <span key={ev} style={{ fontSize:11, padding:"2px 9px", borderRadius:20, background:"rgba(99,102,241,0.1)", color:"#6366f1" }}>{ev}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ─── SDKs ─── */}
          {tab==="sdks" && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div style={{ fontWeight:700, color:cs.text, fontSize:16 }}>📦 SDKs & Libraries</div>
              <div style={{ display:"flex", gap:8, marginBottom:4 }}>
                {SDK_LANGS.map(l=>(
                  <button key={l.id} onClick={()=>setSdkLang(l.id)} style={{ background:sdkLang===l.id?"rgba(99,102,241,0.15)":cs.bg, border:`1px solid ${sdkLang===l.id?"#6366f1":cs.border}`, color:sdkLang===l.id?"#6366f1":cs.text, borderRadius:10, padding:"8px 18px", cursor:"pointer", fontWeight:600, fontSize:13 }}>{l.icon} {l.label}</button>
                ))}
              </div>
              {SDK_LANGS.filter(l=>l.id===sdkLang).map(l=>(
                <div key={l.id}>
                  <div style={{ background:cs.bg, borderRadius:12, padding:16, border:`1px solid ${cs.border}`, marginBottom:12 }}>
                    <div style={{ fontSize:12, color:cs.textDim, marginBottom:8 }}>Install</div>
                    <div style={{ display:"flex", gap:8 }}>
                      <code style={{ flex:1, background:"rgba(0,0,0,0.3)", padding:"10px 14px", borderRadius:8, color:"#a5f3fc", fontSize:13 }}>{l.install}</code>
                      <button onClick={()=>copy(l.install,"install")} style={{ background:"transparent", border:`1px solid ${cs.border}`, color:cs.textDim, borderRadius:8, padding:"8px 14px", cursor:"pointer", fontSize:12 }}>{copied==="install"?"✓":"Copy"}</button>
                    </div>
                  </div>
                  <div style={{ background:cs.bg, borderRadius:12, padding:16, border:`1px solid ${cs.border}` }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                      <div style={{ fontSize:12, color:cs.textDim }}>Usage</div>
                      <button onClick={()=>copy(l.snippet,"snippet")} style={{ background:"transparent", border:`1px solid ${cs.border}`, color:cs.textDim, borderRadius:6, padding:"4px 10px", cursor:"pointer", fontSize:11 }}>{copied==="snippet"?"✓ Copied":"Copy"}</button>
                    </div>
                    <pre style={{ background:"rgba(0,0,0,0.3)", borderRadius:10, padding:14, color:"#86efac", fontSize:12.5, overflowX:"auto", lineHeight:1.7, margin:0 }}>{l.snippet}</pre>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ─── USAGE ─── */}
          {tab==="usage" && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ fontWeight:700, color:cs.text, fontSize:16 }}>📊 API Usage</div>
                <div style={{ display:"flex", gap:6 }}>
                  {["7d","30d","90d"].map(p=>(
                    <button key={p} onClick={()=>setUsagePeriod(p)} style={{ background:usagePeriod===p?"rgba(99,102,241,0.15)":"transparent", border:`1px solid ${usagePeriod===p?"#6366f1":cs.border}`, color:usagePeriod===p?"#6366f1":cs.textDim, borderRadius:8, padding:"5px 12px", cursor:"pointer", fontSize:12, fontWeight:600 }}>{p}</button>
                  ))}
                </div>
              </div>
              {/* Simple bar chart */}
              <div style={{ background:cs.bg, borderRadius:14, padding:20, border:`1px solid ${cs.border}` }}>
                <div style={{ fontWeight:600, color:cs.text, marginBottom:14, fontSize:13 }}>Requests / Day</div>
                <div style={{ display:"flex", alignItems:"flex-end", gap:4, height:120 }}>
                  {usageData.slice(-(usagePeriod==="7d"?7:usagePeriod==="30d"?14:usageData.length)).map((v,i)=>{
                    const max=Math.max(...usageData);
                    return <div key={i} style={{ flex:1, background:"linear-gradient(to top,#6366f1,#0ea5e9)", borderRadius:"4px 4px 0 0", height:`${(v/max)*100}%`, minHeight:4, opacity:0.85 }} title={v+" req"} />;
                  })}
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
                  <span style={{ fontSize:11, color:cs.textDim }}>Earlier</span>
                  <span style={{ fontSize:11, color:cs.textDim }}>Today</span>
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
                {[
                  { label:"Total Requests", value:fmtNum(totalReqs), color:"#6366f1" },
                  { label:"Success Rate",   value:"99.2%", color:"#10b981" },
                  { label:"Avg Response",   value:"142ms", color:"#f59e0b" },
                ].map(m=>(
                  <div key={m.label} style={{ background:cs.bg, borderRadius:12, padding:16, border:`1px solid ${cs.border}`, textAlign:"center" }}>
                    <div style={{ fontSize:24, fontWeight:800, color:m.color }}>{m.value}</div>
                    <div style={{ fontSize:12, color:cs.textDim, marginTop:4 }}>{m.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── PLANS ─── */}
          {tab==="plans" && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div style={{ fontWeight:700, color:cs.text, fontSize:16 }}>💳 API Plans</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:14 }}>
                {PLANS_API.map(p=>(
                  <div key={p.id} onClick={()=>setSelectedPlan(p.id)} style={{ background:selectedPlan===p.id?`${p.color}18`:cs.bg, border:`2px solid ${selectedPlan===p.id?p.color:cs.border}`, borderRadius:16, padding:20, cursor:"pointer", transition:"all .2s", position:"relative" }}>
                    {p.badge && <div style={{ position:"absolute", top:12, right:12, fontSize:10, fontWeight:700, background:p.color, color:"#fff", padding:"2px 9px", borderRadius:20 }}>{p.badge}</div>}
                    <div style={{ fontSize:22, fontWeight:800, color:p.color }}>{p.name}</div>
                    <div style={{ fontSize:28, fontWeight:900, color:cs.text, margin:"8px 0" }}>{p.price===null?"Custom":`$${p.price}`}<span style={{ fontSize:13, color:cs.textDim, fontWeight:400 }}>{p.price!==null?"/mo":""}</span></div>
                    <div style={{ fontSize:12, color:cs.textDim, marginBottom:14 }}>{fmtNum(p.reqs)} req/mo · {fmtNum(p.rps)} req/s</div>
                    {p.features.map(f=>(
                      <div key={f} style={{ fontSize:12, color:cs.text, marginBottom:6, display:"flex", gap:6 }}><span style={{ color:p.color }}>✓</span>{f}</div>
                    ))}
                    <button style={{ marginTop:14, width:"100%", background:selectedPlan===p.id?p.color:"transparent", border:`1px solid ${p.color}`, color:selectedPlan===p.id?"#fff":p.color, borderRadius:10, padding:"9px", cursor:"pointer", fontWeight:700, fontSize:13 }}>
                      {p.price===null?"Contact Sales":"Select Plan"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
