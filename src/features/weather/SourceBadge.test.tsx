// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BACKUP_SOURCE_TOOLTIP, SourceBadge } from './SourceBadge';

afterEach(cleanup);

describe('SourceBadge', () => {
  it('renders nothing for the primary source', () => {
    const { container } = render(<SourceBadge source="owm" />);
    expect(container.childElementCount).toBe(0);
  });

  it('is a keyboard-focusable trigger described by the tooltip, which shows on focus and hides on Escape', () => {
    render(<SourceBadge source="open-meteo" />);
    const trigger = screen.getByRole('button', { name: /using backup source/i });
    const tooltip = screen.getByRole('tooltip', { hidden: true });

    expect(tooltip.textContent).toBe(BACKUP_SOURCE_TOOLTIP);
    expect(trigger.getAttribute('aria-describedby')).toBe(tooltip.id);
    expect(tooltip.className).toContain('opacity-0');

    fireEvent.focus(trigger);
    expect(tooltip.className).toContain('opacity-100');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(tooltip.className).toContain('opacity-0');
  });
});
