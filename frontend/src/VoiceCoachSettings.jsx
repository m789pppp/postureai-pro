/**
 * VoiceCoachSettings — the accent / voice / speed controls for the live coach.
 *
 * Lifted out of HomePage so the LIVE page can show it too. That was the real
 * gap: the coach speaks during a session, and the only way to change how it
 * sounds — or to find out that this device has no Arabic voice installed and
 * is reading Arabic cues with an English one — was to leave the session, go to
 * Settings, and come back. `compact` renders it inline under the Live panel's
 * toggle instead of as a standalone card.
 */
import React, { useState, useEffect } from "react";
import { getAvailableVoices, getVoicePrefs, setVoicePrefs, speakCoach, hasVoiceFor, LOCALE_OPTIONS } from "./lib/voiceCoach.js";

export default function VoiceCoachSettings({ cs, isAr, lang, addToast, compact = false }) {
  const langKey = isAr ? "ar" : "en";
  const [prefs, setPrefsState] = useState(() => getVoicePrefs());
  const [voices, setVoices]    = useState([]);
  const [noVoice, setNoVoice]  = useState(false);

  useEffect(() => {
    const load = () => { setVoices(getAvailableVoices(langKey)); setNoVoice(!hasVoiceFor(langKey)); };
    load();
    // getVoices() can populate asynchronously in some browsers
    window.speechSynthesis?.addEventListener?.("voiceschanged", load);
    return () => window.speechSynthesis?.removeEventListener?.("voiceschanged", load);
  }, [langKey]);

  const locales = LOCALE_OPTIONS[langKey] || LOCALE_OPTIONS.en;
  const currentLocale = prefs.locale || locales[0].code;
  const update = (partial) => setPrefsState(setVoicePrefs(partial));

  const preview = () => {
    const text = isAr ? "كده صوتي هيبقى وأنت بتستخدم المدرب الصوتي." : "This is how I'll sound during your voice coaching sessions.";
    // speakCoach returns a REASON now, not a boolean — "unsupported" is a
    // truthy string, so the old `if (!ok)` check could never fire and a
    // browser with no speech support failed completely silently.
    const r = speakCoach(text, langKey, { preview: true });
    if (r !== "spoken") {
      addToast?.(isAr ? "المتصفح ده مش بيدعم الأصوات" : "This browser doesn't support speech voices", "error");
    }
  };

  const L = (k) => ({
    title:  isAr ? "صوت المدرب" : "Voice Coach",
    intro:  isAr ? "اختار اللهجة والصوت اللي يناسبك أثناء الجلسات المباشرة (خطة Elite)."
                 : "Choose the accent and voice you'd like during live sessions (Elite plan).",
    accent: isAr ? "اللهجة" : "Accent",
    voice:  isAr ? "الصوت"  : "Voice",
    auto:   isAr ? "تلقائي (أفضل مطابقة)" : "Automatic (best match)",
    speed:  isAr ? "السرعة" : "Speed",
    pitch:  isAr ? "طبقة الصوت" : "Pitch",
    test:   isAr ? "تجربة الصوت" : "Preview voice",
  })[k];

  const wrap = compact
    ? { padding: "10px 2px 2px" }
    : { background: cs.card, border: `1px solid ${cs.border}`, borderRadius: 12, padding: "20px" };
  const lbl = { fontSize: 11, fontWeight: 600, color: cs.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".04em" };

  return (
    <div style={wrap}>
      {!compact && (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: cs.text, marginBottom: 6 }}>{L("title")}</div>
          <div style={{ fontSize: 12, color: cs.muted, marginBottom: 16, lineHeight: 1.6 }}>{L("intro")}</div>
        </>
      )}

      {/* The failure this prevents is the confusing one: with no Arabic voice
          installed the browser does not go quiet, it reads the Arabic cue in an
          English voice. The user hears gibberish and blames the product. */}
      {noVoice && (
        <div style={{ fontSize: 11, lineHeight: 1.7, color: "#f59e0b", background: "rgba(245,158,11,.08)",
          border: "1px solid rgba(245,158,11,.25)", borderRadius: 8, padding: "9px 11px", marginBottom: 12 }}>
          {isAr
            ? "الجهاز ده مفيهوش صوت عربي مثبّت، فالمتصفح هينطق الجُمل العربية بصوت إنجليزي. نزّل حزمة أصوات عربية من إعدادات النظام، أو شغّل الواجهة إنجليزي للمدرب الصوتي."
            : "No Arabic voice is installed on this device, so the browser will read Arabic cues with an English voice. Add an Arabic voice pack in your system settings, or use the coach in English."}
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <div style={lbl}>{L("accent")}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {locales.map(l => (
            <button key={l.code} onClick={() => update({ locale: l.code, voiceURI: null })}
              style={{ padding: compact ? "6px 12px" : "7px 14px", borderRadius: 99, cursor: "pointer", fontSize: 12, fontWeight: 600,
                border: currentLocale === l.code ? "1px solid rgba(16,185,129,.4)" : `1px solid ${cs.border}`,
                background: currentLocale === l.code ? "rgba(16,185,129,.12)" : "transparent",
                color: currentLocale === l.code ? "#10b981" : cs.muted }}>
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {voices.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={lbl}>{L("voice")}</div>
          <select value={prefs.voiceURI || ""} onChange={e => update({ voiceURI: e.target.value || null })}
            style={{ width: "100%", background: cs.inp, border: `1px solid ${cs.border}`,
              borderRadius: 8, color: cs.text, padding: "8px 10px", fontSize: 12.5 }}>
            <option value="">{L("auto")}</option>
            {voices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>)}
          </select>
        </div>
      )}

      <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={lbl}>{L("speed")}: {(prefs.rate ?? (isAr ? 0.95 : 1.0)).toFixed(2)}x</div>
          <input type="range" min="0.6" max="1.4" step="0.05" aria-label={L("speed")}
            value={prefs.rate ?? (isAr ? 0.95 : 1.0)}
            onChange={e => update({ rate: parseFloat(e.target.value) })} style={{ width: "100%" }} />
        </div>
        {!compact && (
          <div style={{ flex: 1 }}>
            <div style={lbl}>{L("pitch")}: {(prefs.pitch ?? 1.0).toFixed(2)}</div>
            <input type="range" min="0.6" max="1.4" step="0.05" aria-label={L("pitch")}
              value={prefs.pitch ?? 1.0}
              onChange={e => update({ pitch: parseFloat(e.target.value) })} style={{ width: "100%" }} />
          </div>
        )}
      </div>

      <button onClick={preview} style={{ width: "100%", padding: "9px",
        background: "rgba(16,185,129,.1)", border: "1px solid rgba(16,185,129,.25)", borderRadius: 8,
        color: "#10b981", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
        🔊 {L("test")}
      </button>
    </div>
  );
}
