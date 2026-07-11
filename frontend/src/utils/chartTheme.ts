/**
 * Chart.js global theme — the sanctioned chart-color source.
 *
 * Chart.js renders to `<canvas>`, so it cannot consume Tailwind design
 * tokens directly (no `bg-brand-600`, no CSS custom properties resolved at
 * paint time). The constants below are the canvas-side mirror of the warm
 * crimson/gold design system defined in `tailwind.config.js` — this is the
 * ONE file in the app allowed to hold raw hex chart-data constants.
 * `scripts/check-design.cjs` counts hardcoded-hex literals repo-wide against
 * a committed baseline; if adding/changing a constant here increases that
 * count, run `node scripts/check-design.cjs --update` and justify the
 * increase in the commit body as chart-data constants (Chart.js has no
 * token-based alternative). Do not hardcode chart colors anywhere else —
 * import from this module instead.
 *
 * Palette provenance: `crimson` and `gold` are brand-600 / gold-600 from
 * tailwind.config.js (the two mandated brand accents). The remaining warm
 * hues were chosen and verified with the dataviz skill's
 * `validate_palette.js` six-check validator — lightness band, chroma floor,
 * and contrast vs. a white chart surface all PASS; colorblind (CVD)
 * separation lands in the "floor" band (worst adjacent pair ΔE ~9.9 under
 * deuteranopia), the same tier as the two fixed brand colors themselves
 * (crimson/gold measure ΔE ~11.3). A palette built only from warm hues
 * cannot fully clear the stricter ΔE 12 "target" the validator prefers —
 * chasing that would have pushed the extra slots toward pink/magenta, off
 * the "warm-harmonized" brief. The floor band is legal per the skill only
 * with secondary encoding, which every chart using this theme already ships
 * (a legend plus a hover tooltip render the series name as text, not just
 * color). `stone` is an intentionally desaturated neutral reserved for an
 * "Other"/overflow series and sits outside the CVD-checked set.
 */

import { Chart as ChartJS } from 'chart.js';

// Mirrors tailwind.config.js `fontFamily.sans`.
const CHART_FONT_FAMILY = "Sarabun, 'Noto Sans Thai', system-ui, sans-serif";

// Mirrors tailwind.config.js `colors.hairline.DEFAULT` — gridlines read as a
// warm hairline, never Chart.js's stock cool `rgba(0, 0, 0, 0.1)`.
const GRID_COLOR = '#E8E4DF';

// Mirrors tailwind.config.js `colors.tile.{DEFAULT,text}` — the app's one
// near-black warm surface, reused as the tooltip popover's surface/ink pair.
const TOOLTIP_SURFACE_COLOR = '#211D1A';
const TOOLTIP_INK_COLOR = '#F4F1ED';

// Mirrors tailwind.config.js `colors.ink.muted` — axis ticks and legend
// labels (Chart.js's global text color).
const AXIS_INK_COLOR = '#7A7268';

// Mirrors the `rounded-lg` (8px) utility-surface radius.
const TOOLTIP_CORNER_RADIUS = 8;
const TOOLTIP_PADDING = 10;

/**
 * Fixed-order categorical chart palette. Crimson and gold are the mandated
 * brand accents; assign additional series the next color in this order —
 * never reorder or cycle it per-chart (see the dataviz skill's
 * "fixed hue anchors" rule).
 */
export const CHART_COLORS: readonly string[] = [
  '#D4272E', // crimson — brand-600, primary series
  '#B98730', // gold — gold-600, secondary series
  '#AC1C0F', // terracotta
  '#B75F0B', // amber
  '#933239', // wine
  '#78716C', // stone — neutral "Other"/overflow bucket, last resort only
];

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

/** Converts a `CHART_COLORS` hex entry to an `rgba()` string at the given alpha. */
function withAlpha(hex: string, alpha: number): string {
  if (!HEX_COLOR_PATTERN.test(hex)) {
    return hex;
  }
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Returns the categorical color for a given series index, wrapping around
 * `CHART_COLORS` once every slot has been used. Pass `alpha` < 1 for fills
 * (e.g. a line chart's `backgroundColor`) — the stroke/point/legend color
 * should stay fully opaque.
 */
export function chartColorAt(index: number, alpha = 1): string {
  const hex = CHART_COLORS[index % CHART_COLORS.length] as string;
  return alpha >= 1 ? hex : withAlpha(hex, alpha);
}

/**
 * Applies the design system's Chart.js defaults globally: warm font/ink/grid
 * colors and a tooltip styled after the app's tile surface. Call once,
 * after registering the Chart.js components a page needs and before any
 * chart renders — the defaults apply to every chart created afterward.
 */
export function applyChartTheme(): void {
  ChartJS.defaults.font.family = CHART_FONT_FAMILY;
  ChartJS.defaults.color = AXIS_INK_COLOR;
  ChartJS.defaults.borderColor = GRID_COLOR;

  ChartJS.defaults.plugins.tooltip.backgroundColor = TOOLTIP_SURFACE_COLOR;
  ChartJS.defaults.plugins.tooltip.titleColor = TOOLTIP_INK_COLOR;
  ChartJS.defaults.plugins.tooltip.bodyColor = TOOLTIP_INK_COLOR;
  ChartJS.defaults.plugins.tooltip.footerColor = TOOLTIP_INK_COLOR;
  ChartJS.defaults.plugins.tooltip.cornerRadius = TOOLTIP_CORNER_RADIUS;
  ChartJS.defaults.plugins.tooltip.padding = TOOLTIP_PADDING;
  ChartJS.defaults.plugins.tooltip.displayColors = true;
}
