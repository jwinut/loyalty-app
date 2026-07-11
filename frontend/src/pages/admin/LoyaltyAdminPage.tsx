import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FiUsers,
  FiPlus,
  FiMinus,
  FiRefreshCw,
  FiSearch,
  FiDollarSign,
  FiUser
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { formatDateTimeToEuropean } from '../../utils/dateFormatter';
import {
  loyaltyService,
  AdminUserLoyalty,
  PointsTransaction
} from '../../services/loyaltyService';
import { logger } from '../../utils/logger';
import { tierTheme } from '../../utils/tierTheme';
import AppShell from '../../components/layout/AppShell';
import { PageHeader, Card, Table, type TableColumn, Badge, Button, Modal, Input, FormField } from '../../components/ui';

interface PointsAdjustmentModal {
  isOpen: boolean;
  user: AdminUserLoyalty | null;
  type: 'award' | 'deduct';
}

interface SpendingConsoleModal {
  isOpen: boolean;
}

type OAuthBadgeTone = 'success' | 'error' | 'brand';

const OAUTH_BADGE_TONE: Record<string, OAuthBadgeTone> = {
  line: 'success',
  google: 'error',
  facebook: 'brand',
};

function getOAuthBadgeTone(provider: string): OAuthBadgeTone {
  return OAUTH_BADGE_TONE[provider] ?? 'brand';
}

function getUserDisplayName(user: Pick<AdminUserLoyalty, 'first_name' | 'last_name' | 'oauth_provider' | 'email'>): string {
  if (user.first_name && user.last_name) {
    return `${user.first_name} ${user.last_name}`;
  }
  if (user.oauth_provider === 'line' && user.first_name) {
    return user.first_name;
  }
  return user.email;
}

function getUserSecondaryLabel(user: Pick<AdminUserLoyalty, 'first_name' | 'oauth_provider' | 'email'>): string {
  return user.oauth_provider === 'line' && user.first_name ? 'LINE User' : user.email;
}

function TierBadge({ tierName, tierColor }: { tierName: string; tierColor: string }) {
  const theme = tierTheme(tierName, tierColor);
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-caption font-semibold whitespace-nowrap"
      style={{ backgroundColor: theme.tintBg, color: theme.onTint }}
    >
      {tierName}
    </span>
  );
}

function OAuthBadge({ provider }: { provider: string }) {
  return (
    <Badge tone={getOAuthBadgeTone(provider)} size="sm">
      via {provider.toUpperCase()}
    </Badge>
  );
}

