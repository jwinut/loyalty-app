import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GuestTabBar from '../GuestTabBar';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const renderWithRouter = (initialEntries = ['/dashboard']) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <GuestTabBar />
    </MemoryRouter>,
  );

describe('GuestTabBar', () => {
  it('renders the guest-tab-bar container', () => {
    renderWithRouter();
    expect(screen.getByTestId('guest-tab-bar')).toBeInTheDocument();
  });

  it('renders exactly 5 tabs with the expected testids and routes', () => {
    renderWithRouter();
    expect(screen.getByTestId('tab-home')).toHaveAttribute(
      'href',
      '/dashboard',
    );
    expect(screen.getByTestId('tab-card')).toHaveAttribute(
      'href',
      '/member-card',
    );
    expect(screen.getByTestId('tab-coupons')).toHaveAttribute(
      'href',
      '/coupons',
    );
    expect(screen.getByTestId('tab-bookings')).toHaveAttribute(
      'href',
      '/my-bookings',
    );
    expect(screen.getByTestId('tab-profile')).toHaveAttribute(
      'href',
      '/profile',
    );
  });

  it('marks the active tab with aria-current="page"', () => {
    renderWithRouter(['/coupons']);
    expect(screen.getByTestId('tab-coupons')).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByTestId('tab-home')).not.toHaveAttribute('aria-current');
  });

  it('applies the active brand color class only to the current tab', () => {
    renderWithRouter(['/my-bookings']);
    expect(screen.getByTestId('tab-bookings').className).toContain(
      'text-brand-600',
    );
    expect(screen.getByTestId('tab-home').className).toContain(
      'text-ink-muted',
    );
  });

  it('is hidden at lg+ and fixed to the viewport bottom', () => {
    const { container } = renderWithRouter();
    const nav = container.querySelector('nav');
    expect(nav?.className).toContain('lg:hidden');
    expect(nav?.className).toContain('fixed');
    expect(nav?.className).toContain('bottom-0');
  });
});
