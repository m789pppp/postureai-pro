/**
 * Corvus — Micro-interactions & Animations v1.0
 * Transitions · Hover states · Success animations · Confetti achievements
 */
import { useState, useEffect, useRef, useCallback } from "react";

// ── CONFETTI ENGINE ───────────────────────────────────────────────
function randomBetween(a, b) { return a + Math.random() * (b - a); }

const CONFETTI_COLORS = [
  "#1a56db", "#0891b2", "#10b981", "#f59e0b",
  "#8b5cf6", "#ec4899", "#ef4444", "#60a5fa",
];

function spawnParticle(canvas) {
  return {
    x: randomBetween(canvas.width * 0.2, canvas.width * 0.8),
    y: randomBetween(-20, -60),
    vx: randomBetween(-3, 3),
    vy: randomBetween(2, 6),
    rotation: randomBetween(0, 360),
    rotationSpeed: randomBetween(-8, 8),
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    w: randomBetween(6, 14),
    h: randomBetween(4, 9),
    shape: Math.random() > 0.5 ? "rect" : "circle",
    opacity: 1,
    gravity: randomBetween(0.08, 0.18),
  };
}

export function ConfettiCanvas({ active, onDone }) {
  const canvasRef = useRef(null);
  const frameRef  = useRef(null);
  const particles = useRef([]);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Spawn burst
    for (let i = 0; i < 90; i++) {
      particles.current.push(spawnParticle(canvas));
    }

    let done = false;
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.current.forEach(p => {
        p.vy += p.gravity;
        p.x  += p.vx;
        p.y  += p.vy;
        p.rotation += p.rotationSpeed;
        if (p.y > canvas.height * 0.7) p.opacity = Math.max(0, p.opacity - 0.025);
        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        if (p.shape === "circle") {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        ctx.restore();
      });
      particles.current = particles.current.filter(p => p.opacity > 0 && p.y < canvas.height + 40);
      if (particles.current.length === 0 && !done) {
        done = true;
        onDone?.();
        return;
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frameRef.current); particles.current = []; };
  }, [active]);

  return (
    <canvas ref={canvasRef} style={{
      position: "fixed", inset: 0, width: "100%", height: "100%",
      pointerEvents: "none", zIndex: 9000,
    }} />
  );
}

// ── ACHIEVEMENT TOAST ─────────────────────────────────────────────
export function AchievementToast({ show, title, desc, icon = "🏆", onClose, isAr }) {
  const [visible, setVisible] = useState(false);
  const [confetti, setConfetti] = useState(false);

  useEffect(() => {
    if (!show) { setVisible(false); setConfetti(false); return; }
    setVisible(true);
    setConfetti(true);
    const t = setTimeout(() => { setVisible(false); setConfetti(false); onClose?.(); }, 4500);
    return () => clearTimeout(t);
  }, [show]);

  return (
    <>
      <ConfettiCanvas active={confetti} onDone={() => setConfetti(false)} />
      {visible && (
        <div style={{
          position: "fixed", top: 80, left: "50%",
          transform: "translateX(-50%)",
          zIndex: 8999, pointerEvents: "none",
          animation: "achieveIn 500ms var(--ease-spring) both",
          width: "min(340px, 90vw)",
        }}>
          <div style={{
            background: "linear-gradient(135deg,#0f1e36,#162340)",
            border: "1px solid rgba(26,86,219,.4)",
            borderRadius: "var(--radius-xl)",
            padding: "var(--space-5)",
            boxShadow: "0 20px 60px rgba(0,0,0,.5), 0 0 0 1px rgba(26,86,219,.2)",
            display: "flex", alignItems: "center", gap: 14, direction: isAr ? "rtl" : "ltr",
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: "var(--radius-md)",
              background: "linear-gradient(135deg,rgba(26,86,219,.3),rgba(8,145,178,.2))",
              border: "1px solid rgba(26,86,219,.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 26, flexShrink: 0,
              animation: "bounce 600ms var(--ease-spring) 200ms both",
            }}>{icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: "var(--text-2xs)", fontWeight: 700,
                letterSpacing: "0.08em", textTransform: "uppercase",
                color: "var(--color-accent)", marginBottom: 3,
              }}>
                {isAr ? "🎉 إنجاز جديد!" : "🎉 Achievement Unlocked!"}
              </div>
              <div style={{
                fontFamily: "var(--font-display)", fontSize: "var(--text-base)",
                fontWeight: 800, color: "var(--color-text)", letterSpacing: "-0.02em",
              }}>{title}</div>
              {desc && (
                <div style={{ fontSize: "var(--text-xs)", color: "var(--color-muted)", marginTop: 3 }}>{desc}</div>
              )}
            </div>
          </div>
          <style>{`
            @keyframes achieveIn {
              0%   { opacity:0; transform:translateX(-50%) translateY(-20px) scale(.9); }
              60%  { transform:translateX(-50%) translateY(4px) scale(1.02); }
              100% { opacity:1; transform:translateX(-50%) translateY(0) scale(1); }
            }
            @keyframes bounce {
              0%   { transform:scale(0) rotate(-15deg); }
              60%  { transform:scale(1.2) rotate(5deg); }
              100% { transform:scale(1) rotate(0deg); }
            }
          `}</style>
        </div>
      )}
    </>
  );
}

