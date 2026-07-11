import React, { useState, useEffect, useCallback } from 'react';
// Fixed JSX warning - cache refresh trigger
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiPlus, FiSave, FiEye } from 'react-icons/fi';
import { Survey, SurveyQuestion, CreateSurveyRequest, QuestionType, SurveyAccessType, SurveyStatus } from '../../types/survey';
import { surveyService } from '../../services/surveyService';
import QuestionEditor from '../../components/surveys/QuestionEditor';
import SurveyPreview from '../../components/surveys/SurveyPreview';
import toast from 'react-hot-toast';
import { logger } from '../../utils/logger';
import AppShell from '../../components/layout/AppShell';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { FormField } from '../../components/ui/FormField';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';

// Add-question palette: one entry per SurveyQuestion type this builder
// supports. Rendered as a grid of tiles below the question list.
const QUESTION_TYPE_BUTTONS: { type: QuestionType; labelKey: string }[] = [
  { type: 'single_choice', labelKey: 'surveys.admin.questions.questionTypes.singleChoice' },
  { type: 'multiple_choice', labelKey: 'surveys.admin.questions.questionTypes.multipleChoice' },
  { type: 'text', labelKey: 'surveys.admin.questions.questionTypes.text' },
  { type: 'textarea', labelKey: 'surveys.admin.questions.questionTypes.textarea' },
  { type: 'rating_5', labelKey: 'surveys.admin.questions.questionTypes.rating5' },
  { type: 'rating_10', labelKey: 'surveys.admin.questions.questionTypes.rating10' },
  { type: 'yes_no', labelKey: 'surveys.admin.questions.questionTypes.yesNo' },
];

// Validation utility types and functions
interface QuestionValidationError {
  id: string;
  text: string;
  error: string;
  questionNumber: number;
}

interface SurveyValidationResult {
  emptyQuestions: QuestionValidationError[];
  emptyOptions: QuestionValidationError[];
  isValid: boolean;
}

const validateSurveyQuestions = (questions: SurveyQuestion[], t: (key: string) => string): SurveyValidationResult => {
  const emptyQuestions: QuestionValidationError[] = [];
  const emptyOptions: QuestionValidationError[] = [];

  questions.forEach((question, index) => {
    // Validate question text
    const hasValidText = question.text && 
                        typeof question.text === 'string' && 
                        question.text.trim().length > 0;
    
    if (!hasValidText) {
      emptyQuestions.push({
        id: question.id,
        text: question.text ?? '',
        error: t('surveys.admin.validation.questionTextRequired'),
        questionNumber: index + 1
      });
    }

    // Validate options for choice questions
    if (['single_choice', 'multiple_choice'].includes(question.type) && question.options) {
      question.options.forEach((option, optIndex) => {
        const hasValidOptionText = option.text && 
                                  typeof option.text === 'string' && 
                                  option.text.trim().length > 0;
        
        if (!hasValidOptionText) {
          emptyOptions.push({
            id: `${question.id}_${option.id}`,
            text: option.text ?? '',
            error: `Option ${optIndex + 1} text is required`,
            questionNumber: index + 1
          });
        }
      });
    }
  });

  return {
    emptyQuestions,
    emptyOptions,
    isValid: emptyQuestions.length === 0 && emptyOptions.length === 0
  };
};

