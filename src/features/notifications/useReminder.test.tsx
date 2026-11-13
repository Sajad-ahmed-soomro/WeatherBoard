// @vitest-environment jsdom
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WeatherData } from '../../lib/api/types';
import { createIdbStore } from '../../lib/storage/idb';
import { ReminderCard } from './ReminderCard';
import { createSettingsRepo, type ReminderCity } from './settings';
import type { ReminderPlatform } from './useReminder';
import { useReminder } from './useReminder';

const KARACHI: ReminderCity = { name: 'Karachi', lat: 24.86, lon: 67 };

function fakePlatform(initial: NotificationPermission = 'default', answer: NotificationPermission = 'granted') {
  let permission = initial;
  const showNotification = vi.fn(() => Promise.resolve());
  const platform: ReminderPlatform = {
    supported: () => true,
    permission: () => permission,
    requestPermission: vi.fn(() => {
      permission = answer;
      return Promise.resolve(answer);
    }),
    registration: () => Promise.resolve({ showNotification } as unknown as ServiceWorkerRegistration),
    enableBackground: vi.fn(() => Promise.resolve('while-open' as const)),
    disableBackground: vi.fn(() => Promise.resolve()),
  };
  return { platform, showNotification };
}

function setup({
  city = KARACHI,
  platform = fakePlatform().platform,
  clock = '06:00',
}: { city?: ReminderCity | null; platform?: ReminderPlatform; clock?: string } = {}) {
  const repo = createSettingsRepo(createIdbStore('t', 'settings', () => new IDBFactory()));
  const fetchWeather = vi.fn((): Promise<WeatherData> => Promise.reject(new Error('no network in tests')));
  const now = () => new Date(`2026-11-14T${clock}:00`);
  const hook = renderHook(({ c }) => useReminder({ city: c, repo, platform, fetchWeather, now }), { initialProps: { c: city } });
  return { ...hook, repo };
}

const settle = () => act(async () => {
  await new Promise((r) => setTimeout(r, 20));
});

afterEach(cleanup);

describe('useReminder', () => {
  it('reports unsupported browsers without touching anything else', () => {
    const { platform } = fakePlatform();
    const { result } = setup({ platform: { ...platform, supported: () => false } });
    expect(result.current.view).toEqual({ kind: 'unsupported' });
  });

  it('shows the explainer before asking the browser for permission', async () => {
    const { platform } = fakePlatform();
    const { result } = setup({ platform });
    await settle();
    expect(result.current.view).toEqual({ kind: 'off', time: '07:00' });

    act(() => result.current.requestEnable());
    expect(result.current.explainerOpen).toBe(true);
    expect(platform.requestPermission).not.toHaveBeenCalled();

    act(() => result.current.cancelExplainer());
    expect(result.current.explainerOpen).toBe(false);
    expect(platform.requestPermission).not.toHaveBeenCalled();
  });

  it('turns on after permission is granted, saving to IndexedDB and asking for background delivery', async () => {
    const { platform } = fakePlatform();
    const { result, repo } = setup({ platform });
    await settle();
    act(() => result.current.requestEnable());
    act(() => result.current.confirmExplainer());
    await settle();

    expect(platform.requestPermission).toHaveBeenCalledTimes(1);
    expect(result.current.view).toEqual({ kind: 'on', time: '07:00', cityName: 'Karachi', delivery: 'while-open' });
    expect(await repo.load()).toMatchObject({ enabled: true, city: KARACHI });
    expect(platform.enableBackground).toHaveBeenCalled();
  });

  it('shows the blocked state when permission is refused, and stays off', async () => {
    const { platform } = fakePlatform('default', 'denied');
    const { result, repo } = setup({ platform });
    await settle();
    act(() => result.current.requestEnable());
    act(() => result.current.confirmExplainer());
    await settle();
    expect(result.current.view).toEqual({ kind: 'denied' });
    expect((await repo.load()).enabled).toBe(false);
  });

  it('copies the °C/°F choice into the reminder settings while on', async () => {
    const { platform } = fakePlatform('granted');
    const repo = createSettingsRepo(createIdbStore('u', 'settings', () => new IDBFactory()));
    const fetchWeather = () => Promise.reject(new Error('offline'));
    const now = () => new Date('2026-11-14T06:00:00');
    const { result, rerender } = renderHook(({ unit }) => useReminder({ city: KARACHI, unit, repo, platform, fetchWeather, now }), {
      initialProps: { unit: 'c' as 'c' | 'f' },
    });
    await settle();
    act(() => result.current.requestEnable());
    await settle();
    expect((await repo.load()).unit).toBe('c');

    rerender({ unit: 'f' });
    await waitFor(async () => expect((await repo.load()).unit).toBe('f'));
  });

  it('rejects an invalid time without saving, and saves a valid one', async () => {
    const { result, repo } = setup();
    await settle();
    act(() => result.current.changeTime(''));
    expect(result.current.timeError).toMatch(/07:30/);
    expect(result.current.timeValue).toBe('');
    await settle();
    expect((await repo.load()).time).toBe('07:00');

    act(() => result.current.changeTime('06:45'));
    await settle();
    expect(result.current.timeError).toBeNull();
    expect((await repo.load()).time).toBe('06:45');
  });

  it('fallback: when due, an open app shows the reminder once', async () => {
    const { platform, showNotification } = fakePlatform('granted');
    const { repo } = setup({ platform, clock: '07:10' });
    await repo.change((s) => ({ ...s, enabled: true, city: KARACHI }));
    await settle();
    // Re-mount to simulate opening the app with reminders already on.
    cleanup();
    const again = renderHook(() =>
      useReminder({ city: KARACHI, repo, platform, fetchWeather: () => Promise.reject(new Error('offline')), now: () => new Date('2026-11-14T07:10:00') }),
    );
    await waitFor(() => expect(showNotification).toHaveBeenCalledTimes(1));
    expect(showNotification).toHaveBeenCalledWith('Weather for Karachi', expect.objectContaining({ tag: 'weatherboard-daily' }));

    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    await settle();
    expect(showNotification).toHaveBeenCalledTimes(1);
    again.unmount();
  });
});

describe('ReminderCard', () => {
  const noop = () => undefined;
  const base = { timeValue: '07:00', timeError: null, saveError: null, onEnable: noop, onDisable: noop, onTimeChange: noop };

  it('explains why it cannot be turned on without a city', () => {
    render(<ReminderCard {...base} view={{ kind: 'off', time: '07:00' }} canEnable={false} />);
    const button = screen.getByRole('button', { name: 'Turn on reminder' });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(document.getElementById(button.getAttribute('aria-describedby') ?? '')?.textContent).toMatch(/Open a city first/);
  });

  it('says "around" the chosen time and how this browser delivers it', () => {
    render(<ReminderCard {...base} view={{ kind: 'on', time: '07:00', cityName: 'Karachi', delivery: 'while-open' }} canEnable />);
    expect(screen.getByText(/On: around/).textContent).toBe('On: around 07:00 each day for Karachi.');
    expect(screen.getByText(/can't wake WeatherBoard in the background/)).toBeTruthy();
  });

  it('marks an invalid time for assistive tech', () => {
    render(<ReminderCard {...base} view={{ kind: 'off', time: '07:00' }} canEnable timeValue="" timeError="Enter a time like 07:30." />);
    const input = screen.getByLabelText('Reminder time');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(input.getAttribute('aria-describedby') ?? '')?.textContent).toBe('Enter a time like 07:30.');
  });
});
