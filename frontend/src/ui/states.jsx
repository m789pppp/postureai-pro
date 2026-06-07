/**
 * PostureAI Pro — Empty / Loading / Error States v1.0
 * Skeleton loaders · Onboarding · Zero-state dashboards · Error states
 */
import { useState, useEffect } from "react";

// ── SKELETON PRIMITIVES ───────────────────────────────────────────
export function SkeletonBox({ w = "100%", h = 14, r = 8, style = {} }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: "linear-gradient(90deg,var(--color-surface-2) 25%,var(--color-surface) 50%,var(--color-surface-2) 75%)",
      backgroundSize: "400% 100%",
      animation: "sk-shimmer 1.8s ease infinite",
      flexShrink: 0,
      ...style,
    }} />
  );
}

export function SkeletonText({ lines = 3, lastWidth = "60%", gap = 8 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap }}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBox key={i} h={12} r={6}
          w={i === lines - 1 ? lastWidth : "100%"}
          style={{ animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  );
}

// ── SKELETON: STAT CARD ───────────────────────────────────────────
export function SkeletonStat() {
  return (
    <div style={{
      background: "var(--color-card)",
      border: "1px solid var(--color-card-border)",
      borderRadius: "var(--radius-lg)",
      padding: "var(--space-4)",
    }}>
      <SkeletonBox h={9} w={60} r={4} style={{ marginBottom: 10 }} />
      <SkeletonBox h={28} w={80} r={6} style={{ marginBottom: 8 }} />
      <SkeletonBox h={9} w={50} r={4} />
    </div>
  );
}

