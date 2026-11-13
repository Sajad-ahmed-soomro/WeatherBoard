import { useEffect, useRef } from 'react';
import type { Coordinates } from '../../lib/api/types';
import { isWeatherUpdatedMessage } from '../../lib/pwa/weatherCacheRules';

/** The current and forecast responses refresh separately; wait for the pair before reacting. */
export const SETTLE_MS = 400;

/**
 * Calls back when the service worker has refreshed the cached weather for some coordinates.
 * Messages that arrive close together are coalesced into one call.
 */
export function useWeatherCacheUpdates(onUpdate: (coords: Coordinates) => void): void {
  const callback = useRef(onUpdate);

  useEffect(() => {
    callback.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    const sw = typeof navigator === 'undefined' ? undefined : navigator.serviceWorker;
    if (!sw) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onMessage = (event: MessageEvent<unknown>) => {
      const data = event.data;
      if (!isWeatherUpdatedMessage(data)) return;
      clearTimeout(timer);
      timer = setTimeout(() => callback.current({ lat: data.lat, lon: data.lon }), SETTLE_MS);
    };
    sw.addEventListener('message', onMessage);
    return () => {
      clearTimeout(timer);
      sw.removeEventListener('message', onMessage);
    };
  }, []);
}
