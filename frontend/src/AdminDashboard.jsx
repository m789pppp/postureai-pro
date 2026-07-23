/**
 * Corvus — Admin Dashboard v2
 * Premium redesign: refined dark, clear hierarchy, modern sidebar
 */
import { useState, useEffect, useCallback, useRef } from "react";
import {
  getAllUsers, getAllPayments, confirmPayment, rejectPayment,
  updateUserTier, updateUserProfile, getCompany,
} from "./firebase.js";
import { apiFetch } from "./services/api.js";

// ── Design tokens ──────────────────────────────────────────────────
const TOKENS = {
  bg:       "#080c14",
  surface:  "#0d1220",
  surfaceHover: "#111827",
  border:   "rgba(255,255,255,.06)",
  borderHover: "rgba(99,102,241,.4)",
  text:     "#f1f5f9",
  muted:    "#64748b",
  faint:    "#1e2840",
  blue:     "#6366f1",
  blueHover:"#818cf8",
  blueBg:   "rgba(99,102,241,.1)",
  green:    "#10b981",
  greenBg:  "rgba(16,185,129,.08)",
  amber:    "#f59e0b",
  amberBg:  "rgba(245,158,11,.08)",
  red:      "#ef4444",
  redBg:    "rgba(239,68,68,.08)",
  purple:   "#a78bfa",
  purpleBg: "rgba(167,139,250,.08)",
  sky:      "#38bdf8",
  skyBg:    "rgba(56,189,248,.08)",
  radius:   "12px",
  radiusSm: "8px",
  radiusLg: "16px",
};

const fmt   = d => d?.toDate?.()?.toLocaleDateString() || d?.split?.("T")[0] || "—";
const money = n => n ? `${Number(n).toLocaleString()} EGP` : "—";
const scoreColor = v => v >= 75 ? TOKENS.green : v >= 50 ? TOKENS.amber : TOKENS.red;
const tierMeta = {
  elite:        { color: TOKENS.purple, bg: TOKENS.purpleBg, label: "Elite" },
  professional: { color: TOKENS.sky,    bg: TOKENS.skyBg,    label: "Pro" },
  standard:     { color: TOKENS.muted,  bg: "rgba(100,116,139,.08)", label: "Free" },
};

// ── Global styles ──────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  ::-webkit-scrollbar{width:4px;height:4px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08);border-radius:99px}
  input,select,button{font-family:inherit}
  @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
  @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
  .animate-in{animation:fadeIn .3s ease both}
  .row-hover{transition:background .15s}
  .row-hover:hover{background:rgba(255,255,255,.025)!important}
`;

// ── Components ─────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon, accent, onClick, trend }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: TOKENS.surface,
        border: `1px solid ${hov && onClick ? TOKENS.borderHover : TOKENS.border}`,
        borderRadius: TOKENS.radiusLg,
        padding: "20px 22px",
        cursor: onClick ? "pointer" : "default",
        transition: "border-color .2s, transform .15s",
        transform: hov && onClick ? "translateY(-1px)" : "none",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* accent top bar */}
      <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:`linear-gradient(90deg, ${accent}80, transparent)` }} />
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
        <span style={{ fontSize:11, fontWeight:600, color:TOKENS.muted, letterSpacing:".06em", textTransform:"uppercase" }}>{label}</span>
        <div style={{ width:34, height:34, borderRadius:10, background:`${accent}18`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>{icon}</div>
      </div>
      <div style={{ fontSize:30, fontWeight:700, color:accent, lineHeight:1, letterSpacing:"-1px", marginBottom:6 }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:TOKENS.muted }}>{sub}</div>}
      {trend !== undefined && (
        <div style={{ position:"absolute", bottom:12, right:14, fontSize:10, color: trend > 0 ? TOKENS.green : TOKENS.muted }}>
          {trend > 0 ? `↑ ${trend}%` : "—"}
        </div>
      )}
    </div>
  );
}

function Card({ children, style, title, action }) {
  return (
    <div style={{ background:TOKENS.surface, border:`1px solid ${TOKENS.border}`, borderRadius:TOKENS.radiusLg, overflow:"hidden", ...style }}>
      {title && (
        <div style={{ padding:"16px 20px", borderBottom:`1px solid ${TOKENS.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontSize:13, fontWeight:600, color:TOKENS.text }}>{title}</span>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

function Badge({ label, color, bg }) {
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:4,
      fontSize:10, fontWeight:600, letterSpacing:".04em",
      padding:"3px 9px", borderRadius:99,
      color: color || TOKENS.muted,
      background: bg || "rgba(100,116,139,.1)",
    }}>{label}</span>
  );
}

function Pill({ label, active, color, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? (color || TOKENS.blue) : "transparent",
        border: `1px solid ${active ? (color || TOKENS.blue) : TOKENS.border}`,
        borderRadius: 99,
        padding: "5px 14px",
        fontSize: 11, fontWeight: 600,
        color: active ? "white" : TOKENS.muted,
        cursor: "pointer", transition: ".15s",
      }}
    >{label}</button>
  );
}

function Input({ value, onChange, placeholder, style, type = "text" }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{
        background: "rgba(255,255,255,.04)",
        border: `1px solid ${TOKENS.border}`,
        borderRadius: TOKENS.radiusSm,
        padding: "8px 14px",
        fontSize: 12, color: TOKENS.text,
        outline: "none", transition: "border-color .15s",
        fontFamily: "DM Sans, system-ui, sans-serif",
        ...style,
      }}
      onFocus={e => e.target.style.borderColor = TOKENS.blue}
      onBlur={e  => e.target.style.borderColor = TOKENS.border}
    />
  );
}

function Btn({ children, onClick, variant = "primary", disabled, size = "md", style }) {
  const styles = {
    primary: { background: TOKENS.blue,    color:"white",  border:`1px solid ${TOKENS.blue}` },
    ghost:   { background:"transparent", color:TOKENS.muted, border:`1px solid ${TOKENS.border}` },
    danger:  { background:TOKENS.redBg,    color:TOKENS.red,    border:`1px solid rgba(239,68,68,.2)` },
    success: { background:TOKENS.greenBg,  color:TOKENS.green,  border:`1px solid rgba(16,185,129,.2)` },
  };
  const pads = { sm:"4px 12px", md:"8px 18px", lg:"10px 24px" };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...styles[variant],
        borderRadius: TOKENS.radiusSm,
        padding: pads[size],
        fontSize: size === "sm" ? 10 : 12,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? .5 : 1,
        transition: ".15s",
        ...style,
      }}
    >{children}</button>
  );
}

