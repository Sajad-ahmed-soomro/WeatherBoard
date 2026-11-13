import { REMINDER_TAG } from './dailyCheck';

/** How this browser can deliver the reminder. */
export type Delivery = 'background' | 'while-open';

interface PeriodicSyncManager {
  register(tag: string, options: { minInterval: number }): Promise<void>;
  unregister(tag: string): Promise<void>;
}

type WithPeriodicSync = ServiceWorkerRegistration & { periodicSync: PeriodicSyncManager };

function hasPeriodicSync(reg: ServiceWorkerRegistration): reg is WithPeriodicSync {
  return 'periodicSync' in reg;
}

/** Ask to be woken roughly hourly; the browser decides the real cadence (often much less often). */
const MIN_INTERVAL_MS = 60 * 60_000;

/** Not in TypeScript's PermissionName union yet. */
const PERIODIC_SYNC_PERMISSION = 'periodic-background-sync' as PermissionName;

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
}

export function currentPermission(): NotificationPermission {
  return notificationsSupported() ? Notification.permission : 'denied';
}

/**
 * Registers the background check where the browser allows it (Chromium, usually only for an
 * installed app). Anything else, or any failure, means reminders only work while the app is open.
 */
export async function enableBackgroundDelivery(reg: ServiceWorkerRegistration): Promise<Delivery> {
  if (!hasPeriodicSync(reg)) return 'while-open';
  try {
    const status = await navigator.permissions.query({ name: PERIODIC_SYNC_PERMISSION });
    if (status.state !== 'granted') return 'while-open';
    await reg.periodicSync.register(REMINDER_TAG, { minInterval: MIN_INTERVAL_MS });
    return 'background';
  } catch {
    return 'while-open';
  }
}

export async function disableBackgroundDelivery(reg: ServiceWorkerRegistration): Promise<void> {
  if (!hasPeriodicSync(reg)) return;
  await reg.periodicSync.unregister(REMINDER_TAG).catch(() => undefined);
}
