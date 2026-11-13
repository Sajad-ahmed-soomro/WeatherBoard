/** Rounds without ever showing "-0". */
function roundClean(value: number): number {
  const rounded = Math.round(value);
  return rounded === 0 ? 0 : rounded;
}

export type TempUnit = 'c' | 'f';

export function toUnit(celsius: number, unit: TempUnit): number {
  return unit === 'f' ? (celsius * 9) / 5 + 32 : celsius;
}

/** "22°". The unit is shown once in the UI (the °C/°F switch), as weather apps usually do. */
export function formatTemp(celsius: number, unit: TempUnit = 'c'): string {
  return `${roundClean(toUnit(celsius, unit))}°`;
}

export function formatWind(metresPerSecond: number): string {
  return `${roundClean(metresPerSecond * 3.6)} km/h`;
}

export function formatHumidity(percent: number): string {
  return `${roundClean(percent)}%`;
}

const weekdayShort = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' });
const weekdayLong = new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'UTC' });

/** Labels a city-local YYYY-MM-DD date. Read in UTC so the viewer's timezone can't shift the day. */
export function formatDay(date: string, today: string): { short: string; long: string } {
  if (date === today) return { short: 'Today', long: 'Today' };
  const epoch = Date.parse(`${date}T00:00:00Z`);
  return { short: weekdayShort.format(epoch), long: weekdayLong.format(epoch) };
}
