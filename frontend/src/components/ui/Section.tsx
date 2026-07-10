import type { ElementType, HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export type SectionSurface = 'plain' | 'sunken' | 'tile';
export type SectionWidth = 'text' | 'page';
export type SectionSpacing = 'normal' | 'loose';
export type SectionElement = 'section' | 'div';

export type SectionProps = {
  surface?: SectionSurface;
  width?: SectionWidth;
  spacing?: SectionSpacing;
  as?: SectionElement;
  className?: string;
  innerClassName?: string;
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, 'className'>;

// plain is intentionally transparent — sections stack edge-to-edge and the
// surface change itself is the divider between them (no borders).
const SURFACE_CLASSES: Record<SectionSurface, string> = {
  plain: '',
  sunken: 'bg-surface-sunken',
  tile: 'bg-tile text-tile-text',
};

const WIDTH_CLASSES: Record<SectionWidth, string> = {
  text: 'max-w-text',
  page: 'max-w-page',
};

const SPACING_CLASSES: Record<SectionSpacing, string> = {
  normal: 'py-10',
  loose: 'py-14 lg:py-20',
};

export function Section({
  surface = 'plain',
  width = 'page',
  spacing = 'normal',
  as: Component = 'section',
  className,
  innerClassName,
  children,
  ...rest
}: SectionProps) {
  const Tag = Component as ElementType;
  return (
    <Tag
      data-surface={surface}
      className={cn(SURFACE_CLASSES[surface], SPACING_CLASSES[spacing], className)}
      {...rest}
    >
      <div className={cn('mx-auto px-4 sm:px-6', WIDTH_CLASSES[width], innerClassName)}>{children}</div>
    </Tag>
  );
}
