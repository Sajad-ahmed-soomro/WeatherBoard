import type { SafeStorage } from '../../lib/storage/safeStorage';

export type ThemePreference = 'system' | 'light' | 'dark';

/** Also read by the inline script in index.html, which applies the theme before first paint. */
export const THEME_KEY = 'weatherboard:theme:v1';

const DARK_QUERY = '(prefers-color-scheme: dark)';

export const isThemePreference = (v: unknown): v is ThemePreference => v === 'system' || v === 'light' || v === 'dark';

export function loadTheme(store: SafeStorage): ThemePreference {
  return store.read(THEME_KEY, isThemePreference) ?? 'system';
}

export function resolveDark(preference: ThemePreference, systemDark: boolean): boolean {
  return preference === 'dark' || (preference === 'system' && systemDark);
}

export function systemPrefersDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia(DARK_QUERY).matches;
}

export function watchSystemTheme(onChange: () => void): () => void {
  if (typeof matchMedia !== 'function') return () => undefined;
  const query = matchMedia(DARK_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

const THEME_COLORS = { light: '#f8fafc', dark: '#020617' } as const;

/** Applies the class Tailwind's dark variant keys off, plus the browser UI colour. */
export function applyTheme(dark: boolean, root: HTMLElement = document.documentElement): void {
  root.classList.toggle('dark', dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? THEME_COLORS.dark : THEME_COLORS.light);
}
