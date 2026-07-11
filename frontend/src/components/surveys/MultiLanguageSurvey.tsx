import React, { useState } from 'react';
import { FiGlobe, FiChevronDown, FiCheck } from 'react-icons/fi';
import { SurveyQuestion } from '../../types/survey';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';

interface MultiLanguageQuestion extends Omit<SurveyQuestion, 'text' | 'description' | 'options'> {
  text: Record<string, string>;
  description?: Record<string, string>;
  options?: Array<{
    id: string;
    text: Record<string, string>;
    value: string | number;
  }>;
}

interface MultiLanguageSurveyProps {
  questions: MultiLanguageQuestion[];
  onLanguageChange: (language: string) => void;
  currentLanguage: string;
  availableLanguages: { code: string; name: string; flag: string }[];
}

const MultiLanguageSurvey: React.FC<MultiLanguageSurveyProps> = ({
  questions,
  onLanguageChange,
  currentLanguage,
  availableLanguages
}) => {
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);

  // Provide a safe fallback in case availableLanguages is empty
  const fallbackLang = { code: 'en', name: 'English', flag: '🇺🇸' };
  const currentLang = availableLanguages.find(lang => lang.code === currentLanguage) ?? availableLanguages[0] ?? fallbackLang;

  const getTranslatedText = (textObj: Record<string, string> | string, fallback = '') => {
    if (typeof textObj === 'string') {return textObj;}
    return textObj[currentLanguage] ?? textObj['en'] ?? fallback;
  };

  return (
    <div className="mx-auto max-w-text" data-testid="multi-language-survey-root">
      {/* Language Selector */}
      <div className="mb-6">
        <div className="relative">
          <Button variant="secondary" onClick={() => setShowLanguageSelector(!showLanguageSelector)}>
            <FiGlobe className="h-4 w-4" aria-hidden="true" />
            <span>{currentLang.flag}</span>
            {currentLang.name}
            <FiChevronDown className="h-4 w-4" aria-hidden="true" />
          </Button>

          {showLanguageSelector && (
            <div className="absolute left-0 top-full z-10 mt-1 w-48 rounded-lg border border-hairline bg-surface-card shadow-pop">
              {availableLanguages.map(lang => {
                const isSelected = lang.code === currentLanguage;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    aria-current={isSelected || undefined}
                    onClick={() => {
                      onLanguageChange(lang.code);
                      setShowLanguageSelector(false);
                    }}
                    className={`flex w-full items-center px-4 py-2 text-left text-caption hover:bg-surface-sunken ${
                      isSelected ? 'bg-brand-50 text-brand-700' : 'text-ink'
                    }`}
                  >
                    <span className="mr-3">{lang.flag}</span>
                    {lang.name}
                    {isSelected && (
                      <FiCheck className="ml-auto h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-6" data-testid="multi-language-survey-questions">
        {questions.map((question, index) => (
          <Card key={question.id}>
            <div className="mb-4">
              <h3 className="text-title text-ink">
                {index + 1}. {getTranslatedText(question.text)}
                {question.required && <span className="ml-1 text-error-600">*</span>}
              </h3>
              {question.description && (
                <p className="mt-1 text-caption text-ink-muted">
                  {getTranslatedText(question.description)}
                </p>
              )}
            </div>

            {/* Question Type Display */}
            <div className="mb-2 text-fine text-ink-muted">
              Question Type: {question.type.replace('_', ' ').toUpperCase()}
            </div>

            {/* Options for choice questions */}
            {(question.type === 'single_choice' || question.type === 'multiple_choice') && question.options && (
              <div className="space-y-2">
                {question.options.map(option => (
                  <div key={option.id} className="flex items-center">
                    <input
                      type={question.type === 'single_choice' ? 'radio' : 'checkbox'}
                      id={`${question.id}_${option.id}`}
                      name={question.id}
                      value={option.value}
                      className="mr-3 h-4 w-4 border-hairline-strong text-brand-600 focus:ring-brand-600"
                      disabled
                    />
                    <label htmlFor={`${question.id}_${option.id}`} className="text-caption text-ink">
                      {getTranslatedText(option.text)}
                    </label>
                  </div>
                ))}
              </div>
            )}

            {/* Text inputs */}
            {question.type === 'text' && (
              <Input
                type="text"
                placeholder={`Your answer in ${currentLang.name}...`}
                disabled
              />
            )}

            {question.type === 'textarea' && (
              <Textarea
                placeholder={`Your answer in ${currentLang.name}...`}
                rows={4}
                disabled
              />
            )}

            {/* Rating scales */}
            {(question.type === 'rating_5' || question.type === 'rating_10') && (
              <div className="flex gap-2">
                {Array.from({ length: question.type === 'rating_5' ? 5 : 10 }, (_, i) => (
                  <Button key={i} variant="secondary" size="icon" disabled>
                    {i + 1}
                  </Button>
                ))}
              </div>
            )}

            {/* Yes/No */}
            {question.type === 'yes_no' && (
              <div className="space-x-4">
                <label className="inline-flex items-center">
                  <input type="radio" name={question.id} value="yes" className="mr-2 h-4 w-4 border-hairline-strong text-brand-600 focus:ring-brand-600" disabled />
                  Yes
                </label>
                <label className="inline-flex items-center">
                  <input type="radio" name={question.id} value="no" className="mr-2 h-4 w-4 border-hairline-strong text-brand-600 focus:ring-brand-600" disabled />
                  No
                </label>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Language Status */}
      <div className="mt-8 rounded-lg bg-brand-50 p-4" data-testid="multi-language-survey-status">
        <div className="flex items-center">
          <FiGlobe className="mr-2 h-5 w-5 text-brand-600" aria-hidden="true" />
          <div>
            <p className="text-caption font-semibold text-brand-900">
              Multi-Language Survey Preview
            </p>
            <p className="mt-1 text-fine text-brand-700">
              Currently showing: {currentLang.name}.
              Survey supports {availableLanguages.length} languages.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultiLanguageSurvey;