const handleQuestionValidationErrors = (validationResult: SurveyValidationResult): void => {
  const { emptyQuestions, emptyOptions } = validationResult;
  
  // Clear any previous highlights from both containers and fields
  document.querySelectorAll('.validation-error-highlight').forEach(el => {
    el.classList.remove('validation-error-highlight');
  });
  document.querySelectorAll('.validation-field-error').forEach(el => {
    el.classList.remove('validation-field-error');
  });
  
  if (emptyQuestions.length > 0) {
    const questionNumbers = emptyQuestions.map(q => q.questionNumber).join(', ');
    const message = emptyQuestions.length === 1 
      ? `Question ${questionNumbers} needs your attention`
      : `Questions ${questionNumbers} need your attention`;
    
    toast.error(message, {
      duration: 6000,
      icon: '👆'
    });
    
    // Add red highlighting and focus to all empty questions
    emptyQuestions.forEach((question, index) => {
      const questionContainer = document.querySelector(`[data-question-id="${question.id}"]`);
      const questionTextarea = document.querySelector(`[data-question-id="${question.id}"] textarea`);
      
      // Highlight the question container
      if (questionContainer) {
        questionContainer.classList.add('validation-error-highlight');
      }
      
      // Also highlight the specific textarea field
      if (questionTextarea) {
        questionTextarea.classList.add('validation-field-error');
        
        // Focus and scroll to the first empty question
        if (index === 0) {
          questionTextarea.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center'
          });
          
          // Add a slight delay to ensure smooth scroll completes before focus
          setTimeout(() => {
            (questionTextarea as HTMLElement).focus();
            // Add pulsing effect to the field itself
            questionTextarea.classList.add('animate-pulse');
            setTimeout(() => {
              questionTextarea.classList.remove('animate-pulse');
            }, 2000);
          }, 500);
        }
      }
    });
    
    // Remove highlights after a delay
    setTimeout(() => {
      document.querySelectorAll('.validation-error-highlight').forEach(el => {
        el.classList.remove('validation-error-highlight');
      });
      document.querySelectorAll('.validation-field-error').forEach(el => {
        el.classList.remove('validation-field-error');
      });
    }, 8000);
  }
  
  if (emptyOptions.length > 0) {
    const message = emptyOptions.length === 1
      ? 'Please fill in all option text fields'
      : `Please fill in all option text fields (${emptyOptions.length} empty options found)`;
    
    toast.error(message, {
      duration: 5000,
      icon: '📋'
    });
    
    // Highlight empty option fields
    emptyOptions.forEach((option, index) => {
      const optionInput = document.querySelector(`input[value="${option.text}"]`);
      if (optionInput) {
        optionInput.classList.add('validation-field-error');
        
        // Focus the first empty option if no empty questions
        if (emptyQuestions.length === 0 && index === 0) {
          optionInput.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center'
          });
          setTimeout(() => {
            (optionInput as HTMLElement).focus();
          }, 500);
        }
      }
    });
  }
};

