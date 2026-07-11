import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { couponService } from '../../services/couponService';
import { Coupon } from '../../types/coupon';
import { formatDateToDDMMYYYY } from '../../utils/dateFormatter';
import { logger } from '../../utils/logger';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { Modal, Table, type TableColumn, Badge, Button, type BadgeTone } from '../ui';

interface CouponAssignment {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  assignedCount: number;
  usedCount: number;
  availableCount: number;
  latestAssignment: Date;
}

interface CouponAssignmentSummary {
  totalUsers: number;
  totalAssigned: number;
  totalUsed: number;
  totalAvailable: number;
}

interface CouponAssignmentsModalProps {
  coupon: Coupon;
  isOpen: boolean;
  onClose: () => void;
}

type AssignmentStatus = { label: string; tone: BadgeTone };

function getAssignmentStatus(assignment: CouponAssignment): AssignmentStatus {
  const { usedCount, availableCount } = assignment;
  if (availableCount > 0 && usedCount > 0) {
    return { label: 'Partially Used', tone: 'warning' };
  }
  if (usedCount > 0) {
    return { label: 'All Used', tone: 'neutral' };
  }
  return { label: 'Available', tone: 'success' };
}

function SummaryStat({ label, value, toneClass }: { label: string; value: number; toneClass: string }) {
  return (
    <div>
      <div className={`text-title font-bold ${toneClass}`}>{value}</div>
      <div className="text-caption text-ink-muted">{label}</div>
    </div>
  );
}

