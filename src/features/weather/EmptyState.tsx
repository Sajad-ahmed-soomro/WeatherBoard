import { useCallback } from 'react';
import { AlertIcon, LocateIcon, Spinner } from '../../components/ui/icons';
import type { City, Coordinates } from '../../lib/api/types';
import { POPULAR_CITIES, currentLocationCity } from './popularCities';
import { useGeolocation } from './useGeolocation';

interface EmptyStateProps {
  onPick: (city: City) => void;
  onEditSearch: () => void;
}

export function EmptyState({ onPick, onEditSearch }: EmptyStateProps) {
  const onLocated = useCallback((coords: Coordinates) => onPick(currentLocationCity(coords)), [onPick]);
  const { state, request } = useGeolocation(onLocated);
  const locating = state.status === 'locating';

  return (
    <section aria-labelledby="empty-heading" className="rounded-2xl border border-dashed border-line bg-surface/60 p-6 sm:p-10">
      <h2 id="empty-heading" className="text-lg font-semibold tracking-tight">
        Start with a city
      </h2>
      <p className="mt-1 max-w-prose text-sm text-muted">
        Pick a popular city, use your current location, or search above. WeatherBoard remembers the last city you viewed.
      </p>

      <ul className="mt-5 flex flex-wrap gap-2" aria-label="Popular cities">
        {POPULAR_CITIES.map((city) => (
          <li key={city.id}>
            <button
              type="button"
              onClick={() => onPick(city)}
              className="min-h-touch rounded-full border border-line bg-surface px-4 text-sm font-medium shadow-sm transition-colors hover:border-muted/40 hover:bg-canvas"
            >
              {city.name}
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-6 border-t border-line pt-5">
        <button
          type="button"
          onClick={request}
          disabled={locating}
          className="inline-flex min-h-touch items-center gap-2 rounded-lg px-1 text-sm font-medium text-accent hover:underline disabled:cursor-wait disabled:no-underline disabled:opacity-70"
        >
          {locating ? <Spinner /> : <LocateIcon />}
          {locating ? 'Finding your location…' : 'Use my current location'}
        </button>
        <p className="mt-1 text-xs text-muted">Your browser will ask first. Your coordinates are sent only to the weather service and remembered on this device as your last viewed place.</p>
        <div aria-live="polite">
          {state.status === 'error' && (
            <div className="mt-3 flex flex-col gap-2 rounded-lg bg-canvas p-3 sm:flex-row sm:items-center">
              <p className="flex flex-1 items-start gap-1.5 text-sm text-ink">
                <AlertIcon width={16} height={16} className="mt-0.5 shrink-0 text-danger" />
                {state.message}
              </p>
              {state.problem === 'denied' || state.problem === 'unsupported' ? (
                <button type="button" onClick={onEditSearch} className="min-h-touch shrink-0 rounded-lg border border-line bg-surface px-4 text-sm font-medium hover:bg-canvas">
                  Search for a city
                </button>
              ) : (
                <button type="button" onClick={request} className="min-h-touch shrink-0 rounded-lg border border-line bg-surface px-4 text-sm font-medium hover:bg-canvas">
                  Try again
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
