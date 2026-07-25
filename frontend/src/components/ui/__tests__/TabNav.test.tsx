import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { TabNav } from '../TabNav';
import type { TabItem, TabLinkItem } from '../TabNav';

describe('TabNav', () => {
  describe('button mode', () => {
    const items: TabItem[] = [
      { value: 'active', label: 'Active', count: 3 },
      { value: 'past', label: 'Past' },
    ];

    it('should render a tablist with a tab per item', () => {
      render(<TabNav items={items} value="active" onChange={vi.fn()} />);

      expect(screen.getByRole('tablist')).toBeInTheDocument();
      expect(screen.getAllByRole('tab')).toHaveLength(2);
    });

    it('should stamp data-mode="button" on the tablist', () => {
      render(<TabNav items={items} value="active" onChange={vi.fn()} />);

      expect(screen.getByRole('tablist')).toHaveAttribute('data-mode', 'button');
    });

    it('should mark the selected tab with aria-selected="true"', () => {
      render(<TabNav items={items} value="active" onChange={vi.fn()} />);

      expect(screen.getByRole('tab', { name: /Active/ })).toHaveAttribute('aria-selected', 'true');
    });

    it('should mark unselected tabs with aria-selected="false"', () => {
      render(<TabNav items={items} value="active" onChange={vi.fn()} />);

      expect(screen.getByRole('tab', { name: 'Past' })).toHaveAttribute('aria-selected', 'false');
    });

    it('should call onChange with the tab value when a tab is clicked', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();
      render(<TabNav items={items} value="active" onChange={handleChange} />);

      await user.click(screen.getByRole('tab', { name: 'Past' }));

      expect(handleChange).toHaveBeenCalledTimes(1);
      expect(handleChange).toHaveBeenCalledWith('past');
    });

    it('should support activating a tab via the keyboard', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();
      render(<TabNav items={items} value="active" onChange={handleChange} />);

      screen.getByRole('tab', { name: 'Past' }).focus();
      await user.keyboard('{Enter}');

      expect(handleChange).toHaveBeenCalledWith('past');
    });

    it('should render an item count as a badge', () => {
      render(<TabNav items={items} value="active" onChange={vi.fn()} />);

      expect(screen.getByRole('tab', { name: /Active/ })).toHaveTextContent('3');
    });

    it('should not render a badge when count is omitted', () => {
      render(<TabNav items={items} value="active" onChange={vi.fn()} />);

      expect(screen.getByRole('tab', { name: 'Past' })).toHaveTextContent('Past');
    });

    it('should apply aria-label to the tablist', () => {
      render(<TabNav items={items} value="active" onChange={vi.fn()} aria-label="Booking status" />);

      expect(screen.getByRole('tablist', { name: 'Booking status' })).toBeInTheDocument();
    });
  });

  describe('link mode', () => {
    const linkItems: TabLinkItem[] = [
      { to: '/bookings/upcoming', label: 'Upcoming', end: true },
      { to: '/bookings/past', label: 'Past', count: 5 },
    ];

    function renderLinkNav() {
      return render(
        <MemoryRouter initialEntries={['/bookings/upcoming']}>
          <TabNav linkItems={linkItems} />
        </MemoryRouter>
      );
    }

    it('should render an anchor per link item', () => {
      renderLinkNav();

      expect(screen.getAllByRole('link')).toHaveLength(2);
    });

    it('should stamp data-mode="link"', () => {
      const { container } = renderLinkNav();

      expect(container.querySelector('[data-mode="link"]')).toBeInTheDocument();
    });

    it('should mark the link matching the current route with aria-current="page"', () => {
      renderLinkNav();

      expect(screen.getByRole('link', { name: 'Upcoming' })).toHaveAttribute('aria-current', 'page');
    });

    it('should not mark non-matching links with aria-current', () => {
      renderLinkNav();

      expect(screen.getByRole('link', { name: /Past/ })).not.toHaveAttribute('aria-current');
    });

    it('should render each link with its target href', () => {
      renderLinkNav();

      expect(screen.getByRole('link', { name: 'Upcoming' })).toHaveAttribute('href', '/bookings/upcoming');
      expect(screen.getByRole('link', { name: /Past/ })).toHaveAttribute('href', '/bookings/past');
    });

    it('should render a link item count as a badge', () => {
      renderLinkNav();

      expect(screen.getByRole('link', { name: /Past/ })).toHaveTextContent('5');
    });

    it('should apply aria-label to the link nav', () => {
      render(
        <MemoryRouter initialEntries={['/bookings/upcoming']}>
          <TabNav linkItems={linkItems} aria-label="Booking status" />
        </MemoryRouter>
      );

      expect(screen.getByRole('navigation', { name: 'Booking status' })).toBeInTheDocument();
    });
  });
});
