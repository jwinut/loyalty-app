import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MainLayout from '../MainLayout';

// MainLayout is a thin AppShell(variant="guest") wrapper — these tests
// assert on rendered behavior (title, children, banner, shell chrome),
// not on markup of a specific header/footer implementation.

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../LanguageSwitcher', () => ({
  default: () => <div data-testid="language-switcher">Language Switcher</div>,
}));

vi.mock('../../profile/ProfileCompletionBanner', () => ({
  default: () => (
    <div data-testid="profile-completion-banner">Profile Banner</div>
  ),
}));

vi.mock('../../navigation/DashboardButton', () => ({
  default: ({ variant, size }: { variant: string; size: string }) => (
    <button
      data-testid="dashboard-button"
      data-variant={variant}
      data-size={size}
    >
      Dashboard
    </button>
  ),
}));

vi.mock('../../notifications/NotificationCenter', () => ({
  default: () => <div data-testid="notification-center">Notifications</div>,
}));

const renderWithRouter = (component: React.ReactElement) =>
  render(<MemoryRouter>{component}</MemoryRouter>);

describe('MainLayout', () => {
  describe('Basic Rendering', () => {
    it('renders the title', () => {
      renderWithRouter(<MainLayout title="Test Page">Content</MainLayout>);
      expect(screen.getByText('Test Page')).toBeInTheDocument();
    });

    it('renders children content', () => {
      renderWithRouter(<MainLayout title="Test">Test Content</MainLayout>);
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('renders children inside the shell content area', () => {
      renderWithRouter(
        <MainLayout title="Test">
          <div data-testid="child-content">Child Component</div>
        </MainLayout>,
      );
      expect(screen.getByTestId('child-content')).toBeInTheDocument();
    });

    it('allows complex children components', () => {
      renderWithRouter(
        <MainLayout title="Test">
          <div>
            <h2>Section Title</h2>
            <p>Section Content</p>
            <button>Action</button>
          </div>
        </MainLayout>,
      );
      expect(screen.getByText('Section Title')).toBeInTheDocument();
      expect(screen.getByText('Section Content')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Action' }),
      ).toBeInTheDocument();
    });
  });

  describe('Guest shell chrome', () => {
    it('renders the guest top bar and bottom tab bar', () => {
      renderWithRouter(<MainLayout title="Test">Content</MainLayout>);
      expect(screen.getByTestId('guest-top-bar')).toBeInTheDocument();
      expect(screen.getByTestId('guest-tab-bar')).toBeInTheDocument();
    });

    it('renders the language switcher and notification center', () => {
      renderWithRouter(<MainLayout title="Test">Content</MainLayout>);
      expect(screen.getByTestId('language-switcher')).toBeInTheDocument();
      expect(screen.getByTestId('notification-center')).toBeInTheDocument();
    });

    it('renders the footer privacy link', () => {
      renderWithRouter(<MainLayout title="Test">Content</MainLayout>);
      expect(screen.getByTestId('footer-privacy-link')).toHaveAttribute(
        'href',
        '/privacy',
      );
    });
  });

  describe('Profile Completion Banner', () => {
    it('shows the profile banner by default', () => {
      renderWithRouter(<MainLayout title="Test">Content</MainLayout>);
      expect(
        screen.getByTestId('profile-completion-banner'),
      ).toBeInTheDocument();
    });

    it('shows the profile banner when showProfileBanner is true', () => {
      renderWithRouter(
        <MainLayout title="Test" showProfileBanner={true}>
          Content
        </MainLayout>,
      );
      expect(
        screen.getByTestId('profile-completion-banner'),
      ).toBeInTheDocument();
    });

    it('hides the profile banner when showProfileBanner is false', () => {
      renderWithRouter(
        <MainLayout title="Test" showProfileBanner={false}>
          Content
        </MainLayout>,
      );
      expect(
        screen.queryByTestId('profile-completion-banner'),
      ).not.toBeInTheDocument();
    });
  });

  describe('Prop Combinations', () => {
    it('handles long titles without breaking rendering', () => {
      const longTitle =
        'This is a Very Long Page Title That Should Still Display Properly';
      renderWithRouter(<MainLayout title={longTitle}>Content</MainLayout>);
      expect(screen.getByText(longTitle)).toBeInTheDocument();
    });

    it('handles empty children', () => {
      renderWithRouter(<MainLayout title="Test">{null}</MainLayout>);
      expect(screen.getByText('Test')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('uses a semantic header element', () => {
      const { container } = renderWithRouter(
        <MainLayout title="Test">Content</MainLayout>,
      );
      expect(container.querySelector('header')).toBeInTheDocument();
    });

    it('uses a semantic main element', () => {
      const { container } = renderWithRouter(
        <MainLayout title="Test">Content</MainLayout>,
      );
      expect(container.querySelector('main')).toBeInTheDocument();
    });
  });
});
