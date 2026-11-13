import { describe, expect, it, vi } from 'vitest';
import { AppError, HttpError, NetworkError, abortError } from './errors';
import type { WeatherData } from './types';
import { getWeather, type WeatherProvider } from './weather';

function data(source: WeatherData['source']): WeatherData {
  return {
    coords: { lat: 1, lon: 2 },
    source,
    fetchedAt: 0,
    utcOffsetSec: 0,
    current: {
      observedAt: 0,
      tempC: 20,
      feelsLikeC: 19,
      humidity: 50,
      windMs: 3,
      condition: { kind: 'clear', label: 'Clear sky', isDay: true },
    },
    daily: [],
  };
}

function providers(primaryError: unknown, fallbackError?: unknown) {
  const primary = vi.fn<WeatherProvider>(() =>
    primaryError === null ? Promise.resolve(data('owm')) : Promise.reject(primaryError),
  );
  const fallback = vi.fn<WeatherProvider>(() =>
    fallbackError === undefined ? Promise.resolve(data('open-meteo')) : Promise.reject(fallbackError),
  );
  return { primary, fallback };
}

describe('getWeather', () => {
  it('uses OpenWeatherMap when it succeeds', async () => {
    const p = providers(null);
    await expect(getWeather(1, 2, p)).resolves.toMatchObject({ source: 'owm' });
    expect(p.primary).toHaveBeenCalledWith({ lat: 1, lon: 2 }, undefined);
    expect(p.fallback).not.toHaveBeenCalled();
  });

  it.each([
    ['429 rate limit', new HttpError(429)],
    ['500 server error', new HttpError(500)],
    ['503 unavailable', new HttpError(503)],
    ['network failure', new NetworkError()],
  ])('falls back to Open-Meteo on %s', async (_label, err) => {
    const p = providers(err);
    await expect(getWeather(1, 2, p)).resolves.toMatchObject({ source: 'open-meteo' });
    expect(p.fallback).toHaveBeenCalledTimes(1);
  });

  it('does not fall back on 401 and reports a key problem', async () => {
    const p = providers(new HttpError(401));
    const err = await getWeather(1, 2, p).catch((e: unknown) => e);
    expect(p.fallback).not.toHaveBeenCalled();
    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({ kind: 'unknown', action: { id: 'retry' } });
    expect((err as AppError).message).toMatch(/API key/);
  });

  it('does not fall back on 404 and offers a new search', async () => {
    const p = providers(new HttpError(404));
    await expect(getWeather(1, 2, p)).rejects.toMatchObject({ kind: 'not_found', action: { id: 'edit_search' } });
    expect(p.fallback).not.toHaveBeenCalled();
  });

  it('throws a typed AppError with a recovery action when both sources fail', async () => {
    const p = providers(new HttpError(503), new NetworkError());
    const err = await getWeather(1, 2, p).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({ kind: 'network', action: { id: 'retry', label: 'Try again' } });
    expect((err as AppError).message).not.toMatch(/something went wrong/i);
  });

  it('maps a rate-limited fallback to rate_limit', async () => {
    const p = providers(new HttpError(429), new HttpError(429));
    await expect(getWeather(1, 2, p)).rejects.toMatchObject({ kind: 'rate_limit' });
  });

  it('rethrows aborts without falling back', async () => {
    const p = providers(abortError());
    await expect(getWeather(1, 2, p)).rejects.toMatchObject({ name: 'AbortError' });
    expect(p.fallback).not.toHaveBeenCalled();
  });
});
