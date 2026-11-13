import { requireKey } from './config';
import { dedupeCities, displayName, type CityCandidate } from './dedupeCities';
import { fetchJson } from './http';
import { arr, num, obj, optionalStr, str } from './parse';
import type { City } from './types';

const HOST = 'wft-geo-db.p.rapidapi.com';
const MIN_POPULATION = 10_000;
/** Ask for the free tier's maximum so de-duplication still leaves a full list. */
const FETCH_LIMIT = 10;
const RESULT_LIMIT = 6;

function parseCandidate(raw: unknown, i: number): CityCandidate {
  const c = obj(raw, `data[${i}]`);
  const type = str(c.type, `data[${i}].type`);
  return {
    id: String(num(c.id, `data[${i}].id`)),
    type,
    name: displayName(str(c.name, `data[${i}].name`), type),
    region: optionalStr(c.region),
    country: str(c.country, `data[${i}].country`),
    countryCode: str(c.countryCode, `data[${i}].countryCode`),
    lat: num(c.latitude, `data[${i}].latitude`),
    lon: num(c.longitude, `data[${i}].longitude`),
    population: typeof c.population === 'number' ? c.population : 0,
  };
}

/**
 * GeoDB → suggestions. No `types=CITY` filter: GeoDB lists some major cities
 * (e.g. Lahore) only as admin areas, so we keep every type and de-duplicate.
 */
export function parseCities(body: unknown): City[] {
  const candidates = arr(obj(body, 'body').data, 'data').map(parseCandidate);
  return dedupeCities(candidates)
    .slice(0, RESULT_LIMIT)
    .map(({ id, type, name, region, country, countryCode, lat, lon }) => ({ id, type, name, region, country, countryCode, lat, lon }));
}

/** One raw GeoDB request. Rate limiting and caching live in citySearch.ts. */
export async function fetchCities(namePrefix: string, signal?: AbortSignal): Promise<City[]> {
  const params = new URLSearchParams({
    namePrefix,
    minPopulation: String(MIN_POPULATION),
    limit: String(FETCH_LIMIT),
    sort: '-population',
  });
  const body = await fetchJson(`https://${HOST}/v1/geo/cities?${params}`, {
    signal,
    headers: { 'X-RapidAPI-Key': requireKey('VITE_RAPIDAPI_KEY'), 'X-RapidAPI-Host': HOST },
  });
  return parseCities(body);
}
