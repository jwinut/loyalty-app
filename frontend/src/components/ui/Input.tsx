import type { ComponentPropsWithoutRef, ReactNode, Ref } from 'react';
import { cn } from './cn';

export type InputShape = 'field' | 'pill';

export type InputProps = ComponentPropsWithoutRef<'input'> & {
  /** 'field' (rounded-lg) is the default; 'pill' (rounded-full) is for search inputs. */
  shape?: InputShape;
  /** Sets aria-invalid and swaps the border/ring to the error tone. */
  invalid?: boolean;
  /** Renders inside the input's left inset (e.g. an FiMail/FiLock prefix). */
  leadingIcon?: ReactNode;
  /** Renders inside the input's right inset — must accommodate a 44px button. */
  trailingSlot?: ReactNode;
  ref?: Ref<HTMLInputElement>;
};

const BASE_CLASSES =
  'h-11 w-full border border-hairline-strong bg-surface-card px-3 text-body text-ink placeholder:text-ink-faint transition focus:outline-none focus:ring-2 focus:border-brand-600 focus:ring-brand-600 disabled:opacity-50 disabled:pointer-events-none';

const SHAPE_CLASSES: Record<InputShape, string> = {
  field: 'rounded-lg',
  pill: 'rounded-full',
};

const INVALID_CLASSES = 'border-error-600 focus:border-error-600 focus:ring-error-600';

export function Input({
  shape = 'field',
  invalid = false,
  leadingIcon,
  trailingSlot,
  className,
  ref,
  ...rest
}: InputProps) {
  const inputElement = (
    <input
      ref={ref}
      data-shape={shape}
      aria-invalid={invalid || undefined}
      className={cn(
        BASE_CLASSES,
        SHAPE_CLASSES[shape],
        leadingIcon ? 'pl-10' : undefined,
        trailingSlot ? 'pr-11' : undefined,
        invalid ? INVALID_CLASSES : undefined,
        className
      )}
      {...rest}
    />
  );

  if (!leadingIcon && !trailingSlot) {
    return inputElement;
  }

  return (
    <div className="relative">
      {leadingIcon ? (
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-faint">
          {leadingIcon}
        </span>
      ) : null}
      {inputElement}
      {trailingSlot ? (
        <span className="absolute inset-y-0 right-0 flex items-center">{trailingSlot}</span>
      ) : null}
    </div>
  );
}
