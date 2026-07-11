import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FiAlertTriangle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { Coupon, CreateCouponRequest, CouponType, CouponStatus } from '../../types/coupon';
import { couponService } from '../../services/couponService';
import { loyaltyService } from '../../services/loyaltyService';
import CouponAssignmentsModal from '../../components/admin/CouponAssignmentsModal';
import { formatDateToDDMMYYYY } from '../../utils/dateFormatter';
import { logger } from '../../utils/logger';
import AppShell from '../../components/layout/AppShell';
import { PageHeader, Table, type TableColumn, Badge, Button, Modal, Input, Select, Textarea, FormField } from '../../components/ui';

interface CouponUser {
  id: string;
  email: string;
  firstName: string;
  lastName?: string;
  membershipId?: string | null;
}

type CouponStatusTone = 'success' | 'warning' | 'error';

const STATUS_BADGE_TONE: Record<string, CouponStatusTone> = {
  active: 'success',
  paused: 'warning',
};

function getCouponStatusTone(status: string): CouponStatusTone {
  return STATUS_BADGE_TONE[status] ?? 'error';
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB'
  }).format(amount);
}

const EMPTY_NEW_COUPON: CreateCouponRequest = {
  code: '',
  name: '',
  description: '',
  type: 'percentage',
  value: 0,
  minimumSpend: 0,
  maximumDiscount: 0,
  usageLimit: 100,
  usageLimitPerUser: 1,
  validFrom: new Date().toISOString().split('T')[0],
  validUntil: '',
  termsAndConditions: ''
};

function matchesUserSearch(user: CouponUser, searchTerm: string): boolean {
  if (!searchTerm) {return true;}
  const searchLower = searchTerm.toLowerCase();
  const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.toLowerCase();
  const email = (user.email ?? '').toLowerCase();
  const membershipId = (user.membershipId ?? '').toLowerCase();
  return fullName.includes(searchLower) || email.includes(searchLower) || membershipId.includes(searchLower);
}

