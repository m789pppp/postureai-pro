/**
 * ProductTour.jsx — Corvus Phase 15
 * Interactive guided tour: hotspots, tooltips, progress, skip/resume
 */
import { useState, useEffect, useCallback } from "react";

const TOUR_STEPS = [
  {
    id: "analyze",
    title: "Start a Session 📷",
    body: "Click here to open the camera and start analysing your posture in real time. Your score updates every 3 seconds.",
    target: "btn-analyze",
    position: "bottom",
    icon: "📷",
  },
  {
    id: "score",
    title: "Your Posture Score",
    body: "This is your live posture score (0–100). Green = great, yellow = needs attention, red = take a break and stretch.",
    target: "score-display",
    position: "right",
    icon: "📊",
  },
  {
    id: "alerts",
    title: "Smart Alerts 🔔",
    body: "When we detect issues like neck tilt or forward head posture, alerts appear here instantly — no manual checking needed.",
    target: "alerts-panel",
    position: "left",
    icon: "⚠️",
  },
  {
    id: "ai-coach",
    title: "AI Coach 🤖",
    body: "Your personal AI coach gives real-time feedback and personalised tips based on your posture patterns — powered by Corvus AI, running free and local in your browser.",
    target: "ai-coach-btn",
    position: "bottom",
    icon: "🤖",
  },
  {
    id: "analytics",
    title: "Analytics Dashboard",
    body: "Track your progress over days, weeks, and months. See trends, streaks, and detailed breakdowns of each session.",
    target: "analytics-btn",
    position: "bottom",
    icon: "📈",
  },
  {
    id: "team",
    title: "Team Features 👥",
    body: "Invite colleagues, compare scores on the leaderboard, and let your manager view team-wide wellness trends.",
    target: "team-btn",
    position: "bottom",
    icon: "👥",
  },
  {
    id: "notifications",
    title: "Smart Reminders",
    body: "Corvus will nudge you when your posture drifts — and go quiet when you're already sitting well. Zero noise.",
    target: "notifications-btn",
    position: "left",
    icon: "🔔",
  },
  {
    id: "billing",
    title: "Your Plan",
    body: "Manage your subscription, view invoices, and upgrade any time. Usage-based billing means you only pay for what you use.",
    target: "billing-btn",
    position: "left",
    icon: "💳",
  },
  {
    id: "done",
    title: "You're all set! 🎉",
    body: "That's the full tour. Start your first session now — most users see measurable improvement within 2 weeks.",
    target: null,
    position: "center",
    icon: "🎉",
  },
];

// ── Tooltip positioning helper ────────────────────────────────────
function getTooltipStyle(position) {
  const base = {
    position: "fixed",
    zIndex: 9999,
    width: 320,
    background: "linear-gradient(135deg,#1e293b,#0f172a)",
    border: "1px solid rgba(99,102,241,0.4)",
    borderRadius: 16,
    padding: 20,
    boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.15)",
  };
  // For this demo we center everything; in production, calculate from target element
  const centered = { top: "50%", left: "50%", transform: "translate(-50%,-50%)" };
  return { ...base, ...centered };
}

// ── Highlight overlay for target element ──────────────────────────
function Spotlight({ targetId }) {
  const [rect, setRect] = useState(null);
  useEffect(() => {
    if (!targetId) return;
    const el = document.getElementById(targetId);
    if (el) {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top - 8, left: r.left - 8, width: r.width + 16, height: r.height + 16 });
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [targetId]);

  return (
    <>
      {/* Dark overlay */}
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 9990, pointerEvents: "none" }} />
      {/* Cut-out highlight */}
      {rect && (
        <div style={{
          position: "fixed",
          top: rect.top, left: rect.left,
          width: rect.width, height: rect.height,
          borderRadius: 12,
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
          border: "2px solid rgba(99,102,241,0.8)",
          zIndex: 9991,
          pointerEvents: "none",
          animation: "pulse-outline 2s ease infinite",
        }} />
      )}
    </>
  );
}

