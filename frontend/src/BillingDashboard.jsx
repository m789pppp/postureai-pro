/**
 * Corvus — BillingDashboard v1
 * Phase 8: Billing Maturity
 * Tabs: Overview · Usage · Invoices · Plan Change · Analytics (admin)
 */
import { useState, useEffect, useCallback } from "react";
import { BillingAPI, PaymentAPI } from "./services/api.js";
import { COLORS as C, TYPE as TY, SPACE as SP, RADIUS as R,
         GLOBAL_CSS, scoreColor } from "./DesignSystem.js";
import { Skeleton, Spinner, EmptyState, ErrorState,
         ProgressBar, Badge, Btn, Divider } from "./ui/index.jsx";

// ─── tokens ─────────────────────────────────────────────────────
const TOKENS = {
  bg:C.bg, surf:C.bgElevated, card:C.surface,
  border:C.border, text:C.text, muted:C.muted,
  blue:C.blue, green:C.green, amber:C.amber, red:C.red,
};

const PLAN_META = {
  standard:     { color:"#64748b", label:"Starter",      labelAr:"ستارتر"    },
  professional: { color:"#38bdf8", label:"Growth",       labelAr:"جروث"      },
  elite:        { color:"#10b981", label:"Enterprise",   labelAr:"إنتربرايز" },
};

const PLAN_ORDER = ["standard","professional","elite"];
const planRank   = p => PLAN_ORDER.indexOf(p);

const money = n => n != null ? `${Number(n).toLocaleString()} EGP` : "—";
const fmt   = d => d?.toDate?.()?.toLocaleDateString?.() || d?.split?.("T")?.[0] || "—";

// ─── sub-components ─────────────────────────────────────────────
function Card({ title, sub, action, children, style }) {
  return (
    <div style={{ background:TOKENS.card, border:`1px solid ${TOKENS.border}`,
      borderRadius:R.lg, overflow:"hidden", ...style }}>
      {title && (
        <div style={{ padding:`${SP[4]}px ${SP[5]}px`,
          borderBottom:`1px solid ${TOKENS.border}`,
          display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:TOKENS.text }}>{title}</div>
            {sub && <div style={{ fontSize:10, color:TOKENS.muted, marginTop:2 }}>{sub}</div>}
          </div>
          {action}
        </div>
      )}
      <div style={{ padding:`${SP[4]}px ${SP[5]}px` }}>{children}</div>
    </div>
  );
}

function KpiBox({ label, value, sub, color, trend }) {
  const col = color || TOKENS.text;
  return (
    <div style={{ background:TOKENS.card, border:`1px solid ${TOKENS.border}`,
      borderRadius:R.md, padding:SP[4], position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", top:0, left:0, right:0, height:2,
        background:`linear-gradient(90deg,${col}60,transparent)` }}/>
      <div style={{ fontSize:10, fontWeight:700, color:TOKENS.muted,
        letterSpacing:".08em", textTransform:"uppercase", marginBottom:8 }}>{label}</div>
      <div style={{ fontSize:26, fontWeight:800, color:col,
        letterSpacing:"-1.5px", lineHeight:1, marginBottom:4 }}>{value ?? "—"}</div>
      {sub   && <div style={{ fontSize:10.5, color:col, fontWeight:500 }}>{sub}</div>}
      {trend !== undefined && (
        <div style={{ fontSize:10, color:trend>0?TOKENS.green:trend<0?TOKENS.red:TOKENS.muted, marginTop:4 }}>
          {trend>0?`↑ +${trend}`:trend<0?`↓ ${trend}`:"→ stable"}
        </div>
      )}
    </div>
  );
}

function UsageMeter({ label, used, limit, color }) {
  const unlimited = limit < 0;
  const pct = unlimited ? 0 : limit > 0 ? Math.min(100, Math.round(used/limit*100)) : 100;
  const col = unlimited ? TOKENS.green : pct>=90?TOKENS.red:pct>=70?TOKENS.amber:TOKENS.green;
  return (
    <div style={{ marginBottom:SP[3] }}>
      <div style={{ display:"flex", justifyContent:"space-between",
        alignItems:"center", marginBottom:6 }}>
        <span style={{ fontSize:12, color:TOKENS.text, fontWeight:500 }}>{label}</span>
        <span style={{ fontSize:11, color:col, fontWeight:600 }}>
          {unlimited ? "∞ Unlimited" : `${used} / ${limit}`}
        </span>
      </div>
      {!unlimited && (
        <ProgressBar value={pct} max={100} color={col} h={5}/>
      )}
      {unlimited && (
        <div style={{ height:5, background:`${TOKENS.green}25`, borderRadius:99 }}/>
      )}
    </div>
  );
}

