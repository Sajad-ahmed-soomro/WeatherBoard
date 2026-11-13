import { useCallback, useEffect, useRef, useState } from 'react';
import type { WeatherData } from '../../lib/api/types';
import { getWeather } from '../../lib/api/weather';
import { REMINDER_TAG, runDailyCheck, type ReminderContent } from './dailyCheck';
import { startingFrom } from './schedule';
import { DEFAULT_SETTINGS, isValidTime, settingsRepo as defaultRepo, type ReminderCity, type ReminderSettings, type SettingsRepo } from './settings';
import { currentPermission, disableBackgroundDelivery, enableBackgroundDelivery, notificationsSupported, type Delivery } from './support';

/** While the app is open, also check on this interval (the page may stay open past the time). */
export const OPEN_CHECK_MS = 60_000;

export type ReminderView =
  | { kind: 'loading' }
  | { kind: 'unsupported' }
  | { kind: 'denied' }
  | { kind: 'off'; time: string }
  | { kind: 'on'; time: string; cityName: string; delivery: Delivery };

export interface ReminderPlatform {
  supported: () => boolean;
  permission: () => NotificationPermission;
  requestPermission: () => Promise<NotificationPermission>;
  registration: () => Promise<ServiceWorkerRegistration>;
  enableBackground: (reg: ServiceWorkerRegistration) => Promise<Delivery>;
  disableBackground: (reg: ServiceWorkerRegistration) => Promise<void>;
}

const browserPlatform: ReminderPlatform = {
  supported: notificationsSupported,
  permission: currentPermission,
  requestPermission: () => Notification.requestPermission(),
  registration: () => navigator.serviceWorker.ready,
  enableBackground: enableBackgroundDelivery,
  disableBackground: disableBackgroundDelivery,
};

interface UseReminderOptions {
  /** The city the reminder reports on: the one currently shown, if any. */
  city: ReminderCity | null;
  repo?: SettingsRepo;
  platform?: ReminderPlatform;
  fetchWeather?: (lat: number, lon: number) => Promise<WeatherData>;
  now?: () => Date;
}

function sameCity(a: ReminderCity | null, b: ReminderCity): boolean {
  return a !== null && a.name === b.name && a.lat === b.lat && a.lon === b.lon;
}

const SAVE_ERROR = "Couldn't save reminder settings on this device (storage may be blocked).";

/**
 * Daily reminder: explainer before the permission prompt, a validated time saved in IndexedDB,
 * background delivery where supported, and an in-app fallback check (on open, on returning to
 * the tab, and every minute while open). The same IndexedDB claim stops double reminders.
 */
const fetchForReminder = (lat: number, lon: number) => getWeather(lat, lon);
const systemNow = () => new Date();

