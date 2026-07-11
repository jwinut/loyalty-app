import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from '../ConfirmDialog';

describe('ConfirmDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any portals - let React Testing Library handle cleanup
    // document.body.innerHTML = '';
  });

  describe('Basic Rendering', () => {
    it('should not render when isOpen is false', () => {
      const mockOnConfirm = vi.fn();
      const mockOnCancel = vi.fn();

      render(
        <ConfirmDialog
          isOpen={false}
          title="Test Title"
          message="Test Message"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByText('Test Title')).not.toBeInTheDocument();
      expect(screen.queryByText('Test Message')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
      const mockOnConfirm = vi.fn();
      const mockOnCancel = vi.fn();

      render(
        <ConfirmDialog
          isOpen={true}
          title="Test Title"
          message="Test Message"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Test Title')).toBeInTheDocument();
      expect(screen.getByText('Test Message')).toBeInTheDocument();
    });

    it('should render as a modal with correct ARIA attributes', () => {
      const mockOnConfirm = vi.fn();
      const mockOnCancel = vi.fn();

      render(
        <ConfirmDialog
          isOpen={true}
          title="Test Title"
          message="Test Message"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');

      const labelledBy = dialog.getAttribute('aria-labelledby');
      expect(labelledBy).toBeTruthy();
      expect(document.getElementById(labelledBy ?? '')).toHaveTextContent('Test Title');
    });

    it('should render via portal to document.body', () => {
      const mockOnConfirm = vi.fn();
      const mockOnCancel = vi.fn();

      const { container } = render(
        <ConfirmDialog
          isOpen={true}
          title="Test Title"
          message="Test Message"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      // Dialog should be rendered directly in document.body, not in the container
      expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
      expect(document.body.querySelector('[role="dialog"]')).toBeInTheDocument();
    });
  });

  describe('Title and Message Display', () => {
    it('should display the provided title', () => {
      const mockOnConfirm = vi.fn();
      const mockOnCancel = vi.fn();

      render(
        <ConfirmDialog
          isOpen={true}
          title="Confirm Deletion"
          message="Are you sure?"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Confirm Deletion')).toBeInTheDocument();
    });

    it('should display the provided message', () => {
      const mockOnConfirm = vi.fn();
      const mockOnCancel = vi.fn();

      render(
        <ConfirmDialog
          isOpen={true}
          title="Confirm Action"
          message="This action cannot be undone. Are you sure you want to continue?"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(
        screen.getByText('This action cannot be undone. Are you sure you want to continue?')
      ).toBeInTheDocument();
    });

    it('should label the dialog with the title via aria-labelledby', () => {
      const mockOnConfirm = vi.fn();
      const mockOnCancel = vi.fn();

      render(
        <ConfirmDialog
          isOpen={true}
          title="Test Title"
          message="Test Message"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const dialog = screen.getByRole('dialog');
      const labelledBy = dialog.getAttribute('aria-labelledby');
      const titleElement = screen.getByText('Test Title');

      expect(titleElement).toHaveAttribute('id', labelledBy);
    });
  });

  describe('Button Rendering', () => {
    it('should render default confirm button text', () => {
      const mockOnConfirm = vi.fn();
      const mockOnCancel = vi.fn();

      render(
        <ConfirmDialog
          isOpen={true}
          title="Test"
          message="Test"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    });

    it('should render default cancel button text', () => {
      const mockOnConfirm = vi.fn();
      const mockOnCancel = vi.fn();

      render(
        <ConfirmDialog
          isOpen={true}
          title="Test"
          message="Test"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('should render custom confirm button text', () => {
      const mockOnConfirm = vi.fn();
      const mockOnCancel = vi.fn();

      render(
        <ConfirmDialog
          isOpen={true}
          title="Test"
          message="Test"
          confirmText="Delete Now"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByRole('button', { name: 'Delete Now' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
    });

    it('should render custom cancel button text', () => {
      const mockOnConfirm = vi.fn();
      const mockOnCancel = vi.fn();

      render(
        <ConfirmDialog
          isOpen={true}
          title="Test"
          message="Test"
          cancelText="Go Back"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByRole('button', { name: 'Go Back' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });

    it('should render both custom button texts', () => {
      const mockOnConfirm = vi.fn();
      const mockOnCancel = vi.fn();

      render(
        <ConfirmDialog
          isOpen={true}
          title="Test"
          message="Test"
          confirmText="Yes, Delete"
          cancelText="No, Keep It"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByRole('button', { name: 'Yes, Delete' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'No, Keep It' })).toBeInTheDocument();
    });
  });

  describe('Button Click Handlers', () => {
    it('should call onConfirm when confirm button is clicked', async () => {
      const user = userEvent.setup();
      const mockOnConfirm = vi.fn();
      const mockOnCancel = vi.fn();

      render(
        <ConfirmDialog
          isOpen={true}
          title="Test"
          message="Test"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const confirmButton = screen.getByRole('button', { name: 'Confirm' });
      await user.click(confirmButton);

      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
      expect(mockOnCancel).not.toHaveBeenCalled();
    });

    it('should call onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      const mockOnConfirm = vi.fn();
      const mockOnCancel = vi.fn();

      render(
        <ConfirmDialog
          isOpen={true}
          title="Test"
          message="Test"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it('should call onCancel when backdrop is clicked', async () => {
      const user = userEvent.setup();
      const mockOnConfirm = vi.fn();
      const mockOnCancel = vi.fn();

      render(
        <ConfirmDialog
          isOpen={true}
          title="Test"
          message="Test"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const backdrop = screen.getByRole('dialog').parentElement as HTMLElement;
      expect(backdrop).toBeInTheDocument();

      await user.click(backdrop);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it('should handle multiple confirm button clicks', async () => {
      const user = userEvent.setup();
      const mockOnConfirm = vi.fn();
      const mockOnCancel = vi.fn();

      render(
        <ConfirmDialog
          isOpen={true}
          title="Test"
          message="Test"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const confirmButton = screen.getByRole('button', { name: 'Confirm' });
      await user.click(confirmButton);
      await user.click(confirmButton);
      await user.click(confirmButton);

      expect(mockOnConfirm).toHaveBeenCalledTimes(3);
    });
  });

  describe('Variant Styling', () => {
    it('should apply warning variant by default', () => {
      const mockOnConfirm = vi.fn();
      const mockOnCancel = vi.fn();

      render(
        <ConfirmDialog
          isOpen={true}
          title="Test"
          message="Test"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const confirmButton = screen.getByRole('button', { name: 'Confirm' });
      expect(confirmButton).toHaveAttribute('data-variant', 'primary');
    });

    it('should apply danger variant styling', () => {
      const mockOnConfirm = vi.fn();
      const mockOnCancel = vi.fn();

      render(
        <ConfirmDialog
          isOpen={true}
          title="Test"
          message="Test"
          variant="danger"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const confirmButton = screen.getByRole('button', { name: 'Confirm' });
      expect(confirmButton).toHaveAttribute('data-variant', 'destructive');
    });

    it('should apply warning variant styling', () => {
      const mockOnConfirm = vi.fn();
      const mockOnCancel = vi.fn();

      render(
        <ConfirmDialog
          isOpen={true}
          title="Test"
          message="Test"
          variant="warning"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const confirmButton = screen.getByRole('button', { name: 'Confirm' });
      expect(confirmButton).toHaveAttribute('data-variant', 'primary');
    });

    it('should apply info variant styling', () => {
      const mockOnConfirm = vi.fn();
      const mockOnCancel = vi.fn();

      render(
        <ConfirmDialog
          isOpen={true}
          title="Test"
          message="Test"
          variant="info"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const confirmButton = screen.getByRole('button', { name: 'Confirm' });
      expect(confirmButton).toHaveAttribute('data-variant', 'primary');
    });
  });

  describe('Accessibility - Focus Management', () => {
    it('should focus the confirm button when dialog opens', async () => {
      const mockOnConfirm = vi.fn();
      const mockOnCancel = vi.fn();

      const { rerender } = render(
        <ConfirmDialog
          isOpen={false}
          title="Test"
          message="Test"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      rerender(
        <ConfirmDialog
          isOpen={true}
          title="Test"
          message="Test"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        const confirmButton = screen.getByRole('button', { name: 'Confirm' });
        expect(confirmButton).toHaveFocus();
      });
    });

    it('should maintain focus on confirm button after render', async () => {
      const mockOnConfirm = vi.fn();
      const mockOnCancel = vi.fn();

      render(
        <ConfirmDialog
          isOpen={true}
          title="Test"
          message="Test"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        const confirmButton = screen.getByRole('button', { name: 'Confirm' });
        expect(confirmButton).toHaveFocus();
      });
    });
  });

  describe('Keyboard Interaction', () => {
    it('should call onCancel when Escape key is pressed', async () => {
      const user = userEvent.setup();
      const mockOnConfirm = vi.fn();
      const mockOnCancel = vi.fn();

      render(
        <ConfirmDialog
          isOpen={true}
          title="Test"
          message="Test"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      await user.keyboard('{Escape}');

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it('should not call onCancel when Escape is pressed and dialog is closed', async () => {
      const user = userEvent.setup();
      const mockOnConfirm = vi.fn();
      const mockOnCancel = vi.fn();

      render(
        <ConfirmDialog
          isOpen={false}
          title="Test"
          message="Test"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      await user.keyboard('{Escape}');

      expect(mockOnCancel).not.toHaveBeenCalled();
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it('should handle multiple Escape key presses', async () => {
      const user = userEvent.setup();
      const mockOnConfirm = vi.fn();
      const mockOnCancel = vi.fn();

      render(
        <ConfirmDialog
          isOpen={true}
          title="Test"
          message="Test"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      await user.keyboard('{Escape}');
      await user.keyboard('{Escape}');

      expect(mockOnCancel).toHaveBeenCalledTimes(2);
    });

    it('should call onConfirm when Enter is pressed on confirm button', async () => {
      const user = userEvent.setup();
      const mockOnConfirm = vi.fn();
      const mockOnCancel = vi.fn();

      render(
        <ConfirmDialog
          isOpen={true}
          title="Test"
          message="Test"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const confirmButton = screen.getByRole('button', { name: 'Confirm' });
      confirmButton.focus();
      await user.keyboard('{Enter}');

      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    });

    it('should call onCancel when Enter is pressed on cancel button', async () => {
      const user = userEvent.setup();
      const mockOnConfirm = vi.fn();
      const mockOnCancel = vi.fn();

      render(
        <ConfirmDialog
          isOpen={true}
          title="Test"
          message="Test"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      cancelButton.focus();
      await user.keyboard('{Enter}');

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cleanup and State Changes', () => {
    it('should remove event listeners when dialog closes', () => {
      const mockOnConfirm = vi.fn();
      const mockOnCancel = vi.fn();

      const { rerender, unmount } = render(
        <ConfirmDialog
          isOpen={true}
          title="Test"
          message="Test"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      rerender(
        <ConfirmDialog
          isOpen={false}
          title="Test"
          message="Test"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      // Dialog should not be in DOM
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      unmount();
    });

    it('should handle rapid open/close transitions', () => {
      const mockOnConfirm = vi.fn();
      const mockOnCancel = vi.fn();

      const { rerender } = render(
        <ConfirmDialog
          isOpen={false}
          title="Test"
          message="Test"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      rerender(
        <ConfirmDialog
          isOpen={true}
          title="Test"
          message="Test"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();

      rerender(
        <ConfirmDialog
          isOpen={false}
          title="Test"
          message="Test"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('Combined Props', () => {
    it('should combine custom text with danger variant', () => {
      const mockOnConfirm = vi.fn();
      const mockOnCancel = vi.fn();

      render(
        <ConfirmDialog
          isOpen={true}
          title="Delete Account"
          message="This will permanently delete your account"
          confirmText="Delete Permanently"
          cancelText="Keep Account"
          variant="danger"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Delete Account')).toBeInTheDocument();
      expect(screen.getByText('This will permanently delete your account')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete Permanently' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Keep Account' })).toBeInTheDocument();

      const confirmButton = screen.getByRole('button', { name: 'Delete Permanently' });
      expect(confirmButton).toHaveAttribute('data-variant', 'destructive');
    });

    it('should combine custom text with info variant', () => {
      const mockOnConfirm = vi.fn();
      const mockOnCancel = vi.fn();

      render(
        <ConfirmDialog
          isOpen={true}
          title="Update Available"
          message="A new version is available"
          confirmText="Update Now"
          cancelText="Later"
          variant="info"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const confirmButton = screen.getByRole('button', { name: 'Update Now' });
      expect(confirmButton).toHaveAttribute('data-variant', 'primary');
    });

    it('should handle all props together', async () => {
      const user = userEvent.setup();
      const mockOnConfirm = vi.fn();
      const mockOnCancel = vi.fn();

      render(
        <ConfirmDialog
          isOpen={true}
          title="Confirm Logout"
          message="You will be logged out of your account"
          confirmText="Yes, Logout"
          cancelText="Stay Logged In"
          variant="warning"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Confirm Logout')).toBeInTheDocument();
      expect(screen.getByText('You will be logged out of your account')).toBeInTheDocument();

      const confirmButton = screen.getByRole('button', { name: 'Yes, Logout' });
      expect(confirmButton).toHaveAttribute('data-variant', 'primary');

      await user.click(confirmButton);
      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty title', () => {
      const mockOnConfirm = vi.fn();
      const mockOnCancel = vi.fn();

      render(
        <ConfirmDialog
          isOpen={true}
          title=""
          message="Test Message"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Test Message')).toBeInTheDocument();
    });

    it('should handle empty message', () => {
      const mockOnConfirm = vi.fn();
      const mockOnCancel = vi.fn();

      render(
        <ConfirmDialog
          isOpen={true}
          title="Test Title"
          message=""
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Test Title')).toBeInTheDocument();
    });

    it('should handle long title text', () => {
      const mockOnConfirm = vi.fn();
      const mockOnCancel = vi.fn();

      const longTitle = 'This is a very long title that might wrap to multiple lines in the dialog';

      render(
        <ConfirmDialog
          isOpen={true}
          title={longTitle}
          message="Test"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText(longTitle)).toBeInTheDocument();
    });

    it('should handle long message text', () => {
      const mockOnConfirm = vi.fn();
      const mockOnCancel = vi.fn();

      const longMessage = 'This is a very long message that explains in great detail why the user needs to confirm this action. It might wrap to multiple lines and should still be readable.';

      render(
        <ConfirmDialog
          isOpen={true}
          title="Test"
          message={longMessage}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText(longMessage)).toBeInTheDocument();
    });

    it('should handle special characters in title', () => {
      const mockOnConfirm = vi.fn();
      const mockOnCancel = vi.fn();

      render(
        <ConfirmDialog
          isOpen={true}
          title="Delete <Account> & Data?"
          message="Test"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Delete <Account> & Data?')).toBeInTheDocument();
    });

    it('should handle empty custom button text', () => {
      const mockOnConfirm = vi.fn();
      const mockOnCancel = vi.fn();

      render(
        <ConfirmDialog
          isOpen={true}
          title="Test"
          message="Test"
          confirmText=""
          cancelText=""
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      // Buttons should still be clickable even with empty text
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(3); // header close button + confirm + cancel
    });
  });
});
