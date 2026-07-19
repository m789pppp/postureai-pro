import { useState, useEffect, useRef, useCallback } from "react";

// ── Score Smoothing ───────────────────────────────────────────────
/**
 * useScoreSmoothing — time-windowed, time-weighted average
 *
 * Previously this was a *sample-count* window (e.g. 5 samples), which
 * at a ~60fps analysis loop is under 100ms of real time — nowhere
 * near long enough to avoid a 1-second head turn visibly yanking the
 * displayed score. This version drops anything older than `windowMs`
 * and weights what's left by actual elapsed time (not array position,
 * so it's correct regardless of frame rate / dropped frames), giving
 * a genuinely ~10-second representative average.
 *
 * Returns { smoothed, push, reset }
 */
/**
 * useScoreSmoothing — time-windowed, time-weighted average
 *
 * Fixes applied:
 * - windowMs: 10s → 20s  (wider window = less frame-to-frame jitter)
 * - halfLifeMs: 6s → 12s (slower decay = recent scores don't dominate)
 * - sampleIntervalMs: 200ms → 500ms (2 samples/sec instead of 5 — each
 *   sample is already the postureEngine's trimmedMean over 60 frames,
 *   so more samples just add noise, not accuracy)
 * - Jump guard: displayed score can only change ±3 pts per sample,
 *   so a single bad frame can never move the UI by 10+ points.
 */
export function useScoreSmoothing(
  windowMs        = 20000,
  halfLifeMs      = 12000,
  sampleIntervalMs = 500,
) {
  const bufferRef     = useRef([]);
  const lastSampleRef = useRef(0);
  const displayRef    = useRef(0);
  const [display, setDisplay] = useState(0);

  const push = useCallback((rawScore) => {
    if (rawScore == null || rawScore < 0) return displayRef.current;
    const now = Date.now();

    if (now - lastSampleRef.current < sampleIntervalMs) return displayRef.current;
    lastSampleRef.current = now;

    const buf = bufferRef.current;
    buf.push({ t: now, v: rawScore });
    while (buf.length && now - buf[0].t > windowMs) buf.shift();

    let wSum = 0, vSum = 0;
    for (const s of buf) {
      const w = Math.pow(0.5, (now - s.t) / halfLifeMs);
      wSum += w; vSum += w * s.v;
    }
    const target = wSum > 0 ? Math.round(vSum / wSum) : Math.round(rawScore);

    // Jump guard: cap per-sample display change at ±3 pts
    const prev = displayRef.current;
    const next = prev === 0 ? target : Math.max(prev - 3, Math.min(prev + 3, target));
    displayRef.current = next;
    setDisplay(next);
    return next;
  }, [windowMs, halfLifeMs, sampleIntervalMs]);

  const reset = useCallback(() => {
    bufferRef.current     = [];
    lastSampleRef.current = 0;
    displayRef.current    = 0;
    setDisplay(0);
  }, []);

  return { smoothed: display, push, reset };
}

// ── Break Timer ───────────────────────────────────────────────────
const BREAK_EXERCISES = [
  { icon: "🔄", name: "Neck Rolls",      desc: "Slowly roll your head in a full circle, 5 times each direction.", duration: 30 },
  { icon: "💪", name: "Shoulder Shrugs", desc: "Lift both shoulders to your ears, hold 3s, release. Repeat 10x.",  duration: 20 },
  { icon: "🙆", name: "Arms Overhead",   desc: "Interlace fingers, stretch arms above head, hold 15s.",            duration: 15 },
  { icon: "👀", name: "20-20-20 Eyes",   desc: "Look at something 20 feet away for 20 seconds.",                   duration: 20 },
  { icon: "🧘", name: "Deep Breathing",  desc: "Inhale 4s, hold 4s, exhale 6s. Repeat 3 times.",                  duration: 42 },
];

