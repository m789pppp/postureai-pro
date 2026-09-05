/**
 * voiceCoach — the rules that decide whether the live coach actually speaks.
 *
 * Every assertion here corresponds to a way the coach could be wired
 * correctly end to end and still be silent, or speak at the wrong moment.
 * Those are the failures that matter: there is no error, no event and no UI
 * change when speech synthesis declines a request, so the only evidence a
 * user gets is a paid feature that "doesn't work".
 *
 *   node src/lib/voiceCoach.test.mjs
 */

// ── Minimal speechSynthesis stub ──────────────────────────────────
// Records what was queued so the tests can assert on the utterance, not just
// on the return value.
const spoken = [];
let voiceList = [
  { voiceURI: "en-1", name: "English Voice", lang: "en-US" },
  { voiceURI: "ar-1", name: "Arabic Voice",  lang: "ar-EG" },
];
let cancels = 0, resumes = 0;

class FakeUtterance {
  constructor(text) { this.text = text; this.volume = 1; this.rate = 1; this.pitch = 1; }
}
const store = new Map();
globalThis.window = {
  speechSynthesis: {
    paused: false,
    cancel() { cancels++; },
    resume() { resumes++; },
    getVoices() { return voiceList; },
    speak(u) { spoken.push(u); },
    addEventListener() {}, removeEventListener() {},
  },
  localStorage: {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
  },
};
globalThis.localStorage = window.localStorage;
globalThis.SpeechSynthesisUtterance = FakeUtterance;
globalThis.document = { hidden: false, addEventListener() {}, removeEventListener() {} };

// A controllable clock. The cooldowns are measured in tens of seconds, so
// without this the only thing a test can assert is "the second call was
// blocked" — which stays true whatever the numbers are. That is exactly how
// the first version of this file passed against a flat 25s window, the thing
// this module was changed to stop doing.
let _clock = 1_000_000;
const advance = (ms) => { _clock += ms; };
Date.now = () => _clock;

const {
  speakCoach, setVoiceCoachEnabled, isVoiceCoachEnabled, stopSpeaking,
  hasVoiceFor, primeSpeech, setVoicePrefs, resetSpeechCooldown,
} = await import("./voiceCoach.js");

