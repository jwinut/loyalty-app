import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import QRCode from 'qrcode';
import MainLayout from '../components/layout/MainLayout';
import { useAuthStore } from '../store/authStore';
import { userService } from '../services/userService';
import { loyaltyService } from '../services/loyaltyService';
import { getUserDisplayName } from '../utils/userHelpers';
import { logger } from '../utils/logger';

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
    <MainLayout title={t('memberCard.title')}>
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Tier band */}
          <div
            className="px-6 py-4"
            style={{ backgroundColor: loyaltyStatus?.tier_color ?? '#7f1d1d' }}
          >
            <p className="text-white text-sm opacity-90">{getUserDisplayName(user)}</p>
            <p className="text-white text-lg font-bold" data-testid="member-card-tier">
              {loyaltyStatus?.tier_name ?? ''}
            </p>
          </div>

          <div className="p-6 text-center">
            {membershipId ? (
              <>
                <div className="bg-white p-4 rounded-lg shadow-inner border-2 border-stone-200 inline-block mb-4">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt={t('memberCard.qrAlt')}
                      className="w-64 h-64 object-contain"
                      data-testid="member-qr"
                    />
                  ) : (
                    <div className="w-64 h-64 flex items-center justify-center text-sm text-stone-500">
                      {qrFailed ? t('memberCard.qrError') : t('memberCard.generating')}
                    </div>
                  )}
                </div>

                <div className="text-sm text-stone-600 mb-1 font-medium">
                  {t('memberCard.membershipId')}
                </div>
                <div
                  className="text-lg font-mono bg-stone-100 px-4 py-2 rounded-lg border inline-block"
                  data-testid="member-id"
                >
                  {membershipId}
                </div>
              </>
            ) : (
              <p className="text-stone-600 py-12" data-testid="member-id-missing">
                {t('memberCard.noMembershipId')}
              </p>
            )}

            <p className="text-sm text-stone-500 mt-6">{t('memberCard.showAtDesk')}</p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
