import { aggregateDaily, type ForecastSlot } from './aggregate';
import { capitalise, kindFromOwmId } from './conditions';
import { requireKey } from './config';
import { fetchJson } from './http';
import { arr, num, obj, str } from './parse';
import type { Condition, Coordinates, CurrentConditions, WeatherData } from './types';

const BASE = 'https://api.openweathermap.org/data/2.5';

function parseCondition(weather: unknown, path: string): Condition {
  const w = obj(arr(weather, path)[0], `${path}[0]`);
  return {
    kind: kindFromOwmId(num(w.id, `${path}[0].id`)),
    label: capitalise(str(w.description, `${path}[0].description`)),
    isDay: !str(w.icon, `${path}[0].icon`).endsWith('n'),
  };
}

function parseCurrent(body: unknown): { current: CurrentConditions; utcOffsetSec: number } {
  const b = obj(body, 'weather');
  const main = obj(b.main, 'weather.main');
  return {
    utcOffsetSec: num(b.timezone, 'weather.timezone'),
    current: {
      observedAt: num(b.dt, 'weather.dt') * 1000,
      tempC: num(main.temp, 'weather.main.temp'),
      feelsLikeC: num(main.feels_like, 'weather.main.feels_like'),
      humidity: num(main.humidity, 'weather.main.humidity'),
      windMs: num(obj(b.wind, 'weather.wind').speed, 'weather.wind.speed'),
      condition: parseCondition(b.weather, 'weather.weather'),
    },
  };
}

function parseSlots(body: unknown): ForecastSlot[] {
  return arr(obj(body, 'forecast').list, 'forecast.list').map((raw, i) => {
    const path = `forecast.list[${i}]`;
    const entry = obj(raw, path);
    const main = obj(entry.main, `${path}.main`);
    return {
      dt: num(entry.dt, `${path}.dt`),
      tempMinC: num(main.temp_min, `${path}.main.temp_min`),
      tempMaxC: num(main.temp_max, `${path}.main.temp_max`),
      condition: parseCondition(entry.weather, `${path}.weather`),
    };
  });
}

/** Pure: raw /weather + /forecast bodies → WeatherData. Exported for fixture tests. */
export function normaliseOwm(coords: Coordinates, weatherBody: unknown, forecastBody: unknown, fetchedAt: number): WeatherData {
  const { current, utcOffsetSec } = parseCurrent(weatherBody);
  return {
    coords,
    source: 'owm',
    fetchedAt,
    utcOffsetSec,
    current,
    daily: aggregateDaily(parseSlots(forecastBody), current, utcOffsetSec),
  };
}

export async function fetchOwmWeather(coords: Coordinates, signal?: AbortSignal): Promise<WeatherData> {
  const params = new URLSearchParams({
    lat: coords.lat.toFixed(4),
    lon: coords.lon.toFixed(4),
    units: 'metric',
    appid: requireKey('VITE_OWM_KEY'),
  });
  const [weatherBody, forecastBody] = await Promise.all([
    fetchJson(`${BASE}/weather?${params}`, { signal }),
    fetchJson(`${BASE}/forecast?${params}`, { signal }),
  ]);
  return normaliseOwm(coords, weatherBody, forecastBody, Date.now());
}
