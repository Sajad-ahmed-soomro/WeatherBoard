import type { City } from '../../lib/api/types';
import { isCity } from '../../lib/storage/guards';
import { storage as defaultStorage, type SafeStorage } from '../../lib/storage/safeStorage';

export const MAX_FAVOURITES = 5;

const KEY = 'weatherboard:favourites:v1';

export type AddResult = 'added' | 'exists' | 'full';

/** Pure: returns the new list and why it did or didn't change. */
export function addFavourite(list: readonly City[], city: City): { list: readonly City[]; result: AddResult } {
  if (list.some((c) => c.id === city.id)) return { list, result: 'exists' };
  if (list.length >= MAX_FAVOURITES) return { list, result: 'full' };
  return { list: [...list, city], result: 'added' };
}

export function removeFavourite(list: readonly City[], id: string): readonly City[] {
  return list.filter((c) => c.id !== id);
}

const isUnknownArray = (value: unknown): value is unknown[] => Array.isArray(value);

/** Reads saved favourites, dropping invalid or duplicate entries and anything past the limit. */
export function loadFavourites(store: SafeStorage = defaultStorage): readonly City[] {
  const raw = store.read(KEY, isUnknownArray) ?? [];
  let list: readonly City[] = [];
  for (const item of raw) {
    if (isCity(item)) list = addFavourite(list, item).list;
  }
  return list;
}

export function saveFavourites(list: readonly City[], store: SafeStorage = defaultStorage): void {
  store.write(KEY, list);
}
