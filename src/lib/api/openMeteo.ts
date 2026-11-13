import { FORECAST_DAYS, mergeCurrentIntoToday } from './aggregate';
import { fromWmoCode } from './conditions';
import { fetchJson } from './http';
import { arr, num, obj } from './parse';
import { ParseError } from './errors';
import type { Coordinates, DailyForecast, WeatherData } from './types';
import { cityLocalDate } from '../time/cityTime';

const BASE = 'https://api.open-meteo.com/v1/forecast';

/** Pure: raw Open-Meteo body → WeatherData (same shape as the OWM path). */
export function normaliseOpenMeteo(coords: Coordinates, body: unknown, fetchedAt: number): WeatherData {
  const b = obj(body, 'body');
  const utcOffsetSec = num(b.utc_offset_seconds, 'utc_offset_seconds');
  const c = obj(b.current, 'current');
  const isDay = num(c.is_day, 'current.is_day') === 1;
  const currentWmo = fromWmoCode(num(c.weather_code, 'current.weather_code'));
  const current = {
    observedAt: num(c.time, 'current.time') * 1000,
    tempC: num(c.temperature_2m, 'current.temperature_2m'),
    feelsLikeC: num(c.apparent_temperature, 'current.apparent_temperature'),
    humidity: num(c.relative_humidity_2m, 'current.relative_humidity_2m'),
    windMs: num(c.wind_speed_10m, 'current.wind_speed_10m'),
    condition: { ...currentWmo, isDay },
  };

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
    latitude: coords.lat.toFixed(4),
    longitude: coords.lon.toFixed(4),
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min',
    timezone: 'auto',
    timeformat: 'unixtime',
    wind_speed_unit: 'ms',
    forecast_days: String(FORECAST_DAYS),
  });
  return normaliseOpenMeteo(coords, await fetchJson(`${BASE}?${params}`, { signal }), Date.now());
}
