import { cn } from '../ui/cn';
import { MonogramArt } from './logo-art';

export type BrandLogoVariant = 'monogram' | 'wordmark' | 'lockup';
export type BrandLogoTone = 'onLight' | 'onDark';

export type BrandLogoProps = {
  variant?: BrandLogoVariant;
  tone?: BrandLogoTone;
  className?: string;
};

const WORDMARK_TEXT = 'The Harbour Front Hotel';

// tone switches ink↔white text classes; the monogram tile itself is a
// fixed brand-colored badge and doesn't need to adjust with tone.
const TONE_WORDMARK_CLASSES: Record<BrandLogoTone, string> = {
  onLight: 'text-ink',
  onDark: 'text-tile-text',
};

function Monogram({ className }: { className?: string }) {
  return <MonogramArt className={cn('h-8 w-8 shrink-0', className)} />;
}

function Wordmark({
  tone,
  className,
}: {
  tone: BrandLogoTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'text-fine font-semibold uppercase tracking-widest',
        TONE_WORDMARK_CLASSES[tone],
        className,
      )}
    >
      {WORDMARK_TEXT}
    </span>
  );
}

/**
 * Brand mark — monogram, wordmark, or the lockup (monogram + wordmark row).
 *
 * PLACEHOLDER: the monogram is inline placeholder art (see `logo-art.tsx`).
 * Real traced vector paths land in a parallel logo PR and only that file
 * changes — this component's API is swap-ready.
 */
export function BrandLogo({
  variant = 'lockup',
  tone = 'onLight',
  className,
}: BrandLogoProps) {
  if (variant === 'monogram') {
    return <Monogram className={className} />;
  }

  if (variant === 'wordmark') {
    return <Wordmark tone={tone} className={className} />;
  }

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <Monogram />
      <Wordmark tone={tone} />
    </span>
  );
}

export default BrandLogo;
