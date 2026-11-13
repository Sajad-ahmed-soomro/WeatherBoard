// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { City, CurrentSnapshot } from '../../lib/api/types';
import { FRESH_FOR_MS, needsFetch, resolveMiniTemp, type LatestViewed } from './miniTemps';
import { useMiniTemps } from './useMiniTemps';

const city = (n: number): City => ({ id: `c${n}`, type: 'CITY', name: `City ${n}`, region: null, country: 'X', countryCode: 'XX', lat: n, lon: n });

const snap = (tempC: number, fetchedAt: number): CurrentSnapshot => ({
  source: 'owm',
  fetchedAt,
  current: { observedAt: fetchedAt, tempC, feelsLikeC: tempC, humidity: 50, windMs: 1, condition: { kind: 'clear', label: 'Clear sky', isDay: true } },
});

describe('resolveMiniTemp / needsFetch', () => {
  it('prefers whichever reading is newer', () => {
    const own = { status: 'ready', snapshot: snap(10, 100) } as const;
    expect(resolveMiniTemp('c1', own, { cityId: 'c1', snapshot: snap(20, 200) })).toMatchObject({ snapshot: { current: { tempC: 20 } } });
    expect(resolveMiniTemp('c1', own, { cityId: 'c1', snapshot: snap(5, 50) })).toMatchObject({ snapshot: { current: { tempC: 10 } } });
    expect(resolveMiniTemp('c1', own, { cityId: 'c2', snapshot: snap(20, 200) })).toMatchObject({ snapshot: { current: { tempC: 10 } } });
  });

  it('is loading with nothing known, and an error stays an error', () => {
    expect(resolveMiniTemp('c1', undefined, null)).toEqual({ status: 'loading' });
    expect(resolveMiniTemp('c1', { status: 'error' }, null)).toEqual({ status: 'error' });
  });

  it('fetches when missing, failed, or older than the fresh window', () => {
    expect(needsFetch('c1', undefined, null, 0)).toBe(true);
    expect(needsFetch('c1', { status: 'error' }, null, 0)).toBe(true);
    const latest: LatestViewed = { cityId: 'c1', snapshot: snap(1, 1000) };
    expect(needsFetch('c1', undefined, latest, 1000 + FRESH_FOR_MS - 1)).toBe(false);
    expect(needsFetch('c1', undefined, latest, 1000 + FRESH_FOR_MS)).toBe(true);
  });
});

interface Call {
  lat: number;
  signal: AbortSignal;
  resolve: (s: CurrentSnapshot) => void;
  reject: (e: unknown) => void;
}

function setup(initial: readonly City[], latest: LatestViewed | null = null) {
  const calls: Call[] = [];
  let clock = 0;
  const fetchCurrent = (lat: number, _lon: number, { signal }: { signal: AbortSignal }) =>
    new Promise<CurrentSnapshot>((resolve, reject) => calls.push({ lat, signal, resolve, reject }));
  const now = () => clock;
  const hook = renderHook(({ favs, viewed }) => useMiniTemps(favs, { latest: viewed, fetchCurrent, now }), {
    initialProps: { favs: initial, viewed: latest },
  });
  return { ...hook, calls, tick: (ms: number) => (clock += ms) };
}

const flush = () => act(async () => {});

function becomeVisible() {
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

describe('useMiniTemps', () => {
  it('fetches each favourite once and shows its temperature', async () => {
    const { result, calls, rerender } = setup([city(1), city(2)]);
    expect(calls.map((c) => c.lat)).toEqual([1, 2]);
    expect(result.current.tempFor('c1')).toEqual({ status: 'loading' });

    calls[0]?.resolve(snap(21, 0));
    await flush();
    expect(result.current.tempFor('c1')).toMatchObject({ status: 'ready', snapshot: { current: { tempC: 21 } } });

    rerender({ favs: [city(1), city(2)], viewed: null });
    expect(calls).toHaveLength(2);
  });

  it('skips a city the main panel has just loaded', () => {
    const { calls } = setup([city(1), city(2)], { cityId: 'c1', snapshot: snap(30, 0) });
    expect(calls.map((c) => c.lat)).toEqual([2]);
  });

  it('only fetches the newly added favourite', () => {
    const { calls, rerender } = setup([city(1)]);
    rerender({ favs: [city(1), city(2)], viewed: null });
    expect(calls.map((c) => c.lat)).toEqual([1, 2]);
  });

  it('aborts the request for a favourite that was removed', () => {
    const { calls, rerender } = setup([city(1), city(2)]);
    rerender({ favs: [city(2)], viewed: null });
    expect(calls[0]?.signal.aborted).toBe(true);
    expect(calls[1]?.signal.aborted).toBe(false);
  });

  it('shows an error, then retries when the tab becomes visible again', async () => {
    const { result, calls } = setup([city(1)]);
    calls[0]?.reject(new Error('down'));
    await flush();
    expect(result.current.tempFor('c1')).toEqual({ status: 'error' });

    becomeVisible();
    expect(calls).toHaveLength(2);
  });

  it('refreshes stale readings on visibility, but not fresh ones', async () => {
    const { calls, tick } = setup([city(1)]);
    calls[0]?.resolve(snap(20, 0));
    await flush();

    tick(FRESH_FOR_MS - 1);
    becomeVisible();
    expect(calls).toHaveLength(1);

    tick(1);
    becomeVisible();
    expect(calls).toHaveLength(2);
  });

  it('aborts everything on unmount', () => {
    const { calls, unmount } = setup([city(1), city(2)]);
    unmount();
    expect(calls.every((c) => c.signal.aborted)).toBe(true);
  });
});
