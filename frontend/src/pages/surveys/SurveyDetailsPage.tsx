import React, { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiArrowLeft, FiCalendar, FiUsers, FiEye, FiHelpCircle, FiActivity } from 'react-icons/fi';
import { Survey } from '../../types/survey';
import SurveyPreview from '../../components/surveys/SurveyPreview';
import AppShell from '../../components/layout/AppShell';
import toast from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import { surveyService } from '../../services/surveyService';
import { Badge, buttonVariants, Card } from '../../components/ui';

const SurveyDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();

  // Fetch survey using React Query
  const {
    data: survey,
    isLoading: loading,
    error: surveyError
  } = useQuery({
    queryKey: ['surveys', id],
    queryFn: () => surveyService.getSurveyById(id as string),
    enabled: !!id,
  });

  // Show error toast when error occurs
  React.useEffect(() => {
    if (surveyError) {
      toast.error(t('surveys.errors.loadFailed'));
    }
  }, [surveyError, t]);

  const error = surveyError ? (surveyError instanceof Error ? surveyError.message : 'An error occurred') : null;

  // Memoize date formatting for performance
  const formatDate = useMemo(() => (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  }, []);

  if (loading) {
    return (
      <AppShell variant="guest" title={t('surveys.title', 'Surveys')}>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500" />
          <span className="ml-3 text-stone-600">{t('surveys.loading')}</span>
        </div>
      </AppShell>
    );
  }

  if (error || !survey) {
    return (
      <AppShell variant="guest" title={t('surveys.title', 'Surveys')}>
        <div className="text-center py-12">
          <div className="text-red-500 text-xl mb-4">
            {error ?? t('surveys.notFound')}
          </div>
          <Link
            to="/surveys"
            className="inline-flex items-center text-brand-600 hover:text-brand-800"
          >
            <FiArrowLeft className="mr-2 h-4 w-4" />
            {t('surveys.backToSurveys')}
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell variant="guest" title={survey.title}>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <Link
          to="/surveys"
          aria-label={t('surveys.backToSurveys')}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-ink hover:bg-surface-sunken"
        >
          <FiArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <Link
          to={`/surveys/${survey.id}/take`}
          className={buttonVariants()}
        >
          {t('surveys.takeSurvey')}
        </Link>
      </div>

      {/* Summary stat tiles */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="flex flex-col gap-2">
          <FiHelpCircle className="h-5 w-5 text-brand-600" aria-hidden="true" />
          <p className="text-title text-ink">{survey.questions?.length ?? 0}</p>
          <p className="text-caption text-ink-muted">{t('surveys.stats.questions', 'Questions')}</p>
        </Card>
        <Card className="flex flex-col gap-2">
          <FiActivity className="h-5 w-5 text-brand-600" aria-hidden="true" />
          <p className="text-title capitalize text-ink">{survey.status}</p>
          <p className="text-caption text-ink-muted">{t('surveys.stats.status', 'Status')}</p>
        </Card>
        <Card className="flex flex-col gap-2">
          {survey.access_type === 'public' ? (
            <FiUsers className="h-5 w-5 text-brand-600" aria-hidden="true" />
          ) : (
            <FiEye className="h-5 w-5 text-brand-600" aria-hidden="true" />
          )}
          <p className="text-title text-ink">
            {survey.access_type === 'public' ? t('surveys.accessType.public') : t('surveys.accessType.invited')}
          </p>
          <p className="text-caption text-ink-muted">{t('surveys.stats.accessType', 'Access Type')}</p>
        </Card>
        <Card className="flex flex-col gap-2">
          <FiCalendar className="h-5 w-5 text-brand-600" aria-hidden="true" />
          <p className="text-title text-ink">{formatDate(survey.created_at)}</p>
          <p className="text-caption text-ink-muted">{t('surveys.stats.created', 'Created')}</p>
        </Card>
      </div>

      {survey.description && (
        <Card className="mb-6">
          <h2 className="mb-2 text-title text-ink">{t('surveys.description')}</h2>
          <p className="text-body text-ink-muted">{survey.description}</p>
        </Card>
      )}

      {/* Details */}
      <Card className="mb-6">
        <h2 className="mb-4 text-title text-ink">{t('surveys.stats.details', 'Details')}</h2>
        <dl className="space-y-3">
          <div className="flex items-center justify-between border-b border-hairline py-2">
            <dt className="text-ink-muted">{t('surveys.created')}</dt>
            <dd className="font-semibold text-ink">{formatDate(survey.created_at)}</dd>
          </div>
          <div className="flex items-center justify-between py-2">
            <dt className="text-ink-muted">{t('surveys.stats.accessType', 'Access Type')}</dt>
            <dd>
              <Badge tone={survey.access_type === 'public' ? 'success' : 'brand'}>
                {survey.access_type === 'public' ? t('surveys.accessType.public') : t('surveys.accessType.invited')}
              </Badge>
            </dd>
          </div>
        </dl>
      </Card>

      <Card>
        <h2 className="mb-4 text-title text-ink">
          {t('surveys.preview', { count: survey.questions?.length ?? 0 })}
        </h2>
        <SurveyPreview
          survey={survey as Survey}
          onClose={() => window.history.back()}
        />
      </Card>
    </AppShell>
  );
};

export default SurveyDetailsPage;
