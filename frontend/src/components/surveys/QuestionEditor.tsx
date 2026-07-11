import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FiMove, FiPlus, FiStar, FiTrash2, FiX } from 'react-icons/fi';
import { SurveyQuestion, QuestionOption } from '../../types/survey';
import { surveyService } from '../../services/surveyService';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { FormField } from '../ui/FormField';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';

interface QuestionEditorProps {
  question: SurveyQuestion;
  index: number;
  questionNumber: number;
  onUpdate: (updates: Partial<SurveyQuestion>) => void;
  onRemove: () => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  canMove: boolean;
  disabled?: boolean;
}

const QuestionEditor: React.FC<QuestionEditorProps> = ({
  question,
  index,
  questionNumber: _questionNumber,
  onUpdate,
  onRemove,
  onReorder,
  canMove,
  disabled = false
}) => {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const ratingDefaults = question.type === 'rating_10'
    ? { min: 1, max: 10 }
    : { min: 1, max: 5 };

  const [questionText, setQuestionText] = useState(question.text ?? '');
  const [description, setDescription] = useState(question.description ?? '');
  const [options, setOptions] = useState<QuestionOption[]>(question.options ?? []);
  const [minRating, setMinRating] = useState<string>((question.min_rating ?? ratingDefaults.min).toString());
  const [maxRating, setMaxRating] = useState<string>((question.max_rating ?? ratingDefaults.max).toString());
  const [isRequired, setIsRequired] = useState<boolean>(question.required ?? false);

  useEffect(() => {
    const defaults = question.type === 'rating_10'
      ? { min: 1, max: 10 }
      : { min: 1, max: 5 };

    setQuestionText(question.text ?? '');
    setDescription(question.description ?? '');
    setOptions(question.options ?? []);
    setMinRating((question.min_rating ?? defaults.min).toString());
    setMaxRating((question.max_rating ?? defaults.max).toString());
    setIsRequired(question.required ?? false);
  }, [question]);

  const handleQuestionTextChange = (text: string) => {
    setQuestionText(text);
    onUpdate({ text });
  };

  const handleDescriptionChange = (newDescription: string) => {
    setDescription(newDescription);
    onUpdate({ description: newDescription });
  };

  const addOption = () => {
    setOptions(prevOptions => {
      const safeOptions = prevOptions ?? [];
      const newOption: QuestionOption = {
        id: surveyService.generateOptionId(),
        text: t('surveys.admin.questionEditor.newOptionText', { number: safeOptions.length + 1 }),
        value: (safeOptions.length + 1).toString() // Auto-generate sequential numeric value
      };

      const updatedOptions = [...safeOptions, newOption];
      onUpdate({ options: updatedOptions });
      return updatedOptions;
    });
  };

  const updateOption = (optionId: string, value: string) => {
    setOptions(prevOptions => {
      const updatedOptions = (prevOptions ?? []).map((option, index) =>
        option.id === optionId
          ? { ...option, text: value, value: (index + 1).toString() } // Keep value as sequential number
          : option
      );

      onUpdate({ options: updatedOptions });
      return updatedOptions;
    });
  };

  const removeOption = (optionId: string) => {
    setOptions(prevOptions => {
      if (!prevOptions || prevOptions.length <= 2) {return prevOptions;}

      // Re-index values when removing an option
      const filteredOptions = prevOptions
        .filter(option => option.id !== optionId)
        .map((option, index) => ({
          ...option,
          value: (index + 1).toString() // Re-index values sequentially
        }));

      onUpdate({ options: filteredOptions });
      return filteredOptions;
    });
  };

  const handleRequiredToggle = (checked: boolean) => {
    setIsRequired(checked);
    onUpdate({ required: checked });
  };

  const handleMinRatingChange = (value: string) => {
    setMinRating(value);
    const parsed = Number.parseInt(value, 10);

    if (!Number.isNaN(parsed)) {
      onUpdate({ min_rating: parsed });
    }
  };

  const handleMaxRatingChange = (value: string) => {
    setMaxRating(value);
    const parsed = Number.parseInt(value, 10);

    if (!Number.isNaN(parsed)) {
      onUpdate({ max_rating: parsed });
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', index.toString());
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
    if (fromIndex !== index) {
      onReorder(fromIndex, index);
    }
  };

  const getQuestionTypeLabel = (type: string) => {
    switch (type) {
      case 'single_choice': return t('surveys.admin.questionEditor.questionTypes.singleChoice');
      case 'multiple_choice': return t('surveys.admin.questionEditor.questionTypes.multipleChoice');
      case 'text': return t('surveys.admin.questionEditor.questionTypes.text');
      case 'textarea': return t('surveys.admin.questionEditor.questionTypes.textarea');
      case 'rating_5': return t('surveys.admin.questionEditor.questionTypes.rating5');
      case 'rating_10': return t('surveys.admin.questionEditor.questionTypes.rating10');
      case 'yes_no': return t('surveys.admin.questionEditor.questionTypes.yesNo');
      default: return type;
    }
  };

  const parsedMaxRating = Number.parseInt(maxRating, 10);
  const displayMaxRating = Number.isNaN(parsedMaxRating) ? ratingDefaults.max : parsedMaxRating;
  const hasQuestionTextError = !questionText || questionText.trim() === '';
  const minRatingFieldId = `min-rating-${question.id}`;
  const maxRatingFieldId = `max-rating-${question.id}`;
  const requiredToggleId = `required-${question.id}`;

  return (
    <Card
      draggable={canMove}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      data-question-id={question.id}
      className={isDragging ? 'opacity-50' : undefined}
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-2">
          {canMove && (
            <button
              type="button"
              role="presentation"
              className="cursor-move p-1 text-ink-faint hover:text-ink-muted"
            >
              <FiMove className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          <span className="text-caption font-semibold text-ink">
            {t('surveys.admin.questionEditor.questionNumber', { number: question.order })}
          </span>
          <Badge tone="brand">{getQuestionTypeLabel(question.type)}</Badge>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          disabled={disabled}
          aria-label={t('surveys.admin.removeQuestion')}
        >
          <FiTrash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="space-y-4">
        {/* Question Text */}
        <FormField
          label={t('surveys.admin.questionEditor.questionText')}
          htmlFor={`question-text-${question.id}`}
          error={hasQuestionTextError ? t('surveys.admin.questionEditor.fieldRequired') : undefined}
        >
          <Textarea
            value={questionText}
            onChange={(e) => handleQuestionTextChange(e.target.value)}
            disabled={disabled}
            rows={2}
            placeholder={t('surveys.admin.questionEditor.questionTextPlaceholder')}
          />
        </FormField>

        {/* Question Description */}
        <FormField label={t('surveys.admin.questionEditor.description')} htmlFor={`question-description-${question.id}`}>
          <Input
            type="text"
            value={description}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            disabled={disabled}
            placeholder={t('surveys.admin.questionEditor.descriptionPlaceholder')}
          />
        </FormField>

        {/* Options for choice questions */}
        {(question.type === 'single_choice' || question.type === 'multiple_choice') && (
          <div>
            <p className="mb-2 text-caption font-semibold text-ink">
              {t('surveys.admin.questionEditor.answerOptions')}
            </p>
            <div className="space-y-2">
              {options?.map((option, index) => (
                <div key={option.id} className="flex items-center gap-2">
                  <span className="w-6 text-caption font-semibold text-ink-muted">{index + 1}.</span>
                  <Input
                    type="text"
                    className="flex-1"
                    value={option.text}
                    onChange={(e) => updateOption(option.id, e.target.value)}
                    disabled={disabled}
                    placeholder={t('surveys.admin.questionEditor.optionTextPlaceholder')}
                  />
                  {options && options.length > 2 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeOption(option.id)}
                      disabled={disabled}
                      aria-label={t('surveys.admin.questionEditor.removeOption')}
                    >
                      <FiX className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="ghost" onClick={addOption} disabled={disabled}>
                <FiPlus className="h-4 w-4" aria-hidden="true" />
                {t('surveys.admin.questionEditor.addOption')}
              </Button>
            </div>
          </div>
        )}

        {/* Rating range for rating questions */}
        {(question.type === 'rating_5' || question.type === 'rating_10') && (
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('surveys.admin.questionEditor.minRating')} htmlFor={minRatingFieldId}>
              <Input
                type="number"
                value={minRating}
                onChange={(e) => handleMinRatingChange(e.target.value)}
                disabled={disabled}
                min="1"
                max={question.type === 'rating_5' ? 5 : 10}
              />
            </FormField>
            <FormField label={t('surveys.admin.questionEditor.maxRating')} htmlFor={maxRatingFieldId}>
              <Input
                type="number"
                value={maxRating}
                onChange={(e) => handleMaxRatingChange(e.target.value)}
                disabled={disabled}
                min="1"
                max={question.type === 'rating_5' ? 5 : 10}
              />
            </FormField>
          </div>
        )}

        {/* Required toggle */}
        <div className="flex items-center">
          <input
            id={requiredToggleId}
            type="checkbox"
            checked={isRequired}
            onChange={(e) => handleRequiredToggle(e.target.checked)}
            disabled={disabled}
            className="h-4 w-4 rounded border-hairline-strong text-brand-600 focus:ring-brand-600 disabled:opacity-50"
          />
          <label htmlFor={requiredToggleId} className="ml-2 block text-caption text-ink">
            {t('surveys.admin.questionEditor.requiredQuestion')}
          </label>
        </div>

        {/* Preview */}
        <div className="mt-4 rounded-lg bg-surface-sunken p-3">
          <p className="mb-2 text-fine font-semibold text-ink-muted">{t('surveys.admin.questionEditor.preview')}</p>
          <div className="text-caption">
            <p className="mb-1 font-semibold text-ink">
              {questionText || t('surveys.admin.questionEditor.previewPlaceholder')}
              {isRequired && <span className="ml-1 text-error-600">*</span>}
            </p>
            {description && (
              <p className="mb-2 text-fine text-ink-muted">{description}</p>
            )}

            {question.type === 'single_choice' && (
              <div className="space-y-1">
                {options?.map((option) => (
                  <label key={option.id} className="flex items-center">
                    <input type="radio" name={`preview-${question.id}`} className="mr-2 h-4 w-4 border-hairline-strong text-brand-600 focus:ring-brand-600" />
                    <span className="text-caption">{option.text}</span>
                  </label>
                ))}
              </div>
            )}

            {question.type === 'multiple_choice' && (
              <div className="space-y-1">
                {options?.map((option) => (
                  <label key={option.id} className="flex items-center">
                    <input type="checkbox" className="mr-2 h-4 w-4 rounded border-hairline-strong text-brand-600 focus:ring-brand-600" />
                    <span className="text-caption">{option.text}</span>
                  </label>
                ))}
              </div>
            )}

            {question.type === 'text' && (
              <Input
                type="text"
                disabled
                placeholder={t('surveys.admin.questionEditor.textInputPlaceholder')}
              />
            )}

            {question.type === 'textarea' && (
              <Textarea
                disabled
                rows={3}
                placeholder={t('surveys.admin.questionEditor.longTextInputPlaceholder')}
              />
            )}

            {(question.type === 'rating_5' || question.type === 'rating_10') && (
              <div className="flex items-center gap-1">
                {Array.from({ length: displayMaxRating }, (_, i) => (
                  <FiStar key={i} className="h-4 w-4 text-ink-faint" aria-hidden="true" />
                ))}
              </div>
            )}

            {question.type === 'yes_no' && (
              <div className="space-y-1">
                <label className="flex items-center">
                  <input type="radio" name={`preview-${question.id}`} className="mr-2 h-4 w-4 border-hairline-strong text-brand-600 focus:ring-brand-600" />
                  <span className="text-caption">{t('common.yes')}</span>
                </label>
                <label className="flex items-center">
                  <input type="radio" name={`preview-${question.id}`} className="mr-2 h-4 w-4 border-hairline-strong text-brand-600 focus:ring-brand-600" />
                  <span className="text-caption">{t('common.no')}</span>
                </label>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default QuestionEditor;
