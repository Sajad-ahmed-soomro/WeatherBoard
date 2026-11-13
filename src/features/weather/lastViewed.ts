import type { City } from '../../lib/api/types';
import { isCity, isFiniteNumber, isRecord } from '../../lib/storage/guards';
import { storage as defaultStorage, type SafeStorage } from '../../lib/storage/safeStorage';

/** Also the offline cache key for the PWA step: which city, and how fresh. */
export interface LastViewed {
  lastCity: City;
  fetchedAt: number;
}

const KEY = 'weatherboard:lastViewed:v1';

function isLastViewed(value: unknown): value is LastViewed {
  return isRecord(value) && isCity(value.lastCity) && isFiniteNumber(value.fetchedAt);
}

export function loadLastViewed(store: SafeStorage = defaultStorage): LastViewed | null {
  return store.read(KEY, isLastViewed);
}

export function saveLastViewed(value: LastViewed, store: SafeStorage = defaultStorage): void {
  store.write(KEY, value);
}
