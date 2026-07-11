import type { JSX, KeyboardEvent, ReactNode } from 'react';
import { Card } from './Card';
import { Skeleton } from './Skeleton';
import { cn } from './cn';

export type TableColumnAlign = 'left' | 'right';

export type TableColumn<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** @default 'left' */
  align?: TableColumnAlign;
  /** Omit this column from the auto-generated mobile card. */
  hideOnMobile?: boolean;
};

export type TableProps<T> = {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Makes the desktop row and mobile card clickable (button semantics, keyboard operable). */
  onRowClick?: (row: T) => void;
  /** Custom mobile card renderer; falls back to an auto label/value layout. */
  mobileCard?: (row: T) => ReactNode;
  stickyHeader?: boolean;
  /** Rendered when rows is empty (pages usually pass an <EmptyState/>). */
  empty?: ReactNode;
  /** Renders Skeleton rows/cards instead of content. */
  loading?: boolean;
  'aria-label'?: string;
  className?: string;
};

const DESKTOP_SKELETON_ROW_COUNT = 5;
const MOBILE_SKELETON_CARD_COUNT = 3;
const DEFAULT_EMPTY_MESSAGE = 'No data available.';

const HEADER_CELL_CLASSES = 'text-fine font-semibold uppercase tracking-wider text-ink-muted px-4 py-3';
const BODY_CELL_CLASSES = 'px-4 py-3 text-caption text-ink';
const INTERACTIVE_ROW_CLASSES =
  'cursor-pointer hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-inset';

type RowInteractionProps = {
  role?: 'button';
  tabIndex?: number;
  onClick?: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
};

function isActivationKey(key: string): boolean {
  return key === 'Enter' || key === ' ';
}

/** Row + mobile card share this: click/Enter/Space activation with button semantics. */
function buildRowInteractionProps<T>(row: T, onRowClick?: (row: T) => void): RowInteractionProps {
  if (!onRowClick) {
    return {};
  }
  return {
    role: 'button',
    tabIndex: 0,
    onClick: () => onRowClick(row),
    onKeyDown: (event) => {
      if (!isActivationKey(event.key)) {
        return;
      }
      event.preventDefault();
      onRowClick(row);
    },
  };
}

function resolveAlign(align?: TableColumnAlign): TableColumnAlign {
  return align ?? 'left';
}

function renderEmptyContent(empty?: ReactNode): ReactNode {
  return empty ?? <p className="py-8 text-center text-caption text-ink-muted">{DEFAULT_EMPTY_MESSAGE}</p>;
}

function TableHeaderCell<T>({
  column,
  stickyHeader,
}: {
  column: TableColumn<T>;
  stickyHeader: boolean;
}) {
  const align = resolveAlign(column.align);
  return (
    <th
      scope="col"
      data-align={align}
      className={cn(HEADER_CELL_CLASSES, align === 'right' && 'text-right', stickyHeader && 'sticky top-0 z-10')}
    >
      {column.header}
    </th>
  );
}

function TableBodyCell<T>({ column, row }: { column: TableColumn<T>; row: T }) {
  const align = resolveAlign(column.align);
  return (
    <td data-align={align} className={cn(BODY_CELL_CLASSES, align === 'right' && 'text-right')}>
      {column.cell(row)}
    </td>
  );
}

function DesktopBodyRow<T>({
  row,
  columns,
  onRowClick,
}: {
  row: T;
  columns: TableColumn<T>[];
  onRowClick?: (row: T) => void;
}) {
  const interactionProps = buildRowInteractionProps(row, onRowClick);
  return (
    <tr className={cn(onRowClick && INTERACTIVE_ROW_CLASSES)} {...interactionProps}>
      {columns.map((column) => (
        <TableBodyCell key={column.key} column={column} row={row} />
      ))}
    </tr>
  );
}

function DesktopSkeletonRows({ columnCount }: { columnCount: number }) {
  return (
    <>
      {Array.from({ length: DESKTOP_SKELETON_ROW_COUNT }, (_, rowIndex) => (
        <tr key={`table-skeleton-row-${rowIndex}`}>
          {Array.from({ length: columnCount }, (_, cellIndex) => (
            <td key={`table-skeleton-cell-${rowIndex}-${cellIndex}`} className={BODY_CELL_CLASSES}>
              <Skeleton className="h-4 w-full" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function AutoMobileCardBody<T>({ row, columns }: { row: T; columns: TableColumn<T>[] }) {
  const visibleColumns = columns.filter((column) => !column.hideOnMobile);
  const [titleColumn, ...detailColumns] = visibleColumns;

  if (!titleColumn) {
    return null;
  }

  return (
    <div className="space-y-2">
      <p className="text-body font-semibold text-ink">{titleColumn.cell(row)}</p>
      {detailColumns.map((column) => (
        <div key={column.key} className="flex items-center justify-between gap-4">
          <span className="text-fine text-ink-muted">{column.header}</span>
          <span className="text-caption text-ink text-right">{column.cell(row)}</span>
        </div>
      ))}
    </div>
  );
}

function MobileRowCard<T>({
  row,
  columns,
  mobileCard,
  onRowClick,
}: {
  row: T;
  columns: TableColumn<T>[];
  mobileCard?: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
}) {
  const interactionProps = buildRowInteractionProps(row, onRowClick);
  return (
    <Card padding="md" className={cn(onRowClick && INTERACTIVE_ROW_CLASSES)} {...interactionProps}>
      {mobileCard ? mobileCard(row) : <AutoMobileCardBody row={row} columns={columns} />}
    </Card>
  );
}

function MobileSkeletonCards() {
  return (
    <>
      {Array.from({ length: MOBILE_SKELETON_CARD_COUNT }, (_, index) => (
        <Card key={`table-mobile-skeleton-${index}`} padding="md" className="space-y-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
        </Card>
      ))}
    </>
  );
}

export function Table<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  mobileCard,
  stickyHeader = false,
  empty,
  loading = false,
  className,
  'aria-label': ariaLabel,
}: TableProps<T>): JSX.Element {
  const isEmpty = !loading && rows.length === 0;

  return (
    <div className={cn(className)} data-loading={loading || undefined} data-empty={isEmpty || undefined}>
      <div
        data-view="desktop"
        className="hidden md:block overflow-x-auto rounded-card border border-hairline bg-surface-card"
      >
        <table className="min-w-full" aria-label={ariaLabel}>
          <thead>
            <tr className="bg-surface-sunken">
              {columns.map((column) => (
                <TableHeaderCell key={column.key} column={column} stickyHeader={stickyHeader} />
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {loading ? (
              <DesktopSkeletonRows columnCount={columns.length} />
            ) : isEmpty ? (
              <tr>
                <td colSpan={columns.length} className={BODY_CELL_CLASSES}>
                  {renderEmptyContent(empty)}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <DesktopBodyRow key={rowKey(row)} row={row} columns={columns} onRowClick={onRowClick} />
              ))
            )}
          </tbody>
        </table>
      </div>

      <div data-view="mobile" className="md:hidden space-y-3">
        {loading ? (
          <MobileSkeletonCards />
        ) : isEmpty ? (
          <div>{renderEmptyContent(empty)}</div>
        ) : (
          rows.map((row) => (
            <MobileRowCard
              key={rowKey(row)}
              row={row}
              columns={columns}
              mobileCard={mobileCard}
              onRowClick={onRowClick}
            />
          ))
        )}
      </div>
    </div>
  );
}
