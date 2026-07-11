import type { ComponentPropsWithoutRef, Ref } from 'react';
import { cn } from './cn';

export type ButtonVariant = 'primary' | 'secondary' | 'utility' | 'destructive' | 'ghost';
export type ButtonSize = 'md' | 'sm' | 'icon';

export type ButtonProps = ComponentPropsWithoutRef<'button'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  ref?: Ref<HTMLButtonElement>;
};

const BASE_CLASSES =
  'inline-flex items-center justify-center gap-2 font-semibold transition select-none active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'rounded-full bg-brand-600 text-white hover:bg-brand-700',
  secondary: 'rounded-full border border-brand-600 text-brand-700 bg-transparent hover:bg-brand-50',
  utility: 'rounded-lg bg-tile text-tile-text hover:bg-tile-raised',
  destructive: 'rounded-full bg-error-600 text-white hover:bg-error-700',
  ghost: 'rounded-full text-brand-700 hover:bg-brand-50',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  md: 'h-11 px-5.5 text-body',
  sm: 'h-9 px-4 text-caption',
  icon: 'h-11 w-11 p-0',
};

type ButtonVariantsOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

/**
 * Returns the class string for a given variant/size combination without
 * rendering a `<button>` — lets non-button elements (e.g. react-router
 * `<Link>`) look like a button.
 */
export function buttonVariants({
  variant = 'primary',
  size = 'md',
  className,
}: ButtonVariantsOptions = {}): string {
  return cn(BASE_CLASSES, VARIANT_CLASSES[variant], SIZE_CLASSES[size], className);
}

function ButtonSpinner() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  type = 'button',
  className,
  disabled,
  children,
  ref,
  ...rest
}: ButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      data-variant={variant}
      data-size={size}
      aria-busy={loading || undefined}
      disabled={loading || disabled}
      className={buttonVariants({ variant, size, className })}
      {...rest}
    >
      {loading ? <ButtonSpinner /> : null}
      {children}
    </button>
  );
}
