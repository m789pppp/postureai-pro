/**
 * LiveUI — presentational component library for the Live Posture Analysis page.
 * ─────────────────────────────────────────────────────────────────────────
 * Pure UI layer: every component here takes explicit props and renders
 * markup/styles only. No business state, no Firebase/MediaPipe/scoring
 * logic lives in this file — App.jsx owns all of that and passes values
 * + handlers in as props. This keeps the redesign additive: nothing about
 * *what* the app does changes, only how it's presented.
 *
 * Design tokens (`LT`) are local to this file on purpose — they extend the
 * existing `cs` (DARK/LIGHT) theme object already used across the app
 * rather than introducing a second, conflicting design system. Callers
 * pass their existing `cs` object straight through.
 */
import { useEffect } from "react";

// ─────────────────────────────────────────────────────────────────────────
// TOKENS
// ─────────────────────────────────────────────────────────────────────────
export const LT = {
  space: [4, 8, 12, 16, 20, 24, 32],
  radius: { sm: 8, md: 12, lg: 18, pill: 999 },
  duration: { fast: 150, base: 220, slow: 300 },
  // Standardized on the Live page's own existing muted/clinical thresholds
  // (matches sc() in App.jsx: >=70 good, >=55 warn, else bad) — one source
  // of truth instead of the brighter ui/index.jsx / DesignSystem.js palettes.
  color: { good: "#4FAE8E", warn: "#D6A24C", bad: "#C6604F", info: "#1a56db" },
  font: { xs: 10, sm: 12, base: 14, lg: 18, xl: 28, xxl: 40 },
};

export function scoreTierColor(v) {
  return v >= 70 ? LT.color.good : v >= 55 ? LT.color.warn : LT.color.bad;
}

export function alpha(hex, a) {
  if (!hex || hex[0] !== "#") return hex;
  const h = hex.slice(1);
  const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}

export function fmtTime(totalSeconds = 0) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60), r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

// ─────────────────────────────────────────────────────────────────────────
// ONE-TIME CSS INJECTION (keyframes only — matches the existing pattern in
// ui/index.jsx; kept separate so neither file's styles collide)
// ─────────────────────────────────────────────────────────────────────────
const LIVEUI_CSS = `
@keyframes liveuiFadeIn  { from{opacity:0} to{opacity:1} }
@keyframes liveuiPop     { from{transform:scale(.85);opacity:0} to{transform:scale(1);opacity:1} }
@keyframes liveuiPulse   { 0%{transform:scale(1);opacity:.45} 100%{transform:scale(1.9);opacity:0} }
@keyframes liveuiSlideUp { from{transform:translateY(6px);opacity:0} to{transform:translateY(0);opacity:1} }
@keyframes liveuiSpin    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
/* 10px sits 2px outside an 8px control corner (matching outline-offset), so
   the ring follows the control instead of cutting inside its corners. */
.liveui-focusable:focus-visible { outline:2px solid #1a56db; outline-offset:2px; border-radius:10px; }
.liveui-focusable[role="switch"]:focus-visible { border-radius:999px; }
/* Hover feedback for the page's plain inline <button>s, which previously had
   no hover, active or focus state at all while every LiveUI control did. */
.liveui-focusable:not(:disabled):hover { filter:brightness(1.12); }
.liveui-focusable:not(:disabled):active { transform:translateY(0.5px); }
@media (prefers-reduced-motion: reduce) { .liveui-focusable:active { transform:none; } }
`;
let _liveuiCssInjected = false;
function injectLiveUICSS() {
  if (_liveuiCssInjected || typeof document === "undefined") return;
  _liveuiCssInjected = true;
  const el = document.createElement("style");
  el.setAttribute("data-liveui", "1");
  el.textContent = LIVEUI_CSS;
  document.head.appendChild(el);
}
export function useLiveUICSS() {
  useEffect(() => { injectLiveUICSS(); }, []);
}