// ── RIPPLE BUTTON ─────────────────────────────────────────────────
export function RippleBtn({ children, onClick, style = {}, className = "" }) {
  const [ripples, setRipples] = useState([]);
  const btnRef = useRef(null);

  const addRipple = (e) => {
    const btn  = btnRef.current;
    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();
    setRipples(r => [...r, { x, y, id }]);
    setTimeout(() => setRipples(r => r.filter(rp => rp.id !== id)), 620);
    onClick?.(e);
  };

  return (
    <button ref={btnRef} onClick={addRipple}
      className={className}
      style={{ position: "relative", overflow: "hidden", ...style }}>
      {children}
      {ripples.map(r => (
        <span key={r.id} style={{
          position: "absolute",
          left: r.x - 40, top: r.y - 40,
          width: 80, height: 80, borderRadius: "50%",
          background: "rgba(255,255,255,.25)",
          animation: "ripple 600ms ease-out forwards",
          pointerEvents: "none",
        }} />
      ))}
      <style>{`@keyframes ripple{from{transform:scale(0);opacity:1}to{transform:scale(4);opacity:0}}`}</style>
    </button>
  );
}

// ── SUCCESS CHECKMARK ─────────────────────────────────────────────
export function SuccessCheck({ show, size = 64, message, isAr }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: "var(--space-3)",
      opacity: show ? 1 : 0,
      transform: show ? "scale(1)" : "scale(0.8)",
      transition: "all 400ms var(--ease-spring)",
    }}>
      <svg width={size} height={size} viewBox="0 0 64 64">
        <circle
          cx="32" cy="32" r="28"
          fill="none"
          stroke="rgba(16,185,129,.15)"
          strokeWidth="4"
        />
        <circle
          cx="32" cy="32" r="28"
          fill="none"
          stroke="#10b981"
          strokeWidth="4"
          strokeDasharray="175.9"
          strokeDashoffset={show ? "0" : "175.9"}
          strokeLinecap="round"
          style={{
            transition: "stroke-dashoffset 600ms var(--ease-spring)",
            transformOrigin: "center",
            transform: "rotate(-90deg)",
          }}
        />
        <path
          d="M20 32 L28 40 L44 24"
          fill="none"
          stroke="#10b981"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="30"
          strokeDashoffset={show ? "0" : "30"}
          style={{ transition: "stroke-dashoffset 400ms 300ms var(--ease-spring)" }}
        />
      </svg>
      {message && (
        <div style={{
          fontFamily: "var(--font-display)", fontSize: "var(--text-base)",
          fontWeight: 700, color: "var(--color-success)",
          opacity: show ? 1 : 0,
          transform: show ? "translateY(0)" : "translateY(6px)",
          transition: "all 400ms 200ms var(--ease-spring)",
        }}>{message}</div>
      )}
    </div>
  );
}

