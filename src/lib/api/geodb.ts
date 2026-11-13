import { requireKey } from './config';
import { fetchJson } from './http';
import { arr, num, obj, optionalStr, str } from './parse';
import type { City } from './types';

const HOST = 'wft-geo-db.p.rapidapi.com';
const MIN_POPULATION = 10_000;
const RESULT_LIMIT = 6;

export function parseCities(body: unknown): City[] {
  return arr(obj(body, 'body').data, 'data').map((raw, i) => {
    const c = obj(raw, `data[${i}]`);
    return {
      id: String(num(c.id, `data[${i}].id`)),
      name: str(c.name, `data[${i}].name`),
      region: optionalStr(c.region),
      country: str(c.country, `data[${i}].country`),
      countryCode: str(c.countryCode, `data[${i}].countryCode`),
      lat: num(c.latitude, `data[${i}].latitude`),
      lon: num(c.longitude, `data[${i}].longitude`),
    };
  });
}

/** One raw GeoDB request. Rate limiting and caching live in citySearch.ts. */
export async function fetchCities(namePrefix: string, signal?: AbortSignal): Promise<City[]> {
  const params = new URLSearchParams({
    namePrefix,
    minPopulation: String(MIN_POPULATION),
    limit: String(RESULT_LIMIT),
    sort: '-population',
    types: 'CITY',
  });
  const body = await fetchJson(`https://${HOST}/v1/geo/cities?${params}`, {
    signal,
    headers: { 'X-RapidAPI-Key': requireKey('VITE_RAPIDAPI_KEY'), 'X-RapidAPI-Host': HOST },
  });
  return parseCities(body);
}