export default function LoyaltyAdminPage() {
  const { t } = useTranslation();

  const [users, setUsers] = useState<AdminUserLoyalty[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize] = useState(20);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAction, setIsLoadingAction] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUserLoyalty | null>(null);
  const [userTransactions, setUserTransactions] = useState<PointsTransaction[]>([]);
  const [pointsModal, setPointsModal] = useState<PointsAdjustmentModal>({
    isOpen: false,
    user: null,
    type: 'award'
  });
  const [pointsForm, setPointsForm] = useState({
    points: '',
    nights: '',
    description: '',
    referenceId: ''
  });
  const [spendingModal, setSpendingModal] = useState<SpendingConsoleModal>({
    isOpen: false
  });
  const [spendingForm, setSpendingForm] = useState({
    userId: '',
    spendingAmount: '',
    nightsStayed: '',
    checkinId: '',
    userSearchTerm: '',
    selectedUser: null as AdminUserLoyalty | null
  });
  const [userSearchResults, setUserSearchResults] = useState<AdminUserLoyalty[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, searchTerm]);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const result = await loyaltyService.getAllUsersLoyaltyStatus(
        pageSize,
        currentPage * pageSize,
        searchTerm ?? undefined
      );
      setUsers(result.users);
      setTotalUsers(result.total);
    } catch (error) {
      toast.error(t('admin.loyalty.errors.loadFailed'));
      logger.error('Failed to load users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserTransactions = async (userId: string) => {
    try {
      const result = await loyaltyService.getUserPointsHistoryAdmin(userId, 50, 0);
      setUserTransactions(result.transactions);
    } catch (error) {
      toast.error(t('admin.loyalty.errors.transactionsFailed'));
      logger.error('Failed to load user transactions:', error);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(0);
    loadUsers();
  };

  const openPointsModal = (user: AdminUserLoyalty, type: 'award' | 'deduct') => {
    setPointsModal({ isOpen: true, user, type });
    setPointsForm({ points: '', nights: '', description: '', referenceId: '' });
  };

  const closePointsModal = () => {
    setPointsModal({ isOpen: false, user: null, type: 'award' });
    setPointsForm({ points: '', nights: '', description: '', referenceId: '' });
  };

  const handlePointsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pointsModal.user) {return;}

    // Validate that at least one of points or nights is provided
    const points = pointsForm.points ? parseInt(pointsForm.points) : 0;
    const nights = pointsForm.nights ? parseInt(pointsForm.nights) : 0;

    if (points === 0 && nights === 0) {
      toast.error('Please provide at least points or nights');
      return;
    }

    try {
      setIsLoadingAction(true);

      // Build description with nights information if provided
      let finalDescription = pointsForm.description ?? '';
      if (nights > 0 && !finalDescription.includes('night')) {
        finalDescription = finalDescription
          ? `${finalDescription} (${nights} ${nights === 1 ? 'night' : 'nights'})`
          : `${nights} ${nights === 1 ? 'night' : 'nights'}`;
      }

      if (pointsModal.type === 'award') {
        // If nights are provided, use the spending-with-nights endpoint
        if (nights > 0) {
          // Calculate amount spent (points / 10 = THB)
          const amountSpent = points / 10;
          await loyaltyService.awardSpendingWithNights(
            pointsModal.user.user_id,
            amountSpent,
            nights,
            pointsForm.referenceId ?? `MANUAL-${Date.now()}`,
            finalDescription || `Manual award: ${points} points and ${nights} nights`
          );

          // Build success message
          let successMsg = '';
          if (points > 0 && nights > 0) {
            successMsg = `Awarded ${points} points and ${nights} ${nights === 1 ? 'night' : 'nights'}`;
          } else if (nights > 0) {
            successMsg = `Awarded ${nights} ${nights === 1 ? 'night' : 'nights'}`;
          }
          toast.success(successMsg);
        } else if (points > 0) {
          // Regular points-only award
          await loyaltyService.awardPoints(
            pointsModal.user.user_id,
            points,
            finalDescription || undefined,
            pointsForm.referenceId ?? undefined
          );
          toast.success(t('admin.loyalty.success.pointsAwarded', { points }));
        }
      } else {
        // For deduct: support both points and nights deduction
        if (nights > 0) {
          // Deduct nights (use negative value)
          const amountSpent = -(points / 10); // Negative amount for deduction
          await loyaltyService.awardSpendingWithNights(
            pointsModal.user.user_id,
            amountSpent,
            -nights, // Negative nights for deduction
            pointsForm.referenceId ?? `MANUAL-DEDUCT-${Date.now()}`,
            finalDescription || `${-nights} nights` // Use negative value in description
          );

          // Build success message
          let successMsg = '';
          if (points > 0 && nights > 0) {
            successMsg = `Deducted ${points} points and ${nights} ${nights === 1 ? 'night' : 'nights'}`;
          } else if (nights > 0) {
            successMsg = `Deducted ${nights} ${nights === 1 ? 'night' : 'nights'}`;
          }
          toast.success(successMsg);
        } else if (points > 0) {
          // Regular points-only deduction
          await loyaltyService.deductPoints(
            pointsModal.user.user_id,
            points,
            finalDescription || `Points deducted by admin`
          );
          toast.success(t('admin.loyalty.success.pointsDeducted', { points }));
        }
      }

      closePointsModal();
      loadUsers();
      if (selectedUser?.user_id === pointsModal.user.user_id) {
        loadUserTransactions(pointsModal.user.user_id);
      }
    } catch (error) {
      toast.error(t('admin.loyalty.errors.pointsOperationFailed'));
      logger.error('Points operation failed:', error);
    } finally {
      setIsLoadingAction(false);
    }
  };

  const openSpendingConsole = () => {
    setSpendingModal({ isOpen: true });
    setSpendingForm({
      userId: '',
      spendingAmount: '',
      nightsStayed: '',
      checkinId: '',
      userSearchTerm: '',
      selectedUser: null
    });
    setUserSearchResults([]);
  };

  const closeSpendingConsole = () => {
    setSpendingModal({ isOpen: false });
    setSpendingForm({
      userId: '',
      spendingAmount: '',
      nightsStayed: '',
      checkinId: '',
      userSearchTerm: '',
      selectedUser: null
    });
    setUserSearchResults([]);
  };

  const searchUsersForSpending = async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setUserSearchResults([]);
      return;
    }

    try {
      setIsSearchingUsers(true);
      const result = await loyaltyService.getAllUsersLoyaltyStatus(10, 0, searchTerm);
      setUserSearchResults(result.users);
    } catch (error) {
      logger.error('Failed to search users:', error);
      toast.error('ไม่สามารถค้นหาผู้ใช้ได้');
    } finally {
      setIsSearchingUsers(false);
    }
  };

  const handleUserSearchChange = (value: string) => {
    setSpendingForm({ ...spendingForm, userSearchTerm: value, selectedUser: null });
    searchUsersForSpending(value);
  };

  const selectUserForSpending = (user: AdminUserLoyalty) => {
    setSpendingForm({
      ...spendingForm,
      userId: user.user_id,
      selectedUser: user,
      userSearchTerm: getUserDisplayName(user)
    });
    setUserSearchResults([]);
  };

  const calculatePoints = (spending: number): number => {
    return Math.floor(spending * 10); // 1 THB = 10 points
  };

  const handleSpendingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spendingForm.selectedUser || !spendingForm.spendingAmount || !spendingForm.checkinId) {return;}

    try {
      setIsLoadingAction(true);
      const spendingAmount = parseFloat(spendingForm.spendingAmount);
      const nightsStayed = parseInt(spendingForm.nightsStayed) ?? 0;
      const pointsToAward = calculatePoints(spendingAmount);

      let description = `Spending points: ${spendingAmount} THB`;
      if (nightsStayed > 0) {
        description += `, ${nightsStayed} ${nightsStayed === 1 ? 'night' : 'nights'}`;
      }
      description += ` (Check-in: ${spendingForm.checkinId})`;

      // If nights are provided, use the new method that handles both nights and points
      if (nightsStayed > 0) {
        // We'll need to add a new service method for this
        await loyaltyService.awardSpendingWithNights(
          spendingForm.selectedUser.user_id,
          spendingAmount,
          nightsStayed,
          spendingForm.checkinId,
          description
        );
      } else {
        // Regular points-only award
        await loyaltyService.awardPoints(
          spendingForm.selectedUser.user_id,
          pointsToAward,
          description,
          spendingForm.checkinId
        );
      }

      let successMessage = `มอบคะแนน ${pointsToAward} จากการใช้จ่าย ${spendingAmount} บาท`;
      if (nightsStayed > 0) {
        successMessage += ` และ ${nightsStayed} คืน`;
      }
      toast.success(successMessage);

      closeSpendingConsole();
      loadUsers();
      if (selectedUser?.user_id === spendingForm.selectedUser.user_id) {
        loadUserTransactions(spendingForm.selectedUser.user_id);
      }
    } catch (error) {
      toast.error('ไม่สามารถมอบคะแนนได้');
      logger.error('Spending points operation failed:', error);
    } finally {
      setIsLoadingAction(false);
    }
  };

  const selectUser = (user: AdminUserLoyalty) => {
    setSelectedUser(user);
    loadUserTransactions(user.user_id);
  };

  const totalPages = Math.ceil(totalUsers / pageSize);

  const columns: TableColumn<AdminUserLoyalty>[] = [
    {
      key: 'user',
      header: t('admin.loyalty.table.user'),
      cell: (user) => (
        <div>
          <div className="text-body font-semibold text-ink">{getUserDisplayName(user)}</div>
          <div className="text-caption text-ink-muted">{getUserSecondaryLabel(user)}</div>
          {user.oauth_provider && (
            <div className="mt-1">
              <OAuthBadge provider={user.oauth_provider} />
            </div>
          )}
        </div>
      ),
    },
    { key: 'phone', header: t('userManagement.phone'), cell: (user) => user.phone ?? '-' },
    {
      key: 'tier',
      header: t('admin.loyalty.table.tier'),
      cell: (user) => <TierBadge tierName={user.tier_name} tierColor={user.tier_color} />,
    },
    { key: 'nights', header: t('admin.loyalty.table.nights', 'Nights'), align: 'right', cell: (user) => user.total_nights },
    {
      key: 'membershipId',
      header: t('profile.membershipId'),
      cell: (user) => <span className="font-mono">{user.membership_id ?? '-'}</span>,
    },
    { key: 'points', header: t('admin.loyalty.table.points'), align: 'right', cell: (user) => user.current_points.toLocaleString() },
    {
      key: 'actions',
      header: t('admin.loyalty.table.actions'),
      align: 'right',
      cell: (user) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="text-success-700 hover:text-success-700"
            onClick={(e) => {
              e.stopPropagation();
              openPointsModal(user, 'award');
            }}
            aria-label={t('admin.loyalty.awardPoints')}
          >
            <FiPlus className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-error-700 hover:text-error-700"
            onClick={(e) => {
              e.stopPropagation();
              openPointsModal(user, 'deduct');
            }}
            aria-label={t('admin.loyalty.deductPoints')}
          >
            <FiMinus className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AppShell variant="admin" title={t('admin.loyalty.title')}>
      <PageHeader
        density="admin"
        title={t('admin.loyalty.title')}
        subtitle={t('admin.loyalty.subtitle')}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={openSpendingConsole}>
              <FiDollarSign className="h-4 w-4" aria-hidden="true" />
              มอบคะแนนจากการใช้จ่าย
            </Button>
            <Button variant="secondary" size="sm" onClick={loadUsers} disabled={isLoading}>
              <FiRefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
              {t('admin.loyalty.refresh')}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Users List */}
        <div className="lg:col-span-2 space-y-4">
          <Card padding="none">
            <div className="p-4 border-b border-hairline flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-title text-ink flex items-center gap-2">
                <FiUsers className="h-5 w-5" aria-hidden="true" />
                {t('admin.loyalty.usersList')} ({totalUsers})
              </h2>

              <form onSubmit={handleSearch} className="flex gap-2">
                <Input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={t('admin.loyalty.searchPlaceholder')}
                  aria-label={t('admin.loyalty.searchPlaceholder')}
                />
                <Button type="submit" variant="secondary" size="md" aria-label={t('admin.loyalty.searchPlaceholder')}>
                  <FiSearch className="h-4 w-4" aria-hidden="true" />
                </Button>
              </form>
            </div>
            <p className="px-4 pt-3 text-fine text-ink-muted">{t('admin.loyalty.searchHint', 'Search by name, email, phone, or membership ID')}</p>

            <div className="p-4">
              <Table
                columns={columns}
                rows={users}
                rowKey={(user) => user.user_id}
                loading={isLoading}
                onRowClick={selectUser}
                aria-label={t('admin.loyalty.usersList')}
                empty={<p className="py-8 text-center text-caption text-ink-muted">{t('admin.loyalty.noUsers')}</p>}
                mobileCard={(user) => (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-body font-semibold text-ink">{getUserDisplayName(user)}</p>
                      <TierBadge tierName={user.tier_name} tierColor={user.tier_color} />
                    </div>
                    <div className="text-caption text-ink-muted">{getUserSecondaryLabel(user)}</div>
                    {user.oauth_provider && <OAuthBadge provider={user.oauth_provider} />}
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-fine text-ink-muted">{t('profile.membershipId')}</span>
                      <span className="text-caption text-ink text-right font-mono">{user.membership_id ?? '-'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-fine text-ink-muted">{t('admin.loyalty.table.points')} / {t('admin.loyalty.table.nights', 'Nights')}</span>
                      <span className="text-caption text-ink text-right">{user.current_points.toLocaleString()} / {user.total_nights}</span>
                    </div>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-success-700 hover:text-success-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          openPointsModal(user, 'award');
                        }}
                        aria-label={t('admin.loyalty.awardPoints')}
                      >
                        <FiPlus className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-error-700 hover:text-error-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          openPointsModal(user, 'deduct');
                        }}
                        aria-label={t('admin.loyalty.deductPoints')}
                      >
                        <FiMinus className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                )}
              />
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-hairline flex items-center justify-between">
                <div className="text-caption text-ink-muted">
                  {t('admin.loyalty.pagination.showing', {
                    start: currentPage * pageSize + 1,
                    end: Math.min((currentPage + 1) * pageSize, totalUsers),
                    total: totalUsers
                  })}
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage === 0}>
                    {t('common.previous')}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setCurrentPage(currentPage + 1)} disabled={currentPage >= totalPages - 1}>
                    {t('common.next')}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* User Details */}
        <div>
          {selectedUser ? (
            <Card>
              <h3 className="text-title text-ink mb-4">
                {t('admin.loyalty.userDetails')}
              </h3>

              <div className="space-y-4">
                <div>
                  <div className="text-body font-semibold text-ink">{getUserDisplayName(selectedUser)}</div>
                  <div className="text-caption text-ink-muted">{getUserSecondaryLabel(selectedUser)}</div>
                  {selectedUser.oauth_provider && (
                    <div className="mt-1">
                      <OAuthBadge provider={selectedUser.oauth_provider} />
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-fine text-ink-muted">{t('profile.membershipId')}</div>
                  <div className="text-caption font-mono text-ink">{selectedUser.membership_id ?? t('admin.coupons.notAssigned')}</div>
                </div>

                <div>
                  <div className="text-fine text-ink-muted">{t('admin.loyalty.currentPoints')}</div>
                  <div className="text-title text-ink">{selectedUser.current_points.toLocaleString()}</div>
                </div>

                <div>
                  <div className="text-fine text-ink-muted mb-1">{t('admin.loyalty.currentTier')}</div>
                  <TierBadge tierName={selectedUser.tier_name} tierColor={selectedUser.tier_color} />
                </div>
              </div>

              {/* Recent Transactions */}
              <div className="mt-6">
                <h4 className="text-body font-semibold text-ink mb-3">
                  {t('admin.loyalty.recentTransactions')}
                </h4>
                <div className="max-h-64 overflow-y-auto space-y-3">
                  {userTransactions.length === 0 ? (
                    <div className="text-caption text-ink-muted">
                      {t('admin.loyalty.noTransactions')}
                    </div>
                  ) : (
                    userTransactions.slice(0, 10).map((transaction) => (
                      <div key={transaction.id} className="flex justify-between items-start text-caption border-b border-hairline pb-2 last:border-b-0">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={transaction.points > 0 ? 'font-semibold text-success-700' : 'font-semibold text-error-700'}>
                              {transaction.points > 0 ? '+' : ''}{transaction.points.toLocaleString()} pts
                            </span>
                            <Badge tone="neutral" size="sm">{transaction.type}</Badge>
                          </div>
                          <div className="mt-1 space-y-1">
                            <div className="text-fine text-ink-muted">
                              {formatDateTimeToEuropean(transaction.created_at)}
                            </div>
                            {transaction.admin_email && (
                              <div className="flex items-center gap-1 text-fine text-brand-600">
                                <FiUser className="h-3 w-3" aria-hidden="true" />
                                <span title={`Adjusted by ${transaction.admin_email}`}>
                                  Admin: {transaction.admin_email}
                                </span>
                              </div>
                            )}
                            {transaction.admin_reason && (
                              <div className="text-fine text-ink-muted italic">
                                &quot;{transaction.admin_reason}&quot;
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </Card>
          ) : (
            <Card className="text-center text-caption text-ink-muted">
              {t('admin.loyalty.selectUser')}
            </Card>
          )}
        </div>
      </div>

      {/* Points Adjustment Modal */}
      <Modal
        open={pointsModal.isOpen}
        onClose={closePointsModal}
        title={pointsModal.type === 'award' ? t('admin.loyalty.awardPoints') : t('admin.loyalty.deductPoints')}
        size="sm"
      >
        <form onSubmit={handlePointsSubmit} className="space-y-4">
          <FormField label={t('admin.loyalty.pointsAmount')} htmlFor="points-amount">
            <Input
              id="points-amount"
              type="number"
              min="0"
              value={pointsForm.points}
              onChange={(e) => setPointsForm({ ...pointsForm, points: e.target.value })}
              placeholder="0"
            />
          </FormField>
          {pointsForm.points && parseInt(pointsForm.points) > 0 && (
            <p className="-mt-2 text-caption text-success-600">
              Will award {pointsForm.points} points
            </p>
          )}

          {/* Nights field - show for both award and deduct */}
          <FormField label="จำนวนคืน" htmlFor="points-nights">
            <Input
              id="points-nights"
              type="number"
              min="0"
              value={pointsForm.nights}
              onChange={(e) => setPointsForm({ ...pointsForm, nights: e.target.value })}
              placeholder="0"
            />
          </FormField>
          {pointsForm.nights && parseInt(pointsForm.nights) > 0 && (
            <p className={`-mt-2 text-caption ${pointsModal.type === 'award' ? 'text-brand-600' : 'text-error-600'}`}>
              {pointsModal.type === 'award'
                ? `จะเพิ่ม ${pointsForm.nights} คืน (tier จะปรับตามจำนวนคืนทั้งหมด)`
                : `จะหัก ${pointsForm.nights} คืน (tier อาจลดลงหากคืนต่ำกว่าเกณฑ์)`
              }
            </p>
          )}

          <FormField label={t('admin.loyalty.description')} htmlFor="points-description">
            <Input
              id="points-description"
              type="text"
              value={pointsForm.description}
              onChange={(e) => setPointsForm({ ...pointsForm, description: e.target.value })}
            />
          </FormField>

          <FormField label={t('admin.loyalty.referenceId')} htmlFor="points-reference">
            <Input
              id="points-reference"
              type="text"
              value={pointsForm.referenceId}
              onChange={(e) => setPointsForm({ ...pointsForm, referenceId: e.target.value })}
            />
          </FormField>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={closePointsModal}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              variant={pointsModal.type === 'award' ? 'primary' : 'destructive'}
              disabled={isLoadingAction}
              loading={isLoadingAction}
            >
              {isLoadingAction ? t('common.processing') : (
                pointsModal.type === 'award'
                  ? t('admin.loyalty.awardPoints')
                  : t('admin.loyalty.deductPoints')
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Spending Console Modal */}
      <Modal
        open={spendingModal.isOpen}
        onClose={closeSpendingConsole}
        title={
          <span className="flex items-center gap-2">
            <FiDollarSign className="h-5 w-5" aria-hidden="true" />
            มอบคะแนนจากการใช้จ่าย
          </span>
        }
      >
        <form onSubmit={handleSpendingSubmit} className="space-y-4">
          {/* User Selection */}
          <div>
            <FormField label="เลือกลูกค้า" htmlFor="spending-user-search">
              <Input
                id="spending-user-search"
                type="text"
                value={spendingForm.userSearchTerm}
                onChange={(e) => handleUserSearchChange(e.target.value)}
                placeholder="ค้นหาด้วยชื่อ, อีเมล หรือเบอร์โทร..."
                required
                trailingSlot={isSearchingUsers ? <FiRefreshCw className="mr-3 h-4 w-4 animate-spin text-ink-faint" aria-hidden="true" /> : undefined}
              />
            </FormField>

            {/* User Search Results */}
            {userSearchResults.length > 0 && !spendingForm.selectedUser && (
              <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-hairline bg-surface-card">
                {userSearchResults.map((user) => (
                  <button
                    key={user.user_id}
                    type="button"
                    onClick={() => selectUserForSpending(user)}
                    className="w-full text-left px-3 py-2 hover:bg-surface-sunken focus:bg-surface-sunken border-b border-hairline last:border-b-0"
                  >
                    <div className="text-caption font-semibold text-ink">{getUserDisplayName(user)}</div>
                    <div className="text-fine text-ink-muted">
                      {user.oauth_provider === 'line' && user.first_name ? 'ผู้ใช้ LINE' : user.email}
                    </div>
                    <div className="text-fine text-ink-faint">
                      {user.tier_name} • {user.current_points} คะแนน • {t('profile.membershipId')}: {user.membership_id ?? 'N/A'}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Selected User Display */}
            {spendingForm.selectedUser && (
              <div className="mt-2 p-3 rounded-lg border border-brand-600 bg-brand-50">
                <div className="flex justify-between items-center gap-2">
                  <div>
                    <div className="text-caption font-semibold text-brand-700">{getUserDisplayName(spendingForm.selectedUser)}</div>
                    <div className="text-fine text-brand-700">
                      {spendingForm.selectedUser.oauth_provider === 'line' && spendingForm.selectedUser.first_name ? 'ผู้ใช้ LINE' : spendingForm.selectedUser.email}
                    </div>
                    <div className="text-fine text-brand-600">
                      {spendingForm.selectedUser.tier_name} • {spendingForm.selectedUser.current_points} คะแนน
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="px-0 text-brand-700"
                    onClick={() => setSpendingForm({ ...spendingForm, selectedUser: null, userSearchTerm: '' })}
                  >
                    เปลี่ยน
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Spending Amount */}
          <FormField label="ยอดการใช้จ่าย (บาท)" htmlFor="spending-amount">
            <Input
              id="spending-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={spendingForm.spendingAmount}
              onChange={(e) => setSpendingForm({ ...spendingForm, spendingAmount: e.target.value })}
              placeholder="0.00"
              required
            />
          </FormField>
          {spendingForm.spendingAmount && (
            <p className="-mt-2 text-caption text-success-600">
              คะแนนที่จะได้รับ: {calculatePoints(parseFloat(spendingForm.spendingAmount) ?? 0)}
            </p>
          )}

          {/* Nights Stayed */}
          <FormField label="จำนวนคืน" htmlFor="spending-nights">
            <Input
              id="spending-nights"
              type="number"
              min="0"
              value={spendingForm.nightsStayed}
              onChange={(e) => setSpendingForm({ ...spendingForm, nightsStayed: e.target.value })}
              placeholder="0"
            />
          </FormField>
          {spendingForm.nightsStayed && parseInt(spendingForm.nightsStayed) > 0 && (
            <p className="-mt-2 text-caption text-brand-600">
              จะเพิ่ม {spendingForm.nightsStayed} คืนให้ผู้ใช้
            </p>
          )}

          {/* Check-in ID */}
          <FormField label="รหัสเช็คอิน (อ้างอิง)" htmlFor="spending-checkin-id">
            <Input
              id="spending-checkin-id"
              type="text"
              value={spendingForm.checkinId}
              onChange={(e) => setSpendingForm({ ...spendingForm, checkinId: e.target.value })}
              placeholder="เช่น CHK-2024-001"
              required
            />
          </FormField>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={closeSpendingConsole}>
              ยกเลิก
            </Button>
            <Button
              type="submit"
              disabled={isLoadingAction || !spendingForm.selectedUser || !spendingForm.spendingAmount || !spendingForm.checkinId}
              loading={isLoadingAction}
            >
              {isLoadingAction ? 'กำลังดำเนินการ...' : 'มอบคะแนน'}
            </Button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