// ── ANIMATED COUNTER ──────────────────────────────────────────────
export function AnimatedNumber({ value, duration = 800, suffix = "", prefix = "", style = {} }) {
  const [displayed, setDisplayed] = useState(0);
  const start = useRef(null);
  const prev  = useRef(0);

  useEffect(() => {
    const from = prev.current;
    const to   = Number(value) || 0;
    prev.current = to;
    if (from === to) return;

    const startTime = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
      setDisplayed(Math.round(from + (to - from) * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value, duration]);

  return (
    <span style={style}>{prefix}{displayed}{suffix}</span>
  );
}

// ── SCORE PULSE ───────────────────────────────────────────────────
export function ScorePulse({ score, prevScore, children }) {
  const [pulse, setPulse] = useState(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (score > prevScore) setPulse("up");
    else if (score < prevScore) setPulse("down");
    const t = setTimeout(() => setPulse(null), 900);
    return () => clearTimeout(t);
  }, [score]);

  return (
    <div style={{
      transition: "transform 300ms var(--ease-spring)",
      transform: pulse === "up" ? "scale(1.08)" : pulse === "down" ? "scale(0.94)" : "scale(1)",
      filter: pulse === "up" ? "drop-shadow(0 0 12px rgba(16,185,129,.6))" : "none",
    }}>
      {children}
    </div>
  );
}

// ── HOVER CARD ────────────────────────────────────────────────────
export function HoverCard({ children, onClick, style = {} }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        cursor: onClick ? "pointer" : "default",
        transition: "all 260ms var(--ease-spring)",
        transform: hov ? "translateY(-3px)" : "none",
        boxShadow: hov ? "var(--shadow-lg)" : "none",
        ...style,
      }}>
      {children}
    </div>
  );
}

// ── STREAK FLAME ──────────────────────────────────────────────────
export function StreakFlame({ count, isAr }) {
  const [animate, setAnimate] = useState(false);
  useEffect(() => { setAnimate(true); const t = setTimeout(() => setAnimate(false), 800); return () => clearTimeout(t); }, [count]);
  if (!count) return null;
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      animation: animate ? "streakPop 800ms var(--ease-spring)" : "none",
    }}>
      <span style={{
        fontSize: count >= 7 ? 22 : 18,
        filter: `drop-shadow(0 2px 8px rgba(245,158,11,${Math.min(count / 10, 0.8)}))`,
        animation: "flicker 1.5s ease-in-out infinite",
      }}>🔥</span>
      <span style={{
        fontFamily: "var(--font-display)", fontSize: "var(--text-xl)",
        fontWeight: 800, color: "var(--amber-400)", letterSpacing: "-0.03em",
      }}>{count}</span>
      {count >= 7 && (
        <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--amber-400)", opacity: 0.8 }}>
          {isAr ? "🔥 متحرق!" : "🔥 On fire!"}
        </span>
      )}
      <style>{`
        @keyframes streakPop {
          0%   { transform:scale(1); }
          40%  { transform:scale(1.2) rotate(-5deg); }
          100% { transform:scale(1) rotate(0); }
        }
        @keyframes flicker {
          0%,100% { transform:scaleY(1); }
          50%     { transform:scaleY(1.05) scaleX(.97); }
        }
      `}</style>
    </div>
  );
}

