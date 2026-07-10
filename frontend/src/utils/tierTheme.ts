/**
 * AA-safe color derivation for loyalty tier badges, chips, and progress bars.
 *
 * Backend tier colors (`tier.color` / `tier_color`, see loyaltyService.ts) are
 * raw metal hexes — Bronze #CD7F32, Silver #C0C0C0, Gold #FFD700, Platinum
 * #E5E4E2 — chosen to *look* like the metal, not to pass contrast checks.
 * #FFD700 (gold) on a white card is ~1.6:1, far below WCAG AA. This module
 * maps those raw values (or an arbitrary future tier color) onto a small,
 * curated theme that is guaranteed to be legible:
 *
 *   accent  — saturated-but-safe hue for icons/strokes/borders (>=3:1 vs white)
 *   tintBg  — a soft ~10% tint of the accent over the app's warm page surface
 *   onTint  — text color guaranteed >=4.5:1 (WCAG AA normal text) on tintBg
 *
 * Pure TypeScript, zero dependencies, no Tailwind coupling.
 */

export type TierTheme = {
  accent: string;
  tintBg: string;
  onTint: string;
};

type Rgb = { r: number; g: number; b: number };
type Hsl = { h: number; s: number; l: number };
type CuratedTierKey = 'bronze' | 'silver' | 'gold' | 'platinum';

// The app's warm page surface that tinted chip/band backgrounds blend onto.
const PAGE_SURFACE_HEX = '#FAF9F7';

// tintBg is the accent blended 10% into the page surface.
const TINT_BLEND_RATIO = 0.1;

// WCAG AA thresholds this module guarantees.
const MIN_ACCENT_CONTRAST_VS_WHITE = 3.0;
const MIN_TEXT_CONTRAST_VS_TINT = 4.5;

const MIN_LIGHTNESS_PERCENT = 2;
const LIGHTNESS_STEP_PERCENT = 1;

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

// Curated, hand-tuned palette for the four known loyalty tiers. Values are
// verified in tierTheme.test.ts to satisfy both AA contracts above.
const CURATED_PALETTE = new Map<CuratedTierKey, { accent: string; onTint: string }>([
  ['bronze', { accent: '#9A6540', onTint: '#6B4426' }],
  ['silver', { accent: '#78716C', onTint: '#57534E' }],
  ['gold', { accent: '#B98730', onTint: '#8B631D' }],
  ['platinum', { accent: '#57534E', onTint: '#3F3B38' }],
]);

// Known raw metal hexes the backend sends today, mapped to the curated tier.
// A Map (rather than an indexed object) keeps lookups of this
// externally-supplied key safe from prototype-pollution/injection concerns.
const KNOWN_METAL_HEX_TO_TIER = new Map<string, CuratedTierKey>([
  ['#cd7f32', 'bronze'],
  ['#c0c0c0', 'silver'],
  ['#ffd700', 'gold'],
  ['#e5e4e2', 'platinum'],
]);

// Legacy fallback color from MemberCardPage predating the tier system.
// Intentionally resolves to the neutral DEFAULT theme, not a curated metal.
const LEGACY_FALLBACK_HEX = '#7f1d1d';

// DEFAULT theme used when tierColor is missing, invalid, or the legacy fallback.
const DEFAULT_ACCENT = '#57534E';
const DEFAULT_ON_TINT = '#44403C';

function clampByte(value: number): number {
  return Math.min(255, Math.max(0, value));
}

