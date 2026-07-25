import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { FiChevronLeft } from 'react-icons/fi';
import { cn } from './cn';

export type PageHeaderDensity = 'guest' | 'admin';

export type PageHeaderProps = {
  title: string;
  subtitle?: string;
  backTo?: string;
  actions?: ReactNode;
  density?: PageHeaderDensity;
  className?: string;
};

// guest pages lead with the larger display size; admin pages stay compact.
const TITLE_CLASSES: Record<PageHeaderDensity, string> = {
  guest: 'text-display',
  admin: 'text-title',
};

export function PageHeader({
  title,
  subtitle,
  backTo,
  actions,
  density = 'guest',
  className,
}: PageHeaderProps) {
  return (
    <div
      data-density={density}
      className={cn('mb-6 flex flex-wrap items-start justify-between gap-4', className)}
    >
      <div className="flex items-start gap-3">
        {backTo ? (
          <Link
            to={backTo}
            aria-label="Back"
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-ink hover:bg-surface-sunken"
          >
            <FiChevronLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
        ) : null}
        <div>
          <h1 className={cn('text-ink', TITLE_CLASSES[density])}>{title}</h1>
          {subtitle ? <p className="text-caption text-ink-muted">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
