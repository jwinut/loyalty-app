/* eslint-disable @typescript-eslint/no-non-null-assertion -- Test file uses non-null assertions for DOM element access */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import AdminTransactionHistory from '../AdminTransactionHistory';
import { loyaltyService, AdminTransaction } from '../../../services/loyaltyService';
import { logger } from '../../../utils/logger';
import toast from 'react-hot-toast';

// Mock dependencies
const mockTranslate = vi.fn((key: string) => {
  const translations: Record<string, string> = {
    'admin.loyalty.transactionHistory': 'Transaction History',
    'admin.loyalty.transactions': 'transactions',
    'loyalty.noTransactions': 'No transactions yet',
    'errors.networkError': 'Network error',
    'common.showing': 'Showing',
    'common.of': 'of',
  };
  return translations[key] || key;
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: mockTranslate,
  }),
}));

vi.mock('../../../services/loyaltyService', () => ({
  loyaltyService: {
    getAdminTransactions: vi.fn(),
  },
}));

vi.mock('../../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
  },
}));

vi.mock('react-icons/fi', () => ({
  FiUser: () => <span data-testid="user-icon">User</span>,
}));

vi.mock('../../../utils/dateFormatter', () => ({
  formatDateToDDMMYYYY: vi.fn((date: Date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }),
}));

// The Table primitive dual-renders a desktop <table> and a mobile card list
// simultaneously (CSS controls which is visible) — scope row-content
// assertions to the desktop table to avoid ambiguous duplicate matches.
function getDesktopTable() {
  return screen.getByRole('table');
}

