import type { CurrentSnapshot } from '../../lib/api/types';

/** A mini temperature is reused for this long before it is fetched again. */
export const FRESH_FOR_MS = 10 * 60_000;

export type TempEntry = { status: 'ready'; snapshot: CurrentSnapshot } | { status: 'error' };

export type MiniTemp = { status: 'loading' } | { status: 'error' } | { status: 'ready'; snapshot: CurrentSnapshot };

/** The weather the main panel already shows, so a favourite doesn't fetch the same city twice. */
export interface LatestViewed {
  cityId: string;
  snapshot: CurrentSnapshot;
}

/** Whichever is newer: the panel's own fetch or the main view's data for the same city. */
export function resolveMiniTemp(id: string, entry: TempEntry | undefined, latest: LatestViewed | null): MiniTemp {
  const viewed = latest?.cityId === id ? latest.snapshot : null;
  const own = entry?.status === 'ready' ? entry.snapshot : null;
  if (viewed && (!own || viewed.fetchedAt >= own.fetchedAt)) return { status: 'ready', snapshot: viewed };
  if (own) return { status: 'ready', snapshot: own };
  return entry ?? { status: 'loading' };
}

export function needsFetch(id: string, entry: TempEntry | undefined, latest: LatestViewed | null, now: number): boolean {
  const resolved = resolveMiniTemp(id, entry, latest);
  if (resolved.status !== 'ready') return true;
  return now - resolved.snapshot.fetchedAt >= FRESH_FOR_MS;
}
