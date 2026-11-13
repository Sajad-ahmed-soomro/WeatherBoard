import { createIdbStore, type IdbStore } from '../../lib/storage/idb';
import type { TempUnit } from '../../lib/units/format';

/** The place the reminder reports on: the last city viewed while reminders were on. */
export interface ReminderCity {
  name: string;
  lat: number;
  lon: number;
}

export interface ReminderSettings {
  enabled: boolean;
  /** Device-local "HH:MM". */
  time: string;
  city: ReminderCity | null;
  /** Device-local YYYY-MM-DD of the last day a reminder was shown (or skipped). */
  lastShownDate: string | null;
  /** Mirrors the page's °C/°F choice; the service worker can't read localStorage. */
  unit: TempUnit;
}

export const DEFAULT_SETTINGS: ReminderSettings = { enabled: false, time: '07:00', city: null, lastShownDate: null, unit: 'c' };

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTime(value: string): boolean {
  return TIME_PATTERN.test(value);
}

/** Minutes after local midnight for a valid "HH:MM"; null otherwise. */
export function minutesOf(value: string): number | null {
  const match = TIME_PATTERN.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isReminderCity(value: unknown): value is ReminderCity {
  return isRecord(value) && typeof value.name === 'string' && Number.isFinite(value.lat) && Number.isFinite(value.lon);
}

/** Validates whatever IndexedDB returned; anything malformed falls back to defaults field by field. */
export function readSettings(value: unknown): ReminderSettings {
  if (!isRecord(value)) return DEFAULT_SETTINGS;
  return {
    enabled: value.enabled === true,
    time: typeof value.time === 'string' && isValidTime(value.time) ? value.time : DEFAULT_SETTINGS.time,
    city: isReminderCity(value.city) ? { name: value.city.name, lat: value.city.lat, lon: value.city.lon } : null,
    lastShownDate: typeof value.lastShownDate === 'string' ? value.lastShownDate : null,
    unit: value.unit === 'f' ? 'f' : 'c',
  };
}

const KEY = 'reminder';

export interface SettingsRepo {
  load(): Promise<ReminderSettings>;
  /** Atomic read-modify-write, so a concurrent claim by the service worker is never overwritten. */
  change(fn: (current: ReminderSettings) => ReminderSettings): Promise<ReminderSettings>;
  /** Atomically marks `date` as shown; resolves false if it already was (someone else showed it). */
  claimDay(date: string): Promise<boolean>;
}

export function createSettingsRepo(store: IdbStore): SettingsRepo {
  return {
    async load() {
      return readSettings(await store.get(KEY));
    },
    change(fn) {
      return store.update(KEY, (current) => {
        const next = fn(readSettings(current));
        return { value: next, result: next };
      });
    },
    claimDay(date) {
      return store.update(KEY, (current) => {
        const settings = readSettings(current);
        if (settings.lastShownDate === date) return { value: settings, result: false };
        return { value: { ...settings, lastShownDate: date }, result: true };
      });
    },
  };
}

/** Shared by the page and the service worker. */
export const settingsRepo = createSettingsRepo(createIdbStore('weatherboard', 'settings'));