describe('AdminTransactionHistory', () => {
  const mockTransactions: AdminTransaction[] = [
    {
      id: 'txn-1',
      user_id: 'user-1',
      points: 500,
      type: 'earned_stay',
      description: 'Points earned from hotel stay',
      reference_id: 'booking-001',
      admin_user_id: null,
      admin_reason: null,
      admin_email: undefined,
      expires_at: null,
      created_at: '2024-01-15T10:30:00Z',
      user_email: 'user1@example.com',
      user_first_name: 'John',
      user_last_name: 'Doe',
      user_membership_id: 'M001',
    },
    {
      id: 'txn-2',
      user_id: 'user-2',
      points: -200,
      type: 'redeemed',
      description: 'Points redeemed',
      reference_id: 'redemption-001',
      admin_user_id: null,
      admin_reason: null,
      admin_email: undefined,
      expires_at: null,
      created_at: '2024-01-10T14:20:00Z',
      user_email: 'user2@example.com',
      user_first_name: 'Jane',
      user_last_name: 'Smith',
      user_membership_id: 'M002',
    },
    {
      id: 'txn-3',
      user_id: 'user-3',
      points: 1000,
      type: 'admin_award',
      description: 'Admin bonus',
      reference_id: null,
      admin_user_id: 'admin-1',
      admin_reason: 'Loyalty bonus for frequent guest',
      admin_email: 'admin@example.com',
      expires_at: null,
      created_at: '2024-01-05T09:15:00Z',
      user_email: 'user3@example.com',
      user_first_name: 'Bob',
      user_last_name: 'Johnson',
      user_membership_id: 'M003',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementation
    vi.mocked(loyaltyService.getAdminTransactions).mockResolvedValue({
      transactions: mockTransactions,
      total: 23,
    });
  });

  describe('Basic Rendering', () => {
    it('should render the component', async () => {
      render(<AdminTransactionHistory />);

      await waitFor(() => {
        expect(screen.getByText('Transaction History')).toBeInTheDocument();
      });
    });

    it('should render without crashing', async () => {
      expect(() => render(<AdminTransactionHistory />)).not.toThrow();
      // Wait for async operations to complete
      await waitFor(() => {
        expect(screen.queryByText('Transaction History')).toBeInTheDocument();
      });
    });

    it('should have proper heading', async () => {
      render(<AdminTransactionHistory />);

      await waitFor(() => {
        const heading = screen.getByText('Transaction History');
        expect(heading.tagName).toBe('H4');
      });
    });
  });

  describe('Loading State', () => {
    it('should mark the table as loading initially and clear it once data arrives', async () => {
      const { container } = render(<AdminTransactionHistory />);

      expect(container.querySelector('[data-loading="true"]')).toBeInTheDocument();

      await waitFor(() => {
        expect(container.querySelector('[data-loading="true"]')).not.toBeInTheDocument();
      });
    });

    it('should load transactions on mount', async () => {
      render(<AdminTransactionHistory />);

      await waitFor(() => {
        expect(loyaltyService.getAdminTransactions).toHaveBeenCalledWith(20, 0);
      });
    });
  });

  describe('Transaction List Display', () => {
    it('should display all transactions', async () => {
      render(<AdminTransactionHistory />);

      await waitFor(() => {
        const table = getDesktopTable();
        expect(within(table).getByText('+500 pts')).toBeInTheDocument();
        expect(within(table).getByText('-200 pts')).toBeInTheDocument();
        expect(within(table).getByText('+1000 pts')).toBeInTheDocument();
      });
    });

    it('should display transaction types', async () => {
      render(<AdminTransactionHistory />);

      await waitFor(() => {
        const table = getDesktopTable();
        expect(within(table).getByText('earned_stay')).toBeInTheDocument();
        expect(within(table).getByText('redeemed')).toBeInTheDocument();
        expect(within(table).getByText('admin_award')).toBeInTheDocument();
      });
    });

    it('should tag positive points with a success tone', async () => {
      render(<AdminTransactionHistory />);

      await waitFor(() => {
        const positivePoints = within(getDesktopTable()).getByText('+500 pts');
        expect(positivePoints).toHaveAttribute('data-tone', 'success');
      });
    });

    it('should tag negative points with an error tone', async () => {
      render(<AdminTransactionHistory />);

      await waitFor(() => {
        const negativePoints = within(getDesktopTable()).getByText('-200 pts');
        expect(negativePoints).toHaveAttribute('data-tone', 'error');
      });
    });

    it('should display transaction dates in DD/MM/YYYY HH:MM format', async () => {
      render(<AdminTransactionHistory />);

      await waitFor(() => {
        const table = getDesktopTable();
        expect(within(table).getByText(/15\/01\/2024/)).toBeInTheDocument();
        expect(within(table).getByText(/10\/01\/2024/)).toBeInTheDocument();
        expect(within(table).getByText(/05\/01\/2024/)).toBeInTheDocument();
      });
    });

    it('should display user names when available', async () => {
      render(<AdminTransactionHistory />);

      await waitFor(() => {
        const table = getDesktopTable();
        expect(within(table).getByText('John Doe')).toBeInTheDocument();
        expect(within(table).getByText('Jane Smith')).toBeInTheDocument();
        expect(within(table).getByText('Bob Johnson')).toBeInTheDocument();
      });
    });

    it('should display user email when name not available', async () => {
      const baseTransaction = mockTransactions[0]!;
      const transactionWithoutName: AdminTransaction[] = [
        {
          id: baseTransaction.id,
          user_id: baseTransaction.user_id,
          points: baseTransaction.points,
          type: baseTransaction.type,
          description: baseTransaction.description,
          reference_id: baseTransaction.reference_id,
          admin_user_id: baseTransaction.admin_user_id,
          admin_reason: baseTransaction.admin_reason,
          admin_email: baseTransaction.admin_email,
          expires_at: baseTransaction.expires_at,
          created_at: baseTransaction.created_at,
          user_email: baseTransaction.user_email,
          user_membership_id: baseTransaction.user_membership_id,
          user_first_name: null,
          user_last_name: null,
        },
      ];

      vi.mocked(loyaltyService.getAdminTransactions).mockResolvedValueOnce({
        transactions: transactionWithoutName,
        total: 1,
      });

      render(<AdminTransactionHistory />);

      await waitFor(() => {
        expect(within(getDesktopTable()).getByText('user1@example.com')).toBeInTheDocument();
      });
    });
  });

  describe('Admin Information Display', () => {
    it('should display admin email when present', async () => {
      render(<AdminTransactionHistory />);

      await waitFor(() => {
        expect(within(getDesktopTable()).getByText(/Admin: admin@example.com/)).toBeInTheDocument();
      });
    });

    it('should display admin reason when present', async () => {
      render(<AdminTransactionHistory />);

      await waitFor(() => {
        expect(within(getDesktopTable()).getByText('Loyalty bonus for frequent guest')).toBeInTheDocument();
      });
    });

    it('should not display admin info for non-admin transactions', async () => {
      render(<AdminTransactionHistory />);

      await waitFor(() => {
        const table = getDesktopTable();
        expect(within(table).queryByText(/Admin:/)).toBeInTheDocument();
        const adminEmails = within(table).getAllByText(/Admin:/);
        expect(adminEmails).toHaveLength(1); // Only one admin transaction
      });
    });

    it('should not display admin reason containing THB', async () => {
      const baseTransaction = mockTransactions[2]!;
      const transactionWithTHB: AdminTransaction[] = [
        {
          id: baseTransaction.id,
          user_id: baseTransaction.user_id,
          points: baseTransaction.points,
          type: baseTransaction.type,
          description: baseTransaction.description,
          reference_id: baseTransaction.reference_id,
          admin_user_id: baseTransaction.admin_user_id,
          admin_email: baseTransaction.admin_email,
          expires_at: baseTransaction.expires_at,
          created_at: baseTransaction.created_at,
          user_email: baseTransaction.user_email,
          user_membership_id: baseTransaction.user_membership_id,
          user_first_name: baseTransaction.user_first_name,
          user_last_name: baseTransaction.user_last_name,
          admin_reason: 'Spent 5000 THB at hotel',
        },
      ];

      vi.mocked(loyaltyService.getAdminTransactions).mockResolvedValueOnce({
        transactions: transactionWithTHB,
        total: 1,
      });

      render(<AdminTransactionHistory />);

      await waitFor(() => {
        expect(screen.queryByText('Spent 5000 THB at hotel')).not.toBeInTheDocument();
      });
    });

    it('should not display admin reason containing baht', async () => {
      const baseTransaction = mockTransactions[2]!;
      const transactionWithBaht: AdminTransaction[] = [
        {
          id: baseTransaction.id,
          user_id: baseTransaction.user_id,
          points: baseTransaction.points,
          type: baseTransaction.type,
          description: baseTransaction.description,
          reference_id: baseTransaction.reference_id,
          admin_user_id: baseTransaction.admin_user_id,
          admin_email: baseTransaction.admin_email,
          expires_at: baseTransaction.expires_at,
          created_at: baseTransaction.created_at,
          user_email: baseTransaction.user_email,
          user_membership_id: baseTransaction.user_membership_id,
          user_first_name: baseTransaction.user_first_name,
          user_last_name: baseTransaction.user_last_name,
          admin_reason: 'Purchase of 2000 baht',
        },
      ];

      vi.mocked(loyaltyService.getAdminTransactions).mockResolvedValueOnce({
        transactions: transactionWithBaht,
        total: 1,
      });

      render(<AdminTransactionHistory />);

      await waitFor(() => {
        expect(screen.queryByText('Purchase of 2000 baht')).not.toBeInTheDocument();
      });
    });

    it('should style admin email with the brand tone', async () => {
      render(<AdminTransactionHistory />);

      await waitFor(() => {
        const adminEmail = within(getDesktopTable()).getByText(/Admin: admin@example.com/);
        expect(adminEmail.closest('div')).toHaveClass('text-brand-600');
      });
    });

    it('should style admin reason as italic', async () => {
      render(<AdminTransactionHistory />);

      await waitFor(() => {
        const adminReason = within(getDesktopTable()).getByText('Loyalty bonus for frequent guest');
        expect(adminReason).toHaveClass('italic');
      });
    });
  });

  describe('Empty State', () => {
    it('should display empty state when no transactions', async () => {
      vi.mocked(loyaltyService.getAdminTransactions).mockResolvedValueOnce({
        transactions: [],
        total: 0,
      });

      render(<AdminTransactionHistory />);

      await waitFor(() => {
        expect(screen.getAllByText('No transactions yet').length).toBeGreaterThan(0);
      });
    });

    it('should not display pagination when no transactions', async () => {
      vi.mocked(loyaltyService.getAdminTransactions).mockResolvedValueOnce({
        transactions: [],
        total: 0,
      });

      render(<AdminTransactionHistory />);

      await waitFor(() => {
        expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Pagination Display', () => {
    it('should display pagination info when total exceeds 20', async () => {
      render(<AdminTransactionHistory />);

      await waitFor(() => {
        expect(screen.getByText(/Showing 20 of 23 transactions/)).toBeInTheDocument();
      });
    });

    it('should not display pagination info when total is 20 or less', async () => {
      vi.mocked(loyaltyService.getAdminTransactions).mockResolvedValueOnce({
        transactions: mockTransactions,
        total: 15,
      });

      render(<AdminTransactionHistory />);

      await waitFor(() => {
        expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
      });
    });

    it('should display correct total count', async () => {
      vi.mocked(loyaltyService.getAdminTransactions).mockResolvedValueOnce({
        transactions: mockTransactions,
        total: 50,
      });

      render(<AdminTransactionHistory />);

      await waitFor(() => {
        expect(screen.getByText(/50 transactions/)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network error', async () => {
      const error = new Error('Network error');
      vi.mocked(loyaltyService.getAdminTransactions).mockRejectedValueOnce(error);

      render(<AdminTransactionHistory />);

      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith('Error loading admin transactions:', error);
        expect(toast.error).toHaveBeenCalledWith('Network error');
      });
    });

    it('should not display transactions on error', async () => {
      vi.mocked(loyaltyService.getAdminTransactions).mockRejectedValueOnce(new Error('Network error'));

      render(<AdminTransactionHistory />);

      await waitFor(() => {
        expect(screen.queryByText('+500 pts')).not.toBeInTheDocument();
      });
    });

    it('should stop loading state on error', async () => {
      vi.mocked(loyaltyService.getAdminTransactions).mockRejectedValueOnce(new Error('Network error'));

      const { container } = render(<AdminTransactionHistory />);

      await waitFor(() => {
        expect(container.querySelector('[data-loading="true"]')).not.toBeInTheDocument();
      });
    });
  });

  describe('Transaction Formatting', () => {
    it('should handle zero points with earned_stay type', async () => {
      const baseTransaction = mockTransactions[0]!;
      const zeroPointsTransaction: AdminTransaction[] = [
        {
          id: baseTransaction.id,
          user_id: baseTransaction.user_id,
          description: baseTransaction.description,
          reference_id: baseTransaction.reference_id,
          admin_user_id: baseTransaction.admin_user_id,
          admin_reason: baseTransaction.admin_reason,
          admin_email: baseTransaction.admin_email,
          expires_at: baseTransaction.expires_at,
          created_at: baseTransaction.created_at,
          user_email: baseTransaction.user_email,
          user_membership_id: baseTransaction.user_membership_id,
          user_first_name: baseTransaction.user_first_name,
          user_last_name: baseTransaction.user_last_name,
          points: 0,
          type: 'earned_stay',
        },
      ];

      vi.mocked(loyaltyService.getAdminTransactions).mockResolvedValueOnce({
        transactions: zeroPointsTransaction,
        total: 1,
      });

      render(<AdminTransactionHistory />);

      await waitFor(() => {
        const points = within(getDesktopTable()).getByText('+0 pts');
        expect(points).toHaveAttribute('data-tone', 'success');
      });
    });

    it('should format dates with time', async () => {
      render(<AdminTransactionHistory />);

      await waitFor(() => {
        // Should display both date and time
        expect(within(getDesktopTable()).getByText(/15\/01\/2024, \d{2}:\d{2}/)).toBeInTheDocument();
      });
    });

    it('should display partial user names correctly', async () => {
      const baseTransaction = mockTransactions[0]!;
      const partialNameTransaction: AdminTransaction[] = [
        {
          id: baseTransaction.id,
          user_id: baseTransaction.user_id,
          points: baseTransaction.points,
          type: baseTransaction.type,
          description: baseTransaction.description,
          reference_id: baseTransaction.reference_id,
          admin_user_id: baseTransaction.admin_user_id,
          admin_reason: baseTransaction.admin_reason,
          admin_email: baseTransaction.admin_email,
          expires_at: baseTransaction.expires_at,
          created_at: baseTransaction.created_at,
          user_email: baseTransaction.user_email,
          user_membership_id: baseTransaction.user_membership_id,
          user_first_name: 'John',
          user_last_name: null,
        },
      ];

      vi.mocked(loyaltyService.getAdminTransactions).mockResolvedValueOnce({
        transactions: partialNameTransaction,
        total: 1,
      });

      render(<AdminTransactionHistory />);

      await waitFor(() => {
        expect(within(getDesktopTable()).getByText('John')).toBeInTheDocument();
      });
    });
  });

  describe('Translation Keys', () => {
    it('should use correct translation keys', async () => {
      render(<AdminTransactionHistory />);

      await waitFor(() => {
        expect(mockTranslate).toHaveBeenCalledWith('admin.loyalty.transactionHistory');
      });
    });

    it('should use translation for empty state', async () => {
      vi.mocked(loyaltyService.getAdminTransactions).mockResolvedValueOnce({
        transactions: [],
        total: 0,
      });

      render(<AdminTransactionHistory />);

      await waitFor(() => {
        expect(mockTranslate).toHaveBeenCalledWith('loyalty.noTransactions');
      });
    });

    it('should use translation for pagination', async () => {
      render(<AdminTransactionHistory />);

      await waitFor(() => {
        expect(mockTranslate).toHaveBeenCalledWith('common.showing');
        expect(mockTranslate).toHaveBeenCalledWith('common.of');
        expect(mockTranslate).toHaveBeenCalledWith('admin.loyalty.transactions');
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', async () => {
      render(<AdminTransactionHistory />);

      await waitFor(() => {
        const heading = screen.getByText('Transaction History');
        expect(heading.tagName).toBe('H4');
      });
    });

    it('should expose the transaction list as an accessible table', async () => {
      render(<AdminTransactionHistory />);

      await waitFor(() => {
        expect(screen.getByRole('table', { name: 'Transaction History' })).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle transactions with missing optional fields', async () => {
      const minimalTransaction: AdminTransaction[] = [
        {
          id: 'txn-min',
          user_id: 'user-min',
          points: 100,
          type: 'earned_stay',
          description: null,
          reference_id: null,
          admin_user_id: null,
          admin_reason: null,
          admin_email: undefined,
          expires_at: null,
          created_at: '2024-01-01T00:00:00Z',
          user_email: 'minimal@example.com',
          user_first_name: null,
          user_last_name: null,
          user_membership_id: null,
        },
      ];

      vi.mocked(loyaltyService.getAdminTransactions).mockResolvedValueOnce({
        transactions: minimalTransaction,
        total: 1,
      });

      render(<AdminTransactionHistory />);

      await waitFor(() => {
        expect(within(getDesktopTable()).getByText('minimal@example.com')).toBeInTheDocument();
      });
    });

    it('should handle very large point values', async () => {
      const baseTransaction = mockTransactions[0]!;
      const largePointsTransaction: AdminTransaction[] = [
        {
          id: baseTransaction.id,
          user_id: baseTransaction.user_id,
          type: baseTransaction.type,
          description: baseTransaction.description,
          reference_id: baseTransaction.reference_id,
          admin_user_id: baseTransaction.admin_user_id,
          admin_reason: baseTransaction.admin_reason,
          admin_email: baseTransaction.admin_email,
          expires_at: baseTransaction.expires_at,
          created_at: baseTransaction.created_at,
          user_email: baseTransaction.user_email,
          user_membership_id: baseTransaction.user_membership_id,
          user_first_name: baseTransaction.user_first_name,
          user_last_name: baseTransaction.user_last_name,
          points: 999999,
        },
      ];

      vi.mocked(loyaltyService.getAdminTransactions).mockResolvedValueOnce({
        transactions: largePointsTransaction,
        total: 1,
      });

      render(<AdminTransactionHistory />);

      await waitFor(() => {
        expect(within(getDesktopTable()).getByText('+999999 pts')).toBeInTheDocument();
      });
    });
  });
});
