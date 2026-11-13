import { useEffect, useId, useState, type ReactNode } from 'react';

interface TooltipProps {
  /** Tooltip text, exposed to assistive tech via aria-describedby. */
  content: string;
  /** Visible trigger content; rendered inside a focusable button. */
  children: ReactNode;
}

/**
 * Accessible tooltip (WCAG 1.4.13): opens on hover, keyboard focus or tap;
 * stays open while hovered; Escape dismisses it.
 */
export function Tooltip({ content, children }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-describedby={id}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-touch items-center rounded-full"
      >
        {children}
      </button>
      <span
        id={id}
        role="tooltip"
        className={`absolute left-1/2 top-full z-30 mt-1 w-max max-w-[16rem] -translate-x-1/2 rounded-lg bg-ink px-3 py-2 text-xs leading-snug text-surface shadow-lg transition-opacity duration-150 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        {content}
      </span>
    </span>
  );
}