const SurveyBuilder: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;

  const [survey, setSurvey] = useState<Partial<Survey>>({
    title: '',
    description: '',
    questions: [],
    target_segment: {},
    status: 'draft',
    access_type: 'public'
  });
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [validationState, setValidationState] = useState<SurveyValidationResult>({
    emptyQuestions: [],
    emptyOptions: [],
    isValid: true
  });

  const loadSurvey = useCallback(async () => {
    if (!id) {return;}
    
    try {
      setLoading(true);
      const surveyData = await surveyService.getSurveyById(id);
      setSurvey(surveyData);
    } catch (err) {
      logger.error('Error loading survey:', err);
      toast.error(t('surveys.admin.messages.loadError'));
      navigate('/admin/surveys');
    } finally {
      setLoading(false);
    }
  }, [id, t, navigate]);

  useEffect(() => {
    if (isEditing) {
      loadSurvey();
    } else if (location.state?.template) {
      // Load from template
      const template = location.state.template;
      setSurvey({
        title: template.title,
        description: template.description,
        questions: template.questions,
        target_segment: {},
        status: 'draft',
        access_type: 'public'
      });
    }
  }, [id, isEditing, location.state, loadSurvey]);

  // Real-time validation check
  useEffect(() => {
    if (survey.questions && survey.questions.length > 0) {
      const validation = validateSurveyQuestions(survey.questions, t);
      setValidationState(validation);
    } else {
      setValidationState({ emptyQuestions: [], emptyOptions: [], isValid: true });
    }
  }, [survey.questions, t]);

  // Inject validation error highlighting CSS
  useEffect(() => {
    const styleId = 'validation-highlighting-styles';
    
    // Check if styles already exist
    if (document.getElementById(styleId)) {
      return;
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .validation-error-highlight {
        border: 3px solid #ef4444 !important;
        box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2) !important;
        transition: all 0.3s ease-in-out !important;
        animation: validation-pulse 0.5s ease-in-out !important;
      }
      
      @keyframes validation-pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.02); }
        100% { transform: scale(1); }
      }
      
      .validation-error-highlight textarea {
        border-color: #ef4444 !important;
        background-color: #fef2f2 !important;
      }
      
      .validation-field-error {
        border: 2px solid #ef4444 !important;
        background-color: #fef2f2 !important;
        box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1) !important;
        animation: field-error-pulse 0.6s ease-in-out !important;
      }
      
      @keyframes field-error-pulse {
        0% { 
          transform: scale(1);
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
        }
        50% { 
          transform: scale(1.01);
          box-shadow: 0 0 0 5px rgba(239, 68, 68, 0.2);
        }
        100% { 
          transform: scale(1);
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
        }
      }
      
      .validation-field-error:focus {
        border-color: #dc2626 !important;
        box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.3) !important;
        background-color: #ffffff !important;
      }
      
      .validation-error-highlight:hover {
        border-color: #dc2626 !important;
      }
    `;

    document.head.appendChild(style);

    // Cleanup function to remove styles when component unmounts
    return () => {
      const existingStyle = document.getElementById(styleId);
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, []);

  const handleSurveyChange = (field: string, value: unknown) => {
    setSurvey(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addQuestion = (type: QuestionType) => {
    const newQuestion: SurveyQuestion = {
      id: surveyService.generateQuestionId(),
      type,
      text: '',
      required: true,
      order: (survey.questions?.length ?? 0) + 1,
      ...(type === 'multiple_choice' || type === 'single_choice' ? {
        options: [
          { id: surveyService.generateOptionId(), text: t('surveys.admin.questions.defaultOptions.option1'), value: '1' },
          { id: surveyService.generateOptionId(), text: t('surveys.admin.questions.defaultOptions.option2'), value: '2' }
        ]
      } : {}),
      ...(type === 'rating_5' ? { min_rating: 1, max_rating: 5 } : {}),
      ...(type === 'rating_10' ? { min_rating: 1, max_rating: 10 } : {})
    };

    setSurvey(prev => ({
      ...prev,
      questions: [...(prev.questions ?? []), newQuestion]
    }));
  };

  const updateQuestion = (questionId: string, updates: Partial<SurveyQuestion>) => {
    setSurvey(prev => ({
      ...prev,
      questions: prev.questions?.map(q => 
        q.id === questionId ? { ...q, ...updates } : q
      ) ?? []
    }));
  };

  const removeQuestion = (questionId: string) => {
    setSurvey(prev => ({
      ...prev,
      questions: prev.questions?.filter(q => q.id !== questionId) ?? []
    }));
  };

  const reorderQuestions = (fromIndex: number, toIndex: number) => {
    const questions = [...(survey.questions ?? [])];
    const [removed] = questions.splice(fromIndex, 1);
    if (!removed) {return;}
    questions.splice(toIndex, 0, removed);
    
    // Update order numbers
    const reorderedQuestions = questions.map((q, index) => ({
      ...q,
      order: index + 1
    }));

    setSurvey(prev => ({
      ...prev,
      questions: reorderedQuestions
    }));
  };

  const saveSurvey = async (status?: string) => {
    if (!survey.title || !survey.questions?.length) {
      toast.error(t('surveys.admin.validation.titleAndQuestionRequired'));
      return;
    }

    // Enhanced validation using real-time validation state
    if (!validationState.isValid) {
      handleQuestionValidationErrors(validationState);
      return;
    }

    try {
      setSaving(true);
      
      const surveyData: CreateSurveyRequest = {
        title: survey.title,
        description: survey.description,
        questions: survey.questions,
        target_segment: survey.target_segment,
        access_type: survey.access_type ?? 'public' as SurveyAccessType,
        status: (status ?? survey.status) as SurveyStatus
      };

      // Debug logging for development (only in non-production environments)
      if (process.env.NODE_ENV === 'development') {
        logger.info('📊 Survey submission:', {
          title: surveyData.title,
          questionCount: surveyData.questions.length,
          hasThaiContent: /[\u0E00-\u0E7F]/.test(JSON.stringify(surveyData)),
          accessType: surveyData.access_type
        });
      }

      if (isEditing && id) {
        await surveyService.updateSurvey(id, { ...surveyData, status: (status ?? survey.status) as SurveyStatus });
        toast.success(t('surveys.admin.messages.updateSuccess'));
      } else {
        const newSurvey = await surveyService.createSurvey(surveyData);
        toast.success(t('surveys.admin.messages.createSuccess'));
        navigate(`/admin/surveys/${newSurvey.id}/edit`);
      }
    } catch (err) {
      // Enhanced error handling with graceful degradation
      const axiosError = err instanceof Error && 'response' in err
        ? (err as { response?: { status?: number; data?: { message?: string; validationErrors?: unknown[] } }; message?: string })
        : null;

      const isValidationError = axiosError?.response?.status === 400;
      const errorMessage = axiosError?.response?.data?.message ?? (err instanceof Error ? err.message : undefined) ?? 'Failed to save survey';

      if (isValidationError) {
        // Handle backend validation errors gracefully
        const backendErrors = axiosError?.response?.data?.validationErrors ?? [];
        if (backendErrors.length > 0) {
          const fieldErrors = backendErrors.map((error: unknown) => {
            const e = error as { message?: string; field?: string };
            return e.message ?? e.field;
          }).join(', ');
          toast.error(t('surveys.admin.messages.validationFailed', { errors: fieldErrors }), {
            duration: 6000,
            icon: '⚠️'
          });
        } else {
          toast.error(errorMessage, { duration: 5000, icon: '⚠️' });
        }

        // Log only essential info for debugging
        if (process.env.NODE_ENV === 'development') {
          logger.warn('Survey validation failed:', {
            status: axiosError?.response?.status,
            message: errorMessage,
            validationErrors: backendErrors
          });
        }
      } else {
        // Handle network or server errors
        toast.error(t('surveys.admin.messages.networkError', { message: errorMessage }), {
          duration: 7000,
          icon: '🔌'
        });
        
        // Log full error details for non-validation errors
        logger.error('Survey save failed:', err);
      }
    } finally {
      setSaving(false);
    }
  };

  const pageTitle = isEditing
    ? t('surveys.admin.surveyBuilder.pageTitle.edit')
    : t('surveys.admin.surveyBuilder.pageTitle.create');

  if (loading) {
    return (
      <AppShell variant="admin" title={pageTitle}>
        <div className="mx-auto max-w-text space-y-6">
          <Card><Skeleton className="h-40 w-full" /></Card>
          <Card><Skeleton className="h-64 w-full" /></Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell variant="admin" title={pageTitle}>
      <div className="mx-auto max-w-text">
        <PageHeader
          density="admin"
          title={pageTitle}
          backTo="/admin/surveys"
          actions={
            <Button variant="secondary" onClick={() => setShowPreview(!showPreview)}>
              <FiEye className="h-4 w-4" aria-hidden="true" />
              {showPreview ? t('surveys.admin.surveyBuilder.hidePreview') : t('surveys.admin.surveyBuilder.preview')}
            </Button>
          }
        />

        {showPreview ? (
          <SurveyPreview survey={survey as Survey} onClose={() => setShowPreview(false)} />
        ) : (
          <div className="space-y-6">
            {/* Basic Information */}
            <Card>
              <h2 className="mb-4 text-title text-ink">{t('surveys.admin.basicInfo.title')}</h2>

              <div className="space-y-4">
                <FormField label={t('surveys.admin.basicInfo.surveyTitle')} htmlFor="title">
                  <Input
                    type="text"
                    value={survey.title ?? ''}
                    onChange={(e) => handleSurveyChange('title', e.target.value)}
                    placeholder={t('surveys.admin.basicInfo.surveyTitlePlaceholder')}
                  />
                </FormField>

                <FormField label={t('surveys.admin.basicInfo.description')} htmlFor="description">
                  <Textarea
                    rows={3}
                    value={survey.description ?? ''}
                    onChange={(e) => handleSurveyChange('description', e.target.value)}
                    placeholder={t('surveys.admin.basicInfo.descriptionPlaceholder')}
                  />
                </FormField>

                <FormField label={t('surveys.admin.basicInfo.status')} htmlFor="status">
                  <Select
                    value={survey.status ?? 'draft'}
                    onChange={(e) => handleSurveyChange('status', e.target.value)}
                  >
                    <option value="draft">{t('surveys.admin.basicInfo.statusOptions.draft')}</option>
                    <option value="active">{t('surveys.admin.basicInfo.statusOptions.active')}</option>
                    <option value="paused">{t('surveys.admin.basicInfo.statusOptions.paused')}</option>
                    <option value="completed">{t('surveys.admin.basicInfo.statusOptions.completed')}</option>
                    <option value="archived">{t('surveys.admin.basicInfo.statusOptions.archived')}</option>
                  </Select>
                </FormField>

                <FormField
                  label={t('surveys.admin.basicInfo.accessType')}
                  htmlFor="access_type"
                  hint={
                    survey.access_type === 'public'
                      ? t('surveys.admin.basicInfo.accessTypeDescriptions.public')
                      : t('surveys.admin.basicInfo.accessTypeDescriptions.inviteOnly')
                  }
                >
                  <Select
                    value={survey.access_type ?? 'public'}
                    onChange={(e) => handleSurveyChange('access_type', e.target.value)}
                  >
                    <option value="public">{t('surveys.admin.basicInfo.accessTypeOptions.public')}</option>
                    <option value="invite_only">{t('surveys.admin.basicInfo.accessTypeOptions.inviteOnly')}</option>
                  </Select>
                </FormField>
              </div>
            </Card>

            {/* Questions */}
            <Card>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-title text-ink">{t('surveys.admin.questions.title')}</h2>
                <Badge tone="neutral">{t('surveys.admin.questions.count', { count: survey.questions?.length ?? 0 })}</Badge>
              </div>

              <div className="space-y-4">
                {survey.questions?.map((question, index) => (
                  <QuestionEditor
                    key={question.id}
                    question={question}
                    questionNumber={index + 1}
                    index={index}
                    onUpdate={(updates) => updateQuestion(question.id, updates)}
                    onRemove={() => removeQuestion(question.id)}
                    onReorder={reorderQuestions}
                    canMove={(survey.questions?.length ?? 0) > 1}
                  />
                ))}

                {survey.questions?.length === 0 && (
                  <EmptyState title={t('surveys.admin.questions.noQuestions')} />
                )}
              </div>

              {/* Add Question Buttons */}
              <div className="mt-6 border-t border-hairline pt-6">
                <h3 className="mb-3 text-caption font-semibold text-ink">{t('surveys.admin.questions.addQuestion')}</h3>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {QUESTION_TYPE_BUTTONS.map(({ type, labelKey }) => (
                    <Button key={type} variant="secondary" onClick={() => addQuestion(type)}>
                      <FiPlus className="h-4 w-4" aria-hidden="true" />
                      {t(labelKey)}
                    </Button>
                  ))}
                </div>
              </div>
            </Card>

            {/* Save Actions */}
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button variant="ghost" onClick={() => navigate('/admin/surveys')}>
                  {t('surveys.admin.surveyBuilder.cancel')}
                </Button>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Validation Status Indicator */}
                  {survey.questions && survey.questions.length > 0 && (
                    validationState.isValid ? (
                      <Badge tone="success">{t('surveys.admin.validation.readyToSave')}</Badge>
                    ) : (
                      <Badge tone="warning">
                        {validationState.emptyQuestions.length === 1
                          ? t('surveys.admin.validation.needsAttention', { count: validationState.emptyQuestions.length })
                          : t('surveys.admin.validation.needsAttentionPlural', { count: validationState.emptyQuestions.length })
                        }
                      </Badge>
                    )
                  )}

                  <Button variant="secondary" onClick={() => saveSurvey('draft')} disabled={saving}>
                    <FiSave className="h-4 w-4" aria-hidden="true" />
                    {t('surveys.admin.saveDraft')}
                  </Button>

                  <Button variant="primary" onClick={() => saveSurvey('active')} loading={saving}>
                    {isEditing ? t('surveys.admin.updateAndPublish') : t('surveys.admin.createAndPublish')}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default SurveyBuilder;