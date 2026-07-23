/**
 * AccountActivity.jsx — Corvus Enterprise
 * Full account activity timeline: actions, logins, billing events, team changes
 */
import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "./services/api.js";

const MOCK_ACTIVITY = [
  { id:"a1",  ts:"2026-06-04 09:14", type:"login",    icon:"🔐", title:"Signed in",              detail:"Chrome · Cairo, Egypt",           severity:"info" },
  { id:"a2",  ts:"2026-06-04 08:30", type:"analysis", icon:"📷", title:"Session analyzed",        detail:"Score: 84 · 22 frames · 22 min",  severity:"info" },
  { id:"a3",  ts:"2026-06-03 17:22", type:"billing",  icon:"💳", title:"Invoice paid",            detail:"$49.00 · Professional plan",      severity:"success" },
  { id:"a4",  ts:"2026-06-03 14:10", type:"security", icon:"🛡", title:"New device login",        detail:"Safari · iPhone · Alexandria",    severity:"warning" },
  { id:"a5",  ts:"2026-06-03 11:05", type:"team",     icon:"👥", title:"Invited team member",     detail:"ahmed@company.com",               severity:"info" },
  { id:"a6",  ts:"2026-06-02 16:45", type:"security", icon:"🔑", title:"API key created",         detail:"Key: pak_live_••••3f9a",         severity:"info" },
  { id:"a7",  ts:"2026-06-02 10:30", type:"analysis", icon:"📷", title:"Session analyzed",        detail:"Score: 71 · 14 frames · 14 min",  severity:"info" },
  { id:"a8",  ts:"2026-06-01 15:20", type:"profile",  icon:"👤", title:"Profile updated",         detail:"Changed display name",            severity:"info" },
  { id:"a9",  ts:"2026-06-01 09:00", type:"security", icon:"🛡", title:"MFA enabled (TOTP)",      detail:"Google Authenticator configured", severity:"success" },
  { id:"a10", ts:"2026-05-31 14:11", type:"billing",  icon:"💳", title:"Plan upgraded",           detail:"Starter → Professional",          severity:"success" },
  { id:"a11", ts:"2026-05-30 11:44", type:"team",     icon:"👥", title:"Team member joined",      detail:"sara@startup.io accepted invite",  severity:"info" },
  { id:"a12", ts:"2026-05-29 09:22", type:"security", icon:"⚠️",  title:"Login from new location", detail:"Giza, Egypt · Marked as trusted", severity:"warning" },
];

const TYPE_COLORS = {
  login:"#6366f1", analysis:"#0ea5e9", billing:"#f59e0b",
  security:"#ef4444", team:"#10b981", profile:"#8b5cf6",
};
const SEV_COLORS = { info:"#64748b", success:"#10b981", warning:"#f59e0b", error:"#ef4444" };

export function AccountActivity({ profile, cs, lang, onClose }) {
  const [filter, setFilter]     = useState("all");
  const [activity, setActivity] = useState(MOCK_ACTIVITY);
  const [loading, setLoading]   = useState(false);

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/user/activity");
      if (data?.ok && data.events?.length) {
        setActivity(data.events.map(e => ({
          id: e.id || e.ts, ts: e.ts,
          type: e.category || "info",
          icon: { login:"🔐", analysis:"📷", billing:"💳", security:"🛡", team:"👥", profile:"👤" }[e.category] || "📌",
          title: (e.action||"").replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase()),
          detail: e.detail || "",
          severity: e.severity || "info",
        })));
      }
    } catch(_) {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchActivity(); }, [fetchActivity]);

  const types = ["all","login","analysis","billing","security","team","profile"];
  const filtered = filter === "all" ? activity : activity.filter(a => a.type === filter);

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.76)", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:cs.card, borderRadius:20, width:"100%", maxWidth:780, height:"86vh", display:"flex", flexDirection:"column", overflow:"hidden", border:`1px solid ${cs.border}`, boxShadow:"0 32px 80px rgba(0,0,0,0.5)" }}>
        <div style={{ padding:"20px 28px", borderBottom:`1px solid ${cs.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:44, height:44, borderRadius:12, background:"linear-gradient(135deg,#8b5cf6,#6366f1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>📜</div>
            <div>
              <div style={{ fontWeight:800, fontSize:20, color:cs.text }}>Account Activity</div>
              <div style={{ fontSize:12, color:cs.textDim }}>Everything that happened in your account</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.07)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:10, padding:"8px 14px", cursor:"pointer", fontSize:13 }} aria-label="Close">✕</button>
        </div>
        <div style={{ display:"flex", gap:6, padding:"12px 20px", borderBottom:`1px solid ${cs.border}`, flexWrap:"wrap" }}>
          {types.map(t => (
            <button key={t} onClick={() => setFilter(t)} style={{ padding:"4px 12px", borderRadius:20, border:"1px solid", fontSize:11, cursor:"pointer", fontWeight:600,
              borderColor: filter===t?(TYPE_COLORS[t]||"#6366f1"):cs.border,
              background:  filter===t?`${TYPE_COLORS[t]||"#6366f1"}18`:"transparent",
              color:       filter===t?(TYPE_COLORS[t]||"#6366f1"):cs.textDim }}>
              {t === "all" ? `All (${activity.length})` : t}
            </button>
          ))}
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"20px 28px" }}>
          {loading && <div style={{ textAlign:"center", color:cs.textDim, padding:40 }}>Loading activity…</div>}
          <div style={{ display:"flex", flexDirection:"column" }}>
            {filtered.map((event, i) => (
              <div key={event.id} style={{ display:"flex", gap:14 }}>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", flexShrink:0, paddingTop:4 }}>
                  <div style={{ width:32, height:32, borderRadius:"50%", background:`${TYPE_COLORS[event.type]||"#6366f1"}18`, border:`2px solid ${TYPE_COLORS[event.type]||"#6366f1"}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>
                    {event.icon}
                  </div>
                  {i < filtered.length-1 && <div style={{ width:2, flex:1, minHeight:20, background:"rgba(255,255,255,0.06)", margin:"4px 0" }} />}
                </div>
                <div style={{ paddingBottom:i < filtered.length-1?16:0, flex:1 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                    <div>
                      <div style={{ fontWeight:700, color:cs.text, fontSize:13 }}>{event.title}</div>
                      <div style={{ fontSize:11, color:cs.textDim, marginTop:2 }}>{event.detail}</div>
                    </div>
                    <div style={{ textAlign:"right", flexShrink:0 }}>
                      <div style={{ fontSize:11, color:cs.textDim, fontFamily:"monospace" }}>{event.ts}</div>
                      {event.severity !== "info" && (
                        <span style={{ fontSize:10, fontWeight:700, padding:"1px 7px", borderRadius:20, background:`${SEV_COLORS[event.severity]}15`, color:SEV_COLORS[event.severity] }}>
                          {event.severity}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {!loading && filtered.length === 0 && <div style={{ textAlign:"center", color:cs.textDim, padding:40 }}>No {filter} activity found</div>}
        </div>
        <div style={{ padding:"12px 20px", borderTop:`1px solid ${cs.border}`, fontSize:11, color:cs.textDim, textAlign:"center" }}>
          Activity log retained for 90 days · <span style={{ color:"#6366f1", cursor:"pointer" }} onClick={async()=>{ try{ const r=await apiFetch("/api/audit/export", { method: "POST", body: {} }); }catch(_){} }}>Export as CSV</span>
        </div>
      </div>
    </div>
  );
}