let pass = 0, fail = 0; const failures = [];
const check = (name, ok, detail = "") => {
  if (ok) pass++; else { fail++; failures.push(name + (detail ? " — " + detail : "")); }
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
};
const eq = (name, got, want) => check(name, got === want, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

/** Run the pending setTimeout(speakNow, 120) so `spoken` is populated. */
// Drain the pending setTimeout(speakNow, 120) BEFORE clearing, or a cue
// queued by an earlier assertion lands in the next one's recording.
const flush = () => new Promise(r => setTimeout(r, 200));
const reset = async () => { await flush(); spoken.length = 0; };

console.log("\nthe coach is off until it is turned on");
setVoiceCoachEnabled(false);
eq("a cue while disabled does not speak", speakCoach("straighten up"), "disabled");
eq("and isVoiceCoachEnabled agrees", isVoiceCoachEnabled(), false);
setVoiceCoachEnabled(true);
eq("enabling it lets cues through", isVoiceCoachEnabled(), true);

console.log("\nan empty cue must not consume the cooldown");
reset();
// The shipped bug: _lastSpeakMs was stamped BEFORE the text was validated, so
// one emoji-only cue muted the coach for the next 25 seconds having made no
// sound at all.
eq("an emoji-only cue reports empty", speakCoach("🔴 ⚠️"), "empty");
eq("a real cue right after it still speaks", speakCoach("Sit back", "en", { severity: "severe" }), "spoken");

console.log("\ncooldowns are per severity, and severe is not starved by mild");
setVoicePrefs({ locale: null, voiceURI: null, rate: null });
resetSpeechCooldown();
// The defect: ONE global 25s window for every cue. A severe fault arriving ten
// seconds after a mild one was dropped — the coach fell silent at exactly the
// moment it had the most to say. These assertions fail against a flat window.
eq("a mild cue speaks", speakCoach("slight drift", "en", { severity: "mild" }), "spoken");
advance(10_000);
eq("a SEVERE cue ten seconds later still gets through",
   speakCoach("sit up now", "en", { severity: "severe" }), "spoken");

resetSpeechCooldown();
eq("a mild cue speaks", speakCoach("a", "en", { severity: "mild" }), "spoken");
advance(10_000);
eq("but another MILD one ten seconds later does not",
   speakCoach("b", "en", { severity: "mild" }), "cooldown");
advance(26_000);   // 36s total, past the 35s mild window
eq("and is allowed once its own window has passed",
   speakCoach("c", "en", { severity: "mild" }), "spoken");

resetSpeechCooldown();
eq("severe speaks", speakCoach("x", "en", { severity: "severe" }), "spoken");
advance(7_000);
eq("severe is still rate-limited below its own window",
   speakCoach("y", "en", { severity: "severe" }), "cooldown");
advance(2_000);    // 9s, past the 8s severe window
eq("and speaks again after it", speakCoach("z", "en", { severity: "severe" }), "spoken");
resetSpeechCooldown();

console.log("\npreview and force do not burn the alert budget");
await reset();
// A new session starts with a clean window — see resetSpeechCooldown().
resetSpeechCooldown();
// Toggling the coach on speaks a confirmation. That used to stamp the
// cooldown, so the first real alert in the following 25s was swallowed.
eq("a preview speaks even while disabled", (setVoiceCoachEnabled(false), speakCoach("hello", "en", { preview: true })), "spoken");
setVoiceCoachEnabled(true);
eq("and the next real cue is not blocked by it", speakCoach("real cue", "en", { severity: "severe" }), "spoken");

console.log("\nnothing is spoken to a tab nobody is looking at");
globalThis.document.hidden = true;
eq("a hidden tab defers to the OS notification", speakCoach("x", "en", { force: true }), "hidden");
globalThis.document.hidden = false;
eq("and speaks again once visible", speakCoach("x", "en", { force: true }), "spoken");

console.log("\na new session is not muted by the previous one's cooldown");
speakCoach("first", "en", { severity: "severe" });
eq("a repeat inside the window is held", speakCoach("second", "en", { severity: "severe" }), "cooldown");
resetSpeechCooldown();
eq("but a fresh session speaks immediately", speakCoach("new session", "en", { severity: "severe" }), "spoken");

console.log("\nthe utterance itself");
await reset();
speakCoach("⚠️ Head leaning 18° — level it over your shoulders", "en", { force: true });
await flush();
check("exactly one utterance was queued", spoken.length === 1, `queued ${spoken.length}`);
eq("emoji are stripped before speaking", spoken[0]?.text, "Head leaning 18° — level it over your shoulders");
check("degrees and numbers survive", /18°/.test(spoken[0]?.text || ""));

await reset();
speakCoach("🔴 راسك مايلة 20° على جنب", "ar", { force: true });
await flush();
eq("Arabic text is not mangled by the emoji strip", spoken[0]?.text, "راسك مايلة 20° على جنب");
check("an Arabic cue picks an Arabic voice", spoken[0]?.voice?.lang === "ar-EG",
  `picked ${spoken[0]?.voice?.lang}`);
check("and is tagged with an Arabic locale", spoken[0]?.lang?.startsWith("ar"));

console.log("\nvoice preferences are honoured");
await reset();
setVoicePrefs({ rate: 0.7, voiceURI: "en-1", locale: "en-GB" });
speakCoach("test", "en", { force: true });
await flush();
eq("the chosen rate is applied", spoken[0]?.rate, 0.7);
eq("the chosen voice wins over the locale match", spoken[0]?.voice?.voiceURI, "en-1");
setVoicePrefs({ rate: null, voiceURI: null, locale: null });

console.log("\nmissing voices are detectable, not silently wrong");
check("an Arabic voice is present in the stub", hasVoiceFor("ar"));
voiceList = [{ voiceURI: "en-1", name: "English Voice", lang: "en-US" }];
check("removing it is detected", !hasVoiceFor("ar"),
  "with no Arabic voice the browser reads Arabic in an English accent — the UI must warn");
check("English is still available", hasVoiceFor("en"));
voiceList = [];
check("an un-enumerated list does not cry wolf", hasVoiceFor("ar"),
  "getVoices() is empty until the async voiceschanged event fires");
voiceList = [
  { voiceURI: "en-1", name: "English Voice", lang: "en-US" },
  { voiceURI: "ar-1", name: "Arabic Voice",  lang: "ar-EG" },
];

console.log("\npriming and teardown");
await reset();
check("primeSpeech queues a silent utterance", (primeSpeech(), spoken.length === 1));
eq("primed silently", spoken[0]?.volume, 0);
await reset();
// NOT latched: a gesture-policy refusal is silent, so a one-shot attempt that
// happened to be refused would leave the coach mute for the whole page with no
// retry. Priming again each session start costs one silent utterance.
check("priming again re-attempts rather than latching", (primeSpeech(), spoken.length === 1));
let before = cancels;
stopSpeaking();
check("stopSpeaking cancels the queue", cancels > before);

// Turning the coach OFF mid-cue must silence it, not let the current sentence
// finish over a user who just asked for quiet. Baseline re-read here: sharing
// it with the assertion above made this pass even with the cancel removed.
setVoiceCoachEnabled(true);
before = cancels;
setVoiceCoachEnabled(false);
check("disabling cancels in-flight speech", cancels > before,
  `cancels went ${before} -> ${cancels}`);
before = cancels;
setVoiceCoachEnabled(false);
check("but disabling an already-off coach is a no-op", cancels === before);

console.log(`\n${pass} passed · ${fail} failed`);
if (fail) { failures.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
