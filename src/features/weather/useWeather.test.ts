// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppError, HttpError } from '../../lib/api/errors';
import type { City, WeatherData } from '../../lib/api/types';
import { createSafeStorage, type KeyValueStore } from '../../lib/storage/safeStorage';
import { loadLastViewed, saveLastViewed } from './lastViewed';
import { useWeather } from './useWeather';

const LAHORE: City = { id: 'l', type: 'CITY', name: 'Lahore', region: 'Punjab', country: 'Pakistan', countryCode: 'PK', lat: 31.55, lon: 74.34 };
const KARACHI: City = { ...LAHORE, id: 'k', name: 'Karachi', lat: 24.86, lon: 67 };

function weather(fetchedAt: number, tempC = 22): WeatherData {
  return {
    coords: { lat: 0, lon: 0 },
    source: 'owm',
    fetchedAt,
    utcOffsetSec: 18000,
    current: { observedAt: fetchedAt, tempC, feelsLikeC: tempC, humidity: 50, windMs: 2, condition: { kind: 'clear', label: 'Clear sky', isDay: true } },
    daily: [],
  };
}

function memoryBacking(): KeyValueStore {
  const map = new Map<string, string>();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) };
}

interface Call {
  lat: number;
  signal: AbortSignal;
  resolve: (data: WeatherData) => void;
  reject: (err: unknown) => void;
}

function setup(store = createSafeStorage(memoryBacking)) {
  const calls: Call[] = [];
  const fetchWeather = (lat: number, _lon: number, { signal }: { signal: AbortSignal }) =>
    new Promise<WeatherData>((resolve, reject) => calls.push({ lat, signal, resolve, reject }));
  const hook = renderHook(() => useWeather({ fetchWeather, store }));
  return { ...hook, calls, store };
}

const flush = () => act(async () => {});

