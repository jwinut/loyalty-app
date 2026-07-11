import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FiGift, FiUser, FiCalendar, FiSearch } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { logger } from '../../utils/logger';
import { SurveyRewardHistory } from '../../types/survey';
import { surveyService } from '../../services/surveyService';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { EmptyState } from '../ui/EmptyState';
import { Table, type TableColumn } from '../ui/Table';

interface SurveyRewardHistoryProps {
  surveyId: string;
  surveyTitle: string;
}

const SurveyRewardHistoryComponent: React.FC<SurveyRewardHistoryProps> = ({
  surveyId,
  surveyTitle: _surveyTitle
}) => {
  const { t } = useTranslation();
  const [rewards, setRewards] = useState<SurveyRewardHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  const loadRewardHistory = useCallback(async () => {
    try {
      setLoading(true);
      const response = await surveyService.getSurveyRewardHistory(surveyId, currentPage, 20);
      setRewards(response.rewards);
      setTotalPages(response.totalPages);
    } catch (error: unknown) {
      logger.error('Error loading reward history:', error);
      toast.error(t('surveys.couponAssignment.loadError'));
    } finally {
      setLoading(false);
    }
  }, [surveyId, currentPage, t]);

  useEffect(() => {
    loadRewardHistory();
  }, [surveyId, currentPage, loadRewardHistory]);

  const filteredRewards = rewards.filter(reward =>
    (reward.user_email ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (reward.user_name ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (reward.coupon_code ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (reward.coupon_name ?? '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  function RewardDetails({ reward }: { reward: SurveyRewardHistory }) {
    if (!reward.metadata) {
      return null;
    }
    return (
      <details className="group mt-2 text-fine text-ink-muted">
        <summary className="cursor-pointer hover:text-ink">
          {t('surveys.rewardHistory.viewDetails')}
        </summary>
        <div className="mt-2 rounded-lg border border-hairline bg-surface-sunken p-3">
          <pre className="overflow-x-auto text-fine">
            {JSON.stringify(reward.metadata, null, 2)}
          </pre>
        </div>
      </details>
    );
  }

  const columns: TableColumn<SurveyRewardHistory>[] = [
    {
      key: 'reward',
      header: t('surveys.rewardHistory.couponColumn'),
      cell: (reward) => (
        <div>
          <div className="flex items-center gap-2">
            <FiGift className="h-4 w-4 flex-shrink-0 text-brand-600" aria-hidden="true" />
            <span className="font-semibold text-ink">
              {reward.coupon_code} - {reward.coupon_name}
            </span>
          </div>
          <RewardDetails reward={reward} />
        </div>
      ),
    },
    {
      key: 'user',
      header: t('surveys.rewardHistory.userColumn'),
      cell: (reward) => (
        <div className="flex items-center gap-2">
          <FiUser className="h-4 w-4 flex-shrink-0 text-success-600" aria-hidden="true" />
          <span>{reward.user_name ?? 'Unknown User'} ({reward.user_email})</span>
        </div>
      ),
    },
    {
      key: 'awardedAt',
      header: t('surveys.rewardHistory.awarded'),
      cell: (reward) => (
        <div className="flex items-center gap-2">
          <FiCalendar className="h-4 w-4 flex-shrink-0 text-warning-600" aria-hidden="true" />
          <span>{formatDate(reward.awarded_at)}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: t('surveys.stats.status'),
      align: 'right',
      cell: () => <Badge tone="success">{t('surveys.couponAssignment.completed')}</Badge>,
    },
  ];

  const emptyContent = (
    <EmptyState
      icon={FiGift}
      title={rewards.length === 0 ? t('surveys.rewardHistory.noRewardsAwarded') : t('surveys.rewardHistory.noRewardsMatch')}
      description={rewards.length === 0 ? t('surveys.rewardHistory.couponsWillAppear') : t('surveys.rewardHistory.tryAdjustingSearch')}
    />
  );

  return (
    <Card padding="none">
      <div className="border-b border-hairline p-6">
        <h3 className="text-title text-ink">
          {t('surveys.rewardHistory.title')}
        </h3>
        <p className="mt-1 text-caption text-ink-muted">
          {t('surveys.rewardHistory.description')}
        </p>

        <div className="mt-4">
          <Input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('surveys.rewardHistory.searchPlaceholder')}
            leadingIcon={<FiSearch className="h-5 w-5" aria-hidden="true" />}
          />
        </div>
      </div>

      <div className="p-6">
        <Table
          columns={columns}
          rows={filteredRewards}
          rowKey={(reward) => reward.id}
          loading={loading && currentPage === 1}
          empty={emptyContent}
          mobileCard={(reward) => (
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-body font-semibold text-ink">
                  {reward.user_name ?? 'Unknown User'}
                </p>
                <Badge tone="success">{t('surveys.couponAssignment.completed')}</Badge>
              </div>
              <p className="text-fine text-ink-muted">{reward.user_email}</p>
              <div className="flex items-center gap-2 text-caption text-ink">
                <FiGift className="h-4 w-4 flex-shrink-0 text-brand-600" aria-hidden="true" />
                <span>{reward.coupon_code} - {reward.coupon_name}</span>
              </div>
              <div className="flex items-center gap-2 text-caption text-ink-muted">
                <FiCalendar className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                <span>{t('surveys.rewardHistory.awarded')}: {formatDate(reward.awarded_at)}</span>
              </div>
              <RewardDetails reward={reward} />
            </div>
          )}
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between border-t border-hairline pt-4">
            <p className="text-caption text-ink">
              {t('surveys.rewardHistory.page')} {currentPage} {t('surveys.rewardHistory.of')} {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                {t('surveys.rewardHistory.previous')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                {t('surveys.rewardHistory.next')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default SurveyRewardHistoryComponent;
