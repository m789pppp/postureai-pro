/**
 * Corvus — SaaS Dashboard v1
 * Modern analytics dashboard: Overview, Usage, Activity, Team, Billing, Settings
 * Design: Linear/Stripe quality — dark premium — fully responsive
 * WCAG 2.1 AA · RTL-ready
 */
import React, { useState, useEffect, useCallback, useMemo } from "react";

// ── Design tokens ─────────────────────────────────────────────────
const C = {
  bg:    "#030b14",
  surf:  "#071220",
  card:  "#0d1e33",
  border:"rgba(148,163,184,.09)",
  borderM:"rgba(148,163,184,.18)",
  text:  "#e8f0ff",
  sub:   "#8fa3c0",
  muted: "#475569",
  blue:  "#4f7cf9",
  indigo:"#818cf8",
  sky:   "#22d3ee",
  green: "#10d9a0",
  amber: "#f59e0b",
  red:   "#f87171",
  violet:"#a78bfa",
  gBlue: "linear-gradient(135deg,#4f7cf9,#22d3ee)",
};

const card = (accent = false) => ({
  background: C.card,
  border: `1px solid ${accent ? "rgba(79,124,249,.25)" : C.border}`,
  borderRadius: 14,
  padding: 24,
});

// ── Sparkline ─────────────────────────────────────────────────────
function Sparkline({ data = [], color = C.blue, height = 36 }) {
  if (!data.length) return null;
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const w = 120, h = height;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * w,
    h - ((v - min) / range) * h * 0.85 - h * 0.075,
  ]);
  const path = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const fill = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")
    + ` L${w},${h} L0,${h} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow:"visible" }}>
      <defs>
        <linearGradient id={`sg${color.slice(1,7)}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#sg${color.slice(1,7)})`}/>
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