export function BreakTimer({ onDismiss, onComplete, cs, lang = "en", intervalMin = 30 }) {
  const [exerciseIdx, setExerciseIdx] = useState(0);
  const [exTimer, setExTimer]         = useState(0);
  const [running, setRunning]         = useState(false);
  const [done, setDone]               = useState(false);
  const timerRef = useRef(null);

  const DARK = cs || { card: "#05101f", border: "rgba(148,163,184,.1)", text: "#f0f4f8", muted: "#64748b" };
  const ex = BREAK_EXERCISES[exerciseIdx];

  const T = { en: { title: "Time for a Break! 🧘", sub: `You've been working for ${intervalMin} minutes`, next: "Next exercise →", skip: "Skip break", done: "Break complete! 🎉", doneSub: "Great job! Your body thanks you.", finish: "Back to work →", start: "Start exercise", rest: "seconds remaining" },
               ar: { title: "وقت الاستراحة! 🧘", sub: `مضت ${intervalMin} دقيقة من العمل`, next: "التمرين التالي →", skip: "تخطي الاستراحة", done: "انتهت الاستراحة! 🎉", doneSub: "عمل رائع! جسمك شاكرك.", finish: "العودة للعمل →", start: "بدء التمرين", rest: "ثانية متبقية" } };
  const t = T[lang] || T.en;

  const startExercise = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setExTimer(ex.duration);
    setRunning(true);
    timerRef.current = setInterval(() => {
      setExTimer(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [ex.duration]);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const nextExercise = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setRunning(false);
    if (exerciseIdx < BREAK_EXERCISES.length - 1) {
      setExerciseIdx(i => i + 1);
      setExTimer(0);
    } else {
      setDone(true);
      onComplete?.();
    }
  };

  const progressPct = ex.duration > 0 ? Math.round(((ex.duration - exTimer) / ex.duration) * 100) : 0;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9100, backdropFilter: "blur(8px)" }}>
      <div style={{ background: DARK.card, border: `0.5px solid ${DARK.border}`, borderRadius: 20, padding: "28px 24px", maxWidth: 400, width: "92%", textAlign: "center" }}>

        {done ? (
          <>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: DARK.text, marginBottom: 6 }}>{t.done}</div>
            <div style={{ fontSize: 12, color: DARK.muted, marginBottom: 24 }}>{t.doneSub}</div>
            <button onClick={onDismiss} style={{ background: "#1a56db", border: "none", borderRadius: 9, padding: "12px 32px", fontSize: 13, fontWeight: 600, color: "white", cursor: "pointer" }}>{t.finish}</button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1a56db", marginBottom: 4 }}>{t.title}</div>
            <div style={{ fontSize: 11, color: DARK.muted, marginBottom: 20 }}>{t.sub}</div>

            {/* Exercise progress dots */}
            <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 20 }}>
              {BREAK_EXERCISES.map((_, i) => (
                <div key={i} style={{ width: i === exerciseIdx ? 20 : 7, height: 7, borderRadius: 99, background: i < exerciseIdx ? "#10b981" : i === exerciseIdx ? "#1a56db" : "rgba(148,163,184,.2)", transition: "all .3s" }} />
              ))}
            </div>

            <div style={{ background: "rgba(26,86,219,.06)", border: "0.5px solid rgba(26,86,219,.15)", borderRadius: 14, padding: 20, marginBottom: 18 }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>{ex.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: DARK.text, marginBottom: 6 }}>{ex.name}</div>
              <div style={{ fontSize: 12, color: DARK.muted, lineHeight: 1.6 }}>{ex.desc}</div>

              {running && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#1a56db", lineHeight: 1 }}>{exTimer}</div>
                  <div style={{ fontSize: 10, color: DARK.muted, marginBottom: 8 }}>{t.rest}</div>
                  <div style={{ background: "rgba(148,163,184,.1)", borderRadius: 99, height: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 99, width: `${progressPct}%`, background: "#1a56db", transition: "width 1s linear" }} />
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              {!running && exTimer === 0 && (
                <button onClick={startExercise} style={{ flex: 2, background: "#1a56db", border: "none", borderRadius: 9, padding: "11px 0", fontSize: 13, fontWeight: 600, color: "white", cursor: "pointer" }}>{t.start}</button>
              )}
              <button onClick={nextExercise} style={{ flex: running ? 1 : 1, background: "none", border: `0.5px solid ${DARK.border}`, borderRadius: 9, padding: "11px 0", fontSize: 12, color: DARK.muted, cursor: "pointer" }}>
                {exerciseIdx < BREAK_EXERCISES.length - 1 ? t.next : "Finish →"}
              </button>
            </div>
            <button onClick={onDismiss} style={{ width: "100%", marginTop: 8, background: "none", border: "none", fontSize: 11, color: DARK.muted, cursor: "pointer", padding: 4 }}>{t.skip}</button>
          </>
        )}
      </div>
    </div>
  );
}

