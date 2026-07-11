import React from 'react';
import { UserActiveCoupon } from '../../types/coupon';
import { useTranslation } from 'react-i18next';
import {
  FiPercent,
  FiDollarSign,
  FiGift,
  FiArrowUpCircle,
  FiTag,
  FiFileText,
  FiList,
  FiAlertTriangle,
  FiCheckCircle,
} from 'react-icons/fi';
import { couponService } from '../../services/couponService';
import { formatDateToDDMMYYYY } from '../../utils/dateFormatter';
import { Badge, Button, Modal } from '../ui';

interface CouponDetailsModalProps {
  coupon: UserActiveCoupon;
  onClose?: () => void;
  className?: string;
}

type CouponTypeIcon = React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;

const TYPE_ICONS: Record<string, CouponTypeIcon> = {
  percentage: FiPercent,
  fixed_amount: FiDollarSign,
  bogo: FiGift,
  free_upgrade: FiArrowUpCircle,
  free_service: FiGift,
};

const CouponDetailsModal: React.FC<CouponDetailsModalProps> = ({
  coupon,
  onClose,
  className = ''
}) => {
  const { t } = useTranslation();
  const isExpiring = couponService.isExpiringSoon(coupon);
  const TypeIcon = TYPE_ICONS[coupon.type] ?? FiTag;

  const formatValue = (coupon: UserActiveCoupon) => {
    switch (coupon.type) {
      case 'percentage':
        return `${coupon.value}%`;
      case 'fixed_amount':
        return `${coupon.currency}${coupon.value}`;
      case 'bogo':
        return t('coupons.types.bogo');
      case 'free_upgrade':
        return t('coupons.types.free_upgrade');
      case 'free_service':
        return t('coupons.types.free_service');
      default:
        return t('coupons.discount');
    }
  };

  const handleClose = onClose ?? (() => {});

  return (
    <Modal
      open
      onClose={handleClose}
      size="md"
      title={
        <span className="flex items-center gap-2">
          <TypeIcon className="h-5 w-5 text-brand-600" aria-hidden />
          {t('coupons.couponDetails')}
        </span>
      }
      footer={
        <Button className="w-full" onClick={handleClose}>
          {t('common.close')}
        </Button>
      }
    >
      <div className={className}>
        {/* Coupon Header — name + code on a pure white panel regardless of
            the modal's own surface, so the mono chip reads consistently. */}
        <div className="mb-6 rounded-card border border-hairline bg-surface-card p-4 text-center">
          <h4 className="text-title text-ink">
            {coupon.name}
          </h4>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <span className="rounded-full bg-surface-sunken px-3 py-1 font-mono text-caption text-ink">
              {coupon.code}
            </span>
            {isExpiring && <Badge tone="warning">{t('coupons.expiringSoon')}</Badge>}
          </div>
        </div>

        {/* Description */}
        {coupon.description && (
          <div className="mb-6">
            <h5 className="mb-2 flex items-center gap-2 font-semibold text-ink">
              <FiFileText className="h-4 w-4 text-ink-muted" aria-hidden />
              {t('coupons.description')}
            </h5>
            <p className="rounded-lg bg-surface-sunken p-3 text-ink">
              {coupon.description}
            </p>
          </div>
        )}

        {/* Coupon Value & Details */}
        <div className="mb-6 rounded-lg bg-success-50 p-4">
          <h5 className="mb-3 flex items-center gap-2 font-semibold text-success-700">
            <FiTag className="h-4 w-4" aria-hidden />
            {t('coupons.value')}
          </h5>
          <div className="text-center">
            <span className="text-display text-success-700">
              {formatValue(coupon)}
            </span>
          </div>
        </div>

        {/* Detailed Information */}
        <div className="mb-6 rounded-lg bg-surface-sunken p-4">
          <h5 className="mb-3 flex items-center gap-2 font-semibold text-ink">
            <FiList className="h-4 w-4 text-ink-muted" aria-hidden />
            {t('coupons.details')}
          </h5>
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-hairline py-2">
              <span className="text-ink-muted">{t('coupons.type')}:</span>
              <span className="flex items-center gap-1 font-semibold text-ink">
                <TypeIcon className="h-4 w-4" aria-hidden />
                {t(`coupons.types.${coupon.type}`)}
              </span>
            </div>

            {coupon.minimumSpend && (
              <div className="flex items-center justify-between border-b border-hairline py-2">
                <span className="text-ink-muted">{t('coupons.minimumSpend')}:</span>
                <span className="font-semibold text-brand-600">
                  {coupon.currency}{coupon.minimumSpend}
                </span>
              </div>
            )}

            {coupon.maximumDiscount && (
              <div className="flex items-center justify-between border-b border-hairline py-2">
                <span className="text-ink-muted">{t('coupons.maximumDiscount')}:</span>
                <span className="font-semibold text-brand-600">
                  {coupon.currency}{coupon.maximumDiscount}
                </span>
              </div>
            )}

            {coupon.effectiveExpiry && (
              <div className="flex items-center justify-between py-2">
                <span className="text-ink-muted">{t('coupons.expiresOn')}:</span>
                <span className={isExpiring ? 'font-semibold text-error-600' : 'font-semibold text-ink'}>
                  {formatDateToDDMMYYYY(coupon.effectiveExpiry)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Terms and Conditions */}
        {coupon.termsAndConditions && (
          <div className="mb-6 rounded-lg bg-warning-50 p-4">
            <h5 className="mb-2 flex items-center gap-2 font-semibold text-warning-700">
              <FiAlertTriangle className="h-4 w-4" aria-hidden />
              {t('coupons.termsAndConditions')}
            </h5>
            <p className="text-caption leading-relaxed text-warning-700">
              {coupon.termsAndConditions}
            </p>
          </div>
        )}

        {/* Usage Status */}
        <div className="rounded-lg border border-brand-200 bg-brand-50 p-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 font-semibold text-brand-900">
              <FiCheckCircle className="h-4 w-4 text-brand-600" aria-hidden />
              {t('coupons.status')}:
            </span>
            <Badge tone="brand">{t(`coupons.statuses.${coupon.status}`)}</Badge>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default CouponDetailsModal;
