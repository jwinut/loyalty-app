import type { SVGProps } from 'react';

export type MonogramArtProps = SVGProps<SVGSVGElement>;

/**
 * Placeholder monogram mark — a rounded-square tile with "HF" lettering.
 * Colored via `fill-current`/Tailwind classes (no hex literals) so tone is
 * controlled entirely through className.
 *
 * This is the ONLY file the real logo swap touches: the traced vector
 * paths from the parallel logo PR replace the shapes below without
 * changing BrandLogo's public API.
 */
export function MonogramArt({ className, ...rest }: MonogramArtProps) {
  return (
    <>
      {/* TODO(logo-pr): replace placeholder with traced vector paths */}
      <svg
        viewBox="0 0 40 40"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className={className}
        {...rest}
      >
        <rect
          width="40"
          height="40"
          rx="8"
          className="fill-current text-brand-600"
        />
        <text
          x="50%"
          y="54%"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="17"
          className="fill-surface-card font-semibold"
        >
          HF
        </text>
      </svg>
    </>
  );
}
