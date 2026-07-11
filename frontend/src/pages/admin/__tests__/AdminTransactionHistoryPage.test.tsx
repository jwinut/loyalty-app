import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';

// Mock data for testing
const mockTransactionWithAllData = {
  id: 'txn-1',
  user_id: 'user-1',
  user_membership_id: 'MEM001',
  user_first_name: 'John',
  user_last_name: 'Doe',
  user_email: 'john.doe@example.com',
  nights_stayed: 5,
  points: 500,
  admin_user_id: 'admin-1',
  admin_first_name: 'Admin',
  admin_last_name: 'User',
  admin_membership_id: 'ADMIN001',
  admin_reason: 'Manual adjustment',
  created_at: '2025-01-15T10:30:00Z',
};

// Mock service
const mockGetAdminTransactions = vi.fn();

vi.mock('../../../services/loyaltyService', () => ({
  loyaltyService: {
    getAdminTransactions: (...args: unknown[]) => mockGetAdminTransactions(...args),
  },
}));

// Mock toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock logger
vi.mock('../../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'admin.loyalty.transactionHistory': 'Transaction History',
        'admin.loyalty.noTransactions': 'No transactions found',
        'admin.loyalty.transactions': 'transactions',
        'common.showing': 'Showing',
        'common.of': 'of',
        'profile.loading': 'Loading...',
        'errors.networkError': 'Network error',
      };
      return translations[key] ?? key;
    },
  }),
}));

