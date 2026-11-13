import { useId, useRef, type RefObject } from 'react';
import { useModalDialog } from './useModalDialog';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  fallbackFocus?: RefObject<HTMLElement>;
}

export function ConfirmDialog({ open, title, description, confirmLabel, onConfirm, onCancel, fallbackFocus }: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const { dialogRef, dialogProps } = useModalDialog({ open, onCancel, initialFocus: cancelRef, fallbackFocus });
  const titleId = useId();
  const descriptionId = useId();

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-ink/40"
      {...dialogProps}
    >
      <div className="p-6">
        <h2 id={titleId} className="text-lg font-semibold tracking-tight">
          {title}
        </h2>
        <p id={descriptionId} className="mt-2 text-sm text-muted">
          {description}
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button ref={cancelRef} type="button" onClick={onCancel} className="min-h-touch rounded-lg border border-line bg-surface px-4 text-sm font-medium hover:bg-canvas">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} className="min-h-touch rounded-lg bg-danger px-4 text-sm font-medium text-white hover:opacity-90">
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
