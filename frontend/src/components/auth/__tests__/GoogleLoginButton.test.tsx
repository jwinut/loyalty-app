import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GoogleLoginButton from '../GoogleLoginButton';
import * as pwaUtils from '../../../utils/pwaUtils';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'auth.signInWithGoogle': 'Sign in with Google',
        'auth.continueWithGoogle': 'Continue with Google',
      };
      return translations[key] || key;
    },
  }),
}));

// Mock pwaUtils
vi.mock('../../../utils/pwaUtils', () => ({
  initiateOAuth: vi.fn(),
  checkPWAInstallPrompt: vi.fn(),
}));

describe('GoogleLoginButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render button with default "Sign in with Google" text', () => {
      render(<GoogleLoginButton />);
      expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
    });

    it('should render button with "Continue with Google" text when variant is continue', () => {
      render(<GoogleLoginButton variant="continue" />);
      expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
    });

    it('should render button with "Sign in with Google" text when variant is signIn', () => {
      render(<GoogleLoginButton variant="signIn" />);
      expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
    });

    it('should render the Google logo SVG at 20x20', () => {
      const { container } = render(<GoogleLoginButton />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg?.getAttribute('width')).toBe('20');
      expect(svg?.getAttribute('height')).toBe('20');
    });

    it('should render all four Google logo brand color paths unchanged', () => {
      const { container } = render(<GoogleLoginButton />);
      const paths = container.querySelectorAll('path');
      expect(paths).toHaveLength(4);

      const fills = Array.from(paths).map(p => p.getAttribute('fill'));
      expect(fills).toContain('#4285F4'); // Blue
      expect(fills).toContain('#34A853'); // Green
      expect(fills).toContain('#FBBC05'); // Yellow
      expect(fills).toContain('#EA4335'); // Red
    });

    it('should hide the decorative logo from the accessibility tree', () => {
      const { container } = render(<GoogleLoginButton />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('Styling', () => {
    it('should be a full-width pill outline button', () => {
      render(<GoogleLoginButton />);
      const button = screen.getByRole('button');
      expect(button.className).toContain('w-full');
      expect(button.className).toContain('rounded-full');
      expect(button.className).toContain('border');
      expect(button.className).toContain('h-11');
    });

    it('should have focus ring classes for accessibility', () => {
      render(<GoogleLoginButton />);
      const button = screen.getByRole('button');
      expect(button.className).toContain('focus-visible:outline-none');
      expect(button.className).toContain('focus-visible:ring-2');
      expect(button.className).toContain('focus-visible:ring-offset-2');
      expect(button.className).toContain('focus-visible:ring-brand-600');
    });
  });

  describe('User Interactions', () => {
    it('should call checkPWAInstallPrompt when button is clicked', async () => {
      const user = userEvent.setup();
      render(<GoogleLoginButton />);

      await user.click(screen.getByRole('button'));

      expect(pwaUtils.checkPWAInstallPrompt).toHaveBeenCalledTimes(1);
    });

    it('should call initiateOAuth with "google" when button is clicked', async () => {
      const user = userEvent.setup();
      render(<GoogleLoginButton />);

      await user.click(screen.getByRole('button'));

      expect(pwaUtils.initiateOAuth).toHaveBeenCalledWith('google');
      expect(pwaUtils.initiateOAuth).toHaveBeenCalledTimes(1);
    });

    it('should call PWA utilities in correct order on click', async () => {
      const callOrder: string[] = [];
      vi.mocked(pwaUtils.checkPWAInstallPrompt).mockImplementation(() => {
        callOrder.push('checkPWAInstallPrompt');
      });
      vi.mocked(pwaUtils.initiateOAuth).mockImplementation(() => {
        callOrder.push('initiateOAuth');
      });

      const user = userEvent.setup();
      render(<GoogleLoginButton />);

      await user.click(screen.getByRole('button'));

      expect(callOrder).toEqual(['checkPWAInstallPrompt', 'initiateOAuth']);
    });
  });

  describe('Accessibility', () => {
    it('should be keyboard accessible (button role)', () => {
      render(<GoogleLoginButton />);
      const button = screen.getByRole('button');
      expect(button.tagName).toBe('BUTTON');
    });

    it('should have accessible name from text content', () => {
      render(<GoogleLoginButton variant="signIn" />);
      expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
    });

    it('should be focusable', () => {
      render(<GoogleLoginButton />);
      const button = screen.getByRole('button');
      button.focus();
      expect(document.activeElement).toBe(button);
    });

    it('should trigger click on Enter key', async () => {
      const user = userEvent.setup();
      render(<GoogleLoginButton />);
      const button = screen.getByRole('button');

      button.focus();
      await user.keyboard('{Enter}');

      expect(pwaUtils.initiateOAuth).toHaveBeenCalledWith('google');
    });

    it('should trigger click on Space key', async () => {
      const user = userEvent.setup();
      render(<GoogleLoginButton />);
      const button = screen.getByRole('button');

      button.focus();
      await user.keyboard(' ');

      expect(pwaUtils.initiateOAuth).toHaveBeenCalledWith('google');
    });
  });

  describe('Prop Combinations', () => {
    it('should handle both variants without crashing', () => {
      const variants: Array<'signIn' | 'continue'> = ['signIn', 'continue'];

      variants.forEach(variant => {
        const { unmount } = render(<GoogleLoginButton variant={variant} />);
        expect(screen.getByRole('button')).toBeInTheDocument();
        unmount();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid clicks without errors', async () => {
      const user = userEvent.setup();
      render(<GoogleLoginButton />);
      const button = screen.getByRole('button');

      await user.tripleClick(button);

      expect(pwaUtils.initiateOAuth).toHaveBeenCalledTimes(3);
    });
  });
});
