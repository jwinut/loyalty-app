import { createRef } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from '../Input';
import type { InputShape } from '../Input';

describe('Input', () => {
  it('should render as a text box associated with its label', () => {
    render(
      <>
        <label htmlFor="email">Email address</label>
        <Input id="email" />
      </>
    );

    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
  });

  it('should default to data-shape="field"', () => {
    render(<Input aria-label="Search" />);

    expect(screen.getByRole('textbox')).toHaveAttribute('data-shape', 'field');
  });

  const shapes: InputShape[] = ['field', 'pill'];
  it.each(shapes)('should stamp data-shape="%s" when shape is set', (shape) => {
    render(<Input aria-label={shape} shape={shape} />);

    expect(screen.getByRole('textbox')).toHaveAttribute('data-shape', shape);
  });

  it('should not set aria-invalid by default', () => {
    render(<Input aria-label="Email" />);

    expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-invalid');
  });

  it('should set aria-invalid="true" when invalid', () => {
    render(<Input aria-label="Email" invalid />);

    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('should render a leading icon alongside the input', () => {
    render(<Input aria-label="Email" leadingIcon={<span data-testid="leading-icon">@</span>} />);

    expect(screen.getByTestId('leading-icon')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('should render a trailing slot as an interactive control', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(
      <Input
        aria-label="Password"
        trailingSlot={
          <button type="button" aria-label="Show password" onClick={handleClick}>
            Show
          </button>
        }
      />
    );

    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should accept user input and call onChange', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<Input aria-label="Email" onChange={handleChange} />);

    await user.type(screen.getByRole('textbox'), 'a');
    expect(handleChange).toHaveBeenCalled();
  });

  it('should forward a ref to the underlying input element', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input aria-label="Email" ref={ref} />);

    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('should merge a caller-supplied className onto the rendered element', () => {
    render(<Input aria-label="Email" className="promo-input-marker" />);

    expect(screen.getByRole('textbox')).toHaveClass('promo-input-marker');
  });
});