const CouponManagement: React.FC = () => {
  const { t } = useTranslation();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAssignmentsModal, setShowAssignmentsModal] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [users, setUsers] = useState<CouponUser[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [createModalError, setCreateModalError] = useState<string | null>(null);

  // Create coupon form state
  const [newCoupon, setNewCoupon] = useState<CreateCouponRequest>(EMPTY_NEW_COUPON);

  const loadCoupons = async (pageNum: number = 1) => {
    try {
      setLoading(true);
      setError(null);

      // Get all non-expired coupons - let backend handle the filtering
      // We need to make multiple calls to get different statuses since API doesn't support "NOT expired"
      const [activeResponse, pausedResponse, draftResponse] = await Promise.all([
        couponService.getAdminCoupons(1, 1000, { status: 'active' }),
        couponService.getAdminCoupons(1, 1000, { status: 'paused' }),
        couponService.getAdminCoupons(1, 1000, { status: 'draft' })
      ]);

      // Combine all non-expired coupons
      const allCoupons = [
        ...activeResponse.coupons,
        ...pausedResponse.coupons,
        ...draftResponse.coupons
      ];

      // Implement client-side pagination for the filtered results
      const itemsPerPage = 10;
      const startIndex = (pageNum - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      const paginatedCoupons = allCoupons.slice(startIndex, endIndex);
      const calculatedTotalPages = Math.ceil(allCoupons.length / itemsPerPage);

      setCoupons(paginatedCoupons);
      setTotalPages(calculatedTotalPages);
      setPage(pageNum);
    } catch (err: unknown) {
      logger.error('Error loading coupons:', err);
      const errorMessage = err instanceof Error && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      setError(errorMessage ?? 'Failed to load coupons');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      // Use the loyalty service instead of direct fetch to avoid hardcoded URLs
      const response = await loyaltyService.getAllUsersLoyaltyStatus(100, 0);
      const usersData = response.users || [];

      // Transform the loyalty service response to our User interface
      const transformedUsers = usersData.map((user: { user_id: string; email: string; first_name: string | null; last_name: string | null; phone: string | null; membership_id?: string | null }) => ({
        id: user.user_id,
        email: user.email,
        firstName: user.first_name ?? '',
        lastName: user.last_name ?? undefined,
        membershipId: user.membership_id ?? undefined
      }));
      setUsers(transformedUsers);
    } catch (err) {
      logger.error('Error loading users:', err);
    }
  };

  useEffect(() => {
    loadCoupons();
    loadUsers();
  }, []);

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setCreateModalError(null); // Clear any previous errors

      // Convert date strings to datetime format for backend validation
      const couponData = {
        ...newCoupon,
        validFrom: newCoupon.validFrom ? new Date(newCoupon.validFrom + 'T00:00:00.000Z').toISOString() : undefined,
        validUntil: newCoupon.validUntil ? new Date(newCoupon.validUntil + 'T23:59:59.999Z').toISOString() : undefined
      };

      await couponService.createCoupon(couponData);
      setShowCreateModal(false);
      setCreateModalError(null); // Clear error on success
      setNewCoupon(EMPTY_NEW_COUPON);
      await loadCoupons();
    } catch (err: unknown) {
      // Show error in modal instead of main page
      const errorMessage = err instanceof Error && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      setCreateModalError(errorMessage ?? 'Failed to create coupon');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignCoupons = async () => {
    if (!selectedCoupon || selectedUsers.length === 0) {return;}

    try {
      setLoading(true);
      setError(null);

      const response = await couponService.assignCouponToUsers({
        couponId: selectedCoupon.id,
        userIds: selectedUsers,
        assignedReason: 'Admin assignment'
      });

      // Verify response indicates success before showing success message
      if (!response || response.success === false) {
        const errorMsg = response?.message || 'Failed to assign coupons';
        setError(errorMsg);
        toast.error(errorMsg);
        return;
      }

      // Show success message
      const assignedCount = response.assignedCount ?? selectedUsers.length;
      toast.success(`Successfully assigned coupon "${selectedCoupon.name}" to ${assignedCount} user(s)`);

      setShowAssignModal(false);
      setSelectedUsers([]);
      setSelectedCoupon(null);
      setUserSearchTerm('');

      // Refresh the coupons list to update counts
      await loadCoupons();
    } catch (err: unknown) {
      logger.error('Assignment error:', err);
      // Extract error message - handle both AxiosError and plain Error
      let errorMessage = 'Failed to assign coupons';
      if (err instanceof Error) {
        errorMessage = err.message;
      }
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleCouponStatus = async (coupon: Coupon) => {
    try {
      const newStatus = coupon.status === 'active' ? 'paused' : 'active';
      await couponService.updateCouponStatus(coupon.id, newStatus as CouponStatus);
      await loadCoupons();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      setError(errorMessage ?? 'Failed to update coupon status');
    }
  };

  const handleDeleteCoupon = (coupon: Coupon) => {
    setSelectedCoupon(coupon);
    setDeleteConfirmText('');
    setShowDeleteModal(true);
  };

  const confirmDeleteCoupon = async () => {
    const deleteKeyword = t('admin.coupons.deleteKeyword');
    if (!selectedCoupon || deleteConfirmText !== deleteKeyword) {
      return;
    }

    try {
      setLoading(true);
      await couponService.deleteCoupon(selectedCoupon.id);

      // Close modal and reset state
      setShowDeleteModal(false);
      setSelectedCoupon(null);
      setDeleteConfirmText('');

      // Reload coupons and clear any existing errors
      await loadCoupons();
      setError(null);

    } catch (err: unknown) {
      logger.error('Error deleting coupon:', err);

      // Handle authentication errors specifically
      const httpError = err instanceof Error && 'response' in err ? err as { response?: { status?: number; data?: { message?: string } } } : null;
      if (httpError?.response?.status === 401) {
        setError('Your session has expired. Please refresh the page and log in again.');
      } else if (httpError?.response?.status === 403) {
        setError('You do not have permission to delete coupons. Admin access required.');
      } else if (httpError?.response?.status === 404) {
        // Handle case where coupon was already deleted
        setError(`Coupon "${selectedCoupon.name}" has already been deleted. Refreshing the list...`);
        // Auto-refresh the list to remove stale entries
        setTimeout(() => {
          loadCoupons();
          setError(null);
        }, 2000);
      } else {
        setError(httpError?.response?.data?.message ?? `Failed to delete coupon "${selectedCoupon.name}"`);
      }
    } finally {
      setLoading(false);
    }
  };

  const couponTypeAndValue = (coupon: Coupon) =>
    coupon.type === 'percentage'
      ? `${coupon.value}% off`
      : coupon.type === 'fixed_amount'
      ? formatCurrency(coupon.value ?? 0)
      : t(`coupons.types.${coupon.type}`);

  const statusLabel = (status: string) =>
    status === 'active' ? t('admin.coupons.active') : status === 'paused' ? t('admin.coupons.paused') : t(`admin.coupons.${status}`);

  const columns: TableColumn<Coupon>[] = [
    {
      key: 'coupon',
      header: t('admin.coupons.title_field'),
      cell: (coupon) => (
        <div>
          <div className="text-body font-semibold text-ink">{coupon.name}</div>
          <div className="text-caption text-ink-muted">{coupon.code} - {coupon.description}</div>
        </div>
      ),
    },
    {
      key: 'typeValue',
      header: t('admin.coupons.couponTypeAndValue'),
      cell: (coupon) => (
        <div>
          <div className="text-ink">{couponTypeAndValue(coupon)}</div>
          {(coupon.minimumSpend ?? 0) > 0 && (
            <div className="text-caption text-ink-muted">
              {t('admin.coupons.min')}: {formatCurrency(coupon.minimumSpend ?? 0)}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'usage',
      header: t('admin.coupons.usage'),
      cell: (coupon) => (
        <div>
          <div className="text-ink">{coupon.usedCount || 0} / {coupon.usageLimit}</div>
          <div className="text-caption text-ink-muted">{t('admin.coupons.maxPerUser', { count: coupon.usageLimitPerUser })}</div>
        </div>
      ),
    },
    {
      key: 'validity',
      header: t('admin.coupons.validity'),
      cell: (coupon) => (
        <div>
          <div className="text-ink">{formatDateToDDMMYYYY(coupon.validFrom)}</div>
          <div className="text-caption text-ink-muted">
            {t('admin.coupons.to')} {coupon.validUntil ? formatDateToDDMMYYYY(coupon.validUntil) : t('common.noEndDate')}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: t('admin.coupons.status'),
      cell: (coupon) => <Badge tone={getCouponStatusTone(coupon.status)}>{statusLabel(coupon.status)}</Badge>,
    },
    {
      key: 'actions',
      header: t('admin.coupons.actions'),
      cell: (coupon) => (
        <div className="flex flex-col sm:flex-row sm:gap-3 gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="justify-start px-0 text-brand-700"
            onClick={() => {
              setSelectedCoupon(coupon);
              setShowAssignModal(true);
            }}
          >
            {t('admin.coupons.assign')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="justify-start px-0 text-info-700"
            onClick={() => {
              setSelectedCoupon(coupon);
              setShowAssignmentsModal(true);
            }}
          >
            {t('admin.coupons.viewAssignments')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`justify-start px-0 ${coupon.status === 'active' ? 'text-warning-700' : 'text-success-700'}`}
            onClick={() => handleToggleCouponStatus(coupon)}
          >
            {coupon.status === 'active' ? t('admin.coupons.pause') : t('admin.coupons.activate')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="justify-start px-0 text-error-700"
            onClick={() => handleDeleteCoupon(coupon)}
            title={t('admin.coupons.deleteTooltip')}
          >
            {t('admin.coupons.remove')}
          </Button>
        </div>
      ),
    },
  ];

  const filteredUsers = users.filter((user) => matchesUserSearch(user, userSearchTerm));

  return (
    <AppShell variant="admin" title={t('admin.coupons.title')}>
      <PageHeader
        density="admin"
        title={t('admin.coupons.title')}
        subtitle={t('admin.coupons.subtitle')}
        actions={
          <Button
            onClick={() => {
              setShowCreateModal(true);
              setCreateModalError(null);
            }}
          >
            {t('admin.coupons.createCoupon')}
          </Button>
        }
      />

      {error && (
        <div className="rounded-lg border border-error-600 bg-error-50 p-4 mb-6">
          <div className="flex gap-3">
            <FiAlertTriangle className="h-5 w-5 text-error-700 flex-shrink-0" aria-hidden="true" />
            <div>
              <h3 className="text-caption font-semibold text-error-700">Error</h3>
              <p className="text-caption text-error-700 mt-1">{error}</p>
              <Button variant="ghost" size="sm" className="px-0 mt-2 underline text-error-700" onClick={() => setError(null)}>
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Coupons Table */}
      <Table
        columns={columns}
        rows={coupons}
        rowKey={(coupon) => coupon.id}
        loading={loading && coupons.length === 0}
        aria-label={t('admin.coupons.title')}
        empty={
          <div className="text-ink-muted">
            <p className="text-body font-semibold">{t('admin.coupons.noCoupons')}</p>
            <p className="text-caption mt-1">{t('admin.coupons.noCouponsDescription')}</p>
          </div>
        }
        mobileCard={(coupon) => (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <p className="text-body font-semibold text-ink">{coupon.name}</p>
              <Badge tone={getCouponStatusTone(coupon.status)} size="sm">{statusLabel(coupon.status)}</Badge>
            </div>
            <p className="text-caption text-ink-muted">{coupon.code} - {coupon.description}</p>
            <div className="flex items-center justify-between gap-4">
              <span className="text-fine text-ink-muted">{t('admin.coupons.validity')}</span>
              <span className="text-caption text-ink text-right">
                {formatDateToDDMMYYYY(coupon.validFrom)} {t('admin.coupons.to')} {coupon.validUntil ? formatDateToDDMMYYYY(coupon.validUntil) : t('common.noEndDate')}
              </span>
            </div>
            {(coupon.minimumSpend ?? 0) > 0 && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-fine text-ink-muted">{t('admin.coupons.min')}</span>
                <span className="text-caption text-ink text-right">{formatCurrency(coupon.minimumSpend ?? 0)}</span>
              </div>
            )}
            <div className="flex flex-wrap gap-3 pt-1">
              <Button
                variant="ghost"
                size="sm"
                className="px-0 text-brand-700"
                onClick={() => {
                  setSelectedCoupon(coupon);
                  setShowAssignModal(true);
                }}
              >
                {t('admin.coupons.assign')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="px-0 text-info-700"
                onClick={() => {
                  setSelectedCoupon(coupon);
                  setShowAssignmentsModal(true);
                }}
              >
                {t('admin.coupons.viewAssignments')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={`px-0 ${coupon.status === 'active' ? 'text-warning-700' : 'text-success-700'}`}
                onClick={() => handleToggleCouponStatus(coupon)}
              >
                {coupon.status === 'active' ? t('admin.coupons.pause') : t('admin.coupons.activate')}
              </Button>
              <Button variant="ghost" size="sm" className="px-0 text-error-700" onClick={() => handleDeleteCoupon(coupon)}>
                {t('admin.coupons.remove')}
              </Button>
            </div>
          </div>
        )}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-caption text-ink-muted">
            {t('admin.pagination.page')} {page} {t('admin.pagination.of')} {totalPages}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => loadCoupons(page - 1)} disabled={page <= 1}>
              {t('common.previous')}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => loadCoupons(page + 1)} disabled={page >= totalPages}>
              {t('common.next')}
            </Button>
          </div>
        </div>
      )}

      {/* Create Coupon Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setCreateModalError(null);
        }}
        title={t('admin.coupons.createNewCoupon')}
        size="lg"
      >
        {createModalError && (
          <div className="rounded-lg border border-error-600 bg-error-50 p-4 mb-4">
            <div className="flex gap-3">
              <FiAlertTriangle className="h-5 w-5 text-error-700 flex-shrink-0" aria-hidden="true" />
              <div className="flex-1">
                <h3 className="text-caption font-semibold text-error-700">{t('admin.coupons.errorCreating')}</h3>
                <p className="text-caption text-error-700 mt-1">{createModalError}</p>
                <Button variant="ghost" size="sm" className="px-0 mt-2 underline text-error-700" onClick={() => setCreateModalError(null)}>
                  {t('common.dismiss')}
                </Button>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleCreateCoupon} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label={t('admin.coupons.code')} htmlFor="coupon-code" required>
              <Input
                id="coupon-code"
                type="text"
                required
                value={newCoupon.code}
                onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })}
                placeholder={t('admin.coupons.codePlaceholder')}
              />
            </FormField>

            <FormField label={t('admin.coupons.name')} htmlFor="coupon-name" required>
              <Input
                id="coupon-name"
                type="text"
                required
                value={newCoupon.name}
                onChange={(e) => setNewCoupon({ ...newCoupon, name: e.target.value })}
                placeholder={t('admin.coupons.namePlaceholder')}
              />
            </FormField>
          </div>

          <FormField label={t('admin.coupons.type_field')} htmlFor="coupon-type">
            <Select
              id="coupon-type"
              value={newCoupon.type}
              onChange={(e) => setNewCoupon({ ...newCoupon, type: e.target.value as CouponType })}
            >
              <option value="percentage">{t('coupons.types.percentage')}</option>
              <option value="fixed_amount">{t('coupons.types.fixed_amount')}</option>
              <option value="bogo">{t('coupons.types.bogo')}</option>
              <option value="free_upgrade">{t('coupons.types.free_upgrade')}</option>
              <option value="free_service">{t('coupons.types.free_service')}</option>
            </Select>
          </FormField>

          <FormField label={t('admin.coupons.description_field')} htmlFor="coupon-description">
            <Textarea
              id="coupon-description"
              value={newCoupon.description}
              onChange={(e) => setNewCoupon({ ...newCoupon, description: e.target.value })}
              rows={3}
            />
          </FormField>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label={newCoupon.type === 'percentage' ? t('admin.coupons.percentage') : t('admin.coupons.amount')} htmlFor="coupon-value">
              <Input
                id="coupon-value"
                type="number"
                step={newCoupon.type === 'percentage' ? '1' : '0.01'}
                min="0"
                required
                value={newCoupon.value}
                onChange={(e) => setNewCoupon({ ...newCoupon, value: parseFloat(e.target.value) || 0 })}
              />
            </FormField>

            <FormField label={t('admin.coupons.minimumSpend')} htmlFor="coupon-min-spend">
              <Input
                id="coupon-min-spend"
                type="number"
                step="0.01"
                min="0"
                value={newCoupon.minimumSpend}
                onChange={(e) => setNewCoupon({ ...newCoupon, minimumSpend: parseFloat(e.target.value) || 0 })}
              />
            </FormField>

            <FormField label={t('admin.coupons.maximumDiscount')} htmlFor="coupon-max-discount">
              <Input
                id="coupon-max-discount"
                type="number"
                step="0.01"
                min="0"
                value={newCoupon.maximumDiscount}
                onChange={(e) => setNewCoupon({ ...newCoupon, maximumDiscount: parseFloat(e.target.value) || 0 })}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label={t('admin.coupons.maxTotalUses')} htmlFor="coupon-usage-limit" required>
              <Input
                id="coupon-usage-limit"
                type="number"
                min="1"
                required
                value={newCoupon.usageLimit}
                onChange={(e) => setNewCoupon({ ...newCoupon, usageLimit: parseInt(e.target.value) || 1 })}
              />
            </FormField>

            <FormField label={t('admin.coupons.maxUsesPerUser')} htmlFor="coupon-usage-limit-per-user" required>
              <Input
                id="coupon-usage-limit-per-user"
                type="number"
                min="1"
                required
                value={newCoupon.usageLimitPerUser}
                onChange={(e) => setNewCoupon({ ...newCoupon, usageLimitPerUser: parseInt(e.target.value) || 1 })}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label={t('admin.coupons.validFrom')} htmlFor="coupon-valid-from" required>
              <Input
                id="coupon-valid-from"
                type="date"
                required
                value={newCoupon.validFrom}
                onChange={(e) => setNewCoupon({ ...newCoupon, validFrom: e.target.value })}
              />
            </FormField>

            <FormField label={t('admin.coupons.validUntil')} htmlFor="coupon-valid-until" required>
              <Input
                id="coupon-valid-until"
                type="date"
                required
                value={newCoupon.validUntil}
                onChange={(e) => setNewCoupon({ ...newCoupon, validUntil: e.target.value })}
              />
            </FormField>
          </div>

          <FormField label={t('admin.coupons.termsAndConditions')} htmlFor="coupon-terms">
            <Textarea
              id="coupon-terms"
              value={newCoupon.termsAndConditions}
              onChange={(e) => setNewCoupon({ ...newCoupon, termsAndConditions: e.target.value })}
              rows={3}
            />
          </FormField>

          <p className="text-caption text-ink-muted">{t('admin.coupons.activeImmediately')}</p>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowCreateModal(false);
                setCreateModalError(null);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={loading}>
              {loading ? t('admin.coupons.creating') : t('admin.coupons.createCoupon')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Assign Coupon Modal */}
      <Modal
        open={showAssignModal && Boolean(selectedCoupon)}
        onClose={() => {
          setShowAssignModal(false);
          setUserSearchTerm('');
        }}
        title={t('admin.coupons.assignCoupon')}
      >
        {selectedCoupon && (
          <>
            <div className="mb-4 p-3 rounded-lg bg-surface-sunken">
              <div className="font-semibold text-ink">{selectedCoupon.name}</div>
              <div className="text-caption text-ink-muted">{selectedCoupon.code} - {selectedCoupon.description}</div>
            </div>

            <FormField label={t('admin.coupons.searchUsers')} htmlFor="assign-user-search">
              <Input
                id="assign-user-search"
                type="text"
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
                placeholder={t('admin.coupons.searchPlaceholder')}
              />
            </FormField>

            <div className="space-y-2 max-h-60 overflow-y-auto mt-4">
              {filteredUsers.map((user) => (
                <label key={user.id || user.email} className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-sunken cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedUsers.includes(user.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedUsers([...selectedUsers, user.id]);
                      } else {
                        setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                      }
                    }}
                    className="h-4 w-4 rounded border-hairline-strong text-brand-600 focus:ring-brand-600"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-ink">{user.firstName ?? ''} {user.lastName ?? ''}</div>
                      {user.membershipId && <Badge tone="brand" size="sm">ID: {user.membershipId}</Badge>}
                    </div>
                    <div className="text-caption text-ink-muted">{user.email ?? 'No email'}</div>
                    {!user.membershipId && (
                      <div className="text-fine text-ink-faint">{t('admin.coupons.noMembershipId')}</div>
                    )}
                  </div>
                </label>
              ))}
              {filteredUsers.length === 0 && userSearchTerm && (
                <div className="text-center py-4 text-ink-muted">
                  <div className="text-caption">{t('admin.coupons.noUsersFound', { searchTerm: userSearchTerm })}</div>
                  <div className="text-fine mt-1">{t('admin.coupons.searchHint')}</div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-hairline">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowAssignModal(false);
                  setUserSearchTerm('');
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button onClick={handleAssignCoupons} disabled={loading || selectedUsers.length === 0} loading={loading}>
                {loading ? t('admin.coupons.assigning') : t('admin.coupons.assignToUsers', { count: selectedUsers.length })}
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={showDeleteModal && Boolean(selectedCoupon)}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedCoupon(null);
          setDeleteConfirmText('');
        }}
        title={<span className="text-error-700">{t('admin.coupons.deleteCoupon')}</span>}
        size="sm"
      >
        {selectedCoupon && (
          <>
            <div className="mb-4 p-3 rounded-lg border border-error-600 bg-error-50">
              <div className="flex items-center gap-2 mb-2">
                <FiAlertTriangle className="h-4 w-4 text-error-700" aria-hidden="true" />
                <span className="font-semibold text-error-700">{t('admin.coupons.deleteWarning')}</span>
              </div>
              <div className="text-caption text-error-700">
                <p className="mb-2">{t('admin.coupons.deleteConfirmText')}:</p>
                <p className="font-semibold">&quot;{selectedCoupon.name}&quot; ({selectedCoupon.code})</p>
              </div>
            </div>

            <div className="mb-4 p-3 rounded-lg bg-surface-sunken">
              <p className="text-caption text-ink mb-2">{t('admin.coupons.deleteAffects')}:</p>
              <ul className="text-caption text-ink-muted space-y-1">
                <li>• {t('admin.coupons.existingRedemptions', { count: selectedCoupon.usedCount || 0 })}</li>
                <li>• {t('admin.coupons.assignedUsers')}</li>
                <li>• {t('admin.coupons.analyticsHistory')}</li>
              </ul>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="delete-confirm-text" className="text-caption font-semibold text-ink">
                {t('admin.coupons.typeToConfirm')} <span className="font-bold text-error-600">{t('admin.coupons.deleteKeyword')}</span> {t('admin.coupons.toConfirm')}
              </label>
              <Input
                id="delete-confirm-text"
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={t('admin.coupons.deletePlaceholder')}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedCoupon(null);
                  setDeleteConfirmText('');
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDeleteCoupon}
                disabled={loading || deleteConfirmText !== t('admin.coupons.deleteKeyword')}
                loading={loading}
              >
                {loading ? t('admin.coupons.deleting') : t('admin.coupons.deleteCoupon')}
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* Coupon Assignments Modal */}
      {showAssignmentsModal && selectedCoupon && (
        <CouponAssignmentsModal
          coupon={selectedCoupon}
          isOpen={true}
          onClose={() => {
            setShowAssignmentsModal(false);
            setSelectedCoupon(null);
          }}
        />
      )}
    </AppShell>
  );
};

export default CouponManagement;
