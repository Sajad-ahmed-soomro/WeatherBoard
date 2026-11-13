import { useEffect, useRef, useState } from 'react';

/**
 * navigator.onLine plus online/offline events. "Online" only means a network is connected,
 * not that the APIs are reachable, so requests still handle their own failures.
 */
export function useOnlineStatus(onReconnect?: () => void): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const reconnect = useRef(onReconnect);

  useEffect(() => {
    reconnect.current = onReconnect;
  }, [onReconnect]);

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      reconnect.current?.();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}
