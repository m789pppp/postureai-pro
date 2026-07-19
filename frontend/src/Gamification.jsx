import { API_BASE_URL } from "./config/api.js";
import { useState, useEffect, useCallback } from "react";

import { apiFetch } from "./services/api.js";
const API = API_BASE_URL;

// ── Season boundaries (calendar quarter) ───────────────────────────
// Seasons are simply calendar quarters — no new backend/DB schema needed,
// deterministic from any date. Verified in isolation: Q1=Jan-Mar,
// Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec, with correct elapsed/remaining days
// including on quarter boundaries.
export function getCurrentSeason(now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth();
  const qIndex = Math.floor(m / 3);
  const qStartMonth = qIndex * 3;
  const start = new Date(y, qStartMonth, 1, 0, 0, 0, 0);
  const end = new Date(y, qStartMonth + 3, 0, 23, 59, 59, 999);
  const totalDays = Math.round((end - start) / 86400000) + 1;
  const daysElapsed = Math.min(totalDays, Math.floor((now - start) / 86400000) + 1);
  const daysRemaining = Math.max(0, Math.round((end - now) / 86400000));
  const quarterLabel = ["Q1","Q2","Q3","Q4"][qIndex];
  return { name: `${quarterLabel} ${y}`, start, end, totalDays, daysElapsed, daysRemaining };
}

// Individual, achievable reward tiers based on this season's real activity —
// not a fabricated ranking against other users we can't honestly compute
// client-side (that would need per-employee session-date history we don't
// have loaded). Thresholds are intentionally modest early-season and
// tougher for Gold, mirroring the existing Bronze/Silver/Gold badge language
// already used elsewhere in the app.
const SEASON_TIERS = [
  { id:"bronze", icon:"🥉", minSessions:5,  minAvg:0,  label:{en:"Bronze",ar:"برونزي"} },
  { id:"silver", icon:"🥈", minSessions:15, minAvg:65, label:{en:"Silver",ar:"فضي"} },
  { id:"gold",   icon:"🥇", minSessions:30, minAvg:75, label:{en:"Gold",ar:"ذهبي"} },
];

