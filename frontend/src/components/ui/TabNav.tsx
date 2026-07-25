import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import { Badge } from './Badge';
import { cn } from './cn';

export type TabItem = {
  value: string;
  label: ReactNode;
  count?: number;
};

export type TabLinkItem = {
  to: string;
  label: ReactNode;
  count?: number;
  end?: boolean;
};

type TabNavButtonProps = {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  'aria-label'?: string;
  className?: string;
};

type TabNavLinkProps = {
  linkItems: TabLinkItem[];
  'aria-label'?: string;
  className?: string;
};

export type TabNavProps = TabNavButtonProps | TabNavLinkProps;

function isLinkMode(props: TabNavProps): props is TabNavLinkProps {
  return 'linkItems' in props;
}

// Scrollable on mobile with the scrollbar itself hidden — overflow is still
// reachable by touch/drag, just visually quiet.
const SCROLL_CONTAINER_CLASSES =
  'flex items-stretch gap-6 overflow-x-auto border-b border-hairline [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

const TAB_BASE_CLASSES =
  'relative flex min-h-11 items-center gap-2 whitespace-nowrap px-1 text-caption font-semibold transition-colors';

const ACTIVE_TAB_CLASSES =
  'text-brand-700 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-brand-600';
const INACTIVE_TAB_CLASSES = 'text-ink-muted hover:text-ink';

function TabCount({ count }: { count?: number }) {
  if (count === undefined) {
    return null;
  }
  return (
    <Badge tone="neutral" size="sm">
      {count}
    </Badge>
  );
}

export function TabNav(props: TabNavProps) {
  if (isLinkMode(props)) {
    const { linkItems, className, ...rest } = props;
    return (
      <nav
        data-mode="link"
        aria-label={rest['aria-label']}
        className={cn(SCROLL_CONTAINER_CLASSES, className)}
      >
        {linkItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(TAB_BASE_CLASSES, isActive ? ACTIVE_TAB_CLASSES : INACTIVE_TAB_CLASSES)
            }
          >
            {item.label}
            <TabCount count={item.count} />
          </NavLink>
        ))}
      </nav>
    );
  }

  const { items, value, onChange, className, ...rest } = props;
  return (
    <div
      role="tablist"
      data-mode="button"
      aria-label={rest['aria-label']}
      className={cn(SCROLL_CONTAINER_CLASSES, className)}
    >
      {items.map((item) => {
        const isActive = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={cn(TAB_BASE_CLASSES, isActive ? ACTIVE_TAB_CLASSES : INACTIVE_TAB_CLASSES)}
            onClick={() => onChange(item.value)}
          >
            {item.label}
            <TabCount count={item.count} />
          </button>
        );
      })}
    </div>
  );
}
