import { AlertIcon } from '../../components/ui/icons';
import type { AppError } from '../../lib/api/errors';
import type { City } from '../../lib/api/types';

interface WeatherErrorProps {
  city: City;
  error: AppError;
  onRetry: () => void;
  onEditSearch: () => void;
}

const TITLES: Record<AppError['kind'], string> = {
  network: "Can't reach the weather service",
  rate_limit: 'Weather requests are paused for a moment',
  not_found: 'No weather for this location',
  unknown: "Weather couldn't be loaded",
};

export function WeatherError({ city, error, onRetry, onEditSearch }: WeatherErrorProps) {
  const { action } = error;
  return (
    <div role="alert" className="rounded-2xl border border-danger/30 bg-surface p-5 shadow-sm sm:p-7">
      <div className="flex items-start gap-3">
        <AlertIcon className="mt-0.5 shrink-0 text-danger" />
        <div className="min-w-0">
          <h2 className="font-semibold">
            {TITLES[error.kind]} <span className="font-normal text-muted">· {city.name}</span>
          </h2>
          <p className="mt-1 text-sm text-muted">{error.message}</p>
          {action && (
            <button
              type="button"
              onClick={action.id === 'retry' ? onRetry : onEditSearch}
              className="mt-4 min-h-touch rounded-lg bg-ink px-4 text-sm font-medium text-surface hover:opacity-90"
            >
              {action.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
