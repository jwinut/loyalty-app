import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '../Badge';
import type { BadgeSize, BadgeTone } from '../Badge';

describe('Badge', () => {
  it('should render its children as visible text', () => {
    render(<Badge>Gold tier</Badge>);

    expect(screen.getByText('Gold tier')).toBeInTheDocument();
  });

  it('should render a <span> element', () => {
    render(<Badge>Gold tier</Badge>);

    expect(screen.getByText('Gold tier').tagName).toBe('SPAN');
  });

  it('should default to tone="neutral"', () => {
    render(<Badge>Default</Badge>);

    expect(screen.getByText('Default')).toHaveAttribute('data-tone', 'neutral');
  });

  const tones: BadgeTone[] = ['neutral', 'brand', 'gold', 'success', 'warning', 'error', 'info'];
  it.each(tones)('should stamp data-tone="%s" when tone is set', (tone) => {
    render(<Badge tone={tone}>{tone}</Badge>);

    expect(screen.getByText(tone)).toHaveAttribute('data-tone', tone);
  });

  const sizes: BadgeSize[] = ['sm', 'md'];
  it.each(sizes)('should render without error at size="%s"', (size) => {
    render(<Badge size={size}>{size}</Badge>);

    expect(screen.getByText(size)).toBeInTheDocument();
  });

  it('should merge a caller-supplied className onto the rendered element', () => {
    render(<Badge className="badge-marker">Tagged</Badge>);

    expect(screen.getByText('Tagged')).toHaveClass('badge-marker');
  });

  it('should forward arbitrary HTML attributes', () => {
    render(<Badge data-testid="tier-badge">Gold</Badge>);

    expect(screen.getByTestId('tier-badge')).toBeInTheDocument();
  });
});