describe('useWeather', () => {
  it('starts idle (empty state) when nothing was viewed before', () => {
    const { result, calls } = setup();
    expect(result.current.state).toEqual({ status: 'idle' });
    expect(calls).toHaveLength(0);
  });

  it('goes loading → success by lat/lon and persists { lastCity, fetchedAt }', async () => {
    const { result, calls, store } = setup();
    act(() => result.current.load(LAHORE));
    expect(result.current.state).toEqual({ status: 'loading', city: LAHORE });
    expect(calls[0]?.lat).toBe(31.55);

    calls[0]?.resolve(weather(1000));
    await flush();
    expect(result.current.state).toMatchObject({ status: 'success', city: LAHORE, data: { fetchedAt: 1000 } });
    expect(loadLastViewed(store)).toEqual({ lastCity: LAHORE, fetchedAt: 1000 });
  });

  it('maps failures to a typed AppError and does not persist', async () => {
    const { result, calls, store } = setup();
    act(() => result.current.load(LAHORE));
    calls[0]?.reject(new HttpError(404));
    await flush();
    const { state } = result.current;
    expect(state.status).toBe('error');
    if (state.status === 'error') {
      expect(state.error).toBeInstanceOf(AppError);
      expect(state.error).toMatchObject({ kind: 'not_found', action: { id: 'edit_search' } });
    }
    expect(loadLastViewed(store)).toBeNull();
  });

  it('retry() reloads the same city', async () => {
    const { result, calls } = setup();
    act(() => result.current.load(LAHORE));
    calls[0]?.reject(new AppError('network', 'offline', { id: 'retry', label: 'Try again' }));
    await flush();
    act(() => result.current.retry());
    expect(result.current.state).toEqual({ status: 'loading', city: LAHORE });
    calls[1]?.resolve(weather(2000));
    await flush();
    expect(result.current.state.status).toBe('success');
  });

  it('ignores a slow response for a city the user already left, and aborts it', async () => {
    const { result, calls } = setup();
    act(() => result.current.load(LAHORE));
    act(() => result.current.load(KARACHI));
    expect(calls[0]?.signal.aborted).toBe(true);

    calls[1]?.resolve(weather(2000, 30));
    await flush();
    calls[0]?.resolve(weather(1000, 10));
    await flush();
    expect(result.current.state).toMatchObject({ status: 'success', city: KARACHI, data: { current: { tempC: 30 } } });
  });

  it('restores the last viewed city on mount, showing loading straight away', async () => {
    const store = createSafeStorage(memoryBacking);
    saveLastViewed({ lastCity: KARACHI, fetchedAt: 500 }, store);
    const { result, calls } = setup(store);
    expect(result.current.state).toEqual({ status: 'loading', city: KARACHI });
    expect(calls).toHaveLength(1);
    calls[0]?.resolve(weather(3000));
    await flush();
    expect(result.current.state.status).toBe('success');
  });

  it('still restores under StrictMode double-mount (first request aborted, second kept)', async () => {
    const store = createSafeStorage(memoryBacking);
    saveLastViewed({ lastCity: KARACHI, fetchedAt: 500 }, store);
    const calls: Call[] = [];
    const fetchWeather = (lat: number, _lon: number, { signal }: { signal: AbortSignal }) =>
      new Promise<WeatherData>((resolve, reject) => calls.push({ lat, signal, resolve, reject }));
    const { result } = renderHook(() => useWeather({ fetchWeather, store }), { reactStrictMode: true });

    const live = calls.filter((c) => !c.signal.aborted);
    expect(live).toHaveLength(1);
    live[0]?.resolve(weather(3000));
    await flush();
    expect(result.current.state.status).toBe('success');
  });

  it('keeps the restore request alive when the caller re-renders with new option identities', async () => {
    const store = createSafeStorage(memoryBacking);
    saveLastViewed({ lastCity: KARACHI, fetchedAt: 500 }, store);
    const calls: Call[] = [];
    // A fresh function on every render, as an inline prop would be.
    const { result, rerender } = renderHook(() =>
      useWeather({
        fetchWeather: (lat, _lon, { signal }) => new Promise<WeatherData>((resolve, reject) => calls.push({ lat, signal, resolve, reject })),
        store,
      }),
    );
    expect(calls).toHaveLength(1);

    rerender();
    expect(calls[0]?.signal.aborted).toBe(false);
    expect(calls).toHaveLength(1);

    calls[0]?.resolve(weather(3000));
    await flush();
    expect(result.current.state.status).toBe('success');
  });

  it('refresh() swaps in newer data without a loading state', async () => {
    const { result, calls } = setup();
    act(() => result.current.load(LAHORE));
    calls[0]?.resolve(weather(1000, 10));
    await flush();

    act(() => result.current.refresh());
    expect(result.current.state).toMatchObject({ status: 'success', data: { fetchedAt: 1000 } });
    calls[1]?.resolve(weather(5000, 12));
    await flush();
    expect(result.current.state).toMatchObject({ status: 'success', data: { fetchedAt: 5000, current: { tempC: 12 } } });
  });

  it('a failed refresh keeps the data on screen', async () => {
    const { result, calls } = setup();
    act(() => result.current.load(LAHORE));
    calls[0]?.resolve(weather(1000));
    await flush();

    act(() => result.current.refresh());
    calls[1]?.reject(new AppError('network', 'offline', { id: 'retry', label: 'Try again' }));
    await flush();
    expect(result.current.state).toMatchObject({ status: 'success', data: { fetchedAt: 1000 } });
  });

  it('refresh() does nothing unless weather is showing', () => {
    const { result, calls } = setup();
    act(() => result.current.refresh());
    expect(calls).toHaveLength(0);
  });

  it('aborts the in-flight request on unmount', () => {
    const { result, calls, unmount } = setup();
    act(() => result.current.load(LAHORE));
    unmount();
    expect(calls[0]?.signal.aborted).toBe(true);
  });
});
