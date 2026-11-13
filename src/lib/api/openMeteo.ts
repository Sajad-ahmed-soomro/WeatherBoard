import { FORECAST_DAYS, mergeCurrentIntoToday } from './aggregate';
import { fromWmoCode } from './conditions';
import { fetchJson } from './http';
import { arr, num, obj } from './parse';
import { ParseError } from './errors';
import type { Coordinates, CurrentConditions, CurrentSnapshot, DailyForecast, WeatherData } from './types';
import { cityLocalDate } from '../time/cityTime';

const BASE = 'https://api.open-meteo.com/v1/forecast';

/** Pure: raw Open-Meteo body → WeatherData (same shape as the OWM path). */
const CURRENT_FIELDS = 'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day';

function parseCurrent(body: Record<string, unknown>): CurrentConditions {
  const c = obj(body.current, 'current');
  const isDay = num(c.is_day, 'current.is_day') === 1;
  return {
    observedAt: num(c.time, 'current.time') * 1000,
    tempC: num(c.temperature_2m, 'current.temperature_2m'),
    feelsLikeC: num(c.apparent_temperature, 'current.apparent_temperature'),
    humidity: num(c.relative_humidity_2m, 'current.relative_humidity_2m'),
    windMs: num(c.wind_speed_10m, 'current.wind_speed_10m'),
    condition: { ...fromWmoCode(num(c.weather_code, 'current.weather_code')), isDay },
  };
}

function baseParams(coords: Coordinates): Record<string, string> {
  return {
    latitude: coords.lat.toFixed(4),
    longitude: coords.lon.toFixed(4),
    current: CURRENT_FIELDS,
    timezone: 'auto',
    timeformat: 'unixtime',
    wind_speed_unit: 'ms',
  };
}

export function normaliseOpenMeteo(coords: Coordinates, body: unknown, fetchedAt: number): WeatherData {
  const b = obj(body, 'body');
  const utcOffsetSec = num(b.utc_offset_seconds, 'utc_offset_seconds');
  const current = parseCurrent(b);

  const d = obj(b.daily, 'daily');
  const times = arr(d.time, 'daily.time');
  const codes = arr(d.weather_code, 'daily.weather_code');
  const maxes = arr(d.temperature_2m_max, 'daily.temperature_2m_max');
  const mins = arr(d.temperature_2m_min, 'daily.temperature_2m_min');
  if (codes.length !== times.length || maxes.length !== times.length || mins.length !== times.length) {
    throw new ParseError('daily (array lengths differ)');
  }

  const daily: DailyForecast[] = times.map((t, i) => ({
    date: cityLocalDate(num(t, `daily.time[${i}]`), utcOffsetSec),
    minC: num(mins[i], `daily.temperature_2m_min[${i}]`),
    maxC: num(maxes[i], `daily.temperature_2m_max[${i}]`),
    condition: { ...fromWmoCode(num(codes[i], `daily.weather_code[${i}]`)), isDay: true },
  }));

  return {
    coords,
    source: 'open-meteo',
    fetchedAt,
    utcOffsetSec,
    current,
    daily: mergeCurrentIntoToday(daily, current, utcOffsetSec),
  };
}

export async function fetchOpenMeteoWeather(coords: Coordinates, signal?: AbortSignal): Promise<WeatherData> {
  const params = new URLSearchParams({
    ...baseParams(coords),
    daily: 'weather_code,temperature_2m_max,temperature_2m_min',
    forecast_days: String(FORECAST_DAYS),
  });
  return normaliseOpenMeteo(coords, await fetchJson(`${BASE}?${params}`, { signal }), Date.now());
}

/** Pure: raw current-only body → CurrentSnapshot. Exported for fixture tests. */
export function normaliseOpenMeteoCurrent(body: unknown, fetchedAt: number): CurrentSnapshot {
  return { source: 'open-meteo', fetchedAt, current: parseCurrent(obj(body, 'body')) };
}

export async function fetchOpenMeteoCurrent(coords: Coordinates, signal?: AbortSignal): Promise<CurrentSnapshot> {
  const params = new URLSearchParams({ ...baseParams(coords), forecast_days: '1' });
  return normaliseOpenMeteoCurrent(await fetchJson(`${BASE}?${params}`, { signal }), Date.now());
}
