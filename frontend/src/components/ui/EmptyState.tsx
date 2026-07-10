import type { ComponentType, ReactNode } from 'react';
import { cn } from './cn';

export type EmptyStateIcon = ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;

export type EmptyStateProps = {
  icon?: EmptyStateIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center py-12 text-center', className)}>
      {Icon ? (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-sunken">
          <Icon className="h-6 w-6 text-ink-muted" aria-hidden />
        </div>
      ) : null}
      <h2 className="text-title text-ink">{title}</h2>
      {description ? <p className="mt-1 max-w-sm text-caption text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
