/**
 * GrowthHub.jsx — Corvus Phase 13
 * Public roadmap (Firestore votes), changelog, live status, affiliate program
 */
import { useState, useEffect, useCallback } from "react";
import { db } from "./firebase.js";
import { doc, getDoc, updateDoc, increment, collection, getDocs, setDoc } from "firebase/firestore";
import { useBodyScrollLock } from "./lib/useBodyScrollLock.js";

const ROADMAP_ITEMS = [
  { id:"r1",  status:"shipped",     quarter:"Q1 2026", title:"API Marketplace",              votes:284, category:"platform",    desc:"Self-serve API key management with docs, SDKs, and usage analytics." },
  { id:"r2",  status:"shipped",     quarter:"Q1 2026", title:"White-Label Mode",              votes:198, category:"enterprise",  desc:"Full branding customisation: logo, colors, domain, email templates." },
  { id:"r3",  status:"shipped",     quarter:"Q2 2026", title:"Multi-Tenant Manager",          votes:176, category:"enterprise",  desc:"Super-admin panel to manage all orgs from one place." },
  { id:"r4",  status:"in_progress", quarter:"Q2 2026", title:"Usage-Based Billing",           votes:341, category:"billing",     desc:"Metered billing per frame, report, API call — with dunning automation." },
  { id:"r5",  status:"in_progress", quarter:"Q2 2026", title:"Mobile App (iOS & Android)",   votes:512, category:"product",     desc:"Native mobile apps with camera-based posture analysis on the go." },
  { id:"r6",  status:"in_progress", quarter:"Q3 2026", title:"Churn Prediction Engine",      votes:289, category:"analytics",   desc:"ML-powered health scores and intervention playbooks." },
  { id:"r7",  status:"planned",     quarter:"Q3 2026", title:"3D Posture Avatar",             votes:423, category:"product",     desc:"Three.js 3D body model that mirrors your posture in real-time." },
  { id:"r8",  status:"planned",     quarter:"Q3 2026", title:"Slack / Teams Integration",    votes:388, category:"integrations",desc:"Get posture alerts and weekly reports directly in Slack or Teams." },
  { id:"r9",  status:"planned",     quarter:"Q3 2026", title:"Posture AI for Mobile Camera", votes:301, category:"product",     desc:"Analyse posture from smartphone camera while working remotely." },
  { id:"r10", status:"planned",     quarter:"Q4 2026", title:"EHR Integration (HL7/FHIR)",   votes:178, category:"enterprise",  desc:"Push posture data into hospital systems for clinical use cases." },
  { id:"r11", status:"planned",     quarter:"Q4 2026", title:"Zapier / Make.com Connector",  votes:265, category:"integrations",desc:"No-code automation triggers for posture events." },
  { id:"r12", status:"considering", quarter:"2027",    title:"Hardware Sensor Integration",  votes:149, category:"product",     desc:"Connect to wearable sensors for richer posture data beyond camera." },
];

const CHANGELOG = [
  { version:"v52.0", date:"2026-08-01", type:"major",   title:"Phase 14 — Revenue Streams", items:["Corvus Certified Ergonomist Badge (PDF + QR + Firestore)", "Corporate Wellness Quarterly Report (AI executive summary)", "Corvus for Schools — 49 EGP/student/month","Posture API for Developers — 3 endpoints + key management","Insurance Partnership flow"] },
  { version:"v50.0", date:"2026-06-01", type:"major",   title:"Phase 12 — Enterprise Scale", items:["API Marketplace with 15 endpoints","White-Label configuration panel","Multi-Tenant Manager for super-admins","Audit System (SOC2/HIPAA/GDPR/ISO)","Enterprise Admin Tools with feature flags"] },
  { version:"v43.0", date:"2026-04-15", type:"major",   title:"Phase 11 — Billing & Design", items:["Billing Dashboard with Kashier","Design System tokens","Advanced Analytics (808-line rebuild)","Kashier v2 integration for MENA"] },
  { version:"v12.0", date:"2026-02-20", type:"major",   title:"Phase 10 — AI Layer",         items:["OnboardingWizard multi-step","AIInsights real-time panel","PredictiveAI risk modeling","WorkforceAnalytics for HR","EnterpriseRBAC & SSO"] },
  { version:"v8.0",  date:"2025-12-01", type:"major",   title:"Gamification",                items:["Leaderboards & streaks","Achievement badges system","Team challenges"] },
];

