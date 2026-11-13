import { formatTemp } from '../../lib/units/format';
import { CurrentCard } from './CurrentCard';
import { ForecastList } from './ForecastList';
import type { WeatherState } from './useWeather';
import { WeatherError } from './WeatherError';
import { WeatherSkeleton } from './WeatherSkeleton';

interface WeatherPanelProps {
  state: Exclude<WeatherState, { status: 'idle' }>;
  onRetry: () => void;
  onEditSearch: () => void;
}

function announce(state: WeatherPanelProps['state']): string {
  switch (state.status) {
    case 'loading':
      return `Loading weather for ${state.city.name}…`;
    case 'success':
      return `Showing weather for ${state.city.name}: ${formatTemp(state.data.current.tempC)}, ${state.data.current.condition.label}.`;
    case 'error':
      return '';
  }
}

export function WeatherPanel({ state, onRetry, onEditSearch }: WeatherPanelProps) {
  return (
    <div aria-busy={state.status === 'loading'}>
      <p className="sr-only" aria-live="polite">
        {announce(state)}
      </p>
      {state.status === 'loading' && <WeatherSkeleton />}
      {state.status === 'error' && (
        <WeatherError city={state.city} error={state.error} onRetry={onRetry} onEditSearch={onEditSearch} />
      )}
      {state.status === 'success' && (
        <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
          <CurrentCard city={state.city} data={state.data} />
          <ForecastList data={state.data} />
        </div>
      )}
    </div>
  );
}
