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

// tone switches ink↔parchment. The monogram's black layer inherits it via
// fill-current; the crimson H is fixed brand-600 on every surface.
const TONE_WORDMARK_CLASSES: Record<BrandLogoTone, string> = {
  onLight: 'text-ink',
  onDark: 'text-tile-text',
};

function Monogram({
  tone,
  className,
}: {
  tone: BrandLogoTone;
  className?: string;
}) {
  return (
    <MonogramArt
      className={cn('h-8 w-8 shrink-0', TONE_WORDMARK_CLASSES[tone], className)}
    />
  );
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
 * The monogram is a faithful 1:1 vector trace of the hotel's original
 * logo artwork (see `logo-art.tsx`); the wordmark is the hotel name as
 * styled text.
 */
export function BrandLogo({
  variant = 'lockup',
  tone = 'onLight',
  className,
}: BrandLogoProps) {
  if (variant === 'monogram') {
    return <Monogram tone={tone} className={className} />;
  }

  if (variant === 'wordmark') {
    return <Wordmark tone={tone} className={className} />;
  }

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <Monogram tone={tone} />
      <Wordmark tone={tone} />
    </span>
  );
}

export default BrandLogo;
