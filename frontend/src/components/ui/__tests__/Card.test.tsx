import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from '../Card';
import type { CardSurface } from '../Card';

describe('Card', () => {
  it('should render its children', () => {
    render(<Card>Card content</Card>);

    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('should render a <div> by default', () => {
    render(<Card>Content</Card>);

    expect(screen.getByText('Content').tagName).toBe('DIV');
  });

  it('should render a <section> when as="section"', () => {
    render(<Card as="section">Content</Card>);

    expect(screen.getByText('Content').tagName).toBe('SECTION');
  });

  it('should render an <article> when as="article"', () => {
    render(<Card as="article">Content</Card>);

    expect(screen.getByText('Content').tagName).toBe('ARTICLE');
  });

  it('should default to data-surface="card"', () => {
    render(<Card>Content</Card>);

    expect(screen.getByText('Content')).toHaveAttribute('data-surface', 'card');
  });

  const surfaces: CardSurface[] = ['card', 'sunken', 'tile'];
  it.each(surfaces)('should stamp data-surface="%s" when surface is set', (surface) => {
    render(<Card surface={surface}>{surface}</Card>);

    expect(screen.getByText(surface)).toHaveAttribute('data-surface', surface);
  });

  it('should forward arbitrary HTML attributes and event handlers', () => {
    render(
      <Card id="promo-card" data-testid="promo">
        Content
      </Card>
    );

    const card = screen.getByTestId('promo');
    expect(card).toHaveAttribute('id', 'promo-card');
  });

  it('should merge a caller-supplied className onto the rendered element', () => {
    render(<Card className="promo-card-marker">Content</Card>);

    expect(screen.getByText('Content')).toHaveClass('promo-card-marker');
  });
});
