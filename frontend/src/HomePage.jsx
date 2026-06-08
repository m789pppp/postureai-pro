/**
 * PostureAI Pro — HomePage (v2 SaaS)
 * Three completely separate UX flows:
 *   individual  → personal score + history + AI coach
 *   hr_admin    → team analytics + employees + billing + settings
 *   employee    → personal score + team rank (no billing/HR admin)
 */
import React, { useState, useEffect, useCallback, useMemo } from "react";

// ─── User role resolver ────────────────────────────────────────────
function resolveRole(profile, isAdmin, isHRAdmin) {
  if (isAdmin)                                                   return "platform_admin";
  if (isHRAdmin || profile?.is_org_owner || profile?.is_hr
      || profile?.user_type === "hr_admin")                      return "hr_admin";
  if (profile?.company_id && !profile?.is_org_owner
      && profile?.user_type !== "hr_admin")                      return "employee";
  return "individual";
}

// ─── Design tokens (match existing cs object) ─────────────────────
const R = {
  sidebar: 240,
  header:  56,
  radius:  12,
  gap:     16,
};

// ─── Sidebar nav item ─────────────────────────────────────────────
function NavItem({ icon, label, active, onClick, badge, danger }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        width: "100%", padding: "9px 14px", border: "none", borderRadius: 8,
        background: active ? "rgba(59,130,246,.12)" : hov ? "rgba(255,255,255,.04)" : "transparent",
        color: active ? "#3b82f6" : danger ? "#f87171" : "rgba(255,255,255,.75)",
        cursor: "pointer", fontSize: 13.5, fontWeight: active ? 600 : 400,
        textAlign: "left", transition: "all .15s", position: "relative",
        borderLeft: active ? "2px solid #3b82f6" : "2px solid transparent",
      }}>
      <span style={{ fontSize: 16, width: 20, textAlign: "center" }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge ? (
        <span style={{
          background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 700,
          borderRadius: 99, padding: "1px 6px", minWidth: 18, textAlign: "center",
        }}>{badge}</span>
      ) : null}
    </button>
  );
}

