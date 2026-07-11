import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LineLoginButton from '../LineLoginButton';
import * as pwaUtils from '../../../utils/pwaUtils';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'auth.signInWithLine': 'Sign in with LINE',
        'auth.continueWithLine': 'Continue with LINE',
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

describe('LineLoginButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render button with default "Sign in with LINE" text', () => {
      render(<LineLoginButton />);
      expect(screen.getByRole('button', { name: /sign in with line/i })).toBeInTheDocument();
    });

    it('should render button with "Continue with LINE" text when variant is continue', () => {
      render(<LineLoginButton variant="continue" />);
      expect(screen.getByRole('button', { name: /continue with line/i })).toBeInTheDocument();
    });

    it('should render button with "Sign in with LINE" text when variant is signIn', () => {
      render(<LineLoginButton variant="signIn" />);
      expect(screen.getByRole('button', { name: /sign in with line/i })).toBeInTheDocument();
    });

    it('should render the LINE logo SVG', () => {
      const { container } = render(<LineLoginButton />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
    });

    it('should render the LINE logo in LINE brand green now that the button itself is a neutral pill', () => {
      const { container } = render(<LineLoginButton />);
      const svg = container.querySelector('svg');
      expect(svg?.getAttribute('fill')).toBe('#06C755');
    });

    it('should hide the decorative logo from the accessibility tree', () => {
      const { container } = render(<LineLoginButton />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });

    it('should render the LINE logo path element', () => {
      const { container } = render(<LineLoginButton />);
      const path = container.querySelector('path');
      expect(path).toBeInTheDocument();
      expect(path?.getAttribute('d')).toBeTruthy();
    });
  });

  describe('Styling', () => {
    it('should be a full-width pill outline button', () => {
      render(<LineLoginButton />);
      const button = screen.getByRole('button');
      expect(button.className).toContain('w-full');
      expect(button.className).toContain('rounded-full');
      expect(button.className).toContain('border');
      expect(button.className).toContain('h-11');
    });

    it('should have focus ring classes for accessibility', () => {
      render(<LineLoginButton />);
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
      render(<LineLoginButton />);

      await user.click(screen.getByRole('button'));

      expect(pwaUtils.checkPWAInstallPrompt).toHaveBeenCalledTimes(1);
    });

    it('should call initiateOAuth with "line" when button is clicked', async () => {
      const user = userEvent.setup();
      render(<LineLoginButton />);

      await user.click(screen.getByRole('button'));

      expect(pwaUtils.initiateOAuth).toHaveBeenCalledWith('line');
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
      render(<LineLoginButton />);

      await user.click(screen.getByRole('button'));

      expect(callOrder).toEqual(['checkPWAInstallPrompt', 'initiateOAuth']);
    });
  });

  describe('Accessibility', () => {
    it('should be keyboard accessible (button role)', () => {
      render(<LineLoginButton />);
      const button = screen.getByRole('button');
      expect(button.tagName).toBe('BUTTON');
    });

    it('should have accessible name from text content', () => {
      render(<LineLoginButton variant="signIn" />);
      expect(screen.getByRole('button', { name: /sign in with line/i })).toBeInTheDocument();
    });

    it('should be focusable', () => {
      render(<LineLoginButton />);
      const button = screen.getByRole('button');
      button.focus();
      expect(document.activeElement).toBe(button);
    });

    it('should trigger click on Enter key', async () => {
      const user = userEvent.setup();
      render(<LineLoginButton />);
      const button = screen.getByRole('button');

      button.focus();
      await user.keyboard('{Enter}');

      expect(pwaUtils.initiateOAuth).toHaveBeenCalledWith('line');
    });

    it('should trigger click on Space key', async () => {
      const user = userEvent.setup();
      render(<LineLoginButton />);
      const button = screen.getByRole('button');

      button.focus();
      await user.keyboard(' ');

      expect(pwaUtils.initiateOAuth).toHaveBeenCalledWith('line');
    });
  });

  describe('Prop Combinations', () => {
    it('should handle both variants without crashing', () => {
      const variants: Array<'signIn' | 'continue'> = ['signIn', 'continue'];

      variants.forEach(variant => {
        const { unmount } = render(<LineLoginButton variant={variant} />);
        expect(screen.getByRole('button')).toBeInTheDocument();
        unmount();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid clicks without errors', async () => {
      const user = userEvent.setup();
      render(<LineLoginButton />);
      const button = screen.getByRole('button');

      await user.tripleClick(button);

      expect(pwaUtils.initiateOAuth).toHaveBeenCalledTimes(3);
    });
  });

  describe('Brand Compliance', () => {
    it('should keep the LINE brand green on the logo', () => {
      const { container } = render(<LineLoginButton />);
      const svg = container.querySelector('svg');
      expect(svg?.getAttribute('fill')).toBe('#06C755');
    });
  });
});