// ── SKELETON: CHART ───────────────────────────────────────────────
export function SkeletonChart({ bars = 7, height = 80 }) {
  return (
    <div style={{
      background: "var(--color-card)",
      border: "1px solid var(--color-card-border)",
      borderRadius: "var(--radius-lg)",
      padding: "var(--space-4)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
        <SkeletonBox h={14} w={100} r={6} />
        <SkeletonBox h={14} w={60} r={99} />
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height }}>
        {Array.from({ length: bars }).map((_, i) => {
          const h = Math.round(30 + Math.random() * 70);
          return (
            <div key={i} style={{ flex: 1, height: "100%", display: "flex", alignItems: "flex-end" }}>
              <SkeletonBox
                h={`${h}%`} r="4px 4px 0 0"
                style={{ width: "100%", animationDelay: `${i * 60}ms` }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── SKELETON: SHORTCUT CARD ───────────────────────────────────────
export function SkeletonShortcut() {
  return (
    <div style={{
      background: "var(--color-card)",
      border: "1px solid var(--color-card-border)",
      borderRadius: "var(--radius-lg)",
      padding: "var(--space-4)",
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <SkeletonBox w={40} h={40} r={11} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        <SkeletonBox h={13} w="70%" r={5} />
        <SkeletonBox h={10} w="50%" r={4} />
      </div>
    </div>
  );
}

// ── SKELETON: GREETING HERO ───────────────────────────────────────
export function SkeletonHero() {
  return (
    <div style={{
      background: "var(--color-card)",
      border: "1px solid var(--color-card-border)",
      borderRadius: "var(--radius-xl)",
      padding: "var(--space-5)",
      marginBottom: "var(--space-3)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          <SkeletonBox h={24} w="75%" r={8} />
          <SkeletonBox h={12} w="55%" r={5} />
          <div style={{ marginTop: 8 }}>
            <SkeletonBox h={5} r={99} />
          </div>
        </div>
        <SkeletonBox w={72} h={72} r="50%" style={{ flexShrink: 0 }} />
      </div>
    </div>
  );
}

// ── SKELETON: TABLE ROW ───────────────────────────────────────────
export function SkeletonTableRows({ rows = 5, cols = 4 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: 12,
          padding: "14px 16px",
          borderBottom: "1px solid var(--color-border)",
          animation: `fadeIn 300ms ${i * 60}ms both`,
        }}>
          {Array.from({ length: cols }).map((_, j) => (
            <SkeletonBox key={j} h={12} r={5}
              w={j === 0 ? "80%" : j === cols - 1 ? "40%" : "65%"}
              style={{ animationDelay: `${i * 60 + j * 30}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── FULL HOME SKELETON ────────────────────────────────────────────
export function HomePageSkeleton() {
  return (
    <div style={{ padding: "var(--space-4)", maxWidth: 500, margin: "0 auto" }}>
      <SkeletonHero />
      {/* Start button */}
      <SkeletonBox h={76} r={18} style={{ marginBottom: "var(--space-3)", animationDelay: "60ms" }} />
      {/* Mode selector */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
        {[0, 1, 2].map(i => <SkeletonBox key={i} h={64} r={12} style={{ animationDelay: `${80 + i * 40}ms` }} />)}
      </div>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
        {[0, 1, 2].map(i => <SkeletonStat key={i} />)}
      </div>
      <SkeletonChart style={{ marginBottom: 12 }} />
      {/* Shortcuts */}
      <SkeletonBox h={14} w={110} r={6} style={{ marginBottom: 10, animationDelay: "200ms" }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {[0, 1, 2, 3].map(i => <SkeletonShortcut key={i} />)}
      </div>
      <style>{`@keyframes sk-shimmer{0%{background-position:100% 0}100%{background-position:-100% 0}}`}</style>
    </div>
  );
}

// ── ZERO STATE: NO SESSIONS YET ──────────────────────────────────
export function ZeroStateSessions({ isAr, onStart }) {
  const [hov, setHov] = useState(false);
  return (
    <div style={{
      background: "var(--color-card)",
      border: "1px solid var(--color-card-border)",
      borderRadius: "var(--radius-xl)",
      padding: "var(--space-8) var(--space-6)",
      textAlign: "center",
      animation: "fadeIn 400ms var(--ease-spring) both",
    }}>
      {/* Animated illustration */}
      <div style={{ position: "relative", width: 80, height: 80, margin: "0 auto var(--space-5)" }}>
        <div style={{
          width: 80, height: 80, borderRadius: "50%",
          background: "rgba(26,86,219,.1)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 36,
          animation: "float 3s ease-in-out infinite",
        }}>🧘</div>
        <div style={{
          position: "absolute", bottom: -4, right: -4,
          width: 28, height: 28, borderRadius: "50%",
          background: "var(--color-surface-2)",
          border: "2px solid var(--color-bg)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14,
        }}>✨</div>
      </div>
      <div style={{
        fontFamily: "var(--font-display)", fontSize: "var(--text-xl)",
        fontWeight: 800, color: "var(--color-text)", letterSpacing: "-0.025em",
        marginBottom: "var(--space-2)",
      }}>
        {isAr ? "ابدأ رحلتك!" : "Start your journey!"}
      </div>
      <div style={{
        fontSize: "var(--text-sm)", color: "var(--color-muted)",
        lineHeight: 1.7, maxWidth: 280, margin: "0 auto var(--space-6)",
      }}>
        {isAr
          ? "لا توجد جلسات بعد. ابدأ أول جلسة لك وتابع وضعيتك يومياً."
          : "No sessions yet. Start your first session to begin tracking your posture daily."}
      </div>
      {/* Steps */}
      <div style={{
        display: "flex", justifyContent: "center", gap: "var(--space-4)",
        marginBottom: "var(--space-6)",
      }}>
        {[
          { icon: "📷", label: isAr ? "ضبط الكاميرا" : "Set up camera" },
          { icon: "🎯", label: isAr ? "ابدأ الجلسة" : "Start session" },
          { icon: "📊", label: isAr ? "تابع تقدمك" : "Track progress" },
        ].map((step, i) => (
          <div key={i} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            animation: `fadeIn 400ms ${i * 100}ms both`,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: "var(--radius-md)",
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-border)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20,
            }}>{step.icon}</div>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--color-muted)", fontWeight: 500 }}>{step.label}</span>
          </div>
        ))}
      </div>
      <button
        onClick={onStart}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          background: "var(--gradient-brand)",
          border: "none", borderRadius: "var(--radius-lg)",
          padding: "14px 32px",
          fontFamily: "var(--font-display)", fontSize: "var(--text-base)",
          fontWeight: 800, color: "#fff", cursor: "pointer",
          boxShadow: hov ? "0 10px 36px rgba(26,86,219,.55)" : "var(--shadow-blue)",
          transform: hov ? "translateY(-2px) scale(1.02)" : "none",
          transition: "all 280ms var(--ease-spring)",
        }}>
        {isAr ? "▶ ابدأ الآن" : "▶ Start Now"}
      </button>
      <style>{`@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}`}</style>
    </div>
  );
}

// ── ZERO STATE: ANALYTICS ─────────────────────────────────────────
export function ZeroStateAnalytics({ isAr, onStart }) {
  return (
    <div style={{
      padding: "var(--space-10) var(--space-6)",
      textAlign: "center",
      animation: "fadeIn 400ms var(--ease-spring) both",
    }}>
      <div style={{ fontSize: 56, marginBottom: "var(--space-4)", animation: "float 4s ease-in-out infinite" }}>📈</div>
      <div style={{
        fontFamily: "var(--font-display)", fontSize: "var(--text-xl)",
        fontWeight: 800, color: "var(--color-text)", marginBottom: "var(--space-2)",
        letterSpacing: "-0.02em",
      }}>
        {isAr ? "لا توجد بيانات بعد" : "No data yet"}
      </div>
      <div style={{
        fontSize: "var(--text-sm)", color: "var(--color-muted)",
        lineHeight: 1.7, maxWidth: 260, margin: "0 auto var(--space-5)",
      }}>
        {isAr
          ? "سجّل 3 جلسات على الأقل لرؤية تحليل وضعيتك ومسار تقدمك."
          : "Complete at least 3 sessions to unlock your posture analytics and progress charts."}
      </div>
      {/* Progress indicator */}
      <div style={{
        background: "var(--color-surface-2)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-4)",
        maxWidth: 240, margin: "0 auto var(--space-5)",
        textAlign: "left",
      }}>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--color-muted)", marginBottom: 8, fontWeight: 600 }}>
          {isAr ? "التقدم" : "Progress"}: 0 / 3
        </div>
        <div style={{ height: 6, borderRadius: 99, background: "var(--color-border)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: "0%", background: "var(--gradient-brand)", borderRadius: 99, transition: "width 600ms" }} />
        </div>
      </div>
      {onStart && (
        <button onClick={onStart} style={{
          background: "var(--gradient-brand)", border: "none",
          borderRadius: "var(--radius-md)", padding: "11px 24px",
          fontSize: "var(--text-sm)", fontWeight: 700, color: "#fff",
          cursor: "pointer", boxShadow: "var(--shadow-blue)",
        }}>
          {isAr ? "ابدأ جلسة →" : "Start a session →"}
        </button>
      )}
      <style>{`@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}`}</style>
    </div>
  );
}

// ── ZERO STATE: LEADERBOARD ───────────────────────────────────────
export function ZeroStateLeaderboard({ isAr }) {
  return (
    <div style={{ padding: "var(--space-10) var(--space-6)", textAlign: "center" }}>
      <div style={{ fontSize: 52, marginBottom: "var(--space-4)" }}>🏆</div>
      <div style={{
        fontFamily: "var(--font-display)", fontSize: "var(--text-lg)",
        fontWeight: 800, color: "var(--color-text)", marginBottom: "var(--space-2)",
      }}>
        {isAr ? "لا يوجد أعضاء بعد" : "No teammates yet"}
      </div>
      <div style={{ fontSize: "var(--text-sm)", color: "var(--color-muted)", lineHeight: 1.7, maxWidth: 240, margin: "0 auto" }}>
        {isAr
          ? "ادعو زملاءك وتنافسوا على أفضل وضعية يومياً."
          : "Invite your teammates to compete for the best posture score daily."}
      </div>
    </div>
  );
}

// ── ONBOARDING: STEP WIZARD ───────────────────────────────────────
export function OnboardingSteps({ steps, currentStep, isAr }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 0,
      marginBottom: "var(--space-6)",
    }}>
      {steps.map((step, i) => {
        const done    = i < currentStep;
        const active  = i === currentStep;
        const pending = i > currentStep;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : 0 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                background: done ? "var(--color-success)" : active ? "var(--gradient-brand)" : "var(--color-surface-2)",
                border: `2px solid ${done ? "var(--color-success)" : active ? "var(--color-accent)" : "var(--color-border)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: done ? 16 : 13, fontWeight: 700,
                color: done || active ? "#fff" : "var(--color-muted)",
                transition: "all 300ms var(--ease-spring)",
                boxShadow: active ? "0 0 0 4px rgba(26,86,219,.18)" : "none",
              }}>
                {done ? "✓" : i + 1}
              </div>
              <span style={{
                fontSize: "var(--text-2xs)", fontWeight: 600,
                color: active ? "var(--color-accent)" : done ? "var(--color-success)" : "var(--color-muted)",
                whiteSpace: "nowrap",
              }}>{step}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                flex: 1, height: 2, margin: "0 6px", marginBottom: 24,
                background: done ? "var(--color-success)" : "var(--color-border)",
                transition: "background 400ms",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── ONBOARDING: WELCOME CARD ──────────────────────────────────────
export function OnboardingWelcome({ profile, isAr, onNext }) {
  const firstName = (profile?.name || "").split(" ")[0] || (isAr ? "صديقي" : "there");
  return (
    <div style={{
      background: "var(--gradient-hero)",
      border: "1px solid rgba(26,86,219,.2)",
      borderRadius: "var(--radius-2xl)",
      padding: "var(--space-8) var(--space-6)",
      textAlign: "center",
      animation: "scaleIn 400ms var(--ease-spring) both",
    }}>
      <div style={{ fontSize: 64, marginBottom: "var(--space-4)", animation: "float 3s ease-in-out infinite" }}>👋</div>
      <div style={{
        fontFamily: "var(--font-display)", fontSize: "var(--text-3xl)",
        fontWeight: 800, color: "var(--color-text)", letterSpacing: "-0.03em",
        marginBottom: "var(--space-3)",
      }}>
        {isAr ? `أهلاً ${firstName}!` : `Welcome, ${firstName}!`}
      </div>
      <div style={{
        fontSize: "var(--text-base)", color: "var(--color-text-2)",
        lineHeight: 1.7, maxWidth: 300, margin: "0 auto var(--space-6)",
      }}>
        {isAr
          ? "PostureAI Pro جاهز يساعدك تحسّن وضعيتك وتحمي ظهرك. خلينا نبدأ بخطوات بسيطة."
          : "PostureAI Pro is ready to help you improve your posture and protect your back. Let's get started."}
      </div>
      {/* Feature pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: "var(--space-6)" }}>
        {(isAr
          ? ["🤖 تحليل AI", "📊 تقارير يومية", "🏆 تحديات", "💡 نصائح مخصصة"]
          : ["🤖 AI Analysis", "📊 Daily Reports", "🏆 Challenges", "💡 Personal Tips"]
        ).map((f, i) => (
          <span key={i} style={{
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-border-2)",
            borderRadius: "var(--radius-full)",
            padding: "5px 13px", fontSize: "var(--text-xs)", fontWeight: 600,
            color: "var(--color-text-2)",
            animation: `fadeIn 300ms ${i * 80}ms both`,
          }}>{f}</span>
        ))}
      </div>
      <button onClick={onNext} style={{
        background: "var(--gradient-brand)", border: "none",
        borderRadius: "var(--radius-lg)", padding: "14px 36px",
        fontFamily: "var(--font-display)", fontSize: "var(--text-base)",
        fontWeight: 800, color: "#fff", cursor: "pointer",
        boxShadow: "var(--shadow-blue)",
        transition: "all 280ms var(--ease-spring)",
      }}>
        {isAr ? "هيا نبدأ ←" : "Let's go →"}
      </button>
      <style>{`@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}`}</style>
    </div>
  );
}

// ── ERROR STATE: NETWORK ──────────────────────────────────────────
export function ErrorNetwork({ isAr, onRetry, loading = false }) {
  return (
    <div style={{
      background: "var(--color-card)",
      border: "1px solid rgba(239,68,68,.18)",
      borderRadius: "var(--radius-xl)",
      padding: "var(--space-8) var(--space-6)",
      textAlign: "center",
      animation: "fadeIn 300ms both",
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: "50%",
        background: "rgba(239,68,68,.1)",
        border: "1px solid rgba(239,68,68,.2)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 28, margin: "0 auto var(--space-4)",
      }}>⚡</div>
      <div style={{
        fontFamily: "var(--font-display)", fontSize: "var(--text-lg)",
        fontWeight: 800, color: "var(--color-text)", marginBottom: "var(--space-2)",
      }}>
        {isAr ? "خطأ في الاتصال" : "Connection Error"}
      </div>
      <div style={{
        fontSize: "var(--text-sm)", color: "var(--color-muted)",
        lineHeight: 1.7, maxWidth: 260, margin: "0 auto var(--space-5)",
      }}>
        {isAr
          ? "تعذّر الاتصال بالخادم. تحقق من اتصال الإنترنت وحاول مجدداً."
          : "Couldn't reach the server. Check your internet connection and try again."}
      </div>
      <button onClick={onRetry} disabled={loading} style={{
        background: loading ? "var(--color-surface-2)" : "var(--gradient-brand)",
        border: "none", borderRadius: "var(--radius-md)",
        padding: "11px 24px", fontSize: "var(--text-sm)", fontWeight: 700,
        color: loading ? "var(--color-muted)" : "#fff",
        cursor: loading ? "not-allowed" : "pointer",
        transition: "all 200ms",
        display: "inline-flex", alignItems: "center", gap: 8,
      }}>
        {loading
          ? <><span style={{ animation: "spin 750ms linear infinite", display: "inline-block" }}>⟳</span> {isAr ? "جاري إعادة المحاولة..." : "Retrying..."}</>
          : (isAr ? "⟳ حاول مجدداً" : "⟳ Try Again")}
      </button>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── ERROR STATE: PERMISSION ───────────────────────────────────────
export function ErrorPermission({ isAr, resource = "camera", onFix }) {
  const label = resource === "camera"
    ? (isAr ? "الكاميرا" : "camera")
    : (isAr ? "الميكروفون" : "microphone");
  return (
    <div style={{
      background: "rgba(245,158,11,.06)",
      border: "1px solid rgba(245,158,11,.2)",
      borderRadius: "var(--radius-xl)",
      padding: "var(--space-6)",
      textAlign: "center",
    }}>
      <div style={{ fontSize: 40, marginBottom: "var(--space-3)" }}>🔒</div>
      <div style={{
        fontFamily: "var(--font-display)", fontSize: "var(--text-base)",
        fontWeight: 700, color: "var(--color-text)", marginBottom: "var(--space-2)",
      }}>
        {isAr ? `إذن ${label} مطلوب` : `${label.charAt(0).toUpperCase() + label.slice(1)} permission needed`}
      </div>
      <div style={{
        fontSize: "var(--text-sm)", color: "var(--color-muted)",
        lineHeight: 1.65, maxWidth: 240, margin: "0 auto var(--space-4)",
      }}>
        {isAr
          ? `يحتاج التطبيق إذن الوصول إلى ${label} ليعمل بشكل صحيح.`
          : `The app needs access to your ${label} to analyze your posture.`}
      </div>
      <button onClick={onFix} style={{
        background: "rgba(245,158,11,.12)",
        border: "1px solid rgba(245,158,11,.25)",
        borderRadius: "var(--radius-md)", padding: "10px 20px",
        fontSize: "var(--text-sm)", fontWeight: 700,
        color: "var(--color-warning)", cursor: "pointer",
      }}>
        {isAr ? "إصلاح الإعدادات" : "Fix Settings"}
      </button>
    </div>
  );
}

// ── LOADING: FULL PAGE SPINNER ────────────────────────────────────
export function PageLoader({ isAr }) {
  return (
    <div style={{
      minHeight: "60vh",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: "var(--space-4)",
      animation: "fadeIn 200ms both",
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: "50%",
        border: "3px solid var(--color-surface-2)",
        borderTop: "3px solid var(--color-accent)",
        animation: "spin 750ms linear infinite",
      }} />
      <div style={{ fontSize: "var(--text-sm)", color: "var(--color-muted)", fontWeight: 500 }}>
        {isAr ? "جاري التحميل..." : "Loading..."}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── INLINE LOADER: DATA ROW ───────────────────────────────────────
export function InlineLoader({ label, isAr }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "var(--space-3)", color: "var(--color-muted)",
      fontSize: "var(--text-sm)",
    }}>
      <div style={{
        width: 16, height: 16, borderRadius: "50%",
        border: "2px solid var(--color-surface-2)",
        borderTop: "2px solid var(--color-accent)",
        animation: "spin 750ms linear infinite", flexShrink: 0,
      }} />
      {label || (isAr ? "جاري التحميل..." : "Loading...")}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