// ── Revenue Sparkline ──────────────────────────────────────────────
function RevenueChart({ payments }) {
  const byDate = {};
  payments.forEach(p => {
    if (p.status !== "confirmed") return;
    const d = fmt(p.created_at);
    byDate[d] = (byDate[d] || 0) + (p.amount || 0);
  });
  const entries = Object.entries(byDate).slice(-14).sort((a,b) => a[0].localeCompare(b[0]));
  if (!entries.length) return (
    <div style={{ padding:"40px 0", textAlign:"center", fontSize:12, color:TOKENS.muted }}>No revenue data yet</div>
  );
  const max = Math.max(...entries.map(e => e[1]), 1);
  return (
    <div style={{ display:"flex", alignItems:"flex-end", gap:5, height:100, padding:"0 4px" }}>
      {entries.map(([date, amt], i) => {
        const pct = Math.max(4, Math.round((amt / max) * 100));
        return (
          <div key={date} title={`${date}: ${money(amt)}`}
            style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
            <div style={{ fontSize:9, color:TOKENS.muted, fontFamily:"DM Mono,monospace" }}>{amt > 0 ? (amt/1000).toFixed(0)+"k" : ""}</div>
            <div style={{
              width:"100%", borderRadius:"4px 4px 0 0",
              background: `linear-gradient(180deg, ${TOKENS.blue}, ${TOKENS.blue}80)`,
              height: `${pct}%`, minHeight:4,
              transition: "height .4s",
              boxShadow: `0 0 8px ${TOKENS.blue}40`,
            }} />
            <div style={{ fontSize:8, color:TOKENS.muted, writingMode:"vertical-rl", transform:"rotate(180deg)", maxHeight:28, overflow:"hidden" }}>
              {date.slice(5)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Tier donut (pure CSS) ──────────────────────────────────────────
function TierBar({ users }) {
  const elite  = users.filter(u => u.tier === "elite").length;
  const pro    = users.filter(u => u.tier === "professional").length;
  const trial  = users.filter(u => u.is_trial).length;
  const free   = Math.max(0, users.length - elite - pro - trial);
  const total  = users.length || 1;
  const rows = [
    { label:"Elite",        count:elite, color:TOKENS.purple },
    { label:"Professional", count:pro,   color:TOKENS.sky },
    { label:"Trial",        count:trial, color:TOKENS.amber },
    { label:"Free",         count:free,  color:TOKENS.faint },
  ];
  return (
    <div>
      {/* stacked bar */}
      <div style={{ display:"flex", height:8, borderRadius:99, overflow:"hidden", gap:2, marginBottom:18 }}>
        {rows.map(r => r.count > 0 && (
          <div key={r.label} style={{ width:`${r.count/total*100}%`, background:r.color, transition:"width .6s" }} />
        ))}
      </div>
      {rows.map(r => (
        <div key={r.label} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
          <div style={{ width:8, height:8, borderRadius:3, background:r.color, flexShrink:0 }} />
          <div style={{ flex:1, fontSize:12, color:TOKENS.muted }}>{r.label}</div>
          <div style={{ fontSize:13, fontWeight:600, color:r.color }}>{r.count}</div>
          <div style={{ fontSize:11, color:TOKENS.muted, width:36, textAlign:"right" }}>
            {Math.round(r.count/total*100)}%
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Table ─────────────────────────────────────────────────────────
function Table({ cols, rows, emptyMsg = "No data" }) {
  return (
    <div style={{ overflowX:"auto" }}>
      {/* Header */}
      <div style={{
        display:"grid", gridTemplateColumns: cols.map(c => c.w || "1fr").join(" "),
        padding:"10px 20px",
        borderBottom:`1px solid ${TOKENS.border}`,
        fontSize:10, fontWeight:700,
        color:TOKENS.muted, letterSpacing:".08em", textTransform:"uppercase",
      }}>
        {cols.map(c => <div key={c.key}>{c.label}</div>)}
      </div>
      {rows.length === 0 && (
        <div style={{ padding:"40px 20px", textAlign:"center", fontSize:12, color:TOKENS.muted }}>{emptyMsg}</div>
      )}
      {rows.map((row, i) => (
        <div
          key={i}
          className="row-hover"
          style={{
            display:"grid", gridTemplateColumns: cols.map(c => c.w || "1fr").join(" "),
            padding:"13px 20px",
            borderBottom: i < rows.length - 1 ? `1px solid ${TOKENS.border}` : "none",
            alignItems:"center",
          }}
        >
          {cols.map(c => (
            <div key={c.key} style={{ fontSize:12, color:TOKENS.text }}>
              {c.render ? c.render(row) : row[c.key] ?? "—"}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Skeleton loader ────────────────────────────────────────────────
function Skeleton({ h = 80, radius = TOKENS.radius }) {
  return (
    <div style={{
      height:h, borderRadius:radius,
      background:"linear-gradient(90deg, rgba(255,255,255,.03) 25%, rgba(255,255,255,.06) 50%, rgba(255,255,255,.03) 75%)",
      backgroundSize:"200% 100%",
      animation:"shimmer 1.5s infinite",
    }} />
  );
}

// ── Toast ─────────────────────────────────────────────────────────
function Toast({ msg, type = "success" }) {
  const bg = type === "error" ? TOKENS.red : TOKENS.green;
  if (!msg) return null;
  return (
    <div style={{
      position:"fixed", top:20, right:20, zIndex:9999,
      background:bg, color:"white",
      padding:"10px 18px", borderRadius:TOKENS.radius,
      fontSize:12, fontWeight:600,
      boxShadow:`0 8px 32px ${bg}60`,
      animation:"fadeIn .2s ease",
    }}>
      {type === "error" ? "✗" : "✓"} {msg}
    </div>
  );
}

// ── System health dot ─────────────────────────────────────────────
function HealthDot({ ok, label, sub }) {
  return (
    <div style={{
      background:"rgba(255,255,255,.03)",
      border:`1px solid ${TOKENS.border}`,
      borderRadius:TOKENS.radius,
      padding:"12px 16px",
      display:"flex", alignItems:"center", gap:12,
    }}>
      <div style={{
        width:8, height:8, borderRadius:"50%", flexShrink:0,
        background: ok ? TOKENS.green : TOKENS.red,
        boxShadow: ok ? `0 0 6px ${TOKENS.green}` : `0 0 6px ${TOKENS.red}`,
      }} />
      <div>
        <div style={{ fontSize:12, fontWeight:600, color:TOKENS.text }}>{label}</div>
        {sub && <div style={{ fontSize:10, color:TOKENS.muted, marginTop:2 }}>{sub}</div>}
      </div>
      <div style={{ marginLeft:"auto", fontSize:10, color: ok ? TOKENS.green : TOKENS.red, fontWeight:600 }}>
        {ok ? "OK" : "OFF"}
      </div>
    </div>
  );
}

// ── MAIN DASHBOARD ─────────────────────────────────────────────────
export function AdminDashboard({ adminProfile, cs, lang = "en", onBack,
  onOpenSecurityCenter, onOpenFeatureFlags, onOpenOnboardingAnalytics }) {
  const [tab, setTab]           = useState("overview");
  const [users, setUsers]       = useState([]);
  const [payments, setPayments] = useState([]);
  const [health, setHealth]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [tierFilter, setTier]   = useState("all");
  const [payStatus, setPaySt]   = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]     = useState("");
  const [auditLogs, setAudit]   = useState([]);
  const [webhooks, setWebhooks] = useState([]);
  const [toast, setToast]       = useState({ msg:"", type:"success" });

  const isAr = lang === "ar";

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg:"", type:"success" }), 3000);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [u, p, h, al, wh] = await Promise.allSettled([
        getAllUsers(),
        getAllPayments(payStatus !== "all" ? payStatus : null, dateFrom, dateTo),
        apiFetch("/health", { skipAuth: true }),
        apiFetch("/audit/logs?limit=50"),
        apiFetch("/webhooks"),
      ]);
      if (u.status  === "fulfilled") setUsers(u.value || []);
      if (p.status  === "fulfilled") setPayments(p.value || []);
      if (h.status  === "fulfilled") setHealth(h.value);
      if (al.status === "fulfilled") setAudit(al.value?.logs || []);
      if (wh.status === "fulfilled") setWebhooks(wh.value?.webhooks || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [payStatus, dateFrom, dateTo]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Stats
  const totalRevenue    = payments.filter(p => p.status === "confirmed").reduce((a,p) => a+(p.amount||0), 0);
  const pendingPayments = payments.filter(p => p.status === "pending").length;
  const activeUsers     = users.filter(u => u.tier && u.tier !== "standard").length;
  const trialUsers      = users.filter(u => u.is_trial).length;
  const eliteUsers      = users.filter(u => u.tier === "elite").length;
  const proUsers        = users.filter(u => u.tier === "professional").length;

  // Filtered
  const filtUsers = users.filter(u => {
    const s = search.toLowerCase();
    return (!s || (u.email||"").toLowerCase().includes(s) || (u.name||"").toLowerCase().includes(s))
      && (tierFilter === "all" || u.tier === tierFilter);
  });
  const filtPay = payments.filter(p => payStatus === "all" || p.status === payStatus);

  const TABS = [
    { id:"overview", label: isAr ? "نظرة عامة"   : "Intelligence HQ",  icon:"▦" },
    { id:"users",    label: isAr ? "المستخدمون"  : "Users",     icon:"⊡", badge: users.length },
    { id:"payments", label: isAr ? "المدفوعات"   : "Payments",  icon:"⬡", badge: pendingPayments || null, badgeRed: true },
    { id:"billing",  label: isAr ? "تحليلات الفوترة" : "Billing Analytics", icon:"◈" },
    { id:"webhooks", label: isAr ? "Webhooks"    : "Webhooks",  icon:"⟳" },
    { id:"audit",    label: isAr ? "سجل المراجعة": "Audit Log", icon:"≡" },
    { id:"scim",     label: isAr ? "SCIM (تزويد المستخدمين)" : "SCIM Provisioning", icon:"⇄" },
    { id:"announcements", label: isAr ? "الإعلانات" : "Announcements", icon:"📣" },
    { id:"system",   label: isAr ? "النظام"      : "System",    icon:"⚙" },
  ];

  return (
    <div style={{
      minHeight:"100vh",
      background:TOKENS.bg,
      fontFamily:"'DM Sans', system-ui, sans-serif",
      color:TOKENS.text,
      direction: isAr ? "rtl" : "ltr",
      display:"flex",
    }}>
      <style>{GLOBAL_CSS}</style>
      <Toast msg={toast.msg} type={toast.type} />

      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <aside style={{
        width:220, flexShrink:0,
        background:TOKENS.surface,
        borderRight:`1px solid ${TOKENS.border}`,
        display:"flex", flexDirection:"column",
        height:"100vh", position:"sticky", top:0,
      }}>
        {/* Logo area */}
        <div style={{ padding:"24px 20px 20px", borderBottom:`1px solid ${TOKENS.border}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{
              width:36, height:36, borderRadius:10,
              background:`linear-gradient(135deg, ${TOKENS.blue}, #0891b2)`,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:18, fontWeight:700, color:"white", letterSpacing:"-1px",
            }}>◈</div>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:TOKENS.text, lineHeight:1 }}>Corvus</div>
              <div style={{ fontSize:9, color:TOKENS.muted, fontWeight:500, letterSpacing:".06em", marginTop:2 }}>INTELLIGENCE CONSOLE</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex:1, padding:"12px 10px", overflowY:"auto" }}>
          {TABS.map(t => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  width:"100%", display:"flex", alignItems:"center", gap:10,
                  padding:"9px 12px", borderRadius:TOKENS.radiusSm, marginBottom:2,
                  background: active ? TOKENS.blueBg : "transparent",
                  border: `1px solid ${active ? `${TOKENS.blue}40` : "transparent"}`,
                  cursor:"pointer", transition:".15s", textAlign:"left",
                }}
              >
                <span style={{ fontSize:14, color: active ? TOKENS.blue : TOKENS.muted, width:18, textAlign:"center" }}>{t.icon}</span>
                <span style={{ flex:1, fontSize:12, fontWeight: active ? 600 : 400, color: active ? TOKENS.text : TOKENS.muted }}>
                  {t.label}
                </span>
                {t.badge > 0 && (
                  <span style={{
                    fontSize:9, fontWeight:700, padding:"1px 6px", borderRadius:99,
                    background: t.badgeRed ? TOKENS.red : TOKENS.blueBg,
                    color: t.badgeRed ? "white" : TOKENS.blue,
                  }}>{t.badge}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom: user + back */}
        <div style={{ padding:"12px 10px", borderTop:`1px solid ${TOKENS.border}` }}>
          <div style={{ padding:"10px 12px", borderRadius:TOKENS.radiusSm, marginBottom:8, background:"rgba(255,255,255,.02)" }}>
            <div style={{ fontSize:11, fontWeight:600, color:TOKENS.text, marginBottom:2 }}>
              {adminProfile?.name || "Admin"}
            </div>
            <div style={{ fontSize:10, color:TOKENS.muted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {adminProfile?.email}
            </div>
          </div>
          <Btn variant="ghost" style={{ width:"100%", fontSize:11 }} onClick={onBack}>
            ← {isAr ? "رجوع" : "Back to App"}
          </Btn>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────────── */}
      <main style={{ flex:1, overflowY:"auto", minWidth:0 }}>

        {/* Topbar */}
        <div style={{
          padding:"16px 28px",
          borderBottom:`1px solid ${TOKENS.border}`,
          display:"flex", alignItems:"center", justifyContent:"space-between",
          background:TOKENS.surface, position:"sticky", top:0, zIndex:10,
        }}>
          <div>
            <div style={{ fontSize:18, fontWeight:700, color:TOKENS.text, letterSpacing:"-.4px" }}>
              {TABS.find(t => t.id === tab)?.label}
            </div>
            <div style={{ fontSize:11, color:TOKENS.muted, marginTop:2 }}>
              {new Date().toLocaleDateString("en-GB", { weekday:"long", day:"numeric", month:"long" })}
            </div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            {loading && (
              <div style={{ fontSize:11, color:TOKENS.muted, alignSelf:"center" }}>Syncing…</div>
            )}
            <Btn variant="ghost" size="sm" onClick={loadAll}>↻ {isAr ? "تحديث" : "Refresh"}</Btn>
          </div>
        </div>

        {/* Page content */}
        <div style={{ padding:"28px", maxWidth:1180, margin:"0 auto" }} className="animate-in">

          {loading ? (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14 }}>
                {[0,1,2,3].map(i => <Skeleton key={i} h={110} radius={TOKENS.radiusLg} />)}
              </div>
              <Skeleton h={220} />
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                <Skeleton h={180} />
                <Skeleton h={180} />
              </div>
            </div>

          ) : tab === "overview" ? (
            <OverviewTab
              users={users} payments={payments} health={health}
              totalRevenue={totalRevenue} pendingPayments={pendingPayments}
              activeUsers={activeUsers} trialUsers={trialUsers}
              eliteUsers={eliteUsers} proUsers={proUsers}
              isAr={isAr} setTab={setTab} setPaySt={setPaySt}
              onOpenSecurityCenter={onOpenSecurityCenter}
              onOpenFeatureFlags={onOpenFeatureFlags}
              onOpenOnboardingAnalytics={onOpenOnboardingAnalytics}
            />
          ) : tab === "users" ? (
            <UsersTab
              users={users} filtUsers={filtUsers}
              search={search} setSearch={setSearch}
              tierFilter={tierFilter} setTier={setTier}
              isAr={isAr} loadAll={loadAll} showToast={showToast}
            />
          ) : tab === "payments" ? (
            <PaymentsTab
              payments={payments} filtPay={filtPay}
              payStatus={payStatus} setPaySt={setPaySt}
              dateFrom={dateFrom} setDateFrom={setDateFrom}
              dateTo={dateTo} setDateTo={setDateTo}
              pendingPayments={pendingPayments}
              isAr={isAr} loadAll={loadAll} showToast={showToast}
            />
          ) : tab === "webhooks" ? (
            <WebhookManager webhooks={webhooks} lang={lang} onRefresh={loadAll} showToast={showToast} />
          ) : tab === "billing" ? (
            <BillingAnalyticsTab isAr={isAr} showToast={showToast}/>
          ) : tab === "audit" ? (
            <AuditTab auditLogs={auditLogs} isAr={isAr} />
          ) : tab === "scim" ? (
            <ScimTab isAr={isAr} showToast={showToast} />
          ) : tab === "announcements" ? (
            <AnnouncementsTab isAr={isAr} showToast={showToast} />
          ) : tab === "system" ? (
            <SystemPanel health={health} lang={lang} adminProfile={adminProfile} onRefresh={loadAll} showToast={showToast} />
          ) : null}
        </div>
      </main>
    </div>
  );
}

// ── Overview Tab ───────────────────────────────────────────────────
function OverviewTab({ users, payments, health, totalRevenue, pendingPayments, activeUsers, trialUsers, eliteUsers, proUsers, isAr, setTab, setPaySt,
  onOpenSecurityCenter, onOpenFeatureFlags, onOpenOnboardingAnalytics }) {
  const confirmedRev = payments.filter(p => p.status === "confirmed").reduce((a,p) => a+(p.amount||0), 0);
  const mrr = Math.round(confirmedRev / Math.max(1, new Set(payments.filter(p=>p.status==="confirmed").map(p=>fmt(p.created_at).slice(0,7))).size));

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      {/* KPI row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14 }}>
        <KpiCard label={isAr?"إجمالي الإيرادات":"Platform Revenue"} value={money(totalRevenue)} sub="Confirmed payments" icon="◈" accent={TOKENS.green} />
        <KpiCard label={isAr?"مدفوعات معلقة":"Pending"} value={pendingPayments}
          sub="Awaiting review" icon="⏳" accent={pendingPayments > 0 ? TOKENS.amber : TOKENS.muted}
          onClick={() => { setTab("payments"); setPaySt("pending"); }} />
        <KpiCard label={isAr?"مشتركون نشطون":"Active Intelligence Users"} value={activeUsers} sub={`${eliteUsers} Elite · ${proUsers} Pro`} icon="✦" accent={TOKENS.blue} />
        <KpiCard label={isAr?"تجربة مجانية":"Trial Users"} value={trialUsers} sub="Active trials" icon="◷" accent={TOKENS.amber} />
      </div>

      {/* Quick tools */}
      {(onOpenSecurityCenter || onOpenFeatureFlags || onOpenOnboardingAnalytics) && (
        <Card title={isAr ? "أدوات سريعة" : "Quick Tools"} style={{ padding:16 }}>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            {onOpenSecurityCenter && (
              <Btn variant="ghost" size="sm" onClick={onOpenSecurityCenter}>🔒 {isAr?"مركز الأمان":"Security Center"}</Btn>
            )}
            {onOpenFeatureFlags && (
              <Btn variant="ghost" size="sm" onClick={onOpenFeatureFlags}>🚩 {isAr?"أعلام الميزات":"Feature Flags"}</Btn>
            )}
            {onOpenOnboardingAnalytics && (
              <Btn variant="ghost" size="sm" onClick={onOpenOnboardingAnalytics}>📈 {isAr?"تحليلات الإعداد":"Onboarding Analytics"}</Btn>
            )}
          </div>
        </Card>
      )}

      {/* Revenue chart */}
      <Card title={isAr?"الإيرادات (آخر 14 يوم)":"Revenue — last 14 days"}
        action={<span style={{ fontSize:11, color:TOKENS.green, fontWeight:600 }}>MRR ≈ {money(mrr)}</span>}
        style={{ padding:"0 0 20px" }}>
        <div style={{ padding:"20px 20px 0" }}>
          <RevenueChart payments={payments} />
        </div>
      </Card>

      {/* Tier distribution + System health */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
        <Card title={isAr?"توزيع خطط الذكاء":"Intelligence Plan Distribution"} style={{ padding:0 }}>
          <div style={{ padding:"20px" }}>
            <TierBar users={users} />
          </div>
        </Card>

        <Card title={isAr?"صحة المنصة":"Platform Health"} style={{ padding:0 }}>
          <div style={{ padding:"16px", display:"flex", flexDirection:"column", gap:8 }}>
            {health ? [
              { label:"Backend API", ok: health.status === "ok", sub: `v${health.version}` },
              { label:"Corvus Offline AI", ok: true, sub: "Instant, no downloads" },
              { label:"Kashier",      ok: health.integrations?.kashier?.configured, sub: "Billing" },
              { label:"PDF Engine",  ok: health.pdf_available, sub: "ReportLab" },
              { label:"Redis",       ok: health.redis?.status === "ok", sub: "Cache & sessions" },
            ].map((item, i) => <HealthDot key={i} {...item} />)
            : <div style={{ padding:"20px 0", textAlign:"center", fontSize:12, color:TOKENS.muted }}>Loading…</div>}
          </div>
        </Card>
      </div>

      {/* Recent payments mini */}
      <Card title={isAr?"أحدث المعاملات":"Recent Transactions"} style={{ padding:0 }}
        action={<Btn variant="ghost" size="sm" onClick={() => setTab("payments")}>View all →</Btn>}>
        <Table
          cols={[
            { key:"user",   label:"Customer", w:"2fr",  render: p => (
              <div><div style={{ fontWeight:600 }}>{p.user_name || p.user_email?.split("@")[0] || "—"}</div>
              <div style={{ fontSize:10, color:TOKENS.muted }}>{p.user_email}</div></div>
            )},
            { key:"tier",   label:"Plan", w:"1fr",  render: p => {
              const m = tierMeta[p.tier] || tierMeta.standard;
              return <Badge label={(p.tier||"free").toUpperCase()} color={m.color} bg={m.bg} />;
            }},
            { key:"amount", label:"Amount", w:"1fr", render: p => <span style={{ color:TOKENS.green, fontWeight:600 }}>{money(p.amount)}</span> },
            { key:"status", label:"Status", w:"1fr", render: p => {
              const col = p.status==="confirmed" ? TOKENS.green : p.status==="rejected" ? TOKENS.red : TOKENS.amber;
              return <Badge label={p.status?.toUpperCase()} color={col} bg={`${col}18`} />;
            }},
            { key:"created_at", label:"Date", w:"1fr", render: p => <span style={{ color:TOKENS.muted, fontSize:11 }}>{fmt(p.created_at)}</span> },
          ]}
          rows={payments.slice(0,5)}
          emptyMsg="No payments yet"
        />
      </Card>
    </div>
  );
}

// ── Users Tab ──────────────────────────────────────────────────────
function UsersTab({ users, filtUsers, search, setSearch, tierFilter, setTier, isAr, loadAll, showToast }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Filters */}
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
        <Input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder={isAr ? "بحث بالاسم أو الإيميل…" : "Search users…"}
          style={{ flex:1, minWidth:220 }}
        />
        <div style={{ display:"flex", gap:6 }}>
          {["all","elite","professional","standard"].map(t => (
            <Pill key={t} label={t === "all" ? "All" : t.charAt(0).toUpperCase()+t.slice(1)}
              active={tierFilter === t}
              color={tierMeta[t]?.color || TOKENS.blue}
              onClick={() => setTier(t)} />
          ))}
        </div>
        <span style={{ fontSize:11, color:TOKENS.muted }}>{filtUsers.length}/{users.length} users</span>
      </div>

      {/* Table */}
      <Card style={{ padding:0 }}>
        <Table
          cols={[
            { key:"name",  label:"User", w:"2fr", render: u => (
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{
                  width:32, height:32, borderRadius:10, flexShrink:0,
                  background:`linear-gradient(135deg, ${TOKENS.blue}40, ${TOKENS.sky}40)`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:13, fontWeight:700, color:TOKENS.blue,
                }}>{(u.name||u.email||"?")[0].toUpperCase()}</div>
                <div>
                  <div style={{ fontWeight:600 }}>{u.name || "—"}</div>
                  <div style={{ display:"flex", gap:4, marginTop:2 }}>
                    {u.is_admin && <Badge label="ADMIN" color={TOKENS.red} bg={TOKENS.redBg} />}
                    {u.is_trial && <Badge label="TRIAL" color={TOKENS.amber} bg={TOKENS.amberBg} />}
                  </div>
                </div>
              </div>
            )},
            { key:"email",      label:"Email",    w:"2fr", render: u => <span style={{ color:TOKENS.muted, fontSize:11 }}>{u.email}</span> },
            { key:"tier",       label:"Plan",     w:"1fr", render: u => {
              const m = tierMeta[u.tier] || tierMeta.standard;
              return <Badge label={(u.tier||"free").toUpperCase()} color={m.color} bg={m.bg} />;
            }},
            { key:"sessions",   label:"Sessions", w:"1fr", render: u => <span style={{ fontWeight:600 }}>{u.sessions_count || 0}</span> },
            { key:"created_at", label:"Joined",   w:"1fr", render: u => <span style={{ color:TOKENS.muted, fontSize:11 }}>{fmt(u.created_at)}</span> },
            { key:"actions",    label:"",         w:"1fr", render: u => (
              <div style={{ display:"flex", gap:4 }}>
                {["elite","professional","standard"].map(tier => {
                  const m = tierMeta[tier];
                  return (
                    <button key={tier}
                      title={`Set ${tier}`}
                      onClick={async () => {
                        await updateUserTier(u.uid||u.id, tier, 1);
                        showToast(`${u.email} → ${tier}`);
                        loadAll();
                      }}
                      style={{
                        width:22, height:22, borderRadius:6,
                        background: u.tier === tier ? m.color : "transparent",
                        border:`1px solid ${u.tier === tier ? m.color : TOKENS.border}`,
                        cursor:"pointer", fontSize:8, fontWeight:700,
                        color: u.tier === tier ? "white" : TOKENS.muted,
                        transition:".15s",
                      }}
                    >{tier[0].toUpperCase()}</button>
                  );
                })}
              </div>
            )},
          ]}
          rows={filtUsers.slice(0, 50)}
          emptyMsg="No users found"
        />
      </Card>
    </div>
  );
}

// ── Payments Tab ───────────────────────────────────────────────────
function PaymentsTab({ payments, filtPay, payStatus, setPaySt, dateFrom, setDateFrom, dateTo, setDateTo, pendingPayments, isAr, loadAll, showToast }) {
  const confirmedTotal = filtPay.filter(p => p.status==="confirmed").reduce((a,p) => a+(p.amount||0), 0);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Filters */}
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
        <div style={{ display:"flex", gap:6 }}>
          {["all","pending","confirmed","rejected"].map(s => (
            <Pill key={s}
              label={s === "all" ? "All" : s.charAt(0).toUpperCase()+s.slice(1)}
              active={payStatus === s}
              color={s==="confirmed" ? TOKENS.green : s==="rejected" ? TOKENS.red : s==="pending" ? TOKENS.amber : TOKENS.blue}
              onClick={() => setPaySt(s)}
            />
          ))}
        </div>
        {pendingPayments > 0 && payStatus !== "pending" && (
          <div style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 10px", background:TOKENS.amberBg, borderRadius:99, border:`1px solid ${TOKENS.amber}30` }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:TOKENS.amber }} />
            <span style={{ fontSize:10, color:TOKENS.amber, fontWeight:600 }}>{pendingPayments} pending review</span>
          </div>
        )}
        <div style={{ marginLeft:"auto", display:"flex", gap:8, alignItems:"center" }}>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width:130, fontSize:11 }} />
          <span style={{ color:TOKENS.muted, fontSize:11 }}>→</span>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width:130, fontSize:11 }} />
          <span style={{ fontSize:12, fontWeight:700, color:TOKENS.green }}>{money(confirmedTotal)}</span>
        </div>
      </div>

      <Card style={{ padding:0 }}>
        <Table
          cols={[
            { key:"customer", label:"Customer", w:"2fr", render: p => (
              <div>
                <div style={{ fontWeight:600 }}>{p.user_name || p.user_email?.split("@")[0] || "—"}</div>
                <div style={{ fontSize:10, color:TOKENS.muted }}>{p.user_email}</div>
              </div>
            )},
            { key:"tier",   label:"Plan",   w:"1fr", render: p => {
              const m = tierMeta[p.tier] || tierMeta.standard;
              return <Badge label={(p.tier||"—").toUpperCase()} color={m.color} bg={m.bg} />;
            }},
            { key:"amount", label:"Amount", w:"1fr", render: p => <span style={{ color:TOKENS.green, fontWeight:700, fontFamily:"DM Mono, monospace" }}>{money(p.amount)}</span> },
            { key:"method", label:"Method", w:"1fr", render: p => <span style={{ color:TOKENS.muted, fontSize:11 }}>{p.payment_method || p.payment_method_name || "—"}</span> },
            { key:"date",   label:"Date",   w:"1fr", render: p => <span style={{ color:TOKENS.muted, fontSize:11 }}>{fmt(p.created_at)}</span> },
            { key:"action", label:"",       w:"1.2fr", render: p => {
              const col = p.status==="confirmed" ? TOKENS.green : p.status==="rejected" ? TOKENS.red : TOKENS.amber;
              if (p.status !== "pending")
                return <Badge label={p.status.toUpperCase()} color={col} bg={`${col}18`} />;
              return (
                <div style={{ display:"flex", gap:6 }}>
                  <Btn size="sm" variant="success" onClick={async () => {
                    await confirmPayment(p.id, p.uid, p.tier, p.billing === "yearly" ? 12 : 1);
                    showToast("Payment confirmed ✓");
                    loadAll();
                  }}>✓ Confirm</Btn>
                  <Btn size="sm" variant="danger" onClick={async () => {
                    await rejectPayment(p.id, "Not verified");
                    showToast("Payment rejected", "error");
                    loadAll();
                  }}>✗</Btn>
                </div>
              );
            }},
          ]}
          rows={filtPay.slice(0,100)}
          emptyMsg="No payments found"
        />
      </Card>
    </div>
  );
}

// ── Audit Tab ──────────────────────────────────────────────────────
function AuditTab({ auditLogs, isAr }) {
  return (
    <Card style={{ padding:0 }}>
      <Table
        cols={[
          { key:"id",       label:"ID",       w:"1.2fr", render: l => <span style={{ fontFamily:"DM Mono,monospace", fontSize:9, color:TOKENS.muted }}>{l.id?.slice(-8)}</span> },
          { key:"uid",      label:"User",     w:"1.5fr", render: l => <span style={{ fontSize:11, fontFamily:"DM Mono,monospace", color:TOKENS.muted }}>{l.uid?.slice(0,12)}…</span> },
          { key:"action",   label:"Action",   w:"2fr",   render: l => <span style={{ fontWeight:600, color:TOKENS.sky }}>{l.action}</span> },
          { key:"resource", label:"Resource", w:"1fr",   render: l => <span style={{ color:TOKENS.muted, fontSize:11 }}>{l.resource||"—"}</span> },
          { key:"ip",       label:"IP",       w:"1fr",   render: l => <span style={{ fontFamily:"DM Mono,monospace", fontSize:10, color:TOKENS.muted }}>{l.ip||"—"}</span> },
          { key:"ts",       label:"Time",     w:"1fr",   render: l => <span style={{ color:TOKENS.muted, fontSize:10 }}>{l.ts?.replace("T"," ").slice(0,19)||"—"}</span> },
        ]}
        rows={auditLogs.slice(0,100)}
        emptyMsg="No audit logs yet"
      />
    </Card>
  );
}

// ── SCIM Provisioning Tab ───────────────────────────────────────────
function AnnouncementsTab({ isAr, showToast }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState("feature");
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [tiers, setTiers] = useState({ starter: true, professional: true, elite: true });
  const [creating, setCreating] = useState(false);

  const TYPE_OPTS = [
    { id:"feature",  label: isAr?"ميزة جديدة":"New feature",  icon:"🚀" },
    { id:"security", label: isAr?"أمان":"Security",           icon:"🔐" },
    { id:"tip",      label: isAr?"نصيحة":"Tip",                icon:"💡" },
    { id:"warning",  label: isAr?"تحذير":"Warning",            icon:"⚠️" },
  ];

  const create = async () => {
    if (!body.trim()) { showToast?.(isAr?"النص مطلوب":"Body text required","warn"); return; }
    const selectedTiers = Object.entries(tiers).filter(([,v])=>v).map(([k])=>k);
    if (selectedTiers.length === 0) { showToast?.(isAr?"اختار باقة واحدة على الأقل":"Select at least one tier","warn"); return; }
    setCreating(true);
    try {
      await apiFetch("/announcements", {
        method: "POST",
        body: { title: title.trim(), body: body.trim(), type, expires_in_days: Number(expiresInDays)||7, tier: selectedTiers },
      });
      showToast?.(isAr?"✅ تم نشر الإعلان":"✅ Announcement published","success");
      setTitle(""); setBody("");
    } catch (e) {
      showToast?.(e.message || (isAr?"فشل النشر":"Failed to publish"), "error");
    } finally {
      setCreating(false);
    }
  };

  const inputStyle = { width:"100%", padding:"10px 12px", borderRadius:8, border:`1px solid ${TOKENS.border}`, background:TOKENS.surface, color:TOKENS.text, fontSize:13 };

  return (
    <div style={{ maxWidth:560 }}>
      <h3 style={{ fontSize:15, fontWeight:700, marginBottom:16 }}>{isAr?"نشر إعلان جديد":"Publish a new announcement"}</h3>
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        <div>
          <label style={{ fontSize:12, color:TOKENS.muted, marginBottom:4, display:"block" }}>{isAr?"العنوان (اختياري)":"Title (optional)"}</label>
          <input style={inputStyle} value={title} onChange={e=>setTitle(e.target.value)} placeholder={isAr?"مثلاً: ميزة جديدة!":"e.g. New feature!"} maxLength={120} />
        </div>
        <div>
          <label style={{ fontSize:12, color:TOKENS.muted, marginBottom:4, display:"block" }}>{isAr?"النص":"Body"}</label>
          <textarea style={{ ...inputStyle, minHeight:70, resize:"vertical" }} value={body} onChange={e=>setBody(e.target.value)} maxLength={500} placeholder={isAr?"نص الإعلان...":"Announcement text..."} />
        </div>
        <div>
          <label style={{ fontSize:12, color:TOKENS.muted, marginBottom:6, display:"block" }}>{isAr?"النوع":"Type"}</label>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {TYPE_OPTS.map(o => (
              <button key={o.id} onClick={()=>setType(o.id)} style={{
                padding:"6px 12px", borderRadius:8, fontSize:12, cursor:"pointer",
                border:`1px solid ${type===o.id?TOKENS.blue:TOKENS.border}`,
                background: type===o.id ? TOKENS.blueBg : "transparent",
                color: type===o.id ? TOKENS.blueHover : TOKENS.text,
              }}>{o.icon} {o.label}</button>
            ))}
          </div>
        </div>
        <div>
          <label style={{ fontSize:12, color:TOKENS.muted, marginBottom:6, display:"block" }}>{isAr?"يظهر لباقات":"Visible to tiers"}</label>
          <div style={{ display:"flex", gap:14 }}>
            {["starter","professional","elite"].map(t => (
              <label key={t} style={{ display:"flex", alignItems:"center", gap:6, fontSize:12.5, cursor:"pointer" }}>
                <input type="checkbox" checked={tiers[t]} onChange={e=>setTiers(p=>({...p,[t]:e.target.checked}))} />
                {t}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label style={{ fontSize:12, color:TOKENS.muted, marginBottom:4, display:"block" }}>{isAr?"مدة الظهور (أيام)":"Expires in (days)"}</label>
          <input type="number" min="1" max="90" style={{ ...inputStyle, width:100 }} value={expiresInDays} onChange={e=>setExpiresInDays(e.target.value)} />
        </div>
        <button onClick={create} disabled={creating} style={{
          padding:"11px 20px", borderRadius:9, border:"none", cursor:"pointer",
          background:TOKENS.blue, color:"#fff", fontWeight:700, fontSize:13.5, marginTop:4,
        }}>
          {creating ? "…" : (isAr?"نشر الإعلان":"Publish announcement")}
        </button>
      </div>
    </div>
  );
}

function ScimTab({ isAr, showToast }) {
  const [status, setStatus] = useState(null);
  const [users, setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      apiFetch("/admin/scim/status").catch(() => null),
      apiFetch("/admin/scim/users").catch(() => ({ users: [] })),
    ]).then(([s, u]) => {
      setStatus(s);
      setUsers(u?.users || []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const copy = (key, val) => {
    navigator.clipboard?.writeText(val);
    setCopiedKey(key);
    showToast?.(isAr ? "تم النسخ" : "Copied", "success");
    setTimeout(() => setCopiedKey(null), 1500);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <Card title={isAr ? "حالة التزويد التلقائي (SCIM)" : "SCIM Provisioning Status"} style={{ padding:20 }}>
        {loading ? (
          <div style={{ color:TOKENS.muted, fontSize:12.5 }}>{isAr?"جاري التحميل…":"Loading…"}</div>
        ) : (
          <>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
              <span style={{ width:9, height:9, borderRadius:"50%",
                background: status?.configured ? TOKENS.green : TOKENS.amber }} />
              <span style={{ fontWeight:700, fontSize:13.5 }}>
                {status?.configured
                  ? (isAr ? "SCIM مفعّل" : "SCIM is configured")
                  : (isAr ? "SCIM لسه مش متفعّل" : "SCIM is not configured yet")}
              </span>
            </div>
            {!status?.configured && (
              <div style={{ fontSize:12, color:TOKENS.muted, marginBottom:14, lineHeight:1.6 }}>
                {isAr
                  ? "لتفعيله: ضيف SCIM_BEARER_TOKEN (أي قيمة سرية طويلة) في environment variables بتاعة Railway، وبعدين استخدم الروابط دي لإعداد IdP (Okta / Azure AD / OneLogin)."
                  : "To enable: add a SCIM_BEARER_TOKEN (any long secret value) to Railway's environment variables, then use the endpoints below to configure your IdP (Okta / Azure AD / OneLogin)."}
              </div>
            )}
            <div style={{ fontSize:11, color:TOKENS.amber, background:"rgba(245,158,11,.08)",
                          border:`1px solid rgba(245,158,11,.25)`, borderRadius:8, padding:"8px 12px", marginBottom:16 }}>
              {isAr
                ? "ملحوظة: التوكن حاليًا مشترك على مستوى المنصة كلها — مش لكل شركة توكن مستقل لسه."
                : "Note: today this is one shared platform-wide token, not a separate token per enterprise customer yet."}
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {status?.endpoints && Object.entries(status.endpoints).map(([key, url]) => (
                <div key={key} style={{ display:"flex", alignItems:"center", gap:8,
                                         background:TOKENS.surface, border:`1px solid ${TOKENS.border}`,
                                         borderRadius:8, padding:"8px 12px" }}>
                  <span style={{ fontSize:10.5, color:TOKENS.muted, minWidth:150, textTransform:"uppercase", letterSpacing:".04em" }}>
                    {key.replace(/_/g," ")}
                  </span>
                  <span style={{ flex:1, fontFamily:"DM Mono,monospace", fontSize:11.5, color:TOKENS.text,
                                 overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{url}</span>
                  <button onClick={()=>copy(key,url)} style={{
                    background:"transparent", border:`1px solid ${TOKENS.border}`, borderRadius:6,
                    color:TOKENS.sky, fontSize:10.5, fontWeight:600, padding:"4px 10px", cursor:"pointer" }}>
                    {copiedKey===key ? (isAr?"اتنسخ ✓":"Copied ✓") : (isAr?"نسخ":"Copy")}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      <Card title={isAr ? `المستخدمون المتزوّدون عبر SCIM (${users.length})` : `SCIM-Provisioned Users (${users.length})`} style={{ padding:0 }}>
        <Table
          cols={[
            { key:"name",         label: isAr?"الاسم":"Name",       w:"1.4fr", render: u => <span style={{ fontWeight:600 }}>{u.name || "—"}</span> },
            { key:"email",        label: isAr?"البريد":"Email",      w:"1.6fr", render: u => <span style={{ fontSize:11.5, color:TOKENS.muted }}>{u.email}</span> },
            { key:"external_id",  label:"External ID",              w:"1.2fr", render: u => <span style={{ fontFamily:"DM Mono,monospace", fontSize:10.5, color:TOKENS.muted }}>{u.external_id}</span> },
            { key:"company_name", label: isAr?"الشركة":"Company",    w:"1fr",   render: u => <span style={{ fontSize:11.5 }}>{u.company_name || "—"}</span> },
            { key:"active",       label: isAr?"الحالة":"Status",     w:"0.8fr", render: u => (
                <span style={{ fontSize:10.5, fontWeight:700, color: u.active ? TOKENS.green : TOKENS.muted }}>
                  {u.active ? (isAr?"نشط":"Active") : (isAr?"موقوف":"Suspended")}
                </span>
              )},
          ]}
          rows={users}
          emptyMsg={isAr ? "مفيش مستخدمين اتزوّدوا عبر SCIM لسه" : "No SCIM-provisioned users yet"}
        />
      </Card>
    </div>
  );
}


function WebhookManager({ webhooks, lang, onRefresh, showToast }) {
  const [form, setForm] = useState({ url:"", description:"", events:["posture.risk_alert"] });
  const [adding, setAdding] = useState(false);
  const [logs, setLogs]     = useState([]);
  const isAr = lang === "ar";

  const createWH = async () => {
    if (!form.url.startsWith("http")) { showToast("Valid URL required","error"); return; }
    setAdding(true);
    try {
      const d = await apiFetch("/webhooks", { method:"POST", body:form });
      if (d.webhook) { showToast("Webhook created ✓"); onRefresh(); }
    } catch { showToast("Error creating webhook","error"); }
    finally { setAdding(false); }
  };

  useEffect(() => {
    apiFetch("/webhooks/logs?limit=20").then(d => setLogs(d.logs||[])).catch(()=>{});
  }, []);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Create */}
      <Card title={isAr?"إضافة Webhook":"New Webhook"}>
        <div style={{ padding:"0 20px 20px", display:"flex", gap:10, flexWrap:"wrap" }}>
          <Input value={form.url} onChange={e => setForm(f=>({...f,url:e.target.value}))}
            placeholder="https://your-hr-system.com/webhook" style={{ flex:2, minWidth:220 }} />
          <Input value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))}
            placeholder="Description (e.g. SAP HR)" style={{ flex:1, minWidth:150 }} />
          <Btn onClick={createWH} disabled={adding}>{adding?"…":isAr?"إضافة":"Add Webhook"}</Btn>
        </div>
      </Card>

      {/* List */}
      {webhooks.length > 0 && (
        <Card title={`${isAr?"Webhooks":"Webhooks"} (${webhooks.length})`} style={{ padding:0 }}>
          {webhooks.map((wh, i) => (
            <div key={wh.id} style={{
              padding:"16px 20px",
              borderBottom: i < webhooks.length-1 ? `1px solid ${TOKENS.border}` : "none",
              display:"flex", alignItems:"center", gap:14,
            }}>
              <div style={{
                width:8, height:8, borderRadius:"50%", flexShrink:0,
                background: wh.active ? TOKENS.green : TOKENS.red,
                boxShadow: wh.active ? `0 0 6px ${TOKENS.green}` : "none",
              }} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:600, color:TOKENS.text, marginBottom:3, fontFamily:"DM Mono,monospace" }}>{wh.url}</div>
                <div style={{ fontSize:10, color:TOKENS.muted }}>{wh.description || "—"} · Events: {wh.events?.join(", ")}</div>
              </div>
              <div style={{ display:"flex", gap:6 }}>
                <Btn size="sm" variant="ghost" onClick={async () => {
                  await apiFetch(`/webhooks/${wh.id}/test`,{method:"POST"});
                  showToast("Test sent ✓");
                }}>Test</Btn>
                <Btn size="sm" variant="danger" onClick={async () => {
                  await apiFetch(`/webhooks/${wh.id}`,{method:"DELETE"});
                  showToast("Webhook deleted");
                  onRefresh();
                }}>Delete</Btn>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Delivery logs */}
      {logs.length > 0 && (
        <Card title="Recent Deliveries" style={{ padding:0 }}>
          <Table
            cols={[
              { key:"ok",     label:"Status", w:".8fr", render: l => <Badge label={l.ok?"200":"FAIL"} color={l.ok?TOKENS.green:TOKENS.red} bg={l.ok?TOKENS.greenBg:TOKENS.redBg} /> },
              { key:"url",    label:"URL",    w:"3fr",  render: l => <span style={{ fontFamily:"DM Mono,monospace", fontSize:10, color:TOKENS.muted }}>{l.url?.slice(0,50)}</span> },
              { key:"status", label:"HTTP",   w:"1fr",  render: l => <span style={{ fontFamily:"DM Mono,monospace", fontSize:11 }}>{l.status||"0"}</span> },
              { key:"ts",     label:"Time",   w:"1fr",  render: l => <span style={{ color:TOKENS.muted, fontSize:10 }}>{l.ts?.split("T")[1]?.split(".")[0]}</span> },
            ]}
            rows={logs.slice(0,10)}
          />
        </Card>
      )}
    </div>
  );
}

// ── Billing Analytics Tab ─────────────────────────────────────────
function BillingAnalyticsTab({ isAr, showToast }) {
  const [data, setData]   = useState(null);
  const [loading, setLoad]= useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    import("./services/api.js").then(({ BillingAPI }) =>
      BillingAPI.analytics()
        .then(d => setData(d))
        .catch(e => setError(e.message))
        .finally(() => setLoad(false))
    );
  }, []);

  if (loading) return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {[0,1,2].map(i=><div key={i} style={{height:i===0?120:80,background:TOKENS.surface,borderRadius:14,animation:"shimmer 1.6s ease infinite",backgroundSize:"200% 100%",backgroundImage:"linear-gradient(90deg,rgba(255,255,255,.03) 25%,rgba(255,255,255,.06) 50%,rgba(255,255,255,.03) 75%)"}}/>)}
    </div>
  );
  if (error) return <div style={{padding:24,color:TOKENS.red,fontSize:12}}>Error: {error}</div>;
  if (!data)  return <div style={{padding:24,color:TOKENS.muted,fontSize:12}}>No billing data</div>;

  const money = n => n != null ? `${Number(n).toLocaleString()} EGP` : "—";
  const planColors = { standard:TOKENS.muted, professional:TOKENS.sky, elite:TOKENS.purple, enterprise:TOKENS.amber };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      {/* KPI row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
        {[
          ["MRR",          money(data.mrr),          TOKENS.green,  "Monthly Recurring Revenue"],
          ["ARR",          money(data.arr),           TOKENS.blue,   "Annual Run Rate"],
          ["ARPU",         money(data.arpu),          TOKENS.purple, "Avg Revenue Per User"],
          ["Conversion",   `${data.conversion_rate}%`,data.conversion_rate>=70?TOKENS.green:TOKENS.amber,"Payment Success Rate"],
        ].map(([label, value, color, sub]) => (
          <KpiCard key={label} label={label} value={value} sub={sub} icon="◈" accent={color}/>
        ))}
      </div>

      {/* Revenue + Plans */}
      <div style={{ display:"grid", gridTemplateColumns:"1.5fr 1fr", gap:12 }}>
        <Card title="Revenue Trend (6 months)" action={
          <span style={{ fontSize:11, color:TOKENS.green, fontWeight:600 }}>
            ARR {money(data.arr)}
          </span>
        }>
          <div style={{ display:"flex", gap:4, height:64, alignItems:"flex-end", direction:"ltr" }}>
            {Object.entries(data.monthly_revenue||{}).sort((a,b)=>a[0].localeCompare(b[0])).map(([m,v])=>{
              const maxV = Math.max(...Object.values(data.monthly_revenue||{}),1);
              return (
                <div key={m} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                  <div style={{width:"100%",borderRadius:"3px 3px 0 0",background:TOKENS.blue,opacity:.4+(v/maxV)*.6,height:Math.max(4,Math.round(v/maxV*56))}}/>
                  <div style={{fontSize:8,color:TOKENS.muted}}>{m.slice(5)}</div>
                </div>
              );
            })}
          </div>
        </Card>
        <Card title="Plan Distribution">
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {Object.entries(data.plan_distribution||{}).map(([plan,count])=>{
              const total = Object.values(data.plan_distribution||{}).reduce((a,b)=>a+b,0)||1;
              const col = planColors[plan]||TOKENS.muted;
              const pct = Math.round(count/total*100);
              return (
                <div key={plan}>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:4 }}>
                    <span style={{ color:col, fontWeight:600 }}>{plan.charAt(0).toUpperCase()+plan.slice(1)}</span>
                    <span style={{ color:TOKENS.muted }}>{count} ({pct}%)</span>
                  </div>
                  <div style={{ height:4, background:`rgba(255,255,255,.06)`, borderRadius:99, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${pct}%`, background:col, borderRadius:99 }}/>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Risk signals */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
        <KpiCard label="Failed Payments"  value={data.failed_count}
          sub={data.failed_revenue_at_risk>0?`${money(data.failed_revenue_at_risk)} at risk`:undefined}
          icon="⚠" accent={data.failed_count>0?TOKENS.red:TOKENS.green}/>
        <KpiCard label="Pending Review"   value={data.pending_count}
          sub="Awaiting admin confirmation" icon="⏳"
          accent={data.pending_count>0?TOKENS.amber:TOKENS.green}/>
        <KpiCard label="Total Customers"  value={data.unique_customers}
          sub={`${money(data.avg_payment)} avg payment`} icon="◉" accent={TOKENS.blue}/>
      </div>
    </div>
  );
}


// ── System Panel ───────────────────────────────────────────────────
function SystemPanel({ health, lang, adminProfile, onRefresh, showToast }) {
  const [newKey, setNewKey] = useState("");
  const [genLoading, setGenLoading] = useState(false);
  const isAr = lang === "ar";

  const generateKey = async () => {
    setGenLoading(true);
    try {
      const d = await apiFetch("/keys/create", { method:"POST", body:{ uid: adminProfile?.uid||"admin", plan:"enterprise", name:"Admin API Key" } });
      if (d.api_key) { setNewKey(d.api_key); showToast("API key generated — save it now!"); }
    } catch { showToast("Error generating key","error"); }
    finally { setGenLoading(false); }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Health grid */}
      {health && (
        <Card title={isAr?"صحة النظام":"System Health"}>
          <div style={{ padding:"0 20px 20px" }}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:10, marginBottom:16 }}>
              {Object.entries(health.integrations||{}).map(([name, cfg]) => (
                <HealthDot key={name} ok={cfg.configured} label={name.charAt(0).toUpperCase()+name.slice(1)} sub={cfg.live !== undefined ? (cfg.live ? "Live" : "Not tested") : "Configured"} />
              ))}
            </div>
            <div style={{
              padding:"12px 16px",
              background:"rgba(255,255,255,.02)",
              borderRadius:TOKENS.radiusSm,
              border:`1px solid ${TOKENS.border}`,
              fontFamily:"DM Mono,monospace",
              fontSize:10, color:TOKENS.muted, lineHeight:1.8,
            }}>
              <span style={{ color:TOKENS.blue }}>engine</span>: {health.engine}<br/>
              <span style={{ color:TOKENS.blue }}>version</span>: {health.version}<br/>
              <span style={{ color:TOKENS.blue }}>pdf</span>: {health.pdf_available ? "✓ reportlab" : "✗ not installed"}<br/>
              <span style={{ color:TOKENS.blue }}>redis</span>: {health.redis?.status || "unknown"}
            </div>
          </div>
        </Card>
      )}

      {/* API Key generator */}
      <Card title={isAr?"مفاتيح API للمطورين":"Developer API Keys"}>
        <div style={{ padding:"0 20px 20px" }}>
          <p style={{ fontSize:12, color:TOKENS.muted, lineHeight:1.7, marginBottom:16 }}>
            {isAr ? "أنشئ مفتاح API لتكامل Corvus مع أنظمة الشركة (SAP, Workday, إلخ)" : "Generate API keys for enterprise integrations (SAP, Workday, custom HR systems)."}
          </p>
          <Btn onClick={generateKey} disabled={genLoading}>
            {genLoading ? "Generating…" : isAr ? "إنشاء مفتاح API" : "Generate API Key"}
          </Btn>

          {newKey && (
            <div style={{ marginTop:16, padding:"14px 16px", background:TOKENS.greenBg, border:`1px solid rgba(16,185,129,.2)`, borderRadius:TOKENS.radiusSm }}>
              <div style={{ fontSize:10, color:TOKENS.green, marginBottom:8, fontWeight:600 }}>⚠️ Save this key now — it won't be shown again</div>
              <div style={{ fontFamily:"DM Mono,monospace", fontSize:11, color:TOKENS.text, wordBreak:"break-all", marginBottom:10 }}>{newKey}</div>
              <Btn size="sm" variant="success" onClick={() => { navigator.clipboard.writeText(newKey); showToast("Copied!"); }}>
                Copy key
              </Btn>
            </div>
          )}

          <div style={{ marginTop:16, padding:"12px 16px", background:"rgba(255,255,255,.02)", borderRadius:TOKENS.radiusSm, border:`1px solid ${TOKENS.border}`, fontFamily:"DM Mono,monospace", fontSize:10, color:TOKENS.muted, lineHeight:2 }}>
            <span style={{ color:TOKENS.sky }}>Header:</span> X-Corvus-Key: pai_xxx<br/>
            <span style={{ color:TOKENS.sky }}>Endpoint:</span> POST /api/v1/posture/analyze
          </div>
        </div>
      </Card>
    </div>
  );
}
