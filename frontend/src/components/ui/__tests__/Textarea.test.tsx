import { createRef } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Textarea } from '../Textarea';

describe('Textarea', () => {
  it('should render as a multiline text box associated with its label', () => {
    render(
      <>
        <label htmlFor="notes">Notes</label>
        <Textarea id="notes" />
      </>
    );

    expect(screen.getByLabelText('Notes')).toBeInTheDocument();
  });

  it('should not set aria-invalid by default', () => {
    render(<Textarea aria-label="Notes" />);

    expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-invalid');
  });

  it('should set aria-invalid="true" when invalid', () => {
    render(<Textarea aria-label="Notes" invalid />);

    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('should accept multi-line user input', async () => {
    const user = userEvent.setup();
    render(<Textarea aria-label="Notes" />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'line one{enter}line two');

    expect(textarea).toHaveValue('line one\nline two');
  });

  it('should forward a ref to the underlying textarea element', () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(<Textarea aria-label="Notes" ref={ref} />);

    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
  });

  it('should merge a caller-supplied className onto the rendered element', () => {
    render(<Textarea aria-label="Notes" className="promo-textarea-marker" />);

    expect(screen.getByRole('textbox')).toHaveClass('promo-textarea-marker');
  });
});
