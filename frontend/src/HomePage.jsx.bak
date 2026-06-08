/**
 * PostureAI Pro — HomePage v4.1
 * Full redesign + States + Micro-interactions
 */
import { useState, useEffect } from "react";
import { getUserSessions, getAllUsers, SUPPORT_EMAIL } from "./firebase.js";
import {
  Toasts, Ring, BarChart, Badge, TierBadge,
  SectionHeader, Btn, Avatar, Spinner, EmptyState,
  // States
  HomePageSkeleton, ZeroStateSessions,
  ErrorNetwork, PageLoader,
  // Interactions
  AchievementToast, SuccessCheck, AnimatedNumber,
  StreakFlame, LiveDot, useToast, useAchievement,
  PageTransition, RippleBtn,
} from "./ui/index.jsx";

const sc    = v => v >= 75 ? "var(--color-success)" : v >= 50 ? "var(--color-warning)" : "var(--color-danger)";
const grade = (v, ar) =>
  v >= 85 ? (ar ? "ممتاز" : "Excellent") :
  v >= 70 ? (ar ? "جيد"   : "Good")      :
  v >= 50 ? (ar ? "مقبول" : "Fair")      :
            (ar ? "ضعيف"  : "Poor");

// ── TOP NAV ───────────────────────────────────────────────────────
function TopNav({ user, profile, cs, isAr, darkMode, setDarkMode, setLang,
  logOut, setUser, setProfile, setPage,
  getUserSessions, setUserSessions, getAllUsers, setAllUsers,
  isAdmin, isHRAdmin, setShowAdmin, NavAvatarDropdown, t, lang }) {

  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 60,
      background: scrolled ? "rgba(7,13,26,.96)" : "rgba(7,13,26,.82)",
      borderBottom: `1px solid ${scrolled ? "rgba(255,255,255,.09)" : "transparent"}`,
      backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
      height: 56,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 var(--space-4)",
      transition: "background 250ms, border-color 250ms",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 32, height: 32, background: "var(--gradient-brand)",
          borderRadius: "var(--radius-sm)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 15, boxShadow: "var(--shadow-blue)",
          transition: "transform 300ms var(--ease-spring)",
        }}>◈</div>
        <span style={{
          fontFamily: "var(--font-display)", fontSize: "var(--text-base)",
          fontWeight: 800, color: "var(--color-text)", letterSpacing: "-0.03em",
        }}>
          PostureAI <span style={{ color: "var(--color-accent)" }}>Pro</span>
        </span>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <button onClick={() => setLang(isAr ? "en" : "ar")} style={{
          background: "var(--color-surface-2)", border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-sm)", padding: "5px 11px",
          fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-muted)",
          cursor: "pointer", transition: "all 150ms",
        }}>{isAr ? "🇬🇧 EN" : "🇪🇬 عربي"}</button>
        <button onClick={() => setDarkMode(!darkMode)} style={{
          background: "var(--color-surface-2)", border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-sm)", width: 34, height: 34,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, cursor: "pointer", transition: "all 150ms",
        }}>{darkMode ? "☀️" : "🌙"}</button>
        <NavAvatarDropdown
          user={user} profile={profile} cs={cs} t={t} lang={lang} isAr={isAr}
          isAdmin={isAdmin} isHRAdmin={isHRAdmin}
          onProfile={() => { getUserSessions(user.uid).then(setUserSessions); setPage("profile"); }}
          onLeaderboard={() => { getAllUsers().then(setAllUsers); setPage("leaderboard"); }}
          onHR={() => setPage("hr")}
          onAdmin={() => setShowAdmin(true)}
          onSetup={() => setPage("setup")}
          onOnboarding={() => setShowOnboard?.(true)}
          onSignOut={() => { logOut(); setUser(null); setProfile(null); setPage("landing"); }}
        />
      </div>
    </header>
  );
}

