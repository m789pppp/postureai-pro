/**
 * Corvus — Basic Plan Features (199 EGP)
 * Complements the AI-backed daily check-in (AICoach.jsx), weekly
 * challenge (Gamification.jsx), and pain-prediction card (HomePage.jsx)
 * with three extras that don't overlap with those:
 *
 * 1. StreakFreezeButton — one-per-month streak protection
 * 2. HabitScoreCard     — consistency score (not accuracy)
 * 3. WhatsAppReminder   — session reminder via WhatsApp
 */
import React, { useState, useEffect, useCallback } from "react";
import { updateUserProfile } from "./firebase.js";
import { tierAtLeast } from "./lib/tierQuality.js";

// ── Helpers ─────────────────────────────────────────────────────

function card(cs, extra = {}) {
  return {
    background: cs.card,
    border: `1px solid ${cs.border}`,
    borderRadius: 14,
    padding: "18px 20px",
    ...extra,
  };
}

// ── 1. STREAK FREEZE ─────────────────────────────────────────────
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

// ── 2. HABIT SCORE CARD ──────────────────────────────────────────
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

// ── 3. WHATSAPP REMINDER ─────────────────────────────────────────
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
          <div style={{ position: "absolute", top: 3, insetInlineStart: enabled ? 18 : 3, width: 16, height: 16,
            borderRadius: "50%", background: "#fff", transition: "inset-inline-start .2s" }} />
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

// ── Compound: BasicDashboard — the 3 extras that complement the
// AI-backed daily check-in / weekly challenge / pain-prediction card
// already on the dashboard elsewhere (HomePage.jsx PainRiskCard,
// Gamification.jsx WeeklyChallengeCard, AICoach.jsx DailyCheckinPanel).
// DailyCheckIn / WeeklyChallenge / PainPredictionCard used to live here
// too but were dropped — duplicates of those, and this file's versions
// were client-only with a hardcoded if/else "AI tip" (not real AI, just
// templated text), vs the backend-verified LLM + Firestore/Redis
// versions kept elsewhere.
export function BasicDashboard({ profile, userSessions, cs, isAr, addToast, tier }) {
  // Was tierAtLeast(profile?.tier, ...) — self-gating directly off the raw
  // Firestore field bypasses trial-awareness by construction, regardless
  // of what the caller already correctly gated on. This component wasn't
  // even given a tier/effectiveTier prop before, so a trial Basic+ user's
  // caller-side gate (now fixed to use the effective tier) could pass,
  // yet this component would still independently decide "standard" and
  // return null. Falls back to profile?.tier only if no prop is passed,
  // so any other caller that hasn't been updated still behaves as before.
  const isAnyPaid = tierAtLeast(tier ?? profile?.tier ?? "standard", "basic");

  if (!isAnyPaid) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <HabitScoreCard profile={profile} userSessions={userSessions} cs={cs} isAr={isAr} />
      <StreakFreezeButton profile={profile} cs={cs} isAr={isAr} addToast={addToast} />
      <WhatsAppReminder profile={profile} cs={cs} isAr={isAr} addToast={addToast} />
    </div>
  );
}