// ─────────────────────────────────────────────────────────────────────────
// ICONS — hand-rolled line icons (stroke-based, 24x24 viewBox), no external
// icon library dependency. Built from primitive shapes, not copied path data.
// ─────────────────────────────────────────────────────────────────────────
export function Icon({ name, size = 18, color = "currentColor", strokeWidth = 1.75, style }) {
  const c = {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: color, strokeWidth, strokeLinecap: "round", strokeLinejoin: "round",
    style, "aria-hidden": true, focusable: "false",
  };
  switch (name) {
    // ── Navigation set ────────────────────────────────────────────
    // The app's sidebar was built from emoji — 🏆 🤖 🧠 🔮 🩺 next to a
    // geometric ⊞ — so a single nav column mixed flat glyphs with full-colour
    // stickers that render differently on every OS. One stroke weight, one
    // colour, one visual language.
    case "grid": return <svg {...c}><rect x="3" y="3" width="7.5" height="7.5" rx="1.5" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" /></svg>;
    case "list": return <svg {...c}><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><circle cx="3.8" cy="6" r="1.1" fill={color} stroke="none" /><circle cx="3.8" cy="12" r="1.1" fill={color} stroke="none" /><circle cx="3.8" cy="18" r="1.1" fill={color} stroke="none" /></svg>;
    case "trophy": return <svg {...c}><path d="M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M7 6H4.5a2.5 2.5 0 0 0 2.5 2.5" /><path d="M17 6h2.5a2.5 2.5 0 0 1-2.5 2.5" /><line x1="12" y1="14" x2="12" y2="17" /><path d="M8.5 20.5h7" /><path d="M10 17.5h4v3h-4z" /></svg>;
    case "heartPulse": return <svg {...c}><path d="M20.4 6.6a4.6 4.6 0 0 0-6.5 0L12 8.5l-1.9-1.9a4.6 4.6 0 1 0-6.5 6.5l8.4 8.4 8.4-8.4a4.6 4.6 0 0 0 0-6.5z" /><polyline points="3.5 13 8 13 9.8 10.4 12 15.2 13.6 13 17 13" /></svg>;
    case "sparkle": return <svg {...c}><path d="M12 2.8l1.9 5.2 5.3 1.9-5.3 1.9L12 17l-1.9-5.2L4.8 9.9l5.3-1.9z" /><path d="M18.6 15.2l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8z" /></svg>;
    case "fileText": return <svg {...c}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><polyline points="14 3 14 8 19 8" /><line x1="8.5" y1="12.5" x2="15.5" y2="12.5" /><line x1="8.5" y1="16" x2="13.5" y2="16" /></svg>;
    case "compare": return <svg {...c}><rect x="3" y="9" width="6" height="11" rx="1" /><rect x="15" y="4" width="6" height="16" rx="1" /><line x1="12" y1="3" x2="12" y2="21" strokeDasharray="2 2.5" /></svg>;
    case "brain": return <svg {...c}><path d="M9.5 3.5A2.8 2.8 0 0 0 6.8 6a2.6 2.6 0 0 0-1.9 4 2.8 2.8 0 0 0 .5 4.5A2.7 2.7 0 0 0 8 19.5a2.6 2.6 0 0 0 4 .6V4.6a2.6 2.6 0 0 0-2.5-1.1z" /><path d="M14.5 3.5A2.8 2.8 0 0 1 17.2 6a2.6 2.6 0 0 1 1.9 4 2.8 2.8 0 0 1-.5 4.5A2.7 2.7 0 0 1 16 19.5a2.6 2.6 0 0 1-4 .6" /></svg>;
    case "crystal": return <svg {...c}><circle cx="12" cy="10.5" r="6.2" /><path d="M6.5 18.5h11" /><path d="M9 20.8h6" /><path d="M9.6 9.2a3.2 3.2 0 0 1 2.6-2.3" /></svg>;
    case "stethoscope": return <svg {...c}><path d="M5 3v5a4 4 0 0 0 8 0V3" /><line x1="3.4" y1="3" x2="6.6" y2="3" /><line x1="11.4" y1="3" x2="14.6" y2="3" /><path d="M9 16v-4" /><path d="M9 16a5 5 0 0 0 9 0v-1.4" /><circle cx="18" cy="12.6" r="2.1" /></svg>;
    case "users": return <svg {...c}><circle cx="9" cy="8" r="3.4" /><path d="M2.8 20a6.2 6.2 0 0 1 12.4 0" /><path d="M16.2 5.2a3.4 3.4 0 0 1 0 6.6" /><path d="M17.6 14.4A6.2 6.2 0 0 1 21.2 20" /></svg>;
    case "factory": return <svg {...c}><path d="M3 20V10l5 3.2V10l5 3.2V10l5 3.2V20z" /><path d="M18 10V4.5h2.6V10" /><line x1="2" y1="20.5" x2="22" y2="20.5" /></svg>;
    case "scroll": return <svg {...c}><path d="M5.5 4h11a2 2 0 0 1 2 2v12a2 2 0 0 0 2 2H8a2 2 0 0 1-2-2V6" /><path d="M5.5 4a2 2 0 0 0-2 2v2h3" /><line x1="9.5" y1="9" x2="15" y2="9" /><line x1="9.5" y1="13" x2="15" y2="13" /></svg>;
    case "plug": return <svg {...c}><path d="M9 3v5" /><path d="M15 3v5" /><path d="M6.5 8h11v3a5.5 5.5 0 0 1-11 0z" /><line x1="12" y1="16.5" x2="12" y2="21" /></svg>;
    case "rocket": return <svg {...c}><path d="M12 2.8c3.2 2.2 5 5.6 5 9.4l-2.4 3.1H9.4L7 12.2c0-3.8 1.8-7.2 5-9.4z" /><circle cx="12" cy="10" r="1.9" /><path d="M9.4 15.3 7 17.9l.6 3.3 2.6-1.5" /><path d="M14.6 15.3l2.4 2.6-.6 3.3-2.6-1.5" /></svg>;
    case "leaf": return <svg {...c}><path d="M20 4c0 8.5-4.6 13-11.4 13H5.5C5.5 9.7 10.6 4.6 20 4z" /><path d="M4 20c1.8-4.2 4.6-7.2 8.6-9.4" /></svg>;
    case "wallet": return <svg {...c}><rect x="3" y="6" width="18" height="14" rx="2.5" /><path d="M3 10h18" /><circle cx="16.5" cy="14.5" r="1.2" fill={color} stroke="none" /><path d="M6 6V4.6a1.6 1.6 0 0 1 2-1.5l9 2.4" /></svg>;
    case "wrench": return <svg {...c}><path d="M20 5.6a5 5 0 0 1-6.6 6.3L6 19.3a2.1 2.1 0 0 1-3-3l7.4-7.4A5 5 0 0 1 16.7 2.3l-3 3 2 2 3-3c.2.4.3.8.3 1.3z" /></svg>;
    case "tag": return <svg {...c}><path d="M3 11.4V4a1 1 0 0 1 1-1h7.4a2 2 0 0 1 1.4.6l7.2 7.2a2 2 0 0 1 0 2.8l-7.4 7.4a2 2 0 0 1-2.8 0L3.6 13.8A2 2 0 0 1 3 12.4z" /><circle cx="7.6" cy="7.6" r="1.4" /></svg>;
    case "building": return <svg {...c}><rect x="3" y="3" width="10" height="18" rx="1.5" /><path d="M13 8h7a1 1 0 0 1 1 1v12" /><line x1="2" y1="21" x2="22" y2="21" /><line x1="6.2" y1="7" x2="9.8" y2="7" /><line x1="6.2" y1="11" x2="9.8" y2="11" /><line x1="6.2" y1="15" x2="9.8" y2="15" /><line x1="16" y1="12" x2="18.5" y2="12" /><line x1="16" y1="16" x2="18.5" y2="16" /></svg>;
    case "bulb": return <svg {...c}><path d="M9 17a6.5 6.5 0 1 1 6 0v1.6H9z" /><line x1="9.6" y1="21" x2="14.4" y2="21" /></svg>;
    case "trendDown": return <svg {...c}><polyline points="3 7 9 13 13 9 21 18" /><polyline points="15 18 21 18 21 12" /></svg>;
    case "mail": return <svg {...c}><rect x="3" y="5" width="18" height="14" rx="2.5" /><polyline points="3.8 7 12 13 20.2 7" /></svg>;
    case "chat": return <svg {...c}><path d="M21 12.4c0 4-4 7.2-9 7.2a10.6 10.6 0 0 1-2.8-.4L4 21l1.4-3.7A6.8 6.8 0 0 1 3 12.4C3 8.4 7 5.2 12 5.2s9 3.2 9 7.2z" /></svg>;
    case "key": return <svg {...c}><circle cx="7.5" cy="16.5" r="3.7" /><line x1="10.2" y1="13.8" x2="20" y2="4" /><line x1="17" y1="7" x2="19.4" y2="9.4" /><line x1="14.4" y1="9.6" x2="16.4" y2="11.6" /></svg>;
    // Box on the left with the arrow leaving to the right — the direction that
    // reads as "out". Mirrored, the same glyph reads as sign-IN.
    case "logout": return <svg {...c}><path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" /><polyline points="15 8 19.5 12 15 16" /><line x1="19.5" y1="12" x2="9.5" y2="12" /></svg>;
    case "laptop": return <svg {...c}><rect x="4" y="5" width="16" height="11" rx="2" /><line x1="2" y1="19.5" x2="22" y2="19.5" /></svg>;
    case "back": return <svg {...c}><polyline points="15 18 9 12 15 6" /></svg>;
    case "forward": return <svg {...c}><polyline points="9 18 15 12 9 6" /></svg>;
    case "chevronDown": return <svg {...c}><polyline points="6 9 12 15 18 9" /></svg>;
    case "chevronUp": return <svg {...c}><polyline points="18 15 12 9 6 15" /></svg>;
    case "close": return <svg {...c}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
    case "settings": {
      const ticks = Array.from({ length: 6 }, (_, i) => {
        const a = (i * 60) * Math.PI / 180;
        return <line key={i} x1={12 + Math.cos(a) * 7} y1={12 + Math.sin(a) * 7} x2={12 + Math.cos(a) * 9.5} y2={12 + Math.sin(a) * 9.5} />;
      });
      return <svg {...c}><circle cx="12" cy="12" r="3.2" />{ticks}</svg>;
    }
    case "camera": return <svg {...c}><rect x="3" y="7" width="18" height="13" rx="2" /><rect x="9" y="3" width="6" height="3" rx="1" /><circle cx="12" cy="13.2" r="3.4" /></svg>;
    case "cameraOff": return <svg {...c}><rect x="3" y="7" width="18" height="13" rx="2" /><circle cx="12" cy="13.2" r="3.4" /><line x1="3" y1="4" x2="21" y2="20" /></svg>;
    case "play": return <svg {...c}><polygon points="8 5 19 12 8 19" fill={color} stroke="none" /></svg>;
    case "pause": return <svg {...c}><rect x="6" y="5" width="4" height="14" rx="1" fill={color} stroke="none" /><rect x="14" y="5" width="4" height="14" rx="1" fill={color} stroke="none" /></svg>;
    case "stop": return <svg {...c}><rect x="6" y="6" width="12" height="12" rx="2" fill={color} stroke="none" /></svg>;
    case "target": return (
      <svg {...c}>
        <circle cx="12" cy="12" r="7" />
        <circle cx="12" cy="12" r="1.4" fill={color} stroke="none" />
        <line x1="12" y1="1.5" x2="12" y2="5" /><line x1="12" y1="19" x2="12" y2="22.5" />
        <line x1="1.5" y1="12" x2="5" y2="12" /><line x1="19" y1="12" x2="22.5" y2="12" />
      </svg>
    );
    case "alertTriangle": return <svg {...c}><polygon points="12 3 22 20 2 20" /><line x1="12" y1="9" x2="12" y2="13.5" /><circle cx="12" cy="16.5" r="0.6" fill={color} stroke="none" /></svg>;
    case "checkCircle": return <svg {...c}><circle cx="12" cy="12" r="9" /><polyline points="8 12.5 11 15.5 16 9" /></svg>;
    case "infoCircle": return <svg {...c}><circle cx="12" cy="12" r="9" /><line x1="12" y1="11" x2="12" y2="16" /><circle cx="12" cy="7.5" r="0.6" fill={color} stroke="none" /></svg>;
    case "bell": return <svg {...c}><path d="M6 10a6 6 0 1 1 12 0c0 3.2 1 5 2 6H4c1-1 2-2.8 2-6z" /><line x1="10" y1="19" x2="14" y2="19" /></svg>;
    case "bellOff": return <svg {...c}><path d="M6 10a6 6 0 1 1 12 0c0 3.2 1 5 2 6H4c1-1 2-2.8 2-6z" /><line x1="10" y1="19" x2="14" y2="19" /><line x1="3" y1="3" x2="21" y2="21" /></svg>;
    case "clock": return <svg {...c}><circle cx="12" cy="12" r="9" /><line x1="12" y1="12" x2="12" y2="7.5" /><line x1="12" y1="12" x2="15.5" y2="13.5" /></svg>;
    case "moon": return <svg {...c}><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" /></svg>;
    case "sun": {
      const rays = Array.from({ length: 8 }, (_, i) => {
        const a = (i * 45) * Math.PI / 180;
        return <line key={i} x1={12 + Math.cos(a) * 7.5} y1={12 + Math.sin(a) * 7.5} x2={12 + Math.cos(a) * 10} y2={12 + Math.sin(a) * 10} />;
      });
      return <svg {...c}><circle cx="12" cy="12" r="4" />{rays}</svg>;
    }
    case "globe": return <svg {...c}><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><line x1="3" y1="12" x2="21" y2="12" /></svg>;
    case "expand": return (
      <svg {...c}>
        <polyline points="3 9 3 3 9 3" /><polyline points="15 3 21 3 21 9" />
        <polyline points="21 15 21 21 15 21" /><polyline points="9 21 3 21 3 15" />
      </svg>
    );
    case "collapse": return (
      <svg {...c}>
        <polyline points="3 9 9 9 9 3" /><polyline points="21 9 15 9 15 3" />
        <polyline points="21 15 15 15 15 21" /><polyline points="3 15 9 15 9 21" />
      </svg>
    );
    case "star": return <svg {...c}><polygon points="12 2 14.9 8.6 22 9.3 16.5 14 18.2 21 12 17.3 5.8 21 7.5 14 2 9.3 9.1 8.6" /></svg>;
    case "shield": return <svg {...c}><path d="M12 2 20 5v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V5z" /></svg>;
    case "barChart": return <svg {...c}><rect x="4" y="13" width="3.2" height="7" fill={color} stroke="none" /><rect x="10.4" y="8" width="3.2" height="12" fill={color} stroke="none" /><rect x="16.8" y="4" width="3.2" height="16" fill={color} stroke="none" /></svg>;
    case "eye": return <svg {...c}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>;
    case "eyeOff": return <svg {...c}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /><line x1="3" y1="3" x2="21" y2="21" /></svg>;
    case "mic": return <svg {...c}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><line x1="12" y1="18" x2="12" y2="22" /><line x1="8" y1="22" x2="16" y2="22" /></svg>;
    case "download": return <svg {...c}><line x1="12" y1="3" x2="12" y2="15" /><polyline points="7 10 12 15 17 10" /><line x1="5" y1="21" x2="19" y2="21" /></svg>;
    case "share": return (
      <svg {...c}>
        <circle cx="18" cy="5" r="2.3" /><circle cx="6" cy="12" r="2.3" /><circle cx="18" cy="19" r="2.3" />
        <line x1="7.8" y1="10.9" x2="16.2" y2="6.1" /><line x1="7.8" y1="13.1" x2="16.2" y2="17.9" />
      </svg>
    );
    case "refresh": return <svg {...c}><path d="M21 12a9 9 0 1 1-3-6.7" /><polyline points="21 3 21 9 15 9" /></svg>;
    case "lock": return <svg {...c}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>;
    case "user": return <svg {...c}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" /></svg>;
    case "trend": return <svg {...c}><polyline points="3 17 9 11 13 15 21 6" /><polyline points="15 6 21 6 21 12" /></svg>;
    case "angle": return <svg {...c}><polyline points="4 4 4 20 20 20" /><path d="M4 13a7 7 0 0 1 7 7" /></svg>;
    case "skeleton": return (
      <svg {...c}>
        <circle cx="12" cy="5" r="2.4" />
        <line x1="12" y1="7.4" x2="12" y2="14" />
        <line x1="12" y1="9.5" x2="6.5" y2="12" /><line x1="12" y1="9.5" x2="17.5" y2="12" />
        <line x1="12" y1="14" x2="7.5" y2="21" /><line x1="12" y1="14" x2="16.5" y2="21" />
      </svg>
    );
    default: return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// SMALL BUILDING BLOCKS
// ─────────────────────────────────────────────────────────────────────────
export function StatusPill({ icon, label, tone = "neutral", pulse = false, cs, title }) {
  const color = tone === "neutral" ? cs.muted : LT.color[tone];
  const bg = tone === "neutral" ? (cs.inp || "rgba(148,163,184,.08)") : alpha(color, 0.12);
  const bd = tone === "neutral" ? (cs.inpB || cs.border) : alpha(color, 0.28);
  return (
    <span title={title} style={{
      display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px",
      borderRadius: LT.radius.pill, background: bg, border: `1px solid ${bd}`,
      fontSize: LT.font.xs, fontWeight: 600, color, whiteSpace: "nowrap", lineHeight: 1,
    }}>
      {icon && (
        <span style={{ position: "relative", display: "inline-flex" }}>
          <Icon name={icon} size={12} color={color} />
          {pulse && <span style={{
            position: "absolute", inset: -3, borderRadius: "50%", background: color,
            animation: "liveuiPulse 1.8s ease-out infinite",
          }} />}
        </span>
      )}
      {label}
    </span>
  );
}

export function IconBtn({ name, label, onClick, active, cs, size = 34, pressed, disabled }) {
  const info = cs.blue || LT.color.info;
  return (
    <button onClick={onClick} aria-label={label} aria-pressed={pressed} title={label} disabled={disabled}
      className="liveui-focusable"
      style={{
        width: size, height: size, display: "inline-flex", alignItems: "center", justifyContent: "center",
        borderRadius: LT.radius.sm, background: active ? alpha(info, 0.14) : (cs.inp || "rgba(148,163,184,.08)"),
        border: `1px solid ${active ? alpha(info, 0.3) : (cs.inpB || cs.border)}`,
        color: active ? info : cs.muted, cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1, flexShrink: 0,
        transition: `background ${LT.duration.fast}ms ease, color ${LT.duration.fast}ms ease`,
      }}>
      <Icon name={name} size={Math.round(size * 0.46)} />
    </button>
  );
}

export function Btn({ children, onClick, variant = "primary", size = "md", icon, disabled, cs, style, ...rest }) {
  const info = cs?.blue || LT.color.info;
  const pad = size === "sm" ? "7px 12px" : size === "lg" ? "12px 22px" : "9px 16px";
  const fs = size === "sm" ? LT.font.xs : LT.font.sm;
  const variants = {
    primary: { background: info, color: "#fff", border: "1px solid transparent" },
    secondary: { background: alpha(info, 0.12), color: info, border: `1px solid ${alpha(info, 0.28)}` },
    ghost: { background: "transparent", color: cs?.muted, border: `1px solid ${cs?.border}` },
    danger: { background: alpha(LT.color.bad, 0.12), color: LT.color.bad, border: `1px solid ${alpha(LT.color.bad, 0.28)}` },
    success: { background: alpha(LT.color.good, 0.12), color: LT.color.good, border: `1px solid ${alpha(LT.color.good, 0.28)}` },
  };
  const v = variants[variant] || variants.primary;
  return (
    <button onClick={onClick} disabled={disabled} className="liveui-focusable" {...rest}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
        padding: pad, fontSize: fs, fontWeight: 700, borderRadius: LT.radius.sm,
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
        transition: `filter ${LT.duration.fast}ms ease, transform ${LT.duration.fast}ms ease`,
        whiteSpace: "nowrap", ...v, ...style,
      }}>
      {icon && <Icon name={icon} size={size === "sm" ? 13 : 15} color={v.color} />}
      {children}
    </button>
  );
}