// ── useBreakTimer hook ────────────────────────────────────────────
export function useBreakTimer(intervalMin = 30, enabled = true) {
  const [showBreak, setShowBreak] = useState(false);
  const [snoozeCount, setSnoozeCount] = useState(0);
  const timerRef = useRef(null);
  const lastBreakRef = useRef(Date.now());

  const scheduleNext = useCallback((extraMs = 0) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const ms = intervalMin * 60 * 1000 + extraMs;
    timerRef.current = setTimeout(() => {
      if (enabled) setShowBreak(true);
    }, ms);
  }, [intervalMin, enabled]);

  useEffect(() => {
    if (enabled) scheduleNext();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [enabled, scheduleNext]);

  const dismiss = useCallback(() => {
    setShowBreak(false);
    lastBreakRef.current = Date.now();
    scheduleNext();
  }, [scheduleNext]);

  const snooze = useCallback((min = 5) => {
    setShowBreak(false);
    setSnoozeCount(c => c + 1);
    scheduleNext(min * 60 * 1000);
  }, [scheduleNext]);

  return { showBreak, dismiss, snooze, snoozeCount };
}

// ── Sound Feedback ────────────────────────────────────────────────
let lastBeepTime = 0;
const BEEP_COOLDOWN_MS = 45000; // 45 seconds

export function playPostureAlert(volume = 0.2) {
  const now = Date.now();
  if (now - lastBeepTime < BEEP_COOLDOWN_MS) return;
  lastBeepTime = now;
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    // Two-tone gentle alert
    [[440, 0, 0.08], [360, 0.32, 0.28]].forEach(([freq, delay, stop]) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain); gain.connect(ac.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ac.currentTime + delay);
      gain.gain.linearRampToValueAtTime(volume, ac.currentTime + delay + 0.06);
      gain.gain.linearRampToValueAtTime(0, ac.currentTime + delay + 0.28);
      osc.start(ac.currentTime + delay);
      osc.stop(ac.currentTime + delay + stop + 0.05);
    });
  } catch {}
}

export function playSuccessChime() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    [523, 659, 784].forEach((freq, i) => {
      const osc = ac.createOscillator(); const gain = ac.createGain();
      osc.connect(gain); gain.connect(ac.destination);
      osc.frequency.value = freq;
      const t = ac.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.12, t + 0.04);
      gain.gain.linearRampToValueAtTime(0, t + 0.22);
      osc.start(t); osc.stop(t + 0.25);
    });
  } catch {}
}

// ── useSoundFeedback hook ─────────────────────────────────────────
export function useSoundFeedback(muted = false) {
  const alertIfNeeded = useCallback((score) => {
    if (muted) return;
    if (score < 60) playPostureAlert();
  }, [muted]);

  return { alertIfNeeded, playSuccessChime: muted ? () => {} : playSuccessChime };
}

