import { useCallback, useEffect, useRef, useState } from 'react';
import { isAbortError, toAppError, type AppError } from '../../lib/api/errors';
import type { City, WeatherData } from '../../lib/api/types';
import { getWeather } from '../../lib/api/weather';
import { storage as defaultStorage, type SafeStorage } from '../../lib/storage/safeStorage';
import { loadLastViewed, saveLastViewed } from './lastViewed';

export type WeatherState =
  | { status: 'idle' }
  | { status: 'loading'; city: City }
  | { status: 'success'; city: City; data: WeatherData }
  | { status: 'error'; city: City; error: AppError };

type FetchWeather = (lat: number, lon: number, options: { signal: AbortSignal }) => Promise<WeatherData>;

interface UseWeatherOptions {
  fetchWeather?: FetchWeather;
  store?: SafeStorage;
}

/**
 * Loads weather for one city at a time by lat/lon. Starts with the last viewed city
 * when one is saved; otherwise idle (the first-load empty state). A newer load aborts
 * the previous one, and late responses are ignored.
 */
export function useWeather({ fetchWeather = getWeather, store = defaultStorage }: UseWeatherOptions = {}) {
  const [state, setState] = useState<WeatherState>(() => {
    const last = loadLastViewed(store);
    return last ? { status: 'loading', city: last.lastCity } : { status: 'idle' };
  });
  const controller = useRef<AbortController | null>(null);
  const latestRequest = useRef(0);
  const currentCity = useRef<City | null>(state.status === 'idle' ? null : state.city);
  /** True until the restored city's first request settles; survives StrictMode's mount/unmount/mount. */
  const restorePending = useRef(state.status !== 'idle');
  /**
   * Latest options, read at request time. Keeping them out of effect deps means a caller
   * passing new function/store identities can't re-run (and abort) the restore.
   */
  const options = useRef({ fetchWeather, store });
  useEffect(() => {
    options.current = { fetchWeather, store };
  }, [fetchWeather, store]);

  const cancel = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    latestRequest.current += 1;
  }, []);

  /**
   * Starts the request; the caller is responsible for showing the loading state.
   * A silent fetch (background refresh) keeps what is on screen if it fails.
   */
  const fetchFor = useCallback(
    (city: City, silent = false) => {
      cancel();
      currentCity.current = city;
      const requestId = latestRequest.current;
      const abort = new AbortController();
      controller.current = abort;

      const { fetchWeather: fetchNow, store: storeNow } = options.current;
      fetchNow(city.lat, city.lon, { signal: abort.signal })
        .then((data) => {
          if (requestId !== latestRequest.current) return;
          restorePending.current = false;
          setState({ status: 'success', city, data });
          saveLastViewed({ lastCity: city, fetchedAt: data.fetchedAt }, storeNow);
        })
        .catch((err: unknown) => {
          if (requestId !== latestRequest.current || isAbortError(err) || silent) return;
          restorePending.current = false;
          setState({ status: 'error', city, error: toAppError(err, 'weather') });
        })
        .finally(() => {
          if (controller.current === abort) controller.current = null;
        });
    },
    [cancel],
  );

  const load = useCallback(
    (city: City) => {
      restorePending.current = false;
      setState({ status: 'loading', city });
      fetchFor(city);
    },
    [fetchFor],
  );

  const retry = useCallback(() => {
    if (currentCity.current) load(currentCity.current);
  }, [load]);

  /** Re-fetches the shown city without a loading state, e.g. after the offline cache was refreshed. */
  const refresh = useCallback(() => {
    if (state.status === 'success') fetchFor(state.city, true);
  }, [fetchFor, state]);

  // Restore the last viewed city once on mount (state already shows it as loading).
  useEffect(() => {
    const city = currentCity.current;
    if (city && restorePending.current) fetchFor(city);
    return cancel;
  }, [cancel, fetchFor]);

  return { state, load, retry, refresh };
}
