import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { FiPlus, FiEdit, FiTrash2, FiEye, FiBarChart, FiDownload, FiFileText, FiMail, FiGlobe, FiLock, FiGift } from 'react-icons/fi';
import { Survey } from '../../types/survey';
import { surveyService } from '../../services/surveyService';
import SurveyCouponAssignments from '../../components/surveys/SurveyCouponAssignments';
import toast from 'react-hot-toast';
import { formatDateToDDMMYYYY } from '../../utils/dateFormatter';
import { logger } from '../../utils/logger';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import AppShell from '../../components/layout/AppShell';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button, buttonVariants } from '../../components/ui/Button';
import { Badge, type BadgeTone } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Select';
import { Table, type TableColumn } from '../../components/ui/Table';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { Skeleton } from '../../components/ui/Skeleton';

const STATUS_BADGE_TONE: Record<string, BadgeTone> = {
  active: 'success',
  draft: 'neutral',
  paused: 'warning',
  completed: 'brand',
  archived: 'error',
};

const ACCESS_TYPE_BADGE_TONE: Record<string, BadgeTone> = {
  public: 'neutral',
  invite_only: 'gold',
};

const SurveyManagement: React.FC = () => {
  const { t } = useTranslation();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedSurveyForCoupons, setSelectedSurveyForCoupons] = useState<Survey | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [surveyToDelete, setSurveyToDelete] = useState<string | null>(null);

  const loadSurveys = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await surveyService.getSurveys(currentPage, 10, statusFilter);
      setSurveys(response.surveys);
      setTotalPages(response.pagination.totalPages);
    } catch (err) {
      logger.error('Error loading surveys:', err);
      const errorMessage = err instanceof Error && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      setError(errorMessage ?? t('surveys.admin.management.loadError'));
      toast.error(t('surveys.admin.management.loadError'));
    } finally {
      setLoading(false);
    }
  }, [currentPage, statusFilter, t]);

  useEffect(() => {
    loadSurveys();
  }, [currentPage, statusFilter, loadSurveys]);

  const handleDeleteSurvey = async () => {
    if (!surveyToDelete) {return;}

    setShowDeleteConfirm(false);

    try {
      await surveyService.deleteSurvey(surveyToDelete);
      toast.success(t('surveys.admin.success.deleted'));
      loadSurveys();
    } catch (err) {
      logger.error('Error deleting survey:', err);
      const errorMessage = err instanceof Error && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      toast.error(errorMessage ?? t('surveys.admin.management.deleteError'));
    } finally {
      setSurveyToDelete(null);
    }
  };

  const handleExportResponses = async (surveyId: string, surveyTitle: string) => {
    try {
      const blob = await surveyService.exportSurveyResponses(surveyId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `survey-${surveyTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-responses.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success(t('surveys.admin.management.exportSuccess'));
    } catch (err) {
      logger.error('Error exporting responses:', err);
      toast.error(t('surveys.admin.management.exportError'));
    }
  };

  const getAccessTypeLabel = (accessType: string) => {
    switch (accessType) {
      case 'public': return t('surveys.accessType.public');
      case 'invite_only': return t('surveys.accessType.invited');
      default: return t('common.unknown');
    }
  };

  const getAccessTypeIcon = (accessType: string) =>
    accessType === 'invite_only' ? FiLock : FiGlobe;

  const renderActions = (survey: Survey) => (
    <div className="flex items-center gap-1">
      <Link
        to={`/admin/surveys/${survey.id}/preview`}
        className={buttonVariants({ variant: 'ghost', size: 'icon' })}
        aria-label={t('surveys.admin.management.previewTooltip')}
        title={t('surveys.admin.management.previewTooltip')}
      >
        <FiEye className="h-4 w-4" aria-hidden="true" />
      </Link>

      <Link
        to={`/admin/surveys/${survey.id}/analytics`}
        className={buttonVariants({ variant: 'ghost', size: 'icon' })}
        aria-label={t('surveys.admin.management.analyticsTooltip')}
        title={t('surveys.admin.management.analyticsTooltip')}
      >
        <FiBarChart className="h-4 w-4" aria-hidden="true" />
      </Link>

      <Link
        to={`/admin/surveys/${survey.id}/invitations`}
        className={buttonVariants({ variant: 'ghost', size: 'icon' })}
        aria-label={t('surveys.admin.management.invitationsTooltip')}
        title={t('surveys.admin.management.invitationsTooltip')}
      >
        <FiMail className="h-4 w-4" aria-hidden="true" />
      </Link>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => setSelectedSurveyForCoupons(survey)}
        aria-label={t('surveys.admin.couponAssignment.title')}
        title={t('surveys.admin.couponAssignment.title')}
      >
        <FiGift className="h-4 w-4" aria-hidden="true" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => handleExportResponses(survey.id, survey.title)}
        aria-label={t('surveys.admin.management.exportTooltip')}
        title={t('surveys.admin.management.exportTooltip')}
      >
        <FiDownload className="h-4 w-4" aria-hidden="true" />
      </Button>

      <Link
        to={`/admin/surveys/${survey.id}/edit`}
        className={buttonVariants({ variant: 'ghost', size: 'icon' })}
        aria-label={t('surveys.admin.editSurvey')}
        title={t('surveys.admin.editSurvey')}
      >
        <FiEdit className="h-4 w-4" aria-hidden="true" />
      </Link>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => {
          setSurveyToDelete(survey.id);
          setShowDeleteConfirm(true);
        }}
        aria-label={t('surveys.admin.deleteSurvey')}
        title={t('surveys.admin.deleteSurvey')}
      >
        <FiTrash2 className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );

  const columns: TableColumn<Survey>[] = [
    {
      key: 'survey',
      header: t('surveys.admin.management.columns.survey'),
      cell: (survey) => {
        const AccessIcon = getAccessTypeIcon(survey.access_type);
        return (
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-ink">{survey.title || t('surveys.untitled')}</span>
              <Badge tone={STATUS_BADGE_TONE[survey.status] ?? 'neutral'}>
                {t(`surveys.admin.statuses.${survey.status}`, survey.status)}
              </Badge>
              <Badge tone={ACCESS_TYPE_BADGE_TONE[survey.access_type] ?? 'neutral'}>
                <AccessIcon className="h-3 w-3" aria-hidden="true" />
                {getAccessTypeLabel(survey.access_type)}
              </Badge>
            </div>
            {survey.description && (
              <p className="mt-1 truncate text-caption text-ink-muted">{survey.description}</p>
            )}
          </div>
        );
      },
    },
    {
      key: 'questions',
      header: t('surveys.stats.questions'),
      cell: (survey) => t('surveys.admin.templates.questionsCount', { count: survey.questions.length }),
      hideOnMobile: true,
    },
    {
      key: 'updated',
      header: t('surveys.admin.management.columns.updated'),
      cell: (survey) => formatDateToDDMMYYYY(survey.updated_at),
      hideOnMobile: true,
    },
    {
      key: 'actions',
      header: t('surveys.admin.management.columns.actions'),
      align: 'right',
      cell: renderActions,
    },
  ];

  if (loading) {
    return (
      <AppShell variant="admin" title={t('surveys.admin.title')}>
        <Card><Skeleton className="h-64 w-full" /></Card>
      </AppShell>
    );
  }

  return (
    <AppShell variant="admin" title={t('surveys.admin.title')}>
      <PageHeader
        density="admin"
        title={t('surveys.admin.title')}
        subtitle={t('surveys.admin.subtitle')}
        actions={
          <>
            <Link to="/admin/surveys/templates" className={buttonVariants({ variant: 'secondary' })}>
              <FiFileText className="h-4 w-4" aria-hidden="true" />
              {t('surveys.admin.management.templatesLink')}
            </Link>
            <Link to="/admin/surveys/create" className={buttonVariants({ variant: 'primary' })}>
              <FiPlus className="h-4 w-4" aria-hidden="true" />
              {t('surveys.admin.createSurvey')}
            </Link>
          </>
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-48"
          aria-label={t('surveys.admin.management.allStatuses')}
        >
          <option value="">{t('surveys.admin.management.allStatuses')}</option>
          <option value="draft">{t('surveys.admin.statuses.draft')}</option>
          <option value="active">{t('surveys.admin.statuses.active')}</option>
          <option value="paused">{t('surveys.admin.statuses.paused')}</option>
          <option value="completed">{t('surveys.admin.statuses.completed')}</option>
          <option value="archived">{t('surveys.admin.statuses.archived')}</option>
        </Select>
      </div>

      {error && (
        <Card className="mb-4" surface="sunken">
          <p className="text-caption text-error-600">{error}</p>
        </Card>
      )}

      <Table
        columns={columns}
        rows={surveys}
        rowKey={(survey) => survey.id}
        aria-label={t('surveys.admin.title')}
        mobileCard={(survey) => {
          const AccessIcon = getAccessTypeIcon(survey.access_type);
          return (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-ink">{survey.title || t('surveys.untitled')}</p>
                  {survey.description && (
                    <p className="mt-1 text-caption text-ink-muted">{survey.description}</p>
                  )}
                </div>
                <Badge tone={STATUS_BADGE_TONE[survey.status] ?? 'neutral'}>
                  {t(`surveys.admin.statuses.${survey.status}`, survey.status)}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-fine text-ink-muted">
                <span className="inline-flex items-center gap-1">
                  <AccessIcon className="h-3 w-3" aria-hidden="true" />
                  {getAccessTypeLabel(survey.access_type)}
                </span>
                <span>{t('surveys.admin.templates.questionsCount', { count: survey.questions.length })}</span>
                <span>{t('surveys.admin.management.columns.updated')}: {formatDateToDDMMYYYY(survey.updated_at)}</span>
              </div>
              {renderActions(survey)}
            </div>
          );
        }}
        empty={
          <EmptyState
            icon={FiBarChart}
            title={t('surveys.admin.management.emptyTitle')}
            description={t('surveys.admin.management.emptyDescription')}
            action={
              <Link to="/admin/surveys/create" className={buttonVariants({ variant: 'primary' })}>
                <FiPlus className="h-4 w-4" aria-hidden="true" />
                {t('surveys.admin.createSurvey')}
              </Link>
            }
          />
        }
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-caption text-ink-muted">
            {t('common.pageOf', { current: currentPage, total: totalPages })}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              {t('common.previous')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
            >
              {t('common.next')}
            </Button>
          </div>
        </div>
      )}

      {/* Survey Coupon Assignment Modal */}
      <Modal
        open={!!selectedSurveyForCoupons}
        onClose={() => setSelectedSurveyForCoupons(null)}
        size="lg"
        title={`${t('surveys.admin.couponAssignment.title')} - ${selectedSurveyForCoupons?.title ?? t('surveys.untitled')}`}
      >
        {selectedSurveyForCoupons && (
          <SurveyCouponAssignments
            surveyId={selectedSurveyForCoupons.id}
            surveyTitle={selectedSurveyForCoupons.title}
            surveyStatus={selectedSurveyForCoupons.status}
          />
        )}
      </Modal>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={t('surveys.admin.deleteSurvey')}
        message={t('surveys.admin.management.deleteConfirmMessage')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={handleDeleteSurvey}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setSurveyToDelete(null);
        }}
        variant="danger"
      />
    </AppShell>
  );
};

export default SurveyManagement;
