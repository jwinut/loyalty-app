import type { TierBenefitsContent } from '../services/loyaltyService';

/**
 * Resolve a tiers.benefits payload to display content for a UI language.
 * Thai UI reads the th entry, everything else (en, zh-CN) reads en, each
 * falling back to the other language and finally to the legacy flat
 * { description, perks } shape (pre-i18n rows, Thai copy) so stale cached
 * responses keep rendering.
 */
export function resolveTierBenefits(benefits: unknown, language: string): TierBenefitsContent {
  const empty: TierBenefitsContent = { description: '', perks: [] };
  if (!benefits || typeof benefits !== 'object') return empty;

  const record = benefits as Record<string, unknown>;
  const wantsThai = language.toLowerCase().startsWith('th');
  const candidates = wantsThai
    ? [record.th, record.en, record]
    : [record.en, record.th, record];

  for (const candidate of candidates) {
    const content = asContent(candidate);
    if (content) return content;
  }
  return empty;
}

function asContent(value: unknown): TierBenefitsContent | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const description = typeof record.description === 'string' ? record.description : '';
  const perks = Array.isArray(record.perks)
    ? record.perks.filter((perk): perk is string => typeof perk === 'string')
    : [];
  if (!description && perks.length === 0) return null;
  return { description, perks };
}
