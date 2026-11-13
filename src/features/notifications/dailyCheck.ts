import type { WeatherData } from '../../lib/api/types';
import { formatTemp, type TempUnit } from '../../lib/units/format';
import { isDue, localDateKey } from './schedule';
import type { ReminderCity, SettingsRepo } from './settings';

export const REMINDER_TAG = 'weatherboard-daily';

export interface ReminderContent {
  title: string;
  body: string;
}

/** Text for the reminder. Without data (offline, API down) it still points to the app honestly. */
export function reminderContent(city: ReminderCity, data: WeatherData | null, unit: TempUnit = 'c'): ReminderContent {
  if (!data) return { title: `Weather for ${city.name}`, body: "Couldn't load today's forecast. Tap to open WeatherBoard and try again." };
  const today = data.daily[0];
  const now = `${formatTemp(data.current.tempC, unit)} now, ${data.current.condition.label.toLowerCase()}.`;
  const range = today ? ` Today ${formatTemp(today.minC, unit)} to ${formatTemp(today.maxC, unit)}, ${today.condition.label.toLowerCase()}.` : '';
  return { title: `${city.name} today`, body: `${now}${range}` };
}

export interface DailyCheckDeps {
  repo: SettingsRepo;
  fetchWeather: (lat: number, lon: number) => Promise<WeatherData>;
  show: (content: ReminderContent) => Promise<void>;
  now?: () => Date;
}

export type DailyCheckResult = 'not-due' | 'already-shown' | 'shown';

/**
 * Shows today's reminder if it is due. Claims the day in IndexedDB before fetching, so the
 * service worker and an open page never both show it. A failed fetch still shows a reminder.
 */
export async function runDailyCheck({ repo, fetchWeather, show, now = () => new Date() }: DailyCheckDeps): Promise<DailyCheckResult> {
  const at = now();
  const settings = await repo.load();
  if (!isDue(settings, at) || !settings.city) return 'not-due';
  if (!(await repo.claimDay(localDateKey(at)))) return 'already-shown';

  const data = await fetchWeather(settings.city.lat, settings.city.lon).catch(() => null);
  await show(reminderContent(settings.city, data, settings.unit));
  return 'shown';
}
