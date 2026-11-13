// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { City } from '../../lib/api/types';
import { createSafeStorage, type KeyValueStore } from '../../lib/storage/safeStorage';
import { MAX_FAVOURITES, addFavourite, loadFavourites, removeFavourite, saveFavourites } from './favourites';
import { useFavourites } from './useFavourites';

const city = (n: number): City => ({ id: `c${n}`, type: 'CITY', name: `City ${n}`, region: null, country: 'X', countryCode: 'XX', lat: n, lon: n });

function backing(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

describe('favourites list', () => {
  it('adds, refuses duplicates, and refuses past the limit', () => {
    let list: readonly City[] = [];
    for (let i = 1; i <= MAX_FAVOURITES; i += 1) list = addFavourite(list, city(i)).list;
    expect(list).toHaveLength(5);
    expect(addFavourite(list, city(1)).result).toBe('exists');
    expect(addFavourite(list, city(6))).toEqual({ list, result: 'full' });
    expect(removeFavourite(list, 'c3').map((c) => c.id)).toEqual(['c1', 'c2', 'c4', 'c5']);
  });

  it('loads defensively: skips invalid and duplicate entries, caps at the limit', () => {
    const b = backing();
    const store = createSafeStorage(() => b);
    b.data.set('weatherboard:favourites:v1', JSON.stringify([city(1), { id: 'broken' }, city(1), ...[2, 3, 4, 5, 6, 7].map(city)]));
    expect(loadFavourites(store).map((c) => c.id)).toEqual(['c1', 'c2', 'c3', 'c4', 'c5']);
    b.data.set('weatherboard:favourites:v1', '{"not":"an array"}');
    expect(loadFavourites(store)).toEqual([]);
  });
});

describe('useFavourites', () => {
  it('persists additions and reports the limit', () => {
    const b = backing();
    const store = createSafeStorage(() => b);
    const { result } = renderHook(() => useFavourites({ store }));
    for (let i = 1; i <= 5; i += 1) act(() => result.current.add(city(i)));
    expect(result.current.atLimit).toBe(true);
    act(() => result.current.add(city(6)));
    expect(result.current.favourites).toHaveLength(5);
    expect(result.current.isFavourite('c6')).toBe(false);
    expect(loadFavourites(store)).toHaveLength(5);
  });

  it('removes only after confirmation; cancel keeps the city', () => {
    const store = createSafeStorage(backing);
    saveFavourites([city(1), city(2)], store);
    const { result } = renderHook(() => useFavourites({ store }));

    act(() => result.current.requestRemove(city(1)));
    expect(result.current.pendingRemoval?.id).toBe('c1');
    expect(result.current.favourites).toHaveLength(2);

    act(() => result.current.cancelRemove());
    expect(result.current.pendingRemoval).toBeNull();
    expect(result.current.favourites).toHaveLength(2);

    act(() => result.current.requestRemove(city(1)));
    act(() => result.current.confirmRemove());
    expect(result.current.favourites.map((c) => c.id)).toEqual(['c2']);
    expect(loadFavourites(store).map((c) => c.id)).toEqual(['c2']);
  });

  it('works in memory and says so when storage is blocked', () => {
    const store = createSafeStorage(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    const { result } = renderHook(() => useFavourites({ store }));
    expect(result.current.persistent).toBe(false);
    act(() => result.current.add(city(1)));
    expect(result.current.favourites).toHaveLength(1);
  });
});
