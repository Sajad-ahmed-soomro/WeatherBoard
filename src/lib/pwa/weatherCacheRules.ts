/**
 * Rules shared by the service worker and the page for the offline weather cache.
 * Pure (URL in, data out) so they run in both contexts and in tests.
 */

/** Set by the service worker on every weather response: epoch ms when it came from the network. */
export const FETCHED_AT_HEADER = 'x-weatherboard-fetched-at';

export const WEATHER_CACHE = 'weatherboard-last-city-v1';

/** A cached response younger than this is served without a background refresh. */
export const REVALIDATE_AFTER_MS = 60_000;

/** Posted by the service worker after a background refresh stored newer data. */
export interface WeatherUpdatedMessage {
  type: 'WEATHER_UPDATED';
  lat: number;
  lon: number;
}

export type WeatherRequestKind = 'owm-current' | 'owm-forecast' | 'om-current' | 'om-full';

export interface WeatherRequestInfo {
  kind: WeatherRequestKind;
  lat: number;
  lon: number;
}

function coord(value: string | null): number | null {
  if (value === null || value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Recognises the weather API calls this app makes; anything else returns null. */
export function classifyWeatherRequest(href: string): WeatherRequestInfo | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  const p = url.searchParams;

  if (url.hostname === 'api.openweathermap.org') {
    const lat = coord(p.get('lat'));
    const lon = coord(p.get('lon'));
    if (lat === null || lon === null) return null;
    if (url.pathname === '/data/2.5/weather') return { kind: 'owm-current', lat, lon };
    if (url.pathname === '/data/2.5/forecast') return { kind: 'owm-forecast', lat, lon };
    return null;
  }

  if (url.hostname === 'api.open-meteo.com' && url.pathname === '/v1/forecast') {
    const lat = coord(p.get('latitude'));
    const lon = coord(p.get('longitude'));
    if (lat === null || lon === null) return null;
    return { kind: p.has('daily') ? 'om-full' : 'om-current', lat, lon };
  }

  return null;
}

/** Forecast responses only come from a full weather load, so they mark the city as "last viewed". */
export function isFullLoad(kind: WeatherRequestKind): boolean {
  return kind === 'owm-forecast' || kind === 'om-full';
}

/** Coordinates are sent with 4 decimals; compare at that precision. */
export function sameCoords(a: { lat: number; lon: number }, b: { lat: number; lon: number }): boolean {
  return a.lat.toFixed(4) === b.lat.toFixed(4) && a.lon.toFixed(4) === b.lon.toFixed(4);
}

/** Cache key: the request URL without the API key, with params sorted. Keeps secrets out of Cache Storage. */
export function cacheKeyFor(href: string): string {
  const url = new URL(href);
  url.searchParams.delete('appid');
  url.searchParams.sort();
  return url.toString();
}

/** Reads the fetched-at stamp; null when absent or malformed (e.g. no service worker). */
export function readFetchedAt(headers: Headers): number | null {
  const raw = headers.get(FETCHED_AT_HEADER);
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function needsRevalidation(fetchedAt: number | null, now: number): boolean {
  return fetchedAt === null || now - fetchedAt >= REVALIDATE_AFTER_MS;
}

export function isWeatherUpdatedMessage(data: unknown): data is WeatherUpdatedMessage {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return d.type === 'WEATHER_UPDATED' && typeof d.lat === 'number' && typeof d.lon === 'number';
}
