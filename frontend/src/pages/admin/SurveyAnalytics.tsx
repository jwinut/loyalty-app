import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  FiDownload,
  FiUsers,
  FiCheckCircle,
  FiClock,
  FiBarChart,
  FiTrendingUp
} from 'react-icons/fi';
import { Survey, SurveyResponse } from '../../types/survey';
import { surveyService } from '../../services/surveyService';
import toast from 'react-hot-toast';
import { logger } from '../../utils/logger';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ChartData,
  ChartOptions
} from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';
import AppShell from '../../components/layout/AppShell';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button, buttonVariants } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { applyChartTheme, chartColorAt } from '../../utils/chartTheme';

// Register ChartJS components and the design system's warm chart defaults
// (Sarabun font, hairline grid, tile-surface tooltip) once per module load —
// every chart created afterward on this page picks the theme up automatically.
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
);
applyChartTheme();

interface QuestionAnalytics {
  questionId: string;
  question: string;
  type: string;
  responses: Record<string, number>;
  averageRating?: number;
}

interface AnalyticsData {
  survey: Survey;
  responses: SurveyResponse[];
  totalResponses: number;
  completionRate: number;
  averageCompletionTime: number;
  responsesByDate: { date: string; count: number }[];
  questionAnalytics: QuestionAnalytics[];
}

