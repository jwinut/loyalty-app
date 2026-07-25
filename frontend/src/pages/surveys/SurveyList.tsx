import React, { useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { FiUsers, FiEye, FiCalendar, FiRefreshCw, FiClipboard } from 'react-icons/fi';
import { Survey } from '../../types/survey';
import { useAuthRedirect } from '../../hooks/useAuthRedirect';
import AppShell from '../../components/layout/AppShell';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { surveyService } from '../../services/surveyService';
import { Badge, Button, buttonVariants, Card, EmptyState, TabNav } from '../../components/ui';

type SurveyTab = 'public' | 'invited';

const SurveyList: React.FC = () => {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuthRedirect(); // Additional auth check
  const [activeTab, setActiveTab] = useState<SurveyTab>('public');

  // Fetch public surveys using React Query
  const {
    data: publicSurveys = [],
    isLoading: loadingPublic,
    error: publicError,
    refetch: refetchPublic
  } = useQuery({
    queryKey: ['surveys', 'public'],
    queryFn: () => surveyService.getPublicSurveys(),
    enabled: isAuthenticated,
  });

  // Fetch invited surveys using React Query
  const {
    data: invitedSurveys = [],
    isLoading: loadingInvited,
    error: invitedError,
    refetch: refetchInvited
  } = useQuery({
    queryKey: ['surveys', 'invited'],
    queryFn: () => surveyService.getInvitedSurveys(),
    enabled: isAuthenticated,
  });

  const loading = loadingPublic || loadingInvited;
  const error = publicError ?? invitedError;
  const errorMessage = error ? (error instanceof Error ? error.message : 'An error occurred') : null;

  const loadSurveys = async () => {
    await Promise.all([refetchPublic(), refetchInvited()]);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const renderSurveyCard = (survey: Survey) => (
    <Card key={survey.id} className="flex h-full flex-col">
      <div className="flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h3 className="text-body font-semibold text-ink">
            {survey.title}
          </h3>
          <Badge tone={survey.access_type === 'public' ? 'success' : 'brand'}>
            {survey.access_type === 'public' ? (
              <>
                <FiUsers className="h-3 w-3" aria-hidden="true" />
                {t('surveys.accessType.public')}
              </>
            ) : (
              <>
                <FiEye className="h-3 w-3" aria-hidden="true" />
                {t('surveys.accessType.invited')}
              </>
            )}
          </Badge>
        </div>
        {survey.description && (
          <p className="mb-4 line-clamp-3 text-caption text-ink-muted">
            {survey.description}
          </p>
        )}
      </div>

      <div className="mb-4 flex items-center justify-between text-caption text-ink-muted">
        <span>
          {survey.questions.length} {t('surveys.questions', 'questions')}
        </span>
        <span className="flex items-center gap-1">
          <FiCalendar className="h-3 w-3" aria-hidden="true" />
          {formatDate(survey.created_at)}
        </span>
      </div>

      <div className="mt-auto flex gap-3">
        <Link
          to={`/surveys/${survey.id}/take`}
          className={buttonVariants({ className: 'flex-1 justify-center' })}
        >
          {t('surveys.takeSurvey', 'Take Survey')}
        </Link>
        <Link
          to={`/surveys/${survey.id}/details`}
          className={buttonVariants({ variant: 'secondary', className: 'flex-1 justify-center' })}
        >
          {t('surveys.viewDetails', 'View Details')}
        </Link>
      </div>
    </Card>
  );

  const currentSurveys = activeTab === 'public' ? publicSurveys : invitedSurveys;

  return (
    <AppShell variant="guest" title={t('surveys.title', 'Surveys')}>
      <div className="flex items-center justify-end mb-6">
        <Button variant="secondary" size="sm" onClick={loadSurveys} disabled={loading}>
          <FiRefreshCw className={clsx('h-4 w-4', loading && 'animate-spin')} aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {loading && (
        <div className="mb-6">
          <div className="flex justify-center items-center h-24 bg-white rounded-lg border border-stone-200">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
            <span className="ml-3 text-stone-600">{t('surveys.loading')}</span>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm">{errorMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Survey Type Tabs */}
      <TabNav
        aria-label="Tabs"
        className="mb-6"
        value={activeTab}
        onChange={(value) => setActiveTab(value as SurveyTab)}
        items={[
          {
            value: 'public',
            label: (
              <span className="flex items-center gap-2">
                <FiUsers className="h-4 w-4" aria-hidden="true" />
                {t('surveys.tabs.public')} {t('surveys.title')}
              </span>
            ),
            count: publicSurveys.length,
          },
          {
            value: 'invited',
            label: (
              <span className="flex items-center gap-2">
                <FiEye className="h-4 w-4" aria-hidden="true" />
                {t('surveys.tabs.invited')} {t('surveys.title')}
              </span>
            ),
            count: invitedSurveys.length,
          },
        ]}
      />

      {/* Survey Description */}
      <div className="mb-6 p-4 bg-brand-50 border border-brand-200 rounded-lg">
        <div className="flex items-start">
          {activeTab === 'public' ? (
            <FiUsers className="flex-shrink-0 h-5 w-5 text-brand-600 mt-0.5 mr-3" aria-hidden="true" />
          ) : (
            <FiEye className="flex-shrink-0 h-5 w-5 text-brand-600 mt-0.5 mr-3" aria-hidden="true" />
          )}
          <div>
            <h3 className="text-sm font-semibold text-brand-900 mb-1">
              {activeTab === 'public' ? 'Public Surveys' : 'Invited Surveys'}
            </h3>
            <p className="text-sm text-brand-800">
              {activeTab === 'public'
                ? 'These surveys are available to all users in the app. Complete them anytime to share your feedback.'
                : 'These surveys are specifically for you. You were personally invited to participate in these surveys.'
              }
            </p>
          </div>
        </div>
      </div>

      {currentSurveys.length === 0 && !loading && !errorMessage ? (
        <EmptyState
          icon={FiClipboard}
          title={t('surveys.noSurveys', 'No surveys available')}
          description={
            activeTab === 'public'
              ? t('surveys.noPublicSurveys', 'No public surveys are currently available. Check back later!')
              : t('surveys.noInvitedSurveys', 'You haven\'t been invited to any surveys yet.')
          }
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {currentSurveys.map((survey: Survey) => renderSurveyCard(survey))}
        </div>
      )}

      {/* Refresh button */}
      <div className="mt-8 text-center">
        <Button variant="secondary" onClick={loadSurveys} disabled={loading}>
          {loading ? t('common.loading', 'Loading...') : t('common.refresh', 'Refresh')}
        </Button>
      </div>
    </AppShell>
  );
};

export default SurveyList;
