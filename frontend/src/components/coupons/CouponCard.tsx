import React from 'react';
import { useTranslation } from 'react-i18next';
import { FiClock } from 'react-icons/fi';
import { UserActiveCoupon } from '../../types/coupon';
import { couponService } from '../../services/couponService';
import { formatExpiryDateWithRelative } from '../../utils/dateFormatter';
import { Badge, Button } from '../ui';
import { cn } from '../ui/cn';

interface CouponCardProps {
  coupon: UserActiveCoupon;
  onUse?: (coupon: UserActiveCoupon) => void;
  onViewDetails?: (coupon: UserActiveCoupon) => void;
  className?: string;
}

// Ticket-stub perforation notches, cut straight through the card edge with a
// CSS mask instead of two circles painted in the page's background color —
// that way the notches read as true cutouts on any surface (warm page bg,
// a modal sheet, dark tile section, etc.) rather than assuming one fixed
// backdrop color. Each gradient masks a half-width strip of the card with a
// semicircular notch at its outer edge; the two strips tile together (no
// overlap needed) to cover the full card.
const TICKET_NOTCH_MASK =
  'radial-gradient(circle 10px at 0 50%, transparent 98%, black 100%) left / 51% 100% no-repeat, ' +
  'radial-gradient(circle 10px at 100% 50%, transparent 98%, black 100%) right / 51% 100% no-repeat';

const TICKET_NOTCH_STYLE: React.CSSProperties = {
  WebkitMask: TICKET_NOTCH_MASK,
  mask: TICKET_NOTCH_MASK,
};

const INACTIVE_STATUSES: ReadonlyArray<UserActiveCoupon['status']> = ['used', 'expired', 'revoked'];

const CouponCard: React.FC<CouponCardProps> = ({
  coupon,
  onUse,
  onViewDetails,
  className = ''
}) => {
  const { t } = useTranslation();

  const isExpiring = couponService.isExpiringSoon(coupon);
  const isInactive = INACTIVE_STATUSES.includes(coupon.status);
  const expiryDate = couponService.getExpiryDate(coupon);
  const expiryText = formatExpiryDateWithRelative(expiryDate, t);
  const minimumSpendText = couponService.formatMinimumSpend(coupon);
  const valueText = couponService.formatCouponValue(coupon);

  return (
    <div
      data-testid="coupon-card"
      data-status={coupon.status}
      style={TICKET_NOTCH_STYLE}
      className={cn(
        'relative rounded-card border border-hairline bg-surface-card',
        isInactive && 'opacity-60',
        className
      )}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-body font-semibold text-ink">
              {coupon.name}
            </h3>
            <span className="mt-1 inline-block rounded-lg bg-surface-sunken px-2 py-0.5 font-mono text-fine text-ink-muted">
              {coupon.code}
            </span>
          </div>

          {isInactive ? (
            <Badge tone="neutral">{t(`coupons.statuses.${coupon.status}`)}</Badge>
          ) : isExpiring ? (
            <Badge tone="warning">{t('coupons.expiringSoon')}</Badge>
          ) : null}
        </div>

        <p className="mt-3 text-display text-brand-600">{valueText}</p>

        {coupon.description && (
          <p className="mt-2 line-clamp-2 text-caption text-ink-muted">
            {coupon.description}
          </p>
        )}

        <div className="mt-3 space-y-1">
          {expiryText && (
            <p
              className={cn(
                'flex items-center gap-1 text-caption',
                isExpiring ? 'text-warning-700' : 'text-ink-muted'
              )}
            >
              <FiClock className="h-3 w-3" aria-hidden="true" />
              {expiryText}
            </p>
          )}

          {minimumSpendText && (
            <p className="text-fine text-ink-muted">
              {minimumSpendText}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        {(onUse ?? onViewDetails) && (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            {onUse && (
              <Button className="flex-1" onClick={() => onUse(coupon)}>
                {t('coupons.useCoupon')}
              </Button>
            )}

            {onViewDetails && (
              <Button variant="secondary" className="flex-1" onClick={() => onViewDetails(coupon)}>
                {t('coupons.viewDetails')}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CouponCard;
