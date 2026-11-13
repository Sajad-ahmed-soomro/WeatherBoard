import type { RefObject } from 'react';
import { CloseIcon, InfoIcon } from '../../components/ui/icons';
import { Skeleton } from '../../components/ui/Skeleton';
import { WeatherIcon } from '../../components/ui/WeatherIcon';
import type { City } from '../../lib/api/types';
import { formatTemp } from '../../lib/units/format';
import { MAX_FAVOURITES } from './favourites';
import type { MiniTemp } from './miniTemps';

interface FavouritesPanelProps {
  favourites: readonly City[];
  activeId: string | null;
  persistent: boolean;
  tempFor: (id: string) => MiniTemp;
  onOpen: (city: City) => void;
  onRemove: (city: City) => void;
  headingRef: RefObject<HTMLHeadingElement>;
  className?: string;
}

function MiniTempView({ temp }: { temp: MiniTemp }) {
  if (temp.status === 'loading') {
    return (
      <>
        <Skeleton className="h-4 w-9" />
        <span className="sr-only">temperature loading</span>
      </>
    );
  }
  if (temp.status === 'error') {
    return (
      <span className="text-muted" title="Temperature unavailable right now">
        <span aria-hidden="true">–</span>
        <span className="sr-only">temperature unavailable</span>
      </span>
    );
  }
  const { current } = temp.snapshot;
  return (
    <span className="flex items-center gap-1 tabular-nums">
      <WeatherIcon condition={current.condition} size={20} />
      <span className="font-semibold">{formatTemp(current.tempC)}</span>
      <span className="sr-only">, {current.condition.label}</span>
    </span>
  );
}

/** Horizontal chips on small screens, a sidebar list from lg. Hidden on mobile while empty. */
export function FavouritesPanel({ favourites, activeId, persistent, tempFor, onOpen, onRemove, headingRef, className = '' }: FavouritesPanelProps) {
  const empty = favourites.length === 0;

  return (
    <section aria-labelledby="favourites-heading" className={`${empty ? 'hidden lg:block' : ''} ${className}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="favourites-heading" ref={headingRef} tabIndex={-1} className="text-sm font-semibold uppercase tracking-wide text-muted">
          Favourites
        </h2>
        <span className="text-xs tabular-nums text-muted">
          {favourites.length} of {MAX_FAVOURITES}
        </span>
      </div>

      {!persistent && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-warn/10 p-2 text-xs text-warn">
          <InfoIcon width={14} height={14} className="mt-px shrink-0" />
          This browser is blocking storage, so favourites will be forgotten when you close this tab.
        </p>
      )}

      {empty ? (
        <p className="mt-2 text-sm text-muted">Use the Favourite button on a city to keep up to {MAX_FAVOURITES} here for one-tap access.</p>
      ) : (
        <ul className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
          {favourites.map((city) => {
            const active = city.id === activeId;
            return (
              <li
                key={city.id}
                className={`flex shrink-0 items-stretch rounded-full border bg-surface shadow-sm lg:rounded-xl ${
                  active ? 'border-accent/50 ring-1 ring-accent/30' : 'border-line'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onOpen(city)}
                  aria-current={active || undefined}
                  className="flex min-h-touch min-w-0 items-center gap-3 rounded-l-full pl-4 pr-1 text-left text-sm hover:bg-canvas lg:flex-1 lg:justify-between lg:rounded-l-xl"
                >
                  <span className="truncate font-medium">{city.name}</span>
                  <MiniTempView temp={tempFor(city.id)} />
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(city)}
                  aria-label={`Remove ${city.name} from favourites`}
                  className="grid min-h-touch min-w-touch place-items-center rounded-r-full text-muted hover:bg-canvas hover:text-danger lg:rounded-r-xl"
                >
                  <CloseIcon width={16} height={16} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
