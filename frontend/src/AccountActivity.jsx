/**
 * AccountActivity.jsx — Corvus Enterprise
 * Full account activity timeline: actions, logins, billing events, team changes
 *
 * Fixed 2026-07-25 — both API calls here had a doubled "/api" prefix
 * (apiFetch already prepends it), so they 404'd on every single call,
 * 100% of the time, for every user. The failure was swallowed by an
 * empty catch block, so this silently fell back to MOCK_ACTIVITY
 * forever — fabricated logins, a fake device location ("Giza, Egypt"),
 * a fake MFA-enabled event, fake invoice amounts — shown to every user
 * as if it were their own real history. Nobody could ever have seen
 * their real activity log through this screen.
 */
import { useState, useEffect, useCallback } from "react";
import { db, auth } from "./firebase.js";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { useBodyScrollLock } from "./lib/useBodyScrollLock.js";

const TYPE_COLORS = {
  login:"#6366f1", analysis:"#0ea5e9", billing:"#f59e0b",
  security:"#ef4444", team:"#10b981", profile:"#8b5cf6",
};
const SEV_COLORS = { info:"#64748b", success:"#10b981", warning:"#f59e0b", error:"#ef4444" };

export function AccountActivity({ profile, cs, lang, onClose }) {
  useBodyScrollLock();
  const [filter, setFilter]     = useState("all");
  const [activity, setActivity] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const fetchActivity = useCallback(async () => {
    setLoading(true); setLoadError(false);
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) { setLoadError(true); return; }
      // Read from audit_logs collection (written by serverless functions)
      const snap = await getDocs(
        query(collection(db, "audit_logs"), where("uid","==",uid), orderBy("timestamp","desc"), limit(100))
      );
      const ICONS = { login:"🔐", analysis:"📷", billing:"💳", security:"🛡", team:"👥", profile:"👤" };
      const events = snap.docs.map(d => {
        const e = d.data();
        return {
          id: d.id, ts: e.timestamp || e.created_at || "",
          type: e.category || "info",
          icon: ICONS[e.category] || "📌",
          title: (e.action||"").replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase()),
          detail: e.detail || "",
          severity: e.severity || "info",
        };
      });
      setActivity(events);
      if (events.length === 0) {
        // Seed a welcome event if no audit log yet
        setActivity([{
          id:"welcome", ts: new Date().toISOString(), type:"info", icon:"🎉",
          title:"Account Created", detail:"Welcome to Corvus PostureAI!", severity:"info",
        }]);
      }
    } catch(e) { console.warn("[AccountActivity]", e.message); setLoadError(true); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchActivity(); }, [fetchActivity]);

  const exportCsv = async () => {
    setExporting(true); setExportError("");
    try {
      // BUG FIX: this used to call exportAuditLogCsv(), a function that was
      // never defined anywhere in the codebase — clicking Export crashed
      // the whole component with a ReferenceError for every user. The
      // activity data is already loaded client-side, so generate the CSV
      // directly from it instead of needing a round-trip to a new endpoint.
      const esc = (v) => `"${String(v ?? "").replace(/"/g,'""')}"`;
      const header = ["Date","Type","Title","Detail","Severity"].map(esc).join(",");
      const rows = filtered.map(a => [a.ts, a.type, a.title, a.detail, a.severity].map(esc).join(","));
      const csv = [header, ...rows].join("\r\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = `activity_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch(e) { setExportError(e?.message || "Export failed"); }
    setExporting(false);
  };

  const types = ["all","login","analysis","billing","security","team","profile"];
  const filtered = filter === "all" ? activity : activity.filter(a => a.type === filter);

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.76)", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:cs.card, borderRadius:20, width:"100%", maxWidth:780, height:"86dvh", display:"flex", flexDirection:"column", overflow:"hidden", border:`1px solid ${cs.border}`, boxShadow:"0 32px 80px rgba(0,0,0,0.5)" }}>
        <div style={{ padding:"20px 28px", borderBottom:`1px solid ${cs.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:44, height:44, borderRadius:12, background:"linear-gradient(135deg,#8b5cf6,#6366f1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>📜</div>
            <div>
              <div style={{ fontWeight:800, fontSize:20, color:cs.text }}>Account Activity</div>
              <div style={{ fontSize:12, color:cs.muted }}>Everything that happened in your account</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.07)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:10, padding:"8px 14px", cursor:"pointer", fontSize:13 }} aria-label="Close">✕</button>
        </div>
        <div style={{ display:"flex", gap:6, padding:"12px 20px", borderBottom:`1px solid ${cs.border}`, flexWrap:"wrap" }}>
          {types.map(t => (
            <button key={t} onClick={() => setFilter(t)} style={{ padding:"4px 12px", borderRadius:20, border:"1px solid", fontSize:11, cursor:"pointer", fontWeight:600,
              borderColor: filter===t?(TYPE_COLORS[t]||"#6366f1"):cs.border,
              background:  filter===t?`${TYPE_COLORS[t]||"#6366f1"}18`:"transparent",
              color:       filter===t?(TYPE_COLORS[t]||"#6366f1"):cs.muted }}>
              {t === "all" ? `All (${activity.length})` : t}
            </button>
          ))}
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"20px 28px" }}>
          {loading && <div style={{ textAlign:"center", color:cs.muted, padding:40 }}>Loading activity…</div>}
          {!loading && loadError && <div style={{ textAlign:"center", color:"#ef4444", padding:40 }}>Couldn't load your activity log — try again later.</div>}
          <div style={{ display:"flex", flexDirection:"column" }}>
            {!loading && !loadError && filtered.map((event, i) => (
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
                      <div style={{ fontSize:11, color:cs.muted, marginTop:2 }}>{event.detail}</div>
                    </div>
                    <div style={{ textAlign:"right", flexShrink:0 }}>
                      <div style={{ fontSize:11, color:cs.muted, fontFamily:"monospace" }}>{event.ts}</div>
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
          {!loading && !loadError && filtered.length === 0 && <div style={{ textAlign:"center", color:cs.muted, padding:40 }}>No {filter} activity found</div>}
        </div>
        <div style={{ padding:"12px 20px", borderTop:`1px solid ${cs.border}`, fontSize:11, color:cs.muted, textAlign:"center" }}>
          {/* BUG FIX: was a <span onClick> — not focusable/keyboard-operable
              and not announced as a control, despite being the only way to
              export the log. */}
          Activity log retained for 90 days · <button onClick={exporting?undefined:exportCsv} disabled={exporting} style={{ background:"none", border:"none", padding:0, font:"inherit", color: exporting?cs.muted:"#6366f1", cursor: exporting?"default":"pointer" }}>{exporting?"Exporting…":"Export as CSV"}</button>
          {exportError && <div style={{ color:"#ef4444", marginTop:6 }}>{exportError}</div>}
        </div>
      </div>
    </div>
  );
}
