import { useCallback, useState } from 'react';
import { storage as defaultStorage, type SafeStorage } from '../../lib/storage/safeStorage';
import type { TempUnit } from '../../lib/units/format';
import { UNITS_KEY, loadUnit } from './units';

export function useUnits({ store = defaultStorage }: { store?: SafeStorage } = {}) {
  const [unit, setUnitState] = useState<TempUnit>(() => loadUnit(store));
  const setUnit = useCallback(
    (next: TempUnit) => {
      setUnitState(next);
      store.write(UNITS_KEY, next);
    },
    [store],
  );
  return { unit, setUnit };
}
