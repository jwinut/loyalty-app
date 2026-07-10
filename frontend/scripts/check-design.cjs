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
  const raw = fs.readFileSync(file, 'utf8');
  const text = raw.replace(SANCTIONED, '');
  for (const [name, re] of Object.entries(PATTERNS)) {
    const matches = text.match(re);
    if (matches) {
      counts[name] += matches.length;
      if (!examples[name]) examples[name] = path.relative(SRC_DIR, file);
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