export function SeasonProgress({ sessions, cs, lang = "en" }) {
  const DARK = cs || { border: "rgba(148,163,184,.1)", text: "#f0f4f8", muted: "#64748b", card: "#05101f" };
  const isAr = lang === "ar";
  const season = getCurrentSeason();

  const seasonSessions = (sessions || []).filter(s => {
    const d = s.created_at?.toDate?.() || new Date(s.created_at || 0);
    return d >= season.start && d <= season.end;
  });
  const seasonCount = seasonSessions.length;
  const seasonAvg = seasonCount
    ? Math.round(seasonSessions.reduce((a, s) => a + (s.avg_score || 0), 0) / seasonCount)
    : 0;

  const currentTierIdx = SEASON_TIERS.reduce((acc, tier, i) =>
    (seasonCount >= tier.minSessions && seasonAvg >= tier.minAvg) ? i : acc, -1);
  const nextTier = SEASON_TIERS[currentTierIdx + 1];

  const progressPct = Math.min(100, Math.round((season.daysElapsed / season.totalDays) * 100));

  const t = isAr
    ? { title:"الموسم الحالي", daysLeft:"يوم متبقي", sessionsThisSeason:"جلسات هذا الموسم", seasonAvg:"متوسط الموسم",
        yourTier:"مستواك الحالي", none:"لسه مفيش", nextTier:"للمستوى التالي", need:"محتاج" }
    : { title:"Current Season", daysLeft:"days left", sessionsThisSeason:"Sessions this season", seasonAvg:"Season avg",
        yourTier:"Your tier", none:"None yet", nextTier:"Next tier", need:"Need" };

  return (
    <div>
      {/* Season header */}
      <div style={{ background:"linear-gradient(135deg,rgba(99,102,241,.1),rgba(34,211,238,.06))",
        border:"0.5px solid rgba(99,102,241,.25)", borderRadius:12, padding:"14px 16px", marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
          <div style={{ fontSize:13, fontWeight:700, color:DARK.text }}>🗓️ {t.title} — {season.name}</div>
          <div style={{ fontSize:11, color:"#a5b4fc", fontWeight:600 }}>{season.daysRemaining} {t.daysLeft}</div>
        </div>
        <div style={{ background:"rgba(148,163,184,.12)", borderRadius:99, height:5, overflow:"hidden" }}>
          <div style={{ height:"100%", borderRadius:99, width:`${progressPct}%`, background:"linear-gradient(90deg,#6366f1,#22d3ee)", transition:"width .8s ease" }} />
        </div>
      </div>

      {/* Season stats */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
        <div style={{ background:"rgba(148,163,184,.04)", border:`0.5px solid ${DARK.border}`, borderRadius:10, padding:"12px 14px" }}>
          <div style={{ fontSize:20, fontWeight:800, color:DARK.text }}>{seasonCount}</div>
          <div style={{ fontSize:10, color:DARK.muted, marginTop:2 }}>{t.sessionsThisSeason}</div>
        </div>
        <div style={{ background:"rgba(148,163,184,.04)", border:`0.5px solid ${DARK.border}`, borderRadius:10, padding:"12px 14px" }}>
          <div style={{ fontSize:20, fontWeight:800, color: seasonAvg>=75?"#10b981":seasonAvg>=50?"#f59e0b":DARK.text }}>{seasonCount ? seasonAvg : "—"}</div>
          <div style={{ fontSize:10, color:DARK.muted, marginTop:2 }}>{t.seasonAvg}</div>
        </div>
      </div>

      {/* Tiers */}
      <div style={{ fontSize:11, fontWeight:600, color:DARK.muted, marginBottom:8 }}>{t.yourTier}</div>
      <div style={{ display:"flex", gap:8, marginBottom:12 }}>
        {SEASON_TIERS.map((tier, i) => {
          const earned = i <= currentTierIdx;
          return (
            <div key={tier.id} style={{
              flex:1, textAlign:"center", padding:"10px 8px", borderRadius:10,
              background: earned ? "rgba(99,102,241,.1)" : "rgba(148,163,184,.04)",
              border:`0.5px solid ${earned ? "rgba(99,102,241,.3)" : DARK.border}`,
              opacity: earned ? 1 : 0.5,
            }}>
              <div style={{ fontSize:20, marginBottom:2, filter: earned ? "none" : "grayscale(1)" }}>{tier.icon}</div>
              <div style={{ fontSize:10, fontWeight:600, color:DARK.text }}>{tier.label[lang]||tier.label.en}</div>
              <div style={{ fontSize:8.5, color:DARK.muted, marginTop:2 }}>{tier.minSessions}+ · {tier.minAvg||0}+</div>
            </div>
          );
        })}
      </div>

      {nextTier && (
        <div style={{ fontSize:11, color:DARK.muted, background:"rgba(148,163,184,.04)", borderRadius:8, padding:"8px 12px" }}>
          {t.need}: {Math.max(0, nextTier.minSessions - seasonCount)} {isAr?"جلسة كمان":"more sessions"}
          {nextTier.minAvg > 0 && seasonAvg < nextTier.minAvg ? ` · ${isAr?"ومتوسط":"and avg"} ${nextTier.minAvg}+` : ""}
          {" "}{t.nextTier}: {nextTier.label[lang]||nextTier.label.en} {nextTier.icon}
        </div>
      )}
    </div>
  );
}

// ── XP Level colors ───────────────────────────────────────────────
const LEVEL_COLORS = [
  "#64748b","#3b82f6","#10b981","#f59e0b",
  "#8b5cf6","#ef4444","#ec4899","#0891b2","#f97316","#fbbf24",
];

// ── XP Progress Bar ───────────────────────────────────────────────
export function XPBar({ xp, level, xpCurrent, xpNext, levelLabel, cs }) {
  const pct = xpNext ? Math.round((xpCurrent / xpNext) * 100) : 0;
  const col  = LEVEL_COLORS[Math.min(level - 1, 9)];
  return (
    <div style={{ padding: "12px 14px", background: "rgba(148,163,184,.05)", border: `0.5px solid ${cs?.border || "rgba(148,163,184,.1)"}`, borderRadius: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: col, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "white" }}>{level}</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: cs?.text || "#f0f4f8" }}>{levelLabel}</div>
            <div style={{ fontSize: 9, color: cs?.muted || "#64748b" }}>Level {level}</div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: cs?.muted || "#64748b" }}>{xp.toLocaleString()} XP</div>
      </div>
      <div style={{ background: "rgba(148,163,184,.1)", borderRadius: 99, height: 5, overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 99, width: `${pct}%`, background: col, transition: "width .8s ease" }} />
      </div>
      <div style={{ fontSize: 9, color: cs?.muted || "#64748b", marginTop: 4, textAlign: "right" }}>{xpCurrent}/{xpNext} XP to next level</div>
    </div>
  );
}

