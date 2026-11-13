import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCitySearchClient, normaliseQuery } from './citySearch';
import { AppError, HttpError } from './errors';
import type { City } from './types';

const LAHORE: City = {
  id: '1',
  name: 'Lahore',
  region: 'Punjab',
  country: 'Pakistan',
  countryCode: 'PK',
  lat: 31.5497,
  lon: 74.3436,
};

type FetchCities = (namePrefix: string, signal?: AbortSignal) => Promise<City[]>;

function setup() {
  const fetchCities = vi.fn<FetchCities>(() => Promise.resolve([LAHORE]));
  const client = createCitySearchClient({ fetchCities });
  return { fetchCities, client };
}

describe('city search client', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-13T10:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('normalises queries for the cache key', () => {
    expect(normaliseQuery('  New   YORK ')).toBe('new york');
  });

  it('sends the first request immediately and spaces the next one at least 1100 ms later', async () => {
    const { client, fetchCities } = setup();
    await client.search('la');
    expect(fetchCities).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(200);
    const second = client.search('lah');
    await vi.advanceTimersByTimeAsync(899);
    expect(fetchCities).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await second;
    expect(fetchCities).toHaveBeenCalledTimes(2);
    expect(fetchCities).toHaveBeenLastCalledWith('lah', undefined);
  });

  it('only sends the latest waiting query; superseded ones reject with AbortError', async () => {
    const { client, fetchCities } = setup();
    await client.search('la');

    const stale = client.search('lah');
    const staleResult = stale.catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(100);
    const latest = client.search('laho');

    await expect(staleResult).resolves.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(1100);
    await expect(latest).resolves.toEqual([LAHORE]);

    expect(fetchCities.mock.calls.map(([q]) => q)).toEqual(['la', 'laho']);
  });

  it('serves a repeated query from the cache with zero network calls, even inside the throttle window', async () => {
    const { client, fetchCities } = setup();
    await client.search('Lahore');
    fetchCities.mockClear();

    await expect(client.search('  lahore ')).resolves.toEqual([LAHORE]);
    expect(fetchCities).not.toHaveBeenCalled();
  });

  it('stops waiting when the caller aborts', async () => {
    const { client, fetchCities } = setup();
    await client.search('la');
    const controller = new AbortController();
    const pending = client.search('lah', controller.signal).catch((e: unknown) => e);
    controller.abort();
    await expect(pending).resolves.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetchCities).toHaveBeenCalledTimes(1);
  });

  it('retries a 429 once after Retry-After, then succeeds', async () => {
    const { client, fetchCities } = setup();
    fetchCities.mockRejectedValueOnce(new HttpError(429, 2000));

    const result = client.search('ka');
    await vi.advanceTimersByTimeAsync(1999);
    expect(fetchCities).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toEqual([LAHORE]);
    expect(fetchCities).toHaveBeenCalledTimes(2);
  });

  it('defaults to 1 s when Retry-After is missing, still honouring the 1100 ms gap', async () => {
    const { client, fetchCities } = setup();
    fetchCities.mockRejectedValueOnce(new HttpError(429));

    const result = client.search('ka');
    await vi.advanceTimersByTimeAsync(1099);
    expect(fetchCities).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toEqual([LAHORE]);
  });

  it('gives up after one retry with a rate_limit AppError', async () => {
    const { client, fetchCities } = setup();
    fetchCities.mockRejectedValue(new HttpError(429));

    const result = client.search('ka').catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(5000);
    const err = await result;

    expect(fetchCities).toHaveBeenCalledTimes(2);
    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({ kind: 'rate_limit', action: { id: 'retry' } });
  });

  it('does not cache failures', async () => {
    const { client, fetchCities } = setup();
    fetchCities.mockRejectedValueOnce(new HttpError(500));
    await expect(client.search('ka')).rejects.toMatchObject({ kind: 'unknown' });

    await vi.advanceTimersByTimeAsync(1100);
    await expect(client.search('ka')).resolves.toEqual([LAHORE]);
    expect(fetchCities).toHaveBeenCalledTimes(2);
  });
});
