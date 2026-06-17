/**
 * AnnouncementsBar.jsx — Corvus ULTIMATE FINAL
 * In-app announcements banner with dismiss, type icons, and auto-fetch
 */
import { useState, useEffect } from "react";
const API = import.meta.env.VITE_API_URL || "/api";

const TYPE_CONFIG = {
  feature:  { icon:"🚀", color:"#6366f1", bg:"rgba(99,102,241,.12)" },
  security: { icon:"🔐", color:"#f59e0b", bg:"rgba(245,158,11,.12)" },
  tip:      { icon:"💡", color:"#10b981", bg:"rgba(16,185,129,.12)" },
  warning:  { icon:"⚠️", color:"#ef4444", bg:"rgba(239,68,68,.12)" },
};

export default function AnnouncementsBar({ token }) {
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/announcements`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(r => r.ok ? r.json() : null)
    .then(d => { if (d?.announcements) setAnnouncements(d.announcements); })
    .catch(() => {});
  }, [token]);

  const dismiss = async (id) => {
    setAnnouncements(a => a.filter(x => x.id !== id));
    if (!token) return;
    await fetch(`${API}/announcements/${id}/dismiss`, {
      method:"POST", headers: { Authorization: `Bearer ${token}` }
    }).catch(() => {});
  };

  if (!announcements.length) return null;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:16 }}>
      {announcements.map(ann => {
        const cfg = TYPE_CONFIG[ann.type] || TYPE_CONFIG.tip;
        return (
          <div key={ann.id} style={{
            display:"flex", alignItems:"center", gap:12,
            padding:"10px 16px", borderRadius:10,
            background:cfg.bg, border:`1px solid ${cfg.color}30`,
          }}>
            <span style={{ fontSize:18, flexShrink:0 }}>{cfg.icon}</span>
            <div style={{ flex:1 }}>
              <span style={{ fontSize:13, fontWeight:700, color:cfg.color }}>{ann.title} </span>
              <span style={{ fontSize:13, color:"#94a3b8" }}>{ann.body}</span>
            </div>
            <button onClick={() => dismiss(ann.id)} style={{
              background:"transparent", border:"none", color:"#475569",
              cursor:"pointer", fontSize:18, lineHeight:1, padding:"0 4px",
            }}>×</button>
          </div>
        );
      })}
    </div>
  );
}
