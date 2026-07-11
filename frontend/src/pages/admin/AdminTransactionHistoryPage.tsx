import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import AppShell from '../../components/layout/AppShell';
import { Card, Table, type TableColumn } from '../../components/ui';
import { loyaltyService, AdminTransaction } from '../../services/loyaltyService';
import { logger } from '../../utils/logger';

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatName(firstName: string | null | undefined, lastName: string | null | undefined) {
  const parts = [firstName, lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : '-';
}

function formatChange(value: number | null | undefined) {
  if (value === null || value === undefined || value === 0) {return '-';}
  const sign = value > 0 ? '+' : '';
  return `${sign}${value}`;
}

function ChangeValue({ value }: { value: number | null | undefined }) {
  const tone = value && value > 0 ? 'success' : value && value < 0 ? 'error' : 'neutral';
  const toneClass = tone === 'success' ? 'text-success-700' : tone === 'error' ? 'text-error-700' : 'text-ink-muted';
  return (
    <span data-tone={tone} className={toneClass}>
      {formatChange(value)}
    </span>
  );
}

export default function AdminTransactionHistoryPage() {
  const { t } = useTranslation();
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const response = await loyaltyService.getAdminTransactions(100, 0);
      setTransactions(response.transactions);
      setTotal(response.total);
    } catch (error) {
      logger.error('Error loading transactions:', error);
      toast.error(t('errors.networkError'));
    } finally {
      setLoading(false);
    }
  };

  const columns: TableColumn<AdminTransaction>[] = [
    {
      key: 'userMembershipId',
      header: 'User Membership ID',
      cell: (transaction) => transaction.user_membership_id ?? '-',
    },
    {
      key: 'userName',
      header: 'User Name',
      cell: (transaction) => formatName(transaction.user_first_name, transaction.user_last_name),
    },
    {
      key: 'userEmail',
      header: 'User Email',
      cell: (transaction) => transaction.user_email ?? '-',
    },
    {
      key: 'nightsStayed',
      header: 'Night Change',
      align: 'right',
      cell: (transaction) => <ChangeValue value={transaction.nights_stayed} />,
    },
    {
      key: 'points',
      header: 'Point Change',
      align: 'right',
      cell: (transaction) => <ChangeValue value={transaction.points} />,
    },
    {
      key: 'adminName',
      header: 'Admin Name',
      cell: (transaction) => formatName(transaction.admin_first_name, transaction.admin_last_name),
    },
    {
      key: 'adminMembershipId',
      header: 'Admin Membership ID',
      cell: (transaction) => transaction.admin_membership_id ?? '-',
    },
    {
      key: 'timestamp',
      header: 'Timestamp',
      cell: (transaction) => formatDate(transaction.created_at),
    },
  ];

  return (
    <AppShell variant="admin" title={t('admin.loyalty.transactionHistory')}>
      <Card padding="none">
        <div className="flex items-center justify-end px-4 py-3 border-b border-hairline">
          <span className="text-caption text-ink-muted">
            {t('common.showing')} {transactions.length} {t('common.of')} {total} {t('admin.loyalty.transactions')}
          </span>
        </div>
        <div className="p-4">
          <Table
            columns={columns}
            rows={transactions}
            rowKey={(transaction) => transaction.id}
            loading={loading}
            aria-label={t('admin.loyalty.transactionHistory')}
            empty={<p className="py-8 text-center text-caption text-ink-muted">{t('admin.loyalty.noTransactions')}</p>}
            mobileCard={(transaction) => (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-body font-semibold text-ink">
                    {formatName(transaction.user_first_name, transaction.user_last_name)}
                  </p>
                  <span className="text-fine text-ink-muted">{formatDate(transaction.created_at)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-fine text-ink-muted">Email</span>
                  <span className="text-caption text-ink text-right">{transaction.user_email ?? '-'}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-fine text-ink-muted">Admin</span>
                  <span className="text-caption text-ink text-right">
                    {formatName(transaction.admin_first_name, transaction.admin_last_name)}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-fine text-ink-muted">Night Change</span>
                  <ChangeValue value={transaction.nights_stayed} />
                  <span className="text-fine text-ink-muted">Point Change</span>
                  <ChangeValue value={transaction.points} />
                </div>
              </div>
            )}
          />
        </div>
      </Card>
    </AppShell>
  );
}
