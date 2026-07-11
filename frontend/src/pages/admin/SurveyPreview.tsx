import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Survey } from '../../types/survey';
import { surveyService } from '../../services/surveyService';
import SurveyPreview from '../../components/surveys/SurveyPreview';
import toast from 'react-hot-toast';
import { logger } from '../../utils/logger';
import AppShell from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { buttonVariants } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';

const SurveyPreviewPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadSurvey();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadSurvey = async () => {
    if (!id) {
      setError(t('surveys.admin.analytics.surveyIdRequired'));
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const surveyData = await surveyService.getSurveyById(id);
      setSurvey(surveyData);
    } catch (err) {
      logger.error('Error loading survey:', err);
      const errorMessage = err instanceof Error && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      setError(errorMessage ?? t('surveys.admin.messages.loadError'));
      toast.error(t('surveys.admin.messages.loadError'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AppShell variant="admin" title={t('surveys.admin.questionEditor.preview')}>
        <div className="mx-auto max-w-text">
          <Card><Skeleton className="h-64 w-full" /></Card>
        </div>
      </AppShell>
    );
  }

  if (error || !survey) {
    return (
      <AppShell variant="admin" title={t('surveys.admin.questionEditor.preview')}>
        <div className="mx-auto max-w-text">
          <Card>
            <EmptyState
              title={error ?? t('surveys.notFound')}
              action={
                <Link to="/admin/surveys" className={buttonVariants({ variant: 'secondary' })}>
                  {t('surveys.backToSurveys')}
                </Link>
              }
            />
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell variant="admin" title={t('surveys.admin.questionEditor.preview')}>
      <div className="mx-auto max-w-text">
        <SurveyPreview
          survey={survey}
          onClose={() => window.history.back()}
        />
      </div>
    </AppShell>
  );
};

export default SurveyPreviewPage;