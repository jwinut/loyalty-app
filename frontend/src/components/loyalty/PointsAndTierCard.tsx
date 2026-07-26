import { Link } from 'react-router';
import { UserLoyaltyStatus } from '../../services/loyaltyService';
import { useTranslation } from 'react-i18next';
import { FiStar } from 'react-icons/fi';
import { Card } from '../ui/Card';
import { resolveTierBenefits } from '../../utils/tierBenefits';
import { tierTheme } from '../../utils/tierTheme';

interface PointsAndTierCardProps {
  loyaltyStatus: UserLoyaltyStatus;
}

export default function PointsAndTierCard({ loyaltyStatus }: PointsAndTierCardProps) {
  const { t, i18n } = useTranslation();
  const theme = tierTheme(loyaltyStatus.tier_name, loyaltyStatus.tier_color);
  const benefits = resolveTierBenefits(loyaltyStatus.tier_benefits, i18n.language);

  return (
    <Card className="h-auto border-l-4" style={{ borderLeftColor: theme.accent }}>
      {/* Points Balance Section */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: theme.tintBg }}>
            <FiStar className="w-6 h-6" style={{ color: theme.accent }} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-stone-900">
              {t('loyalty.pointsBalance')}
            </h3>
            <p className="text-sm text-stone-600" data-testid="loyalty-tier">
              {loyaltyStatus.tier_name} {t('loyalty.member')}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div
            className="text-display"
            style={{ color: theme.accent }}
            data-testid="loyalty-points"
          >
            {loyaltyStatus.current_points.toLocaleString()}
          </div>
          <div className="text-sm text-stone-600">
            {t('loyalty.availablePoints')}
          </div>
        </div>
      </div>

      {/* Tier Benefits Preview */}
      <div className="border-t pt-4">
        <div className="text-sm font-semibold text-stone-700 mb-3">
          {t('loyalty.tierBenefits')}
        </div>
        {benefits.perks.length > 0 && (
          <ul className="space-y-2">
            {benefits.perks.map((perk, index) => (
              <li key={index} className="flex items-start space-x-2">
                <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                      style={{ backgroundColor: theme.accent }}
                />
                <span className="text-sm text-stone-700">{perk}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3">
          <Link
            to="/benefits"
            data-testid="view-all-benefits-link"
            className="text-sm text-stone-500 hover:underline"
          >
            {t('tierBenefits.viewAll')}
          </Link>
        </div>
      </div>
    </Card>
  );
}