// ── SCORE REVEAL ──────────────────────────────────────────────────
export function ScoreReveal({ score, show, isAr }) {
  const [revealed, setRevealed] = useState(false);
  const [num, setNum] = useState(0);

  useEffect(() => {
    if (!show) return;
    let frame = 0;
    const total = 60;
    const tick = () => {
      frame++;
      const progress = frame / total;
      const eased = 1 - Math.pow(1 - progress, 2);
      setNum(Math.round(eased * score));
      if (frame < total) requestAnimationFrame(tick);
      else setRevealed(true);
    };
    setTimeout(() => requestAnimationFrame(tick), 300);
  }, [show, score]);

  const color = score >= 75 ? "var(--color-success)" : score >= 50 ? "var(--color-warning)" : "var(--color-danger)";

  return (
    <div style={{
      textAlign: "center",
      animation: show ? "scaleIn 500ms var(--ease-spring)" : "none",
    }}>
      <div style={{
        fontFamily: "var(--font-display)", fontSize: "var(--text-4xl)",
        fontWeight: 800, color, lineHeight: 1, letterSpacing: "-0.04em",
        filter: `drop-shadow(0 4px 20px ${color}88)`,
      }}>{num}</div>
      <div style={{ fontSize: "var(--text-sm)", color: "var(--color-muted)", marginTop: 4, fontWeight: 500 }}>/100</div>
      {revealed && (
        <div style={{
          marginTop: 8,
          fontFamily: "var(--font-display)", fontSize: "var(--text-lg)",
          fontWeight: 700, color,
          animation: "fadeIn 400ms 100ms both",
        }}>
          {score >= 85 ? (isAr ? "ممتاز 💪" : "Excellent 💪")
           : score >= 70 ? (isAr ? "جيد 👍" : "Good 👍")
           : score >= 50 ? (isAr ? "مقبول — حاول تحسين وضعيتك" : "Fair — try adjusting your posture")
           : (isAr ? "يحتاج تحسين ⚠️" : "Needs improvement ⚠️")}
        </div>
      )}
    </div>
  );
}

// ── TRANSITION PAGE ───────────────────────────────────────────────
export function PageTransition({ children, id }) {
  return (
    <div key={id} style={{ animation: "pageIn 300ms var(--ease-spring) both" }}>
      {children}
      <style>{`@keyframes pageIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}

// ── SWIPE INDICATOR ───────────────────────────────────────────────
export function SwipeHint({ isAr }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      padding: "var(--space-3)",
      fontSize: "var(--text-xs)", color: "var(--color-muted)", fontWeight: 500,
      animation: "fadeIn 600ms 800ms both",
    }}>
      <span style={{ animation: "swipeAnim 1.5s ease-in-out infinite" }}>
        {isAr ? "→" : "←"}
      </span>
      {isAr ? "اسحب للتنقل" : "Swipe to navigate"}
      <span style={{ animation: "swipeAnim 1.5s ease-in-out infinite 0.3s" }}>
        {isAr ? "←" : "→"}
      </span>
      <style>{`@keyframes swipeAnim{0%,100%{opacity:.4;transform:translateX(0)}50%{opacity:1;transform:translateX(3px)}}`}</style>
    </div>
  );
}

// ── PULSE DOT (live indicator) ────────────────────────────────────
export function LiveDot({ color = "#10b981", size = 8 }) {
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: "50%",
        background: color, position: "absolute",
      }} />
      <div style={{
        width: size, height: size, borderRadius: "50%",
        background: color, position: "absolute",
        animation: "livePulse 1.8s ease-out infinite",
      }} />
      <style>{`@keyframes livePulse{0%{transform:scale(1);opacity:.8}100%{transform:scale(3);opacity:0}}`}</style>
    </div>
  );
}

// ── TOAST HOOK ────────────────────────────────────────────────────
export function useToast() {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((msg, type = "info", duration = 3500) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, msg, text: msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), duration);
  }, []);
  const dismiss = useCallback(id => setToasts(t => t.filter(x => x.id !== id)), []);
  return { toasts, toast: push, dismiss };
}

// ── ACHIEVEMENT HOOK ──────────────────────────────────────────────
export function useAchievement() {
  const [achievement, setAchievement] = useState(null);
  const [show, setShow] = useState(false);

  const fire = useCallback(({ title, desc, icon }) => {
    setAchievement({ title, desc, icon });
    setShow(true);
  }, []);

  const dismiss = useCallback(() => {
    setShow(false);
    setTimeout(() => setAchievement(null), 600);
  }, []);

  return { achievement, show, fire, dismiss };
}
