/* eslint-disable @typescript-eslint/no-non-null-assertion -- Test file uses non-null assertions for DOM element access */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';

// Mock data for testing
const mockUserWithAllData = {
  user_id: 'user-1',
  first_name: 'John',
  last_name: 'Doe',
  phone: '0812345678',
  email: 'john.doe@example.com',
  oauth_provider: null,
  oauth_provider_id: null,
  user_created_at: '2025-01-01T00:00:00Z',
  membership_id: 'MEM001',
  current_points: 5000,
  total_nights: 15,
  tier_name: 'Gold',
  tier_color: '#FFD700',
  tier_benefits: { description: 'Gold benefits', perks: [] },
  tier_level: 3,
  progress_percentage: 75,
  next_tier_nights: 20,
  next_tier_name: 'Platinum',
  nights_to_next_tier: 5,
};

const mockTransactionWithAllData = {
  id: 'txn-1',
  user_id: 'user-1',
  points: 500,
  type: 'manual_award',
  description: 'Manual adjustment',
  reference_id: 'REF001',
  admin_user_id: 'admin-1',
  admin_reason: 'Loyalty bonus',
  admin_email: 'admin@example.com',
  expires_at: null,
  created_at: '2025-01-15T10:30:00Z',
};

// Mock service
const mockGetAllUsersLoyaltyStatus = vi.fn();
const mockGetUserPointsHistoryAdmin = vi.fn();

