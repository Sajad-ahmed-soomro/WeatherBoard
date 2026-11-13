import { useCallback } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Registers the service worker and exposes the two moments worth telling the user about:
 * the app shell is cached (works offline), or a new version is waiting (reload to update).
 */
export function useAppUpdate() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true });

  const dismiss = useCallback(() => {
    setNeedRefresh(false);
    setOfflineReady(false);
  }, [setNeedRefresh, setOfflineReady]);

  const update = useCallback(() => updateServiceWorker(true), [updateServiceWorker]);

  return { needRefresh, offlineReady, update, dismiss };
}
