import { useCallback, useEffect, useState } from 'react';

/** Chromium's install prompt event; not in the standard DOM typings. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isInstallPromptEvent(event: Event): event is BeforeInstallPromptEvent {
  return 'prompt' in event && typeof event.prompt === 'function' && 'userChoice' in event;
}

/**
 * Custom install button support. Only Chromium browsers fire beforeinstallprompt; elsewhere
 * (Safari, Firefox) canInstall stays false and the browser's own menu is the way to install.
 */
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      if (!isInstallPromptEvent(event)) return;
      event.preventDefault();
      setDeferred(event);
    };
    const onInstalled = () => setDeferred(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    // A prompt event can only be used once, whatever the user chooses.
    setDeferred(null);
    await deferred.prompt();
    await deferred.userChoice;
  }, [deferred]);

  return { canInstall: deferred !== null, install };
}