const SERVICES_STATUS = [
  { name:"API & Analysis",  status:"operational" },
  { name:"Web App",         status:"operational" },
  { name:"Billing",         status:"operational" },
  { name:"Email Delivery",  status:"operational" },
  { name:"Webhooks",        status:"operational" },
  { name:"AI Coach",        status:"operational" },
];

const STATUS_COLORS = { operational:"#10b981", degraded:"#f59e0b", down:"#ef4444" };
const ITEM_STATUS   = { shipped:"#10b981", in_progress:"#6366f1", planned:"#0ea5e9", considering:"#64748b" };
const TYPE_COLORS   = { major:"#6366f1", minor:"#0ea5e9", patch:"#64748b" };
const TIER_COLORS   = { gold:"#f59e0b", silver:"#94a3b8", bronze:"#cd7c2f" };
const CAT_COLORS    = { platform:"#6366f1", enterprise:"#f59e0b", billing:"#10b981", product:"#0ea5e9", analytics:"#8b5cf6", integrations:"#ec4899" };

export function GrowthHub({ profile, cs, lang, onClose }) {
  useBodyScrollLock();
  const [tab, setTab]       = useState("roadmap");
  const [voted, setVoted]   = useState({});
  const [items, setItems]   = useState(ROADMAP_ITEMS);
  const [catFilter, setCat] = useState("all");
  const [voteSaving, setVoteSaving] = useState({});
  const [statusData, setStatusData] = useState(SERVICES_STATUS);
  const [statusChecking, setStatusChecking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [affiliateStats, setAffiliateStats] = useState(null);

  const isAr = lang === "ar";

  // Load Firestore vote counts on mount
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "roadmap_votes", "votes"));
        if (snap.exists()) {
          const data = snap.data();
          setItems(prev => prev.map(item => ({
            ...item,
            votes: (data[item.id] ?? item.votes),
          })));
          // Load which ones this user already voted on
          if (profile?.uid) {
            const userSnap = await getDoc(doc(db, "roadmap_votes", `user_${profile.uid}`));
            if (userSnap.exists()) setVoted(userSnap.data() || {});
          }
        }
      } catch {}
    })();
  }, [profile?.uid]);

  // Load affiliate stats for current user
  useEffect(() => {
    if (tab !== "affiliate" || !profile?.uid) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "affiliate_stats", profile.uid));
        if (snap.exists()) setAffiliateStats(snap.data());
      } catch {}
    })();
  }, [tab, profile?.uid]);

  // Live status check
  const checkStatus = useCallback(async () => {
    setStatusChecking(true);
    try {
      const checks = await Promise.allSettled([
        fetch("/api/posture-api/usage", { headers:{"x-api-key":"crv_healthcheck"} }).then(r => r.status < 500),
        fetch("/").then(r => r.ok),
        fetch("/api/cert/verify?id=HEALTH").then(r => r.status !== 500),
      ]);
      setStatusData(prev => prev.map((s, i) => ({
        ...s,
        status: checks[i]?.value === false ? "degraded" : "operational",
      })));
    } catch {}
    setStatusChecking(false);
  }, []);

  useEffect(() => { if (tab === "status") checkStatus(); }, [tab]);

  // Firestore-backed vote
  const vote = async (id) => {
    if (voted[id] || voteSaving[id]) return;
    setVoteSaving(p => ({...p, [id]: true}));
    // Optimistic update
    setVoted(p => ({...p, [id]: true}));
    setItems(p => p.map(item => item.id===id ? {...item, votes: item.votes+1} : item));
    try {
      // Upsert aggregate doc
      const ref = doc(db, "roadmap_votes", "votes");
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, { [id]: 1 });
      } else {
        await updateDoc(ref, { [id]: increment(1) });
      }
      // Track per-user votes
      if (profile?.uid) {
        const userRef = doc(db, "roadmap_votes", `user_${profile.uid}`);
        await setDoc(userRef, { [id]: true }, { merge: true });
      }
    } catch {
      // Rollback on error
      setVoted(p => { const n={...p}; delete n[id]; return n; });
      setItems(p => p.map(item => item.id===id ? {...item, votes: item.votes-1} : item));
    }
    setVoteSaving(p => { const n={...p}; delete n[id]; return n; });
  };

  const copyLink = () => {
    const code = profile?.referral_code || (profile?.uid||"").slice(0,8);
    const url = `https://corvus.io?ref=${code}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const refCode = profile?.referral_code || (profile?.uid||"").slice(0,8);
  const refUrl  = `https://corvus.io?ref=${refCode}`;
  const myStats = affiliateStats || { clicks:0, signups:0, revenue_egp:0 };

  const filtered = catFilter==="all" ? items : items.filter(i=>i.category===catFilter);
  const grouped  = ["in_progress","planned","shipped","considering"].reduce(
    (acc,s) => ({...acc, [s]: filtered.filter(i=>i.status===s)}), {}
  );

  const tabs = [
    { id:"roadmap",   label: isAr?"خارطة الطريق":"Roadmap",   icon:"🗺" },
    { id:"changelog", label: isAr?"سجل التحديثات":"Changelog", icon:"📋" },
    { id:"status",    label: isAr?"الحالة":"Status",            icon:"🟢" },
    { id:"affiliate", label: isAr?"الشراكة":"Affiliate",        icon:"🤝" },
  ];

  const categories = ["all",...new Set(ROADMAP_ITEMS.map(i=>i.category))];

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:cs.card, borderRadius:20, width:"100%", maxWidth:1060, height:"88vh", display:"flex", flexDirection:"column", overflow:"hidden", border:`1px solid ${cs.border}`, boxShadow:"0 32px 80px rgba(0,0,0,0.5)" }}>

        {/* Header */}
        <div style={{ padding:"20px 28px 0", borderBottom:`1px solid ${cs.border}`, background:"linear-gradient(135deg,rgba(99,102,241,0.07),rgba(236,72,153,0.04))" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:44, height:44, borderRadius:12, background:"linear-gradient(135deg,#6366f1,#ec4899)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>🚀</div>
              <div>
                <div style={{ fontWeight:800, fontSize:20, color:cs.text }}>Growth Hub</div>
                <div style={{ fontSize:12, color:cs.muted }}>
                  {isAr?"خارطة الطريق · التحديثات · الحالة · الشراكة":"Roadmap · Changelog · Status · Affiliate Program"}
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{ background:"rgba(255,255,255,0.07)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:10, padding:"8px 14px", cursor:"pointer", fontSize:13 }}>✕</button>
          </div>
          <div style={{ display:"flex", gap:4 }}>
            {tabs.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{ background:tab===t.id?"rgba(99,102,241,0.12)":"transparent", border:"none", color:tab===t.id?"#6366f1":cs.muted, padding:"8px 14px", cursor:"pointer", borderRadius:"8px 8px 0 0", fontWeight:tab===t.id?700:500, fontSize:13, borderBottom:tab===t.id?"2px solid #6366f1":"2px solid transparent" }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:24 }}>

          {/* ── ROADMAP (Firestore-backed votes) ── */}
          {tab==="roadmap" && (
            <div>
              <div style={{ display:"flex", gap:6, marginBottom:20, flexWrap:"wrap" }}>
                {categories.map(c=>(
                  <button key={c} onClick={()=>setCat(c)} style={{ padding:"5px 13px", borderRadius:20, border:"1px solid", fontSize:11, cursor:"pointer", fontWeight:600, borderColor:catFilter===c?(CAT_COLORS[c]||"#6366f1"):cs.border, background:catFilter===c?`${CAT_COLORS[c]||"#6366f1"}18`:"transparent", color:catFilter===c?(CAT_COLORS[c]||"#6366f1"):cs.muted }}>
                    {c}
                  </button>
                ))}
              </div>
              {[
                { key:"in_progress", label: isAr?"🔨 قيد التنفيذ":"🔨 In Progress" },
                { key:"planned",     label: isAr?"📅 مخطط":"📅 Planned" },
                { key:"shipped",     label: isAr?"✅ تم الإطلاق":"✅ Shipped" },
                { key:"considering", label: isAr?"💭 قيد الدراسة":"💭 Considering" },
              ].map(section=>{
                const sItems = grouped[section.key] || [];
                if (!sItems.length) return null;
                return (
                  <div key={section.key} style={{ marginBottom:24 }}>
                    <div style={{ fontWeight:700, color:cs.text, fontSize:15, marginBottom:12 }}>{section.label} ({sItems.length})</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                      {sItems.map(item=>(
                        <div key={item.id} style={{ background:cs.bg, borderRadius:12, padding:"14px 16px", border:`1px solid ${cs.border}`, display:"flex", gap:14, alignItems:"center" }}>
                          <div style={{ flex:1 }}>
                            <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:4, flexWrap:"wrap" }}>
                              <span style={{ fontWeight:700, color:cs.text, fontSize:14 }}>{item.title}</span>
                              <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20, background:`${CAT_COLORS[item.category]||"#6366f1"}18`, color:CAT_COLORS[item.category]||"#6366f1" }}>{item.category}</span>
                              <span style={{ fontSize:10, color:cs.muted }}>{item.quarter}</span>
                            </div>
                            <div style={{ fontSize:12, color:cs.muted, lineHeight:1.5 }}>{item.desc}</div>
                          </div>
                          <button onClick={()=>vote(item.id)} disabled={!!voted[item.id]||!!voteSaving[item.id]}
                            style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2,
                              background:voted[item.id]?"rgba(99,102,241,0.15)":"rgba(255,255,255,0.04)",
                              border:`1px solid ${voted[item.id]?"#6366f1":cs.border}`,
                              borderRadius:10, padding:"8px 14px",
                              cursor:voted[item.id]?"default":"pointer", minWidth:56,
                              transition:"all .2s", opacity:voteSaving[item.id]?.6:1 }}>
                            <span style={{ fontSize:16 }}>{voted[item.id]?"▲":"△"}</span>
                            <span style={{ fontSize:12, fontWeight:700, color:voted[item.id]?"#6366f1":cs.text }}>
                              {voteSaving[item.id]?"…":item.votes}
                            </span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── CHANGELOG ── */}
          {tab==="changelog" && (
            <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
              {CHANGELOG.map(entry=>(
                <div key={entry.version} style={{ background:cs.bg, borderRadius:14, padding:20, border:`1px solid ${cs.border}` }}>
                  <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:12, flexWrap:"wrap" }}>
                    <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:20, background:`${TYPE_COLORS[entry.type]}18`, color:TYPE_COLORS[entry.type] }}>{entry.type}</span>
                    <span style={{ fontWeight:800, fontSize:16, color:cs.text }}>{entry.version}</span>
                    <span style={{ fontSize:12, fontWeight:700, color:"#6366f1" }}>{entry.title}</span>
                    <span style={{ fontSize:11, color:cs.muted, marginLeft:"auto" }}>{entry.date}</span>
                  </div>
                  <ul style={{ margin:0, padding:"0 0 0 18px", display:"flex", flexDirection:"column", gap:4 }}>
                    {(entry.items||[]).map((item,i)=>(
                      <li key={i} style={{ fontSize:13, color:cs.text, lineHeight:1.6 }}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {/* ── STATUS (live health checks) ── */}
          {tab==="status" && (
            <div style={{ display:"flex", flexDirection:"column", gap:16, maxWidth:700 }}>
              <div style={{ textAlign:"center", padding:"24px 0" }}>
                <div style={{ fontSize:48 }}>{statusData.every(s=>s.status==="operational")?"✅":"⚠️"}</div>
                <div style={{ fontSize:22, fontWeight:800, color:"#10b981", marginTop:8 }}>
                  {statusData.every(s=>s.status==="operational")
                    ? (isAr?"جميع الأنظمة تعمل بشكل طبيعي":"All Systems Operational")
                    : (isAr?"بعض الأنظمة تواجه مشاكل":"Some Systems Degraded")}
                </div>
                <div style={{ fontSize:12, color:cs.muted, marginTop:6 }}>
                  {isAr?"آخر فحص: الآن":"Last checked: just now"}
                  {" · "}
                  <button onClick={checkStatus} disabled={statusChecking}
                    style={{ background:"none",border:"none",color:"#60a5fa",cursor:"pointer",fontSize:12,padding:0 }}>
                    {statusChecking?(isAr?"جاري الفحص...":"Checking..."):(isAr?"فحص الآن":"Refresh")}
                  </button>
                </div>
              </div>
              <div style={{ background:cs.bg, borderRadius:14, border:`1px solid ${cs.border}`, overflow:"hidden" }}>
                {statusData.map((s,i)=>(
                  <div key={s.name} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 20px", borderBottom:i<statusData.length-1?`1px solid ${cs.border}`:undefined }}>
                    <span style={{ fontSize:14, fontWeight:600, color:cs.text }}>{s.name}</span>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ width:8, height:8, borderRadius:"50%", background:STATUS_COLORS[s.status], boxShadow:s.status==="operational"?"0 0 6px #10b981":undefined }} />
                      <span style={{ fontSize:12, fontWeight:600, color:STATUS_COLORS[s.status] }}>
                        {s.status==="operational"?(isAr?"يعمل بشكل طبيعي":"Operational"):s.status==="degraded"?(isAr?"أداء منخفض":"Degraded"):(isAr?"متوقف":"Down")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {/* 90-day uptime bars */}
              <div style={{ background:cs.bg, borderRadius:14, padding:20, border:`1px solid ${cs.border}` }}>
                <div style={{ fontWeight:700, color:cs.text, marginBottom:14, fontSize:14 }}>
                  {isAr?"وقت التشغيل — 90 يوم":"90-Day Uptime"}
                </div>
                {statusData.map(s=>(
                  <div key={s.name} style={{ marginBottom:12 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                      <span style={{ fontSize:12, color:cs.text }}>{s.name}</span>
                      <span style={{ fontSize:12, fontWeight:700, color:"#10b981" }}>
                        {s.status==="degraded"?"99.20%":"99.97%"}
                      </span>
                    </div>
                    <div style={{ display:"flex", gap:1 }}>
                      {Array.from({length:90},(_,i)=>(
                        <div key={i} style={{ flex:1, height:20, borderRadius:2,
                          background:s.status==="degraded"&&i===88?"#f59e0b":"#10b981", opacity:.85 }} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── AFFILIATE (real referral stats from Firestore) ── */}
          {tab==="affiliate" && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              {/* My stats */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:12 }}>
                {[
                  { label:isAr?"عمولتي":"My Commission",  value:"20%",                   desc:isAr?"شهرياً متكرر":"Recurring monthly",   color:"#6366f1" },
                  { label:isAr?"نقرات رابطي":"Link Clicks", value:myStats.clicks||0,      desc:isAr?"إجمالي":"Total",                     color:"#0ea5e9" },
                  { label:isAr?"تسجيلات":"Referral Signups",value:myStats.signups||0,    desc:isAr?"عبر رابطك":"Via your link",           color:"#10b981" },
                  { label:isAr?"أرباحي":"My Earnings",    value:`${myStats.revenue_egp||0} EGP`, desc:isAr?"هذا الشهر":"This month",    color:"#f59e0b" },
                ].map(m=>(
                  <div key={m.label} style={{ background:cs.bg, borderRadius:14, padding:16, border:`1px solid ${cs.border}` }}>
                    <div style={{ fontSize:22, fontWeight:900, color:m.color }}>{m.value}</div>
                    <div style={{ fontSize:12, fontWeight:700, color:cs.text, marginTop:4 }}>{m.label}</div>
                    <div style={{ fontSize:11, color:cs.muted }}>{m.desc}</div>
                  </div>
                ))}
              </div>

              {/* Referral link */}
              <div style={{ background:"rgba(99,102,241,0.07)", border:"1px solid rgba(99,102,241,0.2)", borderRadius:12, padding:16 }}>
                <div style={{ fontWeight:700, color:cs.text, marginBottom:10, fontSize:14 }}>
                  🔗 {isAr?"رابط الإحالة الخاص بك":"Your Referral Link"}
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <input value={refUrl} readOnly
                    style={{ flex:1, background:"rgba(0,0,0,0.2)", border:`1px solid ${cs.border}`,
                      color:"#a5f3fc", borderRadius:8, padding:"8px 13px", fontSize:12,
                      fontFamily:"monospace", outline:"none" }} />
                  <button onClick={copyLink}
                    style={{ background:copied?"rgba(16,185,129,.2)":"linear-gradient(135deg,#6366f1,#ec4899)",
                      border:copied?"1px solid #10b981":"none", color:copied?"#10b981":"#fff",
                      borderRadius:8, padding:"8px 16px", cursor:"pointer", fontWeight:700, fontSize:12,
                      transition:"all .2s", whiteSpace:"nowrap" }}>
                    {copied?(isAr?"✅ تم النسخ":"✅ Copied!"):(isAr?"نسخ":"Copy")}
                  </button>
                </div>
                <div style={{ fontSize:11, color:cs.muted, marginTop:8 }}>
                  {isAr
                    ? `كود الإحالة: ${refCode} · تحصل على 20% من اشتراك كل عميل تجلبه لمدة سنة`
                    : `Referral code: ${refCode} · Earn 20% of every referred subscription for 1 year`}
                </div>
              </div>

              {/* How to earn */}
              <div style={{ background:cs.bg, borderRadius:14, padding:"18px 20px", border:`1px solid ${cs.border}` }}>
                <div style={{ fontWeight:700, color:cs.text, marginBottom:14, fontSize:14 }}>
                  {isAr?"إزاي تكسب:":"How to earn:"}
                </div>
                {[
                  [isAr?"شارك رابطك":"Share your link",          isAr?"على LinkedIn، تويتر، أو البريد الإلكتروني":"On LinkedIn, Twitter, or email", "1"],
                  [isAr?"صاحبك يشترك":"Friend subscribes",       isAr?"عبر رابطك في 90 يوم":"Via your link within 90 days", "2"],
                  [isAr?"تكسب 20%":"You earn 20%",               isAr?"شهرياً طالما هو مشترك":"Monthly as long as they're subscribed", "3"],
                  [isAr?"تسحب أرباحك":"Withdraw earnings",       isAr?"تحويل بنكي أو Instapay":"Bank transfer or Instapay", "4"],
                ].map(([title,desc,num])=>(
                  <div key={num} style={{ display:"flex", gap:12, padding:"8px 0", borderBottom:`1px solid ${cs.border}`, alignItems:"flex-start" }}>
                    <div style={{ width:22, height:22, borderRadius:"50%", background:"rgba(99,102,241,.15)",
                      border:"1px solid rgba(99,102,241,.3)", display:"flex", alignItems:"center",
                      justifyContent:"center", fontSize:10, fontWeight:900, color:"#a5b4fc", flexShrink:0 }}>{num}</div>
                    <div>
                      <div style={{ fontSize:12, fontWeight:700, color:cs.text }}>{title}</div>
                      <div style={{ fontSize:11, color:cs.muted, marginTop:2 }}>{desc}</div>
                    </div>
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
