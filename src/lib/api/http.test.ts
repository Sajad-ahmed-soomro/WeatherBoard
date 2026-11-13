import { afterEach, describe, expect, it, vi } from 'vitest';
import { FETCHED_AT_HEADER } from '../pwa/weatherCacheRules';
import { fetchJsonWithMeta, parseRetryAfter } from './http';

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

describe('fetchJsonWithMeta', () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns the body with the service worker's fetched-at stamp", async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{"ok":true}', { headers: { [FETCHED_AT_HEADER]: '1234' } }))));
    await expect(fetchJsonWithMeta('https://example.test')).resolves.toEqual({ body: { ok: true }, fetchedAt: 1234 });
  });

  it('reports null when nothing stamped the response, and passes the cache mode through', async () => {
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(new Response('{}')));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchJsonWithMeta('https://example.test', { cache: 'no-store' })).resolves.toEqual({ body: {}, fetchedAt: null });
    expect(fetchMock.mock.calls[0]?.[1]?.cache).toBe('no-store');
  });
});
