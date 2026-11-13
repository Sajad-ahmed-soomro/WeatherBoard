import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';
import type { WeatherData } from '../../lib/api/types';
import { createIdbStore } from '../../lib/storage/idb';
import { reminderContent, runDailyCheck } from './dailyCheck';
import { LATE_WINDOW_MIN, isDue, localDateKey, startingFrom } from './schedule';
import { DEFAULT_SETTINGS, createSettingsRepo, isValidTime, readSettings, type ReminderSettings } from './settings';

const KARACHI = { name: 'Karachi', lat: 24.86, lon: 67 };
const at = (hhmm: string, date = '2026-11-14') => new Date(`${date}T${hhmm}:00`);
const on = (over: Partial<ReminderSettings> = {}): ReminderSettings => ({ ...DEFAULT_SETTINGS, enabled: true, time: '07:00', city: KARACHI, ...over });

const freshRepo = () => createSettingsRepo(createIdbStore('test', 'settings', () => new IDBFactory()));

function weather(): WeatherData {
  return {
    coords: { lat: 0, lon: 0 },
    source: 'owm',
    fetchedAt: 0,
    utcOffsetSec: 0,
    current: { observedAt: 0, tempC: 24.4, feelsLikeC: 24, humidity: 50, windMs: 1, condition: { kind: 'clear', label: 'Clear sky', isDay: true } },
    daily: [{ date: '2026-11-14', minC: 19.6, maxC: 31, condition: { kind: 'partly-cloudy', label: 'Few clouds', isDay: true } }],
  };
}

describe('settings', () => {
  it('validates HH:MM times', () => {
    expect(isValidTime('07:30')).toBe(true);
    expect(isValidTime('23:59')).toBe(true);
    for (const bad of ['', '7:30', '24:00', '07:60', 'noon']) expect(isValidTime(bad)).toBe(false);
  });

  it('reads stored values defensively', () => {
    expect(readSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(readSettings({ enabled: 'yes', time: '99:99', city: { name: 'X' }, lastShownDate: 5 })).toEqual(DEFAULT_SETTINGS);
    expect(readSettings({ enabled: true, time: '06:15', city: KARACHI, lastShownDate: '2026-11-13' })).toEqual(
      on({ time: '06:15', lastShownDate: '2026-11-13' }),
    );
  });

  it('persists changes in IndexedDB and claims each day only once', async () => {
    const repo = freshRepo();
    await repo.change((s) => ({ ...s, enabled: true, city: KARACHI }));
    expect(await repo.load()).toMatchObject({ enabled: true, city: KARACHI });
    expect(await repo.claimDay('2026-11-14')).toBe(true);
    expect(await repo.claimDay('2026-11-14')).toBe(false);
    expect(await repo.claimDay('2026-11-15')).toBe(true);
  });

  it('a change made after a claim keeps the claim (no lost update)', async () => {
    const repo = freshRepo();
    await repo.claimDay('2026-11-14');
    await repo.change((s) => ({ ...s, time: '08:00' }));
    expect((await repo.load()).lastShownDate).toBe('2026-11-14');
  });
});

describe('schedule', () => {
  it('uses the device-local date', () => {
    expect(localDateKey(at('00:05', '2026-01-02'))).toBe('2026-01-02');
  });

  it('is due from the chosen time until the late window closes, once per day', () => {
    expect(isDue(on(), at('06:59'))).toBe(false);
    expect(isDue(on(), at('07:00'))).toBe(true);
    expect(isDue(on(), at('12:30'))).toBe(true);
    const lastMinute = 7 * 60 + LATE_WINDOW_MIN;
    expect(isDue(on(), at(`${String(Math.floor(lastMinute / 60)).padStart(2, '0')}:00`))).toBe(true);
    expect(isDue(on(), at('13:01'))).toBe(false);
    expect(isDue(on({ lastShownDate: '2026-11-14' }), at('07:30'))).toBe(false);
  });

  it('is never due when off or without a city', () => {
    expect(isDue(on({ enabled: false }), at('07:30'))).toBe(false);
    expect(isDue(on({ city: null }), at('07:30'))).toBe(false);
  });

  it('turning on after today\'s time starts tomorrow; before it, today', () => {
    expect(startingFrom(on(), at('10:00')).lastShownDate).toBe('2026-11-14');
    expect(startingFrom(on(), at('06:00')).lastShownDate).toBeNull();
    // Moving the time later than now re-opens today.
    expect(startingFrom(on({ time: '18:00', lastShownDate: '2026-11-14' }), at('10:00')).lastShownDate).toBeNull();
  });
});

describe('runDailyCheck', () => {
  it('writes readable reminder text, with or without data', () => {
    expect(reminderContent(KARACHI, weather())).toEqual({ title: 'Karachi today', body: '24° now, clear sky. Today 20° to 31°, few clouds.' });
    expect(reminderContent(KARACHI, null).body).toMatch(/Couldn't load today's forecast/);
  });

  it('does nothing when not due', async () => {
    const repo = freshRepo();
    const show = vi.fn(() => Promise.resolve());
    await repo.change(() => on());
    await expect(runDailyCheck({ repo, fetchWeather: () => Promise.resolve(weather()), show, now: () => at('06:00') })).resolves.toBe('not-due');
    expect(show).not.toHaveBeenCalled();
  });

  it('shows once even when the page and service worker check at the same moment', async () => {
    const repo = freshRepo();
    await repo.change(() => on());
    const show = vi.fn(() => Promise.resolve());
    const deps = { repo, fetchWeather: () => Promise.resolve(weather()), show, now: () => at('07:05') };
    const results = await Promise.all([runDailyCheck(deps), runDailyCheck(deps)]);
    expect(results.sort()).toEqual(['already-shown', 'shown']);
    expect(show).toHaveBeenCalledTimes(1);
  });

  it('still shows a (generic) reminder when the weather fetch fails', async () => {
    const repo = freshRepo();
    await repo.change(() => on());
    const show = vi.fn(() => Promise.resolve());
    await runDailyCheck({ repo, fetchWeather: () => Promise.reject(new Error('offline')), show, now: () => at('07:05') });
    expect(show).toHaveBeenCalledWith(expect.objectContaining({ title: 'Weather for Karachi' }));
  });
});