const CouponAssignmentsModal: React.FC<CouponAssignmentsModalProps> = ({
  coupon,
  isOpen,
  onClose
}) => {
  const { t } = useTranslation();
  const [assignments, setAssignments] = useState<CouponAssignment[]>([]);
  const [summary, setSummary] = useState<CouponAssignmentSummary>({
    totalUsers: 0,
    totalAssigned: 0,
    totalUsed: 0,
    totalAvailable: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [userToRemove, setUserToRemove] = useState<CouponAssignment | null>(null);
  const limit = 10;

  // Track mount status so the async handlers below never call setState after
  // the modal has unmounted (e.g. closed mid-request). A late setState into a
  // torn-down React root throws, and because the handlers are wired as
  // fire-and-forget onClick callbacks that throw would surface as an unhandled
  // promise rejection.
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadAssignments = useCallback(async (pageNum: number = 1) => {
    try {
      setLoading(true);
      setError(null);
      const result = await couponService.getCouponAssignments(coupon.id, pageNum, limit);
      if (!isMountedRef.current) {return;}

      setAssignments(result.assignments);
      setSummary(result.summary);
      setPage(result.page);
      setTotalPages(result.totalPages);
      setTotal(result.total);
    } catch (err: unknown) {
      logger.error('Error loading coupon assignments:', err);
      if (!isMountedRef.current) {return;}
      const errorMessage = err instanceof Error && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      setError(errorMessage ?? t('errors.failedToLoadAssignments', 'Failed to load assignments'));
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [coupon.id, limit, t]);

  useEffect(() => {
    loadAssignments(1);
  }, [coupon.id, loadAssignments]);

  const handleRemoveClick = (assignment: CouponAssignment) => {
    setUserToRemove(assignment);
    setShowConfirmation(true);
  };

  const handleConfirmRemove = async () => {
    if (!userToRemove) {return;}

    try {
      setRemovingUserId(userToRemove.userId);
      setShowConfirmation(false);

      await couponService.revokeUserCouponsForCoupon(
        coupon.id,
        userToRemove.userId,
        'Removed by admin from assignment management'
      );

      // Reload assignments to reflect changes
      await loadAssignments(page);

      if (!isMountedRef.current) {return;}
      setUserToRemove(null);
    } catch (err: unknown) {
      logger.error('Error removing user coupons:', err);
      if (!isMountedRef.current) {return;}
      const errorMessage = err instanceof Error && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      setError(errorMessage ?? t('errors.failedToRemoveCoupons', 'Failed to remove user coupons'));
    } finally {
      if (isMountedRef.current) {
        setRemovingUserId(null);
      }
    }
  };

  const handleCancelRemove = () => {
    setShowConfirmation(false);
    setUserToRemove(null);
  };

  const columns: TableColumn<CouponAssignment>[] = [
    { key: 'user', header: 'User', cell: (a) => `${a.firstName} ${a.lastName}` },
    { key: 'email', header: 'Email', cell: (a) => a.email },
    { key: 'assigned', header: 'Assigned', align: 'right', cell: (a) => <span className="font-semibold text-brand-600">{a.assignedCount}</span> },
    { key: 'used', header: 'Used', align: 'right', cell: (a) => <span className="font-semibold text-ink-muted">{a.usedCount}</span> },
    { key: 'available', header: 'Available', align: 'right', cell: (a) => <span className="font-semibold text-warning-700">{a.availableCount}</span> },
    {
      key: 'status',
      header: 'Status',
      cell: (a) => {
        const status = getAssignmentStatus(a);
        return <Badge tone={status.tone}>{status.label}</Badge>;
      },
    },
    { key: 'latestAssignment', header: 'Latest Assignment', cell: (a) => formatDateToDDMMYYYY(a.latestAssignment) },
    {
      key: 'actions',
      header: 'Actions',
      cell: (a) =>
        a.availableCount > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            className="px-0 text-error-700"
            onClick={() => handleRemoveClick(a)}
            disabled={removingUserId === a.userId}
          >
            {removingUserId === a.userId ? 'Removing...' : 'Remove'}
          </Button>
        ) : (
          <span className="text-ink-faint">No coupons</span>
        ),
    },
  ];

  return (
    <>
      <Modal
        open={isOpen}
        onClose={onClose}
        title="Coupon Assignments"
        size="lg"
        footer={
          totalPages > 1 ? (
            <div className="flex items-center justify-between">
              <div className="text-caption text-ink-muted">
                Page {page} of {totalPages} ({total} users)
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => loadAssignments(page - 1)} disabled={page <= 1}>
                  Previous
                </Button>
                <Button variant="secondary" size="sm" onClick={() => loadAssignments(page + 1)} disabled={page >= totalPages}>
                  Next
                </Button>
              </div>
            </div>
          ) : undefined
        }
      >
        <p className="text-caption text-ink-muted -mt-2 mb-4">
          {coupon.name} ({coupon.code})
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
            <span className="ml-2 text-caption text-ink-muted">Loading assignments...</span>
          </div>
        ) : error ? (
          <div className="p-6 text-center">
            <p className="text-caption text-ink-muted">{error}</p>
            <Button className="mt-4" onClick={() => loadAssignments(page)}>
              Try Again
            </Button>
          </div>
        ) : assignments.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-caption text-ink-muted">No users have been assigned this coupon yet.</p>
          </div>
        ) : (
          <>
            {/* Summary */}
            <div data-testid="assignment-summary" className="mb-4 p-4 rounded-lg bg-surface-sunken grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <SummaryStat label="Total Users" value={summary.totalUsers} toneClass="text-brand-600" />
              <SummaryStat label="Total Assigned" value={summary.totalAssigned} toneClass="text-success-700" />
              <SummaryStat label="Used" value={summary.totalUsed} toneClass="text-ink-muted" />
              <SummaryStat label="Available" value={summary.totalAvailable} toneClass="text-warning-700" />
            </div>

            {/* Assignments Table */}
            <Table
              columns={columns}
              rows={assignments}
              rowKey={(a) => a.userId}
              aria-label="Coupon assignments"
              mobileCard={(a) => {
                const status = getAssignmentStatus(a);
                return (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-body font-semibold text-ink">{a.firstName} {a.lastName}</p>
                      <Badge tone={status.tone} size="sm">{status.label}</Badge>
                    </div>
                    <div className="text-caption text-ink-muted">{a.email}</div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-fine text-ink-muted">Latest Assignment</span>
                      <span className="text-caption text-ink text-right">{formatDateToDDMMYYYY(a.latestAssignment)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-fine text-ink-muted">
                        {a.assignedCount} assigned &middot; {a.usedCount} used &middot; {a.availableCount} available
                      </span>
                      {a.availableCount > 0 ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="px-0 text-error-700"
                          onClick={() => handleRemoveClick(a)}
                          disabled={removingUserId === a.userId}
                        >
                          {removingUserId === a.userId ? 'Removing...' : 'Remove'}
                        </Button>
                      ) : (
                        <span className="text-fine text-ink-faint">No coupons</span>
                      )}
                    </div>
                  </div>
                );
              }}
            />
          </>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={showConfirmation && Boolean(userToRemove)}
        title="Confirm Coupon Removal"
        message={userToRemove
          ? `Are you sure you want to remove all available coupons from ${userToRemove.firstName} ${userToRemove.lastName}? This action will revoke ${userToRemove.availableCount} coupon${userToRemove.availableCount > 1 ? 's' : ''} and cannot be undone.`
          : ''}
        confirmText="Remove Coupons"
        cancelText="Cancel"
        onConfirm={handleConfirmRemove}
        onCancel={handleCancelRemove}
        variant="danger"
      />
    </>
  );
};

export default CouponAssignmentsModal;
