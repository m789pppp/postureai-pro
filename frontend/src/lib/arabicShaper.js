// ─────────────────────────────────────────────────────────────────────
// Self-contained Arabic reshaper for jsPDF
// ─────────────────────────────────────────────────────────────────────
// jsPDF 4.x's built-in Arabic processor mangles common strings — it drops
// the definite-article alef ("الشاشة" → "لشاشة") and breaks lam-alef and
// taa-marbuta sequences. Rather than rely on it, we pre-shape Arabic text
// into Unicode Presentation Forms (U+FE70…U+FEFF), lay it out in visual
// (right-to-left) order ourselves, and hand jsPDF the finished glyph run —
// which its processor then leaves untouched.
//
// Scope: designed for the short labels/sentences used in the PDF reports
// (Arabic runs, optionally mixed with digits / latin / punctuation). It is
// a pragmatic bidi, not a full UAX#9 implementation: it shapes Arabic runs,
// reverses their visual order, and keeps neutral/latin runs in place.

// base letter → [isolated, final, initial, medial]
const FORMS = {
  0x0621: [0xFE80, 0xFE80, 0xFE80, 0xFE80], // ء hamza (non-joining)
  0x0622: [0xFE81, 0xFE82, 0xFE81, 0xFE82], // آ alef madda
  0x0623: [0xFE83, 0xFE84, 0xFE83, 0xFE84], // أ alef hamza above
  0x0624: [0xFE85, 0xFE86, 0xFE85, 0xFE86], // ؤ waw hamza
  0x0625: [0xFE87, 0xFE88, 0xFE87, 0xFE88], // إ alef hamza below
  0x0626: [0xFE89, 0xFE8A, 0xFE8B, 0xFE8C], // ئ yaa hamza
  0x0627: [0xFE8D, 0xFE8E, 0xFE8D, 0xFE8E], // ا alef
  0x0628: [0xFE8F, 0xFE90, 0xFE91, 0xFE92], // ب baa
  0x0629: [0xFE93, 0xFE94, 0xFE93, 0xFE94], // ة taa marbuta
  0x062A: [0xFE95, 0xFE96, 0xFE97, 0xFE98], // ت taa
  0x062B: [0xFE99, 0xFE9A, 0xFE9B, 0xFE9C], // ث thaa
  0x062C: [0xFE9D, 0xFE9E, 0xFE9F, 0xFEA0], // ج jeem
  0x062D: [0xFEA1, 0xFEA2, 0xFEA3, 0xFEA4], // ح haa
  0x062E: [0xFEA5, 0xFEA6, 0xFEA7, 0xFEA8], // خ khaa
  0x062F: [0xFEA9, 0xFEAA, 0xFEA9, 0xFEAA], // د dal
  0x0630: [0xFEAB, 0xFEAC, 0xFEAB, 0xFEAC], // ذ thal
  0x0631: [0xFEAD, 0xFEAE, 0xFEAD, 0xFEAE], // ر raa
  0x0632: [0xFEAF, 0xFEB0, 0xFEAF, 0xFEB0], // ز zay
  0x0633: [0xFEB1, 0xFEB2, 0xFEB3, 0xFEB4], // س seen
  0x0634: [0xFEB5, 0xFEB6, 0xFEB7, 0xFEB8], // ش sheen
  0x0635: [0xFEB9, 0xFEBA, 0xFEBB, 0xFEBC], // ص sad
  0x0636: [0xFEBD, 0xFEBE, 0xFEBF, 0xFEC0], // ض dad
  0x0637: [0xFEC1, 0xFEC2, 0xFEC3, 0xFEC4], // ط tah
  0x0638: [0xFEC5, 0xFEC6, 0xFEC7, 0xFEC8], // ظ zah
  0x0639: [0xFEC9, 0xFECA, 0xFECB, 0xFECC], // ع ain
  0x063A: [0xFECD, 0xFECE, 0xFECF, 0xFED0], // غ ghain
  0x0641: [0xFED1, 0xFED2, 0xFED3, 0xFED4], // ف faa
  0x0642: [0xFED5, 0xFED6, 0xFED7, 0xFED8], // ق qaf
  0x0643: [0xFED9, 0xFEDA, 0xFEDB, 0xFEDC], // ك kaf
  0x0644: [0xFEDD, 0xFEDE, 0xFEDF, 0xFEE0], // ل lam
  0x0645: [0xFEE1, 0xFEE2, 0xFEE3, 0xFEE4], // م meem
  0x0646: [0xFEE5, 0xFEE6, 0xFEE7, 0xFEE8], // ن noon
  0x0647: [0xFEE9, 0xFEEA, 0xFEEB, 0xFEEC], // ه haa
  0x0648: [0xFEED, 0xFEEE, 0xFEED, 0xFEEE], // و waw
  0x0649: [0xFEEF, 0xFEF0, 0xFEEF, 0xFEF0], // ى alef maksura
  0x064A: [0xFEF1, 0xFEF2, 0xFEF3, 0xFEF4], // ي yaa
  0x0640: [0x0640, 0x0640, 0x0640, 0x0640], // ـ tatweel
};

