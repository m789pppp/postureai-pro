/**
 * Corvus — Design System v1
 * Single source of truth for all UI tokens
 * Import: import { DS, Comp } from "./DesignSystem.js"
 */

// ─────────────────────────────────────────────
// TYPOGRAPHY SCALE
// ─────────────────────────────────────────────
export const TYPE = {
  fontSans:  "'DM Sans', system-ui, -apple-system, sans-serif",
  fontMono:  "'DM Mono', 'Fira Code', monospace",
  // sizes
  xs:   10,   // labels, badges, captions
  sm:   11.5, // secondary text, table cells
  base: 13,   // body, buttons
  md:   15,   // card titles
  lg:   18,   // section headers
  xl:   22,   // page titles
  "2xl": 28,  // hero numbers
  "3xl": 38,  // big stats
  // weights
  regular: 400,
  medium:  500,
  semibold:600,
  bold:    700,
  extrabold:800,
  // line heights
  tight:  1.15,
  snug:   1.35,
  normal: 1.6,
  // letter spacing
  tighter: "-.04em",
  tight_ls:"-.02em",
  normal_ls:"0",
  wide:   ".04em",
  wider:  ".08em",
  widest: ".12em",
};

// ─────────────────────────────────────────────
// SPACING TOKENS (4px base grid)
// ─────────────────────────────────────────────
export const SPACE = {
  1:  4,
  2:  8,
  3:  12,
  4:  16,
  5:  20,
  6:  24,
  7:  28,
  8:  32,
  10: 40,
  12: 48,
  16: 64,
};

// ─────────────────────────────────────────────
// BORDER RADIUS
// ─────────────────────────────────────────────
export const RADIUS = {
  xs:  6,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  "2xl": 24,
  full: 9999,
};

// ─────────────────────────────────────────────
// COLOR SYSTEM — dark theme (default)
// ─────────────────────────────────────────────
export const COLORS = {
  // Backgrounds
  bg:        "#070b12",
  bgElevated:"#0c1220",
  surface:   "#101827",
  surfaceHov:"#141f30",
  overlay:   "rgba(0,0,0,.6)",

  // Borders
  border:    "rgba(255,255,255,.06)",
  borderHov: "rgba(255,255,255,.12)",
  borderFocus:"rgba(99,102,241,.5)",

  // Text
  text:      "#f1f5f9",
  textSub:   "#94a3b8",
  muted:     "#64748b",
  faint:     "#334155",

  // Brand
  blue:      "#6366f1",
  blueHov:   "#818cf8",
  blueDim:   "rgba(99,102,241,.12)",
  blueBorder:"rgba(99,102,241,.25)",
  blueGlow:  "rgba(99,102,241,.35)",

  // Semantic
  green:     "#10b981",
  greenDim:  "rgba(16,185,129,.08)",
  greenBorder:"rgba(16,185,129,.2)",

  amber:     "#f59e0b",
  amberDim:  "rgba(245,158,11,.08)",
  amberBorder:"rgba(245,158,11,.2)",

  red:       "#ef4444",
  redDim:    "rgba(239,68,68,.08)",
  redBorder: "rgba(239,68,68,.2)",

  sky:       "#38bdf8",
  skyDim:    "rgba(56,189,248,.1)",

  purple:    "#a78bfa",
  purpleDim: "rgba(167,139,250,.1)",

  // Gradients
  gradPrimary: "linear-gradient(135deg,#6366f1,#0891b2)",
  gradGreen:   "linear-gradient(135deg,#10b981,#0d9488)",
  gradAmber:   "linear-gradient(135deg,#f59e0b,#d97706)",
};

// ─────────────────────────────────────────────
// SHADOWS
// ─────────────────────────────────────────────
export const SHADOW = {
  sm:  "0 1px 3px rgba(0,0,0,.3)",
  md:  "0 4px 16px rgba(0,0,0,.4)",
  lg:  "0 8px 32px rgba(0,0,0,.5)",
  blue:"0 8px 28px rgba(99,102,241,.38)",
  glow:"0 0 0 3px rgba(99,102,241,.18)",
};

// ─────────────────────────────────────────────
// TRANSITIONS
// ─────────────────────────────────────────────
export const TRANS = {
  fast:   "all .12s ease",
  base:   "all .18s ease",
  slow:   "all .3s ease",
  spring: "all .4s cubic-bezier(.16,1,.3,1)",
};

