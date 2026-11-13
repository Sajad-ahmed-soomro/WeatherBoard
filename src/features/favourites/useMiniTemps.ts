import { useCallback, useEffect, useRef, useState } from 'react';
import { isAbortError } from '../../lib/api/errors';
import type { City, CurrentSnapshot } from '../../lib/api/types';
import { getCurrent } from '../../lib/api/weather';
import { needsFetch, resolveMiniTemp, type LatestViewed, type MiniTemp, type TempEntry } from './miniTemps';

type FetchCurrent = (lat: number, lon: number, options: { signal: AbortSignal }) => Promise<CurrentSnapshot>;

interface UseMiniTempsOptions {
  latest: LatestViewed | null;
  fetchCurrent?: FetchCurrent;
  now?: () => number;
}

/**
 * Current temperature for each favourite: one request per city, reused for 10 minutes,
 * re-checked when the tab becomes visible. Failed cities retry on the next check.
 */
export function useMiniTemps(favourites: readonly City[], { latest, fetchCurrent = getCurrent, now = Date.now }: UseMiniTempsOptions) {
  const [entries, setEntries] = useState<Readonly<Record<string, TempEntry>>>({});
  const [checkTick, setCheckTick] = useState(0);
  const inFlight = useRef(new Map<string, AbortController>());
  const snapshot = useRef({ entries, latest, fetchCurrent, now });

  useEffect(() => {
    snapshot.current = { entries, latest, fetchCurrent, now };
  }, [entries, latest, fetchCurrent, now]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') setCheckTick((t) => t + 1);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  useEffect(() => {
    const requests = inFlight.current;
    const { entries: known, latest: viewed, fetchCurrent: fetchNow, now: clock } = snapshot.current;
    const ids = new Set(favourites.map((c) => c.id));

    for (const [id, controller] of requests) {
      if (!ids.has(id)) {
        controller.abort();
        requests.delete(id);
      }
    }

    for (const city of favourites) {
      if (requests.has(city.id) || !needsFetch(city.id, known[city.id], viewed, clock())) continue;
      const controller = new AbortController();
      requests.set(city.id, controller);
      fetchNow(city.lat, city.lon, { signal: controller.signal })
        .then((result) => setEntries((prev) => ({ ...prev, [city.id]: { status: 'ready', snapshot: result } })))
        .catch((err: unknown) => {
          if (!isAbortError(err)) setEntries((prev) => ({ ...prev, [city.id]: { status: 'error' } }));
        })
        .finally(() => {
          if (requests.get(city.id) === controller) requests.delete(city.id);
        });
    }
  }, [favourites, checkTick]);

  useEffect(() => {
    const requests = inFlight.current;
    return () => {
      for (const controller of requests.values()) controller.abort();
      requests.clear();
    };
  }, []);

  const tempFor = useCallback((id: string): MiniTemp => resolveMiniTemp(id, entries[id], latest), [entries, latest]);

  return { tempFor };
}
