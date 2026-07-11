import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Table } from '../Table';
import type { TableColumn } from '../Table';

type Member = {
  id: string;
  name: string;
  tier: string;
  points: number;
};

const firstMember: Member = { id: 'm1', name: 'Alice Anders', tier: 'Gold', points: 1200 };

const members: Member[] = [
  firstMember,
  { id: 'm2', name: 'Bob Baker', tier: 'Silver', points: 450 },
  { id: 'm3', name: 'Cara Cole', tier: 'Bronze', points: 80 },
];

function buildColumns(): TableColumn<Member>[] {
  return [
    { key: 'name', header: 'Name', cell: (row) => row.name },
    { key: 'tier', header: 'Tier', cell: (row) => row.tier },
    { key: 'points', header: 'Points', cell: (row) => row.points, align: 'right' },
    { key: 'internalId', header: 'Internal ID', cell: (row) => row.id, hideOnMobile: true },
  ];
}

function getDesktopTable() {
  return screen.getByRole('table');
}

function getMobileContainer(container: HTMLElement) {
  return container.querySelector('[data-view="mobile"]') as HTMLElement;
}

describe('Table', () => {
  it('should render a table with a column header per column', () => {
    render(<Table columns={buildColumns()} rows={members} rowKey={(row) => row.id} />);

    const headers = within(getDesktopTable()).getAllByRole('columnheader');
    expect(headers.map((header) => header.textContent)).toEqual(['Name', 'Tier', 'Points', 'Internal ID']);
  });

  it("should render each row's cells using the column cell renderer", () => {
    render(<Table columns={buildColumns()} rows={members} rowKey={(row) => row.id} />);

    const table = getDesktopTable();
    expect(within(table).getByText('Alice Anders')).toBeInTheDocument();
    expect(within(table).getByText('Gold')).toBeInTheDocument();
    expect(within(table).getByText('1200')).toBeInTheDocument();
  });

  it('should call rowKey for every row', () => {
    const rowKey = vi.fn((row: Member) => row.id);
    render(<Table columns={buildColumns()} rows={members} rowKey={rowKey} />);

    members.forEach((member) => expect(rowKey).toHaveBeenCalledWith(member));
  });

  describe('onRowClick', () => {
    it('should expose the desktop row with button semantics and fire onClick', async () => {
      const user = userEvent.setup();
      const handleRowClick = vi.fn();
      render(
        <Table columns={buildColumns()} rows={members} rowKey={(row) => row.id} onRowClick={handleRowClick} />
      );

      const row = within(getDesktopTable()).getByRole('button', { name: /Alice Anders/ });
      await user.click(row);

      expect(handleRowClick).toHaveBeenCalledWith(members[0]);
    });

    it('should fire onRowClick when the desktop row is activated with Enter', async () => {
      const user = userEvent.setup();
      const handleRowClick = vi.fn();
      render(
        <Table columns={buildColumns()} rows={members} rowKey={(row) => row.id} onRowClick={handleRowClick} />
      );

      within(getDesktopTable()).getByRole('button', { name: /Alice Anders/ }).focus();
      await user.keyboard('{Enter}');

      expect(handleRowClick).toHaveBeenCalledWith(members[0]);
    });

    it('should fire onRowClick when the desktop row is activated with Space', async () => {
      const user = userEvent.setup();
      const handleRowClick = vi.fn();
      render(
        <Table columns={buildColumns()} rows={members} rowKey={(row) => row.id} onRowClick={handleRowClick} />
      );

      within(getDesktopTable()).getByRole('button', { name: /Alice Anders/ }).focus();
      await user.keyboard(' ');

      expect(handleRowClick).toHaveBeenCalledWith(members[0]);
    });

    it('should make the desktop row keyboard-focusable', () => {
      render(<Table columns={buildColumns()} rows={members} rowKey={(row) => row.id} onRowClick={vi.fn()} />);

      const row = within(getDesktopTable()).getByRole('button', { name: /Alice Anders/ });
      expect(row).toHaveAttribute('tabindex', '0');
    });

    it('should not expose row button semantics when onRowClick is omitted', () => {
      render(<Table columns={buildColumns()} rows={members} rowKey={(row) => row.id} />);

      expect(within(getDesktopTable()).queryByRole('button')).not.toBeInTheDocument();
    });

    it('should also expose the mobile card with button semantics and fire onClick', async () => {
      const user = userEvent.setup();
      const handleRowClick = vi.fn();
      const { container } = render(
        <Table columns={buildColumns()} rows={members} rowKey={(row) => row.id} onRowClick={handleRowClick} />
      );

      const card = within(getMobileContainer(container)).getByRole('button', { name: /Alice Anders/ });
      await user.click(card);

      expect(handleRowClick).toHaveBeenCalledWith(members[0]);
    });
  });

  describe('mobile card layout', () => {
    it('should promote the first column to the card title and render remaining columns as label/value pairs', () => {
      const { container } = render(<Table columns={buildColumns()} rows={[firstMember]} rowKey={(row) => row.id} />);

      const mobile = getMobileContainer(container);
      expect(within(mobile).getByText('Alice Anders')).toBeInTheDocument();
      expect(within(mobile).getByText('Tier')).toBeInTheDocument();
      expect(within(mobile).getByText('Gold')).toBeInTheDocument();
      expect(within(mobile).getByText('Points')).toBeInTheDocument();
      expect(within(mobile).getByText('1200')).toBeInTheDocument();
    });

    it('should skip hideOnMobile columns in the auto layout', () => {
      const { container } = render(<Table columns={buildColumns()} rows={[firstMember]} rowKey={(row) => row.id} />);

      const mobile = getMobileContainer(container);
      expect(within(mobile).queryByText('Internal ID')).not.toBeInTheDocument();
      expect(within(mobile).queryByText('m1')).not.toBeInTheDocument();
    });

    it('should render a custom mobileCard renderer instead of the auto layout when provided', () => {
      const { container } = render(
        <Table
          columns={buildColumns()}
          rows={[firstMember]}
          rowKey={(row) => row.id}
          mobileCard={(row) => <div>Custom card for {row.name}</div>}
        />
      );

      const mobile = getMobileContainer(container);
      expect(within(mobile).getByText('Custom card for Alice Anders')).toBeInTheDocument();
      expect(within(mobile).queryByText('Tier')).not.toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('should stamp data-loading and hide row content on both layouts', () => {
      const { container } = render(<Table columns={buildColumns()} rows={members} rowKey={(row) => row.id} loading />);

      expect(container.firstChild).toHaveAttribute('data-loading', 'true');
      expect(screen.queryByText('Alice Anders')).not.toBeInTheDocument();
    });

    it('should render 5 desktop skeleton rows', () => {
      render(<Table columns={buildColumns()} rows={members} rowKey={(row) => row.id} loading />);

      // 1 header row + 5 skeleton rows
      expect(within(getDesktopTable()).getAllByRole('row')).toHaveLength(6);
    });

    it('should render 3 mobile skeleton cards', () => {
      const { container } = render(<Table columns={buildColumns()} rows={members} rowKey={(row) => row.id} loading />);

      const mobile = getMobileContainer(container);
      expect(mobile.querySelectorAll('[data-surface="card"]')).toHaveLength(3);
    });
  });

  describe('empty state', () => {
    it('should stamp data-empty and render the provided empty node in both layouts', () => {
      const { container } = render(
        <Table
          columns={buildColumns()}
          rows={[]}
          rowKey={(row) => row.id}
          empty={<p>No members match your filters</p>}
        />
      );

      expect(container.firstChild).toHaveAttribute('data-empty', 'true');
      expect(screen.getAllByText('No members match your filters')).toHaveLength(2);
    });

    it('should render a fallback message when empty is omitted', () => {
      render(<Table columns={buildColumns()} rows={[]} rowKey={(row) => row.id} />);

      expect(screen.getAllByText('No data available.').length).toBeGreaterThan(0);
    });
  });

  describe('column alignment', () => {
    it('should stamp data-align="left" by default and data-align="right" when set', () => {
      render(<Table columns={buildColumns()} rows={members} rowKey={(row) => row.id} />);

      const headers = within(getDesktopTable()).getAllByRole('columnheader');
      expect(headers[0]).toHaveAttribute('data-align', 'left');
      expect(headers[2]).toHaveAttribute('data-align', 'right');
    });
  });

  describe('aria-label', () => {
    it('should pass aria-label through to the desktop table', () => {
      render(<Table columns={buildColumns()} rows={members} rowKey={(row) => row.id} aria-label="Members" />);

      expect(screen.getByRole('table', { name: 'Members' })).toBeInTheDocument();
    });
  });
});
