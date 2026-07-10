import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrandLogo } from '../BrandLogo';

describe('BrandLogo', () => {
  it('renders only the monogram svg for variant="monogram"', () => {
    const { container } = render(<BrandLogo variant="monogram" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(
      screen.queryByText('The Harbour Front Hotel'),
    ).not.toBeInTheDocument();
  });

  it('renders only the wordmark text for variant="wordmark"', () => {
    const { container } = render(<BrandLogo variant="wordmark" />);
    expect(screen.getByText('The Harbour Front Hotel')).toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });

  it('renders both monogram and wordmark for variant="lockup" (the default)', () => {
    const { container } = render(<BrandLogo />);
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(screen.getByText('The Harbour Front Hotel')).toBeInTheDocument();
  });

  it('applies onLight ink classes to the wordmark by default', () => {
    render(<BrandLogo variant="wordmark" />);
    expect(screen.getByText('The Harbour Front Hotel').className).toContain(
      'text-ink',
    );
  });

  it('applies onDark classes to the wordmark when tone="onDark"', () => {
    render(<BrandLogo variant="wordmark" tone="onDark" />);
    const wordmark = screen.getByText('The Harbour Front Hotel');
    expect(wordmark.className).toContain('text-tile-text');
    expect(wordmark.className).not.toContain('text-ink');
  });

  it('forwards a custom className to the monogram svg', () => {
    const { container } = render(
      <BrandLogo variant="monogram" className="h-10 w-10" />,
    );
    expect(container.querySelector('svg')?.getAttribute('class')).toContain(
      'h-10 w-10',
    );
  });

  it('hides the monogram svg from assistive tech', () => {
    const { container } = render(<BrandLogo variant="monogram" />);
    expect(container.querySelector('svg')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });
});
