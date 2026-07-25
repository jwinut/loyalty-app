import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import AdminNavRail from '../AdminNavRail';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const renderWithRouter = (initialEntries = ['/admin/loyalty']) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <AdminNavRail />
    </MemoryRouter>,
  );

describe('AdminNavRail', () => {
  it('renders all 10 admin section chips with their routes', () => {
    renderWithRouter();
    const expected: Array<[string, string]> = [
      ['adminNav.loyalty', '/admin/loyalty'],
      ['adminNav.coupons', '/admin/coupons'],
      ['adminNav.users', '/admin/users'],
      ['adminNav.surveys', '/admin/surveys'],
      ['adminNav.rooms', '/admin/rooms'],
      ['adminNav.roomTypes', '/admin/room-types'],
      ['adminNav.availability', '/admin/room-availability'],
      ['adminNav.bookings', '/admin/booking-management'],
      ['adminNav.transactions', '/admin/transaction-history'],
      ['adminNav.email', '/admin/email-service'],
    ];
    for (const [label, href] of expected) {
      expect(screen.getByRole('link', { name: label })).toHaveAttribute(
        'href',
        href,
      );
    }
  });

  it('marks the active section chip with the brand fill', () => {
    renderWithRouter(['/admin/coupons']);
    const active = screen.getByRole('link', { name: 'adminNav.coupons' });
    const inactive = screen.getByRole('link', { name: 'adminNav.users' });
    expect(active.className).toContain('bg-brand-600');
    expect(inactive.className).not.toContain('bg-brand-600');
  });

  it('renders as a horizontally-scrolling rail', () => {
    render(
      <MemoryRouter>
        <AdminNavRail />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('admin-nav-rail').className).toContain(
      'overflow-x-auto',
    );
  });
});