export function useReminder({ city, repo = defaultRepo, platform = browserPlatform, fetchWeather = fetchForReminder, now = systemNow }: UseReminderOptions) {
  const supported = platform.supported();
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>(() => (supported ? platform.permission() : 'denied'));
  const [delivery, setDelivery] = useState<Delivery>('while-open');
  const [explainerOpen, setExplainerOpen] = useState(false);
  const [timeDraft, setTimeDraft] = useState<string | null>(null);
  const [timeError, setTimeError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const deps = useRef({ repo, platform, fetchWeather, now });

  useEffect(() => {
    deps.current = { repo, platform, fetchWeather, now };
  }, [repo, platform, fetchWeather, now]);

  // Load saved settings, and re-confirm background delivery if reminders were left on.
  useEffect(() => {
    if (!supported) return;
    let active = true;
    const { repo: r, platform: p } = deps.current;
    r.load()
      .catch(() => DEFAULT_SETTINGS)
      .then(async (loaded) => {
        if (!active) return;
        setSettings(loaded);
        if (loaded.enabled && p.permission() === 'granted') {
          const result = await p.enableBackground(await p.registration());
          if (active) setDelivery(result);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [supported]);

  /** Applies a change atomically in IndexedDB, then mirrors the stored result. */
  const persist = useCallback(async (fn: (current: ReminderSettings) => ReminderSettings): Promise<boolean> => {
    try {
      setSettings(await deps.current.repo.change(fn));
      setSaveError(null);
      return true;
    } catch {
      setSaveError(SAVE_ERROR);
      return false;
    }
  }, []);

  const enable = useCallback(async () => {
    if (!city) return;
    const { platform: p, now: clock } = deps.current;
    if (!(await persist((s) => startingFrom({ ...s, enabled: true, city }, clock())))) return;
    setDelivery(await p.enableBackground(await p.registration()));
  }, [city, persist]);

  /** Step 1 of turning reminders on: explain first, unless permission was already given. */
  const requestEnable = useCallback(() => {
    if (permission === 'granted') void enable();
    else setExplainerOpen(true);
  }, [enable, permission]);

  /** Step 2: the user read the explainer; now the browser's own prompt. */
  const confirmExplainer = useCallback(async () => {
    setExplainerOpen(false);
    const result = await deps.current.platform.requestPermission();
    setPermission(result);
    if (result === 'granted') await enable();
  }, [enable]);

  const cancelExplainer = useCallback(() => setExplainerOpen(false), []);

  const disable = useCallback(async () => {
    await persist((s) => ({ ...s, enabled: false }));
    const { platform: p } = deps.current;
    await p.disableBackground(await p.registration());
    setDelivery('while-open');
  }, [persist]);

  const changeTime = useCallback(
    (value: string) => {
      setTimeDraft(value);
      if (!isValidTime(value)) {
        setTimeError('Enter a time like 07:30.');
        return;
      }
      setTimeError(null);
      setTimeDraft(null);
      void persist((s) => startingFrom({ ...s, time: value }, deps.current.now()));
    },
    [persist],
  );

  // Keep the reminder on the city being viewed (written to IndexedDB, mirrored when stored).
  const followCity = settings?.enabled === true && city !== null && !sameCity(settings.city, city);
  useEffect(() => {
    if (!followCity || !city) return;
    void persist((s) => (s.enabled ? { ...s, city } : s));
  }, [followCity, city, persist]);

  // In-app fallback: check when the app opens, when the tab becomes visible, and every minute.
  const enabledAndAllowed = settings?.enabled === true && permission === 'granted';
  useEffect(() => {
    if (!enabledAndAllowed) return;
    const check = () => {
      const { repo: r, platform: p, fetchWeather: fetchNow, now: clock } = deps.current;
      const show = async ({ title, body }: ReminderContent) => {
        const reg = await p.registration();
        await reg.showNotification(title, { body, tag: REMINDER_TAG, icon: '/icons/pwa-192x192.png', data: { url: '/' } });
      };
      runDailyCheck({ repo: r, fetchWeather: fetchNow, show, now: clock })
        .then((result) => {
          if (result === 'shown') return r.load().then(setSettings);
          return undefined;
        })
        .catch(() => undefined);
    };
    check();
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        setPermission(deps.current.platform.permission());
        check();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    const id = setInterval(check, OPEN_CHECK_MS);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(id);
    };
  }, [enabledAndAllowed]);

  const view: ReminderView = !supported
    ? { kind: 'unsupported' }
    : permission === 'denied'
      ? { kind: 'denied' }
      : !settings
        ? { kind: 'loading' }
        : settings.enabled && settings.city
          ? { kind: 'on', time: settings.time, cityName: settings.city.name, delivery }
          : { kind: 'off', time: settings.time };

  return {
    view,
    canEnable: city !== null,
    timeValue: timeDraft ?? settings?.time ?? DEFAULT_SETTINGS.time,
    timeError,
    saveError,
    explainerOpen,
    requestEnable,
    confirmExplainer: () => void confirmExplainer(),
    cancelExplainer,
    disable: () => void disable(),
    changeTime,
  };
}
