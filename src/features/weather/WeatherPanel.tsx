import type { ReactNode } from 'react';
import type { City } from '../../lib/api/types';
import { useTempFormat } from '../preferences/units';
import { CurrentCard } from './CurrentCard';
import { ForecastList } from './ForecastList';
import type { WeatherState } from './useWeather';
import { WeatherError } from './WeatherError';
import { WeatherSkeleton } from './WeatherSkeleton';

interface WeatherPanelProps {
  state: Exclude<WeatherState, { status: 'idle' }>;
  onRetry: () => void;
  onEditSearch: () => void;
  renderAction?: (city: City) => ReactNode;
}

function announce(state: WeatherPanelProps['state'], formatTemp: (celsius: number) => string): string {
  switch (state.status) {
    case 'loading':
      return `Loading weather for ${state.city.name}…`;
    case 'success':
      return `Showing weather for ${state.city.name}: ${formatTemp(state.data.current.tempC)}, ${state.data.current.condition.label}.`;
    case 'error':
      return '';
  }
}

export function WeatherPanel({ state, onRetry, onEditSearch, renderAction }: WeatherPanelProps) {
  const formatTemp = useTempFormat();
  return (
    <div aria-busy={state.status === 'loading'}>
      <p className="sr-only" aria-live="polite">
        {announce(state, formatTemp)}
      </p>
      {state.status === 'loading' && <WeatherSkeleton />}
      {state.status === 'error' && (
        <WeatherError city={state.city} error={state.error} onRetry={onRetry} onEditSearch={onEditSearch} />
      )}
      {state.status === 'success' && (
        <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
          <CurrentCard city={state.city} data={state.data} action={renderAction?.(state.city)} />
          <ForecastList data={state.data} />
        </div>
      )}
    </div>
  );
}
