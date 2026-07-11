/* eslint-disable @typescript-eslint/no-non-null-assertion -- Test file uses non-null assertions for DOM element access */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CouponAssignmentsModal from '../CouponAssignmentsModal';
import { couponService } from '../../../services/couponService';
import { Coupon } from '../../../types/coupon';
import { logger } from '../../../utils/logger';

// Mock dependencies
const mockTranslate = vi.fn((key: string, fallback?: string) => {
  const translations: Record<string, string> = {
    'errors.failedToLoadAssignments': 'Failed to load assignments',
    'errors.failedToRemoveCoupons': 'Failed to remove user coupons',
    'common.close': 'Close',
  };
  return translations[key] ?? fallback ?? key;
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: mockTranslate,
  }),
}));

vi.mock('../../../services/couponService', () => ({
  couponService: {
    getCouponAssignments: vi.fn(),
    revokeUserCouponsForCoupon: vi.fn(),
  },
}));

vi.mock('../../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock('../../../utils/dateFormatter', () => ({
  formatDateToDDMMYYYY: vi.fn((date: Date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }),
}));

// Modal portals its content to document.body, outside the RTL render
// container — scope assertions with `screen` (which queries document.body)
// rather than the `container` returned by `render()`.
function getDialog() {
  return screen.getByRole('dialog');
}

// The Table primitive dual-renders a desktop <table> and a mobile card list
// simultaneously (CSS controls which is visible) — scope row-content
// assertions to the desktop table to avoid ambiguous duplicate matches.
function getDesktopTable() {
  return screen.getByRole('table');
}

function getSummarySection() {
  return screen.getByTestId('assignment-summary');
}

