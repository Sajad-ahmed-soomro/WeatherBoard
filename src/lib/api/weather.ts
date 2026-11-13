import { HttpError, NetworkError, isAbortError, toAppError } from './errors';
import { fetchOpenMeteoCurrent, fetchOpenMeteoWeather } from './openMeteo';
import { fetchOwmCurrent, fetchOwmWeather } from './owm';
import type { Coordinates, CurrentSnapshot, WeatherData } from './types';

export type Provider<T> = (coords: Coordinates, signal?: AbortSignal) => Promise<T>;
export type WeatherProvider = Provider<WeatherData>;
export type CurrentProvider = Provider<CurrentSnapshot>;

interface FallbackOptions<T> {
  signal?: AbortSignal;
  primary?: Provider<T>;
  fallback?: Provider<T>;
}

/**
 * Fall back only when the primary is unavailable: rate limited, server error, or unreachable.
 * 401/404 mean the request itself is wrong, so a second provider would only hide the problem.
 */
export function shouldFallBack(err: unknown): boolean {
  if (err instanceof NetworkError) return true;
  return err instanceof HttpError && (err.status === 429 || err.status >= 500);
}

async function withFallback<T>(coords: Coordinates, primary: Provider<T>, fallback: Provider<T>, signal?: AbortSignal): Promise<T> {
  try {
    return await primary(coords, signal);
  } catch (err) {
    if (isAbortError(err)) throw err;
    if (!shouldFallBack(err)) throw toAppError(err, 'weather');
  }

  try {
    return await fallback(coords, signal);
  } catch (err) {
    if (isAbortError(err)) throw err;
    throw toAppError(err, 'weather');
  }
}

/** OpenWeatherMap first, Open-Meteo as backup. Throws AbortError or a typed AppError. */
export function getWeather(lat: number, lon: number, options: FallbackOptions<WeatherData> = {}): Promise<WeatherData> {
  const { signal, primary = fetchOwmWeather, fallback = fetchOpenMeteoWeather } = options;
  return withFallback({ lat, lon }, primary, fallback, signal);
}

/** Current conditions only (one request per provider), with the same fallback rules as getWeather. */
export function getCurrent(lat: number, lon: number, options: FallbackOptions<CurrentSnapshot> = {}): Promise<CurrentSnapshot> {
  const { signal, primary = fetchOwmCurrent, fallback = fetchOpenMeteoCurrent } = options;
  return withFallback({ lat, lon }, primary, fallback, signal);
}