// Letters that connect to the following letter (can take initial/medial forms).
const DUAL = new Set([
  0x0626,0x0628,0x062A,0x062B,0x062C,0x062D,0x062E,0x0633,0x0634,0x0635,0x0636,
  0x0637,0x0638,0x0639,0x063A,0x0641,0x0642,0x0643,0x0644,0x0645,0x0646,0x0647,
  0x0649,0x064A,0x0640,
]);

// Lam-alef ligatures: [lam+alef base] → [isolated, final]
const LAM_ALEF = {
  0x0622: [0xFEF5, 0xFEF6], // lam + alef madda
  0x0623: [0xFEF7, 0xFEF8], // lam + alef hamza above
  0x0625: [0xFEF9, 0xFEFA], // lam + alef hamza below
  0x0627: [0xFEFB, 0xFEFC], // lam + alef
};

const isArabicLetter = cp => FORMS[cp] !== undefined;
const isDiacritic    = cp => (cp >= 0x064B && cp <= 0x065F) || cp === 0x0670 || (cp >= 0x06D6 && cp <= 0x06ED);
const isArabicChar   = cp => isArabicLetter(cp) || isDiacritic(cp) || cp === 0x0640;

export function hasArabic(str) {
  if (!str) return false;
  for (const ch of String(str)) { const c = ch.codePointAt(0); if (c >= 0x0600 && c <= 0x06FF) return true; }
  return false;
}

// Shape one pure-Arabic run into visual-order presentation forms.
function shapeRun(chars) {
  // chars: array of code points (logical order), Arabic letters + diacritics
  // Step 1: strip diacritics into "attach to previous letter" (we drop them
  // for layout simplicity — Cairo renders base letters cleanly; diacritics in
  // these short labels are cosmetic and jsPDF positions them poorly anyway).
  const letters = chars.filter(cp => !isDiacritic(cp));

  const out = [];
  for (let i = 0; i < letters.length; i++) {
    const cp = letters[i];
    // lam-alef ligature
    if (cp === 0x0644 && i + 1 < letters.length && LAM_ALEF[letters[i + 1]]) {
      const prev = letters[i - 1];
      const connectsBefore = prev !== undefined && DUAL.has(prev);
      out.push(LAM_ALEF[letters[i + 1]][connectsBefore ? 1 : 0]);
      i++; // consume alef
      continue;
    }
    const form = FORMS[cp];
    if (!form) { out.push(cp); continue; }
    const prev = letters[i - 1];
    const next = letters[i + 1];
    // prev must be a dual-joining letter (and not have been a lam-alef alef)
    const joinBefore = prev !== undefined && DUAL.has(prev);
    const joinAfter  = next !== undefined && isArabicLetter(next) && DUAL.has(cp);
    let g;
    if (joinBefore && joinAfter) g = form[3];      // medial
    else if (joinBefore)         g = form[1];      // final
    else if (joinAfter)          g = form[2];      // initial
    else                         g = form[0];      // isolated
    out.push(g);
  }
  out.reverse(); // logical → visual (RTL)
  return out;
}

// Reshape a full string: shape Arabic runs, keep other runs, order runs RTL.
export function shapeArabic(input) {
  const str = String(input);
  if (!hasArabic(str)) return str;

  const cps = Array.from(str, ch => ch.codePointAt(0));
  // Segment into runs: "ar" (arabic/diacritic) vs "other".
  const runs = [];
  let cur = null;
  for (const cp of cps) {
    const kind = isArabicChar(cp) ? "ar" : "other";
    if (!cur || cur.kind !== kind) { cur = { kind, cps: [] }; runs.push(cur); }
    cur.cps.push(cp);
  }

  // Build visual output. Overall direction is RTL, so we emit runs from the
  // last logical run to the first. Arabic runs are shaped+reversed internally;
  // "other" runs (digits, latin, spaces, punctuation) keep their internal
  // left-to-right order but are placed according to RTL run ordering.
  const visualRuns = [];
  for (const run of runs) {
    if (run.kind === "ar") visualRuns.push(shapeRun(run.cps));
    else visualRuns.push(run.cps); // keep order
  }
  visualRuns.reverse(); // RTL ordering of runs

  const flat = [];
  for (const r of visualRuns) for (const cp of r) flat.push(cp);
  return String.fromCodePoint(...flat);
}

// Install a wrapper on a jsPDF doc so every doc.text() call auto-reshapes
// Arabic. Idempotent per doc. Presentation-form output is left untouched by
// jsPDF's own processor, so no double-shaping occurs.
export function installArabicText(doc) {
  if (!doc || doc.__arShaped) return doc;
  const orig = doc.text.bind(doc);
  doc.text = function (text, x, y, options, ...rest) {
    let t = text;
    if (typeof t === "string") t = shapeArabic(t);
    else if (Array.isArray(t)) t = t.map(s => (typeof s === "string" ? shapeArabic(s) : s));
    // Neutralise jsPDF's own RTL/arabic handling — we already produced visual order.
    const opts = options && typeof options === "object" ? { ...options } : options;
    return orig(t, x, y, opts, ...rest);
  };
  doc.__arShaped = true;
  return doc;
}
