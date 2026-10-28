// Arabic/bidi text preparation for PDF generation.
//
// pdfkit draws text strictly left-to-right, character by character — it does
// not implement the Unicode bidi algorithm or Arabic glyph shaping. This
// helper converts logical strings into the "visual" strings pdfkit needs:
//
//   1. Arabic letters are mapped to their presentation forms (initial /
//      medial / final / lam-alef ligatures) so joined glyphs render properly.
//   2. Mixed directional text is reordered per UAX#9 rules: an Arabic letter
//      sets paragraph direction RTL (reorder runs), otherwise Arabic runs are
//      shaped inline within the LTR flow.
//   3. Digits (both ASCII and Arabic-Indic) always stay in left-to-right
//      order, as bidi requires.
//
// Requires a font that embeds Arabic Presentation Forms (Amiri ships with BoxEseg).

const RESHAPER_RE = /[\u0620-\u064A\u066E-\u06D3\u0750-\u077F\u08A0-\u08FF]/;

function isArabicDirectional(ch) {
  // Letters AND numerals — anything that resolves RTL context.
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(ch);
}

function hasArabic(text) {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text || '');
}

// Token classes for reordering:
//   ar  — Arabic letters (shaped + reversed for RTL display)
//   num — digit runs (ASCII or Arabic-Indic); kept LTR verbatim
//   ws  — whitespace (kept verbatim)
//   other — Latin words / punctuation / symbols (kept verbatim)
// Parenthesised groups keep separators like 'WCB-01' or '1,200.00' inside.
const TOKEN_RE = new RegExp(
  [
    // Arabic letters (with optional embedded digits — handled inside)
    '[\\u0620-\\u064A\\u066E-\\u06D3\\u0750-\\u077F\\u08A0-\\u08FF\\uFB50-\\uFDFF\\uFE70-\\uFEFF]+',
    '[\\u0660-\\u0669\\u06F0-\\u06F9]+',
    "[A-Za-z][A-Za-z0-9'&._/-]*",
    '[0-9]+(?:[.,][0-9]+)*',
    '\\s+',
    '[^\\s]',
  ].join('|'),
  'g'
);

let reshapeFn = null;
function getShaper() {
  if (reshapeFn === null) {
    reshapeFn = require('arabic-persian-reshaper').ArabicShaper.convertArabic;
  }
  return reshapeFn;
}

// Reverse a string char-by-char (codepoint-naive, fine for BMP presentation forms).
function reverseChars(s) {
  let out = '';
  for (let i = s.length - 1; i >= 0; i -= 1) out += s[i];
  return out;
}

function shapeArabicRun(run) {
  const shaped = getShaper()(run);
  // Inside an Arabic run, digit sequences must remain LTR while the letters
  // around them are reversed. Split the shaped run on digits: letters get
  // reversed, digits kept.
  return shaped
    .split(/([\u0660-\u0669\u06F0-\u06F9]+)/)
    .map((part) => (/^[\u0660-\u0669\u06F0-\u06F9]+$/.test(part) ? part : reverseChars(part)))
    .join('');
}

function tokenize(s) {
  return s.match(TOKEN_RE) || [];
}

/**
 * Convert logical text into the visual string pdfkit should draw.
 * @param {string} logical
 * @returns {{ text: string, rtl: boolean }}
 */
function toVisual(logical) {
  if (!logical) return { text: '', rtl: false };
  const s = String(logical);

  if (!hasArabic(s)) return { text: s, rtl: false };

  // First strong directional character decides paragraph direction (UAX#9 P2).
  let firstStrong = null;
  for (const ch of s) {
    if (isArabicDirectional(ch)) { firstStrong = 'rtl'; break; }
    if (/[A-Za-z]/.test(ch)) { firstStrong = 'ltr'; break; }
  }

  const tokens = tokenize(s);

  // LTR base: Arabic runs are shaped in place; everything else untouched.
  if (firstStrong === 'ltr') {
    const text = tokens
      .map((t) => (RESHAPER_RE.test(t[0]) ? shapeArabicRun(t) : t))
      .join('');
    return { text, rtl: false };
  }

  // RTL base: reverse the run order; shape + reverse Arabic runs.
  const text = tokens
    .slice()
    .reverse()
    .map((t) => (RESHAPER_RE.test(t[0]) ? shapeArabicRun(t) : t))
    .join('');
  return { text, rtl: true };
}

module.exports = { toVisual, hasArabic, RE: RESHAPER_RE };
