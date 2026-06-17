/**
 * UsageBilling.jsx — Corvus Phase 13
 * Usage-based billing: metered usage, overage charges, dunning / payment retry
 */
import { useState, useEffect } from "react";

const METERS = [
  { id:"analysis_frames", label:"Analysis Frames",    unit:"frame",   included:10000, rate:0.002,  icon:"📷" },
  { id:"ai_reports",      label:"AI Reports",          unit:"report",  included:50,    rate:0.15,   icon:"🤖" },
  { id:"api_calls",       label:"API Calls",            unit:"call",    included:5000,  rate:0.0004, icon:"📡" },
  { id:"pdf_exports",     label:"PDF Exports",          unit:"export",  included:20,    rate:0.05,   icon:"📄" },
  { id:"seats",           label:"Active Seats",         unit:"seat",    included:10,    rate:4.0,    icon:"👤" },
  { id:"storage_gb",      label:"Storage",              unit:"GB",      included:5,     rate:0.08,   icon:"💾" },
];

const MOCK_USAGE = {
  analysis_frames: 14820,
  ai_reports:      67,
  api_calls:       4210,
  pdf_exports:     31,
  seats:           13,
  storage_gb:      7.4,
};

const MOCK_INVOICES = [
  { id:"inv_052", date:"2026-06-01", amount:219.80, status:"paid",    base:149, overage:70.80,  period:"May 2026" },
  { id:"inv_051", date:"2026-05-01", amount:149.00, status:"paid",    base:149, overage:0,      period:"Apr 2026" },
  { id:"inv_050", date:"2026-04-01", amount:187.40, status:"paid",    base:149, overage:38.40,  period:"Mar 2026" },
  { id:"inv_049", date:"2026-03-01", amount:149.00, status:"failed",  base:149, overage:0,      period:"Feb 2026" },
  { id:"inv_049b",date:"2026-03-08", amount:149.00, status:"paid",    base:149, overage:0,      period:"Feb 2026 (retry)" },
];

const DUNNING_STEPS = [
  { day:0,  action:"Invoice sent",               channel:"email",   done:true },
  { day:3,  action:"Payment failed — retry #1",  channel:"auto",    done:true },
  { day:5,  action:"Reminder email sent",        channel:"email",   done:true },
  { day:7,  action:"Payment failed — retry #2",  channel:"auto",    done:false },
  { day:10, action:"In-app banner shown",        channel:"in-app",  done:false },
  { day:14, action:"Account downgraded",         channel:"system",  done:false },
  { day:21, action:"Account suspended",          channel:"system",  done:false },
];

const STATUS_COLORS = { paid:"#10b981", failed:"#ef4444", pending:"#f59e0b", void:"#64748b" };

