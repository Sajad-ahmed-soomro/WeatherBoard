import type { City } from '../api/types';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Validates a City read back from storage, which may be stale or hand-edited. */
export function isCity(value: unknown): value is City {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.type === 'string' &&
    typeof value.name === 'string' &&
    (value.region === null || typeof value.region === 'string') &&
    typeof value.country === 'string' &&
    typeof value.countryCode === 'string' &&
    isFiniteNumber(value.lat) &&
    isFiniteNumber(value.lon)
  );
}