const SurveyAnalytics: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadAnalytics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadAnalytics = async () => {
    if (!id) {
      setError(t('surveys.admin.analytics.surveyIdRequired'));
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const analyticsData = await surveyService.getSurveyAnalytics(id);
      setAnalytics(analyticsData);
    } catch (err) {
      logger.error('Error loading analytics:', err);
      const errorMessage = err instanceof Error && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      setError(errorMessage ?? t('surveys.admin.analytics.loadError'));
      toast.error(t('surveys.admin.analytics.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleExportAnalytics = async () => {
    if (!id) {
      toast.error(t('surveys.admin.analytics.surveyIdRequired'));
      return;
    }

    try {
      const blob = await surveyService.exportSurveyResponses(id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `survey-${analytics?.survey.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-analytics.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success(t('surveys.admin.analytics.exportSuccess'));
    } catch (err) {
      logger.error('Error exporting analytics:', err);
      toast.error(t('surveys.admin.analytics.exportError'));
    }
  };

  const getChartOptions = useCallback(
    <T extends 'bar' | 'line' | 'pie'>(title: string): ChartOptions<T> => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top' as const,
        },
        title: {
          display: true,
          text: title,
          font: {
            size: 16
          }
        },
      },
    } as ChartOptions<T>),
    []
  );

  const responseTrendData = useMemo<ChartData<'line'>>(() => {
    if (!analytics) {return { labels: [], datasets: [] };}

    return {
      labels: analytics.responsesByDate.map(d => d.date),
      datasets: [
        {
          label: t('surveys.admin.analytics.dailyResponseCount'),
          data: analytics.responsesByDate.map(d => d.count),
          borderColor: chartColorAt(0),
          backgroundColor: chartColorAt(0, 0.12),
          tension: 0.4
        }
      ]
    };
  }, [analytics, t]);

  const questionChartData = useMemo<Record<string, ChartData<'bar'> | ChartData<'pie'>>>(() => {
    if (!analytics) {return {};}

    const result: Record<string, ChartData<'bar'> | ChartData<'pie'>> = {};
    for (const question of analytics.questionAnalytics) {
      const labels = Object.keys(question.responses);
      const data = Object.values(question.responses) as number[];

      result[question.questionId] = {
        labels,
        datasets: [{
          label: t('surveys.admin.analytics.responses'),
          data,
          backgroundColor: labels.map((_, index) => chartColorAt(index, 0.75)),
          borderColor: labels.map((_, index) => chartColorAt(index)),
          borderWidth: 1
        }]
      };
    }
    return result;
  }, [analytics, t]);

  if (loading) {
    return (
      <AppShell variant="admin" title={t('surveys.admin.analytics.title')}>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Card key={`analytics-kpi-skeleton-${index}`}>
              <Skeleton className="h-12 w-full" />
            </Card>
          ))}
        </div>
        <Card className="mt-8">
          <Skeleton className="h-64 w-full" />
        </Card>
      </AppShell>
    );
  }

  if (error || !analytics) {
    return (
      <AppShell variant="admin" title={t('surveys.admin.analytics.title')}>
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
      </AppShell>
    );
  }

  return (
    <AppShell variant="admin" title={t('surveys.admin.analytics.title')}>
      <PageHeader
        density="admin"
        title={analytics.survey.title}
        subtitle={t('surveys.admin.analytics.overview')}
        backTo="/admin/surveys"
        actions={
          <Button variant="secondary" onClick={handleExportAnalytics}>
            <FiDownload className="h-4 w-4" aria-hidden="true" />
            {t('surveys.admin.analytics.exportData')}
          </Button>
        }
      />

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <div className="flex items-center gap-4">
            <FiUsers className="h-8 w-8 flex-shrink-0 text-brand-600" aria-hidden="true" />
            <div>
              <p className="text-caption text-ink-muted">{t('surveys.admin.analytics.responses')}</p>
              <p className="text-title text-ink">{analytics.totalResponses}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <FiCheckCircle className="h-8 w-8 flex-shrink-0 text-success-600" aria-hidden="true" />
            <div>
              <p className="text-caption text-ink-muted">{t('surveys.admin.analytics.completion')}</p>
              <p className="text-title text-ink">{analytics.completionRate.toFixed(1)}%</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <FiClock className="h-8 w-8 flex-shrink-0 text-warning-600" aria-hidden="true" />
            <div>
              <p className="text-caption text-ink-muted">{t('surveys.admin.analytics.averageTime')}</p>
              <p className="text-title text-ink">
                {Math.floor(analytics.averageCompletionTime / 60)}m {analytics.averageCompletionTime % 60}s
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <FiBarChart className="h-8 w-8 flex-shrink-0 text-gold-600" aria-hidden="true" />
            <div>
              <p className="text-caption text-ink-muted">{t('surveys.stats.questions')}</p>
              <p className="text-title text-ink">{analytics.survey.questions.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Response Trend */}
      <Card className="mt-8">
        <h2 className="mb-4 flex items-center gap-2 text-title text-ink">
          <FiTrendingUp className="h-5 w-5" aria-hidden="true" />
          {t('surveys.admin.analytics.trends')}
        </h2>
        <div className="h-64">
          <Line
            data={responseTrendData}
            options={getChartOptions<'line'>(t('surveys.admin.analytics.dailyResponseCount'))}
          />
        </div>
      </Card>

      {/* Question Analytics */}
      <div className="mt-8 space-y-8">
        <h2 className="text-title text-ink">{t('surveys.admin.analytics.questionAnalytics')}</h2>

        {analytics.questionAnalytics.length === 0 ? (
          <Card>
            <EmptyState title={t('surveys.admin.analytics.noResponses')} />
          </Card>
        ) : (
          analytics.questionAnalytics.map((question, index) => (
            <Card key={question.questionId}>
              <h3 className="mb-4 text-body font-semibold text-ink">
                Q{index + 1}: {question.question}
              </h3>

              {(question.type === 'multiple_choice' || question.type === 'single_choice') && (
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="h-64">
                    <Bar
                      data={questionChartData[question.questionId] as ChartData<'bar'>}
                      options={getChartOptions<'bar'>(t('surveys.admin.analytics.responseDistribution'))}
                    />
                  </div>
                  <div className="h-64">
                    <Pie
                      data={questionChartData[question.questionId] as ChartData<'pie'>}
                      options={getChartOptions<'pie'>(t('surveys.admin.analytics.responsePercentage'))}
                    />
                  </div>
                </div>
              )}

              {(question.type === 'rating_5' || question.type === 'rating_10') && (
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="h-64">
                    <Bar
                      data={questionChartData[question.questionId] as ChartData<'bar'>}
                      options={getChartOptions<'bar'>(t('surveys.admin.analytics.ratingDistribution'))}
                    />
                  </div>
                  <div className="flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-caption text-ink-muted">{t('surveys.admin.analytics.averageRating')}</p>
                      <p className="text-display-lg font-bold text-brand-600">
                        {question.averageRating?.toFixed(1) ?? '0'}
                      </p>
                      <p className="text-caption text-ink-muted">
                        {t('surveys.admin.analytics.outOf', { max: question.type === 'rating_5' ? '5' : '10' })}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {question.type === 'yes_no' && (
                <div className="mx-auto h-64 max-w-md">
                  <Pie
                    data={questionChartData[question.questionId] as ChartData<'pie'>}
                    options={getChartOptions<'pie'>(t('surveys.admin.analytics.yesNoDistribution'))}
                  />
                </div>
              )}

              {(question.type === 'text' || question.type === 'textarea') && (
                <div className="rounded-lg bg-surface-sunken p-4">
                  <p className="text-ink">
                    {t('surveys.admin.analytics.textResponsesCollected', {
                      count: Object.keys(question.responses).length,
                    })}
                  </p>
                  <p className="mt-2 text-caption text-ink-muted">
                    {t('surveys.admin.analytics.textResponsesNote')}
                  </p>
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </AppShell>
  );
};

export default SurveyAnalytics;