// ── Streak Display ────────────────────────────────────────────────
export function StreakDisplay({ streak, cs }) {
  const fire = streak >= 7 ? "🔥" : streak >= 3 ? "✨" : "⚡";
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", padding: "8px 12px", background: "rgba(245,158,11,.08)", border: "0.5px solid rgba(245,158,11,.2)", borderRadius: 10 }}>
      <span style={{ fontSize: 20 }}>{fire}</span>
      <div>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#f59e0b" }}>{streak}</div>
        <div style={{ fontSize: 9, color: cs?.muted || "#64748b" }}>day streak</div>
      </div>
    </div>
  );
}

// ── Achievement Badge ─────────────────────────────────────────────
function AchievementBadge({ ach, earned, isNew, cs }) {
  return (
    <div style={{
      background: earned ? "rgba(99,102,241,.08)" : "rgba(148,163,184,.04)",
      border: `0.5px solid ${earned ? "rgba(99,102,241,.25)" : (cs?.border || "rgba(148,163,184,.1)")}`,
      borderRadius: 10, padding: "12px 10px", textAlign: "center",
      opacity: earned ? 1 : 0.45, position: "relative", transition: "transform .2s",
      cursor: earned ? "default" : "not-allowed",
    }}>
      {isNew && (
        <div style={{ position: "absolute", top: -6, right: -6, background: "#ef4444", color: "white", fontSize: 8, fontWeight: 700, padding: "2px 6px", borderRadius: 99 }}>NEW</div>
      )}
      <div style={{ fontSize: 24, marginBottom: 4, filter: earned ? "none" : "grayscale(1)" }}>{ach.icon}</div>
      <div style={{ fontSize: 10, fontWeight: 600, color: earned ? (cs?.text || "#f0f4f8") : (cs?.muted || "#64748b"), lineHeight: 1.3 }}>{ach.name}</div>
      <div style={{ fontSize: 9, color: "#6366f1", marginTop: 3 }}>+{ach.xp} XP</div>
    </div>
  );
}

