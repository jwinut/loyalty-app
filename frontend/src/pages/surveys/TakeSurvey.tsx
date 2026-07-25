import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { SurveyQuestion } from '../../types/survey';
import { surveyService } from '../../services/surveyService';
import QuestionRenderer from '../../components/surveys/QuestionRenderer';
import SurveyProgress from '../../components/surveys/SurveyProgress';
import AppShell from '../../components/layout/AppShell';
import { useQuery, useMutation } from '@tanstack/react-query';
import clsx from 'clsx';
import { FiCheck } from 'react-icons/fi';
import { logger } from '../../utils/logger';
import { Button, Card } from '../../components/ui';

const TakeSurvey: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch survey using React Query
  const {
    data: survey,
    isLoading: loadingSurvey,
    error: surveyError
  } = useQuery({
    queryKey: ['surveys', id],
    queryFn: () => surveyService.getSurveyById(id as string),
    enabled: !!id,
  });

  // Fetch user's previous response using React Query
  const {
    data: previousResponse
  } = useQuery({
    queryKey: ['surveys', id, 'response'],
    queryFn: () => surveyService.getUserResponse(id as string),
    enabled: !!id,
  });

  // Submit response mutation
  const submitResponseMutation = useMutation({
    mutationFn: (data: { survey_id: string; answers: Record<string, unknown>; is_completed: boolean }) =>
      surveyService.submitResponse(data),
  });

  const loading = loadingSurvey;
  const error = surveyError ? (surveyError instanceof Error ? surveyError.message : 'An error occurred') : null;

  // Reset answers when previous response is loaded (allow fresh start for retakes)
  useEffect(() => {
    if (previousResponse) {
      // Allow retaking surveys - always start fresh for multiple submissions
      setAnswers({});
      setCurrentQuestion(0);
    }
  }, [previousResponse]);

  const saveProgress = useCallback(async (isCompletingNow = false) => {
    if (!survey || !id) {return;}

    try {
      const isComplete = isCompletingNow || surveyService.isResponseComplete(survey, answers);

      await submitResponseMutation.mutateAsync({
        survey_id: id,
        answers,
        is_completed: isComplete
      });

      if (isComplete && isCompletingNow) {
        setCurrentQuestion(survey.questions?.length ?? 0);
      }
    } catch (err) {
      // Error is already handled by tRPC
      logger.error('Error saving progress:', err);
    }
  }, [survey, id, answers, submitResponseMutation]);

  // Auto-save every 30 seconds
  useEffect(() => {
    if (survey && Object.keys(answers).length > 0) {
      const interval = setInterval(() => {
        saveProgress();
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [survey, answers, saveProgress]);

  const handleAnswerChange = (questionId: string, answer: unknown) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));

    // Clear error for this question
    if (errors[questionId]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[questionId];
        return newErrors;
      });
    }
  };

  const validateCurrentQuestion = (): boolean => {
    if (!survey || currentQuestion >= (survey.questions?.length ?? 0)) {return true;}

    const question = survey.questions?.[currentQuestion] as { id: string; required?: boolean } | undefined;
    if (!question) {return true;}

    const answer = answers[question.id];

    if (!surveyService.validateAnswer(question as never, answer)) {
      setErrors({
        [question.id]: question.required
          ? t('surveys.errors.required')
          : t('surveys.errors.invalid')
      });
      return false;
    }

    return true;
  };

  const goToNext = () => {
    if (!validateCurrentQuestion()) {return;}

    if (survey && currentQuestion < (survey.questions?.length ?? 0) - 1) {
      setCurrentQuestion(prev => prev + 1);
      saveProgress();
    } else {
      // Last question, complete survey
      saveProgress(true);
    }
  };

  const goToPrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    }
  };

  const goToQuestion = (index: number) => {
    setCurrentQuestion(index);
  };

  const exitSurvey = () => {
    if (Object.keys(answers).length > 0) {
      saveProgress();
    }
    navigate('/surveys');
  };

  if (loading) {
    return (
      <AppShell variant="guest" title={t('surveys.title', 'Surveys')} hideTabBar>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500" />
          <span className="ml-3 text-stone-600">{t('surveys.loading')}</span>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell variant="guest" title={t('surveys.title', 'Surveys')} hideTabBar>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p>{error}</p>
        </div>
        <div className="mt-4">
          <button
            onClick={() => navigate('/surveys')}
            className="bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            {t('surveys.backToList')}
          </button>
        </div>
      </AppShell>
    );
  }

  if (!survey) {
    return (
      <AppShell variant="guest" title={t('surveys.title', 'Surveys')} hideTabBar>
        <div className="text-center py-12">
          <p className="text-stone-500">{t('surveys.notFound')}</p>
        </div>
      </AppShell>
    );
  }

  const questionCount = survey.questions?.length ?? 0;
  const progress = surveyService.calculateProgress(answers, questionCount);
  const isLastQuestion = currentQuestion >= questionCount - 1;
  const isCompletionPage = currentQuestion >= questionCount;

  return (
    <AppShell variant="guest" title={survey.title} hideTabBar>
      <div className="flex justify-end mb-4">
        <Button variant="ghost" size="sm" onClick={exitSurvey}>
          {t('surveys.exit')}
        </Button>
      </div>

      <div className="max-w-2xl mx-auto">
        {!isCompletionPage ? (
          <>
            <SurveyProgress
              current={currentQuestion + 1}
              total={questionCount}
              progress={progress}
            />

            {survey.questions?.[currentQuestion] && (() => {
              const currentQ = survey.questions[currentQuestion] as SurveyQuestion;
              return (
                <Card className="mb-6">
                  <QuestionRenderer
                    question={currentQ}
                    answer={answers[currentQ.id] as string | number | boolean | string[] | null}
                    onAnswerChange={handleAnswerChange}
                    error={errors[currentQ.id]}
                  />
                </Card>
              );
            })()}

            {/* Navigation — sticky at the bottom on mobile so it stays
                reachable while the question card scrolls underneath it. */}
            <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-4 bg-surface-page/95 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:pb-4">
              <Button
                variant="secondary"
                onClick={goToPrevious}
                disabled={currentQuestion === 0}
              >
                {t('surveys.previous')}
              </Button>

              <div className="flex items-center gap-2">
                {submitResponseMutation.isPending && (
                  <span className="text-caption text-ink-muted">
                    {t('surveys.saving')}
                  </span>
                )}

                <Button
                  onClick={goToNext}
                  disabled={submitResponseMutation.isPending}
                  loading={submitResponseMutation.isPending}
                >
                  {isLastQuestion
                    ? t('surveys.complete')
                    : t('surveys.next')
                  }
                </Button>
              </div>
            </div>

            {/* Question navigation dots */}
            <div className="flex justify-center mt-6 space-x-2">
              {survey.questions?.map((question: SurveyQuestion, index: number) => {
                const q = question as { id: string };
                return (
                  <button
                    key={index}
                    onClick={() => goToQuestion(index)}
                    className={clsx('w-3 h-3 rounded-full transition-colors', {
                      'bg-brand-600': index === currentQuestion,
                      'bg-green-400': index !== currentQuestion && answers[q.id],
                      'bg-stone-300': index !== currentQuestion && !answers[q.id],
                    })}
                  />
                );
              })}
            </div>
          </>
        ) : (
          /* Completion Page */
          <Card padding="lg" className="text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-display text-ink mb-4">
              {t('surveys.completed.title')}
            </h2>
            <p className="text-body text-ink-muted mb-6">
              {t('surveys.completed.message')}
            </p>

            <div className="bg-success-50 rounded-lg p-4 mb-6">
              <p className="flex items-center justify-center gap-1.5 text-caption text-success-700">
                <FiCheck className="h-4 w-4" aria-hidden="true" />
                {t('surveys.completed.saved')}
              </p>
            </div>

            <div className="flex justify-center">
              <Button onClick={() => navigate('/surveys')}>
                {t('surveys.backToList')}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
};

export default TakeSurvey;
