// @vitest-environment jsdom
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import indexHtml from '../../../index.html?raw';
import type { City, WeatherData } from '../../lib/api/types';
import { createSafeStorage, type KeyValueStore } from '../../lib/storage/safeStorage';
import { formatTemp } from '../../lib/units/format';
import { CurrentCard } from '../weather/CurrentCard';
import { THEME_KEY, resolveDark } from './theme';
import { UNITS_KEY, UnitContext } from './units';
import { useTheme } from './useTheme';
import { useUnits } from './useUnits';

function memory(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

/** A controllable prefers-color-scheme media query. */
function stubSystemDark(initial: boolean) {
  let matches = initial;
  const listeners = new Set<() => void>();
  vi.stubGlobal('matchMedia', () => ({
    get matches() {
      return matches;
    },
    addEventListener: (_: string, l: () => void) => listeners.add(l),
    removeEventListener: (_: string, l: () => void) => listeners.delete(l),
  }));
  return (next: boolean) => {
    matches = next;
    for (const l of listeners) l();
  };
}

beforeEach(() => {
  document.documentElement.className = '';
  document.head.innerHTML = '<meta name="theme-color" content="#0f172a">';
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('temperature units', () => {
  it('converts for display only, rounding cleanly', () => {
    expect(formatTemp(0, 'f')).toBe('32°');
    expect(formatTemp(-40, 'f')).toBe('-40°');
    expect(formatTemp(21.99, 'f')).toBe('72°');
    expect(formatTemp(-17.9, 'f')).toBe('0°');
    expect(formatTemp(21.99)).toBe('22°');
  });

  it('persists the choice', () => {
    const backing = memory();
    const store = createSafeStorage(() => backing);
    const { result } = renderHook(() => useUnits({ store }));
    expect(result.current.unit).toBe('c');
    act(() => result.current.setUnit('f'));
    expect(backing.data.get(UNITS_KEY)).toBe('"f"');
    expect(renderHook(() => useUnits({ store })).result.current.unit).toBe('f');
  });

  it('switches the same data instantly, without a new fetch', () => {
    const city: City = { id: 'k', type: 'CITY', name: 'Karachi', region: 'Sindh', country: 'Pakistan', countryCode: 'PK', lat: 24.86, lon: 67 };
    const data: WeatherData = {
      coords: city,
      source: 'owm',
      fetchedAt: Date.now(),
      utcOffsetSec: 18000,
      current: { observedAt: 0, tempC: 25, feelsLikeC: 30, humidity: 50, windMs: 2, condition: { kind: 'clear', label: 'Clear sky', isDay: true } },
      daily: [],
    };
    const { rerender } = render(
      <UnitContext.Provider value="c">
        <CurrentCard city={city} data={data} />
      </UnitContext.Provider>,
    );
    expect(screen.getByText('25°')).toBeTruthy();
    rerender(
      <UnitContext.Provider value="f">
        <CurrentCard city={city} data={data} />
      </UnitContext.Provider>,
    );
    expect(screen.getByText('77°')).toBeTruthy();
    expect(screen.getByText('86°')).toBeTruthy();
  });
});

describe('theme', () => {
  it('resolves system / light / dark', () => {
    expect(resolveDark('system', true)).toBe(true);
    expect(resolveDark('system', false)).toBe(false);
    expect(resolveDark('light', true)).toBe(false);
    expect(resolveDark('dark', false)).toBe(true);
  });

  it('applies and persists an explicit choice, including the browser UI colour', () => {
    stubSystemDark(false);
    const backing = memory();
    const { result } = renderHook(() => useTheme({ store: createSafeStorage(() => backing) }));
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    act(() => result.current.setPreference('dark'));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#020617');
    expect(backing.data.get(THEME_KEY)).toBe('"dark"');
  });

  it('"system" follows the OS setting live; an explicit choice ignores it', () => {
    const setSystemDark = stubSystemDark(false);
    const { result } = renderHook(() => useTheme({ store: createSafeStorage(memory) }));
    act(() => setSystemDark(true));
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    act(() => result.current.setPreference('light'));
    act(() => setSystemDark(false));
    act(() => setSystemDark(true));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});

describe('index.html no-flash script', () => {
  const script = /<script>([\s\S]*?)<\/script>/.exec(indexHtml)?.[1] ?? '';

  it('is present in index.html', () => {
    expect(script).toContain('weatherboard:theme:v1');
  });

  it.each([
    ['nothing saved, OS dark', null, true, true],
    ['nothing saved, OS light', null, false, false],
    ['saved light, OS dark', '"light"', true, false],
    ['saved dark, OS light', '"dark"', false, true],
    ['corrupt value, OS dark', '{oops', true, false],
  ])('%s', (_label, saved, osDark, expectDark) => {
    stubSystemDark(osDark);
    if (saved !== null) localStorage.setItem(THEME_KEY, saved);
    new Function(script)();
    expect(document.documentElement.classList.contains('dark')).toBe(expectDark);
  });
});
