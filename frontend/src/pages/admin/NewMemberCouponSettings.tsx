import { useState, useEffect, useCallback } from 'react';
import { FiGift, FiCheck, FiX, FiInfo, FiAlertTriangle, FiAlertCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import AppShell from '../../components/layout/AppShell';
import { Card, Button, Select } from '../../components/ui';
import { adminService, CouponStatusForAdmin } from '../../services/adminService';
import { couponService } from '../../services/couponService';
import type { Coupon } from '../../types/coupon';
import { logger } from '../../utils/logger';

interface NewMemberCouponSettings {
  id: string;
  isEnabled: boolean;
  selectedCouponId: string | null;
  pointsEnabled: boolean;
  pointsAmount: number | null;
  createdAt: string;
  updatedAt: string;
}

function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
        className="sr-only peer"
      />
      <div className="w-11 h-6 bg-surface-sunken peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-hairline-strong after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600" />
    </label>
  );
}

export default function NewMemberCouponSettings() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<NewMemberCouponSettings | null>(null);
  const [availableCoupons, setAvailableCoupons] = useState<Coupon[]>([]);
  const [couponStatus, setCouponStatus] = useState<CouponStatusForAdmin | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanged, setHasChanged] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [selectedCouponId, setSelectedCouponId] = useState<string>('');
  const [pointsEnabled, setPointsEnabled] = useState(false);
  const [pointsAmount, setPointsAmount] = useState<string>('');

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);

      // Load current settings and available coupons in parallel
      const [settingsData, couponsData] = await Promise.all([
        adminService.getNewMemberCouponSettings(),
        couponService.getCoupons(1, 100, { status: 'active' }) // Get all active coupons
      ]);

      setSettings(settingsData);
      setAvailableCoupons(couponsData.coupons);

      // Set form state from loaded settings
      setIsEnabled(settingsData.isEnabled);
      setSelectedCouponId(settingsData.selectedCouponId ?? '');
      setPointsEnabled(settingsData.pointsEnabled);
      setPointsAmount(settingsData.pointsAmount?.toString() ?? '');

    } catch (error: unknown) {
      logger.error('Failed to load data:', error);
      const errorMessage = error instanceof Error && 'response' in error
        ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined;
      toast.error(errorMessage ?? t('admin.newMemberCoupons.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (settings) {
      const currentState = {
        isEnabled,
        selectedCouponId,
        pointsEnabled,
        pointsAmount
      };
      const originalState = {
        isEnabled: settings.isEnabled,
        selectedCouponId: settings.selectedCouponId ?? '',
        pointsEnabled: settings.pointsEnabled,
        pointsAmount: settings.pointsAmount?.toString() ?? ''
      };
      setHasChanged(JSON.stringify(currentState) !== JSON.stringify(originalState));
    }
  }, [isEnabled, selectedCouponId, pointsEnabled, pointsAmount, settings]);

  // Load coupon status when a coupon is selected
  useEffect(() => {
    const loadCouponStatus = async () => {
      if (selectedCouponId && availableCoupons.length > 0) {
        try {
          const status = await adminService.getCouponStatusForAdmin(selectedCouponId);
          setCouponStatus(status);
        } catch (error) {
          logger.error('Failed to load coupon status:', error);
          setCouponStatus(null);
        }
      } else {
        setCouponStatus(null);
      }
    };

    loadCouponStatus();
  }, [selectedCouponId, availableCoupons]);

  const handleSave = async () => {
    if (!hasChanged) {return;}

    setIsSaving(true);
    try {
      const updateData = {
        isEnabled,
        selectedCouponId: selectedCouponId ?? null,
        pointsEnabled,
        pointsAmount: pointsAmount ? parseInt(pointsAmount) : null
      };

      const updatedSettings = await adminService.updateNewMemberCouponSettings(updateData);
      setSettings(updatedSettings);
      setHasChanged(false);
      toast.success(t('admin.newMemberCoupons.updateSuccess'));
    } catch (error: unknown) {
      logger.error('Failed to update settings:', error);
      const errorMessage = error instanceof Error && 'response' in error
        ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined;
      toast.error(errorMessage ?? t('admin.newMemberCoupons.updateError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (settings) {
      setIsEnabled(settings.isEnabled);
      setSelectedCouponId(settings.selectedCouponId ?? '');
      setPointsEnabled(settings.pointsEnabled);
      setPointsAmount(settings.pointsAmount?.toString() ?? '');
      setHasChanged(false);
    }
  };

  const selectedCoupon = availableCoupons.find((c) => c.id === selectedCouponId);
  const isSaveDisabled =
    !hasChanged ||
    isSaving ||
    (isEnabled && !selectedCouponId) ||
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    (isEnabled && couponStatus?.isExpired) ||
    (pointsEnabled && (!pointsAmount || (parseInt(pointsAmount) < 1 || parseInt(pointsAmount) > 10000)));

  if (isLoading) {
    return (
      <AppShell variant="admin" title={t('admin.newMemberCoupons.title')}>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto" />
            <p className="mt-4 text-caption text-ink-muted">{t('admin.newMemberCoupons.loading')}</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell variant="admin" title={t('admin.newMemberCoupons.title')}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-brand-50 rounded-lg">
            <FiGift className="h-6 w-6 text-brand-600" aria-hidden="true" />
          </div>
          <p className="text-caption text-ink-muted">{t('admin.newMemberCoupons.description')}</p>
        </div>

        {/* Info Banner */}
        <div className="rounded-lg border border-info-600 bg-info-50 p-4">
          <div className="flex items-start gap-3">
            <FiInfo className="h-5 w-5 text-info-700 mt-0.5" aria-hidden="true" />
            <div className="text-caption text-info-700">
              <p className="font-semibold mb-1">{t('admin.newMemberCoupons.howItWorks')}</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>{t('admin.newMemberCoupons.howItWorksItems.banner')}</li>
                <li>{t('admin.newMemberCoupons.howItWorksItems.rewards')}</li>
                <li>{t('admin.newMemberCoupons.howItWorksItems.options')}</li>
                <li>{t('admin.newMemberCoupons.howItWorksItems.once')}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Form */}
      <Card>
        <div className="space-y-6">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between py-4 border-b border-hairline">
            <div>
              <h3 className="text-body font-semibold text-ink">{t('admin.newMemberCoupons.enableCoupons')}</h3>
              <p className="text-caption text-ink-muted">{t('admin.newMemberCoupons.enableCouponsDescription')}</p>
            </div>
            <ToggleSwitch checked={isEnabled} onChange={setIsEnabled} label={t('admin.newMemberCoupons.enableCoupons')} />
          </div>

          {/* Coupon Selection */}
          <div>
            <label htmlFor="couponSelect" className="block text-caption font-semibold text-ink mb-2">
              {t('admin.newMemberCoupons.selectCoupon')} *
            </label>
            <Select
              id="couponSelect"
              value={selectedCouponId}
              onChange={(e) => setSelectedCouponId(e.target.value)}
              disabled={!isEnabled}
            >
              <option value="">{t('admin.newMemberCoupons.selectCouponPlaceholder')}</option>
              {availableCoupons.map((coupon) => (
                <option key={coupon.id} value={coupon.id}>
                  {coupon.code} - {coupon.name} ({coupon.type === 'percentage' ? `${coupon.value}%` : `$${coupon.value}`} {t('admin.newMemberCoupons.off')})
                  {coupon.validUntil && ` - ${t('coupons.expiresOn')} ${new Date(coupon.validUntil).toLocaleDateString()}`}
                </option>
              ))}
            </Select>
            {isEnabled && !selectedCouponId && (
              <p className="mt-1 text-caption text-error-600">{t('admin.newMemberCoupons.selectCouponRequired')}</p>
            )}
            {availableCoupons.length === 0 && !isLoading && (
              <p className="mt-1 text-caption text-ink-muted">{t('admin.newMemberCoupons.noCouponsAvailable')}</p>
            )}

            {/* Coupon Status Warnings */}
            {couponStatus && couponStatus.warningLevel !== 'none' && (
              <div
                className={`mt-2 rounded-lg border p-3 ${couponStatus.warningLevel === 'danger' ? 'border-error-600 bg-error-50' : 'border-warning-600 bg-warning-50'}`}
              >
                <div className="flex items-start gap-2">
                  {couponStatus.warningLevel === 'danger' ? (
                    <FiAlertCircle className="h-5 w-5 text-error-700 mt-0.5" aria-hidden="true" />
                  ) : (
                    <FiAlertTriangle className="h-5 w-5 text-warning-700 mt-0.5" aria-hidden="true" />
                  )}
                  <div className="flex-1">
                    <p className={`text-caption font-semibold ${couponStatus.warningLevel === 'danger' ? 'text-error-700' : 'text-warning-700'}`}>
                      {couponStatus.isExpired ? t('admin.newMemberCoupons.couponExpired') : t('admin.newMemberCoupons.couponExpiringSoon')}
                    </p>
                    <p className={`text-caption mt-1 ${couponStatus.warningLevel === 'danger' ? 'text-error-700' : 'text-warning-700'}`}>
                      {couponStatus.isExpired
                        ? t('admin.newMemberCoupons.expiredMessage', { date: couponStatus.validUntil ? new Date(couponStatus.validUntil).toLocaleDateString() : '' })
                        : t('admin.newMemberCoupons.expiringSoonMessage', { days: couponStatus.daysUntilExpiry, date: couponStatus.validUntil ? new Date(couponStatus.validUntil).toLocaleDateString() : '' })
                      }
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Selected Coupon Details */}
          {selectedCouponId && selectedCoupon && (
            <Card surface="sunken" padding="md">
              <h4 className="font-semibold text-ink mb-2">{t('admin.newMemberCoupons.selectedCouponDetails')}</h4>
              <div className="space-y-1 text-caption text-ink-muted">
                <p><span className="font-semibold">{t('admin.newMemberCoupons.code')}:</span> {selectedCoupon.code}</p>
                <p><span className="font-semibold">{t('admin.newMemberCoupons.name')}:</span> {selectedCoupon.name}</p>
                <p><span className="font-semibold">{t('admin.newMemberCoupons.type')}:</span> {selectedCoupon.type === 'percentage' ? t('admin.newMemberCoupons.typePercentage') : t('admin.newMemberCoupons.typeFixed')}</p>
                <p><span className="font-semibold">{t('admin.newMemberCoupons.value')}:</span> {selectedCoupon.type === 'percentage' ? `${selectedCoupon.value}%` : `$${selectedCoupon.value}`}</p>
                {selectedCoupon.description && (
                  <p><span className="font-semibold">{t('admin.newMemberCoupons.description_field')}:</span> {selectedCoupon.description}</p>
                )}
                <p><span className="font-semibold">{t('admin.newMemberCoupons.status')}:</span> <span className="capitalize">{selectedCoupon.status}</span></p>

                {/* Enhanced Expiry Information */}
                {couponStatus && (
                  <>
                    {couponStatus.validFrom && (
                      <p><span className="font-semibold">{t('admin.newMemberCoupons.validFrom')}:</span> {new Date(couponStatus.validFrom).toLocaleDateString()}</p>
                    )}
                    {couponStatus.validUntil && (
                      <p>
                        <span className="font-semibold">{t('admin.newMemberCoupons.validUntil')}:</span>{' '}
                        <span className={
                          couponStatus.warningLevel === 'danger' ? 'text-error-600 font-semibold' :
                          couponStatus.warningLevel === 'warning' ? 'text-warning-600 font-semibold' :
                          'text-ink-muted'
                        }
                        >
                          {new Date(couponStatus.validUntil).toLocaleDateString()}
                          {couponStatus.isExpired && ` (${t('admin.newMemberCoupons.expired')})`}
                          {!couponStatus.isExpired && couponStatus.daysUntilExpiry !== null && couponStatus.daysUntilExpiry <= 7 &&
                            ` (${t('admin.newMemberCoupons.daysRemaining', { count: couponStatus.daysUntilExpiry })})`
                          }
                        </span>
                      </p>
                    )}
                    {!couponStatus.validUntil && (
                      <p><span className="font-semibold">{t('admin.newMemberCoupons.validUntil')}:</span> <span className="text-success-600">{t('admin.newMemberCoupons.noExpiry')}</span></p>
                    )}
                  </>
                )}
              </div>
            </Card>
          )}

          {/* Points Configuration */}
          <div className="border-t border-hairline pt-6">
            <div className="flex items-center justify-between py-4 border-b border-hairline">
              <div>
                <h3 className="text-body font-semibold text-ink">{t('admin.newMemberCoupons.enablePoints')}</h3>
                <p className="text-caption text-ink-muted">{t('admin.newMemberCoupons.enablePointsDescription')}</p>
              </div>
              <ToggleSwitch checked={pointsEnabled} onChange={setPointsEnabled} label={t('admin.newMemberCoupons.enablePoints')} />
            </div>

            {/* Points Amount Input */}
            <div className="mt-4">
              <label htmlFor="pointsAmount" className="block text-caption font-semibold text-ink mb-2">
                {t('admin.newMemberCoupons.pointsToAward')} *
              </label>
              <div className="relative">
                <input
                  type="number"
                  id="pointsAmount"
                  value={pointsAmount}
                  onChange={(e) => setPointsAmount(e.target.value)}
                  className="h-11 w-full rounded-lg border border-hairline-strong bg-surface-card px-3 pr-16 text-body text-ink transition focus:outline-none focus:ring-2 focus:border-brand-600 focus:ring-brand-600 disabled:opacity-50 disabled:pointer-events-none"
                  placeholder={t('admin.newMemberCoupons.pointsPlaceholder')}
                  min="1"
                  max="10000"
                  disabled={!pointsEnabled}
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <span className="text-caption text-ink-muted">{t('admin.newMemberCoupons.points')}</span>
                </div>
              </div>
              {pointsEnabled && !pointsAmount && (
                <p className="mt-1 text-caption text-error-600">{t('admin.newMemberCoupons.pointsRequired')}</p>
              )}
              {pointsEnabled && pointsAmount && (parseInt(pointsAmount) < 1 || parseInt(pointsAmount) > 10000) && (
                <p className="mt-1 text-caption text-error-600">{t('admin.newMemberCoupons.pointsRange')}</p>
              )}
              {pointsEnabled && pointsAmount && parseInt(pointsAmount) >= 1 && parseInt(pointsAmount) <= 10000 && (
                <p className="mt-1 text-caption text-success-600">
                  {t('admin.newMemberCoupons.pointsSuccess', { count: parseInt(pointsAmount) })}
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-hairline">
            <Button type="button" variant="secondary" onClick={handleReset} disabled={!hasChanged || isSaving}>
              <FiX className="h-4 w-4" aria-hidden="true" />
              {t('admin.newMemberCoupons.reset')}
            </Button>

            <Button type="button" onClick={handleSave} disabled={isSaveDisabled} loading={isSaving}>
              <FiCheck className="h-4 w-4" aria-hidden="true" />
              {isSaving ? t('admin.newMemberCoupons.saving') : t('admin.newMemberCoupons.saveSettings')}
            </Button>
          </div>

          {/* Save Button Help Text */}
          {isEnabled && couponStatus?.isExpired && (
            <p className="mt-2 text-caption text-error-600">
              {t('admin.newMemberCoupons.expiredCouponError')}
            </p>
          )}
          {pointsEnabled && (!pointsAmount || parseInt(pointsAmount) < 1 || parseInt(pointsAmount) > 10000) && (
            <p className="mt-2 text-caption text-error-600">
              {t('admin.newMemberCoupons.invalidPointsError')}
            </p>
          )}
        </div>
      </Card>
    </AppShell>
  );
}
