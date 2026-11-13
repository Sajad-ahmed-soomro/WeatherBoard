import { describe, expect, it } from 'vitest';
import { GEODB_LAH, GEODB_LON, GEODB_LONDR } from './__fixtures__/geodb';
import { dedupeCities, displayName, type CityCandidate } from './dedupeCities';
import { parseCities } from './geodb';

const names = (body: unknown) => parseCities(body).map((c) => c.name);

describe('GeoDB suggestions (real responses)', () => {
  it('"lah": Lahore appears once, first, named "Lahore", keeping its admin type', () => {
    const cities = parseCities(GEODB_LAH);
    const lahores = cities.filter((c) => c.name.startsWith('Lahore'));
    expect(lahores).toHaveLength(1);
    expect(cities[0]).toMatchObject({ name: 'Lahore', type: 'ADM2', region: 'Punjab', country: 'Pakistan' });
  });

  it('"lah": a CITY beats its admin area at the same place (Lahijan vs Lahijan County)', () => {
    const lahijan = parseCities(GEODB_LAH).filter((c) => c.name.startsWith('Lahijan'));
    expect(lahijan).toEqual([expect.objectContaining({ name: 'Lahijan', type: 'CITY' })]);
  });

  it('"lon": London is listed and "Greater London" does not beat it', () => {
    const list = names(GEODB_LON);
    expect(list[0]).toBe('London');
    expect(list).not.toContain('Greater London');
  });

  it('"londr": Londrina appears once, and the CITY wins over the same-named admin area', () => {
    const cities = parseCities(GEODB_LONDR);
    expect(cities.map((c) => c.name)).toEqual(['Londrina', 'Nova Londrina']);
    expect(cities[1]?.type).toBe('CITY');
  });

  it('returns at most 6 suggestions and strips internal ranking fields', () => {
    const cities = parseCities(GEODB_LON);
    expect(cities.length).toBeLessThanOrEqual(6);
    expect(cities[0]).not.toHaveProperty('population');
  });
});

describe('displayName', () => {
  it('strips "Division"/"District" only from non-CITY types', () => {
    expect(displayName('Lahore Division', 'ADM2')).toBe('Lahore');
    expect(displayName('Longgang District', 'ADM2')).toBe('Longgang');
    expect(displayName('Lahijan County', 'ADM2')).toBe('Lahijan County');
    expect(displayName('Model Town District', 'CITY')).toBe('Model Town District');
  });
});

describe('dedupeCities', () => {
  const base: CityCandidate = {
    id: '1',
    type: 'CITY',
    name: 'A',
    region: null,
    country: 'X',
    countryCode: 'XX',
    lat: 0,
    lon: 0,
    population: 100,
  };

  it('keeps places in different countries apart even when close', () => {
    const a = { ...base, id: 'a' };
    const b = { ...base, id: 'b', countryCode: 'YY', lat: 0.01 };
    expect(dedupeCities([a, b])).toHaveLength(2);
  });

  it('prefers the higher population when type and name rank equally', () => {
    const small = { ...base, id: 'small', name: 'Twin', population: 10 };
    const big = { ...base, id: 'big', name: 'Twin', lat: 0.05, population: 50 };
    expect(dedupeCities([small, big]).map((c) => c.id)).toEqual(['big']);
  });

  it('does not merge different names beyond 25 km', () => {
    const a = { ...base, id: 'a', name: 'North' };
    const b = { ...base, id: 'b', name: 'South', lat: 0.3 };
    expect(dedupeCities([a, b])).toHaveLength(2);
  });
});
