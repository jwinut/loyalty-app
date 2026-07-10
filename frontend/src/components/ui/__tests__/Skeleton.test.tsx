import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Skeleton } from '../Skeleton';

describe('Skeleton', () => {
  it('should render a div hidden from the accessibility tree', () => {
    const { container } = render(<Skeleton />);

    const skeleton = container.firstChild as HTMLElement;
    expect(skeleton.tagName).toBe('DIV');
    expect(skeleton).toHaveAttribute('aria-hidden', 'true');
  });

  it('should expose no accessible role, since it is a decorative placeholder', () => {
    const { container } = render(<Skeleton />);

    // aria-hidden elements are pulled out of the accessibility tree entirely.
    expect(container.querySelector('[role]')).not.toBeInTheDocument();
  });

  it('should merge a caller-supplied className onto the rendered element', () => {
    const { container } = render(<Skeleton className="skeleton-marker" />);

    const skeleton = container.firstChild as HTMLElement;
    expect(skeleton).toHaveClass('skeleton-marker');
  });
});