describe('CouponAssignmentsModal', () => {
  const mockCoupon: Coupon = {
    id: 'coupon-1',
    code: 'SAVE20',
    name: '20% Off Coupon',
    description: 'Get 20% off your purchase',
    termsAndConditions: 'Valid on purchases over 1000 THB',
    type: 'percentage',
    value: 20,
    currency: 'THB',
    minimumSpend: 1000,
    maximumDiscount: 500,
    validFrom: '2024-01-01T00:00:00Z',
    validUntil: '2024-12-31T23:59:59Z',
    usageLimit: 1000,
    usageLimitPerUser: 3,
    usedCount: 150,
    tierRestrictions: [],
    customerSegment: {},
    status: 'active',
    createdBy: 'admin-1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  const mockAssignments = [
    {
      userId: 'user-1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      assignedCount: 3,
      usedCount: 1,
      availableCount: 2,
      latestAssignment: new Date('2024-01-15T10:30:00Z'),
    },
    {
      userId: 'user-2',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
      assignedCount: 2,
      usedCount: 2,
      availableCount: 0,
      latestAssignment: new Date('2024-01-10T14:20:00Z'),
    },
    {
      userId: 'user-3',
      firstName: 'Bob',
      lastName: 'Johnson',
      email: 'bob.johnson@example.com',
      assignedCount: 5,
      usedCount: 2,
      availableCount: 3,
      latestAssignment: new Date('2024-01-20T09:15:00Z'),
    },
  ];

  const mockSummary = {
    totalUsers: 3,
    totalAssigned: 10,
    totalUsed: 5,
    totalAvailable: 5,
  };

  const mockAssignmentsResponse = {
    assignments: mockAssignments,
    summary: mockSummary,
    page: 1,
    limit: 10,
    totalPages: 1,
    total: 3,
  };

  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementation
    vi.mocked(couponService.getCouponAssignments).mockResolvedValue(mockAssignmentsResponse);
    vi.mocked(couponService.revokeUserCouponsForCoupon).mockResolvedValue({
      success: true,
      message: 'Coupons revoked successfully',
      revokedCount: 1,
    });
  });

  describe('Basic Rendering', () => {
    it('should render the modal when open', async () => {
      render(<CouponAssignmentsModal coupon={mockCoupon} isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('Coupon Assignments')).toBeInTheDocument();
      });
    });

    it('should render without crashing', async () => {
      const { container } = render(
        <CouponAssignmentsModal coupon={mockCoupon} isOpen={true} onClose={onClose} />
      );

      await waitFor(() => {
        expect(container).toBeTruthy();
      });
    });

    it('should display coupon name and code in header', async () => {
      render(<CouponAssignmentsModal coupon={mockCoupon} isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText(/20% Off Coupon/)).toBeInTheDocument();
        expect(screen.getByText(/SAVE20/)).toBeInTheDocument();
      });
    });

    it('should render an accessible dialog', async () => {
      render(<CouponAssignmentsModal coupon={mockCoupon} isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(getDialog()).toBeInTheDocument();
      });
    });

    it('should render nothing when closed', () => {
      render(<CouponAssignmentsModal coupon={mockCoupon} isOpen={false} onClose={onClose} />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should display loading spinner initially', async () => {
      render(<CouponAssignmentsModal coupon={mockCoupon} isOpen={true} onClose={onClose} />);

      expect(screen.getByText('Loading assignments...')).toBeInTheDocument();
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();

      // Wait for async operations to complete to avoid act() warnings
      await waitFor(() => {
        expect(screen.queryByText('Loading assignments...')).not.toBeInTheDocument();
      });
    });

    it('should hide loading state after data loads', async () => {
      render(<CouponAssignmentsModal coupon={mockCoupon} isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.queryByText('Loading assignments...')).not.toBeInTheDocument();
      });
    });

    it('should load assignments on mount', async () => {
      render(<CouponAssignmentsModal coupon={mockCoupon} isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(couponService.getCouponAssignments).toHaveBeenCalledWith('coupon-1', 1, 10);
      });
    });
  });

  describe('Assignment List Display', () => {
    it('should display all assignments', async () => {
      render(<CouponAssignmentsModal coupon={mockCoupon} isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        const table = getDesktopTable();
        expect(within(table).getByText('John Doe')).toBeInTheDocument();
        expect(within(table).getByText('Jane Smith')).toBeInTheDocument();
        expect(within(table).getByText('Bob Johnson')).toBeInTheDocument();
      });
    });

    it('should display user emails', async () => {
      render(<CouponAssignmentsModal coupon={mockCoupon} isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        const table = getDesktopTable();
        expect(within(table).getByText('john.doe@example.com')).toBeInTheDocument();
        expect(within(table).getByText('jane.smith@example.com')).toBeInTheDocument();
        expect(within(table).getByText('bob.johnson@example.com')).toBeInTheDocument();
      });
    });

    it('should display assigned, used, and available counts', async () => {
      render(<CouponAssignmentsModal coupon={mockCoupon} isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        const table = getDesktopTable();
        const johnRow = within(table).getByText('John Doe').closest('tr')!;
        expect(within(johnRow).getByText('3')).toBeInTheDocument(); // assigned
        expect(within(johnRow).getByText('1')).toBeInTheDocument(); // used
        expect(within(johnRow).getByText('2')).toBeInTheDocument(); // available
      });
    });

    it('should display assignment dates', async () => {
      render(<CouponAssignmentsModal coupon={mockCoupon} isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        const table = getDesktopTable();
        expect(within(table).getByText('15/01/2024')).toBeInTheDocument();
        expect(within(table).getByText('10/01/2024')).toBeInTheDocument();
        expect(within(table).getByText('20/01/2024')).toBeInTheDocument();
      });
    });
  });

  describe('Summary Statistics', () => {
    it('should display total users', async () => {
      render(<CouponAssignmentsModal coupon={mockCoupon} isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        const summary = getSummarySection();
        expect(within(summary).getByText('Total Users')).toBeInTheDocument();
        const totalUsersSection = within(summary).getByText('Total Users').parentElement;
        expect(totalUsersSection).toHaveTextContent('3');
        expect(totalUsersSection).toHaveTextContent('Total Users');
      });
    });

    it('should display total assigned', async () => {
      render(<CouponAssignmentsModal coupon={mockCoupon} isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        const summary = getSummarySection();
        expect(within(summary).getByText('10')).toBeInTheDocument();
        expect(within(summary).getByText('Total Assigned')).toBeInTheDocument();
      });
    });

    it('should display total used', async () => {
      render(<CouponAssignmentsModal coupon={mockCoupon} isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        const summary = getSummarySection();
        const usedLabel = within(summary).getByText('Used');
        const usedSection = usedLabel.parentElement;
        expect(usedSection).toHaveTextContent('5');
        expect(usedSection).toHaveTextContent('Used');
      });
    });

    it('should display total available', async () => {
      render(<CouponAssignmentsModal coupon={mockCoupon} isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        const summary = getSummarySection();
        const availableLabel = within(summary).getByText('Available');
        const availableSection = availableLabel.parentElement;
        expect(availableSection).toHaveTextContent('5');
        expect(availableSection).toHaveTextContent('Available');
      });
    });
  });

  describe('Status Badges', () => {
    it('should display "Available" badge for unused coupons', async () => {
      // Mock with a user who has not used any coupons
      vi.mocked(couponService.getCouponAssignments).mockResolvedValueOnce({
        assignments: [{
          userId: 'user-4',
          firstName: 'Alice',
          lastName: 'Green',
          email: 'alice@example.com',
          assignedCount: 1,
          usedCount: 0,
          availableCount: 1,
          latestAssignment: new Date('2024-01-25T10:00:00Z'),
        }],
        summary: mockSummary,
        page: 1,
        limit: 10,
        totalPages: 1,
        total: 1,
      });

      render(<CouponAssignmentsModal coupon={mockCoupon} isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        const tbody = getDesktopTable().querySelector('tbody')!;
        const availableBadge = within(tbody).getByText('Available');
        expect(availableBadge).toHaveAttribute('data-tone', 'success');
      });
    });

    it('should display "All Used" badge when no coupons available', async () => {
      render(<CouponAssignmentsModal coupon={mockCoupon} isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        const badge = within(getDesktopTable()).getByText('All Used');
        expect(badge).toHaveAttribute('data-tone', 'neutral');
      });
    });

    it('should display "Partially Used" badge when some coupons used', async () => {
      render(<CouponAssignmentsModal coupon={mockCoupon} isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        // Users 1 and 3 have both used and available coupons, so both show
        // Partially Used.
        const badges = within(getDesktopTable()).getAllByText('Partially Used');
        expect(badges.length).toBeGreaterThan(0);
        badges.forEach((badge) => expect(badge).toHaveAttribute('data-tone', 'warning'));
      });
    });
  });

  describe('Modal Open/Close', () => {
    it('should call onClose when close button clicked', async () => {
      const user = userEvent.setup();
      render(<CouponAssignmentsModal coupon={mockCoupon} isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('Coupon Assignments')).toBeInTheDocument();
      });

      const closeButton = screen.getByRole('button', { name: 'Close' });
      await user.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should display an accessible close button', async () => {
      render(<CouponAssignmentsModal coupon={mockCoupon} isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should display empty state when no assignments', async () => {
      vi.mocked(couponService.getCouponAssignments).mockResolvedValueOnce({
        assignments: [],
        summary: {
          totalUsers: 0,
          totalAssigned: 0,
          totalUsed: 0,
          totalAvailable: 0,
        },
        page: 1,
        limit: 10,
        totalPages: 0,
        total: 0,
      });

      render(<CouponAssignmentsModal coupon={mockCoupon} isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('No users have been assigned this coupon yet.')).toBeInTheDocument();
      });
    });

    it('should not display table when no assignments', async () => {
      vi.mocked(couponService.getCouponAssignments).mockResolvedValueOnce({
        assignments: [],
        summary: {
          totalUsers: 0,
          totalAssigned: 0,
          totalUsed: 0,
          totalAvailable: 0,
        },
        page: 1,
        limit: 10,
        totalPages: 0,
        total: 0,
      });

      render(<CouponAssignmentsModal coupon={mockCoupon} isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.queryByRole('table')).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message on load failure', async () => {
      const error = new Error('Network error');
      vi.mocked(couponService.getCouponAssignments).mockRejectedValueOnce(error);

      render(<CouponAssignmentsModal coupon={mockCoupon} isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load assignments')).toBeInTheDocument();
      });
    });

    it('should log error on load failure', async () => {
      const error = new Error('Network error');
      vi.mocked(couponService.getCouponAssignments).mockRejectedValueOnce(error);

      render(<CouponAssignmentsModal coupon={mockCoupon} isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith('Error loading coupon assignments:', error);
      });
    });

    it('should display retry button on error', async () => {
      vi.mocked(couponService.getCouponAssignments).mockRejectedValueOnce(new Error('Network error'));

      render(<CouponAssignmentsModal coupon={mockCoupon} isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('Try Again')).toBeInTheDocument();
      });
    });

    it('should retry loading on retry button click', async () => {
      const user = userEvent.setup();
      vi.mocked(couponService.getCouponAssignments)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockAssignmentsResponse);

      render(<CouponAssignmentsModal coupon={mockCoupon} isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('Try Again')).toBeInTheDocument();
      });

      const retryButton = screen.getByText('Try Again');
      await user.click(retryButton);

      await waitFor(() => {
        expect(within(getDesktopTable()).getByText('John Doe')).toBeInTheDocument();
      });
    });
  });

  describe('Pagination', () => {
    it('should display pagination when multiple pages', async () => {
      vi.mocked(couponService.getCouponAssignments).mockResolvedValueOnce({
        ...mockAssignmentsResponse,
        page: 1,
        totalPages: 3,
        total: 25,
      });

      render(<CouponAssignmentsModal coupon={mockCoupon} isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('Page 1 of 3 (25 users)')).toBeInTheDocument();
      });
    });

    it('should not display pagination when single page', async () => {
      render(<CouponAssignmentsModal coupon={mockCoupon} isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.queryByText('Previous')).not.toBeInTheDocument();
        expect(screen.queryByText('Next')).not.toBeInTheDocument();
      });
    });

    it('should display previous and next buttons', async () => {
      vi.mocked(couponService.getCouponAssignments).mockResolvedValueOnce({
        ...mockAssignmentsResponse,
        page: 2,
        totalPages: 3,
        total: 25,
      });

      render(<CouponAssignmentsModal coupon={mockCoupon} isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('Previous')).toBeInTheDocument();
        expect(screen.getByText('Next')).toBeInTheDocument();
      });
    });

    it('should disable previous button on first page', async () => {
      vi.mocked(couponService.getCouponAssignments).mockResolvedValueOnce({
        ...mockAssignmentsResponse,
        page: 1,
        totalPages: 3,
        total: 25,
      });

      render(<CouponAssignmentsModal coupon={mockCoupon} isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        const previousButton = screen.getByText('Previous');
        expect(previousButton).toBeDisabled();
      });
    });

    it('should disable next button on last page', async () => {
      vi.mocked(couponService.getCouponAssignments).mockResolvedValueOnce({
        ...mockAssignmentsResponse,
        page: 3,
        totalPages: 3,
        total: 25,
      });

      render(<CouponAssignmentsModal coupon={mockCoupon} isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        const nextButton = screen.getByText('Next');
        expect(nextButton).toBeDisabled();
      });
    });

    it('should load next page when next button clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(couponService.getCouponAssignments).mockResolvedValueOnce({
        ...mockAssignmentsResponse,
        page: 1,
        totalPages: 2,
        total: 15,
      });

      render(<CouponAssignmentsModal coupon={mockCoupon} isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('Next')).toBeInTheDocument();
      });

      const nextButton = screen.getByText('Next');
      await user.click(nextButton);

      await waitFor(() => {
        expect(couponService.getCouponAssignments).toHaveBeenCalledWith('coupon-1', 2, 10);
      });
    });

    it('should load previous page when previous button clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(couponService.getCouponAssignments).mockResolvedValueOnce({
        ...mockAssignmentsResponse,
        page: 2,
        totalPages: 2,
        total: 15,
      });

      render(<CouponAssignmentsModal coupon={mockCoupon} isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('Previous')).toBeInTheDocument();
      });

      const previousButton = screen.getByText('Previous');
      await user.click(previousButton);

      await waitFor(() => {
        expect(couponService.getCouponAssignments).toHaveBeenCalledWith('coupon-1', 1, 10);
      });
    });
  });

  describe('Remove Coupon Action', () => {
    it('should display remove button for users with available coupons', async () => {
      render(<CouponAssignmentsModal coupon={mockCoupon} isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        const removeButtons = within(getDesktopTable()).getAllByText('Remove');
        expect(removeButtons.length).toBeGreaterThan(0);
      });
    });

    it('should display "No coupons" for users with no available coupons', async () => {
      render(<CouponAssignmentsModal coupon={mockCoupon} isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(within(getDesktopTable()).getByText('No coupons')).toBeInTheDocument();
      });
    });

    it('should show confirmation dialog when remove clicked', async () => {
      const user = userEvent.setup();
      render(<CouponAssignmentsModal coupon={mockCoupon} isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(within(getDesktopTable()).getAllByText('Remove')[0]).toBeInTheDocument();
      });

      const removeButton = within(getDesktopTable()).getAllByText('Remove')[0]!;
      await user.click(removeButton);

      await waitFor(() => {
        expect(screen.getByText('Confirm Coupon Removal')).toBeInTheDocument();
      });
    });

    it('should display user name in confirmation dialog', async () => {
      const user = userEvent.setup();
      render(<CouponAssignmentsModal coupon={mockCoupon} isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(within(getDesktopTable()).getAllByText('Remove')[0]).toBeInTheDocument();
      });

      const removeButton = within(getDesktopTable()).getAllByText('Remove')[0]!;
      await user.click(removeButton);

      // The confirmation dialog and the assignments table are both open at
      // once (and John Doe's row is still visible behind it) — scope to the
      // confirmation dialog specifically.
      const confirmHeading = await screen.findByText('Confirm Coupon Removal');
      const confirmDialog = confirmHeading.closest('[role="dialog"]') as HTMLElement;
      expect(within(confirmDialog).getByText(/John Doe/)).toBeInTheDocument();
    });

    it('should display coupon count in confirmation dialog', async () => {
      const user = userEvent.setup();
      render(<CouponAssignmentsModal coupon={mockCoupon} isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(within(getDesktopTable()).getAllByText('Remove')[0]).toBeInTheDocument();
      });

      const removeButton = within(getDesktopTable()).getAllByText('Remove')[0]!;
      await user.click(removeButton);

      await waitFor(() => {
        expect(screen.getByText(/2 coupons/)).toBeInTheDocument();
      });
    });

    it('should close confirmation dialog when cancel clicked', async () => {
      const user = userEvent.setup();
      render(<CouponAssignmentsModal coupon={mockCoupon} isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(within(getDesktopTable()).getAllByText('Remove')[0]).toBeInTheDocument();
      });

      const removeButton = within(getDesktopTable()).getAllByText('Remove')[0]!;
      await user.click(removeButton);

      await waitFor(() => {
        expect(screen.getByText('Confirm Coupon Removal')).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText('Confirm Coupon Removal')).not.toBeInTheDocument();
      });
    });

    it('should call revokeUserCouponsForCoupon when confirmed', async () => {
      const user = userEvent.setup();
      render(<CouponAssignmentsModal coupon={mockCoupon} isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(within(getDesktopTable()).getAllByText('Remove')[0]).toBeInTheDocument();
      });

      const removeButton = within(getDesktopTable()).getAllByText('Remove')[0]!;
      await user.click(removeButton);

      const confirmButton = await screen.findByRole('button', { name: 'Remove Coupons' });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(couponService.revokeUserCouponsForCoupon).toHaveBeenCalledWith(
          'coupon-1',
          'user-1',
          'Removed by admin from assignment management'
        );
      });
    });

    it('should reload assignments after successful removal', async () => {
      const user = userEvent.setup();
      render(<CouponAssignmentsModal coupon={mockCoupon} isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(within(getDesktopTable()).getAllByText('Remove')[0]).toBeInTheDocument();
      });

      vi.clearAllMocks();

      const removeButton = within(getDesktopTable()).getAllByText('Remove')[0]!;
      await user.click(removeButton);

      const confirmButton = await screen.findByRole('button', { name: 'Remove Coupons' });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(couponService.getCouponAssignments).toHaveBeenCalledWith('coupon-1', 1, 10);
      });
    });

    it('should display removing state during removal', async () => {
      const user = userEvent.setup();
      vi.mocked(couponService.revokeUserCouponsForCoupon).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(<CouponAssignmentsModal coupon={mockCoupon} isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(within(getDesktopTable()).getAllByText('Remove')[0]).toBeInTheDocument();
      });

      const removeButton = within(getDesktopTable()).getAllByText('Remove')[0]!;
      await user.click(removeButton);

      const confirmButton = await screen.findByRole('button', { name: 'Remove Coupons' });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(within(getDesktopTable()).getByText('Removing...')).toBeInTheDocument();
      });
    });

    it('should handle removal error', async () => {
      const user = userEvent.setup();
      const error = new Error('Network error');
      vi.mocked(couponService.revokeUserCouponsForCoupon).mockRejectedValueOnce(error);

      render(<CouponAssignmentsModal coupon={mockCoupon} isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(within(getDesktopTable()).getAllByText('Remove')[0]).toBeInTheDocument();
      });

      const removeButton = within(getDesktopTable()).getAllByText('Remove')[0]!;
      await user.click(removeButton);

      const confirmButton = await screen.findByRole('button', { name: 'Remove Coupons' });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith('Error removing user coupons:', error);
      });
    });

    it('should disable remove button during removal', async () => {
      const user = userEvent.setup();
      vi.mocked(couponService.revokeUserCouponsForCoupon).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(<CouponAssignmentsModal coupon={mockCoupon} isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(within(getDesktopTable()).getAllByText('Remove')[0]).toBeInTheDocument();
      });

      const removeButton = within(getDesktopTable()).getAllByText('Remove')[0]!;
      await user.click(removeButton);

      const confirmButton = await screen.findByRole('button', { name: 'Remove Coupons' });
      await user.click(confirmButton);

      await waitFor(() => {
        const removingButton = within(getDesktopTable()).getByText('Removing...');
        expect(removingButton).toBeDisabled();
      });
    });
  });

  describe('Table Structure', () => {
    it('should have proper table headers', async () => {
      render(<CouponAssignmentsModal coupon={mockCoupon} isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        const table = getDesktopTable();
        expect(table).toBeInTheDocument();

        // Check for table headers within the table
        expect(within(table).getByText('User')).toBeInTheDocument();
        expect(within(table).getByText('Email')).toBeInTheDocument();
        expect(within(table).getByText('Assigned')).toBeInTheDocument();
        expect(within(table).getByText('Status')).toBeInTheDocument();
        expect(within(table).getByText('Latest Assignment')).toBeInTheDocument();
        expect(within(table).getByText('Actions')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible table', async () => {
      render(<CouponAssignmentsModal coupon={mockCoupon} isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });
    });

    it('should have accessible remove buttons', async () => {
      render(<CouponAssignmentsModal coupon={mockCoupon} isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        const removeButtons = within(getDesktopTable()).getAllByText('Remove');
        removeButtons.forEach(button => {
          expect(button.closest('button')).not.toBeNull();
        });
      });
    });

    it('should have proper heading hierarchy', async () => {
      render(<CouponAssignmentsModal coupon={mockCoupon} isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        const heading = screen.getByText('Coupon Assignments');
        expect(heading.tagName).toBe('H2');
      });
    });
  });
});