// ─── Score Ring ───────────────────────────────────────────────────
function ScoreRing({ score, size = 120, cs }) {
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, score || 0));
  const color = pct >= 80 ? "#10b981" : pct >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke="rgba(255,255,255,.06)" strokeWidth={8}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={8}
        strokeDasharray={`${(pct/100)*circ} ${circ}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 1s cubic-bezier(.4,0,.2,1)" }}/>
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="middle"
        style={{ transform: "rotate(90deg)", transformOrigin: `${size/2}px ${size/2}px` }}
        fill={color} fontSize={size/4} fontWeight={800} fontFamily="system-ui">
        {pct || "—"}
      </text>
    </svg>
  );
}

// ─── Stat card ────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = "#3b82f6", cs }) {
  return (
    <div style={{
      background: cs.card, border: `1px solid ${cs.border}`, borderRadius: R.radius,
      padding: "18px 20px", display: "flex", flexDirection: "column", gap: 4,
    }}>
      <div style={{ fontSize: 11, color: cs.muted, textTransform: "uppercase",
        letterSpacing: ".08em", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1.1,
        fontFamily: "system-ui, -apple-system" }}>{value ?? "—"}</div>
      {sub && <div style={{ fontSize: 12, color: cs.muted, fontWeight: 500 }}>{sub}</div>}
    </div>
  );
}

// ─── Session history mini-chart ────────────────────────────────────
function WeekChart({ sessions, cs }) {
  const days = useMemo(() => {
    const arr = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds = d.toDateString();
      const ss = sessions.filter(s =>
        (s.created_at?.toDate?.() ?? new Date(s.created_at || 0)).toDateString() === ds
      );
      const avg = ss.length
        ? Math.round(ss.reduce((a, s) => a + (s.avg_score || 0), 0) / ss.length) : 0;
      arr.push({ label: ["Su","Mo","Tu","We","Th","Fr","Sa"][d.getDay()], score: avg, has: ss.length > 0 });
    }
    return arr;
  }, [sessions]);

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 64 }}>
      {days.map((d, i) => {
        const h = d.has ? Math.max(8, (d.score / 100) * 56) : 4;
        const color = d.score >= 80 ? "#10b981" : d.score >= 60 ? "#f59e0b" : d.has ? "#ef4444" : "rgba(255,255,255,.08)";
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div title={d.has ? `${d.score}` : "no session"} style={{
              width: "100%", height: h, borderRadius: 4, background: color,
              transition: "height .5s cubic-bezier(.4,0,.2,1)",
            }}/>
            <span style={{ fontSize: 9, color: cs.muted, fontWeight: 500 }}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────
function EmptyState({ icon, title, desc, action, onAction, cs }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", gap: 12, padding: "64px 24px", textAlign: "center",
    }}>
      <span style={{ fontSize: 48 }}>{icon}</span>
      <div style={{ fontSize: 18, fontWeight: 700, color: cs.text }}>{title}</div>
      <div style={{ fontSize: 14, color: cs.muted, maxWidth: 360, lineHeight: 1.6 }}>{desc}</div>
      {action && onAction && (
        <button onClick={onAction} style={{
          marginTop: 8, padding: "10px 24px", background: "#3b82f6", color: "#fff",
          border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer",
        }}>{action}</button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// INDIVIDUAL DASHBOARD
// ═══════════════════════════════════════════════════════════════════
function IndividualDashboard({ profile, userSessions, isAr, cs, setPage, startCamera, addToast, tier, setShowCoach, setShowBilling }) {
  const avgScore = userSessions.length
    ? Math.round(userSessions.reduce((a, s) => a + (s.avg_score || 0), 0) / userSessions.length)
    : 0;
  const lastScore = userSessions[0]?.avg_score || 0;
  const streak = profile?.streak_days || (userSessions.length > 0 ? 1 : 0);
  const sessThisMonth = userSessions.filter(s => {
    const d = s.created_at?.toDate?.() || new Date(s.created_at || 0);
    const n = new Date();
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  }).length;

  const isPro = tier === "professional" || tier === "elite";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Welcome + score hero */}
      <div style={{
        background: cs.card, border: `1px solid ${cs.border}`,
        borderRadius: R.radius, padding: "28px 24px",
        display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap",
      }}>
        <ScoreRing score={lastScore || avgScore} size={120} cs={cs}/>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: cs.text, marginBottom: 4 }}>
            {isAr ? `أهلاً، ${profile?.name?.split(" ")[0] || ""}` : `Hey, ${profile?.name?.split(" ")[0] || ""}!`}
          </div>
          <div style={{ fontSize: 14, color: cs.muted, marginBottom: 16, lineHeight: 1.6 }}>
            {userSessions.length === 0
              ? (isAr ? "ابدأ جلستك الأولى لتتبع وضعيتك" : "Start your first session to track your posture")
              : lastScore >= 80
                ? (isAr ? "وضعيتك ممتازة! استمر 💪" : "Great posture! Keep it up 💪")
                : lastScore >= 60
                  ? (isAr ? "وضعيتك معقولة، في تحسن!" : "Decent posture, improving!")
                  : (isAr ? "وضعيتك تحتاج انتباه — ابدأ جلسة الآن" : "Posture needs attention — start a session")}
          </div>
          <button
            onClick={() => { setPage("live"); setTimeout(() => startCamera?.(), 150); }}
            style={{
              padding: "11px 24px", background: "linear-gradient(135deg,#1a56db,#0891b2)",
              color: "#fff", border: "none", borderRadius: 8, fontSize: 14,
              fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 14px rgba(26,86,219,.4)",
            }}>
            {isAr ? "▶ ابدأ جلسة" : "▶ Start Session"}
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: R.gap }}>
        <StatCard label={isAr ? "متوسط النقاط" : "Avg Score"} value={avgScore || "—"} sub={isAr ? "كل الجلسات" : "all sessions"} color="#3b82f6" cs={cs}/>
        <StatCard label={isAr ? "التواصل" : "Streak"} value={streak ? `${streak}d` : "—"} sub={isAr ? "أيام متتالية" : "consecutive days"} color="#10b981" cs={cs}/>
        <StatCard label={isAr ? "هذا الشهر" : "This Month"} value={sessThisMonth || "—"} sub={isAr ? "جلسة" : "sessions"} color="#f59e0b" cs={cs}/>
        <StatCard label={isAr ? "الخطة" : "Plan"} value={tier === "elite" ? "Elite" : tier === "professional" ? "Pro" : "Free"} sub={isPro ? (isAr ? "مفعّل" : "active") : (isAr ? "ترقّ للـ Pro" : "upgrade to Pro")} color={isPro ? "#10b981" : "#f59e0b"} cs={cs}/>
      </div>

      {/* Week chart */}
      {userSessions.length > 0 && (
        <div style={{ background: cs.card, border: `1px solid ${cs.border}`, borderRadius: R.radius, padding: "20px 24px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: cs.muted, marginBottom: 14, textTransform: "uppercase", letterSpacing: ".06em" }}>
            {isAr ? "آخر 7 أيام" : "Last 7 days"}
          </div>
          <WeekChart sessions={userSessions} cs={cs}/>
        </div>
      )}

      {/* Quick actions */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: R.gap }}>
        {[
          { icon: "🤖", label: isAr ? "AI Coach" : "AI Coach", desc: isAr ? "نصائح مخصصة بالذكاء الاصطناعي" : "Personalized AI posture tips", onClick: () => setShowCoach(true), pro: true },
          { icon: "📊", label: isAr ? "تقرير PDF" : "PDF Report", desc: isAr ? "حمّل تقريرك الكامل" : "Download your full report", onClick: () => addToast(isAr ? "قريباً..." : "Coming soon...", "info"), pro: true },
          { icon: "💳", label: isAr ? "الاشتراك" : "Subscription", desc: isAr ? "ترقية أو إدارة خطتك" : "Upgrade or manage plan", onClick: () => setShowBilling(true), pro: false },
        ].map((a, i) => (
          <button key={i} onClick={a.onClick} style={{
            background: cs.card, border: `1px solid ${cs.border}`, borderRadius: R.radius,
            padding: "18px", cursor: "pointer", textAlign: "left", display: "flex", gap: 12,
            alignItems: "flex-start", transition: "border-color .2s",
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = "#3b82f6"}
          onMouseLeave={e => e.currentTarget.style.borderColor = cs.border}>
            <span style={{ fontSize: 24 }}>{a.icon}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: cs.text, marginBottom: 3 }}>
                {a.label}
                {a.pro && !isPro && <span style={{ marginLeft: 6, fontSize: 10, background: "#f59e0b22", color: "#f59e0b", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>PRO</span>}
              </div>
              <div style={{ fontSize: 11, color: cs.muted, lineHeight: 1.5 }}>{a.desc}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Session history */}
      {userSessions.length > 0 && (
        <div style={{ background: cs.card, border: `1px solid ${cs.border}`, borderRadius: R.radius, padding: "20px 24px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: cs.muted, marginBottom: 14, textTransform: "uppercase", letterSpacing: ".06em" }}>
            {isAr ? "آخر الجلسات" : "Recent Sessions"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {userSessions.slice(0, 5).map((s, i) => {
              const d = s.created_at?.toDate?.() ?? new Date(s.created_at || 0);
              const score = s.avg_score || 0;
              const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 14px", background: "rgba(255,255,255,.03)",
                  borderRadius: 8, border: `1px solid ${cs.border}`,
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: cs.text }}>
                      {isAr ? `جلسة #${userSessions.length - i}` : `Session #${userSessions.length - i}`}
                    </div>
                    <div style={{ fontSize: 11, color: cs.muted }}>
                      {d.toLocaleDateString(isAr ? "ar-EG" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color }}>{score}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {userSessions.length === 0 && (
        <EmptyState
          icon="🎯" cs={cs}
          title={isAr ? "لم تبدأ أي جلسة بعد" : "No sessions yet"}
          desc={isAr ? "اضغط على 'ابدأ جلسة' وتأكد من تشغيل الكاميرا" : "Click 'Start Session' and make sure your camera is on"}
          action={isAr ? "ابدأ الآن" : "Start Now"}
          onAction={() => { setPage("live"); setTimeout(() => startCamera?.(), 150); }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// EMPLOYEE DASHBOARD (in a company, no admin/HR)
// ═══════════════════════════════════════════════════════════════════
function EmployeeDashboard({ profile, userSessions, allUsers, isAr, cs, setPage, startCamera, addToast, setShowCoach }) {
  const avgScore = userSessions.length
    ? Math.round(userSessions.reduce((a, s) => a + (s.avg_score || 0), 0) / userSessions.length)
    : 0;
  const lastScore = userSessions[0]?.avg_score || 0;
  const streak = profile?.streak_days || (userSessions.length > 0 ? 1 : 0);

  // Team rank
  const rank = useMemo(() => {
    if (!allUsers?.length) return null;
    const sorted = [...allUsers].sort((a, b) => (b.avg_score || 0) - (a.avg_score || 0));
    const i = sorted.findIndex(u => u.id === profile?.id || u.uid === profile?.uid);
    return i >= 0 ? { pos: i + 1, total: sorted.length } : null;
  }, [allUsers, profile]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Hero */}
      <div style={{
        background: cs.card, border: `1px solid ${cs.border}`, borderRadius: R.radius,
        padding: "28px 24px", display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap",
      }}>
        <ScoreRing score={lastScore || avgScore} size={120} cs={cs}/>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: cs.text, marginBottom: 4 }}>
            {isAr ? `أهلاً، ${profile?.name?.split(" ")[0] || ""}` : `Hey, ${profile?.name?.split(" ")[0] || ""}!`}
          </div>
          <div style={{ fontSize: 13, color: cs.muted, marginBottom: 4 }}>
            {profile?.department || profile?.company || (isAr ? "موظف" : "Employee")}
          </div>
          <div style={{ fontSize: 13, color: cs.muted, marginBottom: 16 }}>
            {lastScore >= 80 ? "💪 " : lastScore >= 60 ? "📈 " : "⚠️ "}
            {lastScore >= 80
              ? (isAr ? "وضعيتك ممتازة اليوم" : "Great posture today")
              : lastScore >= 60
                ? (isAr ? "وضعيتك تتحسن" : "Your posture is improving")
                : (isAr ? "ابدأ جلسة الآن لتحسين وضعيتك" : "Start a session to improve your posture")}
          </div>
          <button onClick={() => { setPage("live"); setTimeout(() => startCamera?.(), 150); }}
            style={{
              padding: "11px 24px", background: "linear-gradient(135deg,#1a56db,#0891b2)",
              color: "#fff", border: "none", borderRadius: 8, fontSize: 14,
              fontWeight: 700, cursor: "pointer",
            }}>
            {isAr ? "▶ ابدأ جلسة" : "▶ Start Session"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: R.gap }}>
        <StatCard label={isAr ? "متوسط نقاطك" : "Your Avg"} value={avgScore || "—"} color="#3b82f6" cs={cs}/>
        <StatCard label={isAr ? "التواصل" : "Streak"} value={streak ? `${streak}d` : "—"} sub={isAr ? "أيام متتالية" : "days"} color="#10b981" cs={cs}/>
        {rank && <StatCard label={isAr ? "ترتيبك في الفريق" : "Team Rank"} value={`#${rank.pos}`} sub={`${isAr ? "من" : "of"} ${rank.total}`} color="#f59e0b" cs={cs}/>}
        <StatCard label={isAr ? "الجلسات" : "Sessions"} value={userSessions.length || "—"} sub={isAr ? "إجمالي" : "total"} color="#a855f7" cs={cs}/>
      </div>

      {/* Week chart */}
      {userSessions.length > 0 && (
        <div style={{ background: cs.card, border: `1px solid ${cs.border}`, borderRadius: R.radius, padding: "20px 24px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: cs.muted, marginBottom: 14, textTransform: "uppercase", letterSpacing: ".06em" }}>
            {isAr ? "آخر 7 أيام" : "Last 7 days"}
          </div>
          <WeekChart sessions={userSessions} cs={cs}/>
        </div>
      )}

      {/* Team leaderboard preview */}
      {allUsers?.length > 1 && (
        <div style={{ background: cs.card, border: `1px solid ${cs.border}`, borderRadius: R.radius, padding: "20px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: cs.muted, textTransform: "uppercase", letterSpacing: ".06em" }}>
              {isAr ? "لوحة الفريق" : "Team Board"}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...allUsers].sort((a, b) => (b.avg_score || 0) - (a.avg_score || 0)).slice(0, 5).map((u, i) => {
              const isMe = u.id === profile?.id || u.uid === profile?.uid;
              const score = u.avg_score || 0;
              const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                  background: isMe ? "rgba(59,130,246,.08)" : "rgba(255,255,255,.03)",
                  borderRadius: 8, border: `1px solid ${isMe ? "#3b82f680" : cs.border}`,
                }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: cs.muted, width: 20, textAlign: "center" }}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i+1}`}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: isMe ? 700 : 500, color: isMe ? "#3b82f6" : cs.text }}>
                      {u.name || u.email?.split("@")[0]}
                      {isMe && <span style={{ marginLeft: 6, fontSize: 10, color: "#3b82f6" }}>{isAr ? "(أنت)" : "(you)"}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: cs.muted }}>{u.department || ""}</div>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color }}>{score || "—"}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// HR ADMIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════
function HRAdminDashboard({ profile, allUsers, isAr, cs, addToast, setPage, setShowBilling, setShowCompanyOnboard, companyId }) {
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");

  const users = allUsers || [];
  const depts = ["all", ...new Set(users.map(u => u.department || "").filter(Boolean))];

  const filtered = users.filter(u => {
    const matchSearch = !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase());
    const matchDept = deptFilter === "all" || (u.department || "") === deptFilter;
    return matchSearch && matchDept;
  });

  const avgScore = users.length
    ? Math.round(users.reduce((a, u) => a + (u.avg_score || 0), 0) / users.length) : 0;
  const highRisk = users.filter(u => (u.avg_score || 0) < 50).length;
  const active   = users.filter(u => u.last_session_at).length;
  const healthy  = users.filter(u => (u.avg_score || 0) >= 80).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Company header */}
      <div style={{
        background: "linear-gradient(135deg, rgba(26,86,219,.15), rgba(8,145,178,.08))",
        border: `1px solid rgba(59,130,246,.2)`, borderRadius: R.radius, padding: "24px",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16,
      }}>
        <div>
          <div style={{ fontSize: 12, color: "#60a5fa", fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: ".08em" }}>
            {isAr ? "لوحة إدارة الشركة" : "Company Admin Dashboard"}
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: cs.text }}>
            {profile?.company || profile?.name || (isAr ? "شركتي" : "My Company")}
          </div>
          <div style={{ fontSize: 13, color: cs.muted, marginTop: 4 }}>
            {users.length} {isAr ? "موظف" : "employees"} · {isAr ? "خطة" : "Plan"}: {profile?.tier || "standard"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setShowCompanyOnboard(true)} style={{
            padding: "9px 18px", background: "#1a56db", color: "#fff",
            border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>
            {isAr ? "+ دعوة موظفين" : "+ Invite Employees"}
          </button>
          <button onClick={() => setShowBilling(true)} style={{
            padding: "9px 18px", background: "rgba(255,255,255,.06)", color: cs.text,
            border: `1px solid ${cs.border}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>
            {isAr ? "الاشتراك" : "Billing"}
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: R.gap }}>
        <StatCard label={isAr ? "متوسط الفريق" : "Team Avg"} value={avgScore || "—"} sub={isAr ? "نقاط الوضعية" : "posture score"} color="#3b82f6" cs={cs}/>
        <StatCard label={isAr ? "صحة ممتازة" : "Healthy"} value={healthy} sub={`${users.length ? Math.round(healthy/users.length*100) : 0}%`} color="#10b981" cs={cs}/>
        <StatCard label={isAr ? "خطر عالي" : "High Risk"} value={highRisk} sub={isAr ? "< 50 نقطة" : "score < 50"} color={highRisk > 0 ? "#ef4444" : "#10b981"} cs={cs}/>
        <StatCard label={isAr ? "نشطون" : "Active"} value={active} sub={isAr ? "سجّلوا جلسة" : "have sessions"} color="#f59e0b" cs={cs}/>
      </div>

      {/* Employee table */}
      <div style={{ background: cs.card, border: `1px solid ${cs.border}`, borderRadius: R.radius, overflow: "hidden" }}>
        {/* Table header */}
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${cs.border}`, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: cs.text, flex: 1 }}>
            {isAr ? "الموظفون" : "Employees"}
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={isAr ? "بحث..." : "Search..."}
            style={{
              padding: "7px 12px", background: "rgba(255,255,255,.05)",
              border: `1px solid ${cs.border}`, borderRadius: 7, color: cs.text,
              fontSize: 13, outline: "none", width: 180,
            }}/>
          {depts.length > 1 && (
            <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
              style={{
                padding: "7px 12px", background: cs.card, border: `1px solid ${cs.border}`,
                borderRadius: 7, color: cs.text, fontSize: 13, outline: "none",
              }}>
              {depts.map(d => <option key={d} value={d}>{d === "all" ? (isAr ? "كل الأقسام" : "All Depts") : d}</option>)}
            </select>
          )}
        </div>

        {/* Table rows */}
        <div style={{ maxHeight: 420, overflowY: "auto" }}>
          {filtered.length === 0 ? (
            <EmptyState icon="👥" cs={cs}
              title={isAr ? "لا يوجد موظفون" : "No employees yet"}
              desc={isAr ? "أرسل دعوات لموظفيك للبدء" : "Invite your team members to get started"}
              action={isAr ? "دعوة الآن" : "Invite Now"}
              onAction={() => setShowCompanyOnboard(true)}
            />
          ) : filtered.map((u, i) => {
            const score = u.avg_score || 0;
            const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : score > 0 ? "#ef4444" : cs.muted;
            const risk  = score > 0 && score < 50;
            return (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 14, padding: "12px 20px",
                borderBottom: `1px solid ${cs.border}`,
                background: risk ? "rgba(239,68,68,.04)" : "transparent",
              }}>
                {/* Avatar */}
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: `hsl(${(u.name || "A").charCodeAt(0) * 13 % 360}, 60%, 35%)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 700, color: "#fff", flexShrink: 0,
                }}>
                  {(u.name || u.email || "?")[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: cs.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {u.name || u.email?.split("@")[0]}
                    {risk && <span style={{ marginLeft: 8, fontSize: 10, background: "#ef444422", color: "#ef4444", padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>⚠ RISK</span>}
                  </div>
                  <div style={{ fontSize: 11, color: cs.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {u.department || u.email || "—"}
                  </div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color, minWidth: 36, textAlign: "right" }}>
                  {score || "—"}
                </div>
                <div style={{ fontSize: 11, color: cs.muted, minWidth: 60, textAlign: "right" }}>
                  {u.sessions_count || 0} {isAr ? "جلسة" : "sess"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Alert: at-risk employees */}
      {highRisk > 0 && (
        <div style={{
          background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)",
          borderRadius: R.radius, padding: "16px 20px", display: "flex", gap: 14, alignItems: "center",
        }}>
          <span style={{ fontSize: 24 }}>⚠️</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#f87171", marginBottom: 2 }}>
              {isAr ? `${highRisk} موظف في خطر` : `${highRisk} employees at risk`}
            </div>
            <div style={{ fontSize: 12, color: cs.muted }}>
              {isAr ? "نقاط وضعيتهم أقل من 50. فكّر في إرسال تنبيهات أو جدولة استشارة." : "Their posture scores are below 50. Consider sending reminders or scheduling a consultation."}
            </div>
          </div>
          <button onClick={() => addToast(isAr ? "تم إرسال تنبيهات" : "Alerts sent", "success")}
            style={{ marginLeft: "auto", padding: "8px 16px", background: "#ef4444", color: "#fff",
              border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
            {isAr ? "أرسل تنبيه" : "Send Alert"}
          </button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SIDEBAR (desktop only)
// ═══════════════════════════════════════════════════════════════════
function Sidebar({ role, activeTab, setActiveTab, profile, isAr, cs, setPage, startCamera, logOut, setUser, setProfile, isAdmin, darkMode, setDarkMode, setLang, lang, tier }) {
  const navItems = useMemo(() => {
    const individual = [
      { id: "home",     icon: "⊞",  en: "Dashboard",   ar: "الرئيسية" },
      { id: "sessions", icon: "📋", en: "Sessions",    ar: "جلساتي" },
      { id: "coach",    icon: "🤖", en: "AI Coach",    ar: "AI Coach", pro: true },
      { id: "profile",  icon: "◯",  en: "Settings",    ar: "الإعدادات" },
    ];
    const employee = [
      { id: "home",      icon: "⊞",  en: "Dashboard",  ar: "الرئيسية" },
      { id: "sessions",  icon: "📋", en: "My Sessions", ar: "جلساتي" },
      { id: "team",      icon: "👥", en: "Team",        ar: "الفريق" },
      { id: "profile",   icon: "◯",  en: "Settings",    ar: "الإعدادات" },
    ];
    const hr = [
      { id: "home",      icon: "⊞",  en: "Overview",   ar: "النظرة العامة" },
      { id: "employees", icon: "👥", en: "Employees",   ar: "الموظفون" },
      { id: "analytics", icon: "📊", en: "Analytics",  ar: "التحليلات" },
      { id: "alerts",    icon: "🔔", en: "Alerts",      ar: "التنبيهات" },
      { id: "billing",   icon: "💳", en: "Billing",     ar: "الاشتراك" },
      { id: "settings",  icon: "⚙️", en: "Settings",    ar: "الإعدادات" },
    ];
    if (role === "hr_admin" || role === "platform_admin") return hr;
    if (role === "employee") return employee;
    return individual;
  }, [role]);

  return (
    <aside style={{
      width: R.sidebar, flexShrink: 0, height: "100vh", position: "sticky", top: 0,
      background: "rgba(7,13,26,.98)", borderRight: `1px solid ${cs.border}`,
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      {/* Logo */}
      <div style={{ padding: "20px 16px 16px", borderBottom: `1px solid ${cs.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, background: "linear-gradient(135deg,#1a56db,#0891b2)",
            borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, flexShrink: 0,
          }}>◈</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: cs.text, letterSpacing: "-.01em" }}>PostureAI</div>
            <div style={{ fontSize: 10, color: "#3b82f6", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>
              {tier === "elite" ? "Elite" : tier === "professional" ? "Pro" : "Free"} · {role === "hr_admin" ? "Admin" : role === "employee" ? "Employee" : "Personal"}
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "12px 10px", display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
        {navItems.map(item => (
          <NavItem
            key={item.id}
            icon={item.icon}
            label={isAr ? item.ar : item.en}
            active={activeTab === item.id}
            onClick={() => {
              if (item.id === "sessions" || item.id === "home" || item.id === "employees" ||
                  item.id === "team" || item.id === "analytics" || item.id === "alerts" ||
                  item.id === "billing" || item.id === "settings" || item.id === "profile" || item.id === "coach") {
                setActiveTab(item.id);
              }
            }}
            cs={cs}
          />
        ))}

        {/* Start session CTA */}
        <div style={{ marginTop: 8 }}>
          <button onClick={() => { setPage("live"); setTimeout(() => startCamera?.(), 150); }}
            style={{
              width: "100%", padding: "10px", border: "none", borderRadius: 8,
              background: "linear-gradient(135deg,#1a56db,#0891b2)", color: "#fff",
              fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: "0 4px 12px rgba(26,86,219,.35)",
            }}>
            <span>▶</span> {isAr ? "ابدأ جلسة" : "Start Session"}
          </button>
        </div>

        {/* Admin link */}
        {isAdmin && (
          <NavItem icon="🔧" label={isAr ? "منصة المشرف" : "Platform Admin"}
            active={false} onClick={() => setPage("admin")} cs={cs}/>
        )}
      </nav>

      {/* User footer */}
      <div style={{ padding: "12px 10px", borderTop: `1px solid ${cs.border}` }}>
        {/* Lang + dark toggle */}
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <button onClick={() => setLang(lang === "ar" ? "en" : "ar")} style={{
            flex: 1, padding: "6px", background: "rgba(255,255,255,.05)",
            border: `1px solid ${cs.border}`, borderRadius: 6,
            color: cs.muted, fontSize: 11, cursor: "pointer", fontWeight: 500,
          }}>
            {lang === "ar" ? "🇬🇧 EN" : "🇪🇬 عربي"}
          </button>
          <button onClick={() => setDarkMode(!darkMode)} style={{
            padding: "6px 10px", background: "rgba(255,255,255,.05)",
            border: `1px solid ${cs.border}`, borderRadius: 6,
            color: cs.muted, fontSize: 12, cursor: "pointer",
          }}>
            {darkMode ? "☀️" : "🌙"}
          </button>
        </div>

        {/* User row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
            background: "linear-gradient(135deg,#1a56db,#0891b2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 700, color: "#fff",
          }}>
            {(profile?.name || "?")[0].toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: cs.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {profile?.name || profile?.email?.split("@")[0] || "—"}
            </div>
            <div style={{ fontSize: 10, color: cs.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {profile?.email || ""}
            </div>
          </div>
          <button onClick={() => { setPage("profile"); }} title="Settings"
            style={{ background: "none", border: "none", color: cs.muted, cursor: "pointer", fontSize: 14, padding: 4 }}>
            ⚙️
          </button>
        </div>
      </div>
    </aside>
  );
}

// ─── Mobile bottom nav ────────────────────────────────────────────
function MobileNav({ role, activeTab, setActiveTab, setPage, startCamera, isAr, cs }) {
  const tabs = role === "hr_admin" || role === "platform_admin"
    ? [
        { id: "home",      icon: "⊞", en: "Overview", ar: "نظرة عامة" },
        { id: "employees", icon: "👥", en: "Team",     ar: "الفريق" },
        { id: "live",      icon: "▶", en: "Session",  ar: "جلسة",    special: true },
        { id: "alerts",    icon: "🔔", en: "Alerts",   ar: "تنبيهات" },
        { id: "settings",  icon: "⚙️", en: "Settings", ar: "إعدادات" },
      ]
    : role === "employee"
      ? [
          { id: "home",     icon: "⊞", en: "Home",    ar: "الرئيسية" },
          { id: "team",     icon: "👥", en: "Team",    ar: "الفريق" },
          { id: "live",     icon: "▶", en: "Session", ar: "جلسة",    special: true },
          { id: "sessions", icon: "📋", en: "History", ar: "السجل" },
          { id: "profile",  icon: "◯", en: "Profile", ar: "حسابي" },
        ]
      : [
          { id: "home",     icon: "⊞", en: "Home",    ar: "الرئيسية" },
          { id: "sessions", icon: "📋", en: "History", ar: "السجل" },
          { id: "live",     icon: "▶", en: "Session", ar: "جلسة",    special: true },
          { id: "coach",    icon: "🤖", en: "Coach",  ar: "Coach" },
          { id: "profile",  icon: "◯", en: "Profile", ar: "حسابي" },
        ];

  return (
    <nav style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 200,
      background: "rgba(7,13,26,.97)", borderTop: `1px solid ${cs.border}`,
      backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
      display: "flex", alignItems: "center",
      padding: `8px 0 max(8px, env(safe-area-inset-bottom))`,
    }}>
      {tabs.map(tab => (
        <button key={tab.id}
          onClick={() => {
            if (tab.id === "live") { setPage("live"); setTimeout(() => startCamera?.(), 150); }
            else setActiveTab(tab.id);
          }}
          style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
            gap: 3, padding: "4px 0", background: "none", border: "none", cursor: "pointer",
          }}>
          {tab.special ? (
            <div style={{
              width: 44, height: 44, borderRadius: "50%",
              background: "linear-gradient(135deg,#1a56db,#0891b2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, color: "#fff", marginTop: -16,
              boxShadow: "0 4px 14px rgba(26,86,219,.5)",
            }}>▶</div>
          ) : (
            <span style={{
              fontSize: 18, color: activeTab === tab.id ? "#3b82f6" : "rgba(255,255,255,.35)",
            }}>{tab.icon}</span>
          )}
          <span style={{
            fontSize: 9.5, fontWeight: activeTab === tab.id ? 700 : 400,
            color: activeTab === tab.id ? "#3b82f6" : "rgba(255,255,255,.35)",
          }}>{isAr ? tab.ar : tab.en}</span>
        </button>
      ))}
    </nav>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════
export default function HomePage({
  user, profile, cs, lang, isAr, dir,
  userSessions, allUsers,
  tier, mode, setMode,
  setPage, startCamera, addToast,
  setShowCoach, setShowBilling, setShowCompanyOnboard, setShowAdmin,
  isAdmin, isHRAdmin, companyId,
  darkMode, setDarkMode, setLang,
  t, logOut, setUser, setProfile,
  // pass-through modals (still rendered by App.jsx)
  showCoach, showBilling, showCompanyOnboard, showAdmin,
}) {
  const [activeTab, setActiveTab] = useState("home");
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 1024);

  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  const role = resolveRole(profile, isAdmin, isHRAdmin);

  // ── Tab content router ──────────────────────────────────────────
  const renderContent = () => {
    // Billing / coach / etc modals are opened via setShow* from App.jsx
    // We just trigger them from nav clicks

    if (activeTab === "billing")   { setShowBilling(true);        setActiveTab("home"); return null; }
    if (activeTab === "coach")     { setShowCoach(true);          setActiveTab("home"); return null; }
    if (activeTab === "settings" || activeTab === "profile") {
      setPage("profile"); return null;
    }

    // HR admin tabs
    if (role === "hr_admin" || role === "platform_admin") {
      if (activeTab === "employees" || activeTab === "home") {
        return (
          <HRAdminDashboard
            profile={profile} allUsers={allUsers} isAr={isAr} cs={cs}
            addToast={addToast} setPage={setPage}
            setShowBilling={() => setShowBilling(true)}
            setShowCompanyOnboard={() => setShowCompanyOnboard(true)}
            companyId={companyId}
          />
        );
      }
      if (activeTab === "analytics") {
        return <EmptyState icon="📊" cs={cs}
          title={isAr ? "التحليلات المتقدمة" : "Advanced Analytics"}
          desc={isAr ? "قريباً — تحليل بيومتري كامل للفريق بالذكاء الاصطناعي" : "Coming soon — full team biometric analytics with AI"}
        />;
      }
      if (activeTab === "alerts") {
        const atRisk = (allUsers || []).filter(u => (u.avg_score || 0) > 0 && (u.avg_score || 0) < 50);
        return atRisk.length === 0
          ? <EmptyState icon="✅" cs={cs} title={isAr ? "لا توجد تنبيهات" : "No alerts"} desc={isAr ? "كل الموظفين بوضعية جيدة" : "All employees have healthy posture scores"}/>
          : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: cs.text, marginBottom: 4 }}>
                {isAr ? `${atRisk.length} موظف في خطر` : `${atRisk.length} at-risk employees`}
              </div>
              {atRisk.map((u, i) => (
                <div key={i} style={{
                  background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.2)",
                  borderRadius: R.radius, padding: "14px 18px",
                  display: "flex", alignItems: "center", gap: 14,
                }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#ef444430",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⚠️</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: cs.text }}>{u.name || u.email}</div>
                    <div style={{ fontSize: 12, color: cs.muted }}>{isAr ? "نقاط الوضعية:" : "Score:"} {u.avg_score || 0}</div>
                  </div>
                  <button onClick={() => addToast(`${isAr ? "تم إرسال تنبيه لـ" : "Alert sent to"} ${u.name || u.email}`, "success")}
                    style={{ padding: "7px 14px", background: "#ef4444", color: "#fff",
                      border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    {isAr ? "أرسل تنبيه" : "Alert"}
                  </button>
                </div>
              ))}
            </div>
          );
      }
    }

    // Employee tabs
    if (role === "employee") {
      if (activeTab === "home" || activeTab === "sessions") {
        return <EmployeeDashboard profile={profile} userSessions={userSessions}
          allUsers={allUsers} isAr={isAr} cs={cs} setPage={setPage}
          startCamera={startCamera} addToast={addToast} setShowCoach={() => setShowCoach(true)}/>;
      }
      if (activeTab === "team") {
        return <EmployeeDashboard profile={profile} userSessions={userSessions}
          allUsers={allUsers} isAr={isAr} cs={cs} setPage={setPage}
          startCamera={startCamera} addToast={addToast} setShowCoach={() => setShowCoach(true)}/>;
      }
    }

    // Individual (default)
    return (
      <IndividualDashboard
        profile={profile} userSessions={userSessions} isAr={isAr} cs={cs}
        setPage={setPage} startCamera={startCamera} addToast={addToast}
        tier={tier}
        setShowCoach={() => setShowCoach(true)}
        setShowBilling={() => setShowBilling(true)}
      />
    );
  };

  const content = renderContent();

  return (
    <div dir={dir} style={{
      display: "flex", minHeight: "100vh", background: cs.bg, color: cs.text,
      fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    }}>
      {/* Sidebar — desktop only */}
      {!isMobile && (
        <Sidebar
          role={role} activeTab={activeTab} setActiveTab={setActiveTab}
          profile={profile} isAr={isAr} cs={cs} setPage={setPage}
          startCamera={startCamera} logOut={logOut} setUser={setUser}
          setProfile={setProfile} isAdmin={isAdmin} darkMode={darkMode}
          setDarkMode={setDarkMode} setLang={setLang} lang={lang} tier={tier}
        />
      )}

      {/* Main area */}
      <main style={{
        flex: 1, minWidth: 0, overflowY: "auto",
        paddingBottom: isMobile ? 80 : 0,
      }}>
        {/* Top bar */}
        <header style={{
          position: "sticky", top: 0, zIndex: 100,
          background: "rgba(7,13,26,.95)", borderBottom: `1px solid ${cs.border}`,
          backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
          padding: "0 24px", height: R.header,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: cs.text }}>
            {isAr
              ? ({ home: "الرئيسية", employees: "الموظفون", analytics: "التحليلات", alerts: "التنبيهات", sessions: "الجلسات", team: "الفريق" })[activeTab] || "الرئيسية"
              : ({ home: "Dashboard", employees: "Employees", analytics: "Analytics", alerts: "Alerts", sessions: "Sessions", team: "Team" })[activeTab] || "Dashboard"}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {/* Quick start */}
            <button onClick={() => { setPage("live"); setTimeout(() => startCamera?.(), 150); }}
              style={{
                padding: "7px 16px", background: "rgba(26,86,219,.15)",
                border: "1px solid rgba(59,130,246,.3)", borderRadius: 7,
                color: "#60a5fa", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>
              {isAr ? "▶ جلسة" : "▶ Session"}
            </button>
            {/* Avatar */}
            <button onClick={() => setPage("profile")} style={{
              width: 32, height: 32, borderRadius: "50%", border: "none",
              background: "linear-gradient(135deg,#1a56db,#0891b2)",
              color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}>
              {(profile?.name || "?")[0].toUpperCase()}
            </button>
          </div>
        </header>

        {/* Page content */}
        <div style={{ padding: "24px", maxWidth: 1100, margin: "0 auto" }}>
          {content}
        </div>
      </main>

      {/* Mobile nav */}
      {isMobile && (
        <MobileNav
          role={role} activeTab={activeTab} setActiveTab={setActiveTab}
          setPage={setPage} startCamera={startCamera} isAr={isAr} cs={cs}
        />
      )}
    </div>
  );
}
