import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CouponDetailsModal from '../CouponDetailsModal';
import { UserActiveCoupon } from '../../../types/coupon';
import { couponService } from '../../../services/couponService';
import * as dateFormatter from '../../../utils/dateFormatter';

// Mock dependencies
const mockTranslate = vi.fn((key: string) => {
  const translations: Record<string, string> = {
    'coupons.couponDetails': 'Coupon Details',
    'coupons.description': 'Description',
    'coupons.value': 'Value',
    'coupons.details': 'Details',
    'coupons.type': 'Type',
    'coupons.minimumSpend': 'Minimum Spend',
    'coupons.maximumDiscount': 'Maximum Discount',
    'coupons.expiresOn': 'Expires On',
    'coupons.termsAndConditions': 'Terms and Conditions',
    'coupons.status': 'Status',
    'coupons.expiringSoon': 'Expiring Soon',
    'coupons.discount': 'Discount',
    'coupons.types.percentage': 'Percentage Discount',
    'coupons.types.fixed_amount': 'Fixed Amount Discount',
    'coupons.types.bogo': 'Buy One Get One',
    'coupons.types.free_upgrade': 'Free Upgrade',
    'coupons.types.free_service': 'Free Service',
    'coupons.statuses.available': 'Available',
    'coupons.statuses.used': 'Used',
    'coupons.statuses.expired': 'Expired',
    'coupons.statuses.revoked': 'Revoked',
    'common.close': 'Close',
  };
  return translations[key] || key;
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: mockTranslate,
  }),
}));

vi.mock('../../../services/couponService', () => ({
  couponService: {
    isExpiringSoon: vi.fn(),
  },
}));

vi.mock('../../../utils/dateFormatter', () => ({
  formatDateToDDMMYYYY: vi.fn((date: string) => {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }),
}));