function PlanBadge({ plan }) {
  const m = PLAN_META[plan] || PLAN_META.standard;
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:5,
      fontSize:10, fontWeight:700, letterSpacing:".05em",
      padding:"3px 10px", borderRadius:99,
      color:m.color, background:`${m.color}14`,
      border:`1px solid ${m.color}30`,
    }}>{m.label.toUpperCase()}</span>
  );
}

function RevenueSparkline({ data }) {
  if (!data || !Object.keys(data).length) return (
    <div style={{ height:56, display:"flex", alignItems:"center",
      justifyContent:"center", fontSize:11, color:TOKENS.muted }}>No data</div>
  );
  const entries = Object.entries(data).sort((a,b)=>a[0].localeCompare(b[0]));
  const max = Math.max(...entries.map(e=>e[1]), 1);
  return (
    <div style={{ display:"flex", gap:4, height:56, alignItems:"flex-end", direction:"ltr" }}>
      {entries.map(([m, v]) => (
        <div key={m} style={{ flex:1, display:"flex", flexDirection:"column",
          alignItems:"center", gap:4 }}>
          <div style={{ width:"100%", borderRadius:"3px 3px 0 0",
            background:TOKENS.blue, opacity:.5+(v/max)*.5,
            height:Math.max(4, Math.round(v/max*50)),
            transition:"height .5s ease" }}/>
          <div style={{ fontSize:7.5, color:TOKENS.muted }}>{m.slice(5)}</div>
        </div>
      ))}
    </div>
  );
}

