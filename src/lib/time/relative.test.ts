import { describe, expect, it } from 'vitest';
import { formatUpdatedAgo } from './relative';

const T = Date.parse('2026-11-13T10:00:00Z');
const min = (n: number) => n * 60_000;

describe('formatUpdatedAgo', () => {
  it.each([
    [0, 'Updated just now'],
    [59_999, 'Updated just now'],
    [min(1), 'Updated 1 min ago'],
    [min(59) + 59_000, 'Updated 59 min ago'],
    [min(60), 'Updated 1 hr ago'],
    [min(23 * 60 + 59), 'Updated 23 hr ago'],
  ])('%i ms later → %s', (elapsed, expected) => {
    expect(formatUpdatedAgo(T, T + elapsed)).toBe(expected);
  });

  it('switches to a date after a day', () => {
    expect(formatUpdatedAgo(T, T + min(25 * 60))).toMatch(/^Updated on \d{1,2} Nov$/);
  });

  it('treats a fetch time in the future (clock skew) as just now', () => {
    expect(formatUpdatedAgo(T + min(5), T)).toBe('Updated just now');
  });
});
