import type { MouseEvent, ReactNode, RefObject } from 'react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { cn } from './cn';

export type ModalSize = 'sm' | 'md' | 'lg';
export type ModalMobilePresentation = 'sheet' | 'center';

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  /** Renders the header row; also wired to `aria-labelledby`. */
  title?: ReactNode;
  /** Desktop max-width: sm=max-w-md, md=max-w-lg, lg=max-w-2xl. */
  size?: ModalSize;
  /** Mobile layout below the `md` breakpoint. Defaults to 'sheet'. */
  mobilePresentation?: ModalMobilePresentation;
  /** Pinned action row rendered below the content. */
  footer?: ReactNode;
  /** Element to focus on open, before falling back to the first focusable child. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Desktop max-width per size, kept as complete literal tokens (including the
// `md:` responsive prefix for the sheet variant) so Tailwind's static content
// scan can find them — building these via string interpolation at runtime
// would hide the class names from the JIT compiler.
const SHEET_MAX_WIDTH: Record<ModalSize, string> = {
  sm: 'md:max-w-md',
  md: 'md:max-w-lg',
  lg: 'md:max-w-2xl',
};

const CENTER_MAX_WIDTH: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) {
    return [];
  }
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

function trapTabFocus(event: KeyboardEvent, container: HTMLElement | null) {
  const focusable = getFocusableElements(container);
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (!first || !last) {
    event.preventDefault();
    container?.focus();
    return;
  }
  const activeElement = document.activeElement;
  const focusHasLeftPanel = !container?.contains(activeElement);

  const shouldWrapToLast = event.shiftKey && (activeElement === first || focusHasLeftPanel);
  const shouldWrapToFirst = !event.shiftKey && (activeElement === last || focusHasLeftPanel);

  if (shouldWrapToLast) {
    event.preventDefault();
    last.focus();
  } else if (shouldWrapToFirst) {
    event.preventDefault();
    first.focus();
  }
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Shared Modal/Sheet primitive: portal + focus trap + scroll lock + Escape/
 * backdrop dismissal. Presents as a bottom sheet on mobile (default) and a
 * centered panel from `md` up; `mobilePresentation="center"` centers at
 * every breakpoint.
 */
export function Modal({
  open,
  onClose,
  title,
  size = 'md',
  mobilePresentation = 'sheet',
  footer,
  initialFocusRef,
  children,
}: ModalProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const [hasEntered, setHasEntered] = useState(false);

  // Drives the entrance transition: mount at the "closed" position/opacity,
  // then flip to "open" a tick later so the browser has something to
  // interpolate between.
  useEffect(() => {
    if (!open) {
      setHasEntered(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setHasEntered(true), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  // Body scroll-lock while open; restored on close/unmount.
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Focus management: move focus in on open, trap Tab within the panel,
  // close on Escape, and return focus to the trigger on close.
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    const focusTarget =
      initialFocusRef?.current ?? getFocusableElements(panelRef.current)[0] ?? panelRef.current;
    focusTarget?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key === 'Tab') {
        trapTabFocus(event, panelRef.current);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocusedRef.current?.focus();
    };
  }, [open, onClose, initialFocusRef]);

  // Only the backdrop itself dismisses — a mousedown that bubbled up from
  // the panel (e.g. the start of a text selection) must not close it.
  const handleBackdropMouseDown = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  if (!open) {
    return null;
  }

  const isSheet = mobilePresentation === 'sheet';
  const enterClasses = isSheet
    ? cn(
        hasEntered ? 'translate-y-0' : 'translate-y-full',
        hasEntered ? 'md:scale-100 md:opacity-100' : 'md:scale-95 md:opacity-0'
      )
    : cn(hasEntered ? 'scale-100 opacity-100' : 'scale-95 opacity-0');

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title !== undefined ? titleId : undefined}
        data-size={size}
        data-presentation={mobilePresentation}
        tabIndex={-1}
        className={cn(
          'flex max-h-[85vh] w-full flex-col bg-surface-card outline-none transition duration-200 ease-out motion-reduce:transition-none',
          enterClasses,
          isSheet
            ? cn(
                'fixed inset-x-0 bottom-0 rounded-t-card pb-[env(safe-area-inset-bottom)]',
                'md:static md:inset-auto md:rounded-card md:shadow-pop',
                SHEET_MAX_WIDTH[size]
              )
            : cn('rounded-card shadow-pop', CENTER_MAX_WIDTH[size])
        )}
      >
        {isSheet && (
          <div
            aria-hidden="true"
            className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-hairline-strong md:hidden"
          />
        )}

        {title !== undefined && (
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-hairline px-6 py-4">
            <h2 id={titleId} className="text-title">
              {title}
            </h2>
            <Button variant="ghost" size="icon" aria-label={t('common.close', 'Close')} onClick={onClose}>
              <CloseIcon />
            </Button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>

        {footer !== undefined && <div className="shrink-0 border-t border-hairline px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
