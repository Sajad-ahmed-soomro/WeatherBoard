import { useCallback, useMemo, useRef } from 'react';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import { FavouritesPanel } from './features/favourites/FavouritesPanel';
import { FavouriteToggle } from './features/favourites/FavouriteToggle';
import type { LatestViewed } from './features/favourites/miniTemps';
import { useFavourites } from './features/favourites/useFavourites';
import { useMiniTemps } from './features/favourites/useMiniTemps';
import { InstallButton } from './features/pwa/InstallButton';
import { OfflineBanner } from './features/pwa/OfflineBanner';
import { UpdateToast } from './features/pwa/UpdateToast';
import { useAppUpdate } from './features/pwa/useAppUpdate';
import { useInstallPrompt } from './features/pwa/useInstallPrompt';
import { useOnlineStatus } from './features/pwa/useOnlineStatus';
import { useWeatherCacheUpdates } from './features/pwa/useWeatherCacheUpdates';
import { CitySearch } from './features/search/CitySearch';
import { EmptyState } from './features/weather/EmptyState';
import { useWeather } from './features/weather/useWeather';
import { WeatherPanel } from './features/weather/WeatherPanel';
import type { City, Coordinates } from './lib/api/types';
import { sameCoords } from './lib/pwa/weatherCacheRules';

export function App() {
  const searchRef = useRef<HTMLInputElement>(null);
  const favouritesHeadingRef = useRef<HTMLHeadingElement>(null);
  const { state, load, retry, refresh } = useWeather();
  const favourites = useFavourites();
  const { isFavourite, atLimit, add, requestRemove } = favourites;

  const latest = useMemo<LatestViewed | null>(
    () =>
      state.status === 'success'
        ? { cityId: state.city.id, snapshot: { source: state.data.source, fetchedAt: state.data.fetchedAt, current: state.data.current } }
        : null,
    [state],
  );
  const { tempFor } = useMiniTemps(favourites.favourites, { latest });

  const appUpdate = useAppUpdate();
  const installPrompt = useInstallPrompt();

  const onReconnect = useCallback(() => {
    if (state.status === 'error') retry();
    else refresh();
  }, [state.status, retry, refresh]);
  const online = useOnlineStatus(onReconnect);

  const onCacheUpdated = useCallback(
    (coords: Coordinates) => {
      if (state.status === 'success' && sameCoords(coords, state.city)) refresh();
    },
    [state, refresh],
  );
  useWeatherCacheUpdates(onCacheUpdated);

  const focusSearch = useCallback(() => {
    searchRef.current?.focus();
    searchRef.current?.select();
  }, []);

  const renderFavouriteToggle = useCallback(
    (city: City) => (
      <FavouriteToggle
        city={city}
        saved={isFavourite(city.id)}
        atLimit={atLimit}
        onAdd={add}
        onRemove={requestRemove}
      />
    ),
    [isFavourite, atLimit, add, requestRemove],
  );

  const activeId = state.status === 'idle' ? null : state.city.id;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <span className="text-base font-semibold tracking-tight">WeatherBoard</span>
          <InstallButton canInstall={installPrompt.canInstall} onInstall={() => void installPrompt.install()} />
        </div>
      </header>
      <OfflineBanner
        online={online}
        showing={state.status === 'success' ? { cityName: state.city.name, fetchedAt: state.data.fetchedAt } : null}
      />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <div className="max-w-xl">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Weather, at a glance</h1>
          <p className="mb-6 mt-2 text-sm text-muted">Current conditions and a 5-day forecast for any city.</p>
          <CitySearch onSelect={load} inputRef={searchRef} />
        </div>
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
          <FavouritesPanel
            favourites={favourites.favourites}
            activeId={activeId}
            persistent={favourites.persistent}
            tempFor={tempFor}
            onOpen={load}
            onRemove={requestRemove}
            headingRef={favouritesHeadingRef}
            className="lg:sticky lg:top-6"
          />
          <div className="min-w-0">
            {state.status === 'idle' ? (
              <EmptyState onPick={load} onEditSearch={focusSearch} />
            ) : (
              <WeatherPanel state={state} onRetry={retry} onEditSearch={focusSearch} renderAction={renderFavouriteToggle} />
            )}
          </div>
        </div>
      </main>
      <ConfirmDialog
        open={favourites.pendingRemoval !== null}
        title={`Remove ${favourites.pendingRemoval?.name ?? 'city'} from favourites?`}
        description="You can add it again any time from its weather card."
        confirmLabel="Remove"
        onConfirm={favourites.confirmRemove}
        onCancel={favourites.cancelRemove}
        fallbackFocus={favouritesHeadingRef}
      />
      <UpdateToast
        needRefresh={appUpdate.needRefresh}
        offlineReady={appUpdate.offlineReady}
        onUpdate={() => void appUpdate.update()}
        onDismiss={appUpdate.dismiss}
      />
    </div>
  );
}
