/**
 * Corvus — Basic Plan Features (199 EGP)
 * "ابنِ عادة يومية" — Build a daily habit
 *
 * 1. DailyCheckIn       — morning check-in card
 * 2. WeeklyChallenge    — weekly posture challenge + badge
 * 3. PainPredictionCard — prominent pain risk card
 * 4. StreakFreezeButton — one-per-month streak protection
 * 5. HabitScoreCard     — consistency score (not accuracy)
 * 6. WhatsAppReminder   — session reminder via WhatsApp
 */
import React, { useState, useEffect, useCallback } from "react";
import { updateUserProfile } from "./firebase.js";
import { tierAtLeast } from "./lib/tierQuality.js";

// ── Helpers ─────────────────────────────────────────────────────
const todayKey = () => new Date().toISOString().slice(0, 10); // "2026-08-01"
const isSameDay = (d1, d2) => d1?.slice(0, 10) === d2?.slice(0, 10);

function card(cs, extra = {}) {
  return {
    background: cs.card,
    border: `1px solid ${cs.border}`,
    borderRadius: 14,
    padding: "18px 20px",
    ...extra,
  };
}

// ── 1. DAILY CHECK-IN ────────────────────────────────────────────
export function DailyCheckIn({ profile, cs, isAr, addToast, onCheckedIn }) {
  const [step, setStep]         = useState("idle"); // idle | feeling | pain | done
  const [feeling, setFeeling]   = useState(null);   // 1-5
  const [painNote, setPainNote] = useState("");
  const [saving, setSaving]     = useState(false);

  const alreadyDone = isSameDay(profile?.last_checkin_at, new Date().toISOString());

  const feelings = [
    { v: 5, emoji: "😄", label: isAr ? "ممتاز" : "Great" },
    { v: 4, emoji: "🙂", label: isAr ? "كويس" : "Good" },
    { v: 3, emoji: "😐", label: isAr ? "عادي" : "Okay" },
    { v: 2, emoji: "😕", label: isAr ? "مش كويس" : "Not great" },
    { v: 1, emoji: "😣", label: isAr ? "ألم" : "Pain" },
  ];

  async function save() {
    if (!feeling) return;
    setSaving(true);
    try {
      const data = {
        last_checkin_at: new Date().toISOString(),
        last_checkin_feeling: feeling,
        last_checkin_pain: painNote.trim() || null,
        checkin_streak: (profile?.checkin_streak || 0) + 1,
      };
      await updateUserProfile(profile.uid, data);
      setStep("done");
      addToast?.(isAr ? "✅ تم تسجيل وضعك اليوم" : "✅ Daily check-in saved", "success");
      onCheckedIn?.(data);
    } catch (e) {
      addToast?.(isAr ? "خطأ في الحفظ" : "Save failed", "error");
    }
    setSaving(false);
  }

  if (alreadyDone || step === "done") {
    const f = feelings.find(f => f.v === (profile?.last_checkin_feeling || 4));
    const aiTip = (() => {
      const v = profile?.last_checkin_feeling || 4;
      if (v <= 2) return isAr
        ? "وضعيتك النهارده ممكن تكون أصعب — خد فترات راحة أقصر وأكتر."
        : "You may struggle with posture today — take shorter, more frequent breaks.";
      if (v === 3) return isAr
        ? "يوم عادي — حاول تركّز على وضعية الرقبة في الجلسة."
        : "Average day — focus on neck position during your session.";
      return isAr
        ? "يوم كويس! ده وقت ممتاز تعمل فيه جلسة طويلة."
        : "Good day! Great time for a longer session.";
    })();

    return (
      <div style={{ ...card(cs), background: "rgba(16,185,129,.05)", borderColor: "rgba(16,185,129,.2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 22 }}>{f?.emoji || "✅"}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: cs.text }}>
              {isAr ? "تسجيل اليوم ✓" : "Today's check-in ✓"}
            </div>
            <div style={{ fontSize: 11, color: cs.muted }}>
              {isAr ? `شعورك: ${f?.label}` : `Feeling: ${f?.label}`}
              {profile?.last_checkin_pain && ` · ${profile.last_checkin_pain}`}
            </div>
          </div>
          <div style={{ marginInlineStart: "auto", fontSize: 10, fontWeight: 700,
            color: "#10b981", background: "rgba(16,185,129,.12)", borderRadius: 99,
            padding: "2px 8px" }}>
            {isAr ? `🔥 ${profile?.checkin_streak || 1} يوم` : `🔥 ${profile?.checkin_streak || 1}d streak`}
          </div>
        </div>
        <div style={{ fontSize: 11.5, color: cs.muted, lineHeight: 1.6,
          background: "rgba(255,255,255,.03)", borderRadius: 8, padding: "9px 12px" }}>
          🤖 {aiTip}
        </div>
      </div>
    );
  }

  if (step === "idle") return (
    <div style={card(cs)}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 22 }}>☀️</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: cs.text }}>
            {isAr ? "تسجيل يومي — إزيك النهارده؟" : "Daily Check-in — How are you today?"}
          </div>
          <div style={{ fontSize: 11, color: cs.muted }}>
            {isAr ? "ثانية واحدة وجوابك بيأثر على توصيات اليوم" : "One second — your answer shapes today's recommendations"}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
        {feelings.map(f => (
          <button key={f.v} onClick={() => { setFeeling(f.v); setStep("pain"); }}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              padding: "10px 14px", background: "rgba(255,255,255,.04)",
              border: `1px solid ${cs.border}`, borderRadius: 10, cursor: "pointer",
              transition: "all .15s", minWidth: 58 }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#1a56db"; e.currentTarget.style.background = "rgba(26,86,219,.08)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = cs.border; e.currentTarget.style.background = "rgba(255,255,255,.04)"; }}>
            <span style={{ fontSize: 20 }}>{f.emoji}</span>
            <span style={{ fontSize: 9.5, color: cs.muted, fontWeight: 500 }}>{f.label}</span>
          </button>
        ))}
      </div>
    </div>
  );

  if (step === "pain") return (
    <div style={card(cs)}>
      <div style={{ fontSize: 13, fontWeight: 700, color: cs.text, marginBottom: 10 }}>
        {isAr ? "في أي ألم أو ضغط في جسمك؟" : "Any pain or tension today?"}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {(isAr
          ? ["لا، كله تمام", "رقبة", "ظهر", "كتف", "وجع رأس", "عيون"]
          : ["None", "Neck", "Back", "Shoulder", "Headache", "Eyes"]
        ).map(tag => (
          <button key={tag} onClick={() => setPainNote(p => p ? `${p}, ${tag}` : tag)}
            style={{ fontSize: 11, padding: "4px 10px", borderRadius: 99, cursor: "pointer",
              background: painNote.includes(tag) ? "rgba(26,86,219,.15)" : "rgba(255,255,255,.04)",
              border: `1px solid ${painNote.includes(tag) ? "#1a56db" : cs.border}`,
              color: painNote.includes(tag) ? "#60a5fa" : cs.muted }}>
            {tag}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={save} disabled={saving}
          style={{ flex: 1, padding: "10px", background: "linear-gradient(135deg,#1a56db,#0891b2)",
            border: "none", borderRadius: 9, color: "#fff", fontSize: 13, fontWeight: 700,
            cursor: saving ? "not-allowed" : "pointer", opacity: saving ? .7 : 1 }}>
          {saving ? "..." : (isAr ? "سجّل اليوم →" : "Save →")}
        </button>
        <button onClick={() => { setStep("idle"); setFeeling(null); setPainNote(""); }}
          style={{ padding: "10px 14px", background: "none", border: `1px solid ${cs.border}`,
            borderRadius: 9, color: cs.muted, fontSize: 12, cursor: "pointer" }}>
          {isAr ? "رجوع" : "Back"}
        </button>
      </div>
    </div>
  );
}

// ── 2. WEEKLY CHALLENGE ─────────────────────────────────────────
const CHALLENGES = [
  {
    id: "sit25",
    icon: "🪑",
    en: { title: "Sit Right Challenge", desc: "Maintain good posture for 25 min/day, 5 days this week.", badge: "🏅 Upright Hero" },
    ar: { title: "تحدي الجلسة الصحيحة", desc: "احتفظ بوضعية جيدة 25 دقيقة يومياً لمدة 5 أيام.", badge: "🏅 بطل الوضعية" },
    target: 5, metric: "good_sessions_week",
  },
  {
    id: "checkin7",
    icon: "☀️",
    en: { title: "7-Day Check-in Streak", desc: "Complete your daily morning check-in 7 days in a row.", badge: "🌟 Consistency King" },
    ar: { title: "تحدي التسجيل اليومي", desc: "سجّل حضورك الصباحي 7 أيام متتالية.", badge: "🌟 ملك الانتظام" },
    target: 7, metric: "checkin_streak",
  },
  {
    id: "score70",
    icon: "📈",
    en: { title: "Score 70+ Three Days", desc: "Hit a posture score of 70 or above in 3 sessions this week.", badge: "🎯 Posture Pro" },
    ar: { title: "تحدي درجة 70+", desc: "احصل على درجة 70+ في 3 جلسات هذا الأسبوع.", badge: "🎯 محترف الوضعية" },
    target: 3, metric: "high_score_sessions_week",
  },
];

function getWeekNum() {
  const d = new Date();
  return `${d.getFullYear()}-W${Math.ceil(d.getDate() / 7)}`;
}

export function WeeklyChallenge({ profile, userSessions, cs, isAr, addToast }) {
  // Pick challenge based on week number
  const challenge = CHALLENGES[new Date().getWeek?.() % 3 || (Math.floor(Date.now() / (7 * 86400000)) % 3)];
  const week = getWeekNum();
  const completed = profile?.[`challenge_${week}`] === challenge.id;
  const c = isAr ? challenge.ar : challenge.en;

  // Calculate progress
  const progress = (() => {
    if (challenge.metric === "checkin_streak") return Math.min(profile?.checkin_streak || 0, challenge.target);
    if (challenge.metric === "good_sessions_week") {
      const now = new Date();
      const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
      return userSessions.filter(s => {
        const d = s.created_at?.toDate?.() ?? new Date(s.created_at || 0);
        return d >= weekStart && (s.avg_score || 0) >= 65 && (s.duration_sec || 0) >= 25 * 60;
      }).length;
    }
    if (challenge.metric === "high_score_sessions_week") {
      const now = new Date();
      const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
      return userSessions.filter(s => {
        const d = s.created_at?.toDate?.() ?? new Date(s.created_at || 0);
        return d >= weekStart && (s.avg_score || 0) >= 70;
      }).length;
    }
    return 0;
  })();

  const pct = Math.min(100, Math.round((progress / challenge.target) * 100));
  const isDone = progress >= challenge.target;

  useEffect(() => {
    if (isDone && !completed && profile?.uid) {
      updateUserProfile(profile.uid, { [`challenge_${week}`]: challenge.id })
        .then(() => addToast?.(isAr ? `🎉 أنجزت التحدي! ${c.badge}` : `🎉 Challenge complete! ${c.badge}`, "success"))
        .catch(() => {});
    }
  }, [isDone]);

  return (
    <div style={{ ...card(cs), borderColor: isDone ? "rgba(16,185,129,.3)" : cs.border,
      background: isDone ? "rgba(16,185,129,.05)" : cs.card }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
        <span style={{ fontSize: 26 }}>{challenge.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: cs.text }}>{c.title}</div>
            <span style={{ fontSize: 9, fontWeight: 700, color: "#f59e0b",
              background: "rgba(245,158,11,.12)", borderRadius: 99, padding: "2px 7px" }}>
              {isAr ? "تحدي هذا الأسبوع" : "THIS WEEK"}
            </span>
          </div>
          <div style={{ fontSize: 11.5, color: cs.muted, marginTop: 3, lineHeight: 1.5 }}>{c.desc}</div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
          <span style={{ fontSize: 11, color: cs.muted }}>
            {isAr ? `${progress} من ${challenge.target}` : `${progress} / ${challenge.target}`}
          </span>
          <span style={{ fontSize: 11, fontWeight: 700,
            color: isDone ? "#10b981" : "#f59e0b" }}>{pct}%</span>
        </div>
        <div style={{ height: 8, background: "rgba(255,255,255,.06)", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, borderRadius: 99,
            background: isDone
              ? "linear-gradient(90deg,#10b981,#059669)"
              : "linear-gradient(90deg,#f59e0b,#1a56db)",
            transition: "width .4s ease" }} />
        </div>
      </div>

      {isDone ? (
        <div style={{ textAlign: "center", marginTop: 10, fontSize: 13, fontWeight: 700, color: "#10b981" }}>
          {c.badge} {isAr ? "— أحسنت!" : "— Well done!"}
        </div>
      ) : (
        <div style={{ fontSize: 10.5, color: cs.muted, marginTop: 6 }}>
          {isAr
            ? `${challenge.target - progress} ${challenge.target - progress === 1 ? "مرة" : "مرات"} أخرى للفوز بـ ${c.badge}`
            : `${challenge.target - progress} more to win ${c.badge}`}
        </div>
      )}
    </div>
  );
}

// ── 3. PAIN PREDICTION CARD ──────────────────────────────────────
export function PainPredictionCard({ profile, userSessions, cs, isAr }) {
  // Compute pain risk from last 3 sessions' avg score + neck alerts
  const risk = (() => {
    if (!userSessions?.length) return null;
    const last3 = userSessions.slice(0, 3);
    const avgScore = last3.reduce((a, s) => a + (s.avg_score || 0), 0) / last3.length;
    const neckAlerts = last3.reduce((a, s) => a + (s.alerts_count || 0), 0) / last3.length;

    // Simple heuristic: low avg + high alerts = higher risk
    let pct = 0;
    if (avgScore < 50) pct += 45;
    else if (avgScore < 65) pct += 25;
    else if (avgScore < 75) pct += 10;
    if (neckAlerts > 5) pct += 20;
    else if (neckAlerts > 2) pct += 10;

    // Add streak of poor sessions
    const consecutive = last3.filter(s => (s.avg_score || 0) < 60).length;
    pct += consecutive * 8;

    pct = Math.min(95, Math.max(5, pct));
    const area = avgScore < 55 ? (isAr ? "الرقبة والكتف" : "neck & shoulder") : (isAr ? "أسفل الظهر" : "lower back");
    return { pct: Math.round(pct), area, hours: pct > 50 ? 24 : 48, sessions: last3.length };
  })();

  if (!risk) return null;

  const color = risk.pct >= 60 ? "#ef4444" : risk.pct >= 35 ? "#f59e0b" : "#10b981";
  const label = risk.pct >= 60
    ? (isAr ? "خطر مرتفع" : "High Risk")
    : risk.pct >= 35 ? (isAr ? "خطر متوسط" : "Moderate Risk")
    : (isAr ? "خطر منخفض" : "Low Risk");

  return (
    <div style={{ ...card(cs),
      borderColor: risk.pct >= 60 ? "rgba(239,68,68,.3)" : risk.pct >= 35 ? "rgba(245,158,11,.3)" : "rgba(16,185,129,.2)",
      background: risk.pct >= 60 ? "rgba(239,68,68,.04)" : risk.pct >= 35 ? "rgba(245,158,11,.04)" : "rgba(16,185,129,.04)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        {/* Risk donut */}
        <div style={{ position: "relative", width: 72, height: 72, flexShrink: 0 }}>
          <svg width="72" height="72" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="36" cy="36" r="28" fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="7" />
            <circle cx="36" cy="36" r="28" fill="none" stroke={color} strokeWidth="7"
              strokeDasharray={`${(risk.pct / 100) * 175.9} 175.9`} strokeLinecap="round" />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 900, color, lineHeight: 1 }}>{risk.pct}%</div>
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
            <span style={{ fontSize: 16 }}>🧠</span>
            <div style={{ fontSize: 13, fontWeight: 700, color: cs.text }}>
              {isAr ? "توقع الألم — الـ 48 ساعة الجاية" : "Pain Prediction — Next 48h"}
            </div>
          </div>
          <div style={{ fontSize: 12, color, fontWeight: 600, marginBottom: 6 }}>
            {isAr
              ? `احتمالية ${risk.pct}% لألم في ${risk.area} خلال ${risk.hours} ساعة`
              : `${risk.pct}% chance of ${risk.area} pain within ${risk.hours}h`}
          </div>
          <div style={{ fontSize: 11, color: cs.muted, lineHeight: 1.5, marginBottom: 10 }}>
            {isAr
              ? `بناءً على آخر ${risk.sessions} جلسات. ${risk.pct >= 50 ? "اعمل 5 دقائق stretching دلوقتي." : "وضعيتك أحسن من الأيام الماضية — كمّل."}`
              : `Based on your last ${risk.sessions} sessions. ${risk.pct >= 50 ? "Do 5 min of stretching now." : "You're trending better — keep it up."}`}
          </div>
          {risk.pct >= 35 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(isAr
                ? ["↕️ مد الرقبة 30 ثانية", "🔄 دوران الكتف", "🧘 تنفس عميق"]
                : ["↕️ Neck stretch 30s", "🔄 Shoulder rolls", "🧘 Deep breathing"]
              ).map(tip => (
                <span key={tip} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 99,
                  background: `${color}12`, color, border: `1px solid ${color}30` }}>{tip}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 4. STREAK FREEZE ─────────────────────────────────────────────
export function StreakFreezeButton({ profile, cs, isAr, addToast }) {
  const [used, setUsed]   = useState(false);
  const [loading, setLoading] = useState(false);

  const thisMonth = new Date().toISOString().slice(0, 7); // "2026-08"
  const alreadyUsed = profile?.streak_freeze_month === thisMonth;
  const streak = profile?.streak_days || 0;

  async function applyFreeze() {
    if (alreadyUsed || used || streak < 3) return;
    setLoading(true);
    try {
      await updateUserProfile(profile.uid, {
        streak_freeze_month: thisMonth,
        streak_freeze_used_at: new Date().toISOString(),
        // Keep the streak intact — just flag that today is protected
        streak_frozen_today: true,
      });
      setUsed(true);
      addToast?.(
        isAr ? `🛡️ تم تفعيل الـ Streak Freeze — الـ ${streak}-day streak بتاعتك محمية!`
             : `🛡️ Streak Freeze activated — your ${streak}-day streak is protected!`,
        "success"
      );
    } catch {
      addToast?.(isAr ? "حدث خطأ" : "Error applying freeze", "error");
    }
    setLoading(false);
  }

  if (streak < 3) return null; // No freeze for users with < 3 day streak

  const canUse = !alreadyUsed && !used;

  return (
    <div style={{ ...card(cs),
      background: canUse ? "rgba(99,102,241,.05)" : "rgba(100,116,139,.04)",
      borderColor: canUse ? "rgba(99,102,241,.25)" : cs.border }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 24 }}>🛡️</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: cs.text, marginBottom: 2 }}>
            {isAr ? "Streak Freeze" : "Streak Freeze"}
          </div>
          <div style={{ fontSize: 11, color: cs.muted, lineHeight: 1.5 }}>
            {alreadyUsed || used
              ? (isAr ? "✅ تم استخدام الـ Freeze هذا الشهر — سلسلتك آمنة" : "✅ Freeze used this month — your streak is safe")
              : (isAr
                  ? `بتحمي الـ ${streak}-day streak بتاعتك لو اتغيبت يوم. مرة واحدة في الشهر.`
                  : `Protects your ${streak}-day streak if you miss a day. Once per month.`)}
          </div>
        </div>
        {canUse && (
          <button onClick={applyFreeze} disabled={loading}
            style={{ padding: "8px 14px", background: "rgba(99,102,241,.15)",
              border: "1px solid rgba(99,102,241,.35)", borderRadius: 9,
              color: "#a5b4fc", fontSize: 12, fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer", flexShrink: 0, whiteSpace: "nowrap" }}>
            {loading ? "..." : (isAr ? "🛡️ حمّي السلسلة" : "🛡️ Activate")}
          </button>
        )}
      </div>
    </div>
  );
}

// ── 5. HABIT SCORE CARD ──────────────────────────────────────────
export function HabitScoreCard({ profile, userSessions, cs, isAr }) {
  // Habit Score = consistency, not perfection
  // Formula: days with any session in last 14 days / 14 × 100
  // Bonus: +5 per daily check-in streak day (max +20)
  // Penalty: -3 per skipped day after streak > 5
  const score = (() => {
    if (!userSessions?.length) return 0;
    const now = new Date();
    const days = new Set();
    userSessions.forEach(s => {
      const d = s.created_at?.toDate?.() ?? new Date(s.created_at || 0);
      const diff = Math.floor((now - d) / 86400000);
      if (diff <= 13) days.add(diff);
    });
    const activeDays = days.size;
    let base = Math.round((activeDays / 14) * 100);
    const checkinBonus = Math.min(20, (profile?.checkin_streak || 0) * 5);
    base = Math.min(100, base + checkinBonus);
    return base;
  })();

  const label = score >= 80
    ? (isAr ? "عادة راسخة 🏆" : "Rock solid 🏆")
    : score >= 60 ? (isAr ? "في الطريق الصح ✅" : "On track ✅")
    : score >= 40 ? (isAr ? "محتاج انتظام أكتر" : "Needs more consistency")
    : (isAr ? "ابدأ العادة دلوقتي" : "Start the habit now");

  const color = score >= 80 ? "#10b981" : score >= 60 ? "#1a56db" : score >= 40 ? "#f59e0b" : "#ef4444";
  const activeDaysCount = (() => {
    const now = new Date();
    const days = new Set();
    userSessions.forEach(s => {
      const d = s.created_at?.toDate?.() ?? new Date(s.created_at || 0);
      if (Math.floor((now - d) / 86400000) <= 13) days.add(Math.floor((now - d) / 86400000));
    });
    return days.size;
  })();

  return (
    <div style={card(cs)}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
        <div style={{ position: "relative", width: 64, height: 64, flexShrink: 0 }}>
          <svg width="64" height="64" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="32" cy="32" r="25" fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="6" />
            <circle cx="32" cy="32" r="25" fill="none" stroke={color} strokeWidth="6"
              strokeDasharray={`${(score / 100) * 157.1} 157.1`} strokeLinecap="round" />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 900, color, lineHeight: 1 }}>{score}</div>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: cs.text, marginBottom: 3 }}>
            {isAr ? "درجة العادة اليومية" : "Habit Score"}
          </div>
          <div style={{ fontSize: 12, color, fontWeight: 600, marginBottom: 2 }}>{label}</div>
          <div style={{ fontSize: 10.5, color: cs.muted }}>
            {isAr
              ? `${activeDaysCount} من 14 يوم نشط — الانتظام أهم من الكمال`
              : `${activeDaysCount}/14 active days — consistency beats perfection`}
          </div>
        </div>
      </div>

      {/* 14-day grid */}
      <div>
        <div style={{ fontSize: 10, color: cs.muted, marginBottom: 6 }}>
          {isAr ? "آخر 14 يوم" : "Last 14 days"}
        </div>
        <div style={{ display: "flex", gap: 3 }}>
          {Array.from({ length: 14 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (13 - i));
            const hasSession = userSessions.some(s => {
              const sd = s.created_at?.toDate?.() ?? new Date(s.created_at || 0);
              return sd.toDateString() === d.toDateString();
            });
            const isToday = i === 13;
            const avgForDay = hasSession ? (() => {
              const ss = userSessions.filter(s => {
                const sd = s.created_at?.toDate?.() ?? new Date(s.created_at || 0);
                return sd.toDateString() === d.toDateString();
              });
              return ss.reduce((a, s) => a + (s.avg_score || 0), 0) / ss.length;
            })() : 0;
            const col = hasSession
              ? (avgForDay >= 75 ? "#10b981" : avgForDay >= 55 ? "#f59e0b" : "#ef4444")
              : "rgba(255,255,255,.06)";
            return (
              <div key={i} title={d.toLocaleDateString()}
                style={{ flex: 1, height: 28, borderRadius: 4, background: col,
                  border: isToday ? "2px solid #1a56db" : "none",
                  transition: "transform .15s" }} />
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontSize: 9, color: cs.muted }}>
          <span>{isAr ? "14 يوم" : "14d ago"}</span>
          <div style={{ display: "flex", gap: 10 }}>
            <span style={{ color: "#10b981" }}>■ 75+</span>
            <span style={{ color: "#f59e0b" }}>■ 55–74</span>
            <span style={{ color: "#ef4444" }}>■ &lt;55</span>
          </div>
          <span>{isAr ? "اليوم" : "Today"}</span>
        </div>
      </div>
    </div>
  );
}

// ── 6. WHATSAPP REMINDER ─────────────────────────────────────────
export function WhatsAppReminder({ profile, cs, isAr, addToast }) {
  const [phone, setPhone]   = useState(profile?.whatsapp_phone || "");
  const [time, setTime]     = useState(profile?.reminder_time  || "09:00");
  const [enabled, setEnabled] = useState(!!profile?.whatsapp_reminder_enabled);
  const [saving, setSaving] = useState(false);
  const [testSending, setTestSending] = useState(false);

  async function save() {
    if (!phone.trim()) {
      addToast?.(isAr ? "أدخل رقم WhatsApp" : "Enter WhatsApp number", "warn");
      return;
    }
    setSaving(true);
    try {
      await updateUserProfile(profile.uid, {
        whatsapp_phone: phone.trim(),
        reminder_time:  time,
        whatsapp_reminder_enabled: enabled,
      });
      addToast?.(isAr ? "✅ تم حفظ إعدادات WhatsApp" : "✅ WhatsApp reminder saved", "success");
    } catch {
      addToast?.(isAr ? "خطأ في الحفظ" : "Save failed", "error");
    }
    setSaving(false);
  }

  async function sendTest() {
    if (!phone.trim()) {
      addToast?.(isAr ? "أدخل رقم WhatsApp الأول" : "Enter your WhatsApp number first", "warn");
      return;
    }
    setTestSending(true);
    try {
      const res = await fetch("/api/habits/whatsapp-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.trim(),
          name: profile?.name || "User",
          lang: isAr ? "ar" : "en",
        }),
      });
      if (res.ok) {
        addToast?.(isAr ? "📱 تم إرسال رسالة تجريبية على WhatsApp!" : "📱 Test message sent to WhatsApp!", "success");
      } else {
        addToast?.(isAr ? "تأكد من الرقم والاتصال بالإنترنت" : "Check the number and internet connection", "error");
      }
    } catch {
      addToast?.(isAr ? "خطأ في الإرسال" : "Send failed", "error");
    }
    setTestSending(false);
  }

  const inp = {
    width: "100%", boxSizing: "border-box",
    background: "rgba(255,255,255,.04)",
    border: `1px solid ${cs.border}`,
    borderRadius: 9, padding: "10px 13px",
    fontSize: 13, color: cs.text, outline: "none",
  };

  return (
    <div style={card(cs)}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 22 }}>📱</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: cs.text }}>
            {isAr ? "تذكير WhatsApp" : "WhatsApp Reminder"}
          </div>
          <div style={{ fontSize: 11, color: cs.muted }}>
            {isAr
              ? "في مصر والـ MENA، WhatsApp أقوى من أي إشعار تاني"
              : "In Egypt & MENA, WhatsApp beats any push notification"}
          </div>
        </div>
        {/* Enabled toggle */}
        <button onClick={() => setEnabled(v => !v)}
          style={{ marginInlineStart: "auto", width: 38, height: 22, borderRadius: 99, border: "none",
            background: enabled ? "#10b981" : "rgba(255,255,255,.1)", cursor: "pointer",
            position: "relative", transition: "background .2s", flexShrink: 0 }}>
          <div style={{ position: "absolute", top: 3, left: enabled ? 18 : 3, width: 16, height: 16,
            borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, marginBottom: 10 }}>
        <input
          value={phone} onChange={e => setPhone(e.target.value)}
          placeholder={isAr ? "رقم WhatsApp (مثال: +201012345678)" : "WhatsApp number (e.g. +201012345678)"}
          style={{ ...inp }} dir="ltr"
        />
        <input type="time" value={time} onChange={e => setTime(e.target.value)}
          style={{ ...inp, width: "auto", minWidth: 90 }} />
      </div>

      <div style={{ fontSize: 10.5, color: cs.muted, marginBottom: 12, lineHeight: 1.5 }}>
        {isAr
          ? "📌 هتوصلك رسالة WhatsApp من Corvus كل يوم في الوقت ده تذكّرك تبدأ جلستك."
          : "📌 You'll get a WhatsApp message from Corvus every day at this time to start your session."}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={save} disabled={saving}
          style={{ flex: 1, padding: "10px", background: "linear-gradient(135deg,#25d366,#128c7e)",
            border: "none", borderRadius: 9, color: "#fff", fontSize: 13, fontWeight: 700,
            cursor: saving ? "not-allowed" : "pointer", opacity: saving ? .7 : 1 }}>
          {saving ? "..." : (isAr ? "💾 حفظ الإعدادات" : "💾 Save")}
        </button>
        <button onClick={sendTest} disabled={testSending}
          style={{ padding: "10px 14px", background: "rgba(37,211,102,.1)",
            border: "1px solid rgba(37,211,102,.3)", borderRadius: 9,
            color: "#25d366", fontSize: 12, fontWeight: 600,
            cursor: testSending ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
          {testSending ? "..." : (isAr ? "📤 جرّب" : "📤 Test")}
        </button>
      </div>
    </div>
  );
}

