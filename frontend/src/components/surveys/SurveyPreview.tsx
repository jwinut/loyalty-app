import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FiX, FiArrowLeft, FiArrowRight, FiCheckCircle, FiCheck } from 'react-icons/fi';
import { Survey } from '../../types/survey';
import QuestionRenderer from './QuestionRenderer';
import SurveyProgress from './SurveyProgress';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

// Survey answer can be string, number, boolean, array of strings, or null
type SurveyAnswer = string | number | boolean | string[] | null;

interface SurveyPreviewProps {
  survey: Survey;
  onClose: () => void;
}

const SurveyPreview: React.FC<SurveyPreviewProps> = ({ survey, onClose }) => {
  const { t } = useTranslation();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, SurveyAnswer>>({});

  const handleAnswerChange = (questionId: string, answer: SurveyAnswer) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const goToNext = () => {
    if (currentQuestion < survey.questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
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

  const calculateProgress = () => {
    const answeredQuestions = Object.keys(answers).length;
    return Math.round((answeredQuestions / survey.questions.length) * 100);
  };

  const isLastQuestion = currentQuestion >= survey.questions.length - 1;
  const isCompletionPage = currentQuestion >= survey.questions.length;

  return (
    <Card padding="none" className="overflow-hidden" data-testid="survey-preview-container">
      {/* Preview Header */}
      <div className="border-b border-hairline bg-brand-50 px-6 py-4" data-testid="survey-preview-header">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-title text-ink">Survey Preview</h2>
            <p className="text-caption text-ink-muted">This is how your survey will appear to customers</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label={t('common.close')}>
            <FiX className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Survey Preview Content */}
      <div className="p-6">
        {!isCompletionPage ? (
          <>
            {/* Survey Header */}
            <div className="mb-6 text-center">
              <h1 className="mb-2 text-display text-ink">{survey.title}</h1>
              {survey.description && (
                <p className="text-caption text-ink-muted">{survey.description}</p>
              )}
            </div>

            {/* Progress */}
            <SurveyProgress
              current={currentQuestion + 1}
              total={survey.questions.length}
              progress={calculateProgress()}
            />

            {/* Current Question */}
            <div className="mb-6 min-h-[300px] rounded-lg bg-surface-sunken p-6">
              {survey.questions[currentQuestion] && (
                <QuestionRenderer
                  question={survey.questions[currentQuestion]}
                  answer={answers[survey.questions[currentQuestion].id] ?? null}
                  onAnswerChange={handleAnswerChange}
                  error=""
                />
              )}
            </div>

            {/* Navigation */}
            <div className="mb-4 flex items-center justify-between">
              <Button variant="secondary" onClick={goToPrevious} disabled={currentQuestion === 0}>
                <FiArrowLeft className="h-4 w-4" aria-hidden="true" />
                Previous
              </Button>

              <span className="text-caption text-ink-muted">
                Question {currentQuestion + 1} of {survey.questions.length}
              </span>

              <Button variant="primary" onClick={goToNext}>
                {isLastQuestion ? 'Complete Survey' : 'Next'}
                <FiArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>

            {/* Question Navigation Dots */}
            <div className="flex justify-center gap-2">
              {survey.questions.map((_, index) => {
                const isCurrent = index === currentQuestion;
                const isAnswered = Boolean(answers[survey.questions[index]?.id ?? '']);
                return (
                  <button
                    key={index}
                    type="button"
                    aria-label={`Question ${index + 1}`}
                    aria-current={isCurrent || undefined}
                    data-answered={isAnswered || undefined}
                    onClick={() => goToQuestion(index)}
                    className={`h-3 w-3 rounded-full transition-colors ${
                      isCurrent
                        ? 'bg-brand-600'
                        : isAnswered
                        ? 'bg-success-600'
                        : 'bg-hairline-strong'
                    }`}
                  />
                );
              })}
            </div>
          </>
        ) : (
          /* Completion Page */
          <div className="py-12 text-center">
            <FiCheckCircle className="mx-auto mb-4 h-16 w-16 text-success-600" aria-hidden="true" />
            <h2 className="mb-4 text-display text-ink">
              Survey Completed!
            </h2>
            <p className="mb-6 text-caption text-ink-muted">
              Thank you for taking the time to complete this survey. Your feedback is valuable to us.
            </p>

            <div className="mb-6 rounded-lg border border-success-600/20 bg-success-50 p-4">
              <p className="flex items-center justify-center gap-2 text-caption text-success-700">
                <FiCheck className="h-4 w-4" aria-hidden="true" />
                Your responses have been saved successfully
              </p>
            </div>

            <Button variant="primary">
              Back to Surveys
            </Button>
          </div>
        )}
      </div>

      {/* Preview Footer */}
      <div className="border-t border-hairline bg-surface-sunken px-6 py-3" data-testid="survey-preview-footer">
        <div className="flex items-center justify-between text-caption text-ink-muted">
          <span>Preview Mode - No responses will be saved</span>
          <Button variant="ghost" onClick={onClose}>
            Close Preview
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default SurveyPreview;
