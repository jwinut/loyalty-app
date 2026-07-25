import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import GuestTopBar from '../GuestTopBar';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../LanguageSwitcher', () => ({
  default: () => <div data-testid="language-switcher">Language Switcher</div>,
}));

vi.mock('../../notifications/NotificationCenter', () => ({
  default: () => <div data-testid="notification-center">Notifications</div>,
}));

const renderWithRouter = (
  ui: React.ReactElement,
  initialEntries = ['/dashboard'],
) => render(<MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>);

describe('GuestTopBar', () => {
  it('renders the brand monogram linking to /dashboard', () => {
    const { container } = renderWithRouter(<GuestTopBar />);
    const brandLink = container.querySelector('a[href="/dashboard"]');
    expect(brandLink).toBeInTheDocument();
    expect(brandLink?.querySelector('svg')).toBeInTheDocument();
  });

  it('shows the page title (for narrow viewports where nav links are hidden)', () => {
    renderWithRouter(<GuestTopBar title="My Page" />);
    expect(screen.getByText('My Page')).toBeInTheDocument();
  });

  it('renders all five desktop nav links to their routes', () => {
    renderWithRouter(<GuestTopBar />);
    expect(screen.getByRole('link', { name: 'nav.home' })).toHaveAttribute(
      'href',
      '/dashboard',
    );
    expect(
      screen.getByRole('link', { name: 'nav.memberCard' }),
    ).toHaveAttribute('href', '/member-card');
    expect(screen.getByRole('link', { name: 'nav.coupons' })).toHaveAttribute(
      'href',
      '/coupons',
    );
    expect(screen.getByRole('link', { name: 'nav.bookings' })).toHaveAttribute(
      'href',
      '/my-bookings',
    );
    expect(screen.getByRole('link', { name: 'nav.surveys' })).toHaveAttribute(
      'href',
      '/surveys',
    );
  });

  it('marks the current route nav link as active via aria-current', () => {
    renderWithRouter(<GuestTopBar />, ['/coupons']);
    expect(screen.getByRole('link', { name: 'nav.coupons' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'nav.home' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('renders the language switcher and notification center', () => {
    renderWithRouter(<GuestTopBar />);
    expect(screen.getByTestId('language-switcher')).toBeInTheDocument();
    expect(screen.getByTestId('notification-center')).toBeInTheDocument();
  });

  it('renders a profile chip linking to /profile', () => {
    renderWithRouter(<GuestTopBar />);
    expect(screen.getByTestId('guest-top-bar-profile-chip')).toHaveAttribute(
      'href',
      '/profile',
    );
  });

  it('is sticky, never fixed', () => {
    const { container } = renderWithRouter(<GuestTopBar />);
    const header = container.querySelector('header');
    expect(header?.className).toContain('sticky');
    expect(header?.className).not.toContain('fixed');
  });
});
