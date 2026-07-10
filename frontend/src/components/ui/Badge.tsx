import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export type BadgeTone = 'neutral' | 'brand' | 'gold' | 'success' | 'warning' | 'error' | 'info';
export type BadgeSize = 'sm' | 'md';

export type BadgeProps = {
  tone?: BadgeTone;
  size?: BadgeSize;
  className?: string;
  children: ReactNode;
} & HTMLAttributes<HTMLSpanElement>;

const BASE_CLASSES = 'inline-flex items-center gap-1 rounded-full font-semibold whitespace-nowrap';

const SIZE_CLASSES: Record<BadgeSize, string> = {
  sm: 'px-2.5 py-0.5 text-fine',
  md: 'px-3 py-1 text-caption',
};

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-sunken text-ink-muted',
  brand: 'bg-brand-50 text-brand-700',
  gold: 'bg-gold-100 text-gold-700',
  success: 'bg-success-50 text-success-700',
  warning: 'bg-warning-50 text-warning-700',
  error: 'bg-error-50 text-error-700',
  info: 'bg-info-50 text-info-700',
};

export function Badge({ tone = 'neutral', size = 'md', className, children, ...rest }: BadgeProps) {
  return (
    <span
      data-tone={tone}
      className={cn(BASE_CLASSES, SIZE_CLASSES[size], TONE_CLASSES[tone], className)}
      {...rest}
    >
      {children}
    </span>
  );
}
