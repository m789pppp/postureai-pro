/**
 * ChurnPrediction.jsx — Corvus ULTIMATE v12
 * REAL FIRESTORE DATA — no mock, no fake.
 * Pulls live customer health scores, login frequency, session counts from Firestore.
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  collection, query, where, orderBy, limit, getDocs,
  getDoc, doc, updateDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase.js";

const API = import.meta.env.VITE_API_URL || "/api";

// ── Design ────────────────────────────────────────────────────────
const CP_TOKENS = {
  bg:"#030711", card:"#0c1832", border:"rgba(99,102,241,.14)",
  text:"#e8eeff", sub:"#94a3b8", muted:"#475569",
  primary:"#6366f1", green:"#10b981", amber:"#f59e0b", red:"#ef4444", sky:"#38bdf8",
};

// ── Health score calculator (real signals) ─────────────────────────
function calcHealth(u) {
  const now    = Date.now();
  const msDay  = 86400000;

  // Login frequency: days since last login (lower = better)
  const lastLogin  = u.last_login_at ? new Date(u.last_login_at).getTime() : now - 30 * msDay;
  const daysSince  = (now - lastLogin) / msDay;
  const loginScore = Math.max(0, 100 - daysSince * 4);

  // Session count this month
  const sessions   = u.sessions_this_month || 0;
  const sessScore  = Math.min(100, sessions * 5);

  // Score trend 30d
  const trend      = u.score_trend_30d || 0; // positive = improving
  const trendScore = 50 + Math.min(50, Math.max(-50, trend * 2));

  // Feature depth
  const features   = u.features_used || 0;
  const featScore  = Math.min(100, features * 15);

  // Payment history
  const payScore   = u.payment_ok === false ? 40 : 100;

  const health = Math.round(
    loginScore * 0.25 + sessScore * 0.20 + trendScore * 0.15 +
    featScore  * 0.15 + payScore  * 0.15 + (u.team_size > 1 ? 80 : 40) * 0.10
  );
  const churnRisk = Math.max(0, 100 - health);

  return {
    health,
    churnRisk,
    stage: health >= 85 ? "champion" : health >= 70 ? "healthy" :
           health >= 50 ? "at_risk"  : "critical",
    signals: { loginScore, sessScore, trendScore, featScore, payScore, daysSince },
  };
}

const STAGE_COLORS = { champion:"#10b981", healthy:"#38bdf8", at_risk:"#f59e0b", critical:"#ef4444" };

const PLAYBOOKS = {
  critical: [
    { step:1, action:"Personal outreach call",  owner:"CS Manager",  time:"Today",  desc:"30-min call to understand pain points" },
    { step:2, action:"Offer extended trial",     owner:"Account Mgr", time:"Day 2",  desc:"Free 30-day access to premium features" },
    { step:3, action:"Product walk-through",     owner:"CS Engineer", time:"Day 3",  desc:"1-on-1 training on underused features" },
    { step:4, action:"Executive sponsor call",   owner:"VP Sales",    time:"Day 7",  desc:"Escalate to exec level if no response" },
    { step:5, action:"Win-back discount offer",  owner:"Sales",       time:"Day 14", desc:"30% off next 3 months" },
  ],
  at_risk: [
    { step:1, action:"Automated check-in email", owner:"System",  time:"Today",  desc:"Personalized email with usage tips" },
    { step:2, action:"In-app coach prompt",       owner:"Product", time:"Day 2",  desc:"Show underutilised features" },
    { step:3, action:"CS email outreach",         owner:"CS",      time:"Day 5",  desc:"Human outreach if no engagement" },
  ],
  healthy: [
    { step:1, action:"Expansion email",   owner:"System",    time:"Day 7",  desc:"Suggest upgrade if near seat limit" },
    { step:2, action:"Case study invite", owner:"Marketing", time:"Day 14", desc:"Invite champion customers for testimonials" },
  ],
  champion: [
    { step:1, action:"Referral ask",     owner:"System",    time:"Day 3",  desc:"Invite to refer a colleague — offer reward" },
    { step:2, action:"Case study video", owner:"Marketing", time:"Day 14", desc:"Film a 2-min video testimonial" },
  ],
};

// ── Main component ─────────────────────────────────────────────────
export function ChurnPrediction({ profile, cs, lang, token, onClose }) {
  const [customers, setCustomers]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [selected, setSelected]     = useState(null);
  const [filter, setFilter]         = useState("all");
  const [sortBy, setSortBy]         = useState("churnRisk");
  const [triggering, setTriggering] = useState(null);
  const [page, setPage]             = useState(0);
  const PAGE_SIZE = 50;

  // ── Load real data from Firestore ────────────────────────────────
  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const companyId = profile?.company_id;
      let q;

      if (profile?.is_admin) {
        // Super admin: all paid users
        q = query(
          collection(db, "users"),
          where("tier", "in", ["professional","scale","elite","enterprise"]),
          orderBy("created_at", "desc"),
          limit(PAGE_SIZE)
        );
      } else if (companyId) {
        // HR: own company
        q = query(
          collection(db, "users"),
          where("company_id", "==", companyId),
          orderBy("created_at", "desc"),
          limit(PAGE_SIZE)
        );
      } else {
        setCustomers([]);
        setLoading(false);
        return;
      }

      const snap = await getDocs(q);
      const raw  = snap.docs.map(d => ({ id: d.id, ...d.to_dict?.() || d.data() }));

      // Enrich with computed health scores
      const enriched = raw.map(u => ({
        id:        u.uid || u.id,
        name:      u.name || u.email?.split("@")[0] || "Unknown",
        org:       u.company_name || u.company_id || "—",
        plan:      u.tier || "starter",
        email:     u.email || "",
        mrr:       u.mrr_cents ? u.mrr_cents / 100 : 0,
        lastLogin: u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : "Never",
        sessions:  u.sessions_this_month || 0,
        trend:     u.score_trend_30d || 0,
        teamSize:  u.team_size || 1,
        paymentOk: u.payment_ok !== false,
        ...calcHealth(u),
      }));

      setCustomers(enriched);
    } catch (e) {
      console.error("[ChurnPrediction] Firestore error:", e);
      setError(e.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  // ── Trigger playbook via API ──────────────────────────────────────
  const triggerPlaybook = async (customerId, stage) => {
    setTriggering(customerId);
    try {
      await fetch(`${API}/org/playbooks/trigger`, {
        method:  "POST",
        headers: { "Content-Type":"application/json", Authorization:`Bearer ${token}` },
        body: JSON.stringify({ target_uid: customerId, playbook: stage, triggered_by: profile?.uid }),
      });
      // Mark in Firestore
      await updateDoc(doc(db, "users", customerId), {
        playbook_triggered:    stage,
        playbook_triggered_at: serverTimestamp(),
      });
    } catch (e) {
      console.error("[ChurnPrediction] Playbook trigger failed:", e);
    } finally {
      setTriggering(null);
    }
  };

  // ── Filtered / sorted list ────────────────────────────────────────
  const filtered = useMemo(() =>
    customers
      .filter(c => filter === "all" || c.stage === filter)
      .sort((a, b) =>
        sortBy === "churnRisk" ? b.churnRisk - a.churnRisk :
        sortBy === "mrr"       ? b.mrr       - a.mrr       :
        sortBy === "health"    ? a.health    - b.health     : 0
      ),
    [customers, filter, sortBy]
  );

  const totalAtRisk = customers.filter(c => c.stage === "at_risk" || c.stage === "critical").length;
  const mrrAtRisk   = customers.filter(c => c.stage === "at_risk" || c.stage === "critical")
                                .reduce((s, c) => s + c.mrr, 0);
  const avgHealth   = customers.length
    ? Math.round(customers.reduce((s, c) => s + c.health, 0) / customers.length)
    : 0;

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:2000,
      display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:CP_TOKENS.card, borderRadius:20, width:"100%", maxWidth:1160,
        height:"90vh", display:"flex", flexDirection:"column", overflow:"hidden",
        border:`1px solid ${CP_TOKENS.border}`, boxShadow:"0 32px 80px rgba(0,0,0,.5)" }}>

        {/* Header */}
        <div style={{ padding:"20px 28px", borderBottom:`1px solid ${CP_TOKENS.border}`,
          background:"linear-gradient(135deg,rgba(239,68,68,.07),rgba(245,158,11,.04))",
          display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:44, height:44, borderRadius:12,
              background:"linear-gradient(135deg,#ef4444,#f59e0b)",
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>📉</div>
            <div>
              <div style={{ fontWeight:800, fontSize:20, color:CP_TOKENS.text }}>Churn Prediction & Health Scores</div>
              <div style={{ fontSize:12, color:CP_TOKENS.muted }}>
                Live Firestore data · {customers.length} customers loaded
                {loading && " · Refreshing…"}
              </div>
            </div>
          </div>
          <div style={{ display:"flex", gap:12, alignItems:"center" }}>
            {[
              { label:"At-risk customers", value:totalAtRisk, color:CP_TOKENS.amber },
              { label:"MRR at risk",       value:`$${mrrAtRisk.toLocaleString()}`, color:CP_TOKENS.red },
              { label:"Avg health",        value:`${avgHealth}%`, color:avgHealth>70?CP_TOKENS.green:CP_TOKENS.amber },
            ].map(m => (
              <div key={m.label} style={{ background:"rgba(255,255,255,.04)",
                borderRadius:10, padding:"8px 14px", textAlign:"center", border:`1px solid ${CP_TOKENS.border}` }}>
                <div style={{ fontSize:18, fontWeight:800, color:m.color }}>{m.value}</div>
                <div style={{ fontSize:10, color:CP_TOKENS.muted, marginTop:2 }}>{m.label}</div>
              </div>
            ))}
            <button onClick={loadCustomers} style={{ padding:"8px 16px", borderRadius:9,
              background:"transparent", border:`1px solid ${CP_TOKENS.border}`, color:CP_TOKENS.sub,
              cursor:"pointer", fontSize:13 }}>↻ Refresh</button>
            <button onClick={onClose} style={{ width:36, height:36, borderRadius:"50%",
              background:"rgba(255,255,255,.07)", border:`1px solid ${CP_TOKENS.border}`,
              color:CP_TOKENS.sub, fontSize:20, cursor:"pointer", display:"flex",
              alignItems:"center", justifyContent:"center" }}>×</button>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div style={{ margin:"16px 24px", padding:"12px 16px", borderRadius:10,
            background:"rgba(239,68,68,.12)", border:"1px solid rgba(239,68,68,.3)",
            color:CP_TOKENS.red, fontSize:14 }}>
            ⚠️ {error} — <button onClick={loadCustomers} style={{ background:"none",
              border:"none", color:CP_TOKENS.primary, cursor:"pointer", fontSize:14 }}>retry</button>
          </div>
        )}

        {/* Filters */}
        <div style={{ padding:"14px 24px", borderBottom:`1px solid ${CP_TOKENS.border}`,
          display:"flex", gap:10, alignItems:"center", flexShrink:0 }}>
          {["all","champion","healthy","at_risk","critical"].map(f => {
            const count = f === "all" ? customers.length : customers.filter(c => c.stage === f).length;
            return (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding:"6px 14px", borderRadius:999, border:`1px solid ${filter===f?STAGE_COLORS[f]||CP_TOKENS.primary:CP_TOKENS.border}`,
                background: filter===f ? `${STAGE_COLORS[f]||CP_TOKENS.primary}22` : "transparent",
                color:      filter===f ? STAGE_COLORS[f]||CP_TOKENS.primary : CP_TOKENS.sub,
                fontSize:12, fontWeight:600, cursor:"pointer",
              }}>
                {f.replace("_"," ")} ({count})
              </button>
            );
          })}
          <div style={{ marginLeft:"auto", display:"flex", gap:8, alignItems:"center" }}>
            <span style={{ fontSize:12, color:CP_TOKENS.muted }}>Sort:</span>
            {["churnRisk","mrr","health"].map(s => (
              <button key={s} onClick={() => setSortBy(s)} style={{
                padding:"5px 12px", borderRadius:7, fontSize:12, fontWeight:600, cursor:"pointer",
                background: sortBy===s ? CP_TOKENS.primary : "transparent",
                color:      sortBy===s ? "#fff" : CP_TOKENS.sub,
                border:    `1px solid ${sortBy===s ? CP_TOKENS.primary : CP_TOKENS.border}`,
              }}>{s === "churnRisk" ? "Churn Risk" : s === "mrr" ? "MRR" : "Health"}</button>
            ))}
          </div>
        </div>

        {/* Customer list */}
        <div style={{ flex:1, overflowY:"auto", padding:"16px 24px" }}>
          {loading && customers.length === 0 ? (
            <div style={{ textAlign:"center", padding:"64px 0" }}>
              <div style={{ fontSize:40, marginBottom:12, animation:"spin 1.2s linear infinite" }}>⏳</div>
              <div style={{ color:CP_TOKENS.sub, fontSize:14 }}>Loading live data from Firestore…</div>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign:"center", padding:"64px 0", color:CP_TOKENS.muted, fontSize:14 }}>
              {customers.length === 0
                ? "No customer data available. Ensure users are in Firestore with company_id set."
                : `No customers in "${filter.replace("_"," ")}" stage.`}
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {filtered.map(c => (
                <div key={c.id} onClick={() => setSelected(selected?.id === c.id ? null : c)}
                  style={{ background:"rgba(255,255,255,.03)", borderRadius:14, padding:"16px 20px",
                    border:`1px solid ${selected?.id===c.id ? STAGE_COLORS[c.stage] : CP_TOKENS.border}`,
                    cursor:"pointer", transition:"all .15s",
                    boxShadow: selected?.id===c.id ? `0 0 0 2px ${STAGE_COLORS[c.stage]}33` : "none",
                  }}>
                  {/* Row */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 90px 90px 90px 90px 120px",
                    gap:16, alignItems:"center" }}>
                    <div>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ fontSize:13, fontWeight:700, color:CP_TOKENS.text }}>{c.name}</span>
                        <span style={{ fontSize:10, padding:"2px 8px", borderRadius:4, fontWeight:700,
                          background:`${STAGE_COLORS[c.stage]}22`, color:STAGE_COLORS[c.stage] }}>
                          {c.stage.replace("_"," ")}
                        </span>
                      </div>
                      <div style={{ fontSize:11, color:CP_TOKENS.muted, marginTop:2 }}>
                        {c.org} · {c.plan} · Last login: {c.lastLogin}
                      </div>
                    </div>
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontSize:20, fontWeight:800,
                        color:c.health>=80?CP_TOKENS.green:c.health>=60?CP_TOKENS.amber:CP_TOKENS.red }}>{c.health}</div>
                      <div style={{ fontSize:10, color:CP_TOKENS.muted }}>Health</div>
                    </div>
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontSize:20, fontWeight:800,
                        color:c.churnRisk<20?CP_TOKENS.green:c.churnRisk<50?CP_TOKENS.amber:CP_TOKENS.red }}>{c.churnRisk}%</div>
                      <div style={{ fontSize:10, color:CP_TOKENS.muted }}>Churn Risk</div>
                    </div>
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontSize:16, fontWeight:700, color:CP_TOKENS.text }}>{c.sessions}</div>
                      <div style={{ fontSize:10, color:CP_TOKENS.muted }}>Sessions/mo</div>
                    </div>
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontSize:16, fontWeight:700,
                        color:c.mrr>0?CP_TOKENS.text:CP_TOKENS.muted }}>${c.mrr.toLocaleString()}</div>
                      <div style={{ fontSize:10, color:CP_TOKENS.muted }}>MRR</div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); triggerPlaybook(c.id, c.stage); }}
                      disabled={triggering === c.id}
                      style={{ padding:"7px 12px", borderRadius:8, fontSize:11, fontWeight:700,
                        background: triggering===c.id ? CP_TOKENS.muted : `${STAGE_COLORS[c.stage]}22`,
                        color:      triggering===c.id ? "#fff"  : STAGE_COLORS[c.stage],
                        border:`1px solid ${STAGE_COLORS[c.stage]}44`,
                        cursor: triggering===c.id ? "default" : "pointer" }}>
                      {triggering===c.id ? "Sending…" : "▶ Playbook"}
                    </button>
                  </div>

                  {/* Expanded playbook */}
                  {selected?.id === c.id && (
                    <div style={{ marginTop:16, paddingTop:16, borderTop:`1px solid ${CP_TOKENS.border}` }}>
                      <div style={{ fontSize:12, fontWeight:700, color:CP_TOKENS.sub, marginBottom:10,
                        textTransform:"uppercase", letterSpacing:".06em" }}>
                        {c.stage.replace("_"," ").toUpperCase()} PLAYBOOK
                      </div>
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:10 }}>
                        {(PLAYBOOKS[c.stage] || []).map(step => (
                          <div key={step.step} style={{ background:"rgba(255,255,255,.04)",
                            borderRadius:10, padding:"12px 14px", border:`1px solid ${CP_TOKENS.border}` }}>
                            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                              <span style={{ width:22, height:22, borderRadius:"50%",
                                background:`${STAGE_COLORS[c.stage]}22`,
                                display:"flex", alignItems:"center", justifyContent:"center",
                                fontSize:11, fontWeight:800, color:STAGE_COLORS[c.stage],
                                flexShrink:0 }}>{step.step}</span>
                              <span style={{ fontSize:12, fontWeight:700, color:CP_TOKENS.text }}>{step.action}</span>
                            </div>
                            <div style={{ fontSize:11, color:CP_TOKENS.muted }}>{step.desc}</div>
                            <div style={{ marginTop:6, fontSize:10, color:CP_TOKENS.primary }}>
                              {step.owner} · {step.time}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
