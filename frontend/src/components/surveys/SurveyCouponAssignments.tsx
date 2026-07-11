import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FiPlus, FiEdit, FiTrash2, FiGift, FiUsers } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { logger } from '../../utils/logger';
import {
  SurveyCouponDetails,
  AssignCouponToSurveyRequest,
  UpdateSurveyCouponAssignmentRequest
} from '../../types/survey';
import { Coupon } from '../../types/coupon';
import { surveyService } from '../../services/surveyService';
import { couponService } from '../../services/couponService';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { FormField } from '../ui/FormField';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { Skeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import { Table, type TableColumn } from '../ui/Table';

interface SurveyCouponAssignmentsProps {
  surveyId: string;
  surveyTitle: string;
  surveyStatus: string;
}

interface AssignCouponModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAssign: (data: AssignCouponToSurveyRequest) => void;
  surveyId: string;
  coupons: Coupon[];
  existingAssignments: SurveyCouponDetails[];
}

interface EditAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (data: UpdateSurveyCouponAssignmentRequest) => void;
  assignment: SurveyCouponDetails | null;
}

const ASSIGN_COUPON_FORM_ID = 'assign-coupon-form';
const EDIT_ASSIGNMENT_FORM_ID = 'edit-assignment-form';

const AssignCouponModal: React.FC<AssignCouponModalProps> = ({
  isOpen,
  onClose,
  onAssign,
  surveyId,
  coupons,
  existingAssignments
}) => {
  const { t } = useTranslation();
  const [selectedCouponId, setSelectedCouponId] = useState('');
  // Note: Coupons are always awarded on survey completion
  const [maxAwards, setMaxAwards] = useState<number | undefined>();
  const [customExpiryDays, setCustomExpiryDays] = useState<number | undefined>();
  const [assignedReason, setAssignedReason] = useState('Survey completion reward');

  const assignedCouponIds = new Set(existingAssignments.map(a => a.coupon_id));
  const availableCoupons = coupons.filter(c =>
    c.status === 'active' && !assignedCouponIds.has(c.id)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCouponId) {
      toast.error(t('surveys.admin.couponAssignment.selectCoupon'));
      return;
    }

    onAssign({
      survey_id: surveyId,
      coupon_id: selectedCouponId,
      max_awards: maxAwards,
      custom_expiry_days: customExpiryDays,
      assigned_reason: assignedReason
    });

    // Reset form
    setSelectedCouponId('');
    setMaxAwards(undefined);
    setCustomExpiryDays(undefined);
    setAssignedReason('Survey completion reward');
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={t('surveys.admin.couponAssignment.assignCoupon')}
      size="md"
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form={ASSIGN_COUPON_FORM_ID} variant="primary" disabled={!selectedCouponId}>
            {t('surveys.admin.couponAssignment.assign')}
          </Button>
        </div>
      }
    >
      <form id={ASSIGN_COUPON_FORM_ID} onSubmit={handleSubmit} className="space-y-4">
        {/* Coupon Selection */}
        <FormField label={`${t('coupons.coupon')} *`} htmlFor="assign-coupon-select">
          <Select
            value={selectedCouponId}
            onChange={(e) => setSelectedCouponId(e.target.value)}
            required
          >
            <option value="">{t('surveys.admin.couponAssignment.selectCoupon')}</option>
            {availableCoupons.map(coupon => (
              <option key={coupon.id} value={coupon.id}>
                {coupon.code} - {coupon.name}
                {coupon.type === 'percentage' && ` (${coupon.value}% off)`}
                {coupon.type === 'fixed_amount' && ` (${coupon.currency} ${coupon.value} off)`}
              </option>
            ))}
          </Select>
        </FormField>
        {availableCoupons.length === 0 && (
          <p className="-mt-2 text-caption text-ink-muted">
            {t('surveys.admin.couponAssignment.noAvailableCoupons')}
          </p>
        )}

        {/* Award Condition - Always completion */}
        <div className="rounded-lg border border-brand-200 bg-brand-50 p-4">
          <h4 className="mb-2 flex items-center gap-2 text-caption font-semibold text-brand-900">
            <FiGift className="h-4 w-4" aria-hidden="true" />
            {t('surveys.admin.couponAssignment.rewardCondition')}
          </h4>
          <p className="text-caption text-brand-700">
            {t('surveys.admin.couponAssignment.alwaysOnCompletion')}
          </p>
        </div>

        {/* Max Awards */}
        <FormField
          label={t('surveys.admin.couponAssignment.maxAwards')}
          htmlFor="assign-max-awards"
          hint={t('surveys.admin.couponAssignment.maxAwardsHelp')}
        >
          <Input
            type="number"
            min="1"
            value={maxAwards ?? ''}
            onChange={(e) => setMaxAwards(e.target.value ? parseInt(e.target.value) : undefined)}
            placeholder={t('surveys.admin.couponAssignment.unlimited')}
          />
        </FormField>

        {/* Custom Expiry */}
        <FormField
          label={t('surveys.admin.couponAssignment.customExpiry')}
          htmlFor="assign-custom-expiry"
          hint={t('surveys.admin.couponAssignment.customExpiryHelp')}
        >
          <Input
            type="number"
            min="1"
            value={customExpiryDays ?? ''}
            onChange={(e) => setCustomExpiryDays(e.target.value ? parseInt(e.target.value) : undefined)}
            placeholder={t('surveys.admin.couponAssignment.useCouponExpiry')}
          />
        </FormField>

        {/* Assigned Reason */}
        <FormField label={t('surveys.admin.couponAssignment.reason')} htmlFor="assign-reason">
          <Textarea
            value={assignedReason}
            onChange={(e) => setAssignedReason(e.target.value)}
            rows={2}
            placeholder={t('surveys.admin.couponAssignment.reasonPlaceholder')}
          />
        </FormField>
      </form>
    </Modal>
  );
};

