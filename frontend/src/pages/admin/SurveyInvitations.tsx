import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  FiSend,
  FiUsers,
  FiMail,
  FiClock,
  FiCheckCircle,
  FiAlertCircle,
  FiFilter,
  FiSearch,
  FiUserPlus,
} from 'react-icons/fi';
import { Survey, SurveyInvitation } from '../../types/survey';
import { surveyService } from '../../services/surveyService';
import { User, userService } from '../../services/userService';
import toast from 'react-hot-toast';
import { logger } from '../../utils/logger';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import AppShell from '../../components/layout/AppShell';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button, buttonVariants } from '../../components/ui/Button';
import { Badge, BadgeTone } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { Table, TableColumn } from '../../components/ui/Table';

interface InvitationStats {
  total: number;
  sent: number;
  viewed: number;
  started: number;
  completed: number;
}

const SurveyInvitations: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [invitations, setInvitations] = useState<SurveyInvitation[]>([]);
  const [stats, setStats] = useState<InvitationStats>({
    total: 0,
    sent: 0,
    viewed: 0,
    started: 0,
    completed: 0
  });
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showUserSelection, setShowUserSelection] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [userSearch, setUserSearch] = useState('');
  const [showSendAllConfirm, setShowSendAllConfirm] = useState(false);
  const [showSendSelectedConfirm, setShowSendSelectedConfirm] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [sendingToUsers, setSendingToUsers] = useState(false);

  useEffect(() => {
    if (id) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadData = async () => {
    if (!id) {
      toast.error(t('surveys.admin.invitations.surveyIdRequired'));
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Load survey details
      const surveyData = await surveyService.getSurveyById(id);
      setSurvey(surveyData);

      // Load invitations
      const invitationsData = await surveyService.getSurveyInvitations(id);
      setInvitations(invitationsData);

      // Calculate stats
      const newStats: InvitationStats = {
        total: invitationsData.length,
        sent: invitationsData.filter(i => i.status !== 'pending').length,
        viewed: invitationsData.filter(i => ['viewed', 'started', 'completed'].includes(i.status)).length,
        started: invitationsData.filter(i => ['started', 'completed'].includes(i.status)).length,
        completed: invitationsData.filter(i => i.status === 'completed').length
      };
      setStats(newStats);

    } catch (err) {
      logger.error('Error loading data:', err);
      toast.error(t('surveys.admin.invitations.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvitations = async () => {
    setShowSendAllConfirm(false);

    if (!id) {
      toast.error(t('surveys.admin.invitations.surveyIdRequired'));
      return;
    }

    try {
      setSending(true);
      const result = await surveyService.sendSurveyInvitations(id);
      toast.success(t('surveys.admin.invitations.invitationsSent', { count: result.sent }));
      loadData();
    } catch (err) {
      logger.error('Error sending invitations:', err);
      const errorMessage = err instanceof Error && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      toast.error(errorMessage ?? t('surveys.admin.invitations.sendError'));
    } finally {
      setSending(false);
    }
  };

  const handleResendInvitation = async (invitationId: string) => {
    try {
      await surveyService.resendInvitation(invitationId);
      toast.success(t('surveys.admin.invitations.resendSuccess'));
      loadData();
    } catch (err) {
      logger.error('Error resending invitation:', err);
      toast.error(t('surveys.admin.invitations.resendError'));
    }
  };

  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      const result = await userService.getAllUsers(1, 100, userSearch);
      const customerUsers = result.users.filter(user => user.role === 'customer');
      setUsers(customerUsers);
    } catch (err) {
      logger.error('Error loading users:', err);
      toast.error(t('surveys.admin.invitations.loadUsersError'));
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleShowUserSelection = () => {
    setShowUserSelection(true);
    if (users.length === 0) {
      loadUsers();
    }
  };

  const handleUserSelectionToggle = (userId: string) => {
    const newSelection = new Set(selectedUsers);
    if (newSelection.has(userId)) {
      newSelection.delete(userId);
    } else {
      newSelection.add(userId);
    }
    setSelectedUsers(newSelection);
  };

  const handleSendToSelectedUsers = async () => {
    if (selectedUsers.size === 0) {
      toast.error(t('surveys.admin.invitations.selectAtLeastOneUser'));
      return;
    }

    setShowSendSelectedConfirm(false);

    if (!id) {
      toast.error(t('surveys.admin.invitations.surveyIdRequired'));
      return;
    }

    try {
      setSendingToUsers(true);
      const userIdsArray = Array.from(selectedUsers);

      const result = await surveyService.sendSurveyInvitationsToUsers(id, userIdsArray);

      if (result.sent === 0) {
        toast.error(t('surveys.admin.invitations.noInvitationsSentToUsers'));
      } else {
        toast.success(t('surveys.admin.invitations.invitationsSent', { count: result.sent }));
      }

      setShowUserSelection(false);
      setSelectedUsers(new Set());
      loadData();
    } catch (err) {
      logger.error('Error sending invitations to users:', err);
      const errorMessage = err instanceof Error && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      toast.error(errorMessage ?? t('surveys.admin.invitations.sendError'));
    } finally {
      setSendingToUsers(false);
    }
  };

  // Debounced user search
  useEffect(() => {
    if (showUserSelection) {
      const timer = setTimeout(() => {
        loadUsers();
      }, 300);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userSearch, showUserSelection]);

  const STATUS_BADGE: Record<string, { tone: BadgeTone; icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>; labelKey: string }> = {
    pending: { tone: 'neutral', icon: FiClock, labelKey: 'surveys.admin.invitations.statusPending' },
    sent: { tone: 'brand', icon: FiMail, labelKey: 'surveys.admin.invitations.statusSent' },
    viewed: { tone: 'warning', icon: FiAlertCircle, labelKey: 'surveys.admin.invitations.statusViewed' },
    started: { tone: 'info', icon: FiClock, labelKey: 'surveys.admin.invitations.statusInProgress' },
    completed: { tone: 'success', icon: FiCheckCircle, labelKey: 'surveys.admin.invitations.statusCompleted' },
  };

  const getStatusBadge = (status: string) => {
    const config = STATUS_BADGE[status];
    if (!config) {return null;}
    const Icon = config.icon;
    return (
      <Badge tone={config.tone}>
        <Icon className="h-3 w-3" aria-hidden />
        {t(config.labelKey)}
      </Badge>
    );
  };

  const formatInvitationMeta = (invitation: SurveyInvitation) => {
    const invited = `${t('surveys.admin.invitations.invited')}: ${new Date(invitation.created_at).toLocaleDateString()}`;
    const sent = invitation.sent_at
      ? ` • ${t('surveys.admin.invitations.sentOn')}: ${new Date(invitation.sent_at).toLocaleDateString()}`
      : '';
    return `${invited}${sent}`;
  };

  const invitationColumns: TableColumn<SurveyInvitation>[] = [
    {
      key: 'user',
      header: t('surveys.admin.invitations.userIdLabel'),
      cell: (invitation) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-surface-sunken">
            <FiUsers className="h-5 w-5 text-ink-muted" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-caption font-semibold text-ink">
              {t('surveys.admin.invitations.userIdLabel')}: {invitation.user_id}
            </p>
            <p className="text-fine text-ink-muted">{formatInvitationMeta(invitation)}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: t('surveys.admin.basicInfo.status'),
      cell: (invitation) => getStatusBadge(invitation.status),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      hideOnMobile: true,
      cell: (invitation) =>
        invitation.status === 'pending' ? (
          <Button variant="ghost" size="sm" onClick={() => handleResendInvitation(invitation.id)}>
            {t('surveys.admin.invitations.sendNow')}
          </Button>
        ) : null,
    },
  ];

  const filteredInvitations = invitations.filter(
    (inv) => selectedStatus === 'all' || inv.status === selectedStatus
  );

  if (loading) {
    return (
      <AppShell variant="admin" title={t('surveys.admin.invitations.title')}>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => (
            <Card key={`invitations-kpi-skeleton-${index}`}>
              <Skeleton className="h-12 w-full" />
            </Card>
          ))}
        </div>
        <Card className="mt-6">
          <Skeleton className="h-64 w-full" />
        </Card>
      </AppShell>
    );
  }

  if (!survey) {
    return (
      <AppShell variant="admin" title={t('surveys.admin.invitations.title')}>
        <Card>
          <EmptyState
            title={t('surveys.notFound')}
            action={
              <Link to="/admin/surveys" className={buttonVariants({ variant: 'secondary' })}>
                {t('surveys.backToSurveys')}
              </Link>
            }
          />
        </Card>
      </AppShell>
    );
  }

  // Show message for public surveys (invitations not needed)
  if (survey.access_type === 'public') {
    return (
      <AppShell variant="admin" title={t('surveys.admin.invitations.title')}>
        <PageHeader density="admin" title={survey.title} subtitle={t('surveys.admin.invitations.title')} backTo="/admin/surveys" />
        <Card className="mx-auto max-w-text text-center" padding="lg">
          <FiUsers className="mx-auto mb-4 h-12 w-12 text-brand-600" aria-hidden="true" />
          <h3 className="mb-2 text-title text-ink">{t('surveys.admin.invitations.publicSurveyTitle')}</h3>
          <p className="mb-4 text-body text-ink-muted">{t('surveys.admin.invitations.publicSurveyDescription')}</p>
          <div className="space-y-2 text-caption text-ink-muted">
            <p><strong className="text-ink">{t('surveys.admin.invitations.surveyType')}:</strong> {t('surveys.admin.invitations.publicSurveyType')}</p>
            <p><strong className="text-ink">{t('surveys.admin.basicInfo.status')}:</strong> {survey.status}</p>
            <p><strong className="text-ink">{t('surveys.stats.questions')}:</strong> {survey.questions.length}</p>
            <p><strong className="text-ink">{t('surveys.admin.invitations.availabilityLabel')}:</strong> {t('surveys.admin.invitations.availabilityAllUsers')}</p>
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to={`/admin/surveys/${survey.id}/analytics`} className={buttonVariants({ variant: 'primary' })}>
              {t('surveys.admin.invitations.viewAnalytics')}
            </Link>
            <Link to={`/admin/surveys/${survey.id}/edit`} className={buttonVariants({ variant: 'secondary' })}>
              {t('surveys.admin.editSurvey')}
            </Link>
          </div>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell variant="admin" title={t('surveys.admin.invitations.title')}>
      <PageHeader
        density="admin"
        title={survey.title}
        subtitle={t('surveys.admin.invitations.title')}
        backTo="/admin/surveys"
        actions={
          <>
            <Button
              variant="secondary"
              onClick={handleShowUserSelection}
              disabled={survey.status !== 'active'}
            >
              <FiUserPlus className="h-4 w-4" aria-hidden="true" />
              {t('surveys.admin.invitations.selectUsers')}
            </Button>
            <Button
              variant="primary"
              onClick={() => setShowSendAllConfirm(true)}
              loading={sending}
              disabled={survey.status !== 'active'}
            >
              <FiSend className="h-4 w-4" aria-hidden="true" />
              {t('surveys.admin.invitations.sendInvitations')}
            </Button>
          </>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Card>
          <div className="flex items-center gap-4">
            <FiUsers className="h-8 w-8 flex-shrink-0 text-ink-faint" aria-hidden="true" />
            <div>
              <p className="text-caption text-ink-muted">{t('surveys.admin.invitations.statsTotal')}</p>
              <p className="text-title text-ink">{stats.total}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-4">
            <FiMail className="h-8 w-8 flex-shrink-0 text-brand-600" aria-hidden="true" />
            <div>
              <p className="text-caption text-ink-muted">{t('surveys.admin.invitations.statsSent')}</p>
              <p className="text-title text-ink">{stats.sent}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-4">
            <FiAlertCircle className="h-8 w-8 flex-shrink-0 text-warning-600" aria-hidden="true" />
            <div>
              <p className="text-caption text-ink-muted">{t('surveys.admin.invitations.statsViewed')}</p>
              <p className="text-title text-ink">{stats.viewed}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-4">
            <FiClock className="h-8 w-8 flex-shrink-0 text-info-600" aria-hidden="true" />
            <div>
              <p className="text-caption text-ink-muted">{t('surveys.admin.invitations.statsStarted')}</p>
              <p className="text-title text-ink">{stats.started}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-4">
            <FiCheckCircle className="h-8 w-8 flex-shrink-0 text-success-600" aria-hidden="true" />
            <div>
              <p className="text-caption text-ink-muted">{t('surveys.admin.invitations.statsCompleted')}</p>
              <p className="text-title text-ink">{stats.completed}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mt-6">
        <div className="flex items-center gap-4">
          <FiFilter className="h-5 w-5 text-ink-faint" aria-hidden="true" />
          <Select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-48"
          >
            <option value="all">{t('surveys.admin.invitations.statusFilterAll')}</option>
            <option value="pending">{t('surveys.admin.invitations.statusPending')}</option>
            <option value="sent">{t('surveys.admin.invitations.statusSent')}</option>
            <option value="viewed">{t('surveys.admin.invitations.statusViewed')}</option>
            <option value="started">{t('surveys.admin.invitations.statusInProgress')}</option>
            <option value="completed">{t('surveys.admin.invitations.statusCompleted')}</option>
          </Select>
        </div>
      </Card>

      {/* Invitations List */}
      <Card className="mt-6" padding="none">
        <div className="px-6 py-5">
          <h3 className="text-title text-ink">{t('surveys.admin.invitations.recipientsHeading')}</h3>
        </div>
        <div className="px-6 pb-6">
          <Table
            columns={invitationColumns}
            rows={filteredInvitations}
            rowKey={(invitation) => invitation.id}
            mobileCard={(invitation) => (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-surface-sunken">
                    <FiUsers className="h-5 w-5 text-ink-muted" aria-hidden="true" />
                  </div>
                  <p className="text-body font-semibold text-ink">
                    {t('surveys.admin.invitations.userIdLabel')}: {invitation.user_id}
                  </p>
                </div>
                <p className="text-fine text-ink-muted">{formatInvitationMeta(invitation)}</p>
                <div className="flex items-center justify-between">
                  {getStatusBadge(invitation.status)}
                  {invitation.status === 'pending' && (
                    <Button variant="ghost" size="sm" onClick={() => handleResendInvitation(invitation.id)}>
                      {t('surveys.admin.invitations.sendNow')}
                    </Button>
                  )}
                </div>
              </div>
            )}
            empty={
              <EmptyState
                icon={FiUsers}
                title={t('surveys.admin.invitations.noInvitations')}
                action={
                  survey.status === 'active' ? (
                    <Button variant="primary" onClick={() => setShowSendAllConfirm(true)}>
                      <FiSend className="h-4 w-4" aria-hidden="true" />
                      {t('surveys.admin.invitations.sendFirstInvitations')}
                    </Button>
                  ) : undefined
                }
              />
            }
          />
        </div>
      </Card>

      {/* User Selection Modal */}
      <Modal
        open={showUserSelection}
        onClose={() => setShowUserSelection(false)}
        title={t('surveys.admin.invitations.selectUsers')}
        size="lg"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowUserSelection(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() => setShowSendSelectedConfirm(true)}
              disabled={selectedUsers.size === 0}
              loading={sendingToUsers}
            >
              <FiSend className="h-4 w-4" aria-hidden="true" />
              {t('surveys.admin.invitations.sendInvitationsCount', { count: selectedUsers.size })}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            type="text"
            leadingIcon={<FiSearch className="h-4 w-4" aria-hidden="true" />}
            placeholder={t('surveys.admin.invitations.searchUsersPlaceholder')}
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
          />

          {selectedUsers.size > 0 && (
            <Badge tone="brand">{t('surveys.admin.invitations.usersSelectedCount', { count: selectedUsers.size })}</Badge>
          )}

          <div className="max-h-96 overflow-y-auto rounded-lg border border-hairline">
            {loadingUsers ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 3 }, (_, index) => (
                  <Skeleton key={`user-select-skeleton-${index}`} className="h-12 w-full" />
                ))}
              </div>
            ) : users.length > 0 ? (
              <div className="divide-y divide-hairline">
                {users.map((user) => (
                  <label key={user.id} className="flex cursor-pointer items-center p-4 hover:bg-surface-sunken">
                    <input
                      type="checkbox"
                      checked={selectedUsers.has(user.id)}
                      onChange={() => handleUserSelectionToggle(user.id)}
                      className="h-4 w-4 rounded border-hairline-strong text-brand-600 focus:ring-brand-600"
                    />
                    <div className="ml-3 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-caption font-semibold text-ink">
                          {user.firstName} {user.lastName}
                        </p>
                        <Badge tone="neutral" size="sm">{user.role}</Badge>
                      </div>
                      <p className="text-caption text-ink-muted">{user.email}</p>
                      <p className="text-fine text-ink-faint">
                        {t('surveys.admin.invitations.joined')}: {new Date(user.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={FiUsers}
                title={t('surveys.admin.invitations.noUsersFound')}
                description={userSearch ? t('surveys.rewardHistory.tryAdjustingSearch') : undefined}
              />
            )}
          </div>
        </div>
      </Modal>

      {/* Confirm Send to All Dialog */}
      <ConfirmDialog
        isOpen={showSendAllConfirm}
        title="Send Invitations to All Eligible Users"
        message="Are you sure you want to send invitations to all eligible users? This action will send survey invitations based on the targeting criteria."
        confirmText="Send Invitations"
        cancelText="Cancel"
        onConfirm={handleSendInvitations}
        onCancel={() => setShowSendAllConfirm(false)}
        variant="info"
      />

      {/* Confirm Send to Selected Dialog */}
      <ConfirmDialog
        isOpen={showSendSelectedConfirm}
        title={`Send Invitations to ${selectedUsers.size} Users`}
        message={`Are you sure you want to send invitations to the ${selectedUsers.size} selected users?`}
        confirmText="Send Invitations"
        cancelText="Cancel"
        onConfirm={handleSendToSelectedUsers}
        onCancel={() => setShowSendSelectedConfirm(false)}
        variant="info"
      />
    </AppShell>
  );
};

export default SurveyInvitations;
