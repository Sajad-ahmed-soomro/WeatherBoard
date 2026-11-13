import { useCallback, useLayoutEffect, useRef, type KeyboardEvent, type MouseEvent, type RefObject, type SyntheticEvent } from 'react';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface UseModalDialogOptions {
  open: boolean;
  onCancel: () => void;
  /** Focused when the dialog opens (usually the safe choice). */
  initialFocus: RefObject<HTMLElement>;
  /** Used when the element that opened the dialog no longer exists (e.g. it was removed). */
  fallbackFocus?: RefObject<HTMLElement> | undefined;
}

/**
 * Drives a native <dialog> as a modal: showModal() makes the page behind it inert, Tab wraps
 * inside the dialog, Escape or a backdrop click cancels, and focus returns to where it was.
 */
export function useModalDialog({ open, onCancel, initialFocus, fallbackFocus }: UseModalDialogOptions) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  // Layout effect: open/close before paint, so the dialog never shows a frame of stale content.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      initialFocus.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
      const target = opener.current?.isConnected ? opener.current : fallbackFocus?.current;
      target?.focus();
      opener.current = null;
    }
  }, [open, initialFocus, fallbackFocus]);

  /** Escape fires "cancel"; keep the dialog under React's control instead of letting it close itself. */
  const onDialogCancel = useCallback(
    (event: SyntheticEvent<HTMLDialogElement>) => {
      event.preventDefault();
      onCancel();
    },
    [onCancel],
  );

  /** A click whose target is the <dialog> itself landed on the backdrop. */
  const onDialogClick = useCallback(
    (event: MouseEvent<HTMLDialogElement>) => {
      if (event.target === event.currentTarget) onCancel();
    },
    [onCancel],
  );

  const onDialogKeyDown = useCallback((event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== 'Tab') return;
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  return { dialogRef, dialogProps: { onCancel: onDialogCancel, onClick: onDialogClick, onKeyDown: onDialogKeyDown } };
}
