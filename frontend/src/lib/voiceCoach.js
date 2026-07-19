/**
 * voiceCoach.js — Elite real-time spoken posture coaching
 * ────────────────────────────────────────────────────────
 * Speaks alert messages aloud during a live session using the browser's
 * Web Speech API (zero server cost, works offline). Voice, rate, pitch,
 * and regional locale are all user-configurable and persisted.
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

const PREF_KEY = "voiceCoach_prefs";

/** Regional locale variants offered per language — covers the Gulf-first
 * go-to-market (Saudi/UAE/etc.) alongside the original Egypt-first ar-EG. */
export const LOCALE_OPTIONS = {
  ar: [
    { code: "ar-EG", label: "مصري" },
    { code: "ar-SA", label: "خليجي (سعودي)" },
    { code: "ar-AE", label: "خليجي (إماراتي)" },
  ],
  en: [
    { code: "en-US", label: "US English" },
    { code: "en-GB", label: "UK English" },
  ],
};

const DEFAULT_PREFS = { locale: null, voiceURI: null, rate: null, pitch: 1.0 };

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : { ...DEFAULT_PREFS };
  } catch { return { ...DEFAULT_PREFS }; }
}

export function getVoicePrefs() { return loadPrefs(); }

export function setVoicePrefs(partial) {
  try {
    const next = { ...loadPrefs(), ...partial };
    localStorage.setItem(PREF_KEY, JSON.stringify(next));
    return next;
  } catch { return loadPrefs(); }
}

/** All voices installed in this browser matching a language ("ar"/"en"). */
export function getAvailableVoices(lang = "en") {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  const voices = window.speechSynthesis.getVoices?.() || [];
  return voices.filter(v => v.lang?.toLowerCase().startsWith(lang));
}

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
 * @param {{force?:boolean}} opts - force bypasses enabled+cooldown (used for the toggle-on confirmation and the settings preview button)
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
    const prefs  = loadPrefs();
    const locale = prefs.locale || (lang === "ar" ? "ar-EG" : "en-US");
    const u = new SpeechSynthesisUtterance(clean);
    u.lang   = locale;
    u.rate   = prefs.rate ?? (lang === "ar" ? 0.95 : 1.0);
    u.pitch  = prefs.pitch ?? 1.0;
    u.volume = 0.9;
    // Personalized voice choice takes priority; otherwise best match for
    // the selected locale, falling back to a plain language match, then default.
    const voices = synth.getVoices?.() || [];
    let match = prefs.voiceURI ? voices.find(v => v.voiceURI === prefs.voiceURI) : null;
    if (!match) match = voices.find(v => v.lang === locale);
    if (!match) match = voices.find(v => v.lang?.toLowerCase().startsWith(lang === "ar" ? "ar" : "en"));
    if (match) u.voice = match;
    synth.speak(u);
    return true;
  } catch { return false; }
}

