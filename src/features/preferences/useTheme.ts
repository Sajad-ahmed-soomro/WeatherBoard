import { useCallback, useEffect, useState } from 'react';
import { storage as defaultStorage, type SafeStorage } from '../../lib/storage/safeStorage';
import { THEME_KEY, applyTheme, loadTheme, resolveDark, systemPrefersDark, watchSystemTheme, type ThemePreference } from './theme';

/** System / light / dark, persisted; "system" follows OS changes live. */
export function useTheme({ store = defaultStorage }: { store?: SafeStorage } = {}) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => loadTheme(store));

  useEffect(() => {
    applyTheme(resolveDark(preference, systemPrefersDark()));
    if (preference !== 'system') return;
    return watchSystemTheme(() => applyTheme(resolveDark('system', systemPrefersDark())));
  }, [preference]);

  const setPreference = useCallback(
    (next: ThemePreference) => {
      setPreferenceState(next);
      store.write(THEME_KEY, next);
    },
    [store],
  );

  return { preference, setPreference };
}
