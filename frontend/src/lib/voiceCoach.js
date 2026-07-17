/**
 * voiceCoach.js — Elite real-time spoken posture coaching
 * ────────────────────────────────────────────────────────
 * Speaks alert messages aloud during a live session using the browser's
 * Web Speech API (zero server cost, works offline). Arabic (ar-EG) and
 * English voices are picked automatically from the installed voices.
 *
 * Gating: App.jsx enables this only for Elite users via
 * setVoiceCoachEnabled(voiceCoach && tierAtLeast(effectiveTier,"elite")).
 * speakCoach() is safe to call unconditionally from the alert path —
 * it no-ops when disabled, unsupported, or inside the cooldown window.
 */

let _lastSpeakMs = 0;
let _enabled = false;

/** Minimum gap between spoken cues — voice is more intrusive than a beep */
const SPEAK_COOLDOWN_MS = 25000;

export function setVoiceCoachEnabled(on) {
  _enabled = !!on;
  if (!_enabled) stopSpeaking();
}

export function isVoiceCoachEnabled() { return _enabled; }

export function stopSpeaking() {
  try { window.speechSynthesis?.cancel(); } catch {}
}

/**
 * Speak a coaching cue.
 * @param {string} text - message (emoji/symbols are stripped before speaking)
 * @param {"ar"|"en"} lang
 * @param {{force?:boolean}} opts - force bypasses enabled+cooldown (used for the toggle-on confirmation)
 * @returns {boolean} true if speech was queued
 */
export function speakCoach(text, lang = "en", { force = false } = {}) {
  if (!force && !_enabled) return false;
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  const now = Date.now();
  if (!force && now - _lastSpeakMs < SPEAK_COOLDOWN_MS) return false;
  _lastSpeakMs = now;
  try {
    const synth = window.speechSynthesis;
    synth.cancel(); // never queue up a backlog of stale cues
    const clean = String(text || "").replace(/[⚠✓✗▶⏹🔴🟡🟢🔊🔇🎙️™️]|️/g, "").trim();
    if (!clean) return false;
    const u = new SpeechSynthesisUtterance(clean);
    u.lang   = lang === "ar" ? "ar-EG" : "en-US";
    u.rate   = lang === "ar" ? 0.95 : 1.0;
    u.pitch  = 1.0;
    u.volume = 0.9;
    // Prefer an installed voice matching the language (getVoices can be
    // empty on first call in some browsers — the default voice is used then)
    const voices = synth.getVoices?.() || [];
    const match  = voices.find(v => v.lang?.toLowerCase().startsWith(lang === "ar" ? "ar" : "en"));
    if (match) u.voice = match;
    synth.speak(u);
    return true;
  } catch { return false; }
}
