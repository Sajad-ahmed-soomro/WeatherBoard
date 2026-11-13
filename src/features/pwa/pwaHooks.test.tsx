// @vitest-environment jsdom
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OfflineBanner } from './OfflineBanner';
import { useInstallPrompt } from './useInstallPrompt';
import { useOnlineStatus } from './useOnlineStatus';
import { SETTLE_MS, useWeatherCacheUpdates } from './useWeatherCacheUpdates';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useOnlineStatus', () => {
  it('follows online/offline events and calls back on reconnect', () => {
    const onReconnect = vi.fn();
    const { result } = renderHook(() => useOnlineStatus(onReconnect));
    expect(result.current).toBe(true);

    act(() => void window.dispatchEvent(new Event('offline')));
    expect(result.current).toBe(false);
    expect(onReconnect).not.toHaveBeenCalled();

    act(() => void window.dispatchEvent(new Event('online')));
    expect(result.current).toBe(true);
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });
});

function installEvent() {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  const prompt = vi.fn(() => Promise.resolve());
  Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome: 'accepted' }) });
  return { event, prompt };
}

describe('useInstallPrompt', () => {
  it('stays hidden until the browser offers an install prompt', () => {
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.canInstall).toBe(false);
  });

  it('keeps the event, shows it on install, and hides the button afterwards', async () => {
    const { result } = renderHook(() => useInstallPrompt());
    const { event, prompt } = installEvent();
    act(() => void window.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(true);
    expect(result.current.canInstall).toBe(true);

    await act(() => result.current.install());
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(result.current.canInstall).toBe(false);
  });

  it('hides the button once the app is installed some other way', () => {
    const { result } = renderHook(() => useInstallPrompt());
    act(() => void window.dispatchEvent(installEvent().event));
    act(() => void window.dispatchEvent(new Event('appinstalled')));
    expect(result.current.canInstall).toBe(false);
  });
});

describe('useWeatherCacheUpdates', () => {
  it('coalesces the current + forecast messages into one callback', () => {
    vi.useFakeTimers();
    const sw = new EventTarget();
    vi.stubGlobal('navigator', { ...navigator, serviceWorker: sw });
    const onUpdate = vi.fn();
    renderHook(() => useWeatherCacheUpdates(onUpdate));

    const message = new MessageEvent('message', { data: { type: 'WEATHER_UPDATED', lat: 1, lon: 2 } });
    sw.dispatchEvent(message);
    vi.advanceTimersByTime(SETTLE_MS / 2);
    sw.dispatchEvent(new MessageEvent('message', { data: { type: 'WEATHER_UPDATED', lat: 1, lon: 2 } }));
    sw.dispatchEvent(new MessageEvent('message', { data: 'unrelated' }));
    vi.advanceTimersByTime(SETTLE_MS);

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith({ lat: 1, lon: 2 });
  });
});

describe('OfflineBanner', () => {
  it('is empty online, and names the saved city and its age offline', () => {
    const fetchedAt = Date.now() - 2 * 3600_000;
    const { rerender } = render(<OfflineBanner online showing={{ cityName: 'Karachi', fetchedAt }} />);
    expect(screen.getByRole('status').textContent).toBe('');

    rerender(<OfflineBanner online={false} showing={{ cityName: 'Karachi', fetchedAt }} />);
    expect(screen.getByRole('status').textContent).toBe("You're offline. Showing saved weather for Karachi, updated 2 hr ago.");

    rerender(<OfflineBanner online={false} showing={null} />);
    expect(screen.getByRole('status').textContent).toMatch(/last viewed city is available offline/);
  });
});