function ProrationCard({ currentPlan, newPlan, prorate, isAr }) {
  if (!prorate) return null;
  const isUp = prorate.is_upgrade;
  return (
    <div style={{ background:isUp?`${TOKENS.green}08`:`${TOKENS.amber}08`,
      border:`1px solid ${isUp?TOKENS.green:TOKENS.amber}25`,
      borderRadius:R.md, padding:SP[4] }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:SP[2] }}>
        <span style={{ fontSize:16 }}>{isUp?"↑":"↓"}</span>
        <span style={{ fontSize:13, fontWeight:700,
          color:isUp?TOKENS.green:TOKENS.amber }}>
          {isUp?(isAr?"ترقية فورية":"Immediate Upgrade")
              :(isAr?"تخفيض في الدورة القادمة":"Downgrade at next cycle")}
        </span>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:SP[2] }}>
        {[
          [isAr?"رصيد":"Credit",   money(prorate.credit_amount), TOKENS.green],
          [isAr?"سعر الخطة":"New Price", money(prorate.new_plan_price), TOKENS.blue],
          [isAr?"صافي الدفع":"Net Charge", money(prorate.net_charge),
            prorate.net_charge===0?TOKENS.green:TOKENS.amber],
        ].map(([l,v,col])=>(
          <div key={l} style={{ textAlign:"center" }}>
            <div style={{ fontSize:16, fontWeight:800, color:col }}>{v}</div>
            <div style={{ fontSize:9, color:TOKENS.muted, marginTop:2 }}>{l}</div>
          </div>
        ))}
      </div>
      {prorate.note && (
        <div style={{ marginTop:SP[2], fontSize:11, color:TOKENS.muted }}>{prorate.note}</div>
      )}
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────
export function BillingDashboard({ profile, user, payments=[], isAr, onClose, isAdmin=false, onUpgrade }) {
  const [tab, setTab]         = useState("overview");
  const [usage, setUsage]     = useState(null);
  const [analytics, setAnaly] = useState(null);
  const [prorate, setProrate] = useState(null);
  const [loading, setLoading] = useState({});
  const [newPlan, setNewPlan] = useState("");
  const [newCycle, setNewCycle]= useState("monthly");
  const [daysUsed, setDaysUsed]= useState(15);
  const [toast, setToast]     = useState("");
  const [invoiceLoading, setInvoiceLoading] = useState({});

  const tier  = profile?.tier || "standard";
  const isAr_ = isAr;

  // Individual vs Company — same detection as Billing.jsx
  const isCompany = profile?.user_type === "hr_admin"
    || profile?.user_type === "employee"
    || !!profile?.is_org_owner
    || !!profile?.company_id
    || profile?.acct_type === "company";

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  }, []);

  // Load usage on mount
  useEffect(() => {
    setLoading(p=>({...p,usage:true}));
    BillingAPI.usage()
      .then(d => setUsage(d))
      .catch(()=>{})
      .finally(()=>setLoading(p=>({...p,usage:false})));
  }, []);

  // Load analytics when admin opens that tab
  useEffect(() => {
    if (tab==="analytics" && isAdmin && !analytics) {
      setLoading(p=>({...p,analytics:true}));
      BillingAPI.analytics()
        .then(d => setAnaly(d))
        .catch(()=>{})
        .finally(()=>setLoading(p=>({...p,analytics:false})));
    }
  }, [tab, isAdmin, analytics]);

  // Fetch proration when newPlan changes
  useEffect(() => {
    if (!newPlan || newPlan === tier) { setProrate(null); return; }
    BillingAPI.prorate({
      current_plan: tier, new_plan: newPlan,
      billing_cycle: newCycle, days_used: daysUsed,
    }).then(d => setProrate(d)).catch(()=>{});
  }, [newPlan, newCycle, daysUsed, tier]);

  const downloadInvoice = async (payment) => {
    const ref = payment.ref_code || payment.id;
    setInvoiceLoading(p=>({...p,[ref]:true}));
    try {
      const blob = await BillingAPI.invoicePdf(payment);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url;
      a.download = `invoice_${ref}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(isAr_?"تم تحميل الفاتورة ✓":"Invoice downloaded ✓");
    } catch (e) {
      showToast(isAr_?"خطأ في تحميل الفاتورة":"Invoice download failed");
    } finally {
      setInvoiceLoading(p=>({...p,[ref]:false}));
    }
  };

  const sendDunning = async (payment, stage) => {
    try {
      await BillingAPI.dunning({ payment, stage });
      showToast(`Dunning stage ${stage} sent to ${payment.user_email}`);
    } catch (e) {
      showToast("Dunning send failed");
    }
  };

  const applyPlanChange = async () => {
    if (!newPlan || newPlan === tier) return;
    setLoading(p=>({...p,change:true}));
    try {
      const r = await BillingAPI.changePlan({
        new_plan: newPlan, current_plan: tier,
        billing_cycle: newCycle, days_used: daysUsed,
        user_email: profile?.email, user_name: profile?.name,
      });
      showToast(r.message || (isAr_?"تم تغيير الخطة":"Plan change submitted"));
      setNewPlan("");
      setProrate(null);
    } catch (e) {
      showToast(e.message || "Plan change failed");
    } finally {
      setLoading(p=>({...p,change:false}));
    }
  };

  const confirmedPayments = payments.filter(p=>p.status==="confirmed");
  const pendingPayments   = payments.filter(p=>p.status==="pending");
  const failedPayments    = payments.filter(p=>["rejected","failed"].includes(p.status));

  const TABS = [
    { id:"overview", label:isAr_?"نظرة عامة":"Overview", icon:"◈" },
    { id:"usage",    label:isAr_?"الاستخدام":"Usage",    icon:"📊" },
    { id:"invoices", label:isAr_?"الفواتير":"Invoices",  icon:"📄",
      badge: pendingPayments.length || null },
    { id:"change",   label:isAr_?"تغيير الخطة":"Change Plan", icon:"↕" },
    ...(isAdmin ? [{ id:"analytics", label:"Analytics", icon:"✦" }] : []),
  ];

  const L = {
    totalSpend:   isAr_?"إجمالي الإنفاق":"Total Spend",
    paymentsMade: isAr_?"المدفوعات":"Payments Made",
    currentPlan:  isAr_?"خطتك الحالية":"Current Plan",
    nextRenewal:  isAr_?"التجديد القادم":"Next Renewal",
  };

  const totalSpend = confirmedPayments.reduce((a,p)=>a+(p.amount||0),0);
  const nextRenewal = (() => {
    const last = confirmedPayments[0]?.created_at;
    if (!last) return "—";
    const d = last?.toDate?.() ?? new Date(last);
    const cycle = confirmedPayments[0]?.billing_cycle;
    const next = new Date(d);
    next.setMonth(next.getMonth() + (cycle==="yearly"?12:1));
    return next.toLocaleDateString();
  })();

  return (
    <div style={{ minHeight:"100vh", background:TOKENS.bg, color:TOKENS.text,
      fontFamily:"'DM Sans',system-ui,sans-serif",
      direction:isAr_?"rtl":"ltr" }}>
      <style>{GLOBAL_CSS}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          position:"fixed", top:20, right:20, zIndex:9999,
          background:TOKENS.green, color:"white",
          padding:"10px 18px", borderRadius:R.md,
          fontSize:12, fontWeight:600,
          boxShadow:`0 8px 24px ${TOKENS.green}50`,
          animation:"ds-fadeUp .2s ease",
        }}>✓ {toast}</div>
      )}

      {/* Header */}
      <div style={{ position:"sticky", top:0, zIndex:30,
        background:"rgba(7,11,18,.95)", borderBottom:`1px solid ${TOKENS.border}`,
        backdropFilter:"blur(16px)" }}>
        <div style={{ padding:`${SP[4]}px ${SP[5]}px`,
          display:"flex", alignItems:"center", gap:12 }}>
          <Btn variant="ghost" size="sm" onClick={onClose}>← {isAr_?"رجوع":"Back"}</Btn>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:16, fontWeight:800, color:TOKENS.text, letterSpacing:"-.02em" }}>
              {isAr_?"لوحة الفوترة":"Billing Dashboard"}
            </div>
            <div style={{ fontSize:10, color:TOKENS.muted, marginTop:1 }}>
              {profile?.email} · <PlanBadge plan={tier}/>
            </div>
          </div>
        </div>
        {/* Tabs */}
        <div style={{ display:"flex", padding:`0 ${SP[5]}px`,
          borderTop:`1px solid ${TOKENS.border}`, overflowX:"auto" }}>
          {TABS.map(tb => (
            <button key={tb.id} onClick={()=>setTab(tb.id)} style={{
              background:"none", border:"none",
              borderBottom: tab===tb.id?`2px solid ${TOKENS.blue}`:"2px solid transparent",
              padding:`${SP[3]}px ${SP[4]}px`,
              fontSize:11, fontWeight:600,
              color: tab===tb.id?TOKENS.blue:TOKENS.muted,
              cursor:"pointer", whiteSpace:"nowrap",
              display:"flex", alignItems:"center", gap:5,
            }}>
              <span>{tb.icon}</span><span>{tb.label}</span>
              {tb.badge > 0 && (
                <span style={{ fontSize:8, fontWeight:800, padding:"1px 5px",
                  borderRadius:99, background:TOKENS.amber, color:"white" }}>{tb.badge}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding:SP[5], maxWidth:900, margin:"0 auto",
        display:"flex", flexDirection:"column", gap:SP[4] }}>

        {/* ── OVERVIEW ──────────────────────────────────────────── */}
        {tab==="overview" && (<>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:SP[2] }}>
            <KpiBox label={L.currentPlan}    value={PLAN_META[tier]?.label} color={PLAN_META[tier]?.color}/>
            <KpiBox label={L.totalSpend}     value={money(totalSpend)} color={TOKENS.green}/>
            <KpiBox label={L.paymentsMade}   value={confirmedPayments.length} color={TOKENS.blue}/>
            <KpiBox label={L.nextRenewal}    value={nextRenewal} color={TOKENS.muted}/>
          </div>

          {/* Plan features */}
          <Card title={isAr_?"خطتك الحالية":"Your Current Plan"}>
            <div style={{ display:"flex", alignItems:"center", gap:SP[4],
              flexWrap:"wrap" }}>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:SP[2] }}>
                  <PlanBadge plan={tier}/>
                  {profile?.is_trial && (
                    <Badge label="TRIAL" color={TOKENS.amber} bg={`${TOKENS.amber}10`}/>
                  )}
                </div>
                <div style={{ fontSize:12, color:TOKENS.muted, lineHeight:1.7 }}>
                  {isAr_
                    ? "للترقية أو تغيير خطتك، اضغط على تغيير الخطة"
                    : "To upgrade or change your plan, click the Change Plan tab."}
                </div>
              </div>
              <Btn onClick={()=>setTab("change")} size="sm">
                {isAr_?"تغيير الخطة →":"Change Plan →"}
              </Btn>
            </div>
          </Card>

          {/* Recent payments */}
          {confirmedPayments.length > 0 && (
            <Card title={isAr_?"آخر المدفوعات":"Recent Payments"} style={{ padding:0 }}>
              <div style={{ padding:0 }}>
                {confirmedPayments.slice(0,5).map((p,i) => (
                  <div key={p.id||i} className="ds-row-hov" style={{
                    display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr .8fr",
                    padding:`${SP[3]}px ${SP[5]}px`, alignItems:"center",
                    borderBottom:i<4?`1px solid ${TOKENS.border}`:"none",
                  }}>
                    <div>
                      <div style={{ fontSize:12, fontWeight:600, color:TOKENS.text }}>
                        {PLAN_META[p.tier]?.label||p.tier} Plan
                      </div>
                      <div style={{ fontSize:10, color:TOKENS.muted, marginTop:1 }}>
                        {p.billing_cycle||"monthly"} · {p.payment_method_name||"—"}
                      </div>
                    </div>
                    <div style={{ fontSize:13, fontWeight:800, color:TOKENS.green }}>
                      {money(p.amount)}
                    </div>
                    <div style={{ fontSize:10, color:TOKENS.muted }}>{fmt(p.created_at)}</div>
                    <Badge label="PAID" color={TOKENS.green} bg={`${TOKENS.green}10`}/>
                    <Btn size="sm" variant="ghost"
                      loading={invoiceLoading[p.ref_code||p.id]}
                      onClick={()=>downloadInvoice(p)}>
                      PDF
                    </Btn>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Failed payments alert */}
          {failedPayments.length > 0 && (
            <div style={{ background:`${TOKENS.red}08`, border:`1px solid ${TOKENS.red}25`,
              borderRadius:R.md, padding:SP[4] }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:SP[2] }}>
                <span style={{ fontSize:16 }}>⚠️</span>
                <span style={{ fontSize:13, fontWeight:700, color:TOKENS.red }}>
                  {failedPayments.length} {isAr_?"دفع فاشل":"failed payment(s)"}
                </span>
              </div>
              <div style={{ fontSize:12, color:TOKENS.muted, marginBottom:SP[3] }}>
                {isAr_
                  ?"بعض مدفوعاتك لم تتم — تواصل معنا لحل المشكلة"
                  :"Some payments didn't go through — contact us to resolve."}
              </div>
              <Btn size="sm" variant="danger"
                onClick={()=>setTab("invoices")}>
                {isAr_?"عرض المدفوعات الفاشلة":"View Failed Payments"}
              </Btn>
            </div>
          )}
        </>)}

        {/* ── USAGE ─────────────────────────────────────────────── */}
        {tab==="usage" && (
          <Card title={isAr_?"استخدام الخطة الحالية":"Current Plan Usage"}
            sub={usage?.period}>
            {loading.usage ? (
              <div style={{ display:"flex", flexDirection:"column", gap:SP[2] }}>
                {[0,1,2,3].map(i=><Skeleton key={i} h={40} r={8}/>)}
              </div>
            ) : usage ? (<>
              <UsageMeter
                label={isAr_?"الجلسات اليوم":"Sessions Today"}
                used={usage.usage.sessions_today}
                limit={usage.limits.sessions_per_day}
                color={TOKENS.blue}
              />
              <UsageMeter
                label={isAr_?"الجلسات هذا الشهر":"Sessions This Month"}
                used={usage.usage.sessions_this_month}
                limit={usage.limits.sessions_per_month}
                color={TOKENS.sky}
              />
              <UsageMeter
                label={isAr_?"AI Coach هذا الشهر":"AI Coach This Month"}
                used={usage.usage.ai_coach_this_month}
                limit={usage.limits.ai_coach}
                color={TOKENS.purple}
              />
              <UsageMeter
                label={isAr_?"تصدير PDF هذا الشهر":"PDF Exports This Month"}
                used={usage.usage.pdf_exports_this_month}
                limit={usage.limits.pdf_exports}
                color={TOKENS.amber}
              />
              {usage.at_limit && (
                <div style={{ marginTop:SP[3], padding:SP[3],
                  background:`${TOKENS.amber}08`, border:`1px solid ${TOKENS.amber}25`,
                  borderRadius:R.sm, fontSize:12, color:TOKENS.amber }}>
                  ⚡ {isAr_?"وصلت للحد الأقصى — قم بترقية خطتك للاستمرار"
                    :"You've hit your plan limit — upgrade to continue"}
                  <Btn size="sm" variant="amber"
                    style={{ marginTop:SP[2], display:"block" }}
                    onClick={()=>setTab("change")}>
                    {isAr_?"ترقية الخطة →":"Upgrade Plan →"}
                  </Btn>
                </div>
              )}
            </>) : (
              <EmptyState icon="📊"
                title={isAr_?"لا توجد بيانات استخدام":"No usage data yet"}/>
            )}
          </Card>
        )}

        {/* ── INVOICES ──────────────────────────────────────────── */}
        {tab==="invoices" && (<>
          {/* Pending */}
          {pendingPayments.length > 0 && (
            <Card title={isAr_?"مدفوعات معلقة":"Pending Payments"}
              sub={isAr_?"تحتاج مراجعة":"Awaiting confirmation"}
              style={{ borderColor:`${TOKENS.amber}30` }}>
              {pendingPayments.map((p,i) => (
                <div key={p.id||i} style={{
                  display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr",
                  padding:`${SP[3]}px 0`, alignItems:"center",
                  borderBottom:i<pendingPayments.length-1?`1px solid ${TOKENS.border}`:"none",
                }}>
                  <div>
                    <div style={{ fontSize:12, fontWeight:600 }}>
                      {PLAN_META[p.tier]?.label} · {p.billing_cycle}
                    </div>
                    <div style={{ fontSize:10, color:TOKENS.muted }}>Ref: {p.ref_code}</div>
                  </div>
                  <div style={{ fontSize:13, fontWeight:700, color:TOKENS.amber }}>
                    {money(p.amount)}
                  </div>
                  <div style={{ fontSize:10, color:TOKENS.muted }}>{fmt(p.created_at)}</div>
                  <Badge label="PENDING" color={TOKENS.amber} bg={`${TOKENS.amber}10`}/>
                </div>
              ))}
            </Card>
          )}

          {/* All invoices */}
          <Card title={isAr_?"جميع الفواتير":"All Invoices"} style={{ padding:0 }}>
            {payments.length === 0 ? (
              <div style={{ padding:SP[5] }}>
                <EmptyState icon="📄"
                  title={isAr_?"لا توجد فواتير":"No invoices yet"}
                  desc={isAr_?"ستظهر فواتيرك هنا بعد أول دفعة"
                    :"Your invoices will appear here after your first payment"}/>
              </div>
            ) : (
              <>
                {/* Table header */}
                <div style={{
                  display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr .8fr",
                  padding:`${SP[2]+1}px ${SP[5]}px`,
                  borderBottom:`1px solid ${TOKENS.border}`,
                  fontSize:9, fontWeight:700, color:TOKENS.muted,
                  letterSpacing:".08em", textTransform:"uppercase",
                }}>
                  {[isAr_?"الخطة":"Plan", isAr_?"المبلغ":"Amount",
                    isAr_?"الطريقة":"Method", isAr_?"التاريخ":"Date",
                    isAr_?"الحالة":"Status", ""].map((h,i)=>(
                    <div key={i}>{h}</div>
                  ))}
                </div>
                {payments.map((p,i) => {
                  const st = p.status;
                  const sc = st==="confirmed"?TOKENS.green:st==="pending"?TOKENS.amber:TOKENS.red;
                  const ref = p.ref_code||p.id;
                  return (
                    <div key={ref||i} className="ds-row-hov" style={{
                      display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr .8fr",
                      padding:`${SP[3]}px ${SP[5]}px`, alignItems:"center",
                      borderBottom:i<payments.length-1?`1px solid ${TOKENS.border}`:"none",
                    }}>
                      <div>
                        <div style={{ fontSize:12, fontWeight:600, color:TOKENS.text }}>
                          {PLAN_META[p.tier]?.label||p.tier} · {p.billing_cycle||"—"}
                        </div>
                        <div style={{ fontSize:9, color:TOKENS.muted,
                          fontFamily:"DM Mono,monospace", marginTop:1 }}>{ref}</div>
                      </div>
                      <div style={{ fontSize:12, fontWeight:700, color:TOKENS.green }}>
                        {money(p.amount)}
                      </div>
                      <div style={{ fontSize:11, color:TOKENS.muted }}>
                        {p.payment_method_name||"—"}
                      </div>
                      <div style={{ fontSize:10, color:TOKENS.muted }}>
                        {fmt(p.created_at)}
                      </div>
                      <Badge label={st.toUpperCase()} color={sc} bg={`${sc}10`}/>
                      <div style={{ display:"flex", gap:4 }}>
                        {st==="confirmed" && (
                          <Btn size="sm" variant="ghost"
                            loading={invoiceLoading[ref]}
                            onClick={()=>downloadInvoice(p)}>
                            PDF
                          </Btn>
                        )}
                        {isAdmin && ["pending","rejected"].includes(st) && (
                          <Btn size="sm" variant="danger"
                            onClick={()=>sendDunning(p,1)}>
                            Dun
                          </Btn>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </Card>
        </>)}

        {/* ── CHANGE PLAN ───────────────────────────────────────── */}
        {tab==="change" && (
          <Card title={isAr_?"تغيير خطتك":"Change Your Plan"}
            sub={isAr_?"التغيير الفوري للترقية — التخفيض في الدورة القادمة"
              :"Upgrades are immediate · Downgrades take effect next cycle"}>
            {/* Current plan */}
            <div style={{ marginBottom:SP[4] }}>
              <div style={{ fontSize:10, color:TOKENS.muted,
                textTransform:"uppercase", letterSpacing:".06em", marginBottom:8 }}>
                {isAr_?"خطتك الحالية":"Current Plan"}
              </div>
              <PlanBadge plan={tier}/>
            </div>

            <Divider label={isAr_?"اختر خطة جديدة":"Select New Plan"}/>

            {/* Plan selector */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)",
              gap:SP[2], marginBottom:SP[4] }}>
              {PLAN_ORDER.map(plan => {
                const m   = PLAN_META[plan];
                const sel = newPlan === plan;
                const cur = tier   === plan;
                const isUp = planRank(plan) > planRank(tier);
                const isDn = planRank(plan) < planRank(tier);
                return (
                  <button key={plan}
                    onClick={() => cur ? null : setNewPlan(sel?"":`${plan}`)}
                    disabled={cur}
                    style={{
                      background: sel?`${m.color}12`:cur?"rgba(255,255,255,.02)":"none",
                      border:`${sel?2:1}px solid ${sel?m.color:cur?TOKENS.border:TOKENS.border}`,
                      borderRadius:R.md, padding:`${SP[3]}px ${SP[2]}px`,
                      cursor:cur?"not-allowed":"pointer",
                      opacity:cur?.5:1, transition:"all .18s",
                      textAlign:"center",
                    }}>
                    <div style={{ fontSize:11, fontWeight:700, color:m.color,
                      marginBottom:4 }}>{m.label}</div>
                    {cur && <div style={{ fontSize:9, color:TOKENS.muted }}>Current</div>}
                    {!cur && isUp && <div style={{ fontSize:9, color:TOKENS.green }}>↑ Upgrade</div>}
                    {!cur && isDn && <div style={{ fontSize:9, color:TOKENS.amber }}>↓ Downgrade</div>}
                  </button>
                );
              })}
            </div>

            {/* Cycle + days */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr",
              gap:SP[2], marginBottom:SP[3] }}>
              <div>
                <div style={{ fontSize:10, color:TOKENS.muted, marginBottom:6,
                  textTransform:"uppercase", letterSpacing:".06em" }}>
                  {isAr_?"دورة الفوترة":"Billing Cycle"}
                </div>
                <div style={{ display:"flex", gap:4 }}>
                  {["monthly","yearly"].map(cy=>(
                    <button key={cy} onClick={()=>setNewCycle(cy)} style={{
                      flex:1, padding:"7px 0", borderRadius:R.xs,
                      border:`1px solid ${newCycle===cy?TOKENS.blue:TOKENS.border}`,
                      background:newCycle===cy?`${TOKENS.blue}12`:"none",
                      color:newCycle===cy?TOKENS.blue:TOKENS.muted,
                      fontSize:10, fontWeight:600, cursor:"pointer",
                    }}>
                      {cy==="monthly"?(isAr_?"شهري":"Monthly"):(isAr_?"سنوي":"Yearly")}
                      {cy==="yearly"&&<span style={{ fontSize:8, color:TOKENS.green, marginLeft:4 }}>-20%</span>}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize:10, color:TOKENS.muted, marginBottom:6,
                  textTransform:"uppercase", letterSpacing:".06em" }}>
                  {isAr_?"أيام مستخدمة":"Days Used This Cycle"}
                </div>
                <input
                  type="number" min={0} max={newCycle==="yearly"?365:30}
                  value={daysUsed}
                  onChange={e=>setDaysUsed(Number(e.target.value))}
                  style={{
                    width:"100%", background:"rgba(255,255,255,.04)",
                    border:`1px solid ${TOKENS.border}`, borderRadius:R.xs,
                    padding:"7px 12px", fontSize:12, color:TOKENS.text,
                    fontFamily:"DM Mono,monospace",
                  }}
                />
              </div>
            </div>

            {/* Proration preview */}
            {prorate && (
              <div style={{ marginBottom:SP[3] }}>
                <ProrationCard currentPlan={tier} newPlan={newPlan}
                  prorate={prorate} isAr={isAr_}/>
              </div>
            )}

            {newPlan && newPlan !== tier && (
              <Btn
                loading={loading.change}
                onClick={applyPlanChange}
                style={{ width:"100%", justifyContent:"center" }}>
                {planRank(newPlan)>planRank(tier)
                  ?(isAr_?"ترقية الآن →":"Upgrade Now →")
                  :(isAr_?"تخفيض الخطة →":"Downgrade Plan →")}
              </Btn>
            )}
          </Card>
        )}

        {/* ── ANALYTICS (admin) ─────────────────────────────────── */}
        {tab==="analytics" && isAdmin && (<>
          {loading.analytics ? (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:SP[2] }}>
              {[0,1,2,3].map(i=><Skeleton key={i} h={100} r={R.md}/>)}
            </div>
          ) : analytics ? (<>
            {/* KPIs */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:SP[2] }}>
              <KpiBox label="MRR" value={money(analytics.mrr)} color={TOKENS.green}
                sub="Monthly Recurring Revenue"/>
              <KpiBox label="ARR" value={money(analytics.arr)} color={TOKENS.blue}
                sub="Annual Run Rate"/>
              <KpiBox label="ARPU" value={money(analytics.arpu)} color={TOKENS.purple}
                sub="Avg Revenue Per User"/>
              <KpiBox label="Customers" value={analytics.unique_customers} color={TOKENS.sky}
                sub={`${analytics.avg_payment?.toLocaleString()} EGP avg`}/>
            </div>

            {/* Revenue chart + plan dist */}
            <div style={{ display:"grid", gridTemplateColumns:"1.5fr 1fr", gap:SP[3] }}>
              <Card title="Revenue Trend (6 months)">
                <RevenueSparkline data={analytics.monthly_revenue}/>
              </Card>
              <Card title="Plan Distribution">
                {Object.entries(analytics.plan_distribution||{}).map(([plan,count])=>{
                  const m = PLAN_META[plan]||PLAN_META.standard;
                  const total = Object.values(analytics.plan_distribution||{}).reduce((a,b)=>a+b,0)||1;
                  return (
                    <div key={plan} style={{ marginBottom:SP[2] }}>
                      <div style={{ display:"flex", justifyContent:"space-between",
                        marginBottom:4, fontSize:11 }}>
                        <span style={{ color:m.color }}>{m.label}</span>
                        <span style={{ color:TOKENS.muted }}>{count} ({Math.round(count/total*100)}%)</span>
                      </div>
                      <ProgressBar value={count} max={total} color={m.color} h={4}/>
                    </div>
                  );
                })}
              </Card>
            </div>

            {/* Risk / conversion */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:SP[2] }}>
              <KpiBox label="Conversion Rate" value={`${analytics.conversion_rate}%`}
                color={analytics.conversion_rate>=70?TOKENS.green:TOKENS.amber}/>
              <KpiBox label="Failed Payments" value={analytics.failed_count}
                color={analytics.failed_count>0?TOKENS.red:TOKENS.green}
                sub={analytics.failed_revenue_at_risk>0?`${money(analytics.failed_revenue_at_risk)} at risk`:undefined}/>
              <KpiBox label="Pending Review" value={analytics.pending_count}
                color={analytics.pending_count>0?TOKENS.amber:TOKENS.green}/>
            </div>

            {/* Dunning panel */}
            {isAdmin && failedPayments.length > 0 && (
              <Card title="Failed Payment Recovery (Dunning)"
                sub={`${failedPayments.length} payments need attention`}
                style={{ borderColor:`${TOKENS.red}25` }}>
                {failedPayments.slice(0,5).map((p,i) => (
                  <div key={p.id||i} style={{
                    display:"flex", alignItems:"center", gap:SP[3],
                    padding:`${SP[2]+1}px 0`,
                    borderBottom:i<failedPayments.length-1?`1px solid ${TOKENS.border}`:"none",
                  }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:600 }}>{p.user_email}</div>
                      <div style={{ fontSize:10, color:TOKENS.muted }}>
                        {PLAN_META[p.tier]?.label} · {money(p.amount)}
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:4 }}>
                      {[1,2,3].map(stage=>(
                        <Btn key={stage} size="sm"
                          variant={stage===3?"danger":stage===2?"amber":"ghost"}
                          onClick={()=>sendDunning(p,stage)}>
                          Stage {stage}
                        </Btn>
                      ))}
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </>) : (
            <EmptyState icon="📊" title="No analytics data yet"/>
          )}
        </>)}
      </div>
    </div>
  );
}
