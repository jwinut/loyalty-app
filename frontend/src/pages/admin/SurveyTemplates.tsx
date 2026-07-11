import React, { useState, useEffect, useCallback, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  FiFileText,
  FiStar,
  FiUsers,
  FiHelpCircle,
  FiPlus,
  FiCopy
} from 'react-icons/fi';
import { SurveyQuestion } from '../../types/survey';
import toast from 'react-hot-toast';
import { logger } from '../../utils/logger';
import AppShell from '../../components/layout/AppShell';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { TabNav } from '../../components/ui/TabNav';

interface SurveyTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: string;
  questions: SurveyQuestion[];
  popularity: number;
}

const getPredefinedTemplates = (t: (key: string) => string): SurveyTemplate[] => [
  {
    id: 'satisfaction',
    name: t('surveys.admin.templates.predefinedTemplates.satisfaction.name'),
    description: t('surveys.admin.templates.predefinedTemplates.satisfaction.description'),
    icon: <FiStar className="h-8 w-8" aria-hidden="true" />,
    category: t('surveys.admin.templates.categories.feedback'),
    popularity: 95,
    questions: [
      {
        id: 'q1',
        type: 'rating_5',
        text: t('surveys.admin.templates.predefinedTemplates.satisfaction.questions.q1.text'),
        description: t('surveys.admin.templates.predefinedTemplates.satisfaction.questions.q1.description'),
        required: true,
        order: 1
      },
      {
        id: 'q2',
        type: 'single_choice',
        text: t('surveys.admin.templates.predefinedTemplates.satisfaction.questions.q2.text'),
        required: true,
        options: [
          { id: 'opt1', text: t('surveys.admin.templates.predefinedTemplates.satisfaction.questions.q2.options.veryLikely'), value: 5 },
          { id: 'opt2', text: t('surveys.admin.templates.predefinedTemplates.satisfaction.questions.q2.options.likely'), value: 4 },
          { id: 'opt3', text: t('surveys.admin.templates.predefinedTemplates.satisfaction.questions.q2.options.neutral'), value: 3 },
          { id: 'opt4', text: t('surveys.admin.templates.predefinedTemplates.satisfaction.questions.q2.options.unlikely'), value: 2 },
          { id: 'opt5', text: t('surveys.admin.templates.predefinedTemplates.satisfaction.questions.q2.options.veryUnlikely'), value: 1 }
        ],
        order: 2
      },
      {
        id: 'q3',
        type: 'textarea',
        text: t('surveys.admin.templates.predefinedTemplates.satisfaction.questions.q3.text'),
        required: false,
        order: 3
      },
      {
        id: 'q4',
        type: 'textarea',
        text: t('surveys.admin.templates.predefinedTemplates.satisfaction.questions.q4.text'),
        required: false,
        order: 4
      }
    ]
  },
  {
    id: 'nps',
    name: t('surveys.admin.templates.predefinedTemplates.nps.name'),
    description: t('surveys.admin.templates.predefinedTemplates.nps.description'),
    icon: <FiUsers className="h-8 w-8" aria-hidden="true" />,
    category: t('surveys.admin.templates.categories.loyalty'),
    popularity: 88,
    questions: [
      {
        id: 'q1',
        type: 'rating_10',
        text: t('surveys.admin.templates.predefinedTemplates.nps.questions.q1.text'),
        description: t('surveys.admin.templates.predefinedTemplates.nps.questions.q1.description'),
        required: true,
        order: 1
      },
      {
        id: 'q2',
        type: 'textarea',
        text: t('surveys.admin.templates.predefinedTemplates.nps.questions.q2.text'),
        required: true,
        order: 2
      },
      {
        id: 'q3',
        type: 'single_choice',
        text: t('surveys.admin.templates.predefinedTemplates.nps.questions.q3.text'),
        required: true,
        options: [
          { id: 'opt1', text: t('surveys.admin.templates.predefinedTemplates.nps.questions.q3.options.room'), value: 'room' },
          { id: 'opt2', text: t('surveys.admin.templates.predefinedTemplates.nps.questions.q3.options.staff'), value: 'staff' },
          { id: 'opt3', text: t('surveys.admin.templates.predefinedTemplates.nps.questions.q3.options.location'), value: 'location' },
          { id: 'opt4', text: t('surveys.admin.templates.predefinedTemplates.nps.questions.q3.options.value'), value: 'value' },
          { id: 'opt5', text: t('surveys.admin.templates.predefinedTemplates.nps.questions.q3.options.amenities'), value: 'amenities' },
          { id: 'opt6', text: t('surveys.admin.templates.predefinedTemplates.nps.questions.q3.options.other'), value: 'other' }
        ],
        order: 3
      }
    ]
  },
  {
    id: 'post-stay',
    name: t('surveys.admin.templates.predefinedTemplates.postStay.name'),
    description: t('surveys.admin.templates.predefinedTemplates.postStay.description'),
    icon: <FiFileText className="h-8 w-8" aria-hidden="true" />,
    category: t('surveys.admin.templates.categories.feedback'),
    popularity: 82,
    questions: [
      {
        id: 'q1',
        type: 'rating_5',
        text: t('surveys.admin.templates.predefinedTemplates.postStay.questions.q1.text'),
        required: true,
        order: 1
      },
      {
        id: 'q2',
        type: 'multiple_choice',
        text: t('surveys.admin.templates.predefinedTemplates.postStay.questions.q2.text'),
        required: false,
        options: [
          { id: 'opt1', text: t('surveys.admin.templates.predefinedTemplates.postStay.questions.q2.options.pool'), value: 'pool' },
          { id: 'opt2', text: t('surveys.admin.templates.predefinedTemplates.postStay.questions.q2.options.gym'), value: 'gym' },
          { id: 'opt3', text: t('surveys.admin.templates.predefinedTemplates.postStay.questions.q2.options.spa'), value: 'spa' },
          { id: 'opt4', text: t('surveys.admin.templates.predefinedTemplates.postStay.questions.q2.options.restaurant'), value: 'restaurant' },
          { id: 'opt5', text: t('surveys.admin.templates.predefinedTemplates.postStay.questions.q2.options.bar'), value: 'bar' },
          { id: 'opt6', text: t('surveys.admin.templates.predefinedTemplates.postStay.questions.q2.options.business'), value: 'business' },
          { id: 'opt7', text: t('surveys.admin.templates.predefinedTemplates.postStay.questions.q2.options.concierge'), value: 'concierge' }
        ],
        order: 2
      },
      {
        id: 'q3',
        type: 'yes_no',
        text: t('surveys.admin.templates.predefinedTemplates.postStay.questions.q3.text'),
        required: true,
        order: 3
      },
      {
        id: 'q4',
        type: 'textarea',
        text: t('surveys.admin.templates.predefinedTemplates.postStay.questions.q4.text'),
        required: false,
        order: 4
      },
      {
        id: 'q5',
        type: 'yes_no',
        text: t('surveys.admin.templates.predefinedTemplates.postStay.questions.q5.text'),
        required: true,
        order: 5
      }
    ]
  },
  {
    id: 'event-feedback',
    name: t('surveys.admin.templates.predefinedTemplates.eventFeedback.name'),
    description: t('surveys.admin.templates.predefinedTemplates.eventFeedback.description'),
    icon: <FiUsers className="h-8 w-8" aria-hidden="true" />,
    category: t('surveys.admin.templates.categories.events'),
    popularity: 75,
    questions: [
      {
        id: 'q1',
        type: 'single_choice',
        text: t('surveys.admin.templates.predefinedTemplates.eventFeedback.questions.q1.text'),
        required: true,
        options: [
          { id: 'opt1', text: t('surveys.admin.templates.predefinedTemplates.eventFeedback.questions.q1.options.email'), value: 'email' },
          { id: 'opt2', text: t('surveys.admin.templates.predefinedTemplates.eventFeedback.questions.q1.options.social'), value: 'social' },
          { id: 'opt3', text: t('surveys.admin.templates.predefinedTemplates.eventFeedback.questions.q1.options.website'), value: 'website' },
          { id: 'opt4', text: t('surveys.admin.templates.predefinedTemplates.eventFeedback.questions.q1.options.referral'), value: 'referral' },
          { id: 'opt5', text: t('surveys.admin.templates.predefinedTemplates.eventFeedback.questions.q1.options.other'), value: 'other' }
        ],
        order: 1
      },
      {
        id: 'q2',
        type: 'rating_5',
        text: t('surveys.admin.templates.predefinedTemplates.eventFeedback.questions.q2.text'),
        required: true,
        order: 2
      },
      {
        id: 'q3',
        type: 'rating_5',
        text: t('surveys.admin.templates.predefinedTemplates.eventFeedback.questions.q3.text'),
        required: true,
        order: 3
      },
      {
        id: 'q4',
        type: 'yes_no',
        text: t('surveys.admin.templates.predefinedTemplates.eventFeedback.questions.q4.text'),
        required: true,
        order: 4
      },
      {
        id: 'q5',
        type: 'textarea',
        text: t('surveys.admin.templates.predefinedTemplates.eventFeedback.questions.q5.text'),
        required: false,
        order: 5
      }
    ]
  },
  {
    id: 'quick-pulse',
    name: t('surveys.admin.templates.predefinedTemplates.quickPulse.name'),
    description: t('surveys.admin.templates.predefinedTemplates.quickPulse.description'),
    icon: <FiHelpCircle className="h-8 w-8" aria-hidden="true" />,
    category: t('surveys.admin.templates.categories.quick'),
    popularity: 70,
    questions: [
      {
        id: 'q1',
        type: 'rating_5',
        text: t('surveys.admin.templates.predefinedTemplates.quickPulse.questions.q1.text'),
        required: true,
        order: 1
      },
      {
        id: 'q2',
        type: 'text',
        text: t('surveys.admin.templates.predefinedTemplates.quickPulse.questions.q2.text'),
        description: t('surveys.admin.templates.predefinedTemplates.quickPulse.questions.q2.description'),
        required: false,
        order: 2
      }
    ]
  }
];