// ── usePainPrediction hook ──────────────────────────────────────────
/**
 * Real-time predictive discomfort model.
 *
 * BACKSTORY: App.jsx already reads `la.pain_prediction?.minutes_to_pain`
 * and shows a "⚠️ Discomfort in ~N min" warning during live sessions —
 * but nothing ever computed that field, so it was always null and the
 * warning never fired. This hook is the actual computation.
 *
 * MODEL (heuristic, not a clinical/validated prediction — framed as an
 * estimate in the UI, same spirit as the "not a medical diagnosis"
 * disclaimers already used elsewhere in the app):
 *
 * Cumulative strain accumulates over time, faster the worse the current
 * posture score is below a "safe" threshold (65/100 — matches the
 * existing alert threshold in useSoundFeedback). This mirrors the
 * standard ergonomics idea that sustained/severe poor posture predicts
 * discomfort onset — a brief dip barely moves the needle, but sustained
 * poor posture accumulates and eventually crosses a discomfort threshold.
 * We then linearly project forward at the *current* strain rate to
 * estimate minutes remaining until that threshold — i.e. "if this
 * continues, expect discomfort in about N minutes", not a fixed timer.
 *
 * Returns { update(score, metrics), reset() }. update() should be called
 * once per analysis tick with the same displayed score and metrics object
 * already computed that tick; it returns either null (no near-term risk —
 * posture is currently fine) or:
 *   { minutes_to_pain, confidence: "low"|"medium"|"high", primary_driver, strain }
 */
export function usePainPrediction(safeThreshold = 60, strainThreshold = 12) {
  const strainRef       = useRef(0);
  const lastTickRef     = useRef(0);
  const sessionStartRef = useRef(null);

  const update = useCallback((score, metrics) => {
    if (score == null) return null;
    const now = Date.now();
    if (sessionStartRef.current == null) sessionStartRef.current = now;
    const dtMin = lastTickRef.current ? Math.min(5/60, (now - lastTickRef.current) / 60000) : 0;
    lastTickRef.current = now;

    // 0 at/above the safe threshold, ramping to 1.0 at score=0.
    // strainThreshold is calibrated in "minutes at maximum severity (score=0)
    // to reach discomfort" — e.g. strainThreshold=12 means ~12 min of the
    // worst possible posture, or roughly ~2x longer at half that severity,
    // before the model flags near-term risk. This is a heuristic estimate,
    // not a clinically validated prediction.
    const strainRate = Math.max(0, (safeThreshold - score) / safeThreshold); // 0..1 per minute
    strainRef.current += strainRate * dtMin;

    // Not currently accruing meaningful strain → nothing to predict.
    if (strainRate <= 0.02) return null;

    // Which tracked metric is worst right now (excludes non-postural entries).
    let worst = null;
    if (metrics) {
      for (const [key, m] of Object.entries(metrics)) {
        if (typeof m?.score !== "number") continue;
        if (key === "session_fatigue" || key === "confidence_val") continue;
        if (!worst || m.score < worst.score) worst = { key, label: m.label || key, score: m.score };
      }
    }

    const remaining = strainThreshold - strainRef.current;
    const minutesToPain = remaining / strainRate; // at the *current* rate — a countdown, not a fixed timer

    // Confidence grows with how much of this session we've actually observed —
    // an estimate 30s into a session is much shakier than one after 10+ minutes.
    const sessionSec = (now - sessionStartRef.current) / 1000;
    const confidence = sessionSec > 600 ? "high" : sessionSec > 180 ? "medium" : "low";

    return {
      minutes_to_pain: Math.round(Math.min(180, Math.max(0, minutesToPain))),
      confidence,
      primary_driver: worst?.label || null,
      strain: Math.round(strainRef.current * 10) / 10,
    };
  }, [safeThreshold, strainThreshold]);

  const reset = useCallback(() => {
    strainRef.current = 0; lastTickRef.current = 0; sessionStartRef.current = null;
  }, []);

  return { update, reset };
}