// ── Main Tour component ────────────────────────────────────────────
export function ProductTour({ onComplete, cs }) {
  const [step,     setStep]   = useState(0);
  const [visible,  setVisible] = useState(true);
  const [minimised,setMin]    = useState(false);

  const current  = TOUR_STEPS[step];
  const isLast   = step === TOUR_STEPS.length - 1;
  const progress = ((step + 1) / TOUR_STEPS.length) * 100;

  const next = useCallback(() => {
    if (isLast) { setVisible(false); onComplete?.(); }
    else setStep(s => s + 1);
  }, [isLast, onComplete]);

  const prev = () => setStep(s => Math.max(0, s - 1));
  const skip = () => { setVisible(false); onComplete?.(); };

  if (!visible) return null;

  if (minimised) {
    return (
      <button
        onClick={() => setMin(false)}
        style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, background: "linear-gradient(135deg,#6366f1,#0ea5e9)", border: "none", color: "#fff", borderRadius: 50, padding: "12px 20px", cursor: "pointer", fontWeight: 700, fontSize: 13, boxShadow: "0 8px 24px rgba(99,102,241,0.4)", display: "flex", alignItems: "center", gap: 8 }}
      >
        🗺 Resume Tour ({step + 1}/{TOUR_STEPS.length})
      </button>
    );
  }

  return (
    <>
      {/* Spotlight */}
      {current.target && <Spotlight targetId={current.target} />}
      {!current.target && <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:9990, pointerEvents:"none" }} />}

      {/* Tooltip */}
      <div style={getTooltipStyle(current.position)}>
        {/* Progress bar */}
        <div style={{ height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2, marginBottom: 16, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg,#6366f1,#0ea5e9)", borderRadius: 2, transition: "width .4s" }} />
        </div>

        {/* Step counter */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", background: "rgba(99,102,241,0.15)", padding: "3px 10px", borderRadius: 20 }}>
            Step {step + 1} of {TOUR_STEPS.length}
          </span>
          <button onClick={() => setMin(true)} style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>—</button>
        </div>

        {/* Content */}
        <div style={{ fontSize: 28, marginBottom: 8 }}>{current.icon}</div>
        <div style={{ fontWeight: 800, fontSize: 17, color: "#f1f5f9", marginBottom: 8 }}>{current.title}</div>
        <p style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.6, margin: "0 0 20px" }}>{current.body}</p>

        {/* Navigation */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {step > 0 && (
            <button onClick={prev} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", borderRadius: 10, padding: "10px 16px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>← Back</button>
          )}
          <button onClick={next} style={{ flex: 1, background: "linear-gradient(135deg,#6366f1,#0ea5e9)", border: "none", color: "#fff", borderRadius: 10, padding: "12px 20px", cursor: "pointer", fontWeight: 800, fontSize: 14 }}>
            {isLast ? "🚀 Start Using Corvus" : "Next →"}
          </button>
          {!isLast && (
            <button onClick={skip} style={{ background: "transparent", border: "none", color: "#475569", cursor: "pointer", fontSize: 12, padding: "10px 8px" }}>Skip</button>
          )}
        </div>

        {/* Dot navigation */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 14 }}>
          {TOUR_STEPS.map((_, i) => (
            <button key={i} onClick={() => setStep(i)} style={{ width: i === step ? 20 : 8, height: 8, borderRadius: 4, border: "none", background: i === step ? "#6366f1" : i < step ? "#0ea5e9" : "rgba(255,255,255,0.1)", cursor: "pointer", transition: "all .2s", padding: 0 }} />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes pulse-outline {
          0%, 100% { box-shadow: 0 0 0 9999px rgba(0,0,0,0.6), 0 0 0 4px rgba(99,102,241,0.6); }
          50%       { box-shadow: 0 0 0 9999px rgba(0,0,0,0.6), 0 0 0 8px rgba(99,102,241,0.3); }
        }
      `}</style>
    </>
  );
}

// ── Tour trigger button (shown to new users) ──────────────────────
export function TourTrigger({ cs, onStart }) {
  return (
    <button
      onClick={onStart}
      id="tour-trigger"
      style={{
        background: "linear-gradient(135deg,rgba(99,102,241,0.15),rgba(14,165,233,0.1))",
        border: "1px solid rgba(99,102,241,0.3)",
        color: "#6366f1",
        borderRadius: 10,
        padding: "8px 16px",
        cursor: "pointer",
        fontWeight: 700,
        fontSize: 13,
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      🗺 Take Product Tour
    </button>
  );
}
