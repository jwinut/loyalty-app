import { PointsTransaction } from '../../services/loyaltyService';
import { useTranslation } from 'react-i18next';
import { FiPlus, FiMinus, FiClock, FiUser } from 'react-icons/fi';
import { formatDateToDDMMYYYY } from '../../utils/dateFormatter';
import { Card } from '../ui/Card';

interface TransactionListProps {
  transactions: PointsTransaction[];
  isLoading?: boolean;
  showLoadMore?: boolean;
  onLoadMore?: () => void;
  showAdminInfo?: boolean; // New prop to control admin info visibility
}

// earned_stay with 0 points should still count as positive (nights awarded);
// admin_deduction is always treated as negative even when points are 0.
function isPositiveDelta(transaction: PointsTransaction): boolean {
  return transaction.points > 0 || (transaction.points === 0 && transaction.type === 'earned_stay');
}

export default function TransactionList({
  transactions,
  isLoading = false,
  showLoadMore = false,
  onLoadMore,
  showAdminInfo = false // Default to false - don't show admin info unless explicitly requested
}: TransactionListProps) {
  const { t } = useTranslation();

  const getTransactionIcon = (transaction: PointsTransaction) => {
    if (isPositiveDelta(transaction)) {
      return <FiPlus className="w-4 h-4 text-success-700" />;
    }
    return <FiMinus className="w-4 h-4 text-error-700" />;
  };

  const getPointsFocusedDescription = (transaction: PointsTransaction) => {
    // Always focus on points gained/lost rather than any spending amounts
    // Both earned_stay and admin_deduction should show the same admin adjustment text
    if (transaction.type === 'earned_stay' || transaction.type === 'admin_deduction') {
      return `${t('loyalty.transactionTypes.earnedStay')}`; // แอดมินปรับปรุงคะแนนและจำนวนคืน
    }

    if (isPositiveDelta(transaction)) {
      // Positive points or nights awarded - focus on earning
      switch (transaction.type) {
        case 'stay_earning':
          return `${t('loyalty.transactionTypes.earnedStay')}`;
        case 'earned_bonus':
          return `${t('loyalty.transactionTypes.earnedBonus')}`;
        case 'admin_award':
          return `${t('loyalty.transactionTypes.adminAward')}`;
        default:
          return `${t('loyalty.pointsEarned')}`;
      }
    } else {
      // Negative points - focus on usage/deduction
      switch (transaction.type) {
        case 'redeemed':
          return `${t('loyalty.transactionTypes.redeemed')}`;
        case 'expired':
          return `${t('loyalty.transactionTypes.expired')}`;
        default:
          return `${t('loyalty.pointsDeducted')}`;
      }
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const dateOnly = formatDateToDDMMYYYY(date);
    const timeOnly = date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    return `${dateOnly} ${timeOnly}`;
  };

  if (isLoading) {
    return (
      <Card>
        <h3 className="text-lg font-semibold text-stone-900 mb-4">
          {t('loyalty.transactionHistory')}
        </h3>
        <div className="space-y-4">
          {[...Array(5)].map((_, index) => (
            <div key={index} className="animate-pulse">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-stone-200 rounded-lg" />
                <div className="flex-1">
                  <div className="h-4 bg-stone-200 rounded w-1/2 mb-2" />
                  <div className="h-3 bg-stone-200 rounded w-1/3" />
                </div>
                <div className="h-4 bg-stone-200 rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col h-full">
      <h3 className="text-lg font-semibold text-stone-900 mb-4 flex-shrink-0">
        {t('loyalty.transactionHistory')}
      </h3>

      {transactions.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-stone-500 min-h-[200px]">
          <FiClock className="w-12 h-12 mb-3 text-stone-400" />
          <p>{t('loyalty.noTransactions')}</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="space-y-4">
            {transactions.map((transaction) => (
            <div key={transaction.id} className="flex items-center space-x-4 py-3 border-b border-hairline last:border-b-0">
              {/* Transaction Icon */}
              <div className={`
                w-10 h-10 rounded-lg flex items-center justify-center
                ${isPositiveDelta(transaction) ? 'bg-success-50' : 'bg-error-50'}
              `}
              >
                {getTransactionIcon(transaction)}
              </div>

              {/* Transaction Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-stone-900 truncate">
                    {getPointsFocusedDescription(transaction)}
                  </p>
                  <div className="text-right">
                    <p className={`font-semibold ${isPositiveDelta(transaction) ? 'text-success-700' : 'text-error-700'}`}>
                      {isPositiveDelta(transaction) ? '+' : ''}{transaction.points.toLocaleString()} {t('loyalty.points')}
                    </p>
                    {(transaction.type === 'earned_stay' || transaction.type === 'admin_deduction') && transaction.description && (() => {
                      const nightsMatch = transaction.description.match(/(-?\d+)\s*night/i);
                      let nights = nightsMatch?.[1] ? parseInt(nightsMatch[1]) : null;

                      // Force negative for admin_deduction if not already negative
                      if (nights !== null && transaction.type === 'admin_deduction' && nights > 0) {
                        nights = -nights;
                      }

                      if (nights !== null && nights !== 0) {
                        return (
                          <p className="text-sm text-stone-900">
                            {nights > 0 ? '+' : ''}{nights} {Math.abs(nights) === 1 ? t('loyalty.night') : t('loyalty.nights')}
                          </p>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>

                <div className="flex items-center space-x-4 mt-1">
                  <p className="text-sm text-stone-600">
                    {formatDate(transaction.created_at)}
                  </p>

                  {showAdminInfo && transaction.admin_email && (
                    <div className="flex items-center space-x-1 text-xs text-stone-500">
                      <FiUser className="w-3 h-3" />
                      <span>{transaction.admin_email}</span>
                    </div>
                  )}
                </div>

                {transaction.admin_reason && !transaction.admin_reason.toLowerCase().includes('thb') && !transaction.admin_reason.toLowerCase().includes('baht') && !transaction.admin_reason.toLowerCase().includes('฿') && (
                  <p className="text-xs text-stone-500 mt-1 italic">
                    {transaction.admin_reason}
                  </p>
                )}
              </div>
            </div>
          ))}

            {showLoadMore && (
              <div className="text-center pt-4">
                <button
                  onClick={onLoadMore}
                  className="px-4 py-2 text-sm font-semibold text-brand-600 bg-brand-50 rounded-lg hover:bg-brand-100 transition-colors"
                >
                  {t('common.loadMore')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