// ── Compound: BasicDashboard — renders all 6 together ────────────
export function BasicDashboard({ profile, userSessions, cs, isAr, addToast, onCheckedIn }) {
  const isBasic = tierAtLeast(profile?.tier || "standard", "basic") &&
                  !tierAtLeast(profile?.tier || "standard", "professional");
  const isAnyPaid = tierAtLeast(profile?.tier || "standard", "basic");

  if (!isAnyPaid) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 4,
        borderBottom: `1px solid ${cs.border}` }}>
        <span style={{ fontSize: 16 }}>📅</span>
        <div style={{ fontSize: 12, fontWeight: 700, color: cs.text }}>
          {isAr ? "ابنِ عادة يومية" : "Build a Daily Habit"}
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, color: "#3b82f6",
          background: "rgba(59,130,246,.12)", borderRadius: 99, padding: "2px 7px" }}>BASIC</span>
      </div>

      <DailyCheckIn profile={profile} cs={cs} isAr={isAr} addToast={addToast} onCheckedIn={onCheckedIn} />
      <PainPredictionCard profile={profile} userSessions={userSessions} cs={cs} isAr={isAr} />
      <HabitScoreCard profile={profile} userSessions={userSessions} cs={cs} isAr={isAr} />
      <WeeklyChallenge profile={profile} userSessions={userSessions} cs={cs} isAr={isAr} addToast={addToast} />
      <StreakFreezeButton profile={profile} cs={cs} isAr={isAr} addToast={addToast} />
      <WhatsAppReminder profile={profile} cs={cs} isAr={isAr} addToast={addToast} />
    </div>
  );
}
