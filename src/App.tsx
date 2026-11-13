import { useState } from 'react';
import { CitySearch } from './features/search/CitySearch';
import { formatCityLabel } from './features/search/formatCity';
import type { City } from './lib/api/types';

export function App() {
  const [city, setCity] = useState<City | null>(null);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
          <span className="text-base font-semibold tracking-tight">WeatherBoard</span>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <div className="max-w-xl">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Find a city</h1>
          <p className="mb-6 mt-2 text-sm text-muted">Search for any city to see current conditions and a 5-day forecast.</p>
          <CitySearch onSelect={setCity} />
          {city && (
            <p className="mt-4 text-sm text-muted">
              Selected <span className="font-medium text-ink">{formatCityLabel(city)}</span>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
