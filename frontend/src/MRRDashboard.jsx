/**
 * Corvus — MRR / Revenue Metrics Dashboard
 * Shows: MRR trend, ARR, ARPU, LTV, churn rate, cohort retention
 * Only visible to platform admins.
 */
import React, { useState, useEffect } from "react";
import { apiFetch } from "./services/api.js";

const fmt = (n, currency = "EGP") =>
  typeof n === "number"
    ? new Intl.NumberFormat("en-EG", { style: "currency", currency, maximumFractionDigits: 0 }).format(n)
    : "—";

const pct = (n) => (typeof n === "number" ? `${n.toFixed(1)}%` : "—");

function MetCard({ label, value, sub, color = "#6366f1", icon }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(148,163,184,.1)",
      borderRadius: 16, padding: "20px 22px", minWidth: 160,
    }}>
      <p style={{ margin: "0 0 6px", fontSize: 12, color: "#64748b", textTransform: "uppercase", letterSpacing: ".06em" }}>
        {icon} {label}
      </p>
      <p style={{ margin: "0 0 4px", fontSize: 26, fontWeight: 700, color }}>{value}</p>
      {sub && <p style={{ margin: 0, fontSize: 12, color: "#475569" }}>{sub}</p>}
    </div>
  );
}

function SimpleBar({ data, height = 80 }) {
  if (!data?.length) return null;
  const max = Math.max(...data.map(d => d.amount), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height, paddingTop: 8 }}>
      {data.map((d, i) => (
        <div key={i} title={`${d.date}: ${d.amount.toLocaleString()} EGP`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <div style={{ width: "100%", background: "#6366f1", borderRadius: "3px 3px 0 0", height: `${(d.amount / max) * (height - 16)}px`, minHeight: 2, transition: "height .3s" }} />
        </div>
      ))}
    </div>
  );
}

