import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CouponCard from '../CouponCard';
import { UserActiveCoupon } from '../../../types/coupon';
import { couponService } from '../../../services/couponService';
import * as dateFormatter from '../../../utils/dateFormatter';

// Mock dependencies
const mockTranslate = vi.fn((key: string, fallback?: string) => {
  const translations: Record<string, string> = {
    'coupons.expiringSoon': 'Expiring Soon',
    'coupons.useCoupon': 'Use Coupon',
    'coupons.viewDetails': 'View Details',
    'coupons.statuses.available': 'Available',
    'coupons.statuses.used': 'Used',
    'coupons.statuses.expired': 'Expired',
    'coupons.statuses.revoked': 'Revoked',
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
    getExpiryDate: vi.fn(),
    isExpiringSoon: vi.fn(),
    formatMinimumSpend: vi.fn(),
    formatCouponValue: vi.fn(),
  },
}));

vi.mock('../../../utils/dateFormatter', () => ({
  formatExpiryDateWithRelative: vi.fn(),
}));

describe('CouponCard', () => {
  const mockCoupon: UserActiveCoupon = {
    userCouponId: 'uc-1',
    userId: 'user-123',
    status: 'available',
    qrCode: 'QR123456',
    expiresAt: '2024-12-31T23:59:59Z',
    assignedAt: '2024-01-01T00:00:00Z',
    couponId: 'coupon-1',
    code: 'SAVE20',
    name: '20% Off Your Purchase',
    description: 'Get 20% discount on your next purchase',
    termsAndConditions: 'Valid on purchases over 1000 THB',
    type: 'percentage',
    value: 20,
    currency: 'THB',
    minimumSpend: 1000,
    maximumDiscount: 500,
    couponExpiresAt: '2024-12-31T23:59:59Z',
    effectiveExpiry: '2024-12-31T23:59:59Z',
    expiringSoon: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    vi.mocked(couponService.getExpiryDate).mockReturnValue(new Date('2024-12-31T23:59:59Z'));
    vi.mocked(couponService.isExpiringSoon).mockReturnValue(false);
    vi.mocked(couponService.formatMinimumSpend).mockReturnValue('Min. spend: ฿1,000');
    vi.mocked(couponService.formatCouponValue).mockReturnValue('20%');
    vi.mocked(dateFormatter.formatExpiryDateWithRelative).mockReturnValue('Expires on 31 Dec 2024');
  });

  describe('Basic Rendering', () => {
    it('renders the coupon card', () => {
      render(<CouponCard coupon={mockCoupon} />);

      expect(screen.getByTestId('coupon-card')).toBeInTheDocument();
    });

    it('exposes the coupon status as a data attribute', () => {
      render(<CouponCard coupon={mockCoupon} />);

      expect(screen.getByTestId('coupon-card')).toHaveAttribute('data-status', 'available');
    });

    it('forwards a caller-supplied className', () => {
      render(<CouponCard coupon={mockCoupon} className="promo-card-marker" />);

      expect(screen.getByTestId('coupon-card')).toHaveClass('promo-card-marker');
    });
  });

  describe('Coupon Information Display', () => {
    it('displays the coupon name as a heading', () => {
      render(<CouponCard coupon={mockCoupon} />);

      const heading = screen.getByRole('heading', { name: '20% Off Your Purchase' });
      expect(heading.tagName).toBe('H3');
    });

    it('displays the coupon code', () => {
      render(<CouponCard coupon={mockCoupon} />);

      expect(screen.getByText('SAVE20')).toBeInTheDocument();
    });

    it('displays the coupon description when provided', () => {
      render(<CouponCard coupon={mockCoupon} />);

      expect(screen.getByText('Get 20% discount on your next purchase')).toBeInTheDocument();
    });

    it('omits the description when not provided', () => {
      const couponWithoutDesc = { ...mockCoupon, description: undefined };

      render(<CouponCard coupon={couponWithoutDesc} />);

      expect(screen.queryByText('Get 20% discount on your next purchase')).not.toBeInTheDocument();
    });

    it('displays the formatted discount value prominently', () => {
      render(<CouponCard coupon={mockCoupon} />);

      expect(screen.getByText('20%')).toBeInTheDocument();
      expect(couponService.formatCouponValue).toHaveBeenCalledWith(mockCoupon);
    });
  });

  describe('Expiry Date Display', () => {
    it('displays the formatted expiry text', () => {
      render(<CouponCard coupon={mockCoupon} />);

      expect(screen.getByText('Expires on 31 Dec 2024')).toBeInTheDocument();
      expect(dateFormatter.formatExpiryDateWithRelative).toHaveBeenCalledWith(
        expect.any(Date),
        mockTranslate
      );
    });

    it('omits the expiry text when the formatter returns null', () => {
      vi.mocked(dateFormatter.formatExpiryDateWithRelative).mockReturnValue(null);

      render(<CouponCard coupon={mockCoupon} />);

      expect(screen.queryByText('Expires on 31 Dec 2024')).not.toBeInTheDocument();
    });
  });

  describe('Minimum Spend Display', () => {
    it('displays the minimum spend text when present', () => {
      render(<CouponCard coupon={mockCoupon} />);

      expect(screen.getByText('Min. spend: ฿1,000')).toBeInTheDocument();
      expect(couponService.formatMinimumSpend).toHaveBeenCalledWith(mockCoupon);
    });

    it('omits the minimum spend text when null', () => {
      vi.mocked(couponService.formatMinimumSpend).mockReturnValue(null);

      render(<CouponCard coupon={mockCoupon} />);

      expect(screen.queryByText(/Min\. spend/)).not.toBeInTheDocument();
    });
  });

  describe('Expiring Soon State', () => {
    it('does not show an expiring-soon badge by default', () => {
      render(<CouponCard coupon={mockCoupon} />);

      expect(screen.queryByText('Expiring Soon')).not.toBeInTheDocument();
    });

    it('shows a warning-toned badge when the coupon is expiring soon', () => {
      vi.mocked(couponService.isExpiringSoon).mockReturnValue(true);

      render(<CouponCard coupon={mockCoupon} />);

      const badge = screen.getByText('Expiring Soon');
      expect(badge).toHaveAttribute('data-tone', 'warning');
    });
  });

  describe('Inactive Status State', () => {
    it.each(['used', 'expired', 'revoked'] as const)(
      'shows a neutral status badge for a %s coupon',
      (status) => {
        render(<CouponCard coupon={{ ...mockCoupon, status }} />);

        const badge = screen.getByTestId('coupon-card').querySelector('[data-tone="neutral"]');
        expect(badge).toBeInTheDocument();
      }
    );

    it('prioritizes the status badge over the expiring-soon badge once inactive', () => {
      vi.mocked(couponService.isExpiringSoon).mockReturnValue(true);

      render(<CouponCard coupon={{ ...mockCoupon, status: 'used' }} />);

      expect(screen.queryByText('Expiring Soon')).not.toBeInTheDocument();
    });
  });

  describe('Action Buttons', () => {
    it('renders no action buttons by default', () => {
      render(<CouponCard coupon={mockCoupon} />);

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('renders a "Use Coupon" button when onUse is provided', () => {
      render(<CouponCard coupon={mockCoupon} onUse={vi.fn()} />);

      expect(screen.getByRole('button', { name: 'Use Coupon' })).toBeInTheDocument();
    });

    it('renders a "View Details" button when onViewDetails is provided', () => {
      render(<CouponCard coupon={mockCoupon} onViewDetails={vi.fn()} />);

      expect(screen.getByRole('button', { name: 'View Details' })).toBeInTheDocument();
    });

    it('calls onUse with the coupon when the use button is clicked', async () => {
      const user = userEvent.setup();
      const onUse = vi.fn();

      render(<CouponCard coupon={mockCoupon} onUse={onUse} />);

      await user.click(screen.getByRole('button', { name: 'Use Coupon' }));

      expect(onUse).toHaveBeenCalledTimes(1);
      expect(onUse).toHaveBeenCalledWith(mockCoupon);
    });

    it('calls onViewDetails with the coupon when the details button is clicked', async () => {
      const user = userEvent.setup();
      const onViewDetails = vi.fn();

      render(<CouponCard coupon={mockCoupon} onViewDetails={onViewDetails} />);

      await user.click(screen.getByRole('button', { name: 'View Details' }));

      expect(onViewDetails).toHaveBeenCalledTimes(1);
      expect(onViewDetails).toHaveBeenCalledWith(mockCoupon);
    });

    it('uses the primary button variant for "Use Coupon"', () => {
      render(<CouponCard coupon={mockCoupon} onUse={vi.fn()} />);

      expect(screen.getByRole('button', { name: 'Use Coupon' })).toHaveAttribute('data-variant', 'primary');
    });

    it('uses the secondary button variant for "View Details"', () => {
      render(<CouponCard coupon={mockCoupon} onViewDetails={vi.fn()} />);

      expect(screen.getByRole('button', { name: 'View Details' })).toHaveAttribute('data-variant', 'secondary');
    });
  });

  describe('Null Field Handling', () => {
    it('does not crash when optional fields are all missing', () => {
      vi.mocked(couponService.getExpiryDate).mockReturnValue(null);
      vi.mocked(dateFormatter.formatExpiryDateWithRelative).mockReturnValue(null);
      vi.mocked(couponService.formatMinimumSpend).mockReturnValue(null);

      const minimalCoupon: UserActiveCoupon = {
        userCouponId: 'uc-1',
        userId: 'user-123',
        status: 'available',
        qrCode: 'QR123456',
        assignedAt: '2024-01-01T00:00:00Z',
        couponId: 'coupon-1',
        code: 'BASIC',
        name: 'Basic Coupon',
        type: 'percentage',
        currency: 'THB',
        expiringSoon: false,
        description: undefined,
        termsAndConditions: undefined,
        value: undefined,
        minimumSpend: undefined,
        maximumDiscount: undefined,
        expiresAt: undefined,
        couponExpiresAt: undefined,
        effectiveExpiry: undefined,
      };

      render(<CouponCard coupon={minimalCoupon} />);

      expect(screen.getByText('Basic Coupon')).toBeInTheDocument();
      expect(screen.getByText('BASIC')).toBeInTheDocument();
    });

    it('handles a very long coupon name without crashing', () => {
      const longNameCoupon = {
        ...mockCoupon,
        name: 'This is a very long coupon name that should be truncated properly to maintain layout integrity',
      };

      render(<CouponCard coupon={longNameCoupon} />);

      expect(screen.getByText(/This is a very long coupon name/)).toBeInTheDocument();
    });
  });

  describe('Translation Keys', () => {
    it('uses the expected translation keys', () => {
      vi.mocked(couponService.isExpiringSoon).mockReturnValue(true);

      render(<CouponCard coupon={mockCoupon} onUse={vi.fn()} onViewDetails={vi.fn()} />);

      expect(mockTranslate).toHaveBeenCalledWith('coupons.expiringSoon');
      expect(mockTranslate).toHaveBeenCalledWith('coupons.useCoupon');
      expect(mockTranslate).toHaveBeenCalledWith('coupons.viewDetails');
    });
  });
});
