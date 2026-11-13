import { HttpError, NetworkError, isAbortError, toAppError } from './errors';
import { fetchOpenMeteoWeather } from './openMeteo';
import { fetchOwmWeather } from './owm';
import type { Coordinates, WeatherData } from './types';

export type WeatherProvider = (coords: Coordinates, signal?: AbortSignal) => Promise<WeatherData>;

interface GetWeatherOptions {
  signal?: AbortSignal;
  primary?: WeatherProvider;
  fallback?: WeatherProvider;
}

/**
 * Fall back only when the primary is unavailable: rate limited, server error, or unreachable.
 * 401/404 mean the request itself is wrong, so a second provider would only hide the problem.
 */
export function shouldFallBack(err: unknown): boolean {
  if (err instanceof NetworkError) return true;
  return err instanceof HttpError && (err.status === 429 || err.status >= 500);
}

/** OpenWeatherMap first, Open-Meteo as backup. Throws AbortError or a typed AppError. */
export async function getWeather(lat: number, lon: number, options: GetWeatherOptions = {}): Promise<WeatherData> {
  const { signal, primary = fetchOwmWeather, fallback = fetchOpenMeteoWeather } = options;
  const coords = { lat, lon };

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
