import { useCallback, useEffect, useRef, useState } from 'react';
import type { Coordinates } from '../../lib/api/types';

export type GeolocationProblem = 'unsupported' | 'denied' | 'unavailable' | 'timeout';

export type GeolocationState =
  | { status: 'idle' }
  | { status: 'locating' }
  | { status: 'error'; problem: GeolocationProblem; message: string };

const MESSAGES: Record<GeolocationProblem, string> = {
  unsupported: "This browser can't share your location. Search for a city or pick one above instead.",
  denied: 'Location access is turned off for this site. Search for a city instead, or allow location in your browser settings.',
  unavailable: "Your device couldn't work out where you are. Try again, or search for a city.",
  timeout: 'Finding your location took too long. Try again, or search for a city.',
};

function problemFrom(error: GeolocationPositionError): GeolocationProblem {
  if (error.code === error.PERMISSION_DENIED) return 'denied';
  if (error.code === error.TIMEOUT) return 'timeout';
  return 'unavailable';
}

/** Only asks for location when the user presses the button; every failure ends in a readable state. */
export function useGeolocation(
  onLocated: (coords: Coordinates) => void,
  geolocation: Geolocation | undefined = typeof navigator === 'undefined' ? undefined : navigator.geolocation,
) {
  const [state, setState] = useState<GeolocationState>({ status: 'idle' });
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const fail = useCallback((problem: GeolocationProblem) => {
    setState({ status: 'error', problem, message: MESSAGES[problem] });
  }, []);

  const request = useCallback(() => {
    if (!geolocation) {
      fail('unsupported');
      return;
    }
    setState({ status: 'locating' });
    geolocation.getCurrentPosition(
      (position) => {
        if (!mounted.current) return;
        setState({ status: 'idle' });
        onLocated({ lat: position.coords.latitude, lon: position.coords.longitude });
      },
      (error) => {
        if (mounted.current) fail(problemFrom(error));
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 10 * 60_000 },
    );
  }, [fail, geolocation, onLocated]);

  return { state, request };
}
