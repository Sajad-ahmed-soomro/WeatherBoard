// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CitySearchClient, SearchRequestOptions } from '../../lib/api/citySearch';
import { AppError } from '../../lib/api/errors';
import type { City } from '../../lib/api/types';
import { useCitySearch } from './useCitySearch';

function city(name: string): City {
  return { id: name, type: 'CITY', name, region: null, country: 'Pakistan', countryCode: 'PK', lat: 31.5, lon: 74.3 };
}

interface PendingCall {
  query: string;
  options: SearchRequestOptions;
  resolve: (cities: City[]) => void;
  reject: (err: unknown) => void;
}

/** Fake client whose responses the test resolves by hand, in any order. */
function fakeClient(cache: Record<string, City[]> = {}) {
  const calls: PendingCall[] = [];
  const client: CitySearchClient = {
    peek: (query) => cache[query],
    search: (query, options = {}) =>
      new Promise<City[]>((resolve, reject) => {
        calls.push({ query, options, resolve, reject });
      }),
  };
  return { client, calls };
}

const flush = () => act(async () => {});

describe('useCitySearch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('stays idle below 2 characters without calling the API', async () => {
    const { client, calls } = fakeClient();
    const { result } = renderHook(() => useCitySearch({ client }));
    act(() => result.current.search(' l '));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(result.current.state).toEqual({ status: 'idle' });
    expect(calls).toHaveLength(0);
  });

  it('shows loading immediately, debounces 300 ms, then shows results', async () => {
    const { client, calls } = fakeClient();
    const { result } = renderHook(() => useCitySearch({ client }));

    act(() => result.current.search('lah'));
    expect(result.current.state).toEqual({ status: 'loading', query: 'lah' });

    await act(() => vi.advanceTimersByTimeAsync(299));
    expect(calls).toHaveLength(0);
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(calls.map((c) => c.query)).toEqual(['lah']);

    calls[0]?.resolve([city('Lahore')]);
    await flush();
    expect(result.current.state).toEqual({ status: 'results', query: 'lah', cities: [city('Lahore')] });
  });

  it('restarts the debounce on every keystroke so only the last query is sent', async () => {
    const { client, calls } = fakeClient();
    const { result } = renderHook(() => useCitySearch({ client }));
    act(() => result.current.search('la'));
    await act(() => vi.advanceTimersByTimeAsync(200));
    act(() => result.current.search('lah'));
    await act(() => vi.advanceTimersByTimeAsync(200));
    act(() => result.current.search('laho'));
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(calls.map((c) => c.query)).toEqual(['laho']);
  });

  it('reports an empty result set', async () => {
    const { client, calls } = fakeClient();
    const { result } = renderHook(() => useCitySearch({ client }));
    act(() => result.current.search('xyz'));
    await act(() => vi.advanceTimersByTimeAsync(300));
    calls[0]?.resolve([]);
    await flush();
    expect(result.current.state).toEqual({ status: 'empty', query: 'xyz' });
  });

  it('renders cached results instantly, with no loading state and no request', async () => {
    const { client, calls } = fakeClient({ lahore: [city('Lahore')] });
    const { result } = renderHook(() => useCitySearch({ client }));
    act(() => result.current.search('lahore'));
    expect(result.current.state).toEqual({ status: 'results', query: 'lahore', cities: [city('Lahore')] });
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(calls).toHaveLength(0);
  });

  it('switches to "retrying" when the client retries a 429', async () => {
    const { client, calls } = fakeClient();
    const { result } = renderHook(() => useCitySearch({ client }));
    act(() => result.current.search('lah'));
    await act(() => vi.advanceTimersByTimeAsync(300));
    act(() => calls[0]?.options.onRetry?.());
    expect(result.current.state).toEqual({ status: 'retrying', query: 'lah' });
  });

  it('surfaces an AppError, and retry() re-runs the query immediately', async () => {
    const { client, calls } = fakeClient();
    const { result } = renderHook(() => useCitySearch({ client }));
    act(() => result.current.search('lah'));
    await act(() => vi.advanceTimersByTimeAsync(300));

    const error = new AppError('rate_limit', 'City search is busy right now. Wait a moment, then try again.', {
      id: 'retry',
      label: 'Try again',
    });
    calls[0]?.reject(error);
    await flush();
    expect(result.current.state).toEqual({ status: 'error', query: 'lah', error });

    act(() => result.current.retry());
    expect(result.current.state).toEqual({ status: 'loading', query: 'lah' });
    expect(calls).toHaveLength(2);
    calls[1]?.resolve([city('Lahore')]);
    await flush();
    expect(result.current.state.status).toBe('results');
  });

  it('ignores a stale response that arrives after a newer one, and aborts the stale request', async () => {
    const { client, calls } = fakeClient();
    const { result } = renderHook(() => useCitySearch({ client }));

    act(() => result.current.search('la'));
    await act(() => vi.advanceTimersByTimeAsync(300));
    act(() => result.current.search('lah'));
    await act(() => vi.advanceTimersByTimeAsync(300));

    const [stale, fresh] = calls;
    expect(stale?.options.signal?.aborted).toBe(true);
    expect(fresh?.options.signal?.aborted).toBe(false);

    fresh?.resolve([city('Lahore')]);
    await flush();
    stale?.resolve([city('Lagos')]);
    await flush();
    expect(result.current.state).toEqual({ status: 'results', query: 'lah', cities: [city('Lahore')] });
  });

  it('does not show an error for an aborted request', async () => {
    const { client, calls } = fakeClient();
    const { result } = renderHook(() => useCitySearch({ client }));
    act(() => result.current.search('la'));
    await act(() => vi.advanceTimersByTimeAsync(300));
    act(() => result.current.search('l'));
    calls[0]?.reject(new DOMException('aborted', 'AbortError'));
    await flush();
    expect(result.current.state).toEqual({ status: 'idle' });
  });

  it('aborts the in-flight request and drops the pending debounce on unmount', async () => {
    const { client, calls } = fakeClient();
    const { result, unmount } = renderHook(() => useCitySearch({ client }));

    act(() => result.current.search('la'));
    await act(() => vi.advanceTimersByTimeAsync(300));
    act(() => result.current.search('lah'));
    unmount();

    expect(calls[0]?.options.signal?.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls).toHaveLength(1);
  });

  it('reset() cancels work and returns to idle', async () => {
    const { client, calls } = fakeClient();
    const { result } = renderHook(() => useCitySearch({ client }));
    act(() => result.current.search('lah'));
    act(() => result.current.reset());
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(result.current.state).toEqual({ status: 'idle' });
    expect(calls).toHaveLength(0);
  });
});
