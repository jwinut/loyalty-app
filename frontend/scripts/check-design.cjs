#!/usr/bin/env node

/**
 * Design-system ratchet
 *
 * Counts banned styling patterns across src/ and compares each count against
 * the committed baseline (design-baseline.json). The build fails only when a
 * pattern's count INCREASES — existing debt is tolerated, new debt is not.
 * As pages migrate to the design system, run with --update to ratchet the
 * baseline down. When every count reaches 0 the script acts as a hard wall.
 *
 * Grammar being enforced (see the UI overhaul plan):
 *   - one accent (brand-*), warm neutrals only (stone/ink), no cool grays
 *   - weights 400/600/700 (500 "font-medium" and 800 "font-extrabold" banned)
 *   - radii: rounded-lg (8px) / rounded-card (18px) / rounded-full only
 *   - shadows: shadow-soft / shadow-pop only; legacy shadow-* are no-ops
 *   - type via the named scale (text-body/title/display...), not text-3xl
 *
 * Usage: node scripts/check-design.cjs [--update]
 * Exit codes: 0 = no pattern increased, 1 = regression found
 *
 * Final-sweep state (UI overhaul train, last wave): font-medium,
 * off-grammar-radii, and oversized-titles are at hard zero. hardcoded-hex is
 * at zero in effect — every remaining literal hex lives in a file on the
 * HEX_EXEMPT_FILES list below (color science, a library color-config API, or
 * an externally-mandated brand color), see that list for the case-by-case
 * rationale. legacy-shadows sits at 6, not 0: those are the literal CSS
 * `box-shadow` property in the .validation-error-highlight /
 * .validation-field-error rules (src/styles/index.css) that back
 * SurveyBuilder.tsx's inline validation feedback — real, working elevation
 * for a focus/error ring, not a dead legacy Tailwind utility, so the
 * "delete it" default from the sweep doesn't apply. The pattern's regex
 * matches the bare word "shadow" in "box-shadow" as a side effect of
 * catching Tailwind's `shadow`/`shadow-sm` classes; there's no way to write
 * that CSS property without tripping it.
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '../src');
const BASELINE_PATH = path.join(__dirname, 'design-baseline.json');

const PATTERNS = {
  'primary-alias': /\bprimary-[0-9]/g,                    // dead alias — must stay 0
  'cool-grays': /[\s'"`:](?:gray|slate|zinc|neutral)-[0-9]/g,
  'font-extrabold': /\bfont-extrabold\b/g,
  'font-medium': /\bfont-medium\b/g,                      // weight 500 is absent from the ladder
  'legacy-shadows': /\bshadow(?:-(?:sm|md|lg|xl|2xl|inner))?(?![-\w])/g, // anything but shadow-soft/pop/none
  'off-grammar-radii': /\brounded-(?:md|xl|2xl|3xl)\b/g,
  'oversized-titles': /\btext-(?:3xl|4xl|5xl)\b/g,
  'hardcoded-hex': /#[0-9a-fA-F]{6}\b/g,
};

// shadow-soft / shadow-pop / shadow-none are the sanctioned tokens; the
// legacy-shadows regex above would still match their "shadow" prefix, so
// strip them before counting.
const SANCTIONED = /\bshadow-(?:soft|pop|none)\b/g;

// Files exempt from the 'hardcoded-hex' pattern ONLY — every other pattern
// (font-medium, legacy-shadows, off-grammar-radii, oversized-titles) still
// applies to them in full. Each entry is either real color science, a
// third-party color literally mandated by an external spec/brand guideline,
// or a data value that mirrors a backend convention rather than a UI style
// — none of these have a meaningful design-token equivalent. Paths are
// relative to src/. Never add an entry here to silence an ordinary
// off-system color; convert it to a token instead.
const HEX_EXEMPT_FILES = new Map([
  // AA-safe color derivation for loyalty tier badges: raw backend metal
  // hexes (Bronze/Silver/Gold/Platinum) go in, a curated contrast-checked
  // palette comes out. The literal hex values are the subject matter the
  // module and its tests exist to compute/verify — see the file's own
  // header comment for the full rationale.
  ['utils/tierTheme.ts', 'color science: raw metal hex -> AA-safe curated tier palette'],
  ['utils/__tests__/tierTheme.test.ts', 'asserts the tierTheme.ts color-science contracts'],

  // Chart.js reads its theme via direct JS property assignment on canvas,
  // not Tailwind's class pipeline, so these constants have no utility-class
  // form to convert to.
  ['utils/chartTheme.ts', 'Chart.js canvas theme constants (no Tailwind class pipeline)'],
  ['utils/__tests__/chartTheme.test.ts', 'asserts the chartTheme.ts canvas constants'],

  // The `qrcode` package's toDataURL() takes a literal { dark, light } hex
  // pair for QR module colors — a library API contract, not CSS.
  ['components/coupons/QRCodeModal.tsx', 'QR module dark/light colors required by the qrcode lib API'],
  ['components/coupons/__tests__/QRCodeModal.test.tsx', 'asserts the QR color config above'],

  // Reserved for the wordmark's fixed HF crimson trace (see the brand
  // comment in tailwind.config.js) even though the current SVG trace uses
  // fill-current/fill-brand-600 and carries no literal hex today.
  ['components/brand/logo-art.tsx', "reserved for the logo's fixed crimson trace"],

  // Official third-party brand marks: Google's four-color "G" and LINE's
  // brand green are specified exactly by their own guidelines, independent
  // of our design system — same rationale as the logo trace above.
  ['components/auth/GoogleLoginButton.tsx', 'official Google "G" logo brand colors'],
  ['components/auth/__tests__/GoogleLoginButton.test.tsx', 'asserts the Google brand colors above'],
  ['components/auth/LineLoginButton.tsx', 'official LINE brand green'],
  ['components/auth/__tests__/LineLoginButton.test.tsx', 'asserts the LINE brand green above'],

  // Client-side default that mirrors the backend's raw-metal-hex
  // tier-color convention documented in tierTheme.ts — a data fallback,
  // not a UI style token.
  ['services/loyaltyService.ts', 'default tier_color mirrors the backend raw-metal-hex convention (see tierTheme.ts)'],

  // Test fixtures that feed backend-style raw tier_color hex through the
  // tierTheme() derivation pipeline and assert on the rendered result —
  // same color-science rationale as tierTheme.test.ts, exercised via the
  // consuming component instead of the utility directly.
  ['components/loyalty/__tests__/TierStatus.test.tsx', 'tier_color fixtures exercised through tierTheme()'],
  ['components/loyalty/__tests__/PointsAndTierCard.test.tsx', 'tier_color fixtures exercised through tierTheme()'],
  ['components/loyalty/__tests__/PointsBalance.test.tsx', 'tier_color fixtures exercised through tierTheme()'],
  ['components/loyalty/__tests__/LoyaltyCarousel.test.tsx', 'tier_color fixture exercised through tierTheme()'],
  ['pages/admin/__tests__/LoyaltyAdminPage.test.tsx', 'tier_color fixtures exercised through tierTheme()'],
  ['pages/__tests__/MemberCardPage.test.tsx', 'tier_color fixture exercised through tierTheme()'],
]);

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(tsx?|css)$/.test(entry.name)) files.push(full);
  }
  return files;
}

const counts = Object.fromEntries(Object.keys(PATTERNS).map((k) => [k, 0]));
const examples = {};

for (const file of walk(SRC_DIR)) {
  const relPath = path.relative(SRC_DIR, file).split(path.sep).join('/');
  const isHexExempt = HEX_EXEMPT_FILES.has(relPath);
  const raw = fs.readFileSync(file, 'utf8');
  const text = raw.replace(SANCTIONED, '');
  for (const [name, re] of Object.entries(PATTERNS)) {
    if (name === 'hardcoded-hex' && isHexExempt) continue;
    const matches = text.match(re);
    if (matches) {
      counts[name] += matches.length;
      if (!examples[name]) examples[name] = relPath;
    }
  }
}

if (process.argv.includes('--update')) {
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(counts, null, 2) + '\n');
  console.log('design-baseline.json updated:');
  console.table(counts);
  process.exit(0);
}

const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
let failed = false;
let improved = false;

for (const [name, count] of Object.entries(counts)) {
  const allowed = baseline[name] ?? 0;
  if (count > allowed) {
    failed = true;
    console.error(
      `✗ ${name}: ${count} occurrences (baseline ${allowed}) — new off-system styling introduced` +
        (examples[name] ? ` (first hit: src/${examples[name]})` : '')
    );
  } else if (count < allowed) {
    improved = true;
    console.log(`✓ ${name}: ${count} (baseline ${allowed} — ratchet down with --update)`);
  }
}

if (failed) {
  console.error(
    '\nDesign ratchet failed. Use the design-system tokens/primitives instead ' +
      '(brand-*, ink/surface/hairline, text-body/title/display, rounded-lg/card/full, ' +
      'shadow-soft/pop). See frontend/scripts/check-design.cjs header.'
  );
  process.exit(1);
}
if (improved) {
  console.log('\nDebt reduced — run `node scripts/check-design.cjs --update` to lock it in.');
}
console.log('Design ratchet OK.');
