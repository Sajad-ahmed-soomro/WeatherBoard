// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createRef, useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

// jsdom has no showModal(); emulate the open attribute so the hook's logic can run.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

afterEach(cleanup);

function Harness({ onConfirm = vi.fn(), removeOpener = false }: { onConfirm?: () => void; removeOpener?: boolean }) {
  const [open, setOpen] = useState(false);
  const [openerGone, setOpenerGone] = useState(false);
  const fallback = createRef<HTMLHeadingElement>();
  return (
    <>
      <h2 ref={fallback} tabIndex={-1}>
        Fallback
      </h2>
      {!openerGone && (
        <button type="button" onClick={() => setOpen(true)}>
          Open
        </button>
      )}
      <ConfirmDialog
        open={open}
        title="Remove Lahore?"
        description="You can add it again."
        confirmLabel="Remove"
        onConfirm={() => {
          onConfirm();
          if (removeOpener) setOpenerGone(true);
          setOpen(false);
        }}
        onCancel={() => setOpen(false)}
        fallbackFocus={fallback}
      />
    </>
  );
}

const dialog = () => document.querySelector('dialog');

describe('ConfirmDialog', () => {
  it('opens with focus on Cancel and is labelled by its title', () => {
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Open' });
    opener.focus();
    fireEvent.click(opener);
    expect(dialog()?.hasAttribute('open')).toBe(true);
    expect(document.activeElement?.textContent).toBe('Cancel');
    const titleId = dialog()?.getAttribute('aria-labelledby') ?? '';
    expect(document.getElementById(titleId)?.textContent).toBe('Remove Lahore?');
  });

  it('Escape cancels and returns focus to the opener', () => {
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Open' });
    opener.focus();
    fireEvent.click(opener);
    const d = dialog();
    if (!d) throw new Error('no dialog');
    fireEvent(d, new Event('cancel', { cancelable: true }));
    expect(d.hasAttribute('open')).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it('Tab wraps from the last button to the first, and Shift+Tab the other way', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    const d = dialog();
    if (!d) throw new Error('no dialog');
    const [cancel, remove] = [...d.querySelectorAll('button')];
    remove?.focus();
    fireEvent.keyDown(d, { key: 'Tab' });
    expect(document.activeElement).toBe(cancel);
    fireEvent.keyDown(d, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(remove);
  });

  it('confirms, and moves focus to the fallback when the opener was removed', () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} removeOpener />);
    const opener = screen.getByRole('button', { name: 'Open' });
    opener.focus();
    fireEvent.click(opener);
    fireEvent.click(screen.getByRole('button', { name: 'Remove', hidden: true }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(document.activeElement?.textContent).toBe('Fallback');
  });
});
