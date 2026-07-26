import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { FiAward } from 'react-icons/fi';
import AppShell from '../components/layout/AppShell';
import { Badge, Button, Card, EmptyState, PageHeader, Skeleton } from '../components/ui';
import { loyaltyService } from '../services/loyaltyService';
import { useAuthStore } from '../store/authStore';
import { resolveTierBenefits } from '../utils/tierBenefits';
import { tierTheme } from '../utils/tierTheme';

const GRID_CLASSES = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3';

/**
 * Public member-benefits page (/benefits): every tier with its full perk
 * list, Marriott-style. Reachable logged-out; authenticated members get
 * their current tier highlighted via the (non-blocking) status query.
 */
export default function TierBenefitsPage() {
  const { t, i18n } = useTranslation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const {
    data: tiers,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['loyalty', 'tiers'],
    queryFn: () => loyaltyService.getTiers(),
  });

  // Only fetched for members, and never blocks the page — the tier grid
  // renders identically while (or if) this is still loading/failing.
  const { data: loyaltyStatus } = useQuery({
    queryKey: ['loyalty', 'status'],
    queryFn: () => loyaltyService.getUserLoyaltyStatus(),
    enabled: isAuthenticated,
  });

  const sortedTiers = [...(tiers ?? [])].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <AppShell variant="guest" title={t('tierBenefits.title')}>
      <div data-testid="benefits-page">
        <PageHeader title={t('tierBenefits.title')} subtitle={t('tierBenefits.subtitle')} />

        {isLoading && (
          <div className={GRID_CLASSES} data-testid="benefits-loading">
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-56" />
            ))}
          </div>
        )}

        {isError && (
          <Card>
            <EmptyState
              icon={FiAward}
              title={t('tierBenefits.loadFailed')}
              action={
                <Button variant="secondary" onClick={() => void refetch()}>
                  {t('tierBenefits.retry')}
                </Button>
              }
            />
          </Card>
        )}

        {!isLoading && !isError && (
          <>
            <div className={GRID_CLASSES}>
              {sortedTiers.map((tier) => {
                const theme = tierTheme(tier.name, tier.color);
                const benefits = resolveTierBenefits(tier.benefits, i18n.language);
                const isCurrentTier = isAuthenticated && loyaltyStatus?.tier_name === tier.name;

                return (
                  <Card
                    key={tier.id}
                    className="border-l-4"
                    style={{ borderLeftColor: theme.accent }}
                    data-testid="benefit-tier-card"
                    data-tier={tier.name.toLowerCase()}
                  >
                    <div className="mb-4 flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg p-2" style={{ backgroundColor: theme.tintBg }}>
                          <FiAward
                            className="h-6 w-6"
                            style={{ color: theme.accent }}
                            aria-hidden="true"
                          />
                        </div>
                        <div>
                          <h2 className="text-title text-ink">{tier.name}</h2>
                          <p className="text-caption text-ink-muted">
                            {tier.min_nights === 0
                              ? t('tierBenefits.baseTier')
                              : t('tierBenefits.nightsRequired', { nights: tier.min_nights })}
                          </p>
                        </div>
                      </div>
                      {isCurrentTier && (
                        <Badge
                          size="sm"
                          data-testid="current-tier-badge"
                          style={{ backgroundColor: theme.tintBg, color: theme.onTint }}
                        >
                          {t('tierBenefits.yourTier')}
                        </Badge>
                      )}
                    </div>

                    {benefits.description && (
                      <p className="mb-3 text-body text-ink-muted">{benefits.description}</p>
                    )}

                    {benefits.perks.length > 0 && (
                      <ul className="space-y-2">
                        {benefits.perks.map((perk, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span
                              className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full"
                              style={{ backgroundColor: theme.accent }}
                              aria-hidden="true"
                            />
                            <span className="text-caption text-ink">{perk}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                );
              })}
            </div>

            {!isAuthenticated && (
              <div className="mt-6 text-center">
                <Link
                  to="/login"
                  className="text-caption text-brand-600 hover:underline"
                  data-testid="benefits-signin-link"
                >
                  {t('tierBenefits.signInPrompt')}
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