function hexToRgb(hex: string): Rgb {
  const normalized = hex.trim().replace('#', '');
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: Rgb): string {
  const toHexByte = (channel: number) => Math.round(clampByte(channel)).toString(16).padStart(2, '0');
  return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`.toUpperCase();
}

function srgbChannelToLinear(channel: number): number {
  const normalizedChannel = channel / 255;
  return normalizedChannel <= 0.03928
    ? normalizedChannel / 12.92
    : Math.pow((normalizedChannel + 0.055) / 1.055, 2.4);
}

function relativeLuminance(rgb: Rgb): number {
  return (
    0.2126 * srgbChannelToLinear(rgb.r) +
    0.7152 * srgbChannelToLinear(rgb.g) +
    0.0722 * srgbChannelToLinear(rgb.b)
  );
}

/** WCAG 2.x contrast ratio between two hex colors, in the range [1, 21]. */
export function contrastRatio(hexA: string, hexB: string): number {
  const luminanceA = relativeLuminance(hexToRgb(hexA));
  const luminanceB = relativeLuminance(hexToRgb(hexB));
  const lighterLuminance = Math.max(luminanceA, luminanceB);
  const darkerLuminance = Math.min(luminanceA, luminanceB);
  return (lighterLuminance + 0.05) / (darkerLuminance + 0.05);
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const lightness = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: lightness * 100 };
  }

  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);

  let hue: number;
  if (max === rNorm) {
    hue = (gNorm - bNorm) / delta + (gNorm < bNorm ? 6 : 0);
  } else if (max === gNorm) {
    hue = (bNorm - rNorm) / delta + 2;
  } else {
    hue = (rNorm - gNorm) / delta + 4;
  }

  return { h: hue * 60, s: saturation * 100, l: lightness * 100 };
}

function hueToChannel(p: number, q: number, tRaw: number): number {
  let t = tRaw;
  if (t < 0) {
    t += 1;
  }
  if (t > 1) {
    t -= 1;
  }
  if (t < 1 / 6) {
    return p + (q - p) * 6 * t;
  }
  if (t < 1 / 2) {
    return q;
  }
  if (t < 2 / 3) {
    return p + (q - p) * (2 / 3 - t) * 6;
  }
  return p;
}

function hslToRgb({ h, s, l }: Hsl): Rgb {
  const hueFraction = h / 360;
  const saturationFraction = s / 100;
  const lightnessFraction = l / 100;

  if (saturationFraction === 0) {
    const gray = lightnessFraction * 255;
    return { r: gray, g: gray, b: gray };
  }

  const q =
    lightnessFraction < 0.5
      ? lightnessFraction * (1 + saturationFraction)
      : lightnessFraction + saturationFraction - lightnessFraction * saturationFraction;
  const p = 2 * lightnessFraction - q;

  return {
    r: hueToChannel(p, q, hueFraction + 1 / 3) * 255,
    g: hueToChannel(p, q, hueFraction) * 255,
    b: hueToChannel(p, q, hueFraction - 1 / 3) * 255,
  };
}

/** Blends `weightA` of hexA with the remainder of hexB. */
function mix(hexA: string, hexB: string, weightA: number): string {
  const colorA = hexToRgb(hexA);
  const colorB = hexToRgb(hexB);
  return rgbToHex({
    r: colorA.r * weightA + colorB.r * (1 - weightA),
    g: colorA.g * weightA + colorB.g * (1 - weightA),
    b: colorA.b * weightA + colorB.b * (1 - weightA),
  });
}

/**
 * Reduces lightness in HSL space (hue/saturation held constant) until the
 * result reaches `minContrast` against `background`, or bottoms out near
 * black. Returns the starting color unchanged if it already qualifies.
 */
function darkenUntilContrast(hex: string, background: string, minContrast: number): string {
  const startingHsl = rgbToHsl(hexToRgb(hex));

  let candidateHex = hex;
  for (
    let lightness = startingHsl.l;
    lightness >= MIN_LIGHTNESS_PERCENT;
    lightness -= LIGHTNESS_STEP_PERCENT
  ) {
    candidateHex = rgbToHex(hslToRgb({ h: startingHsl.h, s: startingHsl.s, l: lightness }));
    if (contrastRatio(candidateHex, background) >= minContrast) {
      return candidateHex;
    }
  }
  return candidateHex;
}

function buildTintBg(accent: string): string {
  return mix(accent, PAGE_SURFACE_HEX, TINT_BLEND_RATIO);
}

function buildCuratedTheme(tierKey: CuratedTierKey): TierTheme {
  const curated = CURATED_PALETTE.get(tierKey);
  if (!curated) {
    // Unreachable in practice: CURATED_PALETTE has an entry for every
    // CuratedTierKey. Fall back to DEFAULT rather than throwing.
    return buildDefaultTheme();
  }
  const { accent, onTint } = curated;
  return { accent, tintBg: buildTintBg(accent), onTint };
}

function buildDefaultTheme(): TierTheme {
  const tintBg = buildTintBg(DEFAULT_ACCENT);
  const onTint = darkenUntilContrast(DEFAULT_ON_TINT, tintBg, MIN_TEXT_CONTRAST_VS_TINT);
  return { accent: DEFAULT_ACCENT, tintBg, onTint };
}

function buildDerivedTheme(rawHex: string): TierTheme {
  const accent = darkenUntilContrast(rawHex, '#FFFFFF', MIN_ACCENT_CONTRAST_VS_WHITE);
  const tintBg = buildTintBg(accent);
  const onTint = darkenUntilContrast(accent, tintBg, MIN_TEXT_CONTRAST_VS_TINT);
  return { accent, tintBg, onTint };
}

function isValidHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR_PATTERN.test(value.trim());
}

function normalizeTierName(tierName?: string | null): string {
  return (tierName ?? '').trim().toLowerCase();
}

function matchCuratedTierByName(tierName?: string | null): CuratedTierKey | undefined {
  const normalized = normalizeTierName(tierName);
  if (
    normalized === 'bronze' ||
    normalized === 'silver' ||
    normalized === 'gold' ||
    normalized === 'platinum'
  ) {
    return normalized;
  }
  return undefined;
}

function matchCuratedTierByHex(tierColor?: string | null): CuratedTierKey | undefined {
  if (!isValidHexColor(tierColor)) {
    return undefined;
  }
  return KNOWN_METAL_HEX_TO_TIER.get(tierColor.trim().toLowerCase());
}

function isLegacyFallbackHex(tierColor?: string | null): boolean {
  return isValidHexColor(tierColor) && tierColor.trim().toLowerCase() === LEGACY_FALLBACK_HEX;
}

function resolveTierTheme(tierName?: string | null, tierColor?: string | null): TierTheme {
  const curatedKeyFromName = matchCuratedTierByName(tierName);
  if (curatedKeyFromName) {
    return buildCuratedTheme(curatedKeyFromName);
  }

  const curatedKeyFromHex = matchCuratedTierByHex(tierColor);
  if (curatedKeyFromHex) {
    return buildCuratedTheme(curatedKeyFromHex);
  }

  if (isLegacyFallbackHex(tierColor)) {
    return buildDefaultTheme();
  }

  if (isValidHexColor(tierColor)) {
    return buildDerivedTheme(tierColor);
  }

  return buildDefaultTheme();
}

const themeCache = new Map<string, TierTheme>();

function cacheKeyFor(tierName?: string | null, tierColor?: string | null): string {
  return `${tierName ?? ''}::${tierColor ?? ''}`;
}

/**
 * Resolves a backend-supplied tier name/color into an AA-safe {@link TierTheme}.
 * Results are memoized (identical inputs return the same object reference),
 * since this is expected to be called from render paths.
 */
export function tierTheme(tierName?: string | null, tierColor?: string | null): TierTheme {
  const cacheKey = cacheKeyFor(tierName, tierColor);
  const cachedTheme = themeCache.get(cacheKey);
  if (cachedTheme) {
    return cachedTheme;
  }

  const theme = resolveTierTheme(tierName, tierColor);
  themeCache.set(cacheKey, theme);
  return theme;
}
