import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FormField } from '../FormField';
import { Input } from '../Input';

describe('FormField', () => {
  it('should associate the label with its control via htmlFor/id', () => {
    render(
      <FormField label="Email address" htmlFor="email">
        <Input />
      </FormField>
    );

    expect(screen.getByRole('textbox', { name: 'Email address' })).toBeInTheDocument();
  });

  it("should keep the required marker out of the control's accessible name", () => {
    render(
      <FormField label="Email address" htmlFor="email" required>
        <Input />
      </FormField>
    );

    expect(screen.getByRole('textbox', { name: 'Email address' })).toBeInTheDocument();
  });

  it('should render a visible required marker hidden from the accessibility tree', () => {
    const { container } = render(
      <FormField label="Email address" htmlFor="email" required>
        <Input />
      </FormField>
    );

    const marker = container.querySelector('[aria-hidden="true"]');
    expect(marker).toHaveTextContent('*');
  });

  it('should describe the control with hint text', () => {
    render(
      <FormField label="Password" htmlFor="password" hint="At least 8 characters">
        <Input />
      </FormField>
    );

    const hint = screen.getByText('At least 8 characters');
    const control = screen.getByRole('textbox', { name: 'Password' });

    expect(control).toHaveAttribute('aria-describedby', hint.id);
  });

  it('should render the error as an alert and mark the control invalid', () => {
    render(
      <FormField label="Email address" htmlFor="email" error="Invalid email address">
        <Input />
      </FormField>
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Invalid email address');

    const control = screen.getByRole('textbox', { name: 'Email address' });
    expect(control).toHaveAttribute('aria-invalid', 'true');
    expect(control).toHaveAttribute('aria-describedby', alert.id);
  });

  it('should describe the control with both hint and error ids when both are present', () => {
    render(
      <FormField label="Email address" htmlFor="email" hint="We never share this" error="Required">
        <Input />
      </FormField>
    );

    const hint = screen.getByText('We never share this');
    const alert = screen.getByRole('alert');
    const control = screen.getByRole('textbox', { name: 'Email address' });

    expect(control.getAttribute('aria-describedby')).toBe(`${hint.id} ${alert.id}`);
  });

  it('should not set aria-invalid when there is no error', () => {
    render(
      <FormField label="Email address" htmlFor="email">
        <Input />
      </FormField>
    );

    expect(screen.getByRole('textbox', { name: 'Email address' })).not.toHaveAttribute('aria-invalid');
  });

  it('should render non-element children as-is without attempting to clone them', () => {
    render(
      <FormField label="Info" htmlFor="info">
        Just some text
      </FormField>
    );

    expect(screen.getByText('Just some text')).toBeInTheDocument();
  });
});
