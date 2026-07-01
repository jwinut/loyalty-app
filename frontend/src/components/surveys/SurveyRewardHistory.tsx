import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FiGift, FiUser, FiCalendar, FiSearch } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { logger } from '../../utils/logger';
import { SurveyRewardHistory } from '../../types/survey';
import { surveyService } from '../../services/surveyService';

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

  if (loading && currentPage === 1) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-stone-200 rounded w-1/4 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-stone-200 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-stone-200">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-medium text-stone-900">
              {t('surveys.rewardHistory.title')}
            </h3>
            <p className="text-sm text-stone-500 mt-1">
              {t('surveys.rewardHistory.description')}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FiSearch className="h-5 w-5 text-stone-400" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-stone-300 rounded-md leading-5 bg-white placeholder-stone-500 focus:outline-none focus:placeholder-stone-400 focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
            placeholder={t('surveys.rewardHistory.searchPlaceholder')}
          />
        </div>
      </div>

      <div className="p-6">
        {filteredRewards.length === 0 ? (
          <div className="text-center py-8">
            <FiGift className="h-12 w-12 text-stone-400 mx-auto mb-4" />
            <p className="text-stone-500">
              {rewards.length === 0 
                ? t('surveys.rewardHistory.noRewardsAwarded')
                : t('surveys.rewardHistory.noRewardsMatch')
              }
            </p>
            <p className="text-sm text-stone-400 mt-2">
              {rewards.length === 0 
                ? t('surveys.rewardHistory.couponsWillAppear')
                : t('surveys.rewardHistory.tryAdjustingSearch')
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRewards.map((reward) => (
              <div
                key={reward.id}
                className="border border-stone-200 rounded-lg p-4 hover:bg-stone-50 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="flex items-center">
                        <FiGift className="h-5 w-5 text-brand-500 mr-2" />
                        <h4 className="font-medium text-stone-900">
                          {reward.coupon_code} - {reward.coupon_name}
                        </h4>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-stone-600">
                      <div className="flex items-center">
                        <FiUser className="mr-2 text-green-500" />
                        <span>
                          {reward.user_name ?? 'Unknown User'} ({reward.user_email})
                        </span>
                      </div>

                      <div className="flex items-center">
                        <FiCalendar className="mr-2 text-orange-500" />
                        <span>
                          {t('surveys.rewardHistory.awarded')}: {formatDate(reward.awarded_at)}
                        </span>
                      </div>
                    </div>

                    {reward.metadata && (
                      <div className="mt-2 text-sm text-stone-500">
                        <details className="group">
                          <summary className="cursor-pointer hover:text-stone-700">
                            {t('surveys.rewardHistory.viewDetails')}
                          </summary>
                          <div className="mt-2 p-3 bg-stone-50 rounded border">
                            <pre className="text-xs overflow-x-auto">
                              {JSON.stringify(reward.metadata, null, 2)}
                            </pre>
                          </div>
                        </details>
                      </div>
                    )}
                  </div>

                  <div className="ml-4">
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                      {t('surveys.couponAssignment.completed')}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-6 pt-4 border-t border-stone-200">
            <p className="text-sm text-stone-700">
              {t('surveys.rewardHistory.page')} {currentPage} {t('surveys.rewardHistory.of')} {totalPages}
            </p>
            <div className="flex space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm bg-stone-200 text-stone-700 rounded hover:bg-stone-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('surveys.rewardHistory.previous')}
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm bg-stone-200 text-stone-700 rounded hover:bg-stone-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('surveys.rewardHistory.next')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SurveyRewardHistoryComponent;