// ─────────────────────────────────────────────
// GLOBAL CSS (inject once in App)
// ─────────────────────────────────────────────
export const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&family=DM+Mono:wght@400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
::-webkit-scrollbar{width:4px;height:4px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08);border-radius:99px}
input,select,button,textarea{font-family:inherit}
@keyframes ds-fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes ds-pulse{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes ds-glow{0%,100%{box-shadow:0 0 20px rgba(99,102,241,.28)}50%{box-shadow:0 0 36px rgba(99,102,241,.52)}}
@keyframes ds-shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
@keyframes ds-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
.ds-fade-1{animation:ds-fadeUp .3s .04s both}
.ds-fade-2{animation:ds-fadeUp .3s .09s both}
.ds-fade-3{animation:ds-fadeUp .3s .14s both}
.ds-fade-4{animation:ds-fadeUp .3s .19s both}
.ds-fade-5{animation:ds-fadeUp .3s .24s both}
.ds-fade-6{animation:ds-fadeUp .3s .29s both}
.ds-row-hov:hover{background:rgba(255,255,255,.025)!important}
.ds-card-hov{transition:border-color .18s,transform .18s,box-shadow .18s}
.ds-card-hov:hover{border-color:rgba(99,102,241,.3)!important;transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.3)}
`;

// ─────────────────────────────────────────────
// COMPONENT PRESETS (inline style objects)
// ─────────────────────────────────────────────
export const COMP = {
  // Cards
  card: {
    background: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.lg,
    overflow: "hidden",
  },
  cardInner: {
    background: COLORS.bgElevated,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.md,
    overflow: "hidden",
  },

  // Inputs
  input: {
    background: "rgba(255,255,255,.04)",
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.sm,
    padding: "9px 14px",
    fontSize: TYPE.sm,
    color: COLORS.text,
    outline: "none",
    width: "100%",
    fontFamily: TYPE.fontSans,
    transition: TRANS.fast,
  },

  // Buttons
  btnPrimary: {
    background: COLORS.gradPrimary,
    border: "none",
    borderRadius: RADIUS.sm,
    padding: "10px 20px",
    fontSize: TYPE.base,
    fontWeight: TYPE.semibold,
    color: "white",
    cursor: "pointer",
    fontFamily: TYPE.fontSans,
    transition: TRANS.base,
    boxShadow: SHADOW.blue,
  },
  btnSecondary: {
    background: COLORS.blueDim,
    border: `1px solid ${COLORS.blueBorder}`,
    borderRadius: RADIUS.sm,
    padding: "10px 20px",
    fontSize: TYPE.base,
    fontWeight: TYPE.semibold,
    color: COLORS.blue,
    cursor: "pointer",
    fontFamily: TYPE.fontSans,
    transition: TRANS.base,
  },
  btnGhost: {
    background: "transparent",
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.sm,
    padding: "8px 16px",
    fontSize: TYPE.sm,
    fontWeight: TYPE.medium,
    color: COLORS.muted,
    cursor: "pointer",
    fontFamily: TYPE.fontSans,
    transition: TRANS.base,
  },
  btnDanger: {
    background: COLORS.redDim,
    border: `1px solid ${COLORS.redBorder}`,
    borderRadius: RADIUS.sm,
    padding: "8px 16px",
    fontSize: TYPE.sm,
    fontWeight: TYPE.semibold,
    color: COLORS.red,
    cursor: "pointer",
    fontFamily: TYPE.fontSans,
    transition: TRANS.base,
  },
  btnSuccess: {
    background: COLORS.greenDim,
    border: `1px solid ${COLORS.greenBorder}`,
    borderRadius: RADIUS.sm,
    padding: "8px 16px",
    fontSize: TYPE.sm,
    fontWeight: TYPE.semibold,
    color: COLORS.green,
    cursor: "pointer",
    fontFamily: TYPE.fontSans,
    transition: TRANS.base,
  },

  // Badge
  badge: (color, bg) => ({
    display: "inline-flex",
    alignItems: "center",
    fontSize: TYPE.xs,
    fontWeight: TYPE.bold,
    letterSpacing: TYPE.wide,
    padding: "2px 8px",
    borderRadius: RADIUS.full,
    color:  color || COLORS.muted,
    background: bg || "rgba(100,116,139,.1)",
  }),

  // Section header
  sectionLabel: {
    fontSize: TYPE.xs,
    fontWeight: TYPE.bold,
    color: COLORS.muted,
    letterSpacing: TYPE.widest,
    textTransform: "uppercase",
    marginBottom: SPACE[3],
  },

  // Divider
  divider: {
    height: 1,
    background: COLORS.border,
    margin: `${SPACE[4]}px 0`,
  },

  // Modal overlay
  overlay: {
    position: "fixed",
    inset: 0,
    background: COLORS.overlay,
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    zIndex: 200,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: SPACE[4],
  },

  // Modal box
  modal: {
    background: COLORS.bgElevated,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS["2xl"],
    width: "100%",
    maxWidth: 480,
    maxHeight: "92vh",
    overflowY: "auto",
  },
};

// ─────────────────────────────────────────────
// SCORE HELPERS
// ─────────────────────────────────────────────
export const scoreColor = v => v >= 75 ? COLORS.green : v >= 50 ? COLORS.amber : COLORS.red;
export const scoreGrade = (v, ar) =>
  v >= 85 ? (ar?"ممتاز":"Excellent") :
  v >= 70 ? (ar?"جيد":"Good")        :
  v >= 50 ? (ar?"مقبول":"Fair")      :
            (ar?"ضعيف":"Poor");
export const tierMeta = {
  elite:        { color:"#a78bfa", bg:"rgba(167,139,250,.1)", border:"rgba(167,139,250,.25)" },
  professional: { color:"#38bdf8", bg:"rgba(56,189,248,.1)",  border:"rgba(56,189,248,.25)"  },
  standard:     { color:"#64748b", bg:"rgba(100,116,139,.1)", border:"rgba(100,116,139,.2)"  },
};

// ── DESIGN convenience bundle ────────────────────────────────────
// Backward-compat export for code that imports { DESIGN } from DesignSystem
export const DESIGN = { TYPE, SPACE, RADIUS, COLORS, SHADOW, TRANS, COMP, scoreColor, scoreGrade, tierMeta };
