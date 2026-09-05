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
let _primed  = false;

/**
 * Minimum gap between spoken cues, BY SEVERITY. A single global 25s window
 * meant a severe fault landing ten seconds after a mild one was silently
 * dropped — the coach went quiet at exactly the moment it had the most to
 * say. Severe cues are what the user is paying for; they wait 8s, not 25.
 */
const SPEAK_COOLDOWN_MS = { severe: 8000, moderate: 20000, mild: 35000 };
const DEFAULT_COOLDOWN_MS = 25000;

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
  const was = _enabled;
  _enabled = !!on;
  if (!_enabled && was) stopSpeaking();
}

/**
 * Does this device have ANY voice that can pronounce this language?
 *
 * Without this the coach fails in the worst possible way: with no Arabic
 * voice installed the browser does not fall silent, it reads the Arabic
 * string with an English voice. The user hears fluent nonsense and concludes
 * the product is broken — which, for them, it is. Settings warns instead.
 */
export function hasVoiceFor(lang = "en") {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  const voices = window.speechSynthesis.getVoices?.() || [];
  if (!voices.length) return true;   // not enumerated yet — don't cry wolf
  return voices.some(v => v.lang?.toLowerCase().startsWith(lang));
}

/**
 * Satisfy Chrome's autoplay gate while a real user gesture is on the stack.
 *
 * speechSynthesis is gesture-gated the same way audio is. The first spoken
 * cue arrives minutes into a session, long after any click, and Chrome
 * refuses it — silently, with no error and no event. Speaking a zero-length
 * utterance from the Start Session click unlocks the synth for the rest of
 * the page's life. Call it from a click handler, never from an effect.
 */
export function primeSpeech() {
  // Deliberately NOT latched on success. A gesture-policy refusal is silent —
  // speak() does not throw and fires no event — so there is no way to know the
  // priming took. Latching on the first attempt meant that if the first one
  // was refused (it ran outside a gesture, or the page was still loading) the
  // coach stayed locked for the rest of the page's life with no retry. A
  // zero-volume one-character utterance costs nothing; re-priming each session
  // start is strictly better than one unverifiable attempt.
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  try {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    window.speechSynthesis.speak(u);
    _primed = true;
    return true;
  } catch { return false; }
}

/**
 * Chrome stops the synthesis queue after ~15s of a backgrounded tab and does
 * not restart it on return, so the coach goes permanently mute the first time
 * the user switches tabs. resume() is the documented un-wedge.
 */
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  try {
    document.addEventListener("visibilitychange", () => {
      try {
        // Deliberately does NOT cancel on hide. Chrome suspends the queue by
        // itself; cancelling as well threw away a cue that was mid-sentence,
        // so a one-second alt-tab silently ate a coaching cue that the
        // per-cause backoff would then not re-issue for another five minutes.
        // resume() is the documented un-wedge for the queue Chrome stops after
        // ~15s in the background and never restarts on return.
        if (!document.hidden && window.speechSynthesis.paused) window.speechSynthesis.resume();
      } catch {}
    });
  } catch {}
}

export function isVoiceCoachEnabled() { return _enabled; }

/**
 * Forget the last-spoken timestamp.
 *
 * Called when a session starts: the cooldown is a within-session pacing rule,
 * not a property of the app. Without this, stopping a session and starting a
 * new one seconds later carried the old window across, and the first alert of
 * the new session — often the one that matters, because the user has just sat
 * down badly — was silently swallowed.
 */
export function resetSpeechCooldown() { _lastSpeakMs = 0; }

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
// Chrome/Chromium (and most Chromium-based browsers, including many
// Android WebViews) has a long-standing bug: calling speechSynthesis
// .speak() immediately after .cancel() silently drops the utterance —
// no error, no event, just no sound. This is the single most likely
// reason this could look entirely correctly wired and still never
// actually speak. Standard, widely-used workaround: a short delay
// between cancel() and speak() so Chrome's internal queue actually
// clears first. See e.g. https://bugs.chromium.org/p/chromium/issues/detail?id=1141979
const CANCEL_SPEAK_GAP_MS = 120;

// Some browsers (notably Chrome on first load) return an empty voice
// list from getVoices() until the async "voiceschanged" event fires.
// Nudge it early so the very first speakCoach() call has real voices
// to match against, not just whatever default the browser falls back to.
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  try {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener?.("voiceschanged", () => {
      try { window.speechSynthesis.getVoices(); } catch {}
    }, { once: true });
  } catch {}
}

export function speakCoach(text, lang = "en", { force = false, preview = false, severity = "moderate" } = {}) {
  // `preview` is the only thing that may speak while the coach is off, and it
  // is used exclusively by the toggle confirmation and the settings preview —
  // both already behind the Elite gate at their call sites.
  if (!preview && !_enabled) return "disabled";
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return "unsupported";
  // Talking to a tab nobody is looking at is what the desktop notification is
  // for. Chrome would also refuse it and wedge the queue.
  if (!preview && typeof document !== "undefined" && document.hidden) return "hidden";

  // Pictographs, arrows/symbols and dingbats, plus the variation selector and
  // ZWJ that glue multi-codepoint emoji together. Kept as an alternation
  // rather than one class because a combining mark inside a character class is
  // a lint error (and does the wrong thing for sequences). Arabic (U+0600-
  // U+06FF) is untouched — the previous fixed list of six symbols left every
  // other emoji to be read aloud as its CLDR name.
  const clean = String(text || "")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2190}-\u{2BFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/[️‍]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  // Validate BEFORE touching the clock. This used to stamp _lastSpeakMs first
  // and bail on an empty string afterwards, so one emoji-only cue muted the
  // coach for the next 25 seconds without ever making a sound.
  if (!clean) return "empty";

  const now = Date.now();
  // `force` and `preview` skip the rate limit — and, importantly, do NOT
  // consume it. Toggling the coach on used to burn the window, so the first
  // real alert within the next 25s was swallowed by the confirmation message.
  if (!force && !preview) {
    const gap = SPEAK_COOLDOWN_MS[severity] ?? DEFAULT_COOLDOWN_MS;
    if (now - _lastSpeakMs < gap) return "cooldown";
    _lastSpeakMs = now;
  }

  try {
    const synth  = window.speechSynthesis;
    if (synth.paused) { try { synth.resume(); } catch {} }
    synth.cancel(); // never queue up a backlog of stale cues
    const prefs  = loadPrefs();
    const locale = prefs.locale || (lang === "ar" ? "ar-EG" : "en-US");
    const speakNow = () => {
      try {
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
        // Chrome drops long utterances mid-sentence unless nudged; a cue is
        // one short sentence, so a single resume tick on start is enough.
        u.onstart = () => { try { setTimeout(() => synth.resume(), 250); } catch {} };
        synth.speak(u);
      } catch {}
    };
    setTimeout(speakNow, CANCEL_SPEAK_GAP_MS);
    return "spoken";
  } catch { return "error"; }
}

/** Back-compat for call sites that only wanted a boolean. */
export function didSpeak(result) { return result === "spoken"; }
