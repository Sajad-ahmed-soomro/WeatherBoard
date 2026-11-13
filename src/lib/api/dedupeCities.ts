import type { City } from './types';

/** A parsed GeoDB hit before de-duplication; population is only needed for ranking. */
export interface CityCandidate extends City {
  population: number;
}

/** Radius within which two hits in the same country are treated as the same place. */
const NEAR_KM = 25;
/**
 * Admin areas with the same display name can sit further apart: GeoDB's
 * "Lahore Division" and "Lahore District" centroids are ~32 km apart.
 */
const SAME_NAME_KM = 100;

const ADMIN_SUFFIX = /\s+(?:Division|District)$/i;

/** "Lahore Division" → "Lahore" for admin areas; city names are left untouched. */
export function displayName(name: string, type: string): string {
  return type === 'CITY' ? name : name.replace(ADMIN_SUFFIX, '');
}

function distanceKm(a: City, b: City): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function samePlace(a: City, b: City): boolean {
  if (a.countryCode !== b.countryCode) return false;
  const km = distanceKm(a, b);
  return km <= NEAR_KM || (a.name === b.name && km <= SAME_NAME_KM);
}

/** True when `name` appears as whole words inside `other` ("London" in "Greater London"). */
function containsWords(other: string, name: string): boolean {
  return ` ${other} `.includes(` ${name} `);
}

/** Ranking within one place: CITY over admin areas, then the canonical (shorter) name, then population. */
function isBetter(a: CityCandidate, b: CityCandidate): boolean {
  const aCity = a.type === 'CITY';
  if (aCity !== (b.type === 'CITY')) return aCity;
  if (a.name !== b.name) {
    if (containsWords(b.name, a.name)) return true;
    if (containsWords(a.name, b.name)) return false;
  }
  return a.population > b.population;
}

/** Collapses hits that refer to the same place, keeping the first hit's position in the list. */
export function dedupeCities(candidates: readonly CityCandidate[]): CityCandidate[] {
  const kept: CityCandidate[] = [];
  for (const candidate of candidates) {
    const index = kept.findIndex((existing) => samePlace(existing, candidate));
    const existing = kept[index];
    if (!existing) kept.push(candidate);
    else if (isBetter(candidate, existing)) kept[index] = candidate;
  }
  return kept;
}
