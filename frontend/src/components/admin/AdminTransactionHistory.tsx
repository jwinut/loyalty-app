import { useState, useEffect } from 'react';
import { FiUser } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { loyaltyService, AdminTransaction } from '../../services/loyaltyService';
import { formatDateToDDMMYYYY } from '../../utils/dateFormatter';
import { logger } from '../../utils/logger';
import { Table, type TableColumn } from '../ui';

function formatDate(dateString: string) {
  const date = new Date(dateString);
  const dateOnly = formatDateToDDMMYYYY(date);
  const timeOnly = date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  return `${dateOnly}, ${timeOnly}`;
}

function isPositiveDelta(transaction: AdminTransaction) {
  return transaction.points > 0 || (transaction.points === 0 && transaction.type === 'earned_stay');
}

function PointsDelta({ transaction }: { transaction: AdminTransaction }) {
  const isPositive = isPositiveDelta(transaction);
  return (
    <span data-tone={isPositive ? 'success' : 'error'} className={`font-semibold ${isPositive ? 'text-success-700' : 'text-error-700'}`}>
      {isPositive ? '+' : ''}
      {transaction.points} pts
    </span>
  );
}

function shouldHideAdminReason(adminReason: string | null | undefined): boolean {
  if (!adminReason) {
    return true;
  }
  const lowerReason = adminReason.toLowerCase();
  return lowerReason.includes('thb') || lowerReason.includes('baht') || lowerReason.includes('฿');
}

function AdminInfo({ transaction }: { transaction: AdminTransaction }) {
  if (!transaction.admin_email) {
    return <span className="text-ink-muted">-</span>;
  }
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1 text-brand-600">
        <FiUser className="h-3 w-3" aria-hidden="true" />
        <span title={`Adjusted by ${transaction.admin_email}`}>
          Admin: {transaction.admin_email}
        </span>
      </div>
      {!shouldHideAdminReason(transaction.admin_reason) && (
        <div className="text-fine text-ink-muted italic">{transaction.admin_reason}</div>
      )}
    </div>
  );
}

export default function AdminTransactionHistory() {
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
      const result = await loyaltyService.getAdminTransactions(20, 0);
      setTransactions(result.transactions);
      setTotal(result.total);
    } catch (error) {
      logger.error('Error loading admin transactions:', error);
      toast.error(t('errors.networkError'));
    } finally {
      setLoading(false);
    }
  };

  const getUserDisplayName = (transaction: AdminTransaction) => {
    if (transaction.user_first_name ?? transaction.user_last_name) {
      return `${transaction.user_first_name ?? ''} ${transaction.user_last_name ?? ''}`.trim();
    }
    return transaction.user_email ?? t('common.unknown');
  };

  const columns: TableColumn<AdminTransaction>[] = [
    { key: 'user', header: 'User', cell: (transaction) => getUserDisplayName(transaction) },
    { key: 'type', header: 'Type', cell: (transaction) => transaction.type },
    { key: 'points', header: 'Points', align: 'right', cell: (transaction) => <PointsDelta transaction={transaction} /> },
    { key: 'date', header: 'Date', cell: (transaction) => formatDate(transaction.created_at) },
    { key: 'admin', header: 'Admin', cell: (transaction) => <AdminInfo transaction={transaction} /> },
  ];

  return (
    <div className="mt-6">
      <h4 className="text-body font-semibold text-ink mb-3">
        {t('admin.loyalty.transactionHistory')}
      </h4>
      <div className="max-h-64 overflow-y-auto">
        <Table
          columns={columns}
          rows={transactions}
          rowKey={(transaction) => transaction.id}
          loading={loading}
          aria-label={t('admin.loyalty.transactionHistory')}
          empty={<p className="py-4 text-center text-caption text-ink-muted">{t('loyalty.noTransactions')}</p>}
          mobileCard={(transaction) => (
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-body font-semibold text-ink">{getUserDisplayName(transaction)}</p>
                <PointsDelta transaction={transaction} />
              </div>
              <div className="text-fine text-ink-muted">{formatDate(transaction.created_at)}</div>
              <div className="flex items-center gap-1 text-fine text-ink-muted">
                <FiUser className="h-3 w-3" aria-hidden="true" />
                <span>{transaction.type}</span>
              </div>
              {transaction.admin_email && (
                <div className="text-fine">
                  <AdminInfo transaction={transaction} />
                </div>
              )}
            </div>
          )}
        />
      </div>
      {total > 20 && (
        <div className="mt-3 text-fine text-ink-muted text-center">
          {t('common.showing')} 20 {t('common.of')} {total} {t('admin.loyalty.transactions')}
        </div>
      )}
    </div>
  );
}
