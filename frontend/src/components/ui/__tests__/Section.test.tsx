import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Section } from '../Section';
import type { SectionSurface } from '../Section';

describe('Section', () => {
  it('should render its children', () => {
    render(<Section>Section content</Section>);

    expect(screen.getByText('Section content')).toBeInTheDocument();
  });

  it('should render a <section> element by default', () => {
    render(<Section>Content</Section>);

    expect(screen.getByText('Content').closest('[data-surface]')?.tagName).toBe('SECTION');
  });

  it('should render a <div> when as="div"', () => {
    render(<Section as="div">Content</Section>);

    expect(screen.getByText('Content').closest('[data-surface]')?.tagName).toBe('DIV');
  });

  it('should default to data-surface="plain"', () => {
    const { container } = render(<Section>Content</Section>);

    expect(container.firstChild).toHaveAttribute('data-surface', 'plain');
  });

  const surfaces: SectionSurface[] = ['plain', 'sunken', 'tile'];
  it.each(surfaces)('should stamp data-surface="%s" when surface is set', (surface) => {
    const { container } = render(<Section surface={surface}>{surface}</Section>);

    expect(container.firstChild).toHaveAttribute('data-surface', surface);
  });

  it('should merge a caller-supplied className onto the outer wrapper', () => {
    const { container } = render(<Section className="promo-section-marker">Content</Section>);

    expect(container.firstChild).toHaveClass('promo-section-marker');
  });

  it('should merge a caller-supplied innerClassName onto the inner container', () => {
    render(<Section innerClassName="promo-inner-marker">Content</Section>);

    expect(screen.getByText('Content')).toHaveClass('promo-inner-marker');
  });

  it('should nest children inside an inner container within the outer wrapper', () => {
    const { container } = render(<Section>Content</Section>);

    const inner = screen.getByText('Content');
    expect(inner).not.toBe(container.firstChild);
    expect(container.firstChild).toContainElement(inner);
  });
});
