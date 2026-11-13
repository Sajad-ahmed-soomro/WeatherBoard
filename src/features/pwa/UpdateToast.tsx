interface UpdateToastProps {
  needRefresh: boolean;
  offlineReady: boolean;
  onUpdate: () => void;
  onDismiss: () => void;
}

/** Bottom toast for app-level news. A live region, so it is announced without stealing focus. */
export function UpdateToast({ needRefresh, offlineReady, onUpdate, onDismiss }: UpdateToastProps) {
  const visible = needRefresh || offlineReady;
  return (
    <div role="status" className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-4 sm:justify-end">
      {visible && (
        <div className="pointer-events-auto flex w-full max-w-sm flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-line bg-surface p-3 pl-4 shadow-lg">
          <p className="flex-1 text-sm">{needRefresh ? 'A new version of WeatherBoard is ready.' : 'WeatherBoard is ready to work offline.'}</p>
          <div className="flex gap-2">
            {needRefresh && (
              <button type="button" onClick={onUpdate} className="min-h-touch rounded-lg bg-ink px-3 text-sm font-medium text-surface hover:opacity-90">
                Reload
              </button>
            )}
            <button type="button" onClick={onDismiss} className="min-h-touch rounded-lg border border-line px-3 text-sm font-medium hover:bg-canvas">
              {needRefresh ? 'Later' : 'OK'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
