import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppShell from '../AppShell';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../GuestTopBar', () => ({
  default: ({ title }: { title?: string }) => (
    <div data-testid="guest-top-bar-stub">{title}</div>
  ),
}));

vi.mock('../GuestTabBar', () => ({
  default: () => <div data-testid="guest-tab-bar-stub" />,
}));

vi.mock('../AdminTopBar', () => ({
  default: ({ title }: { title?: string }) => (
    <div data-testid="admin-top-bar-stub">{title}</div>
  ),
}));

vi.mock('../AdminNavRail', () => ({
  default: () => <div data-testid="admin-nav-rail-stub" />,
}));

vi.mock('../MinimalShell', () => ({
  default: ({ children }: { children: ReactNode }) => (
    <div data-testid="minimal-shell-stub">{children}</div>
  ),
}));

vi.mock('../../profile/ProfileCompletionBanner', () => ({
  default: () => <div data-testid="profile-banner-stub" />,
}));

const renderWithRouter = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

describe('AppShell', () => {
  describe('variant="guest"', () => {
    it('renders the profile banner by default', () => {
      renderWithRouter(
        <AppShell variant="guest" title="Dashboard">
          Content
        </AppShell>,
      );
      expect(screen.getByTestId('profile-banner-stub')).toBeInTheDocument();
    });

    it('hides the profile banner when showProfileBanner is false', () => {
      renderWithRouter(
        <AppShell variant="guest" title="Dashboard" showProfileBanner={false}>
          Content
        </AppShell>,
      );
      expect(
        screen.queryByTestId('profile-banner-stub'),
      ).not.toBeInTheDocument();
    });

    it('renders GuestTopBar with the title, the children, and GuestTabBar', () => {
      renderWithRouter(
        <AppShell variant="guest" title="Dashboard">
          <div data-testid="page-content">Hello</div>
        </AppShell>,
      );
      expect(screen.getByTestId('guest-top-bar-stub')).toHaveTextContent(
        'Dashboard',
      );
      expect(screen.getByTestId('page-content')).toBeInTheDocument();
      expect(screen.getByTestId('guest-tab-bar-stub')).toBeInTheDocument();
    });

    it('hides GuestTabBar when hideTabBar is true', () => {
      renderWithRouter(
        <AppShell variant="guest" title="Take Survey" hideTabBar>
          Content
        </AppShell>,
      );
      expect(
        screen.queryByTestId('guest-tab-bar-stub'),
      ).not.toBeInTheDocument();
    });

    it('renders the privacy footer link', () => {
      renderWithRouter(
        <AppShell variant="guest" title="Dashboard">
          Content
        </AppShell>,
      );
      expect(screen.getByTestId('footer-privacy-link')).toHaveAttribute(
        'href',
        '/privacy',
      );
    });

    it('constrains content width unless fullBleed is set', () => {
      const { container, rerender } = render(
        <MemoryRouter>
          <AppShell variant="guest" title="Dashboard">
            Content
          </AppShell>
        </MemoryRouter>,
      );
      expect(container.querySelector('main')?.className).toContain(
        'max-w-page',
      );

      rerender(
        <MemoryRouter>
          <AppShell variant="guest" title="Dashboard" fullBleed>
            Content
          </AppShell>
        </MemoryRouter>,
      );
      expect(container.querySelector('main')?.className ?? '').not.toContain(
        'max-w-page',
      );
    });
  });

  describe('variant="admin"', () => {
    it('renders AdminTopBar + AdminNavRail + content with no banner and no tab bar', () => {
      renderWithRouter(
        <AppShell variant="admin" title="Loyalty">
          <div data-testid="admin-content">Admin content</div>
        </AppShell>,
      );
      expect(screen.getByTestId('admin-top-bar-stub')).toHaveTextContent(
        'Loyalty',
      );
      expect(screen.getByTestId('admin-nav-rail-stub')).toBeInTheDocument();
      expect(screen.getByTestId('admin-content')).toBeInTheDocument();
      expect(
        screen.queryByTestId('profile-banner-stub'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('guest-tab-bar-stub'),
      ).not.toBeInTheDocument();
    });
  });

  describe('variant="minimal"', () => {
    it('renders MinimalShell with the children and nothing else', () => {
      renderWithRouter(
        <AppShell variant="minimal">
          <div data-testid="minimal-content">Login form</div>
        </AppShell>,
      );
      expect(screen.getByTestId('minimal-shell-stub')).toBeInTheDocument();
      expect(screen.getByTestId('minimal-content')).toBeInTheDocument();
      expect(
        screen.queryByTestId('guest-top-bar-stub'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('admin-top-bar-stub'),
      ).not.toBeInTheDocument();
    });
  });
});
