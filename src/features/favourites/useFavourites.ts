import { useCallback, useState } from 'react';
import type { City } from '../../lib/api/types';
import { storage as defaultStorage, type SafeStorage } from '../../lib/storage/safeStorage';
import { MAX_FAVOURITES, addFavourite, loadFavourites, removeFavourite, saveFavourites } from './favourites';

/**
 * Up to five saved cities. Removal is two-step (request, then confirm or cancel) so the
 * UI can ask first. Falls back to memory when storage is blocked; `persistent` says which.
 */
export function useFavourites({ store = defaultStorage }: { store?: SafeStorage } = {}) {
  const [favourites, setFavourites] = useState(() => loadFavourites(store));
  const [pendingRemoval, setPendingRemoval] = useState<City | null>(null);

  const commit = useCallback(
    (next: readonly City[]) => {
      setFavourites(next);
      saveFavourites(next, store);
    },
    [store],
  );

  const add = useCallback(
    (city: City) => {
      const { list, result } = addFavourite(favourites, city);
      if (result === 'added') commit(list);
    },
    [commit, favourites],
  );

  const confirmRemove = useCallback(() => {
    if (pendingRemoval) commit(removeFavourite(favourites, pendingRemoval.id));
    setPendingRemoval(null);
  }, [commit, favourites, pendingRemoval]);

  const cancelRemove = useCallback(() => setPendingRemoval(null), []);

  const isFavourite = useCallback((id: string) => favourites.some((c) => c.id === id), [favourites]);

  return {
    favourites,
    isFavourite,
    atLimit: favourites.length >= MAX_FAVOURITES,
    /** False when favourites live in memory only and will be lost on close. */
    persistent: store.persistent,
    add,
    requestRemove: setPendingRemoval,
    pendingRemoval,
    confirmRemove,
    cancelRemove,
  };
}
