import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  FiArrowLeft,
  FiDownload,
  FiUsers,
  FiCheckCircle,
  FiClock,
  FiBarChart,
  FiTrendingUp
} from 'react-icons/fi';
import { Survey, SurveyResponse } from '../../types/survey';
import { surveyService } from '../../services/surveyService';
import DashboardButton from '../../components/navigation/DashboardButton';
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

// Register ChartJS components
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
      setError('Survey ID is required');
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
      setError(errorMessage ?? 'Failed to load analytics');
      toast.error('Failed to load survey analytics');
    } finally {
      setLoading(false);
    }
  };

  const handleExportAnalytics = async () => {
    if (!id) {
      toast.error('Survey ID is required for export');
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
      toast.success('Analytics exported successfully');
    } catch (err) {
      logger.error('Error exporting analytics:', err);
      toast.error('Failed to export analytics');
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
          label: 'Daily Responses',
          data: analytics.responsesByDate.map(d => d.count),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4
        }
      ]
    };
  }, [analytics]);

  const questionChartData = useMemo<Record<string, ChartData<'bar'> | ChartData<'pie'>>>(() => {
    if (!analytics) {return {};}

    const backgroundColors = [
      'rgba(255, 99, 132, 0.6)',
      'rgba(54, 162, 235, 0.6)',
      'rgba(255, 206, 86, 0.6)',
      'rgba(75, 192, 192, 0.6)',
      'rgba(153, 102, 255, 0.6)',
      'rgba(255, 159, 64, 0.6)',
    ];

    const result: Record<string, ChartData<'bar'> | ChartData<'pie'>> = {};
    for (const question of analytics.questionAnalytics) {
      const labels = Object.keys(question.responses);
      const data = Object.values(question.responses) as number[];

      result[question.questionId] = {
        labels,
        datasets: [{
          label: 'Responses',
          data,
          backgroundColor: backgroundColors.slice(0, labels.length),
          borderColor: backgroundColors.slice(0, labels.length).map(c => c.replace('0.6', '1')),
          borderWidth: 1
        }]
      };
    }
    return result;
  }, [analytics]);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50">
        <div className="max-w-7xl mx-auto p-4">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500" />
            <span className="ml-3 text-stone-600">Loading analytics...</span>
          </div>
        </div>
      </div>
    );
  }

   
  if (error || !analytics) {
    return (
      <div className="min-h-screen bg-stone-50">
        <div className="max-w-7xl mx-auto p-4">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            <p>{error ?? 'Survey not found'}</p>
            <Link to="/admin/surveys" className="text-red-800 underline mt-2 inline-block">
              Back to Surveys
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <Link
                to="/admin/surveys"
                className="mr-4 text-stone-400 hover:text-stone-600"
              >
                <FiArrowLeft className="h-6 w-6" />
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-stone-900">Survey Analytics</h1>
                <p className="text-sm text-stone-600 mt-1">{analytics.survey.title}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={handleExportAnalytics}
                className="inline-flex items-center px-4 py-2 border border-stone-300 rounded-md shadow-sm text-sm font-medium text-stone-700 bg-white hover:bg-stone-50"
              >
                <FiDownload className="mr-2 h-4 w-4" />
                Export CSV
              </button>
              <DashboardButton variant="outline" size="md" />
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <FiUsers className="h-8 w-8 text-brand-500" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-stone-500">Total Responses</p>
                  <p className="text-2xl font-semibold text-stone-900">{analytics.totalResponses}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <FiCheckCircle className="h-8 w-8 text-green-500" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-stone-500">Completion Rate</p>
                  <p className="text-2xl font-semibold text-stone-900">{analytics.completionRate.toFixed(1)}%</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <FiClock className="h-8 w-8 text-yellow-500" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-stone-500">Avg. Completion Time</p>
                  <p className="text-2xl font-semibold text-stone-900">
                    {Math.floor(analytics.averageCompletionTime / 60)}m {analytics.averageCompletionTime % 60}s
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <FiBarChart className="h-8 w-8 text-purple-500" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-stone-500">Questions</p>
                  <p className="text-2xl font-semibold text-stone-900">{analytics.survey.questions.length}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Response Trend */}
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-lg font-semibold text-stone-900 mb-4 flex items-center">
              <FiTrendingUp className="mr-2 h-5 w-5" />
              Response Trend
            </h2>
            <div className="h-64">
              <Line
                data={responseTrendData}
                options={getChartOptions<'line'>('Daily Response Count')}
              />
            </div>
          </div>

          {/* Question Analytics */}
          <div className="space-y-8">
            <h2 className="text-lg font-semibold text-stone-900">Question Breakdown</h2>
            
            {analytics.questionAnalytics.map((question, index) => (
              <div key={question.questionId} className="bg-white rounded-lg shadow p-6">
                <h3 className="text-md font-semibold text-stone-900 mb-4">
                  Q{index + 1}: {question.question}
                </h3>
                
                {/* Chart based on question type */}
                {(question.type === 'multiple_choice' || question.type === 'single_choice') && (
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="h-64">
                      <Bar
                        data={questionChartData[question.questionId] as ChartData<'bar'>}
                        options={getChartOptions<'bar'>('Response Distribution')}
                      />
                    </div>
                    <div className="h-64">
                      <Pie
                        data={questionChartData[question.questionId] as ChartData<'pie'>}
                        options={getChartOptions<'pie'>('Response Percentage')}
                      />
                    </div>
                  </div>
                )}
                
                {(question.type === 'rating_5' || question.type === 'rating_10') && (
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="h-64">
                      <Bar
                        data={questionChartData[question.questionId] as ChartData<'bar'>}
                        options={getChartOptions<'bar'>('Rating Distribution')}
                      />
                    </div>
                    <div className="flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-stone-500 text-sm">Average Rating</p>
                        <p className="text-5xl font-bold text-brand-600">
                          {question.averageRating?.toFixed(1) ?? '0'}
                        </p>
                        <p className="text-stone-500 text-sm">
                          out of {question.type === 'rating_5' ? '5' : '10'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {question.type === 'yes_no' && (
                  <div className="h-64 max-w-md mx-auto">
                    <Pie
                      data={questionChartData[question.questionId] as ChartData<'pie'>}
                      options={getChartOptions<'pie'>('Yes/No Distribution')}
                    />
                  </div>
                )}
                
                {(question.type === 'text' || question.type === 'textarea') && (
                  <div className="bg-stone-50 rounded p-4">
                    <p className="text-stone-600">
                      {Object.keys(question.responses).length} text responses collected
                    </p>
                    <p className="text-sm text-stone-500 mt-2">
                      Text responses are included in the CSV export
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default SurveyAnalytics;