const EditAssignmentModal: React.FC<EditAssignmentModalProps> = ({
  isOpen,
  onClose,
  onUpdate,
  assignment
}) => {
  const { t } = useTranslation();
  // Note: Coupons are always awarded on survey completion
  const [maxAwards, setMaxAwards] = useState<number | undefined>();
  const [customExpiryDays, setCustomExpiryDays] = useState<number | undefined>();
  const [assignedReason, setAssignedReason] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (assignment) {
      setMaxAwards(assignment.max_awards);
      setCustomExpiryDays(assignment.custom_expiry_days);
      setAssignedReason(assignment.assigned_reason);
      setIsActive(assignment.is_active);
    }
  }, [assignment]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate({
      max_awards: maxAwards,
      custom_expiry_days: customExpiryDays,
      assigned_reason: assignedReason,
      is_active: isActive
    });
  };

  if (!assignment) {
    return null;
  }

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={t('surveys.couponAssignment.editAssignment')}
      size="md"
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form={EDIT_ASSIGNMENT_FORM_ID} variant="primary">
            {t('common.save')}
          </Button>
        </div>
      }
    >
      <p className="mb-4 text-caption text-ink-muted">
        {t('coupons.coupon')}: <strong className="text-ink">{assignment.coupon_code} - {assignment.coupon_name}</strong>
      </p>

      <form id={EDIT_ASSIGNMENT_FORM_ID} onSubmit={handleSubmit} className="space-y-4">
        {/* Active Status */}
        <div className="flex items-center">
          <input
            id="edit-assignment-active"
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded border-hairline-strong text-brand-600 focus:ring-brand-600"
          />
          <label htmlFor="edit-assignment-active" className="ml-2 text-caption text-ink">
            {t('common.active')}
          </label>
        </div>

        {/* Award Condition - Always completion */}
        <div className="rounded-lg border border-brand-200 bg-brand-50 p-4">
          <h4 className="mb-2 flex items-center gap-2 text-caption font-semibold text-brand-900">
            <FiGift className="h-4 w-4" aria-hidden="true" />
            {t('surveys.admin.couponAssignment.rewardCondition')}
          </h4>
          <p className="text-caption text-brand-700">
            {t('surveys.admin.couponAssignment.alwaysOnCompletion')}
          </p>
        </div>

        {/* Max Awards */}
        <FormField label={t('surveys.admin.couponAssignment.maxAwards')} htmlFor="edit-max-awards">
          <Input
            type="number"
            min="1"
            value={maxAwards ?? ''}
            onChange={(e) => setMaxAwards(e.target.value ? parseInt(e.target.value) : undefined)}
            placeholder={t('surveys.admin.couponAssignment.unlimited')}
          />
        </FormField>

        {/* Custom Expiry */}
        <FormField label={t('surveys.admin.couponAssignment.customExpiry')} htmlFor="edit-custom-expiry">
          <Input
            type="number"
            min="1"
            value={customExpiryDays ?? ''}
            onChange={(e) => setCustomExpiryDays(e.target.value ? parseInt(e.target.value) : undefined)}
            placeholder={t('surveys.admin.couponAssignment.useCouponExpiry')}
          />
        </FormField>

        {/* Assigned Reason */}
        <FormField label={t('surveys.admin.couponAssignment.reason')} htmlFor="edit-reason">
          <Textarea
            value={assignedReason}
            onChange={(e) => setAssignedReason(e.target.value)}
            rows={2}
          />
        </FormField>
      </form>
    </Modal>
  );
};

