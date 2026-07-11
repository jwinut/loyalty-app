import React from 'react';
import { SurveyQuestion } from '../../types/survey';
import { useTranslation } from 'react-i18next';
import { cn } from '../ui/cn';

// Survey answer can be string, number, boolean, array of strings, or null
type SurveyAnswer = string | number | boolean | string[] | null;

interface QuestionRendererProps {
  question: SurveyQuestion;
  answer: SurveyAnswer;
  onAnswerChange: (questionId: string, answer: SurveyAnswer) => void;
  error?: string;
}

// Shared full-width, >=44px touch target for a single radio/checkbox option
// row — the label wraps the input so the whole row is tappable, not just the
// small control itself.
function optionRowClasses(isSelected: boolean): string {
  return cn(
    'flex min-h-11 w-full cursor-pointer items-center rounded-lg border p-3 transition-colors',
    isSelected ? 'border-brand-600 bg-brand-50' : 'border-hairline hover:border-hairline-strong'
  );
}

const QuestionRenderer: React.FC<QuestionRendererProps> = ({
  question,
  answer,
  onAnswerChange,
  error
}) => {
  const { t } = useTranslation();

  const handleAnswerChange = (value: SurveyAnswer) => {
    onAnswerChange(question.id, value);
  };

  const renderQuestion = () => {
    switch (question.type) {
      case 'single_choice':
        return (
          <div className="space-y-3">
            {question.options?.map((option) => {
              // Convert both to strings for comparison to handle type mismatches
              const isChecked = String(answer) === String(option.value);
              return (
                <label key={option.id} className={optionRowClasses(isChecked)}>
                  <input
                    type="radio"
                    name={`question_${question.id}`}
                    value={String(option.value)}
                    checked={isChecked}
                    onChange={(e) => handleAnswerChange(e.target.value)}
                    className="mr-3 h-4 w-4 border-hairline-strong text-brand-600 focus:ring-2 focus:ring-brand-600"
                  />
                  <span className={`text-ink select-none ${isChecked ? 'font-semibold text-brand-700' : ''}`}>{String(option.text)}</span>
                </label>
              );
            })}
          </div>
        );

      case 'multiple_choice':
        return (
          <div className="space-y-3">
            {question.options?.map((option) => {
              const isChecked = Array.isArray(answer) && answer.includes(String(option.value));
              return (
                <label key={option.id} className={optionRowClasses(isChecked)}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      const currentAnswers = Array.isArray(answer) ? answer : [];
                      if (e.target.checked) {
                        handleAnswerChange([...currentAnswers, String(option.value)]);
                      } else {
                        handleAnswerChange(currentAnswers.filter(a => a !== String(option.value)));
                      }
                    }}
                    className="mr-3 h-4 w-4 rounded border-hairline-strong text-brand-600 focus:ring-2 focus:ring-brand-600"
                  />
                  <span className={`text-ink select-none ${isChecked ? 'font-semibold text-brand-700' : ''}`}>{String(option.text)}</span>
                </label>
              );
            })}
          </div>
        );

      case 'text':
        return (
          <input
            type="text"
            value={typeof answer === 'string' || typeof answer === 'number' ? String(answer) : ''}
            onChange={(e) => handleAnswerChange(e.target.value)}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            placeholder={t('surveys.enterAnswer', 'Enter your answer...')}
          />
        );

      case 'textarea':
        return (
          <textarea
            value={typeof answer === 'string' || typeof answer === 'number' ? String(answer) : ''}
            onChange={(e) => handleAnswerChange(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            placeholder={t('surveys.enterAnswer', 'Enter your answer...')}
          />
        );

      case 'rating_5':
        return (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-stone-500">1</span>
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                type="button"
                onClick={() => handleAnswerChange(rating)}
                className={`w-10 h-10 rounded-full border-2 font-semibold transition-colors ${
                  Number(answer) === rating
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white text-stone-700 border-stone-300 hover:border-brand-300'
                }`}
              >
                {rating}
              </button>
            ))}
            <span className="text-sm text-stone-500">5</span>
          </div>
        );

      case 'rating_10':
        return (
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rating) => (
              <button
                key={rating}
                type="button"
                onClick={() => handleAnswerChange(rating)}
                className={`w-12 h-10 rounded border-2 font-semibold transition-colors ${
                  Number(answer) === rating
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white text-stone-700 border-stone-300 hover:border-brand-300'
                }`}
              >
                {rating}
              </button>
            ))}
          </div>
        );

      case 'yes_no':
        return (
          <div className="space-y-3">
            <label className={optionRowClasses(String(answer) === 'yes')}>
              <input
                type="radio"
                name={`question_${question.id}`}
                value="yes"
                checked={String(answer) === 'yes'}
                onChange={(e) => handleAnswerChange(e.target.value)}
                className="mr-2 h-4 w-4 border-hairline-strong text-brand-600 focus:ring-2 focus:ring-brand-600"
              />
              <span className={`text-ink select-none ${String(answer) === 'yes' ? 'font-semibold text-brand-700' : ''}`}>{t('common.yes', 'Yes')}</span>
            </label>
            <label className={optionRowClasses(String(answer) === 'no')}>
              <input
                type="radio"
                name={`question_${question.id}`}
                value="no"
                checked={String(answer) === 'no'}
                onChange={(e) => handleAnswerChange(e.target.value)}
                className="mr-2 h-4 w-4 border-hairline-strong text-brand-600 focus:ring-2 focus:ring-brand-600"
              />
              <span className={`text-ink select-none ${String(answer) === 'no' ? 'font-semibold text-brand-700' : ''}`}>{t('common.no', 'No')}</span>
            </label>
          </div>
        );

      default:
        return (
          <div className="text-red-500">
            {t('surveys.unknownQuestionType', 'Unknown question type')}: {question.type}
          </div>
        );
    }
  };

  return (
    <div className="mb-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-stone-900 mb-2">
          {question.text}
          {question.required && <span className="text-red-500 ml-1">*</span>}
        </h3>
        {question.description && (
          <p className="text-sm text-stone-600 mb-3">{question.description}</p>
        )}
      </div>

      {renderQuestion()}

      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

export default QuestionRenderer;