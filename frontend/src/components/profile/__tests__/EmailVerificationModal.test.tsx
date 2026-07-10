import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EmailVerificationModal } from '../EmailVerificationModal';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = createTestQueryClient();
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const mockTranslate = vi.fn((key: string, fallback?: string) => {
  const translations: Record<string, string> = {
    'profile.verifyEmail': 'Verify Email',
    'profile.verificationCodeSent': 'A verification code has been sent to:',
    'profile.enterCode': 'Enter verification code',
    'profile.invalidCodeFormat': 'Please enter a valid code (XXXX-XXXX)',
    'profile.verifyCode': 'Verify Code',
    'common.verifying': 'Verifying...',
    'profile.resendCode': 'Resend code',
    'profile.codeResent': 'New code sent!',
    'profile.codeExpiry': "Code expires in 1 hour. Check your spam folder if you don't see it.",
    'common.close': 'Close',
  };

  return translations[key] ?? fallback ?? key;
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: mockTranslate,
  }),
}));

describe('EmailVerificationModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    newEmail: 'new-email@example.com',
    onVerified: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should not render when isOpen is false', () => {
      render(<EmailVerificationModal {...defaultProps} isOpen={false} />, { wrapper });

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render as a dialog when isOpen is true', () => {
      render(<EmailVerificationModal {...defaultProps} />, { wrapper });

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should render the title', () => {
      render(<EmailVerificationModal {...defaultProps} />, { wrapper });

      expect(screen.getByText('Verify Email')).toBeInTheDocument();
    });

    it('should render a close button with accessible name "Close" that calls onClose', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<EmailVerificationModal {...defaultProps} onClose={onClose} />, { wrapper });

      await user.click(screen.getByRole('button', { name: 'Close' }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should render the newEmail address', () => {
      render(<EmailVerificationModal {...defaultProps} newEmail="someone@example.com" />, { wrapper });

      expect(screen.getByText('someone@example.com')).toBeInTheDocument();
    });

    it('should render the code input and submit button', () => {
      render(<EmailVerificationModal {...defaultProps} />, { wrapper });

      expect(screen.getByTestId('verification-code-input')).toBeInTheDocument();
      expect(screen.getByTestId('verify-button')).toBeInTheDocument();
    });
  });

  describe('Code input formatting', () => {
    it('should uppercase input and auto-insert a dash after 4 characters', async () => {
      const user = userEvent.setup();
      render(<EmailVerificationModal {...defaultProps} />, { wrapper });

      const input = screen.getByTestId('verification-code-input') as HTMLInputElement;
      await user.type(input, 'ab12cd34');

      expect(input.value).toBe('AB12-CD34');
    });

    it('should strip non-alphanumeric characters', async () => {
      const user = userEvent.setup();
      render(<EmailVerificationModal {...defaultProps} />, { wrapper });

      const input = screen.getByTestId('verification-code-input') as HTMLInputElement;
      await user.type(input, 'ab-12!!cd34');

      expect(input.value).toBe('AB12-CD34');
    });

    it('should disable the submit button until 9 characters are entered', async () => {
      const user = userEvent.setup();
      render(<EmailVerificationModal {...defaultProps} />, { wrapper });

      const input = screen.getByTestId('verification-code-input') as HTMLInputElement;
      const submitButton = screen.getByTestId('verify-button');

      expect(submitButton).toBeDisabled();

      await user.type(input, 'ab12cd34');

      expect(submitButton).not.toBeDisabled();
    });
  });

  describe('Submission', () => {
    it('should show a validation error for an incomplete/invalid code format', async () => {
      const user = userEvent.setup();
      render(<EmailVerificationModal {...defaultProps} />, { wrapper });

      const input = screen.getByTestId('verification-code-input');
      await user.type(input, 'AB12CD3'); // 7 chars — incomplete, submit button stays disabled

      // The submit button is disabled at this length, so exercise the form's
      // own validation branch directly via a submit event (mirrors what a
      // browser does on Enter-to-submit, bypassing the disabled button).
      fireEvent.submit(screen.getByTestId('email-verification-modal'));

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid code (XXXX-XXXX)')).toBeInTheDocument();
      });
    });

    it('should surface the "temporarily unavailable" error when submitting a valid-format code', async () => {
      const user = userEvent.setup();
      const onVerified = vi.fn();
      render(<EmailVerificationModal {...defaultProps} onVerified={onVerified} />, { wrapper });

      const input = screen.getByTestId('verification-code-input');
      await user.type(input, 'ab12cd34');
      await user.click(screen.getByTestId('verify-button'));

      await waitFor(() => {
        expect(screen.getByText('Email verification is temporarily unavailable')).toBeInTheDocument();
      });
      expect(onVerified).not.toHaveBeenCalled();
    });
  });

  describe('Resend', () => {
    it('should surface the "temporarily unavailable" error when resend is clicked', async () => {
      const user = userEvent.setup();
      render(<EmailVerificationModal {...defaultProps} />, { wrapper });

      await user.click(screen.getByTestId('resend-code-button'));

      await waitFor(() => {
        expect(screen.getByText('Email verification is temporarily unavailable')).toBeInTheDocument();
      });
    });
  });

  describe('Dismissal', () => {
    it('should call onClose when Escape is pressed', () => {
      const onClose = vi.fn();
      render(<EmailVerificationModal {...defaultProps} onClose={onClose} />, { wrapper });

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when the backdrop is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<EmailVerificationModal {...defaultProps} onClose={onClose} />, { wrapper });

      const backdrop = screen.getByRole('dialog').parentElement as HTMLElement;
      await user.click(backdrop);

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