export function SectionCard({ title, icon, cs, children, style, actions }) {
  return (
    <div style={{ marginBottom: 16, ...style }}>
      {title && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            {icon && <Icon name={icon} size={13} color={cs.muted} />}
            <span style={{
              fontSize: LT.font.xs, fontWeight: 700, color: cs.muted,
              textTransform: "uppercase", letterSpacing: ".05em", whiteSpace: "nowrap",
            }}>{title}</span>
          </div>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SETTINGS LIST — iOS/Apple-Health-style toggle rows, replaces cramped
// button grids with wrapping labels. One consistent row height regardless
// of label length; a real switch instead of a recolored button.
// ─────────────────────────────────────────────────────────────────────────
export function Switch({ on, onChange, cs, tone = "blue", disabled, label }) {
  const toneColor = { blue: cs.blue || LT.color.info, purple: "#a78bfa", teal: "#38bdf8", green: LT.color.good }[tone] || (cs.blue || LT.color.info);
  return (
    <button onClick={onChange} disabled={disabled} role="switch" aria-checked={on} aria-label={label}
      className="liveui-focusable"
      style={{
        width: 38, height: 22, borderRadius: LT.radius.pill, flexShrink: 0, position: "relative",
        background: on ? toneColor : (cs.inpB || "rgba(148,163,184,.25)"),
        border: "none", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
        padding: 0, transition: `background ${LT.duration.fast}ms ease`,
      }}>
      <span style={{
        position: "absolute", top: 2, insetInlineStart: on ? 18 : 2, width: 18, height: 18,
        borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.4)",
        transition: `inset-inline-start ${LT.duration.fast}ms ease`,
      }} />
    </button>
  );
}

export function SettingsRow({ icon, label, sub, right, cs, onClick, disabled }) {
  // Rows that pass onClick (Alert rules, Download PDF) render as a real
  // <button> so keyboard users can Tab to and activate them — this used to
  // be a <div onClick> with no tabIndex/role, silently unreachable by
  // keyboard regardless of `disabled`. Rows without onClick (the Switch-based
  // ones — Face blur, Skeleton, etc.) stay a plain <div>: their `right` slot
  // is itself an interactive control, and a <button> can't legally nest one.
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={disabled ? undefined : onClick} disabled={onClick ? disabled : undefined} style={{
      display: "flex", alignItems: "center", gap: 10, padding: "9px 2px",
      cursor: onClick && !disabled ? "pointer" : "default", opacity: disabled ? 0.5 : 1,
      width: "100%", background: "transparent", border: "none", font: "inherit", color: "inherit", textAlign: "inherit",
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: LT.radius.sm, background: cs.inp || "rgba(255,255,255,.04)",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <Icon name={icon} size={14} color={cs.muted} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: LT.font.sm, fontWeight: 600, color: cs.text }}>{label}</div>
        {sub && <div style={{ fontSize: LT.font.xs, color: cs.muted, marginTop: 1, lineHeight: 1.4 }}>{sub}</div>}
      </div>
      {right}
    </Tag>
  );
}

export function SettingsDivider({ cs }) {
  return <div style={{ height: 1, background: cs.border, margin: "2px 0" }} />;
}

export function StatTile({ label, value, cs, tone = "neutral" }) {
  const color = tone === "neutral" ? cs.text : LT.color[tone];
  return (
    <div style={{
      background: cs.card, border: `1px solid ${cs.border}`, borderRadius: LT.radius.md,
      padding: "16px 14px", display: "flex", flexDirection: "column", gap: 4, minWidth: 0,
    }}>
      <div style={{ fontSize: 26, fontWeight: 800, color, letterSpacing: "-.03em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: LT.font.xs, color: cs.muted, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }}>{label}</div>
    </div>
  );
}

export function MetricRow({ label, value, unit, score, cs }) {
  const color = score > 0 ? scoreTierColor(score) : cs.muted;
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "9px 0", borderBottom: `1px solid ${cs.border}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
        <span style={{ fontSize: LT.font.sm, color: cs.text, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
      </div>
      <span style={{ fontSize: LT.font.sm, color: cs.muted, fontWeight: 600, fontVariantNumeric: "tabular-nums", flexShrink: 0, marginInlineStart: 8 }}>
        {value}{unit || ""}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// HEADER
// ─────────────────────────────────────────────────────────────────────────
export function LiveHeader({
  isAr, cs, darkMode, onBack, onToggleDark, onToggleLang,
  mpStatus, camActive, timeLabel, tierLabel, aiCoachStatus,
  showUpgrade, onUpgrade, onOpenSettings,
}) {
  // BUG FIX: "fallback" means analysis switched to running server-side
  // instead of on-device — it still works fully, it's just slower. This
  // used to render as an amber "AI: Fallback" pill with no explanation,
  // which reads as broken/degraded to a non-technical user when nothing
  // is actually wrong. Softened to an "info" tone with a plain-language
  // label and a hover tooltip explaining what it means.
  const mpTone = mpStatus === "ready" ? "good" : mpStatus === "loading" ? "info" : mpStatus === "fallback" ? "info" : "bad";
  const mpIcon = mpTone === "good" ? "checkCircle" : mpTone === "bad" ? "alertTriangle" : "infoCircle";
  const mpLabel = { ready: isAr ? "جاهز" : "Ready", loading: isAr ? "تحميل" : "Loading", fallback: isAr ? "يعمل (سيرفر)" : "Active (cloud)", error: isAr ? "خطأ" : "Error" }[mpStatus] || mpStatus;
  const mpTitle = mpStatus === "fallback" ? (isAr ? "تحليل الوضعية شغال عادي، بس بيتم على السيرفر بدل جهازك — أبطأ شوية بس نفس الدقة" : "Posture analysis is working normally, just running on our server instead of your device — slightly slower, same accuracy") : undefined;
  const coachTone = aiCoachStatus?.error ? "bad" : aiCoachStatus?.ready ? "good" : "info";
  const coachIcon = aiCoachStatus?.error ? "alertTriangle" : aiCoachStatus?.ready ? "checkCircle" : "infoCircle";
  const coachLabel = aiCoachStatus?.ready
    ? (isAr ? "المدرب ✓" : "Coach ✓")
    : aiCoachStatus?.loading
    ? (isAr ? `المدرب ${aiCoachStatus.progress}%` : `Coach ${aiCoachStatus.progress}%`)
    : (isAr ? "المدرب..." : "Coach…");
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 10, padding: "12px 14px",
      borderBottom: `1px solid ${cs.border}`,
    }}>
      {/* Left: back + title + tier */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: "0 1 auto" }}>
        {onBack && <IconBtn name="back" label={isAr ? "رجوع" : "Back"} onClick={onBack} cs={cs} />}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: LT.font.base, fontWeight: 800, color: cs.text, letterSpacing: "-.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {isAr ? "تحليل الوضعية المباشر" : "Live Posture Analysis"}
          </div>
          {tierLabel && <div style={{ fontSize: LT.font.xs, color: cs.muted, fontWeight: 600, marginTop: 1 }}>{tierLabel}</div>}
        </div>
      </div>

      {/* Centre: status pills — compact, no labels repeated */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
        <StatusPill icon={mpIcon} label={`${isAr ? "الذكاء" : "AI"}: ${mpLabel}`} tone={mpTone} cs={cs} pulse={mpStatus === "loading"} title={mpTitle} />
        {aiCoachStatus && <StatusPill icon={coachIcon} label={coachLabel} tone={coachTone} cs={cs} pulse={!aiCoachStatus.ready && !aiCoachStatus.error} />}
        {camActive && (
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "4px 10px", borderRadius: 99,
            background: "rgba(79,174,142,.12)", border: "1px solid rgba(79,174,142,.3)",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4FAE8E", animation: "pulse 1.5s ease-in-out infinite", flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#4FAE8E", fontVariantNumeric: "tabular-nums", letterSpacing: ".02em" }}>{timeLabel}</span>
          </div>
        )}
      </div>

      {/* Right: utility icons */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
        {showUpgrade && <Btn size="sm" variant="secondary" icon="star" onClick={onUpgrade} cs={cs} style={{ height: 30, fontSize: 11 }}>{isAr ? "ترقية" : "Upgrade"}</Btn>}
        <IconBtn name={darkMode ? "sun" : "moon"} label={isAr ? "تبديل السمة" : "Toggle theme"} onClick={onToggleDark} cs={cs} />
        <IconBtn name="globe" label={isAr ? "اللغة" : "Language"} onClick={onToggleLang} cs={cs} />
        {onOpenSettings && <IconBtn name="settings" label={isAr ? "الإعدادات" : "Settings"} onClick={onOpenSettings} cs={cs} />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCORE GAUGE
// ─────────────────────────────────────────────────────────────────────────
export function ScoreGauge({ score = 0, grade, size = 140, strokeWidth = 10, cs, sublabel }) {
  const pct = Math.max(0, Math.min(100, score));
  const color = scoreTierColor(score);
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * (pct / 100);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)", display: "block" }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={cs.border} strokeWidth={strokeWidth} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
            strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
            style={{ transition: `stroke-dasharray ${LT.duration.slow}ms ease, stroke ${LT.duration.slow}ms ease` }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: LT.font.xxl, fontWeight: 800, color: cs.text, letterSpacing: "-.03em", lineHeight: 1 }}>{Math.round(score)}</div>
          <div style={{ fontSize: LT.font.xs, color: cs.muted, fontWeight: 600, marginTop: 2 }}>/100</div>
        </div>
      </div>
      {grade && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6, padding: "4px 12px",
          borderRadius: LT.radius.pill, background: alpha(color, 0.12), border: `1px solid ${alpha(color, 0.28)}`,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
          <span style={{ fontSize: LT.font.sm, fontWeight: 700, color }}>{grade}</span>
        </div>
      )}
      {sublabel && <div style={{ fontSize: LT.font.xs, color: cs.muted, textAlign: "center", maxWidth: 240, lineHeight: 1.5 }}>{sublabel}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// AI COACH
// ─────────────────────────────────────────────────────────────────────────
export function AICoachCard({ text, isAr, cs, locked, onUnlock, maxLines = 3 }) {
  if (locked) {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
        borderRadius: LT.radius.md, background: cs.card2 || cs.card, border: `1px solid ${cs.border}`,
      }}>
        <Icon name="lock" size={16} color={cs.muted} />
        <div style={{ flex: 1, fontSize: LT.font.xs, color: cs.muted, lineHeight: 1.5 }}>
          {isAr ? "مدرب الذكاء الاصطناعي متاح لمستخدمي Elite" : "AI Coach is available on the Elite plan"}
        </div>
        {onUnlock && <Btn size="sm" variant="secondary" onClick={onUnlock} cs={cs}>{isAr ? "ترقية" : "Upgrade"}</Btn>}
      </div>
    );
  }
  if (!text) return null;
  return (
    <div style={{ padding: "14px 16px", borderRadius: LT.radius.md, background: alpha(LT.color.info, 0.06), border: `1px solid ${alpha(LT.color.info, 0.18)}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
        <Icon name="mic" size={14} color={LT.color.info} />
        <span style={{ fontSize: LT.font.xs, fontWeight: 700, color: LT.color.info, textTransform: "uppercase", letterSpacing: ".04em" }}>
          {isAr ? "مدرب الذكاء الاصطناعي" : "AI Coach"}
        </span>
      </div>
      <div style={{
        fontSize: LT.font.sm, color: cs.text, lineHeight: 1.6,
        display: "-webkit-box", WebkitLineClamp: maxLines, WebkitBoxOrient: "vertical", overflow: "hidden",
      }}>
        {text}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// CAMERA STAGE CHROME (frame + generic overlay/card primitives — the actual
// per-state content/handlers stay in App.jsx and are passed as children)
// ─────────────────────────────────────────────────────────────────────────
export function CameraFrame({ innerRef, children, isFs, minHeight = 320 }) {
  return (
    <div ref={innerRef} style={{
      position: "relative", borderRadius: isFs ? 0 : LT.radius.lg, overflow: "hidden",
      background: "#020810", minHeight, width: "100%",
    }}>
      {children}
    </div>
  );
}

export function CameraOverlay({ children, align = "center", scrim = true }) {
  return (
    <div style={{
      position: "absolute", inset: 0, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: align, gap: 12, padding: 20,
      background: scrim ? "linear-gradient(180deg, rgba(2,8,16,.25), rgba(2,8,16,.8))" : "transparent",
      textAlign: "center", animation: `liveuiFadeIn ${LT.duration.base}ms ease`, zIndex: 3,
    }}>
      {children}
    </div>
  );
}

export function OverlayCard({ children, cs, maxWidth = 300 }) {
  return (
    <div style={{
      background: cs.card, border: `1px solid ${cs.border}`, borderRadius: LT.radius.md,
      padding: "16px 18px", maxWidth, boxShadow: "0 8px 24px rgba(0,0,0,.35)",
    }}>
      {children}
    </div>
  );
}

export function CountdownRing({ n, size = 92 }) {
  return (
    <div key={n} style={{
      width: size, height: size, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
      background: alpha(LT.color.info, 0.16), border: `2px solid ${alpha(LT.color.info, 0.45)}`,
      animation: `liveuiPop ${LT.duration.base}ms ease`,
    }}>
      <span style={{ fontSize: 38, fontWeight: 800, color: "#fff" }}>{n}</span>
    </div>
  );
}

// Shown for the brief (usually well under a second, capped ~1.2s) window
// between the 3-2-1 countdown finishing and the session actually going
// live — without this, that gap read as the page freezing/breaking.
export function StartingRing({ size = 92, label }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div style={{
        width: size, height: size, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
        background: alpha(LT.color.info, 0.16), border: `2px solid ${alpha(LT.color.info, 0.45)}`,
      }}>
        <div style={{ width: size * 0.42, height: size * 0.42, animation: "liveuiSpin 900ms linear infinite" }}>
          <Icon name="refresh" size={size * 0.42} color="#fff" strokeWidth={2.25} />
        </div>
      </div>
      {label && <div style={{ fontSize: LT.font.sm, fontWeight: 700, color: "#fff" }}>{label}</div>}
    </div>
  );
}

export function GuidanceHint({ icon = "user", title, desc, cs }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, maxWidth: 260 }}>
      <div style={{ width: 44, height: 44, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,.1)" }}>
        <Icon name={icon} size={20} color="#fff" />
      </div>
      {title && <div style={{ fontSize: LT.font.sm, fontWeight: 700, color: "#fff" }}>{title}</div>}
      {desc && <div style={{ fontSize: LT.font.xs, color: "rgba(255,255,255,.75)", lineHeight: 1.5 }}>{desc}</div>}
    </div>
  );
}
