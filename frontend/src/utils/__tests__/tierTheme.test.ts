import { describe, it, expect } from 'vitest';
import { tierTheme, contrastRatio, type TierTheme } from '../tierTheme';

const WHITE = '#FFFFFF';
const MIN_ACCENT_CONTRAST_VS_WHITE = 3.0;
const MIN_TEXT_CONTRAST_VS_TINT = 4.5;

const CURATED_TIER_NAMES = ['bronze', 'silver', 'gold', 'platinum'] as const;

const KNOWN_METAL_HEX_BY_TIER: Record<(typeof CURATED_TIER_NAMES)[number], string> = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
  platinum: '#E5E4E2',
};

/** Asserts a theme satisfies both WCAG AA guarantees this module promises. */
function expectThemeSatisfiesAAContract(theme: TierTheme): void {
  expect(contrastRatio(theme.accent, WHITE)).toBeGreaterThanOrEqual(MIN_ACCENT_CONTRAST_VS_WHITE);
  expect(contrastRatio(theme.onTint, theme.tintBg)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST_VS_TINT);
}

describe('tierTheme', () => {
  describe('curated tier palette contract', () => {
    it.each(CURATED_TIER_NAMES)('%s theme satisfies the AA contrast contract', (tierName) => {
      const theme = tierTheme(tierName, null);
      expectThemeSatisfiesAAContract(theme);
    });
  });

  describe('name matching', () => {
    it.each(CURATED_TIER_NAMES)('matches %s by name even when hex is unrelated/absent', (tierName) => {
      const withoutHex = tierTheme(tierName, undefined);
      const withUnrelatedHex = tierTheme(tierName, '#123456');
      expect(withoutHex).toEqual(withUnrelatedHex);
      expectThemeSatisfiesAAContract(withoutHex);
    });

    it('is case-insensitive', () => {
      expect(tierTheme('GOLD', null)).toEqual(tierTheme('gold', null));
      expect(tierTheme('Gold', null)).toEqual(tierTheme('gold', null));
      expect(tierTheme('gOlD', null)).toEqual(tierTheme('gold', null));
    });

    it('trims surrounding whitespace', () => {
      expect(tierTheme('  gold  ', null)).toEqual(tierTheme('gold', null));
      expect(tierTheme('\tsilver\n', null)).toEqual(tierTheme('silver', null));
    });

    it('takes priority over a conflicting known metal hex', () => {
      // Silver's name should win even when paired with gold's raw hex.
      const silverWithGoldHex = tierTheme('Silver', '#FFD700');
      const silverWithOwnHex = tierTheme('Silver', '#C0C0C0');
      expect(silverWithGoldHex).toEqual(silverWithOwnHex);
    });
  });

  describe('known metal hex matching', () => {
    it.each(CURATED_TIER_NAMES)('maps the raw %s metal hex to its curated theme', (tierName) => {
      const rawHex = KNOWN_METAL_HEX_BY_TIER[tierName];
      const byHex = tierTheme(undefined, rawHex);
      const byName = tierTheme(tierName, undefined);
      expect(byHex).toEqual(byName);
      expectThemeSatisfiesAAContract(byHex);
    });

    it('matches known metal hexes case-insensitively', () => {
      const lower = tierTheme(null, '#cd7f32');
      const upper = tierTheme(null, '#CD7F32');
      const mixedCase = tierTheme(null, '#Cd7F32');
      expect(lower).toEqual(upper);
      expect(lower).toEqual(mixedCase);
    });

    it('maps the legacy MemberCardPage fallback hex (#7f1d1d) to the DEFAULT theme, not bronze', () => {
      const legacyFallback = tierTheme(undefined, '#7f1d1d');
      const bronze = tierTheme('bronze', undefined);
      const defaultTheme = tierTheme(undefined, undefined);
      expect(legacyFallback).not.toEqual(bronze);
      expect(legacyFallback).toEqual(defaultTheme);
      expectThemeSatisfiesAAContract(legacyFallback);
    });
  });

  describe('programmatic derivation for arbitrary hex colors', () => {
    it('derives a contract-satisfying theme from a mid-lightness custom hex (#3B82F6)', () => {
      const theme = tierTheme(undefined, '#3B82F6');
      expectThemeSatisfiesAAContract(theme);
    });

    it('derives a contract-satisfying theme from a very light custom hex (#FFEB3B)', () => {
      const theme = tierTheme(undefined, '#FFEB3B');
      expectThemeSatisfiesAAContract(theme);
    });

    it('does not fall back to the DEFAULT theme for a valid unknown hex', () => {
      const theme = tierTheme(undefined, '#3B82F6');
      const defaultTheme = tierTheme(undefined, undefined);
      expect(theme).not.toEqual(defaultTheme);
    });
  });

  describe('invalid or missing input falls back to the DEFAULT theme', () => {
    const invalidInputs: Array<string | null | undefined> = ['', null, undefined, 'not-a-color', '#12345'];

    it.each(invalidInputs)('tierColor=%p resolves to a contract-satisfying DEFAULT theme', (invalidColor) => {
      const theme = tierTheme(undefined, invalidColor);
      const defaultTheme = tierTheme(undefined, undefined);
      expect(theme).toEqual(defaultTheme);
      expectThemeSatisfiesAAContract(theme);
    });

    it('also falls back to DEFAULT when tierName is an unrecognized string', () => {
      const theme = tierTheme('not-a-tier', undefined);
      const defaultTheme = tierTheme(undefined, undefined);
      expect(theme).toEqual(defaultTheme);
    });
  });

  describe('memoization', () => {
    it('returns the same object reference for repeated calls with identical arguments', () => {
      const first = tierTheme('gold', '#FFD700');
      const second = tierTheme('gold', '#FFD700');
      expect(first).toBe(second);
    });

    it('returns the same object reference for repeated DEFAULT resolutions', () => {
      const first = tierTheme(undefined, undefined);
      const second = tierTheme(null, null);
      // Different call signatures that both resolve to DEFAULT are cached
      // under distinct keys, but each is independently stable on repeat.
      expect(tierTheme(undefined, undefined)).toBe(first);
      expect(tierTheme(null, null)).toBe(second);
    });

    it('caches distinct object references for genuinely different resolved themes', () => {
      const gold = tierTheme('gold', undefined);
      const silver = tierTheme('silver', undefined);
      expect(gold).not.toBe(silver);
    });
  });
});

describe('contrastRatio', () => {
  it('returns 21 for black against white (maximum possible contrast)', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
  });

  it('returns 1 for identical colors (no contrast)', () => {
    expect(contrastRatio('#57534E', '#57534E')).toBeCloseTo(1, 5);
  });

  it('is symmetric regardless of argument order', () => {
    const forward = contrastRatio('#9A6540', '#FFFFFF');
    const backward = contrastRatio('#FFFFFF', '#9A6540');
    expect(forward).toBeCloseTo(backward, 10);
  });
});
