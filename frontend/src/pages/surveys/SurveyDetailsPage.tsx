import React, { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiArrowLeft, FiCalendar, FiUsers, FiEye } from 'react-icons/fi';
import { Survey } from '../../types/survey';
import SurveyPreview from '../../components/surveys/SurveyPreview';
import AppShell from '../../components/layout/AppShell';
import toast from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { surveyService } from '../../services/surveyService';

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
        <div className="flex items-center">
          <Link
            to="/surveys"
            className="mr-4 text-stone-400 hover:text-stone-600"
          >
            <FiArrowLeft className="h-6 w-6" />
          </Link>
          <div className="flex items-center space-x-4 text-sm text-stone-500">
            <span className="flex items-center">
              <FiCalendar className="mr-1 h-3 w-3" />
              {t('surveys.created')} {formatDate(survey.created_at)}
            </span>
            <span className={clsx('inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
              survey.access_type === 'public'
                ? 'bg-green-100 text-green-800'
                : 'bg-brand-100 text-brand-800'
            )}
            >
              {survey.access_type === 'public' ? (
                <>
                  <FiUsers className="mr-1 h-3 w-3" />
                  {t('surveys.accessType.public')}
                </>
              ) : (
                <>
                  <FiEye className="mr-1 h-3 w-3" />
                  {t('surveys.accessType.invited')}
                </>
              )}
            </span>
          </div>
        </div>
        <Link
          to={`/surveys/${survey.id}/take`}
          className="bg-brand-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          {t('surveys.takeSurvey')}
        </Link>
      </div>

      {survey.description && (
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-stone-900 mb-2">{t('surveys.description')}</h2>
          <p className="text-stone-600">{survey.description}</p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold text-stone-900 mb-4">
          {t('surveys.preview', { count: survey.questions?.length ?? 0 })}
        </h2>
        <SurveyPreview
          survey={survey as Survey}
          onClose={() => window.history.back()}
        />
      </div>
    </AppShell>
  );
};

export default SurveyDetailsPage;
