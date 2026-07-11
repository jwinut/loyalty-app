import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import QRCode from 'qrcode';
import AppShell from '../components/layout/AppShell';
import { useAuthStore } from '../store/authStore';
import { userService } from '../services/userService';
import { loyaltyService } from '../services/loyaltyService';
import { getUserDisplayName } from '../utils/userHelpers';
import { logger } from '../utils/logger';
import { Card } from '../components/ui';
import { BrandLogo } from '../components/brand/BrandLogo';
import { tierTheme } from '../utils/tierTheme';

/**
 * The member card: a QR code of the membership ID plus the readable ID and
 * tier. Front-desk staff scan this at check-in to link the membership to
 * the guest profile in the PMS — after that, stays accrue automatically.
 */
export default function MemberCardPage() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);

  const { data: profile } = useQuery({
    queryKey: ['user', 'profile'],
    queryFn: () => userService.getProfile(),
    enabled: !user?.membershipId,
  });

  const { data: loyaltyStatus } = useQuery({
    queryKey: ['loyalty', 'status'],
    queryFn: () => loyaltyService.getUserLoyaltyStatus(),
  });

  const membershipId = user?.membershipId ?? profile?.membershipId ?? null;
  const theme = tierTheme(loyaltyStatus?.tier_name, loyaltyStatus?.tier_color);

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrFailed, setQrFailed] = useState(false);

  useEffect(() => {
    if (!membershipId) {
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(membershipId, {
      width: 288,
      margin: 2,
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (!cancelled) {
          setQrDataUrl(url);
          setQrFailed(false);
        }
      })
      .catch((error: unknown) => {
        logger.error(
          'Failed to generate member QR:',
          error instanceof Error ? error.message : String(error),
        );
        if (!cancelled) {
          setQrFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [membershipId]);

  return (
    <AppShell variant="guest" title={t('memberCard.title')}>
      <div className="mx-auto max-w-md">
        <Card surface="tile" padding="none" className="overflow-hidden shadow-soft">
          <div className="px-6 py-4">
            <BrandLogo variant="wordmark" tone="onDark" />
          </div>

          {/* Tier band */}
          <div className="px-6 py-4" style={{ backgroundColor: theme.tintBg, color: theme.onTint }}>
            <p className="text-caption">{getUserDisplayName(user)}</p>
            <p className="text-body font-semibold" data-testid="member-card-tier">
              {loyaltyStatus?.tier_name ?? ''}
            </p>
          </div>

          <div className="p-6 text-center">
            {membershipId ? (
              <>
                <div className="mb-4 inline-block rounded-lg bg-white p-4">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt={t('memberCard.qrAlt')}
                      className="h-64 w-64 object-contain"
                      data-testid="member-qr"
                    />
                  ) : (
                    <div className="flex h-64 w-64 items-center justify-center text-caption text-ink-muted">
                      {qrFailed ? t('memberCard.qrError') : t('memberCard.generating')}
                    </div>
                  )}
                </div>

                <div className="mb-1 text-caption font-semibold text-tile-muted">
                  {t('memberCard.membershipId')}
                </div>
                <div
                  className="inline-block rounded-lg bg-tile-raised px-3 py-2 font-mono text-body text-tile-text"
                  data-testid="member-id"
                >
                  {membershipId}
                </div>
              </>
            ) : (
              <p className="py-12 text-body text-tile-muted" data-testid="member-id-missing">
                {t('memberCard.noMembershipId')}
              </p>
            )}

            <p className="mt-6 text-caption text-tile-muted">{t('memberCard.showAtDesk')}</p>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
