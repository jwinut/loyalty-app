import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FiInbox } from 'react-icons/fi';
import { EmptyState } from '../EmptyState';

describe('EmptyState', () => {
  it('should render the title as a heading', () => {
    render(<EmptyState title="No bookings yet" />);

    expect(screen.getByRole('heading', { name: 'No bookings yet' })).toBeInTheDocument();
  });

  it('should render the description when provided', () => {
    render(<EmptyState title="No bookings yet" description="Book your first stay to see it here." />);

    expect(screen.getByText('Book your first stay to see it here.')).toBeInTheDocument();
  });

  it('should not render a description when omitted', () => {
    render(<EmptyState title="No bookings yet" />);

    expect(screen.queryByText('Book your first stay to see it here.')).not.toBeInTheDocument();
  });

  it('should render the icon hidden from the accessibility tree', () => {
    const { container } = render(<EmptyState title="No bookings yet" icon={FiInbox} />);

    const icon = container.querySelector('svg');
    expect(icon).toBeTruthy();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it('should not render an icon wrapper when icon is omitted', () => {
    const { container } = render(<EmptyState title="No bookings yet" />);

    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });

  it('should render the action slot', () => {
    render(<EmptyState title="No bookings yet" action={<button>Book now</button>} />);

    expect(screen.getByRole('button', { name: 'Book now' })).toBeInTheDocument();
  });

  it('should not render an action slot when omitted', () => {
    render(<EmptyState title="No bookings yet" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('should merge a caller-supplied className onto the outer wrapper', () => {
    const { container } = render(<EmptyState title="No bookings yet" className="promo-empty-marker" />);

    expect(container.firstChild).toHaveClass('promo-empty-marker');
  });
});
