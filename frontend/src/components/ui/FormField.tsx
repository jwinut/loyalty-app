import { cloneElement, isValidElement } from 'react';
import type { ReactNode } from 'react';

export type FormFieldProps = {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
};

type ClonableControlProps = {
  id?: string;
  'aria-describedby'?: string;
  invalid?: boolean;
  'aria-invalid'?: boolean;
};

export function FormField({ label, htmlFor, error, hint, required = false, children }: FormFieldProps) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  const isInvalid = Boolean(error);

  const control = isValidElement<ClonableControlProps>(children)
    ? cloneElement(children, {
        id: htmlFor,
        'aria-describedby': describedBy,
        invalid: isInvalid,
        'aria-invalid': isInvalid || undefined,
      })
    : children;

  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-caption font-semibold text-ink">
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {control}
      {hint ? (
        <p id={hintId} className="text-fine text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-caption text-error-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
