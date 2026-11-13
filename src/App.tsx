import { useCallback, useRef } from 'react';
import { CitySearch } from './features/search/CitySearch';
import { EmptyState } from './features/weather/EmptyState';
import { useWeather } from './features/weather/useWeather';
import { WeatherPanel } from './features/weather/WeatherPanel';

export function App() {
  const searchRef = useRef<HTMLInputElement>(null);
  const { state, load, retry } = useWeather();

  const focusSearch = useCallback(() => {
    searchRef.current?.focus();
    searchRef.current?.select();
  }, []);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
          <span className="text-base font-semibold tracking-tight">WeatherBoard</span>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <div className="max-w-xl">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Weather, at a glance</h1>
          <p className="mb-6 mt-2 text-sm text-muted">Current conditions and a 5-day forecast for any city.</p>
          <CitySearch onSelect={load} inputRef={searchRef} />
        </div>
        <div className="mt-8">
          {state.status === 'idle' ? (
            <EmptyState onPick={load} onEditSearch={focusSearch} />
          ) : (
            <WeatherPanel state={state} onRetry={retry} onEditSearch={focusSearch} />
          )}
        </div>
      </main>
    </div>
  );
}
