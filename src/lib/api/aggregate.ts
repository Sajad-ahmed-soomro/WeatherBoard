import { cityLocalDate, cityLocalHour } from '../time/cityTime';
import { severity } from './conditions';
import type { Condition, ConditionKind, CurrentConditions, DailyForecast } from './types';

/** One 3-hour OpenWeatherMap forecast entry, already normalised. */
export interface ForecastSlot {
  /** UTC epoch seconds. */
  dt: number;
  tempMinC: number;
  tempMaxC: number;
  condition: Condition;
}

/** A day's dominant condition is taken from slots in [06:00, 21:00) city-local time. */
export const DAYTIME_START_HOUR = 6;
export const DAYTIME_END_HOUR = 21;
export const FORECAST_DAYS = 5;

function isDaytime(slot: ForecastSlot, utcOffsetSec: number): boolean {
  const hour = cityLocalHour(slot.dt, utcOffsetSec);
  return hour >= DAYTIME_START_HOUR && hour < DAYTIME_END_HOUR;
}

/** Most frequent kind; ties go to the more severe kind. Label = most frequent label of that kind. */
export function dominantCondition(slots: readonly ForecastSlot[]): Condition {
  const counts = new Map<ConditionKind, number>();
  for (const { condition } of slots) counts.set(condition.kind, (counts.get(condition.kind) ?? 0) + 1);

  let best: ConditionKind | null = null;
  let bestCount = 0;
  for (const [kind, count] of counts) {
    if (best === null || count > bestCount || (count === bestCount && severity(kind) > severity(best))) {
      best = kind;
      bestCount = count;
    }
  }
  if (best === null) throw new Error('dominantCondition needs at least one slot');

  const labelCounts = new Map<string, number>();
  for (const { condition } of slots) {
    if (condition.kind === best) labelCounts.set(condition.label, (labelCounts.get(condition.label) ?? 0) + 1);
  }
  let label = '';
  let labelCount = 0;
  for (const [candidate, count] of labelCounts) {
    if (count > labelCount) {
      label = candidate;
      labelCount = count;
    }
  }

  return { kind: best, label, isDay: true };
}

/**
 * Collapses 3-hour slots into daily cards grouped by the city's local date.
 * Today's card also includes the current observation, so it never contradicts the hero card.
 * OWM's free forecast spans ~120 h from now, so the last day can be partial; days with
 * no daytime slots fall back to all of that day's slots.
 */
export function aggregateDaily(
  slots: readonly ForecastSlot[],
  current: CurrentConditions,
  utcOffsetSec: number,
): DailyForecast[] {
  const currentSlot: ForecastSlot = {
    dt: Math.floor(current.observedAt / 1000),
    tempMinC: current.tempC,
    tempMaxC: current.tempC,
    condition: current.condition,
  };
  const today = cityLocalDate(currentSlot.dt, utcOffsetSec);

  const byDate = new Map<string, ForecastSlot[]>();
  for (const slot of [currentSlot, ...slots]) {
    const date = cityLocalDate(slot.dt, utcOffsetSec);
    if (date < today) continue;
    const group = byDate.get(date);
    if (group) group.push(slot);
    else byDate.set(date, [slot]);
  }

  return [...byDate.keys()]
    .sort()
    .slice(0, FORECAST_DAYS)
    .map((date) => {
      const group = byDate.get(date) ?? [];
      const daytime = group.filter((slot) => isDaytime(slot, utcOffsetSec));
      return {
        date,
        minC: Math.min(...group.map((s) => s.tempMinC)),
        maxC: Math.max(...group.map((s) => s.tempMaxC)),
        condition: dominantCondition(daytime.length > 0 ? daytime : group),
      };
    });
}

/** For providers that already return daily values: widen today's range to include the current reading. */
export function mergeCurrentIntoToday(
  daily: readonly DailyForecast[],
  current: CurrentConditions,
  utcOffsetSec: number,
): DailyForecast[] {
  const today = cityLocalDate(Math.floor(current.observedAt / 1000), utcOffsetSec);
  return daily
    .filter((day) => day.date >= today)
    .slice(0, FORECAST_DAYS)
    .map((day) =>
      day.date === today
        ? { ...day, minC: Math.min(day.minC, current.tempC), maxC: Math.max(day.maxC, current.tempC) }
        : day,
    );
}
