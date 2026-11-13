import { minutesOf, type ReminderSettings } from './settings';

/**
 * A reminder more than this late is skipped for the day: a "morning" forecast at night is
 * noise. Background wake-ups are chosen by the browser, so some lateness is normal.
 */
export const LATE_WINDOW_MIN = 6 * 60;

/** Device-local calendar date, YYYY-MM-DD. */
export function localDateKey(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function minutesNow(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}

/** True when today's reminder should be shown now. */
export function isDue(settings: ReminderSettings, now: Date): boolean {
  const target = minutesOf(settings.time);
  if (!settings.enabled || !settings.city || target === null) return false;
  if (settings.lastShownDate === localDateKey(now)) return false;
  const late = minutesNow(now) - target;
  return late >= 0 && late <= LATE_WINDOW_MIN;
}

/**
 * When reminders are switched on (or the time changed) after today's time has passed,
 * start tomorrow instead of firing immediately.
 */
export function startingFrom(settings: ReminderSettings, now: Date): ReminderSettings {
  const target = minutesOf(settings.time);
  if (target === null) return settings;
  const today = localDateKey(now);
  if (minutesNow(now) >= target) return { ...settings, lastShownDate: today };
  return settings.lastShownDate === today ? { ...settings, lastShownDate: null } : settings;
}