export function MRRDashboard({ cs, lang, onClose }) {
  const [raw, setRaw]       = useState(null);
  const [loading, setLoad]  = useState(true);
  const [error, setError]   = useState("");
  const isAr = lang === "ar";

  useEffect(() => {
    // NOTE: this previously called /metrics/revenue, which has never existed
    // anywhere in the backend (confirmed by searching backend.py and every
    // routes/*.py file, including ones since removed) — every load of this
    // dashboard was silently failing to an error screen. /billing/analytics
    // is the real, working endpoint; its response shape is narrower than
    // what this dashboard originally expected (no LTV, churn rate, trial/paid
    // split, or cohort retention yet), so those sections are marked "not yet
    // tracked" below instead of showing fabricated numbers.
    apiFetch("/billing/analytics")
      .then(d => { setRaw(d); setLoad(false); })
      .catch(e => { setError(e.message); setLoad(false); });
  }, []);

  // Adapt the real backend response to this dashboard's display shape.
  const data = raw ? {
    mrr: raw.mrr, arr: raw.arr, arpu: raw.arpu,
    ltv: null, // not computed by the backend yet
    monthly_churn: null, // backend tracks conversion_rate/failed_count, not a churn rate yet
    paid_users: raw.unique_customers, trial_users: null,
    revenue_chart: null, // backend returns monthly_revenue (last 6 months), not a daily series
    monthly_revenue: raw.monthly_revenue || {},
    revenue_by_plan_counts: raw.plan_distribution || {}, // counts, not $ amounts — labeled accordingly below
    cohorts: null, // not computed by the backend yet
    generated_at: null,
  } : null;

  const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 };
  const box = { background: "#0b1120", border: "1px solid rgba(148,163,184,.12)", borderRadius: 20, padding: "28px 24px", maxWidth: 900, width: "100%", maxHeight: "90vh", overflowY: "auto" };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={box} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h2 style={{ margin: 0, color: "#eef2ff", fontSize: 20, fontWeight: 700 }}>
              {isAr ? "📊 لوحة الإيرادات" : "📊 Revenue Metrics"}
            </h2>
            <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>
              {isAr ? "MRR · ARR · ARPU · LTV · الاشتراط الشهري" : "MRR · ARR · ARPU · LTV · Monthly Churn"}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,.06)", border: "none", borderRadius: 8, color: "#94a3b8", cursor: "pointer", padding: "6px 12px", fontSize: 13 }}>
            {isAr ? "إغلاق" : "Close"}
          </button>
        </div>

        {loading && <p style={{ color: "#64748b", textAlign: "center", padding: 40 }}>{isAr ? "جاري التحميل..." : "Loading..."}</p>}
        {error && <p style={{ color: "#f87171", textAlign: "center", padding: 40 }}>Error: {error}</p>}

        {data && (
          <>
            {/* Core metrics */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 24 }}>
              <MetCard label="MRR" value={fmt(data.mrr)} sub={isAr ? "الإيراد الشهري المتكرر" : "Monthly recurring"} color="#10b981" icon="💰" />
              <MetCard label="ARR" value={fmt(data.arr)} sub={isAr ? "الإيراد السنوي" : "Annual run rate"} color="#6366f1" icon="📈" />
              <MetCard label="ARPU" value={fmt(data.arpu)} sub={isAr ? "متوسط إيراد المستخدم" : "Avg revenue/user"} color="#f59e0b" icon="👤" />
              <MetCard label="LTV" value="—" sub={isAr ? "غير متتبع بعد" : "Not tracked yet"} color="#475569" icon="♾️" />
              <MetCard label={isAr ? "معدل الانسحاب" : "Monthly Churn"} value="—" sub={isAr ? "غير متتبع بعد" : "Not tracked yet"} color="#475569" icon="📉" />
              <MetCard label={isAr ? "المشتركون" : "Paid Users"} value={data.paid_users?.toLocaleString()} sub={isAr ? "عملاء فريدون" : "Unique paying customers"} color="#a78bfa" icon="💳" />
            </div>

            {/* Revenue by month (backend provides monthly totals, not a daily series) */}
            {Object.keys(data.monthly_revenue).length > 0 && (
              <div style={{ background: "rgba(255,255,255,.02)", borderRadius: 12, padding: "16px 20px", marginBottom: 20 }}>
                <p style={{ margin: "0 0 12px", fontSize: 13, color: "#94a3b8" }}>
                  {isAr ? "الإيرادات الشهرية (آخر 6 أشهر)" : "Monthly revenue — last 6 months"}
                </p>
                <SimpleBar data={Object.entries(data.monthly_revenue).map(([month, amount]) => ({ date: month, amount }))} height={90} />
              </div>
            )}

            {/* Subscribers by plan (counts — the backend doesn't split $ revenue by plan yet) */}
            {Object.keys(data.revenue_by_plan_counts).length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 12px" }}>
                  {isAr ? "المشتركون حسب الخطة" : "Subscribers by plan"}
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {Object.entries(data.revenue_by_plan_counts)
                    .filter(([,v]) => v > 0)
                    .sort(([,a],[,b]) => b - a)
                    .map(([plan, count]) => (
                      <div key={plan} style={{ background: "rgba(99,102,241,.1)", border: "1px solid rgba(99,102,241,.2)", borderRadius: 10, padding: "8px 14px", fontSize: 13 }}>
                        <span style={{ color: "#a5b4fc", fontWeight: 600, textTransform: "capitalize" }}>{plan}</span>
                        <span style={{ color: "#64748b", marginLeft: 8 }}>{count} {isAr ? "عميل" : "customers"}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Cohort retention */}
            {data.cohorts?.length > 0 && (
              <div style={{ background: "rgba(255,255,255,.02)", borderRadius: 12, padding: "16px 20px" }}>
                <p style={{ margin: "0 0 12px", fontSize: 13, color: "#94a3b8" }}>
                  {isAr ? "الاحتفاظ بالمستخدمين حسب الشهر" : "Cohort retention by signup month"}
                </p>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ color: "#475569" }}>
                        {["Month", "Signed Up", "30d Active", "90d Active", "Paid Conv."].map(h => (
                          <th key={h} style={{ textAlign: "left", padding: "6px 10px", borderBottom: "1px solid rgba(148,163,184,.08)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.cohorts.map(c => (
                        <tr key={c.month}>
                          <td style={{ padding: "7px 10px", color: "#94a3b8" }}>{c.month}</td>
                          <td style={{ padding: "7px 10px", color: "#e2e8f0" }}>{c.signed_up}</td>
                          <td style={{ padding: "7px 10px", color: c.retention_30d > 40 ? "#10b981" : "#f59e0b" }}>{pct(c.retention_30d)}</td>
                          <td style={{ padding: "7px 10px", color: c.retention_90d > 20 ? "#10b981" : "#f87171" }}>{pct(c.retention_90d)}</td>
                          <td style={{ padding: "7px 10px", color: c.conversion > 5 ? "#10b981" : "#64748b" }}>{pct(c.conversion)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Footer */}
            <p style={{ textAlign: "center", color: "#334155", fontSize: 11, margin: "16px 0 0" }}>
              {isAr ? "آخر تحديث:" : "Last updated:"} {new Date().toLocaleString()}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