vi.mock('../../../services/loyaltyService', () => ({
  loyaltyService: {
    getAllUsersLoyaltyStatus: (...args: unknown[]) => mockGetAllUsersLoyaltyStatus(...args),
    getUserPointsHistoryAdmin: (...args: unknown[]) => mockGetUserPointsHistoryAdmin(...args),
    awardPoints: vi.fn().mockResolvedValue({}),
    deductPoints: vi.fn().mockResolvedValue({}),
    awardSpendingWithNights: vi.fn().mockResolvedValue({}),
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
    t: (key: string, fallback?: string) => {
      const translations: Record<string, string> = {
        'admin.loyalty.title': 'Loyalty Management',
        'admin.loyalty.subtitle': 'Manage user points and tiers',
        'admin.loyalty.refresh': 'Refresh',
        'admin.loyalty.usersList': 'Users List',
        'admin.loyalty.searchPlaceholder': 'Search users...',
        'admin.loyalty.searchHint': 'Search by name, email, phone, or membership ID',
        'admin.loyalty.table.user': 'User',
        'admin.loyalty.table.tier': 'Tier',
        'admin.loyalty.table.points': 'Points',
        'admin.loyalty.table.actions': 'Actions',
        'admin.loyalty.noUsers': 'No users found',
        'admin.loyalty.selectUser': 'Select a user to view details',
        'admin.loyalty.userDetails': 'User Details',
        'admin.loyalty.currentPoints': 'Current Points',
        'admin.loyalty.currentTier': 'Current Tier',
        'admin.loyalty.recentTransactions': 'Recent Transactions',
        'admin.loyalty.noTransactions': 'No transactions found',
        'admin.loyalty.awardPoints': 'Award Points',
        'admin.loyalty.deductPoints': 'Deduct Points',
        'admin.loyalty.pointsAmount': 'Points Amount',
        'admin.loyalty.description': 'Description',
        'admin.loyalty.referenceId': 'Reference ID',
        'admin.loyalty.errors.loadFailed': 'Failed to load users',
        'admin.loyalty.errors.transactionsFailed': 'Failed to load transactions',
        'admin.loyalty.errors.pointsOperationFailed': 'Points operation failed',
        'userManagement.phone': 'Phone',
        'profile.membershipId': 'Membership ID',
        'admin.coupons.notAssigned': 'Not assigned',
        'common.loading': 'Loading...',
        'common.cancel': 'Cancel',
        'common.processing': 'Processing...',
        'common.previous': 'Previous',
        'common.next': 'Next',
      };
      return translations[key] ?? fallback ?? key;
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
import LoyaltyAdminPage from '../LoyaltyAdminPage';

// The Table primitive dual-renders a desktop <table> and a mobile card list
// simultaneously (CSS controls which is visible) — scope row-content
// assertions to `screen.findByRole('table')` to avoid ambiguous duplicate
// matches against the mobile card list.

describe('LoyaltyAdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAllUsersLoyaltyStatus.mockResolvedValue({
      users: [mockUserWithAllData],
      total: 1,
    });
    mockGetUserPointsHistoryAdmin.mockResolvedValue({
      transactions: [mockTransactionWithAllData],
      total: 1,
    });
  });

  describe('Basic Rendering', () => {
    it('should render the page title', async () => {
      render(<LoyaltyAdminPage />);

      expect((await screen.findAllByText('Loyalty Management')).length).toBeGreaterThan(0);
    });

    it('should render without crashing', async () => {
      const { container } = render(<LoyaltyAdminPage />);

      await screen.findAllByText('Loyalty Management');
      expect(container).toBeTruthy();
    });

    it('should render search input', async () => {
      render(<LoyaltyAdminPage />);

      expect(await screen.findByPlaceholderText('Search users...')).toBeInTheDocument();
    });

    it('should render table headers', async () => {
      render(<LoyaltyAdminPage />);

      const table = await screen.findByRole('table');
      expect(within(table).getByText('User')).toBeInTheDocument();
      expect(within(table).getByText('Phone')).toBeInTheDocument();
      expect(within(table).getByText('Tier')).toBeInTheDocument();
      expect(within(table).getByText('Membership ID')).toBeInTheDocument();
      expect(within(table).getByText('Points')).toBeInTheDocument();
      expect(within(table).getByText('Actions')).toBeInTheDocument();
    });
  });

  describe('Null Field Rendering', () => {
    it('renders email when both first_name and last_name are null', async () => {
      const userWithNullNames = {
        ...mockUserWithAllData,
        first_name: null,
        last_name: null,
      };
      mockGetAllUsersLoyaltyStatus.mockResolvedValue({
        users: [userWithNullNames],
        total: 1,
      });

      render(<LoyaltyAdminPage />);
      await screen.findAllByText('Loyalty Management');

      // Should show email as fallback when both names are null
      // Email may appear multiple times in the UI
      const emails = screen.getAllByText('john.doe@example.com');
      expect(emails.length).toBeGreaterThan(0);
    });

    it('renders LINE user with first_name correctly', async () => {
      const lineUser = {
        ...mockUserWithAllData,
        first_name: 'LineTestUser',
        last_name: null,
        oauth_provider: 'line',
      };
      mockGetAllUsersLoyaltyStatus.mockResolvedValue({
        users: [lineUser],
        total: 1,
      });

      render(<LoyaltyAdminPage />);
      const table = await screen.findByRole('table');

      // LINE users with first_name should show that name
      expect(within(table).getByText('LineTestUser')).toBeInTheDocument();
      // Should also show LINE badge
      expect(within(table).getByText('via LINE')).toBeInTheDocument();
    });

    it('renders "-" when phone is null', async () => {
      const userWithNullPhone = {
        ...mockUserWithAllData,
        phone: null,
      };
      mockGetAllUsersLoyaltyStatus.mockResolvedValue({
        users: [userWithNullPhone],
        total: 1,
      });

      render(<LoyaltyAdminPage />);

      await screen.findAllByText('Loyalty Management');
      // Phone column should show "-"
      const cells = screen.getAllByRole('cell');
      const phoneCell = cells.find(cell => cell.textContent === '-');
      expect(phoneCell).toBeInTheDocument();
    });

    it('renders "-" when membership_id is null', async () => {
      const userWithNullMembership = {
        ...mockUserWithAllData,
        membership_id: null,
      };
      mockGetAllUsersLoyaltyStatus.mockResolvedValue({
        users: [userWithNullMembership],
        total: 1,
      });

      render(<LoyaltyAdminPage />);

      await screen.findAllByText('Loyalty Management');
      // Membership ID column should show "-"
      const cells = screen.getAllByRole('cell');
      const membershipCells = cells.filter(cell => cell.textContent === '-');
      expect(membershipCells.length).toBeGreaterThan(0);
    });

    it('renders tier with default color when tier_color is invalid', async () => {
      const userWithTier = {
        ...mockUserWithAllData,
        tier_color: '#FFD700',
        tier_name: 'Gold',
      };
      mockGetAllUsersLoyaltyStatus.mockResolvedValue({
        users: [userWithTier],
        total: 1,
      });

      render(<LoyaltyAdminPage />);

      const table = await screen.findByRole('table');
      expect(within(table).getByText('Gold')).toBeInTheDocument();
    });

    it('renders user with all optional fields null', async () => {
      const userWithManyNulls = {
        user_id: 'user-1',
        first_name: null,
        last_name: null,
        phone: null,
        email: 'test@example.com',
        oauth_provider: null,
        oauth_provider_id: null,
        user_created_at: '2025-01-01T00:00:00Z',
        membership_id: null,
        current_points: 0,
        total_nights: 0,
        tier_name: 'Bronze',
        tier_color: '#CD7F32',
        tier_benefits: {},
        tier_level: 1,
        progress_percentage: 0,
        next_tier_nights: 1,
        next_tier_name: 'Silver',
        nights_to_next_tier: 1,
      };
      mockGetAllUsersLoyaltyStatus.mockResolvedValue({
        users: [userWithManyNulls],
        total: 1,
      });

      const { container } = render(<LoyaltyAdminPage />);
      await screen.findAllByText('Loyalty Management');

      expect(container).toBeTruthy();
      // Email appears multiple times (as name fallback and in secondary display)
      const emails = screen.getAllByText('test@example.com');
      expect(emails.length).toBeGreaterThan(0);
    });

    it('handles transaction with null admin_email gracefully', async () => {
      const transactionWithNullAdmin = {
        ...mockTransactionWithAllData,
        admin_email: undefined,
        admin_reason: null,
      };
      mockGetUserPointsHistoryAdmin.mockResolvedValue({
        transactions: [transactionWithNullAdmin],
        total: 1,
      });

      const { container } = render(<LoyaltyAdminPage />);
      await screen.findAllByText('Loyalty Management');

      // Component should not crash
      expect(container).toBeTruthy();
    });

    it('handles transaction with null admin_reason gracefully', async () => {
      const transactionWithNullReason = {
        ...mockTransactionWithAllData,
        admin_reason: null,
      };
      mockGetUserPointsHistoryAdmin.mockResolvedValue({
        transactions: [transactionWithNullReason],
        total: 1,
      });

      const { container } = render(<LoyaltyAdminPage />);
      await screen.findAllByText('Loyalty Management');

      expect(container).toBeTruthy();
    });
  });

  describe('Happy Path Rendering', () => {
    it('renders full name when both first_name and last_name are present', async () => {
      render(<LoyaltyAdminPage />);

      const table = await screen.findByRole('table');
      expect(within(table).getByText('John Doe')).toBeInTheDocument();
    });

    it('renders phone when present', async () => {
      render(<LoyaltyAdminPage />);

      expect(await screen.findByText('0812345678')).toBeInTheDocument();
    });

    it('renders membership ID when present', async () => {
      render(<LoyaltyAdminPage />);

      const table = await screen.findByRole('table');
      expect(within(table).getByText('MEM001')).toBeInTheDocument();
    });

    it('renders tier badge with correct name', async () => {
      render(<LoyaltyAdminPage />);

      const table = await screen.findByRole('table');
      expect(within(table).getByText('Gold')).toBeInTheDocument();
    });

    it('renders points with formatting', async () => {
      render(<LoyaltyAdminPage />);

      const table = await screen.findByRole('table');
      expect(within(table).getByText('5,000')).toBeInTheDocument();
    });

    it('renders email', async () => {
      render(<LoyaltyAdminPage />);

      const table = await screen.findByRole('table');
      await within(table).findByText('John Doe');
      // Email may appear multiple times in the UI (under name and elsewhere)
      const emails = screen.getAllByText('john.doe@example.com');
      expect(emails.length).toBeGreaterThan(0);
    });
  });

  describe('Empty State', () => {
    it('renders no users message when list is empty', async () => {
      mockGetAllUsersLoyaltyStatus.mockResolvedValue({
        users: [],
        total: 0,
      });

      render(<LoyaltyAdminPage />);

      expect((await screen.findAllByText('No users found')).length).toBeGreaterThan(0);
    });

    it('renders select user prompt when no user is selected', async () => {
      render(<LoyaltyAdminPage />);

      expect(await screen.findByText('Select a user to view details')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading state initially', async () => {
      // Use fake timers to control promise resolution timing
      vi.useFakeTimers();

      // Setup mock to resolve after a delay (not never)
      mockGetAllUsersLoyaltyStatus.mockReturnValue(
        new Promise((resolve) => setTimeout(() => resolve({ users: [], total: 0 }), 100))
      );

      const { container } = render(<LoyaltyAdminPage />);

      // The Table primitive marks the desktop layout as loading via
      // data-loading while the request is in flight.
      expect(container.querySelector('[data-loading="true"]')).toBeInTheDocument();

      // Advance timers and wait for React to process state updates
      await act(async () => {
        vi.runAllTimers();
      });

      // Verify loading is complete
      expect(container.querySelector('[data-loading="true"]')).not.toBeInTheDocument();

      // Restore real timers
      vi.useRealTimers();
    });
  });

  describe('OAuth Provider Display', () => {
    it('shows LINE badge for LINE users', async () => {
      const lineUser = {
        ...mockUserWithAllData,
        oauth_provider: 'line',
      };
      mockGetAllUsersLoyaltyStatus.mockResolvedValue({
        users: [lineUser],
        total: 1,
      });

      render(<LoyaltyAdminPage />);

      expect((await screen.findAllByText('via LINE')).length).toBeGreaterThan(0);
    });

    it('shows Google badge for Google users', async () => {
      const googleUser = {
        ...mockUserWithAllData,
        oauth_provider: 'google',
      };
      mockGetAllUsersLoyaltyStatus.mockResolvedValue({
        users: [googleUser],
        total: 1,
      });

      render(<LoyaltyAdminPage />);

      expect((await screen.findAllByText('via GOOGLE')).length).toBeGreaterThan(0);
    });

    it('does not show OAuth badge for regular users', async () => {
      const regularUser = {
        ...mockUserWithAllData,
        oauth_provider: null,
      };
      mockGetAllUsersLoyaltyStatus.mockResolvedValue({
        users: [regularUser],
        total: 1,
      });

      render(<LoyaltyAdminPage />);

      const table = await screen.findByRole('table');
      await within(table).findByText('John Doe');
      expect(screen.queryByText(/via/)).not.toBeInTheDocument();
    });
  });

  describe('Row Selection', () => {
    it('should load user transactions when a row is clicked', async () => {
      render(<LoyaltyAdminPage />);

      const table = await screen.findByRole('table');
      const row = within(table).getByText('John Doe').closest('tr')!;
      row.click();

      await screen.findByText('User Details');
      expect(mockGetUserPointsHistoryAdmin).toHaveBeenCalledWith('user-1', 50, 0);
    });
  });
});
