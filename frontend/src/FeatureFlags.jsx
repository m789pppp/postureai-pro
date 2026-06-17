/**
 * FeatureFlags.jsx — Corvus ULTIMATE FINAL
 * Admin: manage rollout flags with tier targeting + percentage rollout
 */
import { useState, useEffect } from "react";
const API = import.meta.env.VITE_API_URL || "/api";
const C = { bg:"#030711",card:"#0c1832",border:"rgba(99,102,241,.14)",text:"#e8eeff",
  sub:"#94a3b8",primary:"#6366f1",green:"#10b981",amber:"#f59e0b",red:"#ef4444",surf:"#08112a" };

const TIERS = ["starter","standard","professional","elite","enterprise"];

export default function FeatureFlags({ token }) {
  const [flags, setFlags]     = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(null);
  const [newFlag, setNewFlag] = useState({ key:"", enabled:false, rollout_pct:100, tiers:["professional","elite","enterprise"] });
  const [showNew, setShowNew] = useState(false);

  const load = () => {
    fetch(`${API}/admin/feature-flags`, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => r.ok ? r.json() : null)
    .then(d => { if (d?.flags) setFlags(d.flags); setLoading(false); })
    .catch(() => setLoading(false));
  };
  useEffect(load, [token]);

  const toggle = async (key, current) => {
    setSaving(key);
    await fetch(`${API}/admin/feature-flags`, {
      method:"PATCH",
      headers:{ "Content-Type":"application/json", Authorization:`Bearer ${token}` },
      body: JSON.stringify({ key, enabled: !current.enabled })
    });
    setFlags(f => ({ ...f, [key]: { ...f[key], enabled: !f[key].enabled } }));
    setSaving(null);
  };

  const updateRollout = async (key, pct) => {
    setSaving(key);
    await fetch(`${API}/admin/feature-flags`, {
      method:"PATCH",
      headers:{ "Content-Type":"application/json", Authorization:`Bearer ${token}` },
      body: JSON.stringify({ key, rollout_pct: parseInt(pct) })
    });
    setFlags(f => ({ ...f, [key]: { ...f[key], rollout_pct: parseInt(pct) } }));
    setSaving(null);
  };

  const createFlag = async () => {
    if (!newFlag.key.trim()) return;
    const resp = await fetch(`${API}/admin/feature-flags`, {
      method:"POST",
      headers:{ "Content-Type":"application/json", Authorization:`Bearer ${token}` },
      body: JSON.stringify(newFlag)
    });
    if (resp.ok) { load(); setShowNew(false); setNewFlag({ key:"",enabled:false,rollout_pct:100,tiers:["professional","elite","enterprise"] }); }
  };

  return (
    <div style={{ background:C.bg, minHeight:"100vh", padding:"32px 24px",
      color:C.text, maxWidth:1000, margin:"0 auto", fontFamily:"'Sora',sans-serif" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:28 }}>
        <div>
          <h1 style={{ fontSize:26, fontWeight:800, margin:"0 0 4px", letterSpacing:"-.03em" }}>Feature Flags</h1>
          <p style={{ color:C.sub, margin:0, fontSize:14 }}>Control feature rollout by tier and percentage</p>
        </div>
        <button onClick={() => setShowNew(!showNew)} style={{ padding:"10px 20px", borderRadius:9,
          background:C.primary, color:"#fff", border:"none", fontWeight:600, cursor:"pointer" }}>
          + New Flag
        </button>
      </div>

      {/* New flag form */}
      {showNew && (
        <div style={{ background:C.card, borderRadius:16, padding:"24px", border:`1px solid ${C.border}`, marginBottom:20 }}>
          <h3 style={{ margin:"0 0 16px", fontSize:15 }}>Create Flag</h3>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            <div>
              <label style={{ fontSize:12, color:C.sub, display:"block", marginBottom:4 }}>Flag Key</label>
              <input value={newFlag.key} onChange={e => setNewFlag(f=>({...f,key:e.target.value.toLowerCase().replace(/\s+/g,"_")}))}
                placeholder="my_feature_name" style={{ width:"100%", padding:"10px 12px", borderRadius:8,
                background:C.surf, border:`1px solid ${C.border}`, color:C.text, fontSize:14 }} />
            </div>
            <div>
              <label style={{ fontSize:12, color:C.sub, display:"block", marginBottom:4 }}>Rollout %</label>
              <input type="number" min={0} max={100} value={newFlag.rollout_pct}
                onChange={e => setNewFlag(f=>({...f,rollout_pct:parseInt(e.target.value)||0}))}
                style={{ width:"100%", padding:"10px 12px", borderRadius:8,
                background:C.surf, border:`1px solid ${C.border}`, color:C.text, fontSize:14 }} />
            </div>
          </div>
          <div style={{ marginTop:12 }}>
            <label style={{ fontSize:12, color:C.sub, display:"block", marginBottom:8 }}>Tiers</label>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {TIERS.map(t => (
                <label key={t} style={{ display:"flex", alignItems:"center", gap:6, fontSize:13, cursor:"pointer" }}>
                  <input type="checkbox" checked={newFlag.tiers.includes(t)}
                    onChange={e => setNewFlag(f => ({
                      ...f, tiers: e.target.checked ? [...f.tiers,t] : f.tiers.filter(x=>x!==t)
                    }))} />
                  {t}
                </label>
              ))}
            </div>
          </div>
          <div style={{ marginTop:16, display:"flex", gap:10 }}>
            <button onClick={createFlag} style={{ padding:"9px 20px", borderRadius:8, background:C.green,
              color:"#fff", border:"none", fontWeight:600, cursor:"pointer" }}>Create</button>
            <button onClick={() => setShowNew(false)} style={{ padding:"9px 20px", borderRadius:8,
              background:"transparent", color:C.sub, border:`1px solid ${C.border}`, cursor:"pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Flags list */}
      {loading ? (
        <div style={{ textAlign:"center", padding:"48px", color:C.sub }}>Loading flags…</div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {Object.entries(flags).map(([key, cfg]) => (
            <div key={key} style={{ background:C.card, borderRadius:14, padding:"20px 24px",
              border:`1px solid ${saving===key ? C.primary : C.border}`,
              display:"grid", gridTemplateColumns:"1fr auto auto auto", gap:20, alignItems:"center",
              transition:"border-color .15s" }}>
              <div>
                <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:14, fontWeight:600, color:C.primary }}>
                  {key}
                </div>
                <div style={{ fontSize:12, color:C.sub, marginTop:4 }}>
                  Tiers: {cfg.tiers?.join(", ") || "all"} · Rollout: {cfg.rollout_pct}%
                </div>
              </div>
              <div style={{ display:"flex", gap:4 }}>
                {cfg.tiers?.map(t => (
                  <span key={t} style={{ fontSize:10, padding:"2px 7px", borderRadius:4,
                    background:`${C.primary}20`, color:C.primary, fontWeight:600 }}>{t}</span>
                ))}
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:12, color:C.sub }}>Rollout:</span>
                <input type="range" min={0} max={100} value={cfg.rollout_pct}
                  onChange={e => updateRollout(key, e.target.value)}
                  style={{ width:80 }} />
                <span style={{ fontSize:12, fontWeight:700, color:C.text, width:32 }}>{cfg.rollout_pct}%</span>
              </div>
              <div>
                <button onClick={() => toggle(key, cfg)} style={{
                  padding:"7px 18px", borderRadius:8, border:"none", fontWeight:600,
                  cursor:"pointer", fontSize:13, transition:"all .15s",
                  background: cfg.enabled ? `${C.green}22` : `${C.muted}22`,
                  color:      cfg.enabled ? C.green : C.muted,
                }}>
                  {cfg.enabled ? "● ON" : "○ OFF"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
