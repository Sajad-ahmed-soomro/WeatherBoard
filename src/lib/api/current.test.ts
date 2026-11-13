import { describe, expect, it, vi } from 'vitest';
import { currentBody, epoch } from './__fixtures__/owm';
import { HttpError, NetworkError } from './errors';
import { normaliseOpenMeteoCurrent } from './openMeteo';
import { normaliseOwmCurrent } from './owm';
import type { CurrentSnapshot } from './types';
import { getCurrent, type CurrentProvider } from './weather';

const snapshot = (source: CurrentSnapshot['source']): CurrentSnapshot => ({
  source,
  fetchedAt: 0,
  current: { observedAt: 0, tempC: 20, feelsLikeC: 19, humidity: 50, windMs: 3, condition: { kind: 'clear', label: 'Clear sky', isDay: true } },
});

describe('current-only normalisers', () => {
  it('reads an OWM /weather body', () => {
    const result = normaliseOwmCurrent(currentBody('2026-11-13T10:00', 26.4, 'clear'), 1000);
    expect(result).toMatchObject({ source: 'owm', fetchedAt: 1000, current: { tempC: 26.4, condition: { kind: 'clear', isDay: true } } });
  });

  it('reads an Open-Meteo current-only body', () => {
    const body = {
      utc_offset_seconds: 18000,
      current: { time: epoch('2026-11-13T22:00'), temperature_2m: 18, apparent_temperature: 17, relative_humidity_2m: 60, wind_speed_10m: 1, weather_code: 3, is_day: 0 },
    };
    expect(normaliseOpenMeteoCurrent(body, 2000)).toMatchObject({
      source: 'open-meteo',
      fetchedAt: 2000,
      current: { tempC: 18, condition: { kind: 'cloudy', isDay: false } },
    });
  });
});

describe('getCurrent', () => {
  function providers(primaryError: unknown) {
    return {
      primary: vi.fn<CurrentProvider>(() => (primaryError === null ? Promise.resolve(snapshot('owm')) : Promise.reject(primaryError))),
      fallback: vi.fn<CurrentProvider>(() => Promise.resolve(snapshot('open-meteo'))),
    };
  }

  it('falls back on network errors and 5xx, like getWeather', async () => {
    await expect(getCurrent(1, 2, providers(new NetworkError()))).resolves.toMatchObject({ source: 'open-meteo' });
    await expect(getCurrent(1, 2, providers(new HttpError(502)))).resolves.toMatchObject({ source: 'open-meteo' });
  });

  it('does not fall back on 401', async () => {
    const p = providers(new HttpError(401));
    await expect(getCurrent(1, 2, p)).rejects.toMatchObject({ kind: 'unknown' });
    expect(p.fallback).not.toHaveBeenCalled();
  });
});