// ── BOTTOM NAV ────────────────────────────────────────────────────
function BottomNav({ page, setPage, isAr, companyId, profile, startCamera }) {
  const tabs = [
    { id: "home",    icon: "⊞",  en: "Home",    ar: "الرئيسية" },
    { id: "live",    icon: "▶",  en: "Session", ar: "جلسة",    special: true },
    { id: "hr",      icon: "📊", en: "HR",      ar: "HR",
      show: !!(companyId || profile?.company_id || profile?.is_hr || profile?.is_org_owner) },
    { id: "profile", icon: "◯",  en: "Profile", ar: "حسابي" },
  ].filter(t => t.show !== false);

  return (
    <nav style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
      background: "rgba(7,13,26,.96)", borderTop: "1px solid var(--color-border)",
      backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
      display: "flex", alignItems: "center",
      padding: `10px 0 max(10px, env(safe-area-inset-bottom))`,
    }}>
      {tabs.map(tab => (
        <button key={tab.id}
          onClick={() => {
            if (tab.id === "live") { setPage("live"); setTimeout(() => startCamera?.(), 150); }
            else setPage(tab.id);
          }}
          style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
            gap: 4, padding: "4px 0", background: "none", border: "none", cursor: "pointer",
            transition: "opacity 150ms",
          }}>
          {tab.special ? (
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              background: "var(--gradient-brand)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, color: "#fff", marginTop: -18,
              boxShadow: "var(--shadow-blue)",
              transition: "transform 200ms var(--ease-spring), box-shadow 200ms",
            }}>▶</div>
          ) : (
            <span style={{
              fontSize: 18, lineHeight: 1,
              color: page === tab.id ? "var(--color-accent)" : "var(--color-faint)",
              transition: "color 200ms, transform 200ms var(--ease-spring)",
              transform: page === tab.id ? "scale(1.12)" : "scale(1)",
              display: "block",
            }}>{tab.icon}</span>
          )}
          <span style={{
            fontSize: "var(--text-2xs)", fontWeight: page === tab.id ? 700 : 500,
            color: page === tab.id ? "var(--color-accent)" : "var(--color-muted)",
            letterSpacing: "0.02em", transition: "color 200ms",
          }}>{isAr ? tab.ar : tab.en}</span>
        </button>
      ))}
    </nav>
  );
}

