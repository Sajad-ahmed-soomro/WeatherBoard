import { createContext, useContext } from 'react';
import type { SafeStorage } from '../../lib/storage/safeStorage';
import { formatTemp, type TempUnit } from '../../lib/units/format';

export const UNITS_KEY = 'weatherboard:units:v1';

export const isTempUnit = (v: unknown): v is TempUnit => v === 'c' || v === 'f';

export function loadUnit(store: SafeStorage): TempUnit {
  return store.read(UNITS_KEY, isTempUnit) ?? 'c';
}

/** Data stays in °C everywhere; only display converts, so switching never refetches. */
export const UnitContext = createContext<TempUnit>('c');

export function useTempFormat(): (celsius: number) => string {
  const unit = useContext(UnitContext);
  return (celsius) => formatTemp(celsius, unit);
}
