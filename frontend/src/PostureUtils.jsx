import { useState, useEffect, useRef, useCallback } from "react";
import { NON_POSTURAL_METRICS } from "./lib/clinicalMetrics.js";

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
// A pause at least this long while a break is due counts as the break itself.
const BREAK_REST_CREDIT_MS = 2 * 60 * 1000;

// ── useBreakTimer hook ────────────────────────────────────────────
export function useBreakTimer(intervalMin = 30, enabled = true) {
  const [showBreak, setShowBreak] = useState(false);
  const [snoozeCount, setSnoozeCount] = useState(0);
  const timerRef = useRef(null);
  const lastBreakRef = useRef(Date.now());
  // Milliseconds still owed on the current interval when the timer was
  // suspended. `enabled` is `breakReminder && camActive && !isPaused`, so
  // every pause used to tear the timeout down and every resume scheduled a
  // FULL fresh interval — a user who pauses for a sip of water every twenty
  // minutes would never once be reminded to take a break, which is the whole
  // feature. The remainder is carried across instead.
  const remainingRef = useRef(null);
  const startedAtRef = useRef(0);
  // Interval the banked remainder was measured against, and whether the
  // pending timeout is a snooze (a snooze is not part of any interval).
  const intervalAtRef = useRef(intervalMin);
  const snoozingRef = useRef(false);
  // A break that came due and was still on screen when the session paused.
  const owedAtRef = useRef(null);
  const showingRef = useRef(false);
  useEffect(() => { showingRef.current = showBreak; }, [showBreak]);

  const scheduleIn = useCallback((ms) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    startedAtRef.current = Date.now();
    remainingRef.current = ms;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      remainingRef.current = null;
      snoozingRef.current = false;
      setShowBreak(true);
    }, ms);
  }, []);

  const scheduleNext = useCallback((extraMs = 0) => {
    snoozingRef.current = false;
    intervalAtRef.current = intervalMin;
    scheduleIn(intervalMin * 60 * 1000 + extraMs);
  }, [intervalMin, scheduleIn]);

  useEffect(() => {
    // Turning reminders off (or ending the session) must also take down a card
    // that is already on screen — otherwise the prompt outlives the setting
    // that produced it, and the user's "off" appears not to have worked.
    if (!enabled) {
      if (showingRef.current) owedAtRef.current = Date.now();
      setShowBreak(false);
      return;
    }
    // A break that was on screen when the session paused is still owed after
    // a short pause (a sip of water is not a break). A pause of two minutes or
    // more is itself the rest, so it starts a fresh interval instead.
    if (owedAtRef.current != null) {
      const pausedMs = Date.now() - owedAtRef.current;
      owedAtRef.current = null;
      if (pausedMs < BREAK_REST_CREDIT_MS) { setShowBreak(true); return; }
      remainingRef.current = null;
    }
    // The interval was changed mid-way: the time already served counts
    // against the NEW interval. Carrying the old remainder meant switching
    // from 60 to 15 minutes after five minutes still waited 55.
    if (remainingRef.current != null && !snoozingRef.current && intervalAtRef.current !== intervalMin) {
      remainingRef.current = Math.max(1000,
        remainingRef.current + (intervalMin - intervalAtRef.current) * 60 * 1000);
    }
    intervalAtRef.current = intervalMin;
    // Resume what was left, or start a fresh interval if there is nothing owed.
    scheduleIn(remainingRef.current != null && remainingRef.current > 0
      ? remainingRef.current
      : intervalMin * 60 * 1000);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        // Bank the unserved portion so the next resume picks up here.
        const served = Date.now() - startedAtRef.current;
        remainingRef.current = Math.max(1000, (remainingRef.current ?? 0) - served);
      }
    };
  }, [enabled, intervalMin, scheduleIn]);

  const dismiss = useCallback(() => {
    setShowBreak(false);
    lastBreakRef.current = Date.now();
    scheduleNext();
  }, [scheduleNext]);

  const snooze = useCallback((min = 5) => {
    setShowBreak(false);
    setSnoozeCount(c => c + 1);
    snoozingRef.current = true;
    // A snooze is the snooze length, not a whole interval on top of it. This
    // added `min` minutes to a FULL interval, so "remind me in 5" meant 30.
    scheduleIn(min * 60 * 1000);
  }, [scheduleIn]);

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
        // position_penalty has a numeric score too (100 - the penalty) so it
        // passed the guard above and, missing from this check, could become
        // the metric this pain-prediction countdown names as the cause --
        // "position_penalty"/"Positioning adjustment" is not a body part.
        if (NON_POSTURAL_METRICS.has(key)) continue;
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
