import { describe, it, expect, beforeEach } from 'vitest';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { applyChartTheme, chartColorAt, CHART_COLORS } from '../chartTheme';

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const BRAND_CRIMSON = '#D4272E';
const BRAND_GOLD = '#B98730';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
);

describe('chartTheme', () => {
  describe('CHART_COLORS', () => {
    it('is a fixed-order palette of valid 6-digit hex colors', () => {
      expect(CHART_COLORS.length).toBeGreaterThanOrEqual(6);
      for (const color of CHART_COLORS) {
        expect(color).toMatch(HEX_COLOR_PATTERN);
      }
    });

    it('leads with crimson, then gold, per the mandated brand order', () => {
      expect(CHART_COLORS[0]).toBe(BRAND_CRIMSON);
      expect(CHART_COLORS[1]).toBe(BRAND_GOLD);
    });

    it('contains no duplicate colors', () => {
      const uniqueColors = new Set(CHART_COLORS);
      expect(uniqueColors.size).toBe(CHART_COLORS.length);
    });

    it('includes a desaturated stone as the last slot for an overflow series', () => {
      expect(CHART_COLORS[CHART_COLORS.length - 1]).toBe('#78716C');
    });
  });

  describe('chartColorAt', () => {
    it('returns the color at the given index', () => {
      expect(chartColorAt(0)).toBe(CHART_COLORS[0]);
      expect(chartColorAt(1)).toBe(CHART_COLORS[1]);
    });

    it('wraps around once every slot has been used', () => {
      expect(chartColorAt(CHART_COLORS.length)).toBe(CHART_COLORS[0]);
      expect(chartColorAt(CHART_COLORS.length + 1)).toBe(CHART_COLORS[1]);
    });

    it('returns the plain hex when alpha is omitted or 1', () => {
      expect(chartColorAt(0)).toBe(BRAND_CRIMSON);
      expect(chartColorAt(0, 1)).toBe(BRAND_CRIMSON);
    });

    it('returns an rgba() string when alpha is below 1', () => {
      expect(chartColorAt(0, 0.1)).toBe('rgba(212, 39, 46, 0.1)');
    });
  });

  describe('applyChartTheme', () => {
    beforeEach(() => {
      applyChartTheme();
    });

    it('sets the Sarabun font family as the global default', () => {
      expect(ChartJS.defaults.font.family).toContain('Sarabun');
    });

    it('sets a warm ink color as the global text/tick color', () => {
      expect(ChartJS.defaults.color).toBe('#7A7268');
    });

    it('sets a warm hairline as the global grid/border color', () => {
      expect(ChartJS.defaults.borderColor).toBe('#E8E4DF');
      // Grid line color routes from the global borderColor default.
      expect(ChartJS.defaults.scale.grid.color).toBe('#E8E4DF');
    });

    it('styles the tooltip after the app tile surface', () => {
      expect(ChartJS.defaults.plugins.tooltip.backgroundColor).toBe('#211D1A');
      expect(ChartJS.defaults.plugins.tooltip.titleColor).toBe('#F4F1ED');
      expect(ChartJS.defaults.plugins.tooltip.bodyColor).toBe('#F4F1ED');
      expect(ChartJS.defaults.plugins.tooltip.displayColors).toBe(true);
    });

    it('is idempotent — calling it repeatedly keeps the same defaults', () => {
      applyChartTheme();
      applyChartTheme();
      expect(ChartJS.defaults.color).toBe('#7A7268');
      expect(ChartJS.defaults.plugins.tooltip.backgroundColor).toBe('#211D1A');
    });
  });
});
