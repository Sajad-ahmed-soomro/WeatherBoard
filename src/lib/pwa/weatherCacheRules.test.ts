import { describe, expect, it } from 'vitest';
import { oldestFetchedAt } from '../api/freshness';
import {
  FETCHED_AT_HEADER,
  REVALIDATE_AFTER_MS,
  cacheKeyFor,
  classifyWeatherRequest,
  isFullLoad,
  isWeatherUpdatedMessage,
  needsRevalidation,
  readFetchedAt,
  sameCoords,
} from './weatherCacheRules';

const OWM = 'https://api.openweathermap.org/data/2.5';
const OM = 'https://api.open-meteo.com/v1/forecast';

describe('classifyWeatherRequest', () => {
  it('recognises the four weather calls the app makes', () => {
    expect(classifyWeatherRequest(`${OWM}/weather?lat=24.8607&lon=67.0011&appid=k`)).toEqual({ kind: 'owm-current', lat: 24.8607, lon: 67.0011 });
    expect(classifyWeatherRequest(`${OWM}/forecast?lat=1&lon=2&appid=k`)?.kind).toBe('owm-forecast');
    expect(classifyWeatherRequest(`${OM}?latitude=1&longitude=2&current=x&daily=y`)?.kind).toBe('om-full');
    expect(classifyWeatherRequest(`${OM}?latitude=1&longitude=2&current=x`)?.kind).toBe('om-current');
  });

  it('ignores anything else, including city search and malformed coordinates', () => {
    expect(classifyWeatherRequest('https://wft-geo-db.p.rapidapi.com/v1/geo/cities?namePrefix=lah')).toBeNull();
    expect(classifyWeatherRequest(`${OWM}/onecall?lat=1&lon=2`)).toBeNull();
    expect(classifyWeatherRequest(`${OWM}/weather?lat=&lon=2`)).toBeNull();
    expect(classifyWeatherRequest('not a url')).toBeNull();
  });

  it('treats only forecast calls as a full (last-viewed) load', () => {
    expect(isFullLoad('owm-forecast')).toBe(true);
    expect(isFullLoad('om-full')).toBe(true);
    expect(isFullLoad('owm-current')).toBe(false);
    expect(isFullLoad('om-current')).toBe(false);
  });
});

describe('cacheKeyFor', () => {
  it('drops the API key and ignores parameter order', () => {
    const a = cacheKeyFor(`${OWM}/weather?lat=1&lon=2&units=metric&appid=SECRET`);
    const b = cacheKeyFor(`${OWM}/weather?appid=OTHER&units=metric&lon=2&lat=1`);
    expect(a).toBe(b);
    expect(a).not.toMatch(/appid|SECRET/);
  });
});

describe('freshness', () => {
  it('compares coordinates at the 4 decimals the app sends', () => {
    expect(sameCoords({ lat: 24.86071, lon: 67.0011 }, { lat: 24.8607, lon: 67.00112 })).toBe(true);
    expect(sameCoords({ lat: 24.8607, lon: 67.0011 }, { lat: 24.8608, lon: 67.0011 })).toBe(false);
  });

  it('reads the fetched-at stamp, rejecting junk', () => {
    expect(readFetchedAt(new Headers({ [FETCHED_AT_HEADER]: '1700000000000' }))).toBe(1_700_000_000_000);
    expect(readFetchedAt(new Headers({ [FETCHED_AT_HEADER]: 'yesterday' }))).toBeNull();
    expect(readFetchedAt(new Headers())).toBeNull();
  });

  it('revalidates unstamped or minute-old entries only', () => {
    expect(needsRevalidation(null, 0)).toBe(true);
    expect(needsRevalidation(1000, 1000 + REVALIDATE_AFTER_MS - 1)).toBe(false);
    expect(needsRevalidation(1000, 1000 + REVALIDATE_AFTER_MS)).toBe(true);
  });

  it('uses the oldest stamp of a response set, or now when nothing was stamped', () => {
    expect(oldestFetchedAt([5000, 3000], 9000)).toBe(3000);
    expect(oldestFetchedAt([null, 4000], 9000)).toBe(4000);
    expect(oldestFetchedAt([null, null], 9000)).toBe(9000);
  });

  it('validates service worker messages', () => {
    expect(isWeatherUpdatedMessage({ type: 'WEATHER_UPDATED', lat: 1, lon: 2 })).toBe(true);
    expect(isWeatherUpdatedMessage({ type: 'WEATHER_UPDATED', lat: '1', lon: 2 })).toBe(false);
    expect(isWeatherUpdatedMessage('WEATHER_UPDATED')).toBe(false);
  });
});
