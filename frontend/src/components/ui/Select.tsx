import type { ComponentPropsWithoutRef, Ref } from 'react';
import { cn } from './cn';

export type SelectProps = ComponentPropsWithoutRef<'select'> & {
  /** Sets aria-invalid and swaps the border/ring to the error tone. */
  invalid?: boolean;
  ref?: Ref<HTMLSelectElement>;
};

const BASE_CLASSES =
  'h-11 w-full rounded-lg border border-hairline-strong bg-surface-card px-3 text-body text-ink transition focus:outline-none focus:ring-2 focus:border-brand-600 focus:ring-brand-600 disabled:opacity-50 disabled:pointer-events-none';

const INVALID_CLASSES = 'border-error-600 focus:border-error-600 focus:ring-error-600';

export function Select({ invalid = false, className, ref, ...rest }: SelectProps) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(BASE_CLASSES, invalid ? INVALID_CLASSES : undefined, className)}
      {...rest}
    />
  );
}
