import { createRef } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button, buttonVariants } from '../Button';
import type { ButtonSize, ButtonVariant } from '../Button';

describe('Button', () => {
  it('should render a button with an accessible name from its children', () => {
    render(<Button>Save changes</Button>);

    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
  });

  it('should default to type="button" so it never submits a surrounding form', () => {
    render(<Button>Click me</Button>);

    expect(screen.getByRole('button', { name: 'Click me' })).toHaveAttribute('type', 'button');
  });

  it('should respect an explicit type override', () => {
    render(<Button type="submit">Submit</Button>);

    expect(screen.getByRole('button', { name: 'Submit' })).toHaveAttribute('type', 'submit');
  });

  it('should default to the primary variant and md size', () => {
    render(<Button>Default</Button>);

    const button = screen.getByRole('button', { name: 'Default' });
    expect(button).toHaveAttribute('data-variant', 'primary');
    expect(button).toHaveAttribute('data-size', 'md');
  });

  const variants: ButtonVariant[] = ['primary', 'secondary', 'utility', 'destructive', 'ghost'];
  it.each(variants)('should stamp data-variant="%s" when variant is set', (variant) => {
    render(<Button variant={variant}>{variant}</Button>);

    expect(screen.getByRole('button', { name: variant })).toHaveAttribute('data-variant', variant);
  });

  const sizes: ButtonSize[] = ['md', 'sm', 'icon'];
  it.each(sizes)('should stamp data-size="%s" when size is set', (size) => {
    render(<Button size={size}>{size}</Button>);

    expect(screen.getByRole('button', { name: size })).toHaveAttribute('data-size', size);
  });

  it('should call onClick when activated', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Go</Button>);

    await user.click(screen.getByRole('button', { name: 'Go' }));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should be disabled and not fire onClick when disabled is set', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(
      <Button disabled onClick={handleClick}>
        Go
      </Button>
    );

    const button = screen.getByRole('button', { name: 'Go' });
    expect(button).toBeDisabled();

    await user.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('should forward a ref to the underlying button element', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Ref target</Button>);

    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current).toBe(screen.getByRole('button', { name: 'Ref target' }));
  });

  describe('loading state', () => {
    it('should set aria-busy and disable the button while loading', () => {
      render(<Button loading>Saving</Button>);

      const button = screen.getByRole('button', { name: 'Saving' });
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(button).toBeDisabled();
    });

    it('should not set aria-busy when not loading', () => {
      render(<Button>Saving</Button>);

      expect(screen.getByRole('button', { name: 'Saving' })).not.toHaveAttribute('aria-busy');
    });

    it('should render a spinner that is hidden from the accessibility tree', () => {
      const { container } = render(<Button loading>Saving</Button>);

      const spinner = container.querySelector('svg');
      expect(spinner).toBeTruthy();
      expect(spinner).toHaveAttribute('aria-hidden', 'true');
      // The spinner must not introduce its own accessible name or role —
      // the button's accessible name should still come from its children only.
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      expect(screen.getByRole('button')).toHaveAccessibleName('Saving');
    });

    it('should disable the button even if disabled=false is explicitly passed while loading', () => {
      render(
        <Button loading disabled={false}>
          Saving
        </Button>
      );

      expect(screen.getByRole('button', { name: 'Saving' })).toBeDisabled();
    });
  });

  describe('buttonVariants', () => {
    it('should return a class string usable outside of a <button> (e.g. react-router Link)', () => {
      const classes = buttonVariants({ variant: 'secondary', size: 'sm' });

      expect(typeof classes).toBe('string');
      expect(classes.length).toBeGreaterThan(0);
    });

    it('should default to primary/md when called with no arguments', () => {
      expect(buttonVariants()).toBe(buttonVariants({ variant: 'primary', size: 'md' }));
    });

    it('should let an incoming className win over a conflicting size utility (tailwind-merge sanity check)', () => {
      const classes = buttonVariants({ size: 'md', className: 'px-10' });
      const pxUtilities = classes.split(' ').filter((cls) => /^px-/.test(cls));

      // size:"md" contributes `px-5.5`; the caller's `px-10` must win and the
      // conflicting utility must not survive alongside it.
      expect(pxUtilities).toEqual(['px-10']);
    });
  });
});