function isActivationKey(key: string): boolean {
  return key === 'Enter' || key === ' ';
}

const SurveyTemplates: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<SurveyTemplate[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    try {
      setTemplates(getPredefinedTemplates(t));
    } catch (error) {
      logger.error('Error initializing templates:', error);
      toast.error(t('surveys.admin.templates.loadError'));
    }
  }, [t]);

  const categories = [
    { key: 'all', label: t('surveys.admin.templates.allTemplates') },
    { key: 'Feedback', label: t('surveys.admin.templates.categories.feedback') },
    { key: 'Loyalty', label: t('surveys.admin.templates.categories.loyalty') },
    { key: 'Events', label: t('surveys.admin.templates.categories.events') },
    { key: 'Quick', label: t('surveys.admin.templates.categories.quick') },
    { key: 'Custom', label: t('surveys.admin.templates.categories.custom') }
  ];

  const filteredTemplates = selectedCategory === 'all'
    ? templates
    : templates.filter(template => template.category === t(`surveys.admin.templates.categories.${selectedCategory.toLowerCase()}`));

  const handleUseTemplate = (template: SurveyTemplate) => {
    // Navigate to survey builder with template data
    navigate('/admin/surveys/create', {
      state: {
        template: {
          title: template.name,
          description: template.description,
          questions: template.questions
        }
      }
    });
  };

  const handleStartFromScratch = useCallback(() => navigate('/admin/surveys/create'), [navigate]);

  const handleBlankCardKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!isActivationKey(event.key)) {
      return;
    }
    event.preventDefault();
    handleStartFromScratch();
  };

  return (
    <AppShell variant="admin" title={t('surveys.admin.templates.title')}>
      <PageHeader
        density="admin"
        title={t('surveys.admin.templates.title')}
        subtitle={t('surveys.admin.templates.subtitle')}
        backTo="/admin/surveys"
      />

      {/* Category Filter */}
      <TabNav
        aria-label={t('surveys.admin.templates.allTemplates')}
        items={categories.map((category) => ({ value: category.key, label: category.label }))}
        value={selectedCategory}
        onChange={setSelectedCategory}
        className="mb-6"
      />

      {/* Blank Template Card */}
      <Card
        role="button"
        tabIndex={0}
        onClick={handleStartFromScratch}
        onKeyDown={handleBlankCardKeyDown}
        className="mb-8 cursor-pointer border-dashed text-center hover:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-inset"
        padding="lg"
      >
        <FiPlus className="mx-auto mb-4 h-12 w-12 text-ink-faint" aria-hidden="true" />
        <h3 className="mb-2 text-title text-ink">
          {t('surveys.admin.templates.startFromScratch')}
        </h3>
        <p className="text-caption text-ink-muted">
          {t('surveys.admin.templates.createCustomSurvey')}
        </p>
      </Card>

      {/* Template Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filteredTemplates.map(template => (
          <Card key={template.id} className="flex flex-col">
            <div className="mb-4 flex items-start justify-between">
              <div className="text-brand-600">{template.icon}</div>
              <span className="text-fine text-ink-muted">
                {t('surveys.admin.templates.popularityText', { percent: template.popularity })}
              </span>
            </div>

            <h3 className="mb-2 text-title text-ink">
              {template.name}
            </h3>

            <p className="mb-4 flex-1 text-caption text-ink-muted">
              {template.description}
            </p>

            <div className="mb-4 flex items-center justify-between text-fine text-ink-muted">
              <span>{t('surveys.admin.templates.questionsCount', { count: template.questions.length })}</span>
              <Badge tone="neutral">{template.category}</Badge>
            </div>

            <Button variant="primary" onClick={() => handleUseTemplate(template)}>
              <FiCopy className="h-4 w-4" aria-hidden="true" />
              {t('surveys.admin.templates.useTemplate')}
            </Button>
          </Card>
        ))}
      </div>
    </AppShell>
  );
};

export default SurveyTemplates;