function couponValueLabel(
  t: (key: string) => string,
  assignment: SurveyCouponDetails
): string {
  switch (assignment.coupon_type) {
    case 'percentage':
      return `${assignment.coupon_value}% off`;
    case 'fixed_amount':
      return `${assignment.coupon_currency} ${assignment.coupon_value} off`;
    case 'free_upgrade':
      return t('coupons.freeUpgrade');
    case 'free_service':
      return t('coupons.freeService');
    default:
      return '';
  }
}

const SurveyCouponAssignments: React.FC<SurveyCouponAssignmentsProps> = ({
  surveyId,
  surveyTitle: _surveyTitle,
  surveyStatus
}) => {
  const { t } = useTranslation();
  const [assignments, setAssignments] = useState<SurveyCouponDetails[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<SurveyCouponDetails | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [assignmentToRemove, setAssignmentToRemove] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surveyId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [assignmentsResponse, couponsResponse] = await Promise.all([
        surveyService.getSurveyCouponAssignments(surveyId),
        couponService.listCoupons(1, 100, { status: 'active' })
      ]);

      setAssignments(assignmentsResponse.assignments);
      setCoupons(couponsResponse.coupons);
    } catch (error) {
      logger.error('Error loading survey coupon assignments:', error);
      toast.error(t('surveys.admin.couponAssignment.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleAssignCoupon = async (data: AssignCouponToSurveyRequest) => {
    try {
      await surveyService.assignCouponToSurvey(data);
      toast.success(t('surveys.admin.couponAssignment.assignSuccess'));
      setShowAssignModal(false);
      loadData();
    } catch (error) {
      logger.error('Error assigning coupon:', error);
      const errorMessage = error instanceof Error && 'response' in error
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      toast.error(errorMessage ?? t('surveys.admin.couponAssignment.assignError'));
    }
  };

  const handleUpdateAssignment = async (data: UpdateSurveyCouponAssignmentRequest) => {
    if (!editingAssignment) {return;}

    try {
      await surveyService.updateSurveyCouponAssignment(
        editingAssignment.survey_id,
        editingAssignment.coupon_id,
        data
      );
      toast.success(t('surveys.admin.couponAssignment.updateSuccess'));
      setShowEditModal(false);
      setEditingAssignment(null);
      loadData();
    } catch (error) {
      logger.error('Error updating assignment:', error);
      const errorMessage = error instanceof Error && 'response' in error
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      toast.error(errorMessage ?? t('surveys.admin.couponAssignment.updateError'));
    }
  };

  const handleRemoveAssignment = async () => {
    if (!assignmentToRemove) {return;}

    setShowRemoveConfirm(false);

    try {
      const assignment = assignments.find(a => a.coupon_id === assignmentToRemove);
      if (!assignment) {return;}

      await surveyService.removeCouponFromSurvey(assignment.survey_id, assignment.coupon_id);
      toast.success(t('surveys.admin.couponAssignment.removeSuccess'));
      loadData();
    } catch (error) {
      logger.error('Error removing assignment:', error);
      const errorMessage = error instanceof Error && 'response' in error
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      toast.error(errorMessage ?? t('surveys.admin.couponAssignment.removeError'));
    } finally {
      setAssignmentToRemove(null);
    }
  };

  const openEditModal = (assignment: SurveyCouponDetails) => {
    setEditingAssignment(assignment);
    setShowEditModal(true);
  };

  if (loading) {
    return (
      <Card>
        <Skeleton className="mb-4 h-6 w-1/4" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </div>
      </Card>
    );
  }

  const columns: TableColumn<SurveyCouponDetails>[] = [
    {
      key: 'coupon',
      header: t('coupons.coupon'),
      cell: (assignment) => (
        <div>
          <p className="font-semibold text-ink">{assignment.coupon_code} - {assignment.coupon_name}</p>
          {assignment.assigned_reason && (
            <p className="mt-1 text-fine text-ink-muted">
              {t('surveys.admin.couponAssignment.reason')}: {assignment.assigned_reason}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'value',
      header: t('surveys.admin.couponAssignment.valueColumn'),
      cell: (assignment) => (
        <div className="flex items-center gap-2">
          <FiGift className="h-4 w-4 flex-shrink-0 text-brand-600" aria-hidden="true" />
          <span>{couponValueLabel(t, assignment)}</span>
        </div>
      ),
    },
    {
      key: 'awarded',
      header: t('surveys.admin.couponAssignment.awarded'),
      cell: (assignment) => (
        <div className="flex items-center gap-2">
          <FiUsers className="h-4 w-4 flex-shrink-0 text-success-600" aria-hidden="true" />
          <span>
            {t('surveys.admin.couponAssignment.awarded')}: {assignment.awarded_count}
            {assignment.max_awards ? ` / ${assignment.max_awards}` : ''}
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      header: t('surveys.stats.status'),
      cell: (assignment) => (
        <Badge tone={assignment.is_active ? 'success' : 'neutral'}>
          {assignment.is_active ? t('common.active') : t('common.inactive')}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (assignment) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openEditModal(assignment)}
            title={t('common.edit')}
            aria-label={t('common.edit')}
          >
            <FiEdit className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setAssignmentToRemove(assignment.coupon_id);
              setShowRemoveConfirm(true);
            }}
            title={t('common.remove')}
            aria-label={t('common.remove')}
          >
            <FiTrash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Card padding="none">
      <div className="border-b border-hairline p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-title text-ink">
              {t('surveys.admin.couponAssignment.title')}
            </h3>
            <p className="mt-1 text-caption text-ink-muted">
              {t('surveys.admin.couponAssignment.description')}
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => setShowAssignModal(true)}
            disabled={surveyStatus !== 'active'}
          >
            <FiPlus className="h-4 w-4" aria-hidden="true" />
            {t('surveys.admin.couponAssignment.assignCoupon')}
          </Button>
        </div>
      </div>

      <div className="p-6">
        <Table
          columns={columns}
          rows={assignments}
          rowKey={(assignment) => assignment.assignment_id}
          empty={
            <EmptyState
              icon={FiGift}
              title={t('surveys.admin.couponAssignment.noAssignments')}
              description={t('surveys.admin.couponAssignment.noAssignmentsHelp')}
            />
          }
          mobileCard={(assignment) => (
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-body font-semibold text-ink">
                  {assignment.coupon_code} - {assignment.coupon_name}
                </p>
                <Badge tone={assignment.is_active ? 'success' : 'neutral'}>
                  {assignment.is_active ? t('common.active') : t('common.inactive')}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-caption text-ink">
                <FiGift className="h-4 w-4 flex-shrink-0 text-brand-600" aria-hidden="true" />
                <span>{couponValueLabel(t, assignment)}</span>
              </div>
              <div className="flex items-center gap-2 text-caption text-ink-muted">
                <FiUsers className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                <span>
                  {t('surveys.admin.couponAssignment.awarded')}: {assignment.awarded_count}
                  {assignment.max_awards ? ` / ${assignment.max_awards}` : ''}
                </span>
              </div>
              {assignment.assigned_reason && (
                <p className="text-fine text-ink-muted">
                  {t('surveys.admin.couponAssignment.reason')}: {assignment.assigned_reason}
                </p>
              )}
              <div className="flex justify-end gap-1 pt-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openEditModal(assignment)}
                  title={t('common.edit')}
                  aria-label={t('common.edit')}
                >
                  <FiEdit className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setAssignmentToRemove(assignment.coupon_id);
                    setShowRemoveConfirm(true);
                  }}
                  title={t('common.remove')}
                  aria-label={t('common.remove')}
                >
                  <FiTrash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}
        />
      </div>

      <AssignCouponModal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        onAssign={handleAssignCoupon}
        surveyId={surveyId}
        coupons={coupons}
        existingAssignments={assignments}
      />

      <EditAssignmentModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingAssignment(null);
        }}
        onUpdate={handleUpdateAssignment}
        assignment={editingAssignment}
      />

      {/* Confirm Remove Dialog */}
      <ConfirmDialog
        isOpen={showRemoveConfirm}
        title={t('surveys.admin.couponAssignment.confirmRemove')}
        message={t('surveys.admin.couponAssignment.confirmRemoveMessage', 'Are you sure you want to remove this coupon assignment? This action cannot be undone.')}
        confirmText={t('common.remove', 'Remove')}
        cancelText={t('common.cancel', 'Cancel')}
        onConfirm={handleRemoveAssignment}
        onCancel={() => {
          setShowRemoveConfirm(false);
          setAssignmentToRemove(null);
        }}
        variant="danger"
      />
    </Card>
  );
};

export default SurveyCouponAssignments;
