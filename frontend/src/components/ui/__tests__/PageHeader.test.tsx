import type { ReactElement } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { PageHeader } from '../PageHeader';
import type { PageHeaderDensity } from '../PageHeader';

function renderPageHeader(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('PageHeader', () => {
  it('should render the title as a heading', () => {
    renderPageHeader(<PageHeader title="My bookings" />);

    expect(screen.getByRole('heading', { name: 'My bookings' })).toBeInTheDocument();
  });

  it('should render the subtitle when provided', () => {
    renderPageHeader(<PageHeader title="My bookings" subtitle="3 upcoming stays" />);

    expect(screen.getByText('3 upcoming stays')).toBeInTheDocument();
  });

  it('should not render a subtitle when omitted', () => {
    renderPageHeader(<PageHeader title="My bookings" />);

    expect(screen.queryByText('3 upcoming stays')).not.toBeInTheDocument();
  });

  it('should default to data-density="guest"', () => {
    const { container } = renderPageHeader(<PageHeader title="My bookings" />);

    expect(container.firstChild).toHaveAttribute('data-density', 'guest');
  });

  const densities: PageHeaderDensity[] = ['guest', 'admin'];
  it.each(densities)('should stamp data-density="%s" when density is set', (density) => {
    const { container } = renderPageHeader(<PageHeader title="My bookings" density={density} />);

    expect(container.firstChild).toHaveAttribute('data-density', density);
  });

  it('should not render a back link when backTo is omitted', () => {
    renderPageHeader(<PageHeader title="My bookings" />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('should render an accessible back link pointing to backTo', () => {
    renderPageHeader(<PageHeader title="Booking detail" backTo="/bookings" />);

    const backLink = screen.getByRole('link');
    expect(backLink).toHaveAttribute('href', '/bookings');
    expect(backLink).toHaveAccessibleName();
  });

  it('should render the actions slot', () => {
    renderPageHeader(<PageHeader title="My bookings" actions={<button>New booking</button>} />);

    expect(screen.getByRole('button', { name: 'New booking' })).toBeInTheDocument();
  });

  it('should merge a caller-supplied className onto the outer wrapper', () => {
    const { container } = renderPageHeader(
      <PageHeader title="My bookings" className="promo-header-marker" />
    );

    expect(container.firstChild).toHaveClass('promo-header-marker');
  });
});
