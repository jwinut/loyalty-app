import type { ComponentPropsWithoutRef, Ref } from 'react';
import { cn } from './cn';

export type TextareaProps = ComponentPropsWithoutRef<'textarea'> & {
  /** Sets aria-invalid and swaps the border/ring to the error tone. */
  invalid?: boolean;
  ref?: Ref<HTMLTextAreaElement>;
};

const BASE_CLASSES =
  'min-h-[6rem] w-full rounded-lg border border-hairline-strong bg-surface-card px-3 py-2 text-body text-ink placeholder:text-ink-faint transition focus:outline-none focus:ring-2 focus:border-brand-600 focus:ring-brand-600 disabled:opacity-50 disabled:pointer-events-none';

const INVALID_CLASSES = 'border-error-600 focus:border-error-600 focus:ring-error-600';

export function Textarea({ invalid = false, className, ref, ...rest }: TextareaProps) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(BASE_CLASSES, invalid ? INVALID_CLASSES : undefined, className)}
      {...rest}
    />
  );
}
