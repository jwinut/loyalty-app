import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QRCodeModal from '../QRCodeModal';
import { UserActiveCoupon } from '../../../types/coupon';
import QRCode from 'qrcode';

// Mock dependencies
const mockTranslate = vi.fn((key: string, defaultValue?: string) => {
  const translations: Record<string, string> = {
    'coupons.useCoupon': 'Use Coupon',
    'coupons.couponCode': 'Coupon Code',
    'coupons.generatingQR': 'Generating QR Code...',
    'coupons.qrError': 'Error generating QR code',
    'coupons.howToUse': 'How to Use',
    'coupons.showQRCode': 'Show this QR code to staff',
    'coupons.letStaffScan': 'Let staff scan the code',
    'coupons.enjoyDiscount': 'Enjoy your discount',
    'common.important': 'Important',
    'common.close': 'Close',
    'coupons.oneTimeUse': 'This coupon can only be used once',
    'coupons.copyCode': 'Copy Code',
    'coupons.couponCodeCopied': 'Coupon code copied!',
  };
  return translations[key] || defaultValue || key;
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: mockTranslate,
  }),
}));

// Mock QRCode library
vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn(),
  },
}));

// Mock logger
vi.mock('../../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

// Mock notification manager
vi.mock('../../../utils/notificationManager', () => ({
  notify: {
    success: vi.fn(),
  },
}));

describe('QRCodeModal', () => {
  const mockCoupon: UserActiveCoupon = {
    userCouponId: 'uc-1',
    userId: 'user-123',
    status: 'available',
    qrCode: 'QR123456789',
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

  let mockWriteText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create fresh mock for clipboard
    mockWriteText = vi.fn().mockResolvedValue(undefined);

    // Mock clipboard using vi.stubGlobal
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: {
        writeText: mockWriteText,
        readText: vi.fn(),
      },
    });

    // Default QRCode mock - success
    (vi.mocked(QRCode.toDataURL) as unknown as ReturnType<typeof vi.fn>).mockResolvedValue('data:image/png;base64,mockQRCode');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render the component', async () => {
      render(<QRCodeModal coupon={mockCoupon} />);

      // Wait for async QR code generation to complete
      await waitFor(() => {
        expect(screen.getByAltText('QR Code for SAVE20')).toBeInTheDocument();
      });

      expect(screen.getByText('Use Coupon')).toBeInTheDocument();
    });

    it('should render without crashing', async () => {
      const { container } = render(<QRCodeModal coupon={mockCoupon} />);

      // Wait for async QR code generation to complete
      await waitFor(() => {
        expect(screen.getByAltText('QR Code for SAVE20')).toBeInTheDocument();
      });

      expect(container).toBeTruthy();
    });

    it('should render the content wrapper with base classes', async () => {
      render(<QRCodeModal coupon={mockCoupon} />);

      await waitFor(() => {
        expect(screen.getByAltText('QR Code for SAVE20')).toBeInTheDocument();
      });

      expect(screen.getByTestId('qr-code-content')).toHaveClass('text-center');
    });

    it('should apply custom className to the content wrapper', async () => {
      render(<QRCodeModal coupon={mockCoupon} className="custom-modal-class" />);

      await waitFor(() => {
        expect(screen.getByAltText('QR Code for SAVE20')).toBeInTheDocument();
      });

      expect(screen.getByTestId('qr-code-content')).toHaveClass('custom-modal-class');
    });

    it('should maintain base classes with custom className', async () => {
      render(<QRCodeModal coupon={mockCoupon} className="custom-modal-class" />);

      await waitFor(() => {
        expect(screen.getByAltText('QR Code for SAVE20')).toBeInTheDocument();
      });

      const content = screen.getByTestId('qr-code-content');
      expect(content).toHaveClass('text-center', 'custom-modal-class');
    });

    it('should render inside a dialog', async () => {
      render(<QRCodeModal coupon={mockCoupon} />);

      await waitFor(() => {
        expect(screen.getByAltText('QR Code for SAVE20')).toBeInTheDocument();
      });

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('Header Section', () => {
    it('should display modal title', async () => {
      render(<QRCodeModal coupon={mockCoupon} />);

      await waitFor(() => {
        expect(screen.getByAltText('QR Code for SAVE20')).toBeInTheDocument();
      });

      expect(screen.getByText('Use Coupon')).toBeInTheDocument();
    });

    it('should have proper heading hierarchy', async () => {
      render(<QRCodeModal coupon={mockCoupon} />);

      await waitFor(() => {
        expect(screen.getByAltText('QR Code for SAVE20')).toBeInTheDocument();
      });

      const heading = screen.getByText('Use Coupon');
      expect(heading.tagName).toBe('H2');
    });

    it('should have a border below the header', async () => {
      render(<QRCodeModal coupon={mockCoupon} />);

      await waitFor(() => {
        expect(screen.getByAltText('QR Code for SAVE20')).toBeInTheDocument();
      });

      const header = document.body.querySelector('.border-b');
      expect(header).toBeInTheDocument();
    });
  });

  describe('Close Button', () => {
    it('should always display the header close button', async () => {
      render(<QRCodeModal coupon={mockCoupon} />);

      await waitFor(() => {
        expect(screen.getByAltText('QR Code for SAVE20')).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    });

    it('should call onClose when close button clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<QRCodeModal coupon={mockCoupon} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByAltText('QR Code for SAVE20')).toBeInTheDocument();
      });

      const closeButton = screen.getByRole('button', { name: 'Close' });
      await user.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple close button clicks', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<QRCodeModal coupon={mockCoupon} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByAltText('QR Code for SAVE20')).toBeInTheDocument();
      });

      const closeButton = screen.getByRole('button', { name: 'Close' });
      await user.click(closeButton);
      await user.click(closeButton);
      await user.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(3);
    });

    it('should not throw when close button is clicked without onClose provided', async () => {
      const user = userEvent.setup();

      render(<QRCodeModal coupon={mockCoupon} />);

      await waitFor(() => {
        expect(screen.getByAltText('QR Code for SAVE20')).toBeInTheDocument();
      });

      const closeButton = screen.getByRole('button', { name: 'Close' });
      await expect(user.click(closeButton)).resolves.not.toThrow();
    });
  });

  describe('Coupon Information Display', () => {
    it('should display coupon name', async () => {
      render(<QRCodeModal coupon={mockCoupon} />);

      await waitFor(() => {
        expect(screen.getByAltText('QR Code for SAVE20')).toBeInTheDocument();
      });

      expect(screen.getByText('20% Off Your Purchase')).toBeInTheDocument();
    });

    it('should style coupon name as heading', async () => {
      render(<QRCodeModal coupon={mockCoupon} />);

      await waitFor(() => {
        expect(screen.getByAltText('QR Code for SAVE20')).toBeInTheDocument();
      });

      const nameElement = screen.getByText('20% Off Your Purchase');
      expect(nameElement.tagName).toBe('H4');
      expect(nameElement).toHaveClass('text-xl', 'font-bold', 'text-stone-900');
    });

    it('should display coupon code', async () => {
      render(<QRCodeModal coupon={mockCoupon} />);

      await waitFor(() => {
        expect(screen.getByAltText('QR Code for SAVE20')).toBeInTheDocument();
      });

      expect(screen.getByText('SAVE20')).toBeInTheDocument();
    });

    it('should display coupon code label', async () => {
      render(<QRCodeModal coupon={mockCoupon} />);

      await waitFor(() => {
        expect(screen.getByAltText('QR Code for SAVE20')).toBeInTheDocument();
      });

      expect(screen.getByText('Coupon Code')).toBeInTheDocument();
    });

    it('should style coupon code with monospace font', async () => {
      render(<QRCodeModal coupon={mockCoupon} />);

      await waitFor(() => {
        expect(screen.getByAltText('QR Code for SAVE20')).toBeInTheDocument();
      });

      const codeElement = screen.getByText('SAVE20');
      expect(codeElement).toHaveClass('text-lg', 'font-mono', 'bg-stone-100');
    });

    it('should handle very long coupon name', async () => {
      const longNameCoupon = {
        ...mockCoupon,
        name: 'This is an extremely long coupon name that should still be displayed properly',
      };

      render(<QRCodeModal coupon={longNameCoupon} />);

      await waitFor(() => {
        expect(screen.getByAltText('QR Code for SAVE20')).toBeInTheDocument();
      });

      expect(screen.getByText(/This is an extremely long coupon name/)).toBeInTheDocument();
    });

    it('should handle very long coupon code', async () => {
      const longCodeCoupon = {
        ...mockCoupon,
        code: 'VERYLONGCOUPONCODE123456789',
      };

      render(<QRCodeModal coupon={longCodeCoupon} />);

      await waitFor(() => {
        expect(screen.getByAltText('QR Code for VERYLONGCOUPONCODE123456789')).toBeInTheDocument();
      });

      expect(screen.getByText('VERYLONGCOUPONCODE123456789')).toBeInTheDocument();
    });
  });

  describe('QR Code Generation', () => {
    it('should call QRCode.toDataURL on mount', async () => {
      render(<QRCodeModal coupon={mockCoupon} />);

      await waitFor(() => {
        expect(QRCode.toDataURL).toHaveBeenCalledWith(
          'QR123456789',
          expect.objectContaining({
            width: 256,
            margin: 2,
            errorCorrectionLevel: 'M',
          })
        );
      });
    });

    it('should pass correct QR data to generator', async () => {
      render(<QRCodeModal coupon={mockCoupon} />);

      await waitFor(() => {
        expect(QRCode.toDataURL).toHaveBeenCalledWith(
          'QR123456789',
          expect.any(Object)
        );
      });
    });

    it('should configure QR code with correct colors', async () => {
      render(<QRCodeModal coupon={mockCoupon} />);

      await waitFor(() => {
        expect(QRCode.toDataURL).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            color: {
              dark: '#000000',
              light: '#FFFFFF',
            },
          })
        );
      });
    });

    it('should regenerate QR code when coupon qrCode changes', async () => {
      const { rerender } = render(<QRCodeModal coupon={mockCoupon} />);

      await waitFor(() => {
        expect(QRCode.toDataURL).toHaveBeenCalledTimes(1);
      });

      const updatedCoupon = { ...mockCoupon, qrCode: 'NEWQRCODE123' };
      rerender(<QRCodeModal coupon={updatedCoupon} />);

      await waitFor(() => {
        expect(QRCode.toDataURL).toHaveBeenCalledTimes(2);
        expect(QRCode.toDataURL).toHaveBeenLastCalledWith(
          'NEWQRCODE123',
          expect.any(Object)
        );
      });
    });

    it('should not regenerate QR code when other coupon properties change', async () => {
      const { rerender } = render(<QRCodeModal coupon={mockCoupon} />);

      await waitFor(() => {
        expect(QRCode.toDataURL).toHaveBeenCalledTimes(1);
      });

      const updatedCoupon = { ...mockCoupon, name: 'New Name' };
      rerender(<QRCodeModal coupon={updatedCoupon} />);

      // Wait a bit to ensure no additional calls
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(QRCode.toDataURL).toHaveBeenCalledTimes(1);
    });
  });

  describe('QR Code Display - Loading State', () => {
    it('should show loading state initially', () => {
      // Make QRCode generation take time
      vi.mocked(QRCode.toDataURL).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('data:image/png;base64,test'), 100))
      );

      render(<QRCodeModal coupon={mockCoupon} />);

      expect(screen.getByText('Generating QR Code...')).toBeInTheDocument();
    });

    it('should display loading icon during generation', () => {
      vi.mocked(QRCode.toDataURL).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('data:image/png;base64,test'), 100))
      );

      render(<QRCodeModal coupon={mockCoupon} />);

      expect(screen.getByText('⏳')).toBeInTheDocument();
    });

    it('should hide loading state after QR code generated', async () => {
      render(<QRCodeModal coupon={mockCoupon} />);

      await waitFor(() => {
        expect(screen.queryByText('Generating QR Code...')).not.toBeInTheDocument();
      });
    });
  });

  describe('QR Code Display - Success State', () => {
    it('should display QR code image after generation', async () => {
      render(<QRCodeModal coupon={mockCoupon} />);

      await waitFor(() => {
        const img = screen.getByAltText('QR Code for SAVE20');
        expect(img).toBeInTheDocument();
      });
    });

    it('should use generated data URL as image source', async () => {
      render(<QRCodeModal coupon={mockCoupon} />);

      await waitFor(() => {
        const img = screen.getByAltText('QR Code for SAVE20') as HTMLImageElement;
        expect(img.src).toBe('data:image/png;base64,mockQRCode');
      });
    });

    it('should have proper alt text for QR code image', async () => {
      render(<QRCodeModal coupon={mockCoupon} />);

      await waitFor(() => {
        const img = screen.getByAltText('QR Code for SAVE20');
        expect(img).toBeInTheDocument();
      });
    });

    it('should style QR code image container correctly', async () => {
      render(<QRCodeModal coupon={mockCoupon} />);

      await waitFor(() => {
        const qrContainer = document.body.querySelector('.w-64.h-64');
        expect(qrContainer).toBeInTheDocument();
      });
    });

    it('should have rounded border around QR code', async () => {
      render(<QRCodeModal coupon={mockCoupon} />);

      await waitFor(() => {
        const qrWrapper = document.body.querySelector('.border-2.border-stone-200');
        expect(qrWrapper).toBeInTheDocument();
      });
    });

    it('should sit on a pure white panel behind the QR image', async () => {
      render(<QRCodeModal coupon={mockCoupon} />);

      await waitFor(() => {
        const qrWrapper = document.body.querySelector('.border-2.border-stone-200');
        expect(qrWrapper).toHaveClass('bg-white', 'shadow-soft');
      });
    });
  });

  describe('QR Code Display - Error State', () => {
    it('should display error message when QR generation fails', async () => {
      vi.mocked(QRCode.toDataURL).mockRejectedValue(new Error('QR generation failed'));

      render(<QRCodeModal coupon={mockCoupon} />);

      await waitFor(() => {
        expect(screen.getByText('Error generating QR code')).toBeInTheDocument();
      });
    });

    it('should display error icon when QR generation fails', async () => {
      vi.mocked(QRCode.toDataURL).mockRejectedValue(new Error('QR generation failed'));

      render(<QRCodeModal coupon={mockCoupon} />);

      await waitFor(() => {
        expect(screen.getByText('❌')).toBeInTheDocument();
      });
    });

    it('should log error when QR generation fails', async () => {
      const { logger } = await import('../../../utils/logger');
      const error = new Error('QR generation failed');
      vi.mocked(QRCode.toDataURL).mockRejectedValue(error);

      render(<QRCodeModal coupon={mockCoupon} />);

      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith('Error generating QR code:', error);
      });
    });

    it('should not display QR image when generation fails', async () => {
      vi.mocked(QRCode.toDataURL).mockRejectedValue(new Error('QR generation failed'));

      render(<QRCodeModal coupon={mockCoupon} />);

      await waitFor(() => {
        expect(screen.getByText('Error generating QR code')).toBeInTheDocument();
      });

      expect(screen.queryByAltText(/QR Code for/)).not.toBeInTheDocument();
    });
  });

  describe('Instructions Section', () => {
    it('should display how to use title', async () => {
      render(<QRCodeModal coupon={mockCoupon} />);

      await waitFor(() => {
        expect(screen.getByAltText('QR Code for SAVE20')).toBeInTheDocument();
      });

      expect(screen.getByText('How to Use')).toBeInTheDocument();
    });

    it('should display all three instructions', async () => {
      render(<QRCodeModal coupon={mockCoupon} />);

      await waitFor(() => {
        expect(screen.getByAltText('QR Code for SAVE20')).toBeInTheDocument();
      });

      expect(screen.getByText(/Show this QR code to staff/)).toBeInTheDocument();
      expect(screen.getByText(/Let staff scan the code/)).toBeInTheDocument();
      expect(screen.getByText(/Enjoy your discount/)).toBeInTheDocument();
    });

    it('should display instructions in ordered list', async () => {
      render(<QRCodeModal coupon={mockCoupon} />);

      await waitFor(() => {
        expect(screen.getByAltText('QR Code for SAVE20')).toBeInTheDocument();
      });

      const orderedList = document.body.querySelector('ol');
      expect(orderedList).toBeInTheDocument();
    });

    it('should display instruction numbers', async () => {
      render(<QRCodeModal coupon={mockCoupon} />);

      await waitFor(() => {
        expect(screen.getByAltText('QR Code for SAVE20')).toBeInTheDocument();
      });

      const numbers = document.body.querySelectorAll('.bg-brand-200.rounded-full');

      expect(numbers.length).toBeGreaterThanOrEqual(3);
    });

    it('should style instructions section with blue background', async () => {
      render(<QRCodeModal coupon={mockCoupon} />);

      await waitFor(() => {
        expect(screen.getByAltText('QR Code for SAVE20')).toBeInTheDocument();
      });

      const instructionsSection = document.body.querySelector('.bg-brand-50');
      expect(instructionsSection).toBeInTheDocument();
    });

    it('should display clipboard icon for instructions', async () => {
      render(<QRCodeModal coupon={mockCoupon} />);

      await waitFor(() => {
        expect(screen.getByAltText('QR Code for SAVE20')).toBeInTheDocument();
      });

      // There are two clipboard icons: one in instructions header and one in copy button
      const clipboardIcons = screen.getAllByText('📋');
      expect(clipboardIcons.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Important Notice Section', () => {
    it('should display important notice', async () => {
      render(<QRCodeModal coupon={mockCoupon} />);

      await waitFor(() => {
        expect(screen.getByAltText('QR Code for SAVE20')).toBeInTheDocument();
      });

      expect(screen.getByText(/Important/)).toBeInTheDocument();
    });

    it('should display one-time use message', async () => {
      render(<QRCodeModal coupon={mockCoupon} />);

      await waitFor(() => {
        expect(screen.getByAltText('QR Code for SAVE20')).toBeInTheDocument();
      });

      expect(screen.getByText(/This coupon can only be used once/)).toBeInTheDocument();
    });

    it('should style notice with amber background', async () => {
      render(<QRCodeModal coupon={mockCoupon} />);

      await waitFor(() => {
        expect(screen.getByAltText('QR Code for SAVE20')).toBeInTheDocument();
      });

      const noticeSection = document.body.querySelector('.bg-amber-50');
      expect(noticeSection).toBeInTheDocument();
    });

    it('should display warning icon', async () => {
      render(<QRCodeModal coupon={mockCoupon} />);

      await waitFor(() => {
        expect(screen.getByAltText('QR Code for SAVE20')).toBeInTheDocument();
      });

      expect(screen.getByText(/⚠️/)).toBeInTheDocument();
    });
  });

  describe('Copy to Clipboard', () => {
    it('should display copy code button', async () => {
      render(<QRCodeModal coupon={mockCoupon} />);

      await waitFor(() => {
        expect(screen.getByAltText('QR Code for SAVE20')).toBeInTheDocument();
      });

      expect(screen.getByText('Copy Code')).toBeInTheDocument();
    });

    it('should copy coupon code to clipboard when button clicked', async () => {
      const user = userEvent.setup();
      const { notify } = await import('../../../utils/notificationManager');

      render(<QRCodeModal coupon={mockCoupon} />);

      const copyButton = screen.getByText('Copy Code');
      await user.click(copyButton);

      // Verify copy action completes by checking for success notification
      await waitFor(() => {
        expect(notify.success).toHaveBeenCalled();
      });
    });

    it('should show success notification after copying', async () => {
      const user = userEvent.setup();
      const { notify } = await import('../../../utils/notificationManager');

      render(<QRCodeModal coupon={mockCoupon} />);

      const copyButton = screen.getByText('Copy Code');
      await user.click(copyButton);

      await waitFor(() => {
        expect(notify.success).toHaveBeenCalledWith('Coupon code copied!');
      });
    });

    it('should handle clipboard copy errors gracefully', async () => {
      const user = userEvent.setup();

      // Mock the clipboard to reject
      const originalClipboard = navigator.clipboard;
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: vi.fn().mockRejectedValue(new Error('Clipboard error')),
          readText: vi.fn(),
        },
        configurable: true,
      });

      const { logger } = await import('../../../utils/logger');

      render(<QRCodeModal coupon={mockCoupon} />);

      // Wait for QR code generation to complete
      await waitFor(() => {
        expect(screen.getByAltText('QR Code for SAVE20')).toBeInTheDocument();
      });

      const copyButton = screen.getByText('Copy Code');
      await user.click(copyButton);

      await waitFor(() => {
        expect(logger.error).toHaveBeenCalled();
      });

      // Restore clipboard
      Object.defineProperty(navigator, 'clipboard', {
        value: originalClipboard,
        configurable: true,
      });
    });

    it('should style copy button correctly', async () => {
      render(<QRCodeModal coupon={mockCoupon} />);

      await waitFor(() => {
        expect(screen.getByAltText('QR Code for SAVE20')).toBeInTheDocument();
      });

      const copyButton = screen.getByText('Copy Code');
      expect(copyButton).toHaveClass('bg-stone-100', 'text-stone-700');
    });

    it('should have clipboard icon on copy button', async () => {
      render(<QRCodeModal coupon={mockCoupon} />);

      await waitFor(() => {
        expect(screen.getByAltText('QR Code for SAVE20')).toBeInTheDocument();
      });

      // The button contains the emoji and text
      const copyButton = screen.getByText('Copy Code');
      expect(copyButton.parentElement?.textContent).toContain('📋');
    });

    it('should handle multiple copy attempts', async () => {
      const user = userEvent.setup();
      const { notify } = await import('../../../utils/notificationManager');

      render(<QRCodeModal coupon={mockCoupon} />);

      // Wait for QR code generation to complete
      await waitFor(() => {
        expect(screen.getByAltText('QR Code for SAVE20')).toBeInTheDocument();
      });

      const copyButton = screen.getByText('Copy Code');
      await user.click(copyButton);
      await user.click(copyButton);
      await user.click(copyButton);

      // Verify multiple copy attempts by checking notification calls
      await waitFor(() => {
        expect(notify.success).toHaveBeenCalledTimes(3);
      });
    });
  });

  describe('Translation Keys', () => {
    it('should use correct translation keys', async () => {
      render(<QRCodeModal coupon={mockCoupon} />);

      // Wait for QR code generation to complete
      await waitFor(() => {
        expect(screen.getByAltText('QR Code for SAVE20')).toBeInTheDocument();
      });

      // Check that translation function was called (may be called with default values)
      expect(mockTranslate).toHaveBeenCalled();
      // Verify key translations appear in rendered output
      expect(screen.getByText('Use Coupon')).toBeInTheDocument();
      expect(screen.getByText('Coupon Code')).toBeInTheDocument();
      expect(screen.getByText('How to Use')).toBeInTheDocument();
      expect(screen.getByText('Copy Code')).toBeInTheDocument();
    });

    it('should use translation for instructions', async () => {
      render(<QRCodeModal coupon={mockCoupon} />);

      // Wait for QR code generation to complete
      await waitFor(() => {
        expect(screen.getByAltText('QR Code for SAVE20')).toBeInTheDocument();
      });

      expect(mockTranslate).toHaveBeenCalledWith('coupons.showQRCode');
      expect(mockTranslate).toHaveBeenCalledWith('coupons.letStaffScan');
      expect(mockTranslate).toHaveBeenCalledWith('coupons.enjoyDiscount');
    });

    it('should use translation for important notice', async () => {
      render(<QRCodeModal coupon={mockCoupon} />);

      // Wait for QR code generation to complete
      await waitFor(() => {
        expect(screen.getByAltText('QR Code for SAVE20')).toBeInTheDocument();
      });

      expect(mockTranslate).toHaveBeenCalledWith('common.important');
      expect(mockTranslate).toHaveBeenCalledWith('coupons.oneTimeUse');
    });
  });

  describe('Accessibility', () => {
    it('should have accessible button elements', async () => {
      const onClose = vi.fn();

      render(<QRCodeModal coupon={mockCoupon} onClose={onClose} />);

      // Wait for QR code generation to complete
      await waitFor(() => {
        expect(screen.getByAltText('QR Code for SAVE20')).toBeInTheDocument();
      });

      const copyButton = screen.getByText('Copy Code');
      const closeButton = screen.getByRole('button', { name: 'Close' });

      expect(copyButton.tagName).toBe('BUTTON');
      expect(closeButton.tagName).toBe('BUTTON');
    });

    it('should have proper text hierarchy', async () => {
      render(<QRCodeModal coupon={mockCoupon} />);

      // Wait for QR code generation to complete
      await waitFor(() => {
        expect(screen.getByAltText('QR Code for SAVE20')).toBeInTheDocument();
      });

      const mainHeading = screen.getByText('Use Coupon');
      const couponHeading = screen.getByText('20% Off Your Purchase');

      expect(mainHeading.tagName).toBe('H2');
      expect(couponHeading.tagName).toBe('H4');
    });

    it('should have proper section headings', async () => {
      render(<QRCodeModal coupon={mockCoupon} />);

      // Wait for QR code generation to complete
      await waitFor(() => {
        expect(screen.getByAltText('QR Code for SAVE20')).toBeInTheDocument();
      });

      const howToUseHeading = screen.getByText('How to Use');

      expect(howToUseHeading.tagName).toBe('H5');
    });

    it('should have alt text for QR code image', async () => {
      render(<QRCodeModal coupon={mockCoupon} />);

      await waitFor(() => {
        const img = screen.getByAltText('QR Code for SAVE20');
        expect(img).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty qrCode gracefully', async () => {
      const emptyQRCoupon = { ...mockCoupon, qrCode: '' };

      render(<QRCodeModal coupon={emptyQRCoupon} />);

      await waitFor(() => {
        expect(QRCode.toDataURL).toHaveBeenCalledWith('', expect.any(Object));
      });
    });

    it('should handle very long QR code data', async () => {
      const longQRCoupon = {
        ...mockCoupon,
        qrCode: 'A'.repeat(1000),
      };

      render(<QRCodeModal coupon={longQRCoupon} />);

      await waitFor(() => {
        expect(QRCode.toDataURL).toHaveBeenCalledWith('A'.repeat(1000), expect.any(Object));
      });
    });

    it('should handle special characters in coupon code', async () => {
      const specialCharCoupon = {
        ...mockCoupon,
        code: 'SAVE-20%',
      };

      render(<QRCodeModal coupon={specialCharCoupon} />);

      await waitFor(() => {
        expect(screen.getByAltText('QR Code for SAVE-20%')).toBeInTheDocument();
      });

      expect(screen.getByText('SAVE-20%')).toBeInTheDocument();
    });

    it('should handle undefined onClose prop without crashing', async () => {
      const { container } = render(<QRCodeModal coupon={mockCoupon} />);

      await waitFor(() => {
        expect(screen.getByAltText('QR Code for SAVE20')).toBeInTheDocument();
      });

      expect(container).toBeTruthy();
    });

    it('should update when coupon prop changes completely', async () => {
      const { rerender } = render(<QRCodeModal coupon={mockCoupon} />);

      await waitFor(() => {
        expect(screen.getByText('20% Off Your Purchase')).toBeInTheDocument();
      });

      const newCoupon = {
        ...mockCoupon,
        name: 'New Coupon Name',
        code: 'NEWCODE',
        qrCode: 'NEWQR123',
      };

      rerender(<QRCodeModal coupon={newCoupon} />);

      await waitFor(() => {
        expect(screen.getByText('New Coupon Name')).toBeInTheDocument();
        expect(screen.getByText('NEWCODE')).toBeInTheDocument();
      });
    });
  });

  describe('Layout and Styling', () => {
    it('should center QR code content', async () => {
      render(<QRCodeModal coupon={mockCoupon} />);

      // Wait for QR code generation to complete
      await waitFor(() => {
        expect(screen.getByAltText('QR Code for SAVE20')).toBeInTheDocument();
      });

      expect(screen.getByTestId('qr-code-content')).toHaveClass('text-center');
    });

    it('should have proper spacing between sections', async () => {
      render(<QRCodeModal coupon={mockCoupon} />);

      // Wait for QR code generation to complete
      await waitFor(() => {
        expect(screen.getByAltText('QR Code for SAVE20')).toBeInTheDocument();
      });

      // Check for margin classes
      const sectionsWithMargin = document.body.querySelectorAll('.mb-6');
      expect(sectionsWithMargin.length).toBeGreaterThan(0);
    });
  });
});
