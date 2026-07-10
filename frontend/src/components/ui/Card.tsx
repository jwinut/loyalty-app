import type { ElementType, HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export type CardSurface = 'card' | 'sunken' | 'tile';
export type CardPadding = 'md' | 'lg' | 'none';
export type CardElement = 'div' | 'section' | 'article';

export type CardProps = {
  surface?: CardSurface;
  padding?: CardPadding;
  as?: CardElement;
  className?: string;
  children: ReactNode;
} & HTMLAttributes<HTMLElement>;

const BASE_CLASSES = 'rounded-card border';

// Flat, always — surfaces read via border + surface color only (no elevation).
const SURFACE_CLASSES: Record<CardSurface, string> = {
  card: 'bg-surface-card border-hairline',
  sunken: 'bg-surface-sunken border-transparent',
  tile: 'bg-tile text-tile-text border-tile-border',
};

const PADDING_CLASSES: Record<CardPadding, string> = {
  md: 'p-6',
  lg: 'p-8',
  none: '',
};

export function Card({
  surface = 'card',
  padding = 'md',
  as: Component = 'div',
  className,
  children,
  ...rest
}: CardProps) {
  const Tag = Component as ElementType;
  return (
    <Tag
      data-surface={surface}
      className={cn(BASE_CLASSES, SURFACE_CLASSES[surface], PADDING_CLASSES[padding], className)}
      {...rest}
    >
      {children}
    </Tag>
  );
}
