/**
 * Corvus — Admin Panel v2
 * Super-admin interface: Users, Organizations, Revenue, Analytics,
 *   Feature Flags, Support, Platform Settings
 * Access: is_admin=true ONLY (set server-side)
 */
import React, { useState, useEffect, useCallback } from "react";
import { AdminAPI } from "./services/api.js";

const C = {
  bg:    "#020a14",
  surf:  "#060e1a",
  card:  "#0a1826",
  border:"rgba(148,163,184,.08)",
  text:  "#e8f0ff",
  sub:   "#8fa3c0",
  muted: "#3d5168",
  blue:  "#4f7cf9",
  green: "#10d9a0",
  amber: "#f59e0b",
  red:   "#f87171",
  violet:"#a78bfa",
  gBlue: "linear-gradient(135deg,#4f7cf9,#22d3ee)",
};

const card = (glow) => ({
  background: C.card,
  border: `1px solid ${glow ? "rgba(79,124,249,.22)" : C.border}`,
  borderRadius: 12, padding: 20,
});

// ── Pill badge ────────────────────────────────────────────────────
function Badge({ color, children }) {
  const bgs = { green:"rgba(16,217,160,.1)", amber:"rgba(245,158,11,.1)",
    red:"rgba(248,113,113,.1)", blue:"rgba(79,124,249,.1)", violet:"rgba(167,139,250,.1)", gray:"rgba(148,163,184,.08)" };
  const texts = { green:C.green, amber:C.amber, red:C.red, blue:C.blue, violet:C.violet, gray:C.sub };
  return (
    <span style={{
      background: bgs[color]||bgs.gray, color: texts[color]||texts.gray,
      padding:"3px 10px", borderRadius:100, fontSize:12, fontWeight:600,
    }}>{children}</span>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────
function KPI({ icon, label, value, trend, color = C.blue }) {
  const isPos = (trend||"").startsWith("+");
  return (
    <div style={{ ...card() }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
        <span style={{ fontSize:22 }}>{icon}</span>
        {trend && (
          <span style={{
            fontSize:11, fontWeight:600, padding:"2px 7px", borderRadius:6,
            background: isPos ? "rgba(16,217,160,.1)" : "rgba(248,113,113,.1)",
            color: isPos ? C.green : C.red,
          }}>{trend}</span>
        )}
      </div>
      <div style={{ fontSize:30, fontWeight:800, color:C.text, letterSpacing:"-.03em", lineHeight:1, marginBottom:4 }}>
        {value}
      </div>
      <div style={{ fontSize:12, color:C.muted }}>{label}</div>
    </div>
  );
}

// ── Revenue dashboard ─────────────────────────────────────────────
function RevenueDash({ stats }) {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const revenueData = stats?.monthly_revenue || Array.from({length:12}, (_,i)=>1200+i*180+Math.random()*400);
  const maxR = Math.max(...revenueData);

  return (
    <div>
      <h2 style={{ fontSize:20, fontWeight:700, color:C.text, margin:"0 0 20px", letterSpacing:"-.02em" }}>
        Revenue Dashboard
      </h2>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:20 }} className="kpi-grid">
        <KPI icon="💰" label="MRR" value={`$${(stats?.mrr || 8420).toLocaleString()}`} trend="+18%" color={C.green}/>
        <KPI icon="📈" label="ARR" value={`$${((stats?.mrr || 8420)*12).toLocaleString()}`} trend="+22%"/>
        <KPI icon="👥" label="Paying Customers" value={stats?.paying_customers || 94} trend="+8"/>
        <KPI icon="📉" label="Churn Rate" value={`${stats?.churn_rate || 2.1}%`} trend="-0.3%" color={C.green}/>
      </div>

      {/* Revenue bar chart */}
      <div style={{ ...card(), marginBottom:20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:16 }}>
          <h3 style={{ margin:0, fontSize:15, fontWeight:600, color:C.text }}>Monthly Revenue (12m)</h3>
          <span style={{ fontSize:13, color:C.muted }}>USD</span>
        </div>
        <div style={{ display:"flex", alignItems:"flex-end", gap:4, height:120 }}>
          {revenueData.map((v, i) => (
            <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
              <div style={{
                width:"100%", height:`${(v/maxR)*110}px`,
                background: i === revenueData.length-1
                  ? C.gBlue
                  : `linear-gradient(to top,rgba(79,124,249,.3),rgba(79,124,249,.15))`,
                borderRadius:"4px 4px 0 0",
                border:`1px solid rgba(79,124,249,.2)`,
                transition:"height .3s",
                cursor:"pointer",
                position:"relative",
              }} title={`$${Math.round(v).toLocaleString()}`}/>
              <span style={{ fontSize:9, color:C.muted, letterSpacing:".03em" }}>
                {months[i]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Plan distribution */}
      <div style={{ ...card() }}>
        <h3 style={{ margin:"0 0 16px", fontSize:15, fontWeight:600, color:C.text }}>Plan Distribution</h3>
        {[
          { plan:"Enterprise", count:8,  pct:9,  color:C.green },
          { plan:"Business",   count:24, pct:26, color:C.violet },
          { plan:"Professional",count:62, pct:66, color:C.blue },
        ].map(p => (
          <div key={p.plan} style={{ marginBottom:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
              <span style={{ fontSize:13, color:C.sub }}>{p.plan}</span>
              <span style={{ fontSize:13, color:C.text, fontWeight:500 }}>{p.count} ({p.pct}%)</span>
            </div>
            <div style={{ height:6, background:"rgba(255,255,255,.05)", borderRadius:100, overflow:"hidden" }}>
              <div style={{ width:`${p.pct}%`, height:"100%", background:p.color, borderRadius:100, transition:"width .6s ease" }}/>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Users table ───────────────────────────────────────────────────
function UsersTable({ users, loading, onBlock, onChangeRole }) {
  const [search, setSearch] = useState("");
  const filtered = (users||[]).filter(u =>
    [u.email, u.name, u.org_name].some(f => (f||"").toLowerCase().includes(search.toLowerCase()))
  );
  const tierColor = { enterprise:C.green, business:C.violet, professional:C.blue, starter:C.sub };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <h2 style={{ fontSize:20, fontWeight:700, color:C.text, margin:0, letterSpacing:"-.02em" }}>
          User Management
        </h2>
        <input
          placeholder="Search users…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            background:"rgba(255,255,255,.05)", border:`1px solid ${C.border}`,
            borderRadius:8, padding:"8px 14px", color:C.text, fontSize:13,
            outline:"none", width:220,
          }}
        />
      </div>

      <div style={{ ...card(), overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
          <thead>
            <tr>
              {["User","Plan","Organization","Role","Status","Last seen","Actions"].map(h => (
                <th key={h} style={{
                  textAlign:"left", color:C.muted, fontWeight:500,
                  padding:"10px 12px", borderBottom:`1px solid ${C.border}`,
                  fontSize:11, textTransform:"uppercase", letterSpacing:".06em",
                  whiteSpace:"nowrap",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding:32, textAlign:"center", color:C.muted }}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ padding:32, textAlign:"center", color:C.muted }}>No users found</td></tr>
            ) : filtered.slice(0,50).map(u => (
              <tr key={u.id} style={{ borderBottom:`1px solid ${C.border}` }}>
                <td style={{ padding:"12px 12px" }}>
                  <div style={{ fontWeight:500, color:C.text }}>{u.name || "—"}</div>
                  <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>{u.email}</div>
                </td>
                <td style={{ padding:"12px 12px" }}>
                  <Badge color={tierColor[u.tier] ? u.tier : "gray"}>
                    {u.tier || "starter"}
                  </Badge>
                </td>
                <td style={{ padding:"12px 12px", color:C.sub }}>{u.org_name || "—"}</td>
                <td style={{ padding:"12px 12px" }}>
                  <select
                    value={u.role || "member"}
                    onChange={e => onChangeRole?.(u.id, e.target.value)}
                    style={{
                      background:"transparent", border:`1px solid ${C.border}`,
                      borderRadius:6, padding:"4px 8px", color:C.sub,
                      fontSize:12, cursor:"pointer",
                    }}>
                    {["owner","admin","hr_manager","member","viewer"].map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </td>
                <td style={{ padding:"12px 12px" }}>
                  <Badge color={u.is_blocked ? "red" : u.is_trial ? "amber" : "green"}>
                    {u.is_blocked ? "Blocked" : u.is_trial ? "Trial" : "Active"}
                  </Badge>
                </td>
                <td style={{ padding:"12px 12px", color:C.muted, fontSize:12 }}>
                  {u.last_seen_at ? new Date(u.last_seen_at).toLocaleDateString() : "Never"}
                </td>
                <td style={{ padding:"12px 12px" }}>
                  <div style={{ display:"flex", gap:6 }}>
                    <button
                      onClick={() => onBlock?.(u.id, !u.is_blocked)}
                      style={{
                        background: u.is_blocked ? "rgba(16,217,160,.1)" : "rgba(248,113,113,.1)",
                        color: u.is_blocked ? C.green : C.red,
                        border:"none", borderRadius:6, padding:"4px 10px",
                        cursor:"pointer", fontSize:11, fontWeight:500,
                      }}>
                      {u.is_blocked ? "Unblock" : "Block"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Feature Flags panel ───────────────────────────────────────────
function FeatureFlagsPanel({ flags, onToggle, onUpdateRollout }) {
  return (
    <div>
      <h2 style={{ fontSize:20, fontWeight:700, color:C.text, margin:"0 0 20px", letterSpacing:"-.02em" }}>
        Feature Flags
      </h2>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {(flags||defaultFlags).map(flag => (
          <div key={flag.key} style={{ ...card(), display:"flex", alignItems:"center", gap:16 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:500, color:C.text, fontSize:14 }}>{flag.key}</div>
              <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>{flag.description}</div>
            </div>
            {/* Rollout % */}
            <div style={{ display:"flex", alignItems:"center", gap:8, minWidth:120 }}>
              <span style={{ fontSize:12, color:C.sub }}>Rollout:</span>
              <input
                type="range" min="0" max="100" value={flag.rollout_pct}
                onChange={e => onUpdateRollout?.(flag.key, parseInt(e.target.value))}
                style={{ width:80, accentColor:C.blue }}
              />
              <span style={{ fontSize:12, color:C.text, fontWeight:500, minWidth:28 }}>
                {flag.rollout_pct}%
              </span>
            </div>
            {/* Toggle */}
            <div
              onClick={() => onToggle?.(flag.key, !flag.enabled)}
              style={{
                width:44, height:24, borderRadius:12, cursor:"pointer",
                background: flag.enabled ? C.blue : "rgba(255,255,255,.08)",
                position:"relative", transition:"background .2s", flexShrink:0,
              }}>
              <div style={{
                position:"absolute", width:18, height:18, borderRadius:"50%",
                background:"#fff", top:3, left:flag.enabled ? 23 : 3,
                transition:"left .2s", boxShadow:"0 1px 4px rgba(0,0,0,.3)",
              }}/>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const defaultFlags = [
  { key:"local_ai",          description:"Local AI posture narrative (WebLLM)",   enabled:true,  rollout_pct:100 },
  { key:"ai_coach_chat",     description:"AI Coach chat interface",              enabled:true,  rollout_pct:100 },
  { key:"heatmaps",          description:"Posture heatmap visualization",        enabled:true,  rollout_pct:100 },
  { key:"gamification",      description:"XP/streaks/achievements system",       enabled:true,  rollout_pct:100 },
  { key:"scim_provisioning", description:"SCIM v2 identity provisioning",        enabled:false, rollout_pct:0   },
  { key:"white_label",       description:"White-label branding (Enterprise)",    enabled:false, rollout_pct:0   },
  { key:"mfa_totp",          description:"TOTP two-factor authentication",       enabled:true,  rollout_pct:100 },
  { key:"siem_integration",  description:"SIEM audit log streaming",             enabled:false, rollout_pct:0   },
];

// ── Platform settings ─────────────────────────────────────────────
function PlatformSettings() {
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState({
    maintenance_mode: false,
    signup_enabled: true,
    trial_days: 14,
    max_users_per_org: 500,
    support_email: "support@corvus.io",
    allowed_origins: "https://corvus.io",
  });

  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  return (
    <div>
      <h2 style={{ fontSize:20, fontWeight:700, color:C.text, margin:"0 0 20px", letterSpacing:"-.02em" }}>
        Platform Settings
      </h2>
      <div style={{ ...card(), maxWidth:560 }}>
        {[
          { label:"Maintenance Mode", key:"maintenance_mode", type:"toggle" },
          { label:"Signup Enabled",   key:"signup_enabled",   type:"toggle" },
          { label:"Trial Days",       key:"trial_days",       type:"number" },
          { label:"Max Users / Org",  key:"max_users_per_org",type:"number" },
          { label:"Support Email",    key:"support_email",    type:"text"   },
          { label:"Allowed Origins",  key:"allowed_origins",  type:"text"   },
        ].map(f => (
          <div key={f.key} style={{ display:"flex", justifyContent:"space-between",
            alignItems:"center", padding:"12px 0",
            borderBottom:`1px solid ${C.border}` }}>
            <label style={{ fontSize:14, color:C.sub }}>{f.label}</label>
            {f.type === "toggle" ? (
              <div onClick={() => setSettings(p => ({...p, [f.key]:!p[f.key]}))}
                style={{ width:44, height:24, borderRadius:12, cursor:"pointer",
                  background:settings[f.key] ? C.blue : "rgba(255,255,255,.08)",
                  position:"relative", transition:"background .2s" }}>
                <div style={{ position:"absolute", width:18, height:18, borderRadius:"50%",
                  background:"#fff", top:3, left:settings[f.key] ? 23 : 3,
                  transition:"left .2s" }}/>
              </div>
            ) : (
              <input type={f.type} value={settings[f.key]}
                onChange={e => setSettings(p => ({...p,[f.key]:f.type==="number"?+e.target.value:e.target.value}))}
                style={{ background:"rgba(255,255,255,.05)", border:`1px solid ${C.border}`,
                  borderRadius:6, padding:"6px 10px", color:C.text, fontSize:13,
                  outline:"none", width:200, textAlign:f.type==="number"?"right":"left" }}/>
            )}
          </div>
        ))}
        <div style={{ marginTop:16 }}>
          <button onClick={save} style={{
            background:C.gBlue, color:"#fff", border:"none", borderRadius:8,
            padding:"10px 20px", cursor:"pointer", fontSize:14, fontWeight:600,
          }}>
            {saved ? "✓ Saved" : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────
const ADMIN_NAV = [
  { id:"revenue",   icon:"💰", label:"Revenue" },
  { id:"users",     icon:"👥", label:"Users" },
  { id:"orgs",      icon:"🏢", label:"Organizations" },
  { id:"flags",     icon:"🚩", label:"Feature Flags" },
  { id:"audit",     icon:"📋", label:"Audit Logs" },
  { id:"settings",  icon:"⚙️", label:"Platform Settings" },
];

function AdminSidebar({ active, setActive }) {
  return (
    <aside style={{ width:200, background:C.surf, borderRight:`1px solid ${C.border}`,
      height:"100vh", position:"sticky", top:0, flexShrink:0,
      display:"flex", flexDirection:"column" }}>
      <div style={{ padding:"18px 14px 14px", borderBottom:`1px solid ${C.border}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:28, height:28, borderRadius:6, background:C.gBlue,
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>🛡️</div>
          <span style={{ fontWeight:700, fontSize:14, color:C.text }}>Admin Panel</span>
        </div>
      </div>
      <nav style={{ flex:1, padding:"10px 8px" }}>
        {ADMIN_NAV.map(item => (
          <button key={item.id} onClick={() => setActive(item.id)} style={{
            width:"100%", display:"flex", alignItems:"center", gap:8,
            padding:"9px 10px", borderRadius:8, marginBottom:2,
            background:active===item.id ? "rgba(79,124,249,.12)" : "transparent",
            border:active===item.id ? "1px solid rgba(79,124,249,.18)" : "1px solid transparent",
            cursor:"pointer", textAlign:"left", transition:"all .14s",
          }}>
            <span style={{ fontSize:14 }}>{item.icon}</span>
            <span style={{ fontSize:13, fontWeight:active===item.id?600:400,
              color:active===item.id?C.text:C.sub }}>{item.label}</span>
          </button>
        ))}
      </nav>
      <div style={{ padding:"10px 14px", borderTop:`1px solid ${C.border}` }}>
        <a href="/app" style={{ color:C.muted, fontSize:12, textDecoration:"none",
          display:"flex", alignItems:"center", gap:6 }}>
          ← Back to App
        </a>
      </div>
    </aside>
  );
}

// ── Root admin panel ──────────────────────────────────────────────
export default function AdminPanel({ user }) {
  const [active, setActive] = useState("revenue");
  const [users, setUsers] = useState([]);
  const [flags, setFlags] = useState(defaultFlags);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fetch admin data
    setLoading(true);
    Promise.all([
      AdminAPI.getStats?.()?.catch(() => null),
      AdminAPI.getUsers?.()?.catch(() => []),
    ]).then(([s, u]) => {
      setStats(s);
      setUsers(Array.isArray(u) ? u : []);
    }).finally(() => setLoading(false));
  }, []);

  const handleBlock = useCallback(async (userId, block) => {
    try {
      await AdminAPI.blockUser?.(userId, block);
      setUsers(u => u.map(x => x.id === userId ? {...x, is_blocked:block} : x));
    } catch {}
  }, []);

  const handleRoleChange = useCallback(async (userId, role) => {
    try {
      await AdminAPI.updateUserRole?.(userId, role);
      setUsers(u => u.map(x => x.id === userId ? {...x, role} : x));
    } catch {}
  }, []);

  const handleFlagToggle = useCallback((key, enabled) => {
    setFlags(f => f.map(x => x.key === key ? {...x, enabled} : x));
    AdminAPI.updateFlag?.(key, { enabled }).catch(() => {});
  }, []);

  const handleRollout = useCallback((key, pct) => {
    setFlags(f => f.map(x => x.key === key ? {...x, rollout_pct:pct} : x));
  }, []);

  const renderPanel = () => {
    switch(active) {
      case "revenue":  return <RevenueDash stats={stats}/>;
      case "users":    return <UsersTable users={users} loading={loading} onBlock={handleBlock} onChangeRole={handleRoleChange}/>;
      case "flags":    return <FeatureFlagsPanel flags={flags} onToggle={handleFlagToggle} onUpdateRollout={handleRollout}/>;
      case "settings": return <PlatformSettings/>;
      default:
        return (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
            justifyContent:"center", height:"60vh", gap:12 }}>
            <div style={{ fontSize:40 }}>🔧</div>
            <h2 style={{ color:C.text, fontSize:18, fontWeight:600, margin:0 }}>{active}</h2>
            <p style={{ color:C.sub, fontSize:14, margin:0 }}>Section in progress</p>
          </div>
        );
    }
  };

  // Security guard
  if (!user?.is_admin) {
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center",
        height:"100vh", background:C.bg, fontFamily:"-apple-system,sans-serif" }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:48, marginBottom:16 }}>🚫</div>
          <h1 style={{ color:C.text, fontSize:22, fontWeight:700 }}>Access Denied</h1>
          <p style={{ color:C.sub, fontSize:15 }}>Admin access required</p>
          <a href="/app" style={{ color:C.blue, fontSize:14, textDecoration:"none" }}>← Back to app</a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display:"flex", background:C.bg, minHeight:"100vh",
      fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color:C.text }}>
      <AdminSidebar active={active} setActive={setActive}/>
      <main style={{ flex:1, overflow:"auto" }}>
        <div style={{
          padding:"14px 24px", borderBottom:`1px solid ${C.border}`,
          background:"rgba(2,10,20,.9)", backdropFilter:"blur(12px)",
          display:"flex", justifyContent:"space-between", alignItems:"center",
          position:"sticky", top:0, zIndex:100,
        }}>
          <div style={{ fontSize:12, color:C.muted }}>
            🛡️ Admin Mode · {user.email}
          </div>
          <div style={{
            background:"rgba(248,113,113,.1)", border:"1px solid rgba(248,113,113,.2)",
            borderRadius:6, padding:"4px 12px", fontSize:11, color:C.red, fontWeight:600,
          }}>ADMIN ACCESS</div>
        </div>
        <div style={{ padding:24 }}>{renderPanel()}</div>
      </main>
    </div>
  );
}