describe('CouponDetailsModal', () => {
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
    vi.mocked(couponService.isExpiringSoon).mockReturnValue(false);
  });

  describe('Basic Rendering', () => {
    it('renders inside a dialog', () => {
      render(<CouponDetailsModal coupon={mockCoupon} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('displays the modal title', () => {
      render(<CouponDetailsModal coupon={mockCoupon} />);

      expect(screen.getByText('Coupon Details')).toBeInTheDocument();
    });

    it('forwards a caller-supplied className to the content wrapper', () => {
      render(<CouponDetailsModal coupon={mockCoupon} className="promo-modal-marker" />);

      expect(document.body.querySelector('.promo-modal-marker')).toBeInTheDocument();
    });
  });

  describe('Close Behavior', () => {
    it('always renders a close button, even without onClose', () => {
      render(<CouponDetailsModal coupon={mockCoupon} />);

      expect(screen.getAllByRole('button', { name: 'Close' }).length).toBeGreaterThan(0);
    });

    it('does not throw when the close button is clicked without onClose provided', async () => {
      const user = userEvent.setup();
      render(<CouponDetailsModal coupon={mockCoupon} />);

      const closeButtons = screen.getAllByRole('button', { name: 'Close' });
      await expect(user.click(closeButtons[0] as HTMLElement)).resolves.not.toThrow();
    });

    it('calls onClose when a close button is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<CouponDetailsModal coupon={mockCoupon} onClose={onClose} />);

      const closeButtons = screen.getAllByRole('button', { name: 'Close' });
      await user.click(closeButtons[0] as HTMLElement);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose for every close affordance rendered', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<CouponDetailsModal coupon={mockCoupon} onClose={onClose} />);

      const closeButtons = screen.getAllByRole('button', { name: 'Close' });
      expect(closeButtons.length).toBeGreaterThanOrEqual(2);

      for (const button of closeButtons) {
        await user.click(button);
      }

      expect(onClose).toHaveBeenCalledTimes(closeButtons.length);
    });
  });

  describe('Coupon Information Display', () => {
    it('displays the coupon name', () => {
      render(<CouponDetailsModal coupon={mockCoupon} />);

      expect(screen.getByText('20% Off Your Purchase')).toBeInTheDocument();
    });

    it('displays the coupon code', () => {
      render(<CouponDetailsModal coupon={mockCoupon} />);

      expect(screen.getByText('SAVE20')).toBeInTheDocument();
    });

    it('displays the description section when provided', () => {
      render(<CouponDetailsModal coupon={mockCoupon} />);

      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByText('Get 20% discount on your next purchase')).toBeInTheDocument();
    });

    it('omits the description section when not provided', () => {
      const couponNoDesc = { ...mockCoupon, description: undefined };

      render(<CouponDetailsModal coupon={couponNoDesc} />);

      expect(screen.queryByText('Description')).not.toBeInTheDocument();
    });
  });

  describe('Value Display', () => {
    it('displays the percentage value', () => {
      render(<CouponDetailsModal coupon={mockCoupon} />);

      expect(screen.getByText('20%')).toBeInTheDocument();
    });

    it('displays the fixed amount value', () => {
      const fixedAmountCoupon = { ...mockCoupon, type: 'fixed_amount' as const, value: 100 };

      render(<CouponDetailsModal coupon={fixedAmountCoupon} />);

      expect(screen.getByText('THB100')).toBeInTheDocument();
    });

    it('displays the type label for bogo', () => {
      render(<CouponDetailsModal coupon={{ ...mockCoupon, type: 'bogo' }} />);

      expect(screen.getAllByText('Buy One Get One').length).toBeGreaterThan(0);
    });

    it('displays the type label for free_upgrade', () => {
      render(<CouponDetailsModal coupon={{ ...mockCoupon, type: 'free_upgrade' }} />);

      expect(screen.getAllByText('Free Upgrade').length).toBeGreaterThan(0);
    });

    it('displays the type label for free_service', () => {
      render(<CouponDetailsModal coupon={{ ...mockCoupon, type: 'free_service' }} />);

      expect(screen.getAllByText('Free Service').length).toBeGreaterThan(0);
    });
  });

  describe('Detailed Information Section', () => {
    it('displays the details heading and type row', () => {
      render(<CouponDetailsModal coupon={mockCoupon} />);

      expect(screen.getByText('Details')).toBeInTheDocument();
      expect(screen.getByText('Type:')).toBeInTheDocument();
      expect(screen.getByText('Percentage Discount')).toBeInTheDocument();
    });

    it('displays minimum spend when provided', () => {
      render(<CouponDetailsModal coupon={mockCoupon} />);

      expect(screen.getByText('Minimum Spend:')).toBeInTheDocument();
      expect(screen.getByText('THB1000')).toBeInTheDocument();
    });

    it('omits minimum spend when not provided', () => {
      render(<CouponDetailsModal coupon={{ ...mockCoupon, minimumSpend: undefined }} />);

      expect(screen.queryByText('Minimum Spend:')).not.toBeInTheDocument();
    });

    it('displays maximum discount when provided', () => {
      render(<CouponDetailsModal coupon={mockCoupon} />);

      expect(screen.getByText('Maximum Discount:')).toBeInTheDocument();
      expect(screen.getByText('THB500')).toBeInTheDocument();
    });

    it('omits maximum discount when not provided', () => {
      render(<CouponDetailsModal coupon={{ ...mockCoupon, maximumDiscount: undefined }} />);

      expect(screen.queryByText('Maximum Discount:')).not.toBeInTheDocument();
    });

    it('displays the expiry date when provided', () => {
      render(<CouponDetailsModal coupon={mockCoupon} />);

      expect(screen.getByText('Expires On:')).toBeInTheDocument();
      expect(screen.getByText(/\d{2}\/\d{2}\/\d{4}/)).toBeInTheDocument();
      expect(dateFormatter.formatDateToDDMMYYYY).toHaveBeenCalledWith(mockCoupon.effectiveExpiry);
    });

    it('omits the expiry date when not provided', () => {
      render(<CouponDetailsModal coupon={{ ...mockCoupon, effectiveExpiry: undefined }} />);

      expect(screen.queryByText('Expires On:')).not.toBeInTheDocument();
    });
  });

  describe('Expiring Soon State', () => {
    it('does not show an expiring-soon badge by default', () => {
      render(<CouponDetailsModal coupon={mockCoupon} />);

      expect(screen.queryByText('Expiring Soon')).not.toBeInTheDocument();
    });

    it('shows a warning-toned badge when the coupon is expiring soon', () => {
      vi.mocked(couponService.isExpiringSoon).mockReturnValue(true);

      render(<CouponDetailsModal coupon={mockCoupon} />);

      expect(screen.getByText('Expiring Soon')).toHaveAttribute('data-tone', 'warning');
    });
  });

  describe('Terms and Conditions', () => {
    it('displays terms and conditions when provided', () => {
      render(<CouponDetailsModal coupon={mockCoupon} />);

      expect(screen.getByText('Terms and Conditions')).toBeInTheDocument();
      expect(screen.getByText('Valid on purchases over 1000 THB')).toBeInTheDocument();
    });

    it('omits the terms section when not provided', () => {
      render(<CouponDetailsModal coupon={{ ...mockCoupon, termsAndConditions: undefined }} />);

      expect(screen.queryByText('Terms and Conditions')).not.toBeInTheDocument();
    });
  });

  describe('Usage Status', () => {
    it.each([
      ['available', 'Available'],
      ['used', 'Used'],
      ['expired', 'Expired'],
      ['revoked', 'Revoked'],
    ] as const)('displays the %s status as a brand badge', (status, label) => {
      render(<CouponDetailsModal coupon={{ ...mockCoupon, status }} />);

      expect(screen.getByText('Status:')).toBeInTheDocument();
      const badge = screen.getByText(label);
      expect(badge).toHaveAttribute('data-tone', 'brand');
    });
  });

  describe('Edge Cases', () => {
    it('does not crash when every optional field is missing', () => {
      const minimalCoupon = {
        ...mockCoupon,
        description: undefined,
        termsAndConditions: undefined,
        minimumSpend: undefined,
        maximumDiscount: undefined,
        effectiveExpiry: undefined,
      };

      render(<CouponDetailsModal coupon={minimalCoupon} />);

      expect(screen.getByText('20% Off Your Purchase')).toBeInTheDocument();
    });

    it('handles a very long coupon name', () => {
      const longNameCoupon = {
        ...mockCoupon,
        name: 'This is a very long coupon name that should be displayed properly in the modal without breaking the layout',
      };

      render(<CouponDetailsModal coupon={longNameCoupon} />);

      expect(screen.getByText(/This is a very long coupon name/)).toBeInTheDocument();
    });
  });

  describe('Translation Keys', () => {
    it('uses the expected translation keys', () => {
      render(<CouponDetailsModal coupon={mockCoupon} />);

      expect(mockTranslate).toHaveBeenCalledWith('coupons.couponDetails');
      expect(mockTranslate).toHaveBeenCalledWith('coupons.description');
      expect(mockTranslate).toHaveBeenCalledWith('coupons.value');
      expect(mockTranslate).toHaveBeenCalledWith('coupons.details');
      expect(mockTranslate).toHaveBeenCalledWith('coupons.type');
    });
  });
});
