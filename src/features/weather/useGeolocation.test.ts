// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useGeolocation } from './useGeolocation';

type Success = PositionCallback;
type Failure = PositionErrorCallback;

function fakeGeolocation() {
  let success: Success | null = null;
  let failure: Failure | null | undefined = null;
  const geo = {
    getCurrentPosition: vi.fn((ok: Success, err?: Failure | null) => {
      success = ok;
      failure = err;
    }),
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
  } satisfies Geolocation;
  return {
    geo,
    succeed: (lat: number, lon: number) => success?.({ coords: { latitude: lat, longitude: lon } } as GeolocationPosition),
    fail: (code: 1 | 2 | 3) =>
      failure?.({ code, message: '', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError),
  };
}

describe('useGeolocation', () => {
  it('does nothing until the user asks', () => {
    const { geo } = fakeGeolocation();
    const { result } = renderHook(() => useGeolocation(vi.fn(), geo));
    expect(result.current.state).toEqual({ status: 'idle' });
    expect(geo.getCurrentPosition).not.toHaveBeenCalled();
  });

  it('reports coordinates and returns to idle on success', () => {
    const fake = fakeGeolocation();
    const onLocated = vi.fn();
    const { result } = renderHook(() => useGeolocation(onLocated, fake.geo));
    act(() => result.current.request());
    expect(result.current.state).toEqual({ status: 'locating' });
    act(() => fake.succeed(31.5, 74.3));
    expect(onLocated).toHaveBeenCalledWith({ lat: 31.5, lon: 74.3 });
    expect(result.current.state).toEqual({ status: 'idle' });
  });

  it.each([
    [1, 'denied', /turned off/],
    [2, 'unavailable', /couldn't work out/],
    [3, 'timeout', /took too long/],
  ] as const)('maps error code %i to "%s" with a readable message', (code, problem, message) => {
    const fake = fakeGeolocation();
    const onLocated = vi.fn();
    const { result } = renderHook(() => useGeolocation(onLocated, fake.geo));
    act(() => result.current.request());
    act(() => fake.fail(code));
    expect(result.current.state).toMatchObject({ status: 'error', problem, message: expect.stringMatching(message) });
    expect(onLocated).not.toHaveBeenCalled();
  });

  it('handles browsers without geolocation', () => {
    const { result } = renderHook(() => useGeolocation(vi.fn(), undefined));
    act(() => result.current.request());
    expect(result.current.state).toMatchObject({ status: 'error', problem: 'unsupported' });
  });

  it('ignores a position that arrives after unmount', () => {
    const fake = fakeGeolocation();
    const onLocated = vi.fn();
    const { result, unmount } = renderHook(() => useGeolocation(onLocated, fake.geo));
    act(() => result.current.request());
    unmount();
    fake.succeed(1, 2);
    expect(onLocated).not.toHaveBeenCalled();
  });
});
