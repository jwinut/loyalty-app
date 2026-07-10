import { createRef } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Select } from '../Select';

describe('Select', () => {
  it('should render as a combobox associated with its label', () => {
    render(
      <>
        <label htmlFor="tier">Tier</label>
        <Select id="tier">
          <option value="gold">Gold</option>
        </Select>
      </>
    );

    expect(screen.getByLabelText('Tier')).toBeInTheDocument();
  });

  it('should not set aria-invalid by default', () => {
    render(
      <Select aria-label="Tier">
        <option value="gold">Gold</option>
      </Select>
    );

    expect(screen.getByRole('combobox')).not.toHaveAttribute('aria-invalid');
  });

  it('should set aria-invalid="true" when invalid', () => {
    render(
      <Select aria-label="Tier" invalid>
        <option value="gold">Gold</option>
      </Select>
    );

    expect(screen.getByRole('combobox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('should call onChange when a new option is selected', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <Select aria-label="Tier" onChange={handleChange}>
        <option value="gold">Gold</option>
        <option value="platinum">Platinum</option>
      </Select>
    );

    await user.selectOptions(screen.getByRole('combobox'), 'platinum');
    expect(handleChange).toHaveBeenCalled();
  });

  it('should forward a ref to the underlying select element', () => {
    const ref = createRef<HTMLSelectElement>();
    render(
      <Select aria-label="Tier" ref={ref}>
        <option value="gold">Gold</option>
      </Select>
    );

    expect(ref.current).toBeInstanceOf(HTMLSelectElement);
  });

  it('should merge a caller-supplied className onto the rendered element', () => {
    render(
      <Select aria-label="Tier" className="promo-select-marker">
        <option value="gold">Gold</option>
      </Select>
    );

    expect(screen.getByRole('combobox')).toHaveClass('promo-select-marker');
  });
});