// ── GREETING HERO ─────────────────────────────────────────────────
function GreetingCard({ greet, firstName, lastTime, lastScore, isAr, avgAll }) {
  return (
    <div style={{
      background: "var(--gradient-hero)",
      border: "1px solid rgba(26,86,219,.18)",
      borderRadius: "var(--radius-xl)",
      padding: "var(--space-5)",
      marginBottom: "var(--space-3)",
      position: "relative", overflow: "hidden",
      animation: "fadeIn 400ms var(--ease-spring) both",
    }}>
      <div style={{
        position: "absolute", top: -60, right: -40,
        width: 180, height: 180,
        background: "radial-gradient(circle, rgba(26,86,219,.22) 0%, transparent 70%)",
        borderRadius: "50%", pointerEvents: "none",
      }} />
      <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: "var(--text-xl)",
            fontWeight: 800, color: "var(--color-text)", marginBottom: 6,
            letterSpacing: "-0.025em",
          }}>
            {greet}{firstName ? `, ${firstName}` : ""}! 👋
          </div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--color-muted)", lineHeight: 1.6 }}>
            {lastTime
              ? `${isAr ? "آخر جلسة" : "Last session"} · ${lastTime}${lastScore > 0 ? ` · ${lastScore}/100` : ""}`
              : (isAr ? "ابدأ جلستك الأولى 🚀" : "Start your first session 🚀")}
          </div>
          {avgAll > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: "var(--text-2xs)", color: "var(--color-muted)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  {isAr ? "المعدل العام" : "Overall avg"}
                </span>
                <span style={{ fontSize: "var(--text-2xs)", fontWeight: 700, color: sc(avgAll) }}>{grade(avgAll, isAr)}</span>
              </div>
              <div style={{ height: 5, borderRadius: 99, background: "rgba(148,163,184,.15)", overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${avgAll}%`, background: sc(avgAll),
                  borderRadius: 99, transition: "width 700ms var(--ease-spring)",
                }} />
              </div>
            </div>
          )}
        </div>
        {lastScore > 0 && (
          <Ring score={lastScore} size={72} strokeWidth={6} label="/100" />
        )}
      </div>
    </div>
  );
}

// ── START BUTTON (with ripple) ────────────────────────────────────
function StartBtn({ onPress, mode, savedMode, profile, isAr }) {
  const [pressed, setPressed] = useState(false);
  const [ripples, setRipples] = useState([]);

  const handleClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();
    setRipples(r => [...r, { x, y, id }]);
    setTimeout(() => setRipples(r => r.filter(rp => rp.id !== id)), 700);
    setPressed(true);
    setTimeout(() => setPressed(false), 200);
    onPress();
  };

  const modeLabels = { laptop: isAr ? "لابتوب" : "Laptop", phone: isAr ? "موبايل" : "Mobile", side: isAr ? "جانب" : "Side" };

  return (
    <button onClick={handleClick} style={{
      width: "100%", background: "var(--gradient-brand)", border: "none",
      borderRadius: "var(--radius-xl)", padding: "var(--space-4) var(--space-5)",
      display: "flex", alignItems: "center", gap: "var(--space-4)",
      cursor: "pointer", marginBottom: "var(--space-3)", position: "relative", overflow: "hidden",
      boxShadow: "var(--shadow-blue)",
      transform: pressed ? "scale(0.98)" : "scale(1)",
      transition: "transform 150ms var(--ease-spring), box-shadow 280ms",
      animation: "fadeIn 350ms 80ms var(--ease-spring) both",
    }}>
      {ripples.map(r => (
        <span key={r.id} style={{
          position: "absolute", left: r.x - 50, top: r.y - 50,
          width: 100, height: 100, borderRadius: "50%",
          background: "rgba(255,255,255,.2)",
          animation: "ripple 700ms ease-out forwards",
          pointerEvents: "none",
        }} />
      ))}
      <div style={{
        width: 48, height: 48, borderRadius: "var(--radius-md)",
        background: "rgba(255,255,255,.18)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 22, flexShrink: 0,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.2)",
      }}>▶</div>
      <div style={{ textAlign: "left", flex: 1 }}>
        <div style={{
          fontFamily: "var(--font-display)", fontSize: "var(--text-md)",
          fontWeight: 800, color: "#fff", letterSpacing: "-0.02em",
        }}>{isAr ? "ابدأ جلسة جديدة" : "Start New Session"}</div>
        <div style={{ fontSize: "var(--text-xs)", color: "rgba(255,255,255,.65)", marginTop: 3 }}>
          {modeLabels[mode || savedMode] || "Laptop"} · {profile?.tier || "professional"}
        </div>
      </div>
      <div style={{ color: "rgba(255,255,255,.55)", fontSize: 20 }}>→</div>
      <style>{`@keyframes ripple{from{transform:scale(0);opacity:1}to{transform:scale(5);opacity:0}}`}</style>
    </button>
  );
}

// ── MODE SELECTOR ─────────────────────────────────────────────────
function ModeSelector({ mode, savedMode, setMode, isAr }) {
  const modes = [
    { id: "laptop", icon: "💻", en: "Laptop",  ar: "لابتوب" },
    { id: "phone",  icon: "📱", en: "Mobile",  ar: "موبايل" },
    { id: "side",   icon: "🪑", en: "Side",    ar: "جانب" },
  ];
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
      gap: "var(--space-2)", marginBottom: "var(--space-4)",
      animation: "fadeIn 350ms 120ms var(--ease-spring) both",
    }}>
      {modes.map(m => {
        const active = (mode || savedMode) === m.id;
        return (
          <button key={m.id} onClick={() => { setMode(m.id); localStorage.setItem("last_mode", m.id); }}
            style={{
              padding: "12px 6px", borderRadius: "var(--radius-md)",
              border: `1.5px solid ${active ? "var(--color-accent)" : "var(--color-border)"}`,
              background: active ? "rgba(26,86,219,.1)" : "var(--color-card)",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
              cursor: "pointer",
              boxShadow: active ? "0 0 0 3px rgba(26,86,219,.12)" : "none",
              transition: "all 200ms var(--ease-spring)",
              transform: active ? "scale(1.03)" : "scale(1)",
            }}>
            <span style={{
              fontSize: 20,
              transform: active ? "scale(1.12)" : "scale(1)",
              transition: "transform 200ms var(--ease-spring)",
              display: "block",
            }}>{m.icon}</span>
            <span style={{
              fontSize: "var(--text-xs)",
              fontWeight: active ? 700 : 500,
              color: active ? "var(--color-accent)" : "var(--color-muted)",
              transition: "color 200ms",
            }}>{isAr ? m.ar : m.en}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── STATS ROW ─────────────────────────────────────────────────────
function StatsRow({ avgAll, sessThisMonth, userSessions, streak, isAr }) {
  const stats = [
    { icon: "◎", label: isAr ? "المعدل" : "AVG",      value: avgAll || 0,                    color: avgAll ? sc(avgAll) : "var(--color-muted)", sub: avgAll ? grade(avgAll, isAr) : null,           delay: 0   },
    { icon: "⊡", label: isAr ? "جلسات" : "SESSIONS",  value: sessThisMonth || userSessions.length || 0, color: "var(--blue-400)",       sub: isAr ? "الشهر" : "month",                             delay: 60  },
    { icon: "◈", label: isAr ? "سلسلة" : "STREAK",    value: streak || 0,                    color: "var(--amber-400)",              sub: streak > 0 ? (isAr ? "استمر!" : "Keep up!") : null, delay: 120 },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
      {stats.map((s, i) => (
        <div key={i} style={{
          background: "var(--color-card)", border: "1px solid var(--color-card-border)",
          borderRadius: "var(--radius-lg)", padding: "var(--space-4) var(--space-3)",
          position: "relative", overflow: "hidden",
          animation: `fadeIn 400ms ${180 + s.delay}ms var(--ease-spring) both`,
          transition: "transform 250ms var(--ease-spring), box-shadow 250ms",
        }}>
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 2,
            background: `linear-gradient(90deg, ${s.color}, transparent)`,
          }} />
          <div style={{ fontSize: "var(--text-2xs)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-muted)", marginBottom: "var(--space-2)" }}>{s.label}</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", fontWeight: 800, color: s.color, lineHeight: 1, letterSpacing: "-0.03em" }}>
            {i === 2 && s.value > 0
              ? <StreakFlame count={s.value} isAr={isAr} />
              : <AnimatedNumber value={s.value} duration={700} />}
          </div>
          {s.sub && <div style={{ fontSize: "var(--text-2xs)", color: s.color, marginTop: 5, fontWeight: 600, opacity: 0.8 }}>{s.sub}</div>}
        </div>
      ))}
    </div>
  );
}

// ── AI INSIGHT ────────────────────────────────────────────────────
function InsightCard({ insight }) {
  const [shown, setShown] = useState(false);
  useEffect(() => { if (insight) setTimeout(() => setShown(true), 200); }, [insight]);
  if (!insight) return null;
  return (
    <div style={{
      background: "rgba(16,185,129,.06)", border: "1px solid rgba(16,185,129,.15)",
      borderRadius: "var(--radius-lg)", padding: "var(--space-4)",
      marginBottom: "var(--space-3)",
      display: "flex", gap: 12, alignItems: "flex-start",
      opacity: shown ? 1 : 0, transform: shown ? "translateY(0)" : "translateY(8px)",
      transition: "opacity 400ms, transform 400ms var(--ease-spring)",
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: "var(--radius-sm)",
        background: "rgba(16,185,129,.12)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 16, flexShrink: 0,
        border: "1px solid rgba(16,185,129,.2)",
        animation: "bounce-in 500ms 300ms var(--ease-spring) both",
      }}>💡</div>
      <div style={{ fontSize: "var(--text-sm)", color: "var(--color-text-2)", lineHeight: 1.65 }}>{insight}</div>
    </div>
  );
}

// ── WEEKLY CHART ──────────────────────────────────────────────────
function WeeklyChart({ last7, isAr }) {
  if (!last7?.some(d => d.has)) return null;
  const best = Math.max(...last7.map(d => d.score));
  return (
    <div style={{
      background: "var(--color-card)", border: "1px solid var(--color-card-border)",
      borderRadius: "var(--radius-lg)", padding: "var(--space-4)",
      marginBottom: "var(--space-3)",
      animation: "fadeIn 400ms 300ms var(--ease-spring) both",
    }}>
      <SectionHeader
        title={isAr ? "آخر 7 أيام" : "Last 7 Days"}
        sub={isAr ? `أفضل: ${best}/100` : `Best: ${best}/100`}
        action={
          <span style={{
            fontSize: "var(--text-2xs)", fontWeight: 600, color: "var(--color-muted)",
            background: "var(--color-surface-2)", border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-full)", padding: "3px 10px",
          }}>{isAr ? "هذا الأسبوع" : "This week"}</span>
        }
      />
      <div style={{ direction: "ltr" }}>
        <BarChart data={last7.map(d => ({ v: d.score, l: d.label, has: d.has }))} height={72} />
      </div>
    </div>
  );
}

// ── SHORTCUT CARD (with hover state) ─────────────────────────────
function ShortcutCard({ item }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={item.action}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? `${item.color}10` : "var(--color-card)",
        border: `1px solid ${hov ? item.color + "35" : "var(--color-card-border)"}`,
        borderRadius: "var(--radius-lg)", padding: "var(--space-4)",
        display: "flex", alignItems: "center", gap: 12,
        cursor: "pointer", textAlign: "left",
        transition: "all 250ms var(--ease-spring)",
        transform: hov ? "translateY(-3px)" : "none",
        boxShadow: hov ? `0 8px 24px ${item.color}22` : "none",
      }}>
      <div style={{
        width: 40, height: 40, borderRadius: "var(--radius-md)",
        background: `${item.color}14`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 19, flexShrink: 0,
        border: `1px solid ${item.color}22`,
        transform: hov ? "scale(1.1) rotate(-4deg)" : "scale(1)",
        transition: "transform 300ms var(--ease-spring)",
      }}>{item.icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontFamily: "var(--font-display)", fontSize: "var(--text-sm)",
          fontWeight: 700, color: "var(--color-text)", letterSpacing: "-0.01em",
        }}>{item.label}</div>
        <div style={{ fontSize: "var(--text-2xs)", color: "var(--color-muted)", marginTop: 2, fontWeight: 500 }}>{item.sub}</div>
      </div>
    </button>
  );
}

// ── TRIAL BANNER ──────────────────────────────────────────────────
function TrialBanner({ trialDays, isAr, setPage }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), 100); }, []);
  const color = trialDays <= 1 ? "var(--color-danger)" : trialDays <= 3 ? "var(--color-warning)" : "var(--color-accent)";
  return (
    <div style={{
      background: `${color}10`, border: `1px solid ${color}28`,
      borderRadius: "var(--radius-lg)", padding: "10px var(--space-4)",
      marginBottom: "var(--space-3)",
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(-6px)",
      transition: "opacity 350ms, transform 350ms var(--ease-spring)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 15 }}>{trialDays <= 1 ? "⏰" : "🔔"}</span>
        <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color }}>
          {trialDays <= 0
            ? (isAr ? "انتهت التجربة" : "Trial expired")
            : `${trialDays} ${isAr ? "أيام متبقية" : "days left in trial"}`}
        </span>
      </div>
      <button onClick={() => setPage("pricing")} style={{
        background: color, border: "none", borderRadius: "var(--radius-sm)",
        padding: "6px 14px", fontSize: "var(--text-xs)", fontWeight: 700,
        color: "#fff", cursor: "pointer", whiteSpace: "nowrap",
        transition: "filter 150ms",
      }}>{isAr ? "ترقية" : "Upgrade"}</button>
    </div>
  );
}

// ── COMPANY CARD ──────────────────────────────────────────────────
function CompanyCard({ hasCompany, canSetupCompany, setPage, setShowCompanyOnboard, isAr }) {
  const [hov, setHov] = useState(false);
  if (!hasCompany && !canSetupCompany) return null;
  const isSetup = !hasCompany;
  const color   = isSetup ? "var(--color-success)" : "var(--color-accent)";
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: isSetup ? "rgba(16,185,129,.05)" : "rgba(26,86,219,.05)",
        border: `1px solid ${isSetup ? "rgba(16,185,129,.16)" : "rgba(26,86,219,.16)"}`,
        borderRadius: "var(--radius-lg)", padding: "var(--space-4)",
        marginBottom: "var(--space-3)",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        animation: "fadeIn 400ms 380ms var(--ease-spring) both",
        transition: "transform 250ms var(--ease-spring), box-shadow 250ms",
        transform: hov ? "translateY(-2px)" : "none",
        boxShadow: hov ? "var(--shadow-md)" : "none",
      }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 42, height: 42, borderRadius: "var(--radius-md)",
          background: isSetup ? "rgba(16,185,129,.12)" : "rgba(26,86,219,.12)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20,
          transition: "transform 300ms var(--ease-spring)",
          transform: hov ? "scale(1.1) rotate(-5deg)" : "scale(1)",
        }}>🏢</div>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--color-text)" }}>
            {isSetup ? (isAr ? "إعداد مساحة الشركة" : "Set Up Company") : (isAr ? "مساحة العمل" : "Company Workspace")}
          </div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--color-muted)", marginTop: 2 }}>
            {isSetup ? (isAr ? "ادعو فريقك وتابع التقارير" : "Invite team & track reports") : (isAr ? "إدارة الفريق" : "Team management")}
          </div>
        </div>
      </div>
      <button onClick={() => isSetup ? setShowCompanyOnboard(true) : setPage("hr")} style={{
        background: color, border: "none", borderRadius: "var(--radius-md)",
        padding: "8px 16px", fontSize: "var(--text-xs)", fontWeight: 700,
        color: "#fff", cursor: "pointer", whiteSpace: "nowrap",
        boxShadow: isSetup ? "var(--shadow-green)" : "var(--shadow-blue)",
        transition: "filter 150ms, transform 150ms",
        transform: hov ? "scale(1.04)" : "scale(1)",
      }}>
        {isSetup ? (isAr ? "ابدأ →" : "Setup →") : "HR Panel →"}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
export default function HomePage({
  user, profile, cs, lang, isAr, dir,
  userSessions, setUserSessions, allUsers, setAllUsers,
  tier, setTier, mode, setMode,
  setPage, startCamera, addToast,
  setShowDashboard, setShowCoach, setShowGamification,
  setShowBilling, setShowCompanyOnboard, setShowAdmin,
  setShowWorkforceAnalytics, setShowOnboard,
  isAdmin, isHRAdmin, companyId, darkMode, setDarkMode, setLang,
  t, logOut, setUser, setProfile,
  showCalibWizard, setShowCalibWizard,
  showBreak, dismissBreak,
  showDashboard, showCoach, showGamification,
  showBilling, showCompanyOnboard, showAdmin,
  AnalyticsDashboard, AICoach, GamificationPanel,
  BillingModal, CompanyOnboarding, AdminDashboard,
  calibData, Toasts: ToastsComp, toasts, dismissToast,
  NavAvatarDropdown, UpgradePrompt, showUpgrade,
  upgradeReason, setShowUpgrade, BreakTimer,
  CalibrationWizard, setCalibData, toast,
}) {
  const [loading, setLoading]       = useState(!userSessions?.length && !profile);
  const [netError, setNetError]     = useState(false);
  const [retrying, setRetrying]     = useState(false);
  const { achievement, show: achShow, fire: fireAchievement, dismiss: dismissAch } = useAchievement();

  // Simulate initial load
  useEffect(() => {
    if (profile) { setLoading(false); }
    const t = setTimeout(() => setLoading(false), 2200);
    return () => clearTimeout(t);
  }, [profile]);

  // Fire achievement on first session
  useEffect(() => {
    if (userSessions?.length === 1) {
      setTimeout(() => fireAchievement({
        icon: "🎯",
        title: isAr ? "أول جلسة!" : "First Session!",
        desc: isAr ? "أنهيت جلستك الأولى 🎉" : "You completed your first session 🎉",
      }), 800);
    }
  }, [userSessions?.length]);

  // Retry handler
  const handleRetry = () => {
    setRetrying(true);
    setTimeout(() => { setRetrying(false); setNetError(false); }, 1800);
  };

  // ── Derived data ────────────────────────────────────────────────
  const sessThisMonth = userSessions.filter(s => {
    const d = s.created_at?.toDate?.() || new Date(s.created_at || 0);
    const n = new Date();
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  }).length;

  const avgAll = userSessions.length
    ? Math.round(userSessions.reduce((a, s) => a + (s.avg_score || 0), 0) / userSessions.length)
    : (profile?.avg_score || 0);

  const streak    = profile?.streak_days || (userSessions.length > 0 ? 1 : 0);
  const lastSess  = userSessions[0];
  const lastScore = lastSess?.avg_score || 0;

  const lastTime = (() => {
    if (!lastSess) return null;
    const d = lastSess.created_at?.toDate?.() ?? new Date(lastSess.created_at || 0);
    const h = Math.floor((Date.now() - d) / 3600000);
    if (h < 1)  return isAr ? "منذ قليل"  : "just now";
    if (h < 24) return isAr ? `منذ ${h}س` : `${h}h ago`;
    return isAr ? `منذ ${Math.floor(h / 24)} يوم` : `${Math.floor(h / 24)}d ago`;
  })();

  const last7 = (() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d  = new Date(); d.setDate(d.getDate() - i);
      const ds = d.toDateString();
      const ss = userSessions.filter(s =>
        (s.created_at?.toDate?.() ?? new Date(s.created_at || 0)).toDateString() === ds
      );
      const avg = ss.length
        ? Math.round(ss.reduce((a, s) => a + (s.avg_score || 0), 0) / ss.length) : 0;
      days.push({ label: ["S","M","T","W","T","F","S"][d.getDay()], score: avg, has: ss.length > 0 });
    }
    return days;
  })();

  const hour     = new Date().getHours();
  const greet    = isAr
    ? (hour < 12 ? "صباح الخير" : hour < 17 ? "مساء الخير" : "مساء النور")
    : (hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening");
  const firstName  = (profile?.name || user?.email?.split("@")[0] || "").split(" ")[0];
  const savedMode  = localStorage.getItem("last_mode") || "laptop";
  const insight    = !avgAll ? null
    : avgAll >= 80 ? (isAr ? "وضعيتك ممتازة 💪" : "Your posture is excellent 💪 Keep it up!")
    : avgAll >= 60 ? (isAr ? `متوسطك ${avgAll}/100 — اضبط ارتفاع الشاشة` : `Average ${avgAll}/100 — try adjusting monitor height`)
    : (isAr ? `⚠️ متوسطك ${avgAll}/100 — وضعية الرقبة تحتاج اهتمام` : `⚠️ Average ${avgAll}/100 — neck posture needs attention`);

  const trialExp  = profile?.trial_expires_at?.toDate?.();
  const trialDays = trialExp ? Math.max(0, Math.ceil((trialExp - Date.now()) / 86400000)) : null;
  const showTrial = profile?.is_trial && trialDays !== null;
  const hasCompany     = !!(companyId || profile?.company_id);
  const canSetupCompany = profile && !hasCompany && (profile.tier === "professional" || profile.tier === "elite");

  const goLive = () => {
    const m = mode || savedMode || "laptop";
    setMode(m); localStorage.setItem("last_mode", m);
    setPage("live");
    setTimeout(() => startCamera(), 150);
  };

  const shortcuts = [
    { icon: "📊", label: isAr ? "التحليلات" : "Analytics",         sub: isAr ? "عرض الإحصائيات"  : "View stats",          color: "#1a56db", action: () => { getUserSessions(user.uid).then(setUserSessions); setShowDashboard(true); } },
    { icon: "🤖", label: isAr ? "مدرب AI"   : "AI Coach",          sub: isAr ? "نصائح مخصصة"     : "Personalized tips",   color: "#0891b2", action: () => { getUserSessions(user.uid).then(setUserSessions); setShowCoach(true); } },
    { icon: "🏭", label: isAr ? "تحليلات QW" : "Workforce Intel",  sub: isAr ? "إنتاجية وإرهاق"  : "Productivity & risk", color: "#0891b2", action: () => { getUserSessions(user.uid).then(setUserSessions); getAllUsers().then(setAllUsers); setShowWorkforceAnalytics(true); } },
    { icon: "🏆", label: isAr ? "الصدارة"   : "Leaderboard",       sub: isAr ? "تنافس مع الفريق" : "Compete",             color: "#f59e0b", action: () => { getAllUsers().then(setAllUsers); setPage("leaderboard"); } },
    { icon: "💎", label: isAr ? "الباقات"   : "Plans",             sub: isAr ? "ترقية الحساب"    : "Upgrade plan",        color: "#10b981", action: () => setPage("pricing") },
    { icon: "📋", label: isAr ? "التقارير"  : "AI Reports",         sub: isAr ? "تقارير PDF"       : "Executive PDF",       color: "#7c3aed", action: () => { getUserSessions(user.uid).then(setUserSessions); setShowAIReports?.(true); } },
  ];

  // ── RENDER: Loading ─────────────────────────────────────────────
  if (loading) return (
    <div dir={dir} style={{ minHeight: "100vh", background: "var(--color-bg)", paddingBottom: 90 }}>
      <div style={{
        position: "sticky", top: 0, zIndex: 60, height: 56,
        background: "rgba(7,13,26,.88)", borderBottom: "1px solid var(--color-border)",
        backdropFilter: "blur(20px)",
        display: "flex", alignItems: "center", padding: "0 var(--space-4)", gap: 10,
      }}>
        <div style={{ width: 32, height: 32, background: "var(--gradient-brand)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>◈</div>
        <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-base)", fontWeight: 800, letterSpacing: "-0.03em" }}>PostureAI <span style={{ color: "var(--color-accent)" }}>Pro</span></span>
      </div>
      <HomePageSkeleton />
    </div>
  );

  // ── RENDER: Network error ────────────────────────────────────────
  if (netError) return (
    <div dir={dir} style={{ minHeight: "100vh", background: "var(--color-bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--space-6)" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <ErrorNetwork isAr={isAr} onRetry={handleRetry} loading={retrying} />
      </div>
    </div>
  );

  // ── RENDER: No sessions (zero state) ────────────────────────────
  const showZero = !loading && userSessions.length === 0 && profile;

  return (
    <PageTransition id="home">
    <div dir={dir} style={{
      minHeight: "100vh", background: "var(--color-bg)",
      color: "var(--color-text)", fontFamily: "var(--font-body)", paddingBottom: 90,
    }}>

      {/* ── Global overlays ── */}
      {ToastsComp
        ? <ToastsComp toasts={toasts} dismiss={dismissToast} isAr={isAr} />
        : <Toasts toasts={toasts} dismiss={dismissToast} isAr={isAr} />
      }

      <AchievementToast
        show={achShow}
        title={achievement?.title}
        desc={achievement?.desc}
        icon={achievement?.icon}
        isAr={isAr}
        onClose={dismissAch}
      />

      {showCalibWizard && (
        <CalibrationWizard uid={profile?.uid} cs={cs} lang={lang}
          onDone={d => { setCalibData(d); setShowCalibWizard(false); toast?.("Calibration saved ✓", "success"); }}
          onSkip={() => setShowCalibWizard(false)} />
      )}
      {showBreak && (
        <BreakTimer cs={cs} lang={lang} intervalMin={30} onDismiss={dismissBreak}
          onComplete={() => { dismissBreak(); toast?.("Break done! 🎉", "success"); }} />
      )}
      {showDashboard    && <AnalyticsDashboard uid={profile?.uid} profile={profile} cs={cs} lang={lang} onBack={() => setShowDashboard(false)} />}
      {showCoach        && <AICoach profile={profile} sessions={userSessions} calibration={calibData} cs={cs} lang={lang} onClose={() => setShowCoach(false)} />}
      {showGamification && <GamificationPanel profile={profile} sessions={userSessions} calibration={calibData} cs={cs} lang={lang} onClose={() => setShowGamification(false)} />}
      {showBilling      && <BillingModal profile={profile} currentPlan={profile?.tier || "standard"} cs={cs} lang={lang} onClose={() => setShowBilling(false)} onSuccess={plan => { setShowBilling(false); toast?.(`Upgraded to ${plan}! 🎉`, "success"); }} />}
      {showAdmin        && <AdminDashboard adminProfile={profile} cs={cs} lang={lang} onBack={() => setShowAdmin(false)} />}
      {showCompanyOnboard && <CompanyOnboarding profile={profile} cs={cs} lang={lang} onComplete={() => setShowCompanyOnboard(false)} />}

      {/* ── Nav ── */}
      <TopNav
        user={user} profile={profile} cs={cs} isAr={isAr}
        darkMode={darkMode} setDarkMode={setDarkMode} setLang={setLang}
        logOut={logOut} setUser={setUser} setProfile={setProfile} setPage={setPage}
        getUserSessions={getUserSessions} setUserSessions={setUserSessions}
        getAllUsers={getAllUsers} setAllUsers={setAllUsers}
        isAdmin={isAdmin} isHRAdmin={isHRAdmin} setShowAdmin={setShowAdmin}
        NavAvatarDropdown={NavAvatarDropdown} t={t} lang={lang}
      />

      {/* ── Main content ── */}
      <div style={{ maxWidth: 500, margin: "0 auto", padding: "var(--space-4) var(--space-4) 0" }}>

        {showUpgrade && (
          <UpgradePrompt cs={cs} t={t} reason={upgradeReason}
            onUpgrade={() => { setShowUpgrade(false); setPage("pricing"); }}
            onDismiss={() => setShowUpgrade(false)} />
        )}

        {showTrial && <TrialBanner trialDays={trialDays} isAr={isAr} setPage={setPage} />}

        {/* Zero state OR full dashboard */}
        {showZero ? (
          <ZeroStateSessions isAr={isAr} onStart={goLive} />
        ) : (
          <>
            <GreetingCard greet={greet} firstName={firstName} lastTime={lastTime} lastScore={lastScore} isAr={isAr} avgAll={avgAll} />
            <StartBtn onPress={goLive} mode={mode} savedMode={savedMode} profile={profile} isAr={isAr} />
            <ModeSelector mode={mode} savedMode={savedMode} setMode={setMode} isAr={isAr} />
            <StatsRow avgAll={avgAll} sessThisMonth={sessThisMonth} userSessions={userSessions} streak={streak} isAr={isAr} />
            <InsightCard insight={insight} />
            <WeeklyChart last7={last7} isAr={isAr} />
          </>
        )}

        {/* Quick Access — always visible */}
        <div style={{ margin: `${showZero ? "var(--space-4)" : "0"} 0 var(--space-1)` }}>
          <SectionHeader title={isAr ? "الوصول السريع" : "Quick Access"} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
          {shortcuts.map((item, i) => <ShortcutCard key={i} item={item} />)}
        </div>

        <CompanyCard
          hasCompany={hasCompany} canSetupCompany={canSetupCompany}
          setPage={setPage} setShowCompanyOnboard={setShowCompanyOnboard} isAr={isAr}
        />

        <div style={{ textAlign: "center", padding: "var(--space-3) 0 var(--space-2)", fontSize: "var(--text-xs)", color: "var(--color-muted)" }}>
          <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: "var(--color-accent)" }}>{SUPPORT_EMAIL}</a>
        </div>
      </div>

      <BottomNav page="home" setPage={setPage} isAr={isAr} companyId={companyId} profile={profile} startCamera={startCamera} />
    </div>
    </PageTransition>
  );
}