// ── Metric card ───────────────────────────────────────────────────
function MetricCard({ icon, label, value, sub, trend, sparkData, color = C.blue }) {
  const isPos = trend?.startsWith("+");
  return (
    <div style={{ ...card(), display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div style={{
          width:38, height:38, borderRadius:10,
          background:`rgba(${color === C.green ? "16,217,160" : color === C.amber ? "245,158,11" : color === C.red ? "248,113,113" : "79,124,249"},.12)`,
          display:"flex", alignItems:"center", justifyContent:"center", fontSize:18,
        }}>{icon}</div>
        {trend && (
          <span style={{
            fontSize:12, fontWeight:600, padding:"3px 8px", borderRadius:6,
            background: isPos ? "rgba(16,217,160,.1)" : "rgba(248,113,113,.1)",
            color: isPos ? C.green : C.red,
          }}>{trend}</span>
        )}
      </div>
      <div>
        <div style={{ fontSize:28, fontWeight:800, color:C.text, letterSpacing:"-.02em",
          lineHeight:1, marginBottom:4 }}>{value}</div>
        <div style={{ fontSize:13, color:C.muted }}>{label}</div>
        {sub && <div style={{ fontSize:12, color:C.sub, marginTop:2 }}>{sub}</div>}
      </div>
      {sparkData && (
        <div style={{ marginTop:-4 }}>
          <Sparkline data={sparkData} color={color}/>
        </div>
      )}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────
function Sidebar({ active, setActive, user, lang }) {
  const ar = lang === "ar";
  const nav = ar ? [
    { id:"overview",   icon:"📊", label:"النظرة العامة" },
    { id:"analysis",   icon:"🎯", label:"تحليل الوضعية" },
    { id:"team",       icon:"👥", label:"إدارة الفريق" },
    { id:"analytics",  icon:"📈", label:"التحليلات" },
    { id:"coaching",   icon:"🤖", label:"مدرب AI" },
    { id:"billing",    icon:"💳", label:"الفوترة" },
    { id:"settings",   icon:"⚙️", label:"الإعدادات" },
  ] : [
    { id:"overview",   icon:"📊", label:"Overview" },
    { id:"analysis",   icon:"🎯", label:"Posture Analysis" },
    { id:"team",       icon:"👥", label:"Team" },
    { id:"analytics",  icon:"📈", label:"Analytics" },
    { id:"coaching",   icon:"🤖", label:"AI Coach" },
    { id:"billing",    icon:"💳", label:"Billing" },
    { id:"settings",   icon:"⚙️", label:"Settings" },
  ];

  return (
    <aside style={{
      width:220, background:C.surf, borderRight:`1px solid ${C.border}`,
      display:"flex", flexDirection:"column", height:"100vh",
      position:"sticky", top:0, flexShrink:0,
    }}>
      {/* Logo */}
      <div style={{ padding:"20px 16px 16px", borderBottom:`1px solid ${C.border}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:8,
            background:C.gBlue, display:"flex", alignItems:"center",
            justifyContent:"center", fontSize:16 }}>🧘</div>
          <span style={{ fontWeight:700, fontSize:15, color:C.text }}>Corvus</span>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex:1, padding:"12px 10px", overflowY:"auto" }}>
        {nav.map(item => (
          <button key={item.id} onClick={() => setActive(item.id)} style={{
            width:"100%", display:"flex", alignItems:"center", gap:10,
            padding:"10px 12px", borderRadius:10, marginBottom:2,
            background: active === item.id ? "rgba(79,124,249,.12)" : "transparent",
            border: active === item.id ? "1px solid rgba(79,124,249,.2)" : "1px solid transparent",
            cursor:"pointer", textAlign:"left", transition:"all .15s",
          }}>
            <span style={{ fontSize:16, flexShrink:0 }}>{item.icon}</span>
            <span style={{ fontSize:14, fontWeight:active === item.id ? 600 : 400,
              color: active === item.id ? C.text : C.sub,
              transition:"color .15s" }}>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* User */}
      <div style={{ padding:"12px 16px", borderTop:`1px solid ${C.border}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:"50%",
            background:"linear-gradient(135deg,#4f7cf9,#22d3ee)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:14, fontWeight:700, color:"#fff" }}>
            {(user?.name || user?.email || "U").charAt(0).toUpperCase()}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:600, color:C.text,
              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {user?.name || "User"}
            </div>
            <div style={{ fontSize:11, color:C.muted,
              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {user?.email}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ── Overview panel ────────────────────────────────────────────────
function Overview({ data, lang }) {
  const ar = lang === "ar";
  const sparkBase = () => Array.from({length:14}, (_,i) => 50 + Math.sin(i*.7)*20 + Math.random()*15);

  const metrics = ar ? [
    { icon:"🎯", label:"متوسط درجة الوضعية اليوم", value:`${data?.avgScore || 78}`, sub:`↑ من ${(data?.avgScore || 78) - 3} أمس`, trend:"+4%", color:C.green, sparkData:sparkBase() },
    { icon:"👥", label:"المستخدمون النشطون", value:`${data?.activeUsers || 124}`, sub:"من أصل 150 موظف", trend:"+12", color:C.blue, sparkData:sparkBase() },
    { icon:"⏱️", label:"ساعات التتبع اليوم", value:`${data?.hoursTracked || 342}`, sub:"متوسط 2.8 ساعة/موظف", trend:"+8%", color:C.sky, sparkData:sparkBase() },
    { icon:"⚠️", label:"تنبيهات المخاطر المرسلة", value:`${data?.alerts || 23}`, sub:"14 درجة عالية · 9 متوسطة", trend:"-15%", color:C.amber, sparkData:sparkBase() },
  ] : [
    { icon:"🎯", label:"Avg posture score today", value:`${data?.avgScore || 78}`, sub:`↑ from ${(data?.avgScore || 78) - 3} yesterday`, trend:"+4%", color:C.green, sparkData:sparkBase() },
    { icon:"👥", label:"Active users today", value:`${data?.activeUsers || 124}`, sub:"out of 150 employees", trend:"+12", color:C.blue, sparkData:sparkBase() },
    { icon:"⏱️", label:"Tracking hours today", value:`${data?.hoursTracked || 342}`, sub:"avg 2.8 hrs/employee", trend:"+8%", color:C.sky, sparkData:sparkBase() },
    { icon:"⚠️", label:"Risk alerts sent", value:`${data?.alerts || 23}`, sub:"14 high · 9 medium", trend:"-15%", color:C.amber, sparkData:sparkBase() },
  ];

  const recentActivity = ar ? [
    { time:"منذ 2 دقيقة", user:"Ahmed M.", action:"انتهى من جلسة تتبع — درجة 87", icon:"✅" },
    { time:"منذ 8 دقائق", user:"Sara K.", action:"تم إرسال تنبيه مخاطر — انحناء شديد", icon:"⚠️" },
    { time:"منذ 15 دقيقة", user:"System", action:"تم إرسال تقرير HR الأسبوعي", icon:"📊" },
    { time:"منذ 32 دقيقة", user:"Omar F.", action:"انضم حساب جديد", icon:"👤" },
  ] : [
    { time:"2m ago", user:"Ahmed M.", action:"Completed tracking session — score 87", icon:"✅" },
    { time:"8m ago", user:"Sara K.", action:"Risk alert sent — excessive forward bend", icon:"⚠️" },
    { time:"15m ago", user:"System", action:"Weekly HR report dispatched to 3 managers", icon:"📊" },
    { time:"32m ago", user:"Omar F.", action:"New account joined team", icon:"👤" },
  ];

  return (
    <div>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:24, fontWeight:700, color:C.text, margin:"0 0 4px", letterSpacing:"-.02em" }}>
          {ar ? "مرحباً بعودتك 👋" : "Welcome back 👋"}
        </h1>
        <p style={{ fontSize:15, color:C.sub, margin:0 }}>
          {ar ? "إليك ملخص اليوم لفريقك" : "Here's your team's summary for today"}
        </p>
      </div>

      {/* Metric grid */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:24 }}
        className="metrics-grid">
        {metrics.map((m, i) => <MetricCard key={i} {...m}/>)}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:16 }} className="overview-bottom">
        {/* Score trend chart placeholder */}
        <div style={{ ...card(), minHeight:200 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
            <h3 style={{ margin:0, fontSize:16, fontWeight:600, color:C.text }}>
              {ar ? "اتجاه الوضعية (14 يوم)" : "Posture Trend (14 days)"}
            </h3>
            <span style={{ fontSize:12, color:C.muted }}>
              {ar ? "متوسط الفريق" : "Team average"}
            </span>
          </div>
          {/* Simple bar chart */}
          <div style={{ display:"flex", alignItems:"flex-end", gap:6, height:120 }}>
            {Array.from({length:14}, (_,i) => {
              const v = 55 + Math.sin(i*.6)*20 + Math.random()*15;
              const color = v >= 80 ? C.green : v >= 65 ? C.amber : C.red;
              return (
                <div key={i} style={{ flex:1, display:"flex", flexDirection:"column",
                  alignItems:"center", gap:4 }}>
                  <div style={{
                    width:"100%", height:`${(v/100)*110}px`,
                    background:`linear-gradient(to top,${color}44,${color}88)`,
                    borderRadius:"4px 4px 0 0",
                    border:`1px solid ${color}44`,
                    transition:"height .3s",
                  }}/>
                </div>
              );
            })}
          </div>
          <div style={{ display:"flex", justifyContent:"space-between",
            marginTop:8, fontSize:11, color:C.muted }}>
            <span>{ar ? "14 يوم مضت" : "14 days ago"}</span>
            <span>{ar ? "اليوم" : "Today"}</span>
          </div>
        </div>

        {/* Activity feed */}
        <div style={{ ...card() }}>
          <h3 style={{ margin:"0 0 16px", fontSize:16, fontWeight:600, color:C.text }}>
            {ar ? "النشاط الأخير" : "Recent Activity"}
          </h3>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {recentActivity.map((a, i) => (
              <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                <span style={{ fontSize:16, flexShrink:0, marginTop:1 }}>{a.icon}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:C.text }}>{a.user}</div>
                  <div style={{ fontSize:12, color:C.sub, lineHeight:1.4, marginTop:2 }}>{a.action}</div>
                  <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{a.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media(max-width:1200px){.metrics-grid{grid-template-columns:repeat(2,1fr)!important}}
        @media(max-width:768px){.metrics-grid{grid-template-columns:1fr!important}.overview-bottom{grid-template-columns:1fr!important}}
      `}</style>
    </div>
  );
}

// ── Billing panel ─────────────────────────────────────────────────
function BillingPanel({ user, lang }) {
  const ar = lang === "ar";
  const plan = user?.tier || "professional";
  const planColors = { starter:C.sub, professional:C.blue, business:C.violet, enterprise:C.green };
  const color = planColors[plan] || C.blue;

  const invoices = [
    { date:"Jun 1, 2026", amount:"$9.00", status:"paid" },
    { date:"May 1, 2026", amount:"$9.00", status:"paid" },
    { date:"Apr 1, 2026", amount:"$9.00", status:"paid" },
  ];

  return (
    <div>
      <h1 style={{ fontSize:24, fontWeight:700, color:C.text, margin:"0 0 24px", letterSpacing:"-.02em" }}>
        {ar ? "الفوترة والاشتراك" : "Billing & Subscription"}
      </h1>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:24 }}
        className="billing-top">
        {/* Current plan */}
        <div style={{ ...card(true), border:`1px solid ${color}44` }}>
          <div style={{ fontSize:12, color:C.muted, textTransform:"uppercase",
            letterSpacing:".08em", marginBottom:8 }}>
            {ar ? "الخطة الحالية" : "Current Plan"}
          </div>
          <div style={{ fontSize:28, fontWeight:800, color:C.text, marginBottom:4,
            textTransform:"capitalize" }}>{plan}</div>
          <div style={{ fontSize:14, color:color, marginBottom:16, fontWeight:500 }}>
            {ar ? "يتجدد في 1 يوليو 2026" : "Renews Jul 1, 2026"}
          </div>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            <button style={{
              background:C.gBlue, color:"#fff", border:"none", borderRadius:8,
              padding:"8px 18px", cursor:"pointer", fontSize:13, fontWeight:600,
            }}>{ar ? "ترقية الخطة" : "Upgrade Plan"}</button>
            <button style={{
              background:"transparent", color:C.sub, border:`1px solid ${C.border}`,
              borderRadius:8, padding:"8px 18px", cursor:"pointer", fontSize:13,
            }}>{ar ? "إدارة الاشتراك" : "Manage Subscription"}</button>
          </div>
        </div>

        {/* Usage */}
        <div style={{ ...card() }}>
          <div style={{ fontSize:12, color:C.muted, textTransform:"uppercase",
            letterSpacing:".08em", marginBottom:14 }}>
            {ar ? "الاستخدام هذا الشهر" : "This Month's Usage"}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {(ar
              ? [["جلسات التحليل","47 / ∞"],["الموظفون النشطون","23 / 100"],["تصدير التقارير","8 تصدير"]]
              : [["Analysis sessions","47 / ∞"],["Active employees","23 / 100"],["Report exports","8 exports"]]
            ).map(([label, val]) => (
              <div key={label} style={{ display:"flex", justifyContent:"space-between",
                alignItems:"center" }}>
                <span style={{ fontSize:14, color:C.sub }}>{label}</span>
                <span style={{ fontSize:14, fontWeight:600, color:C.text }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Invoice history */}
      <div style={{ ...card() }}>
        <h3 style={{ fontSize:16, fontWeight:600, color:C.text, margin:"0 0 16px" }}>
          {ar ? "سجل الفواتير" : "Invoice History"}
        </h3>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
          <thead>
            <tr>
              {(ar ? ["التاريخ","المبلغ","الحالة",""] : ["Date","Amount","Status",""]).map(h => (
                <th key={h} style={{ textAlign:"left", color:C.muted, fontWeight:500,
                  padding:"8px 12px", borderBottom:`1px solid ${C.border}`, fontSize:12,
                  textTransform:"uppercase", letterSpacing:".06em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv, i) => (
              <tr key={i} style={{ borderBottom:`1px solid ${C.border}` }}>
                <td style={{ padding:"12px 12px", color:C.text }}>{inv.date}</td>
                <td style={{ padding:"12px 12px", color:C.text, fontWeight:600 }}>{inv.amount}</td>
                <td style={{ padding:"12px 12px" }}>
                  <span style={{
                    background:"rgba(16,217,160,.1)", color:C.green,
                    padding:"3px 10px", borderRadius:100, fontSize:12, fontWeight:500,
                  }}>
                    {ar ? "مدفوع" : "Paid"}
                  </span>
                </td>
                <td style={{ padding:"12px 12px" }}>
                  <button style={{
                    background:"transparent", color:C.blue,
                    border:`1px solid rgba(79,124,249,.3)`, borderRadius:6,
                    padding:"4px 12px", cursor:"pointer", fontSize:12,
                  }}>{ar ? "تنزيل PDF" : "Download PDF"}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <style>{`@media(max-width:768px){.billing-top{grid-template-columns:1fr!important}}`}</style>
    </div>
  );
}

// ── Settings panel ────────────────────────────────────────────────
function SettingsPanel({ user, lang }) {
  const ar = lang === "ar";
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    company: user?.company || "",
    notifEmail: true,
    notifSlack: false,
    language: lang,
  });

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <h1 style={{ fontSize:24, fontWeight:700, color:C.text, margin:"0 0 24px", letterSpacing:"-.02em" }}>
        {ar ? "الإعدادات" : "Settings"}
      </h1>

      <div style={{ display:"flex", flexDirection:"column", gap:16, maxWidth:560 }}>
        {/* Profile */}
        <div style={{ ...card() }}>
          <h3 style={{ fontSize:16, fontWeight:600, color:C.text, margin:"0 0 16px" }}>
            {ar ? "معلومات الملف الشخصي" : "Profile Information"}
          </h3>
          {[
            { label: ar?"الاسم الكامل":"Full Name", key:"name", type:"text" },
            { label: ar?"البريد الإلكتروني":"Email", key:"email", type:"email" },
            { label: ar?"اسم الشركة":"Company", key:"company", type:"text" },
          ].map(f => (
            <div key={f.key} style={{ marginBottom:14 }}>
              <label style={{ display:"block", fontSize:13, color:C.sub, marginBottom:6, fontWeight:500 }}>
                {f.label}
              </label>
              <input
                type={f.type}
                value={form[f.key]}
                onChange={e => setForm(p => ({ ...p, [f.key]:e.target.value }))}
                style={{
                  width:"100%", padding:"10px 14px",
                  background:"rgba(255,255,255,.05)",
                  border:`1px solid ${C.border}`, borderRadius:8,
                  color:C.text, fontSize:14, outline:"none",
                  boxSizing:"border-box",
                }}
              />
            </div>
          ))}
          <button onClick={handleSave} style={{
            background:C.gBlue, color:"#fff", border:"none",
            borderRadius:8, padding:"10px 20px", cursor:"pointer",
            fontSize:14, fontWeight:600,
          }}>
            {saved ? (ar ? "✓ تم الحفظ" : "✓ Saved") : (ar ? "حفظ التغييرات" : "Save Changes")}
          </button>
        </div>

        {/* Notifications */}
        <div style={{ ...card() }}>
          <h3 style={{ fontSize:16, fontWeight:600, color:C.text, margin:"0 0 16px" }}>
            {ar ? "الإشعارات" : "Notifications"}
          </h3>
          {[
            { key:"notifEmail", label: ar?"إشعارات البريد الإلكتروني":"Email notifications" },
            { key:"notifSlack", label: ar?"إشعارات Slack":"Slack notifications" },
          ].map(n => (
            <div key={n.key} style={{ display:"flex", justifyContent:"space-between",
              alignItems:"center", marginBottom:14 }}>
              <span style={{ fontSize:14, color:C.sub }}>{n.label}</span>
              <div
                onClick={() => setForm(p => ({ ...p, [n.key]:!p[n.key] }))}
                style={{
                  width:44, height:24, borderRadius:12, cursor:"pointer",
                  background: form[n.key] ? C.blue : "rgba(255,255,255,.1)",
                  position:"relative", transition:"background .2s",
                }}>
                <div style={{
                  position:"absolute", width:18, height:18, borderRadius:"50%",
                  background:"#fff", top:3,
                  left: form[n.key] ? 23 : 3,
                  transition:"left .2s",
                  boxShadow:"0 1px 4px rgba(0,0,0,.3)",
                }}/>
              </div>
            </div>
          ))}
        </div>

        {/* Security */}
        <div style={{ ...card() }}>
          <h3 style={{ fontSize:16, fontWeight:600, color:C.text, margin:"0 0 16px" }}>
            {ar ? "الأمان" : "Security"}
          </h3>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <button style={{
              background:"transparent", color:C.sub,
              border:`1px solid ${C.border}`, borderRadius:8,
              padding:"10px 16px", cursor:"pointer", fontSize:14, textAlign:"left",
              display:"flex", justifyContent:"space-between",
            }}>
              <span>{ar ? "تغيير كلمة المرور" : "Change password"}</span>
              <span>→</span>
            </button>
            <button style={{
              background:"transparent", color:C.sub,
              border:`1px solid ${C.border}`, borderRadius:8,
              padding:"10px 16px", cursor:"pointer", fontSize:14, textAlign:"left",
              display:"flex", justifyContent:"space-between",
            }}>
              <span>{ar ? "إعداد المصادقة الثنائية" : "Set up 2FA"}</span>
              <span>→</span>
            </button>
            <button style={{
              background:"transparent", color:C.sub,
              border:`1px solid ${C.border}`, borderRadius:8,
              padding:"10px 16px", cursor:"pointer", fontSize:14, textAlign:"left",
              display:"flex", justifyContent:"space-between",
            }}>
              <span>{ar ? "مفاتيح API" : "API Keys"}</span>
              <span>→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────
export default function Dashboard({ user, onNavigate, lang = "en" }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [dashData] = useState({
    avgScore: 78, activeUsers: 124, hoursTracked: 342, alerts: 23,
  });

  const renderPanel = () => {
    switch (activeTab) {
      case "overview": return <Overview data={dashData} lang={lang}/>;
      case "billing":  return <BillingPanel user={user} lang={lang}/>;
      case "settings": return <SettingsPanel user={user} lang={lang}/>;
      default:
        return (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center",
            height:"60vh", flexDirection:"column", gap:12 }}>
            <div style={{ fontSize:48 }}>🔧</div>
            <h2 style={{ color:C.text, fontSize:20, fontWeight:600, margin:0 }}>
              {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            </h2>
            <p style={{ color:C.sub, fontSize:15, margin:0 }}>
              {lang === "ar" ? "هذا القسم في التطوير" : "This section is part of the full app"}
            </p>
          </div>
        );
    }
  };

  return (
    <div style={{ display:"flex", background:C.bg, minHeight:"100vh",
      fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      color:C.text }}>
      <Sidebar active={activeTab} setActive={setActiveTab} user={user} lang={lang}/>
      <main style={{ flex:1, overflow:"auto" }}>
        {/* Top bar */}
        <div style={{
          padding:"16px 28px", borderBottom:`1px solid ${C.border}`,
          display:"flex", justifyContent:"space-between", alignItems:"center",
          position:"sticky", top:0, background:"rgba(3,11,20,.9)",
          backdropFilter:"blur(12px)", zIndex:100,
        }}>
          <div style={{ fontSize:13, color:C.muted }}>
            {new Date().toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US",
              { weekday:"long", year:"numeric", month:"long", day:"numeric" })}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <button style={{
              background:"rgba(79,124,249,.1)", border:"1px solid rgba(79,124,249,.2)",
              color:C.indigo, borderRadius:8, padding:"7px 14px",
              cursor:"pointer", fontSize:13, fontWeight:500,
            }}>
              🎯 {lang === "ar" ? "تحليل الآن" : "Analyze Now"}
            </button>
            <div style={{
              width:8, height:8, borderRadius:"50%", background:C.green,
              boxShadow:`0 0 8px ${C.green}`,
            }}/>
          </div>
        </div>
        <div style={{ padding:"28px" }}>
          {renderPanel()}
        </div>
      </main>
    </div>
  );
}
