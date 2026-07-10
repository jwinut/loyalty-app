import type { ComponentProps } from 'react';
import { useRef } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from '../Modal';
import type { ModalMobilePresentation, ModalSize } from '../Modal';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

type ModalTestProps = ComponentProps<typeof Modal>;

function renderModal(overrides: Partial<ModalTestProps> = {}) {
  const onClose = vi.fn();
  const utils = render(
    <Modal open onClose={onClose} title="Modal title" {...overrides}>
      {overrides.children ?? <p>Body content</p>}
    </Modal>
  );
  return { onClose, ...utils };
}

describe('Modal', () => {
  describe('Rendering', () => {
    it('should render nothing when closed', () => {
      render(
        <Modal open={false} onClose={vi.fn()} title="Title">
          <p>Body</p>
        </Modal>
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render the panel via a portal to document.body', () => {
      const { container } = renderModal();

      expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
      expect(document.body.querySelector('[role="dialog"]')).toBeInTheDocument();
    });

    it('should render the footer when provided', () => {
      renderModal({ footer: <button type="button">Save</button> });

      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    });

    it('should not render a header when no title is given', () => {
      render(
        <Modal open onClose={vi.fn()}>
          <button type="button">Only action</button>
        </Modal>
      );

      expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    });
  });

  describe('ARIA attributes', () => {
    it('should mark the panel as a modal dialog labelled by the title', () => {
      renderModal();

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');

      const labelledBy = dialog.getAttribute('aria-labelledby') ?? '';
      expect(labelledBy).not.toBe('');
      expect(document.getElementById(labelledBy)).toHaveTextContent('Modal title');
    });

    it('should omit aria-labelledby when no title is given', () => {
      render(
        <Modal open onClose={vi.fn()}>
          <p>Body</p>
        </Modal>
      );

      expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-labelledby');
    });

    const sizes: ModalSize[] = ['sm', 'md', 'lg'];
    it.each(sizes)('should stamp data-size="%s"', (size) => {
      renderModal({ size });

      expect(screen.getByRole('dialog')).toHaveAttribute('data-size', size);
    });

    const presentations: ModalMobilePresentation[] = ['sheet', 'center'];
    it.each(presentations)('should stamp data-presentation="%s"', (mobilePresentation) => {
      renderModal({ mobilePresentation });

      expect(screen.getByRole('dialog')).toHaveAttribute('data-presentation', mobilePresentation);
    });
  });

  describe('Dismissal', () => {
    it('should call onClose when Escape is pressed', () => {
      const { onClose } = renderModal();

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when the backdrop is pressed but not when the panel is pressed', () => {
      const { onClose } = renderModal();

      const dialog = screen.getByRole('dialog');
      fireEvent.mouseDown(dialog);
      expect(onClose).not.toHaveBeenCalled();

      const backdrop = dialog.parentElement as HTMLElement;
      fireEvent.mouseDown(backdrop);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when the header close button is clicked', async () => {
      const user = userEvent.setup();
      const { onClose } = renderModal();

      await user.click(screen.getByRole('button', { name: 'Close' }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Focus management', () => {
    it('should focus the header close button on open by default', async () => {
      renderModal();

      await waitFor(() => expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus());
    });

    it('should focus the first focusable child when there is no header', async () => {
      render(
        <Modal open onClose={vi.fn()}>
          <button type="button">Only action</button>
        </Modal>
      );

      await waitFor(() => expect(screen.getByRole('button', { name: 'Only action' })).toHaveFocus());
    });

    it('should focus the panel itself when nothing inside is focusable', async () => {
      render(
        <Modal open onClose={vi.fn()}>
          <p>No focusable content</p>
        </Modal>
      );

      await waitFor(() => expect(screen.getByRole('dialog')).toHaveFocus());
    });

    it('should focus initialFocusRef when provided', async () => {
      function Harness() {
        const ref = useRef<HTMLButtonElement>(null);
        return (
          <Modal open onClose={vi.fn()} title="Title" initialFocusRef={ref}>
            <button type="button">Not this one</button>
            <button type="button" ref={ref}>
              Focus me
            </button>
          </Modal>
        );
      }

      render(<Harness />);

      await waitFor(() => expect(screen.getByRole('button', { name: 'Focus me' })).toHaveFocus());
    });

    it('should trap Tab focus within the panel', async () => {
      const user = userEvent.setup();
      render(
        <Modal open onClose={vi.fn()} title="Title">
          <button type="button">First inside</button>
          <button type="button">Last inside</button>
        </Modal>
      );

      const closeButton = screen.getByRole('button', { name: 'Close' });
      const lastInside = screen.getByRole('button', { name: 'Last inside' });

      await waitFor(() => expect(closeButton).toHaveFocus());

      lastInside.focus();
      await user.tab();
      expect(closeButton).toHaveFocus();

      await user.tab({ shift: true });
      expect(lastInside).toHaveFocus();
    });

    it('should return focus to the previously focused element on close', async () => {
      const trigger = document.createElement('button');
      trigger.textContent = 'Trigger';
      document.body.appendChild(trigger);
      trigger.focus();
      expect(trigger).toHaveFocus();

      const onClose = vi.fn();
      const { rerender } = render(
        <Modal open onClose={onClose} title="Title">
          <button type="button">Inside</button>
        </Modal>
      );

      await waitFor(() => expect(trigger).not.toHaveFocus());

      rerender(
        <Modal open={false} onClose={onClose} title="Title">
          <button type="button">Inside</button>
        </Modal>
      );

      await waitFor(() => expect(trigger).toHaveFocus());

      document.body.removeChild(trigger);
    });
  });

  describe('Scroll lock', () => {
    it('should lock body scroll while open and restore it on close', () => {
      const { rerender } = render(
        <Modal open onClose={vi.fn()} title="Title">
          <p>Body</p>
        </Modal>
      );

      expect(document.body.style.overflow).toBe('hidden');

      rerender(
        <Modal open={false} onClose={vi.fn()} title="Title">
          <p>Body</p>
        </Modal>
      );

      expect(document.body.style.overflow).not.toBe('hidden');
    });
  });
});