// Mock AppShell — its own AdminTopBar/AdminNavRail behavior is covered by
// AppShell's/AdminTopBar's dedicated test suites.
vi.mock('../../../components/layout/AppShell', () => ({
  default: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div data-testid="app-shell">
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

// Import component after mocks
import AdminTransactionHistoryPage from '../AdminTransactionHistoryPage';

// The Table primitive dual-renders a desktop <table> and a mobile card list
// simultaneously (CSS controls which is visible) — scope row-content
// assertions to the desktop table to avoid ambiguous duplicate matches.
function getDesktopTable() {
  return screen.getByRole('table');
}

describe('AdminTransactionHistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAdminTransactions.mockResolvedValue({
      transactions: [mockTransactionWithAllData],
      total: 1,
    });
  });

  describe('Basic Rendering', () => {
    it('should render the page title', async () => {
      render(<AdminTransactionHistoryPage />);

      expect(await screen.findByText('Transaction History')).toBeInTheDocument();
    });

    it('should render without crashing', async () => {
      const { container } = render(<AdminTransactionHistoryPage />);

      await screen.findByText('Transaction History');
      expect(container).toBeTruthy();
    });

    it('should render table headers', async () => {
      render(<AdminTransactionHistoryPage />);

      const table = await screen.findByRole('table');
      expect(within(table).getByText('User Membership ID')).toBeInTheDocument();
      expect(within(table).getByText('User Name')).toBeInTheDocument();
      expect(within(table).getByText('User Email')).toBeInTheDocument();
      expect(within(table).getByText('Night Change')).toBeInTheDocument();
      expect(within(table).getByText('Point Change')).toBeInTheDocument();
      expect(within(table).getByText('Admin Name')).toBeInTheDocument();
      expect(within(table).getByText('Admin Membership ID')).toBeInTheDocument();
    });
  });

  describe('Null Field Rendering', () => {
    it('renders "-" when user_first_name and user_last_name are null', async () => {
      const transactionWithNullUserNames = {
        ...mockTransactionWithAllData,
        user_first_name: null,
        user_last_name: null,
      };
      mockGetAdminTransactions.mockResolvedValue({
        transactions: [transactionWithNullUserNames],
        total: 1,
      });

      render(<AdminTransactionHistoryPage />);

      await screen.findByText('Transaction History');
      // formatName returns '-' when both are null
      const cells = screen.getAllByRole('cell');
      const userNameCells = cells.filter(cell => cell.textContent === '-');
      expect(userNameCells.length).toBeGreaterThan(0);
    });

    it('renders user name when only first name is available', async () => {
      const transactionWithOnlyFirstName = {
        ...mockTransactionWithAllData,
        user_first_name: 'John',
        user_last_name: null,
      };
      mockGetAdminTransactions.mockResolvedValue({
        transactions: [transactionWithOnlyFirstName],
        total: 1,
      });

      render(<AdminTransactionHistoryPage />);

      const table = await screen.findByRole('table');
      expect(within(table).getByText('John')).toBeInTheDocument();
    });

    it('renders user name when only last name is available', async () => {
      const transactionWithOnlyLastName = {
        ...mockTransactionWithAllData,
        user_first_name: null,
        user_last_name: 'Doe',
      };
      mockGetAdminTransactions.mockResolvedValue({
        transactions: [transactionWithOnlyLastName],
        total: 1,
      });

      render(<AdminTransactionHistoryPage />);

      const table = await screen.findByRole('table');
      expect(within(table).getByText('Doe')).toBeInTheDocument();
    });

    it('renders "-" when user_membership_id is null', async () => {
      const transactionWithNullMembership = {
        ...mockTransactionWithAllData,
        user_membership_id: null,
      };
      mockGetAdminTransactions.mockResolvedValue({
        transactions: [transactionWithNullMembership],
        total: 1,
      });

      render(<AdminTransactionHistoryPage />);

      await screen.findByText('Transaction History');
      const cells = screen.getAllByRole('cell');
      const membershipCells = cells.filter(cell => cell.textContent === '-');
      expect(membershipCells.length).toBeGreaterThan(0);
    });

    it('renders "-" when user_email is null', async () => {
      const transactionWithNullEmail = {
        ...mockTransactionWithAllData,
        user_email: null,
      };
      mockGetAdminTransactions.mockResolvedValue({
        transactions: [transactionWithNullEmail],
        total: 1,
      });

      render(<AdminTransactionHistoryPage />);

      await screen.findByText('Transaction History');
      const cells = screen.getAllByRole('cell');
      const emailCells = cells.filter(cell => cell.textContent === '-');
      expect(emailCells.length).toBeGreaterThan(0);
    });

    it('renders "-" when admin_first_name and admin_last_name are null', async () => {
      const transactionWithNullAdminNames = {
        ...mockTransactionWithAllData,
        admin_first_name: null,
        admin_last_name: null,
      };
      mockGetAdminTransactions.mockResolvedValue({
        transactions: [transactionWithNullAdminNames],
        total: 1,
      });

      render(<AdminTransactionHistoryPage />);

      await screen.findByText('Transaction History');
      // Both user name and admin name columns should show '-' when null
      const cells = screen.getAllByRole('cell');
      const dashCells = cells.filter(cell => cell.textContent === '-');
      expect(dashCells.length).toBeGreaterThanOrEqual(1);
    });

    it('renders "-" when admin_membership_id is null', async () => {
      const transactionWithNullAdminMembership = {
        ...mockTransactionWithAllData,
        admin_membership_id: null,
      };
      mockGetAdminTransactions.mockResolvedValue({
        transactions: [transactionWithNullAdminMembership],
        total: 1,
      });

      render(<AdminTransactionHistoryPage />);

      await screen.findByText('Transaction History');
      const cells = screen.getAllByRole('cell');
      const dashCells = cells.filter(cell => cell.textContent === '-');
      expect(dashCells.length).toBeGreaterThan(0);
    });

    it('renders "-" when nights_stayed is null', async () => {
      const transactionWithNullNights = {
        ...mockTransactionWithAllData,
        nights_stayed: null,
      };
      mockGetAdminTransactions.mockResolvedValue({
        transactions: [transactionWithNullNights],
        total: 1,
      });

      render(<AdminTransactionHistoryPage />);

      await screen.findByText('Transaction History');
      // formatChange returns '-' for null/undefined/0
      const cells = screen.getAllByRole('cell');
      const dashCells = cells.filter(cell => cell.textContent === '-');
      expect(dashCells.length).toBeGreaterThan(0);
    });

    it('renders "-" when nights_stayed is 0', async () => {
      const transactionWithZeroNights = {
        ...mockTransactionWithAllData,
        nights_stayed: 0,
      };
      mockGetAdminTransactions.mockResolvedValue({
        transactions: [transactionWithZeroNights],
        total: 1,
      });

      render(<AdminTransactionHistoryPage />);

      await screen.findByText('Transaction History');
      // formatChange returns '-' for 0
      const cells = screen.getAllByRole('cell');
      const dashCells = cells.filter(cell => cell.textContent === '-');
      expect(dashCells.length).toBeGreaterThan(0);
    });

    it('renders transaction with all nullable fields null', async () => {
      const transactionWithManyNulls = {
        id: 'txn-1',
        user_id: 'user-1',
        user_membership_id: null,
        user_first_name: null,
        user_last_name: null,
        user_email: null,
        nights_stayed: null,
        points: 0,
        admin_user_id: null,
        admin_first_name: null,
        admin_last_name: null,
        admin_membership_id: null,
        admin_reason: null,
        created_at: '2025-01-15T10:30:00Z',
      };
      mockGetAdminTransactions.mockResolvedValue({
        transactions: [transactionWithManyNulls],
        total: 1,
      });

      // Should not crash
      const { container } = render(<AdminTransactionHistoryPage />);
      await screen.findByText('Transaction History');

      expect(container).toBeTruthy();
      // Multiple cells should show "-"
      const cells = screen.getAllByRole('cell');
      const dashCells = cells.filter(cell => cell.textContent === '-');
      expect(dashCells.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Happy Path Rendering', () => {
    it('renders full user name when both firstName and lastName are present', async () => {
      render(<AdminTransactionHistoryPage />);

      const table = await screen.findByRole('table');
      expect(within(table).getByText('John Doe')).toBeInTheDocument();
    });

    it('renders user email', async () => {
      render(<AdminTransactionHistoryPage />);

      const table = await screen.findByRole('table');
      expect(within(table).getByText('john.doe@example.com')).toBeInTheDocument();
    });

    it('renders user membership ID when present', async () => {
      render(<AdminTransactionHistoryPage />);

      const table = await screen.findByRole('table');
      expect(within(table).getByText('MEM001')).toBeInTheDocument();
    });

    it('renders admin name when present', async () => {
      render(<AdminTransactionHistoryPage />);

      const table = await screen.findByRole('table');
      expect(within(table).getByText('Admin User')).toBeInTheDocument();
    });

    it('renders positive point change with + sign', async () => {
      render(<AdminTransactionHistoryPage />);

      const table = await screen.findByRole('table');
      expect(within(table).getByText('+500')).toBeInTheDocument();
    });

    it('renders positive night change with + sign', async () => {
      render(<AdminTransactionHistoryPage />);

      const table = await screen.findByRole('table');
      expect(within(table).getByText('+5')).toBeInTheDocument();
    });

    it('renders negative point change', async () => {
      const transactionWithNegativePoints = {
        ...mockTransactionWithAllData,
        points: -200,
      };
      mockGetAdminTransactions.mockResolvedValue({
        transactions: [transactionWithNegativePoints],
        total: 1,
      });

      render(<AdminTransactionHistoryPage />);

      const table = await screen.findByRole('table');
      expect(within(table).getByText('-200')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('renders no transactions message when list is empty', async () => {
      mockGetAdminTransactions.mockResolvedValue({
        transactions: [],
        total: 0,
      });

      render(<AdminTransactionHistoryPage />);

      // The Table primitive renders the empty message in both the desktop
      // and mobile layouts simultaneously.
      await screen.findByText('Transaction History');
      expect(screen.getAllByText('No transactions found').length).toBeGreaterThan(0);
    });
  });

  describe('Loading State', () => {
    it('shows loading state initially', async () => {
      // Create a deferred promise we can control
      let resolvePromise: (value: { transactions: never[]; total: number }) => void;
      const deferredPromise = new Promise<{ transactions: never[]; total: number }>((resolve) => {
        resolvePromise = resolve;
      });

      mockGetAdminTransactions.mockReturnValue(deferredPromise);

      render(<AdminTransactionHistoryPage />);

      // The Table primitive renders skeleton placeholders while loading.
      const desktopView = getDesktopTable().closest('[data-view="desktop"]');
      expect(desktopView?.parentElement).toHaveAttribute('data-loading', 'true');

      // Resolve the promise and let React update
      await act(async () => {
        resolvePromise!({ transactions: [], total: 0 });
      });

      // Verify loading state is gone after data loads
      expect(desktopView?.parentElement).not.toHaveAttribute('data-loading');
    });
  });
});
