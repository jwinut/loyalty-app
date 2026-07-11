import { useAuthStore } from '../store/authStore';
import { FiGift, FiUsers } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import AppShell from '../components/layout/AppShell';
import LoyaltyCarousel from '../components/loyalty/LoyaltyCarousel';
import { loyaltyService, UserLoyaltyStatus } from '../services/loyaltyService';
import { Card, Skeleton } from '../components/ui';
import { tierTheme } from '../utils/tierTheme';
import NavTile from './dashboard/NavTile';
import { ADMIN_NAV_CARDS, GUEST_NAV_CARDS } from './dashboard/navCards';

const NAV_GRID_CLASSES = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3';

function TierHero({ loyaltyStatus }: { loyaltyStatus: UserLoyaltyStatus }) {
  const { t } = useTranslation();
  const theme = tierTheme(loyaltyStatus.tier_name, loyaltyStatus.tier_color);
  const showProgress = loyaltyStatus.next_tier_name && loyaltyStatus.progress_percentage !== null;

  return (
    <Card surface="tile" padding="lg" className="mb-6">
      <span
        className="inline-flex rounded-full px-3 py-1 text-caption font-semibold"
        style={{ backgroundColor: theme.tintBg, color: theme.onTint }}
        data-testid="dashboard-tier"
      >
        {t('loyalty.tier')} {loyaltyStatus.tier_name}
      </span>

      <div className="mt-6 grid grid-cols-2 gap-6">
        <div>
          <div className="text-display-lg">{loyaltyStatus.total_nights ?? 0}</div>
          <div className="text-caption text-tile-muted">
            {(loyaltyStatus.total_nights ?? 0) === 1 ? t('loyalty.night') : t('loyalty.nights')}
          </div>
          <div className="mt-1 text-fine text-tile-muted">{t('loyalty.tierEligibility')}</div>
        </div>
        <div>
          <div className="text-display-lg" data-testid="dashboard-points">
            {loyaltyStatus.current_points.toLocaleString()}
          </div>
          <div className="text-caption text-tile-muted">{t('loyalty.points')}</div>
          <div className="mt-1 text-fine text-tile-muted">{t('loyalty.forRewards')}</div>
        </div>
      </div>

      {showProgress && (
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-caption text-tile-muted">
            <span>{t('loyalty.progressToNextTier', { tier: loyaltyStatus.next_tier_name })}</span>
            <span>
              {loyaltyStatus.nights_to_next_tier !== undefined && loyaltyStatus.nights_to_next_tier !== null
                ? t('loyalty.nightsToGo', { count: loyaltyStatus.nights_to_next_tier })
                : t('loyalty.maxTierReached')}
            </span>
          </div>
          <div className="h-2 rounded-full bg-tile-raised">
            <div
              className="h-2 rounded-full transition-all duration-300"
              style={{ width: `${loyaltyStatus.progress_percentage}%`, backgroundColor: theme.accent }}
            />
          </div>
        </div>
      )}
    </Card>
  );
}

function DashboardLoadingSkeleton() {
  return (
    <div className={NAV_GRID_CLASSES} data-testid="dashboard-loading">
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="h-24" />
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const { data: loyaltyStatus, isLoading: loyaltyLoading } = useQuery({
    queryKey: ['loyalty', 'status'],
    queryFn: () => loyaltyService.getUserLoyaltyStatus(),
  });
  const { data: transactionsData } = useQuery({
    queryKey: ['loyalty', 'transactions', 1],
    queryFn: () => loyaltyService.getPointsHistory(10, 0),
  });

  const transactions = transactionsData?.transactions ?? [];
  const dashboardTitle = t('dashboard.title', { name: user?.firstName ?? '' });

  if (loyaltyLoading) {
    return (
      <AppShell variant="guest" title={dashboardTitle}>
        <DashboardLoadingSkeleton />
      </AppShell>
    );
  }

  return (
    <AppShell variant="guest" title={dashboardTitle}>
      {loyaltyStatus && <TierHero loyaltyStatus={loyaltyStatus} />}

      {loyaltyStatus && (
        <div className="mb-8">
          <div className="mb-4 flex items-center gap-2">
            <FiGift className="h-5 w-5 text-brand-600" aria-hidden="true" />
            <h2 className="text-title text-ink">{t('loyalty.dashboard.title')}</h2>
          </div>
          <LoyaltyCarousel loyaltyStatus={loyaltyStatus} transactions={transactions} />
        </div>
      )}

      <div className="mb-8">
        <h2 className="mb-4 text-title text-ink">{t('dashboard.myServices')}</h2>
        <div className={NAV_GRID_CLASSES}>
          {GUEST_NAV_CARDS.map((card) => (
            <NavTile key={card.to} card={card} />
          ))}
        </div>
      </div>

      {isAdmin && (
        <div className="mb-8">
          <h2 className="mb-4 flex items-center gap-2 text-title text-ink">
            <FiUsers className="h-5 w-5 text-brand-600" aria-hidden="true" />
            {t('dashboard.adminMenu')}
          </h2>
          <div className={NAV_GRID_CLASSES}>
            {ADMIN_NAV_CARDS.map((card) => (
              <NavTile key={card.to} card={card} />
            ))}
          </div>
        </div>
      )}

      <Card as="section" surface="sunken" padding="lg" className="mt-8">
        <h3 className="text-title text-ink">{t('dashboard.welcomeMessage')}</h3>
        <p className="mt-2 max-w-text text-body text-ink-muted">{t('dashboard.welcomeDescription')}</p>
      </Card>
    </AppShell>
  );
}
