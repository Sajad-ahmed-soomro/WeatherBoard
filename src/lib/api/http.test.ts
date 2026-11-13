import { describe, expect, it } from 'vitest';
import { parseRetryAfter } from './http';

describe('parseRetryAfter', () => {
  it('reads delta-seconds', () => {
    expect(parseRetryAfter('2')).toBe(2000);
  });

  it('reads an HTTP date relative to now', () => {
    const now = Date.parse('2026-11-13T10:00:00Z');
    expect(parseRetryAfter('Fri, 13 Nov 2026 10:00:03 GMT', now)).toBe(3000);
  });

  it('returns null when missing or unreadable', () => {
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter('soon')).toBeNull();
  });
});
