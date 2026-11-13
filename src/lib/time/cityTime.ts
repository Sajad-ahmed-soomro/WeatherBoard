/**
 * City-local time helpers. Providers give UTC epoch seconds plus the city's UTC offset;
 * shifting by the offset and reading UTC fields yields the city's wall clock,
 * independent of the browser's own timezone.
 */

function shifted(epochSec: number, utcOffsetSec: number): Date {
  return new Date((epochSec + utcOffsetSec) * 1000);
}

/** City-local calendar date as YYYY-MM-DD. */
export function cityLocalDate(epochSec: number, utcOffsetSec: number): string {
  return shifted(epochSec, utcOffsetSec).toISOString().slice(0, 10);
}

/** City-local hour of day, 0–23. */
export function cityLocalHour(epochSec: number, utcOffsetSec: number): number {
  return shifted(epochSec, utcOffsetSec).getUTCHours();
}