// ── Posture Heatmap ───────────────────────────────────────────────
export function PostureHeatmap({ sessions, cs, lang = "en" }) {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(false);
  const [activeHour, setHour]   = useState(null);

  const load = useCallback(async () => {
    if (!sessions?.length) return;
    setLoading(true);
    try {
      const d = await apiFetch("/analytics/heatmap", {
        method: "POST",
        body: {
          sessions: sessions.map(s => ({
            avg_score:      s.avg_score || 0,
            created_at_iso: s.created_at?.toDate?.()?.toISOString() || s.created_at_iso || null,
          })),
        },
      });
      setData(d);
    } catch {}
    finally { setLoading(false); }
  }, [sessions]);

  useEffect(() => { load(); }, [load]);

  const sc = v => v >= 75 ? "#10b981" : v >= 50 ? "#f59e0b" : v ? "#ef4444" : "rgba(148,163,184,.1)";
  const DARK = cs || { border: "rgba(148,163,184,.1)", text: "#f0f4f8", muted: "#64748b", card: "#05101f" };
  const T = { en: { title: "Posture Heatmap", subtitle: "When is your posture best/worst?", noData: "Complete more sessions to see your heatmap", hours: "Hour of day", days: "Day of week" }, ar: { title: "خريطة الوضعية الحرارية", subtitle: "متى تكون وضعيتك الأفضل والأسوأ؟", noData: "أكمل المزيد من الجلسات لرؤية خريطتك", hours: "ساعة اليوم", days: "يوم الأسبوع" } };
  const t = T[lang] || T.en;

  if (loading) return (
    <div style={{ padding: 20, textAlign: "center" }}>
      <div style={{ fontSize: 11, color: DARK.muted }}>Loading heatmap…</div>
    </div>
  );

  if (!data || !sessions?.length) return (
    <div style={{ padding: 20, textAlign: "center" }}>
      <div style={{ fontSize: 11, color: DARK.muted }}>{t.noData}</div>
    </div>
  );

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: DARK.text, marginBottom: 4 }}>{t.title}</div>
      <div style={{ fontSize: 11, color: DARK.muted, marginBottom: 14 }}>{t.subtitle}</div>

      {/* Hourly heatmap */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: DARK.muted, marginBottom: 6 }}>{t.hours}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(24,1fr)", gap: 2 }}>
          {data.hourly.map(h => (
            <div key={h.hour}
              onMouseEnter={() => setHour(h)}
              onMouseLeave={() => setHour(null)}
              style={{
                height: 22, borderRadius: 3, cursor: h.avg ? "pointer" : "default",
                background: h.avg ? sc(h.avg) : "rgba(148,163,184,.08)",
                opacity: h.count ? 1 : 0.3,
                transition: "transform .1s",
                transform: activeHour?.hour === h.hour ? "scaleY(1.3)" : "scaleY(1)",
              }}
              title={h.avg ? `${h.hour}:00 — avg ${h.avg}/100 (${h.count} sessions)` : `${h.hour}:00 — no data`}
            />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
          <span style={{ fontSize: 8, color: DARK.muted }}>12am</span>
          <span style={{ fontSize: 8, color: DARK.muted }}>6am</span>
          <span style={{ fontSize: 8, color: DARK.muted }}>12pm</span>
          <span style={{ fontSize: 8, color: DARK.muted }}>6pm</span>
          <span style={{ fontSize: 8, color: DARK.muted }}>12am</span>
        </div>
        {activeHour?.avg && (
          <div style={{ fontSize: 10, color: DARK.text, marginTop: 6, padding: "4px 10px", background: "rgba(148,163,184,.08)", borderRadius: 6, display: "inline-block" }}>
            {activeHour.hour}:00 — <strong>{activeHour.avg}/100</strong> ({activeHour.count} sessions)
          </div>
        )}
      </div>

      {/* Daily heatmap */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: DARK.muted, marginBottom: 6 }}>{t.days}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
          {data.daily.map(d => (
            <div key={d.day} style={{ textAlign: "center" }}>
              <div style={{ height: 36, borderRadius: 6, background: d.avg ? sc(d.avg) : "rgba(148,163,184,.08)", opacity: d.count ? 1 : 0.3, marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "center" }} title={d.avg ? `${d.name}: ${d.avg}/100` : `${d.name}: no data`}>
                {d.avg && <span style={{ fontSize: 10, fontWeight: 600, color: "white" }}>{d.avg}</span>}
              </div>
              <div style={{ fontSize: 8, color: DARK.muted }}>{d.name.slice(0, 2)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Insights */}
      {data.insights?.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {data.insights.map((ins, i) => (
            <div key={i} style={{ fontSize: 11, color: DARK.muted, padding: "6px 10px", background: "rgba(148,163,184,.04)", borderLeft: "2px solid #1a56db", paddingLeft: 10, borderRadius: "0 6px 6px 0" }}>
              {ins}
            </div>
          ))}
          {data.ai_insight && (
            <div style={{ fontSize: 11, color: "#93c5fd", padding: "6px 10px", background: "rgba(99,102,241,.06)", border: "0.5px solid rgba(99,102,241,.2)", borderRadius: 6, marginTop: 4 }}>
              🤖 {data.ai_insight}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center" }}>
        <span style={{ fontSize: 9, color: DARK.muted }}>Score:</span>
        {[["Poor <50", "#ef4444"], ["Fair 50-75", "#f59e0b"], ["Good 75+", "#10b981"]].map(([l, c]) => (
          <div key={l} style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
            <span style={{ fontSize: 9, color: DARK.muted }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Leaderboard ───────────────────────────────────────────────────
export function Leaderboard({ employees, companyName, cs, lang = "en" }) {
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [view, setView]   = useState("individual"); // individual | department

  const DARK = cs || { border: "rgba(148,163,184,.1)", text: "#f0f4f8", muted: "#64748b", card: "#05101f" };
  const T = { en: { title: "Company Leaderboard", dep: "Departments", ind: "Individuals", week: "This week", champion: "Posture Champion" }, ar: { title: "لوحة الشرف", dep: "الأقسام", ind: "الأفراد", week: "هذا الأسبوع", champion: "بطل الوضعية" } };
  const t = T[lang] || T.en;

  useEffect(() => {
    if (!employees?.length) return;
    setLoading(true);
    apiFetch("/gamification/leaderboard", {
      method: "POST",
      body:   { employees, period: "week" },
    }).then(d => setData(d)).catch(() => {}).finally(() => setLoading(false));
  }, [employees]);

  const sc = v => v >= 75 ? "#10b981" : v >= 50 ? "#f59e0b" : "#ef4444";

  if (loading) return <div style={{ padding: 20, textAlign: "center", fontSize: 11, color: DARK.muted }}>Computing rankings…</div>;
  if (!data)   return <div style={{ padding: 20, textAlign: "center", fontSize: 11, color: DARK.muted }}>No employee data available</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: DARK.text }}>{t.title}</div>
          <div style={{ fontSize: 10, color: DARK.muted }}>{companyName} · {t.week}</div>
        </div>
        <div style={{ display: "flex", gap: 5 }}>
          {["individual","department"].map(v => (
            <button key={v} onClick={() => setView(v)} style={{ background: view === v ? "#1a56db" : "none", border: `0.5px solid ${DARK.border}`, borderRadius: 7, padding: "4px 10px", fontSize: 10, color: view === v ? "white" : DARK.muted, cursor: "pointer" }}>
              {v === "individual" ? t.ind : t.dep}
            </button>
          ))}
        </div>
      </div>

      {view === "individual" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {data.leaderboard.slice(0, 10).map((emp, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: i === 0 ? "rgba(251,191,36,.06)" : "rgba(148,163,184,.04)", border: `0.5px solid ${i === 0 ? "rgba(251,191,36,.2)" : DARK.border}`, borderRadius: 10 }}>
              <div style={{ width: 28, textAlign: "center", fontSize: i < 3 ? 18 : 12, fontWeight: 700, color: i === 0 ? "#fbbf24" : i === 1 ? "#94a3b8" : i === 2 ? "#cd7c2f" : DARK.muted }}>
                {emp.medal || emp.rank}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: DARK.text }}>{emp.name}</div>
                <div style={{ fontSize: 10, color: DARK.muted }}>{emp.department} · {emp.sessions_count} sessions</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: sc(emp.avg_score) }}>{emp.avg_score}</div>
                <div style={{ fontSize: 9, color: DARK.muted }}>{emp.grade}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {data.department_ranking.map((dept, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "rgba(148,163,184,.04)", border: `0.5px solid ${DARK.border}`, borderRadius: 10 }}>
              <div style={{ width: 24, textAlign: "center", fontSize: 13, fontWeight: 700, color: DARK.muted }}>{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: DARK.text }}>{dept.department}</div>
                <div style={{ fontSize: 10, color: DARK.muted }}>{dept.employees} employees</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: sc(dept.avg_score) }}>{dept.avg_score}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Gamification Panel ───────────────────────────────────────
export function GamificationPanel({ profile, sessions, calibration, employees, cs, lang = "en", onClose }) {
  const [gamData, setGamData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState("progress");

  const DARK = cs || { bg: "#030b14", card: "#05101f", border: "rgba(148,163,184,.1)", text: "#f0f4f8", muted: "#64748b" };
  const T = { en: { progress: "My Progress", achievements: "Achievements", heatmap: "Heatmap", leaderboard: "Leaderboard", season: "Season" }, ar: { progress: "تقدمي", achievements: "الإنجازات", heatmap: "الخريطة الحرارية", leaderboard: "لوحة الشرف", season: "الموسم" } };
  const t = T[lang] || T.en;

  useEffect(() => {
    const avg  = sessions?.length ? Math.round(sessions.reduce((a,s) => a+(s.avg_score||0),0)/sessions.length) : 0;
    apiFetch("/gamification/compute", {
      method: "POST",
      body: {
        sessions_count:      sessions?.length || 0,
        avg_score:           avg,
        streak:              profile?.streak  || 0,
        referral_count:      profile?.referral_count || 0,
        has_calibration:     !!calibration,
        earned_achievements: profile?.achievements || [],
      },
    }).then(d => setGamData(d)).catch(() => {}).finally(() => setLoading(false));
  }, [profile, sessions, calibration]);

  const TABS = [t.progress, t.achievements, t.season, t.heatmap, t.leaderboard];
  const KEYS = ["progress", "achievements", "season", "heatmap", "leaderboard"];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9300, backdropFilter: "blur(8px)" }}>
      <div style={{ background: DARK.card, border: `0.5px solid ${DARK.border}`, borderRadius: 20, width: "min(680px,96vw)", maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: `0.5px solid ${DARK.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: DARK.text }}>🏆 Progress & Achievements</div>
          <button onClick={onClose} style={{ background: "none", border: `0.5px solid ${DARK.border}`, borderRadius: 7, padding: "5px 12px", fontSize: 11, color: DARK.muted, cursor: "pointer" }}>✕ Close</button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: `0.5px solid ${DARK.border}`, padding: "0 20px" }}>
          {TABS.map((label, i) => (
            <button key={KEYS[i]} onClick={() => setTab(KEYS[i])} style={{ background: "none", border: "none", borderBottom: tab === KEYS[i] ? "2px solid #1a56db" : "2px solid transparent", padding: "10px 14px", fontSize: 11, fontWeight: 600, color: tab === KEYS[i] ? "#1a56db" : DARK.muted, cursor: "pointer" }}>{label}</button>
          ))}
        </div>

        <div style={{ overflowY: "auto", padding: 20, flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: DARK.muted, fontSize: 12 }}>Loading your progress…</div>
          ) : tab === "progress" ? (
            <>
              <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                {gamData && <XPBar xp={gamData.xp} level={gamData.level} xpCurrent={gamData.xp_current} xpNext={gamData.xp_to_next} levelLabel={gamData.level_label} cs={DARK} />}
                <StreakDisplay streak={profile?.streak || 0} cs={DARK} />
              </div>
              {/* Daily Goal */}
              {gamData?.daily_goal && (
                <div style={{ background: "rgba(26,86,219,.06)", border: "0.5px solid rgba(26,86,219,.15)", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: DARK.text }}>🎯 Daily Goal</div>
                    <div style={{ fontSize: 10, color: "#6366f1" }}>+{gamData.daily_goal.xp_reward} XP</div>
                  </div>
                  <div style={{ fontSize: 12, color: DARK.muted }}>{gamData.daily_goal.label}</div>
                </div>
              )}
              {/* New achievements toast */}
              {gamData?.new_achievements?.length > 0 && (
                <div style={{ background: "rgba(99,102,241,.08)", border: "0.5px solid rgba(99,102,241,.2)", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#a5b4fc", marginBottom: 8 }}>🎉 New achievements unlocked!</div>
                  {gamData.new_achievements.map(a => (
                    <div key={a.id} style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 18 }}>{a.icon}</span>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: DARK.text }}>{a.name}</div>
                        <div style={{ fontSize: 10, color: "#6366f1" }}>+{a.xp} XP</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : tab === "achievements" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))", gap: 10 }}>
              {gamData?.achievements_list?.map(ach => (
                <AchievementBadge key={ach.id} ach={ach} earned={gamData.all_achievements?.includes(ach.id)} isNew={gamData.new_achievements?.some(n => n.id === ach.id)} cs={DARK} />
              ))}
            </div>
          ) : tab === "heatmap" ? (
            <PostureHeatmap sessions={sessions} cs={DARK} lang={lang} />
          ) : tab === "season" ? (
            <SeasonProgress sessions={sessions} cs={DARK} lang={lang} />
          ) : tab === "leaderboard" ? (
            <Leaderboard employees={employees || []} companyName={profile?.company || "Your Company"} cs={DARK} lang={lang} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
