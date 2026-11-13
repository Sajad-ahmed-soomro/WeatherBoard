import { useId, useRef, type ReactNode, type RefObject } from 'react';
import { useModalDialog } from './useModalDialog';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** 'danger' for destructive actions (red), 'primary' for a neutral go-ahead. */
  tone?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
  fallbackFocus?: RefObject<HTMLElement>;
}

export function ConfirmDialog({ open, title, description, confirmLabel, cancelLabel = 'Cancel', tone = 'danger', onConfirm, onCancel, fallbackFocus }: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const { dialogRef, dialogProps } = useModalDialog({ open, onCancel, initialFocus: cancelRef, fallbackFocus });
  const titleId = useId();
  const descriptionId = useId();

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-black/50"
      {...dialogProps}
    >
      <div className="p-6">
        <h2 id={titleId} className="text-lg font-semibold tracking-tight">
          {title}
        </h2>
        <div id={descriptionId} className="mt-2 text-sm text-muted">
          {description}
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button ref={cancelRef} type="button" onClick={onCancel} className="min-h-touch rounded-lg border border-line bg-surface px-4 text-sm font-medium hover:bg-canvas">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`min-h-touch rounded-lg px-4 text-sm font-medium hover:opacity-90 ${tone === 'danger' ? 'bg-danger text-surface' : 'bg-ink text-surface'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
