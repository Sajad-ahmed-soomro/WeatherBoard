/**
 * When a response set was really fetched: the oldest service-worker stamp, so mixed fresh
 * and cached parts never look newer than they are. Without stamps, it is now.
 */
export function oldestFetchedAt(stamps: readonly (number | null)[], now = Date.now()): number {
  const known = stamps.filter((s): s is number => s !== null);
  return known.length > 0 ? Math.min(...known) : now;
}