export function UsageBilling({ profile, cs, lang, onClose }) {
  const [tab, setTab] = useState("current");
  const [alertThreshold, setAlertThreshold] = useState(80);
  const [autoUpgrade, setAutoUpgrade] = useState(true);
  const [saved, setSaved] = useState(false);

  const currentOverage = METERS.reduce((sum, m) => {
    const used = MOCK_USAGE[m.id] || 0;
    const over = Math.max(0, used - m.included);
    return sum + over * m.rate;
  }, 0);

  const tabs = [
    { id:"current",  label:"Current Usage", icon:"📊" },
    { id:"invoices", label:"Invoices",       icon:"🧾" },
    { id:"dunning",  label:"Dunning",        icon:"🔔" },
    { id:"settings", label:"Settings",       icon:"⚙️" },
  ];

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:cs.card, borderRadius:20, width:"100%", maxWidth:1000, height:"86vh", display:"flex", flexDirection:"column", overflow:"hidden", border:`1px solid ${cs.border}`, boxShadow:"0 32px 80px rgba(0,0,0,0.5)" }}>

        {/* Header */}
        <div style={{ padding:"20px 28px 0", borderBottom:`1px solid ${cs.border}`, background:"linear-gradient(135deg,rgba(16,185,129,0.07),rgba(99,102,241,0.04))" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:44, height:44, borderRadius:12, background:"linear-gradient(135deg,#10b981,#6366f1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>📈</div>
              <div>
                <div style={{ fontWeight:800, fontSize:20, color:cs.text }}>Usage-Based Billing</div>
                <div style={{ fontSize:12, color:cs.textDim }}>Metered usage · Overages · Dunning automation</div>
              </div>
            </div>
            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              <div style={{ textAlign:"center", padding:"6px 14px", background:"rgba(239,68,68,0.1)", borderRadius:10 }}>
                <div style={{ fontSize:18, fontWeight:800, color:"#ef4444" }}>${currentOverage.toFixed(2)}</div>
                <div style={{ fontSize:10, color:cs.textDim }}>Overage this month</div>
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

        <div style={{ flex:1, overflowY:"auto", padding:24 }}>

          {/* ── CURRENT USAGE ── */}
          {tab==="current" && (
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ fontWeight:700, color:cs.text, fontSize:16 }}>June 2026 — Billing Cycle</div>
                <div style={{ fontSize:13, color:cs.textDim }}>Resets in 28 days</div>
              </div>
              {METERS.map(m => {
                const used = MOCK_USAGE[m.id] || 0;
                const pct = Math.min(100, (used / m.included) * 100);
                const over = Math.max(0, used - m.included);
                const overCost = over * m.rate;
                const isOver = used > m.included;
                return (
                  <div key={m.id} style={{ background:cs.bg, borderRadius:14, padding:18, border:`1px solid ${isOver?"rgba(239,68,68,0.3)":cs.border}` }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                        <span style={{ fontSize:20 }}>{m.icon}</span>
                        <div>
                          <div style={{ fontWeight:700, color:cs.text, fontSize:14 }}>{m.label}</div>
                          <div style={{ fontSize:11, color:cs.textDim }}>Included: {m.included.toLocaleString()} {m.unit}s · Rate: ${m.rate}/{m.unit}</div>
                        </div>
                      </div>
                      <div style={{ textAlign:"right" }}>
                        <div style={{ fontWeight:800, fontSize:16, color:isOver?"#ef4444":cs.text }}>
                          {typeof used === "number" && used % 1 !== 0 ? used.toFixed(1) : used.toLocaleString()}
                          <span style={{ fontSize:12, fontWeight:400, color:cs.textDim }}> / {m.included.toLocaleString()}</span>
                        </div>
                        {isOver && <div style={{ fontSize:12, color:"#ef4444", fontWeight:600 }}>+${overCost.toFixed(2)} overage</div>}
                      </div>
                    </div>
                    <div style={{ height:8, background:"rgba(255,255,255,0.08)", borderRadius:4, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${Math.min(100, pct)}%`, borderRadius:4, background:pct>=100?"#ef4444":pct>=80?"#f59e0b":"#10b981", transition:"width .6s" }} />
                    </div>
                    {isOver && (
                      <div style={{ marginTop:8, fontSize:12, color:"#ef4444" }}>
                        Over by {(used-m.included).toLocaleString()} {m.unit}s
                      </div>
                    )}
                  </div>
                );
              })}
              <div style={{ background:"rgba(99,102,241,0.08)", border:"1px solid rgba(99,102,241,0.2)", borderRadius:12, padding:16, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontWeight:700, color:cs.text }}>Estimated bill for June</div>
                  <div style={{ fontSize:12, color:cs.textDim, marginTop:3 }}>Base $149.00 + ${currentOverage.toFixed(2)} overage</div>
                </div>
                <div style={{ fontSize:28, fontWeight:900, color:"#6366f1" }}>${(149 + currentOverage).toFixed(2)}</div>
              </div>
            </div>
          )}

          {/* ── INVOICES ── */}
          {tab==="invoices" && (
            <div>
              <div style={{ fontWeight:700, color:cs.text, fontSize:16, marginBottom:16 }}>🧾 Invoice History</div>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                <thead>
                  <tr style={{ background:"rgba(255,255,255,0.02)" }}>
                    {["Invoice","Period","Base","Overage","Total","Status",""].map(h => (
                      <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontWeight:600, color:cs.textDim, fontSize:11, borderBottom:`1px solid ${cs.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MOCK_INVOICES.map(inv => (
                    <tr key={inv.id} style={{ borderBottom:`1px solid ${cs.border}` }}>
                      <td style={{ padding:"12px 14px", color:cs.text, fontFamily:"monospace", fontSize:12 }}>{inv.id}</td>
                      <td style={{ padding:"12px 14px", color:cs.textDim }}>{inv.period}</td>
                      <td style={{ padding:"12px 14px", color:cs.text }}>${inv.base}</td>
                      <td style={{ padding:"12px 14px", color:inv.overage>0?"#f59e0b":cs.textDim }}>{inv.overage>0?`$${inv.overage.toFixed(2)}`:"—"}</td>
                      <td style={{ padding:"12px 14px", fontWeight:700, color:cs.text }}>${inv.amount.toFixed(2)}</td>
                      <td style={{ padding:"12px 14px" }}>
                        <span style={{ fontSize:11, fontWeight:700, padding:"3px 9px", borderRadius:20, background:`${STATUS_COLORS[inv.status]}18`, color:STATUS_COLORS[inv.status] }}>{inv.status}</span>
                      </td>
                      <td style={{ padding:"12px 14px" }}>
                        <button style={{ background:"transparent", border:`1px solid ${cs.border}`, color:cs.textDim, borderRadius:7, padding:"4px 11px", cursor:"pointer", fontSize:11 }}>PDF</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── DUNNING ── */}
          {tab==="dunning" && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div style={{ fontWeight:700, color:cs.text, fontSize:16 }}>🔔 Dunning — Payment Recovery</div>
              <div style={{ background:"rgba(245,158,11,0.07)", border:"1px solid rgba(245,158,11,0.25)", borderRadius:12, padding:14, fontSize:13, color:cs.textDim, lineHeight:1.6 }}>
                ⚠️ Invoice <b style={{ color:cs.text }}>inv_049</b> failed on 2026-03-01. Dunning sequence active — automatically retrying payment and notifying customer.
              </div>
              <div style={{ background:cs.bg, borderRadius:14, padding:20, border:`1px solid ${cs.border}` }}>
                <div style={{ fontWeight:700, color:cs.text, marginBottom:16, fontSize:14 }}>Recovery Timeline</div>
                <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
                  {DUNNING_STEPS.map((step, i) => (
                    <div key={i} style={{ display:"flex", gap:14, alignItems:"flex-start", paddingBottom:i<DUNNING_STEPS.length-1?16:0 }}>
                      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", flexShrink:0 }}>
                        <div style={{ width:28, height:28, borderRadius:"50%", background:step.done?"#10b981":"rgba(255,255,255,0.08)", border:`2px solid ${step.done?"#10b981":"rgba(255,255,255,0.15)"}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, color:step.done?"#fff":cs.textDim, fontWeight:700 }}>
                          {step.done?"✓":i+1}
                        </div>
                        {i<DUNNING_STEPS.length-1 && <div style={{ width:2, flex:1, minHeight:20, background:step.done?"rgba(16,185,129,0.3)":"rgba(255,255,255,0.06)", marginTop:4 }} />}
                      </div>
                      <div style={{ paddingTop:4 }}>
                        <div style={{ fontWeight:600, color:step.done?cs.text:cs.textDim, fontSize:13 }}>Day {step.day}: {step.action}</div>
                        <div style={{ fontSize:11, color:cs.textDim, marginTop:2 }}>via {step.channel}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background:cs.bg, borderRadius:14, padding:20, border:`1px solid ${cs.border}` }}>
                <div style={{ fontWeight:700, color:cs.text, marginBottom:14, fontSize:14 }}>Configure Dunning</div>
                {[
                  { label:"Grace period before downgrade", default:"14 days" },
                  { label:"Max retry attempts", default:"3" },
                  { label:"Days between retries", default:"3, 4, 7" },
                ].map(f => (
                  <div key={f.label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:`1px solid ${cs.border}` }}>
                    <span style={{ fontSize:13, color:cs.text }}>{f.label}</span>
                    <input defaultValue={f.default} style={{ background:"rgba(255,255,255,0.05)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:7, padding:"5px 11px", fontSize:12, outline:"none", width:120, textAlign:"center" }} />
                  </div>
                ))}
                <button style={{ marginTop:14, background:"linear-gradient(135deg,#10b981,#6366f1)", border:"none", color:"#fff", borderRadius:10, padding:"9px 22px", cursor:"pointer", fontWeight:700, fontSize:13 }}>Save Dunning Config</button>
              </div>
            </div>
          )}

          {/* ── SETTINGS ── */}
          {tab==="settings" && (
            <div style={{ display:"flex", flexDirection:"column", gap:16, maxWidth:600 }}>
              <div style={{ fontWeight:700, color:cs.text, fontSize:16 }}>⚙️ Billing Settings</div>
              <div style={{ background:cs.bg, borderRadius:14, padding:20, border:`1px solid ${cs.border}` }}>
                <div style={{ fontWeight:700, color:cs.text, marginBottom:14, fontSize:14 }}>Overage Alerts</div>
                <div style={{ marginBottom:14 }}>
                  <label style={{ fontSize:12, fontWeight:600, color:cs.textDim, display:"block", marginBottom:6 }}>Alert me when usage hits — {alertThreshold}%</label>
                  <input type="range" min={50} max={100} value={alertThreshold} onChange={e=>setAlertThreshold(e.target.value)} style={{ width:"100%", accentColor:"#10b981" }} />
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 0", borderTop:`1px solid ${cs.border}` }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:cs.text }}>Auto-upgrade on limit hit</div>
                    <div style={{ fontSize:11, color:cs.textDim }}>Automatically move to next plan when included usage exhausted</div>
                  </div>
                  <div onClick={()=>setAutoUpgrade(p=>!p)} style={{ width:44, height:24, borderRadius:12, background:autoUpgrade?"#10b981":"rgba(255,255,255,0.1)", cursor:"pointer", position:"relative", transition:"background .2s" }}>
                    <div style={{ position:"absolute", top:3, left:autoUpgrade?22:3, width:18, height:18, borderRadius:"50%", background:"#fff", transition:"left .2s" }} />
                  </div>
                </div>
              </div>
              <div style={{ background:cs.bg, borderRadius:14, padding:20, border:`1px solid ${cs.border}` }}>
                <div style={{ fontWeight:700, color:cs.text, marginBottom:14, fontSize:14 }}>Payment Method</div>
                <div style={{ display:"flex", alignItems:"center", gap:12, padding:12, background:"rgba(255,255,255,0.04)", borderRadius:10, border:`1px solid ${cs.border}` }}>
                  <div style={{ fontSize:24 }}>💳</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600, color:cs.text, fontSize:13 }}>Visa ending 4242</div>
                    <div style={{ fontSize:11, color:cs.textDim }}>Expires 08/2028</div>
                  </div>
                  <button style={{ background:"transparent", border:`1px solid ${cs.border}`, color:cs.textDim, borderRadius:7, padding:"5px 12px", cursor:"pointer", fontSize:11 }}>Change</button>
                </div>
                <button style={{ marginTop:12, background:"transparent", border:`1px solid rgba(99,102,241,0.4)`, color:"#6366f1", borderRadius:9, padding:"8px 18px", cursor:"pointer", fontWeight:600, fontSize:13, display:"block" }}>+ Add Payment Method</button>
              </div>
              <button onClick={()=>{setSaved(true);setTimeout(()=>setSaved(false),2000);}} style={{ background:saved?"#10b981":"linear-gradient(135deg,#10b981,#6366f1)", border:"none", color:"#fff", borderRadius:12, padding:"11px 28px", cursor:"pointer", fontWeight:800, fontSize:14, alignSelf:"flex-start", transition:"background .3s" }}>
                {saved?"✓ Saved!":"Save Settings"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
