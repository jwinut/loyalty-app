import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { FiGift, FiAlertTriangle, FiClock, FiCheckCircle, FiCheck } from 'react-icons/fi';
import { UserActiveCoupon } from '../../types/coupon';
import { couponService } from '../../services/couponService';
import CouponCard from '../../components/coupons/CouponCard';
import QRCodeModal from '../../components/coupons/QRCodeModal';
import CouponDetailsModal from '../../components/coupons/CouponDetailsModal';
import AppShell from '../../components/layout/AppShell';
import { Badge, Button, EmptyState, TabNav } from '../../components/ui';

type CouponFilter = 'active' | 'used' | 'expired';

const CouponWallet: React.FC = () => {
  const { t } = useTranslation();
  const [selectedCoupon, setSelectedCoupon] = useState<UserActiveCoupon | null>(null);
  const [showQRCode, setShowQRCode] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [page, setPage] = useState(1);
  const [activeFilter, setActiveFilter] = useState<CouponFilter>('active');

  // Map filter to tRPC status
  const getStatusFromFilter = (filter: CouponFilter): 'available' | 'used' | 'expired' | undefined => {
    switch (filter) {
      case 'used':
        return 'used';
      case 'expired':
        return 'expired';
      case 'active':
      default:
        return undefined; // Use default (active coupons)
    }
  };

  // Fetch coupons using REST
  const { data: couponResponse, isLoading, error, refetch } = useQuery({
    queryKey: ['coupons', 'my', page, activeFilter],
    queryFn: () => couponService.getUserCoupons(page, 20, getStatusFromFilter(activeFilter)),
  });

  const coupons = couponResponse?.coupons ?? [];
  const totalPages = couponResponse?.totalPages ?? 1;
  const hasMore = page < totalPages;

  const handleFilterChange = (filter: CouponFilter) => {
    if (filter !== activeFilter) {
      setActiveFilter(filter);
      setPage(1);
    }
  };

  const handleUseCoupon = (coupon: UserActiveCoupon) => {
    // Only allow using active coupons
    if (activeFilter === 'active') {
      setSelectedCoupon(coupon);
      setShowQRCode(true);
      setShowDetails(false);
    }
  };

  const handleViewDetails = (coupon: UserActiveCoupon) => {
    setSelectedCoupon(coupon);
    setShowDetails(true);
    setShowQRCode(false);
  };

  const handleLoadMore = () => {
    if (hasMore && !isLoading) {
      setPage(page + 1);
    }
  };

  const handleRefresh = () => {
    setPage(1);
    refetch();
  };

  // Separate coupons by expiry status (only for active filter)
  const activeCoupons = activeFilter === 'active'
    ? coupons.filter((coupon: UserActiveCoupon) => !couponService.isExpiringSoon(coupon))
    : [];
  const expiringSoonCoupons = activeFilter === 'active'
    ? coupons.filter((coupon: UserActiveCoupon) => couponService.isExpiringSoon(coupon))
    : [];

  const errorMessage = error ? (error instanceof Error ? error.message : 'An unexpected error occurred') : null;

  if (isLoading && coupons.length === 0) {
    return (
      <AppShell variant="guest" title={t('coupons.myCoupons')}>
        <div className="bg-white rounded-lg p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-stone-200 rounded w-1/4" />
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-32 bg-stone-200 rounded" />
              ))}
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell variant="guest" title={t('coupons.myCoupons')}>
      <div className="flex items-center justify-between mb-6">
        <p className="text-stone-600">
          {t('coupons.walletDescription')}
        </p>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="inline-flex items-center font-semibold border border-stone-300 bg-white text-stone-700 px-4 py-2 text-sm rounded-lg hover:bg-stone-50 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500"
        >
          {isLoading ? t('common.loading') : t('common.refresh')}
        </button>
      </div>

      {/* Filter Tabs */}
      <TabNav
        aria-label={t('coupons.myCoupons')}
        className="mb-6"
        value={activeFilter}
        onChange={(value) => handleFilterChange(value as CouponFilter)}
        items={[
          { value: 'active', label: t('coupons.activeCoupons') },
          { value: 'used', label: t('coupons.usedCoupons', 'Used') },
          { value: 'expired', label: t('coupons.expiredCoupons', 'Expired') },
        ]}
      />

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex">
            <div className="text-red-400 mr-3"><FiAlertTriangle className="h-5 w-5" aria-hidden="true" /></div>
            <div>
              <h3 className="text-red-800 font-semibold">
                {t('errors.error')}
              </h3>
              <p className="text-red-700 mt-1">{errorMessage}</p>
              <button
                onClick={handleRefresh}
                className="text-red-600 underline hover:text-red-800 mt-2"
              >
                {t('common.tryAgain')}
              </button>
            </div>
          </div>
        </div>
      )}

      {coupons.length === 0 && !isLoading && !errorMessage && (
        <EmptyState
          icon={FiGift}
          title={
            activeFilter === 'used'
              ? t('coupons.noUsedCoupons', 'No Used Coupons')
              : activeFilter === 'expired'
                ? t('coupons.noExpiredCoupons', 'No Expired Coupons')
                : t('coupons.noCoupons')
          }
          description={
            activeFilter === 'used'
              ? t('coupons.noUsedCouponsDescription', "You haven't used any coupons yet.")
              : activeFilter === 'expired'
                ? t('coupons.noExpiredCouponsDescription', "You don't have any expired coupons.")
                : t('coupons.noCouponsDescription')
          }
          action={<Button onClick={handleRefresh}>{t('common.refresh')}</Button>}
        />
      )}

      {/* Coupon Display Based on Active Filter */}
      {activeFilter === 'active' && (
        <>
          {/* Expiring Soon Section */}
          {expiringSoonCoupons.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center mb-4">
                <div className="bg-red-100 p-2 rounded-full mr-3">
                  <FiClock className="h-5 w-5 text-red-600" aria-hidden="true" />
                </div>
                <h2 className="flex items-center gap-2 text-xl font-semibold text-red-700">
                  {t('coupons.expiringSoon')}
                  <Badge tone="warning">{expiringSoonCoupons.length}</Badge>
                </h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {expiringSoonCoupons.map((coupon: UserActiveCoupon) => (
                  <CouponCard
                    key={coupon.userCouponId}
                    coupon={coupon}
                    onUse={handleUseCoupon}
                    onViewDetails={handleViewDetails}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Active Coupons Section */}
          {activeCoupons.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center mb-4">
                <div className="bg-green-100 p-2 rounded-full mr-3">
                  <FiCheckCircle className="h-5 w-5 text-green-600" aria-hidden="true" />
                </div>
                <h2 className="flex items-center gap-2 text-xl font-semibold text-stone-900">
                  {t('coupons.activeCoupons')}
                  <Badge tone="success">{activeCoupons.length}</Badge>
                </h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {activeCoupons.map((coupon: UserActiveCoupon) => (
                  <CouponCard
                    key={coupon.userCouponId}
                    coupon={coupon}
                    onUse={handleUseCoupon}
                    onViewDetails={handleViewDetails}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Used/Expired Coupons Display */}
      {(activeFilter === 'used' || activeFilter === 'expired') && coupons.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <div className={clsx('p-2 rounded-full mr-3',
              activeFilter === 'used'
                ? 'bg-stone-100'
                : 'bg-red-100'
            )}
            >
              {activeFilter === 'used' ? (
                <FiCheck className="h-5 w-5 text-stone-600" aria-hidden="true" />
              ) : (
                <FiClock className="h-5 w-5 text-red-600" aria-hidden="true" />
              )}
            </div>
            <h2 className={clsx('flex items-center gap-2 text-xl font-semibold',
              activeFilter === 'used'
                ? 'text-stone-900'
                : 'text-red-700'
            )}
            >
              {activeFilter === 'used'
                ? t('coupons.usedCoupons', 'Used Coupons')
                : t('coupons.expiredCoupons', 'Expired Coupons')
              }
              <Badge tone="neutral">{coupons.length}</Badge>
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {coupons.map((coupon: UserActiveCoupon) => (
              <CouponCard
                key={coupon.userCouponId}
                coupon={coupon}
                onUse={handleUseCoupon}
                onViewDetails={handleViewDetails}
              />
            ))}
          </div>
        </div>
      )}

      {/* Load More Button */}
      {hasMore && (
        <div className="mt-8 text-center">
          <Button
            variant="secondary"
            size="sm"
            className="h-11 sm:h-9"
            onClick={handleLoadMore}
            disabled={isLoading}
          >
            {isLoading ? t('common.loading') : t('common.loadMore')}
          </Button>
        </div>
      )}

      {/* QR Code Modal — renders its own overlay via the Modal primitive, so
          it must not be wrapped in another backdrop here (fixes #295). */}
      {showQRCode && selectedCoupon && (
        <QRCodeModal
          coupon={selectedCoupon}
          onClose={() => {
            setShowQRCode(false);
            setSelectedCoupon(null);
          }}
        />
      )}

      {/* Coupon Details Modal — same as above: manages its own overlay. */}
      {showDetails && selectedCoupon && (
        <CouponDetailsModal
          coupon={selectedCoupon}
          onClose={() => {
            setShowDetails(false);
            setSelectedCoupon(null);
          }}
        />
      )}
    </AppShell>
  );
};

export default CouponWallet;
