import { useId } from 'react';
import { AlertIcon } from '../../components/ui/icons';
import { Skeleton } from '../../components/ui/Skeleton';
import { LATE_WINDOW_MIN } from './schedule';
import type { Delivery } from './support';
import type { ReminderView } from './useReminder';

interface ReminderCardProps {
  view: ReminderView;
  canEnable: boolean;
  timeValue: string;
  timeError: string | null;
  saveError: string | null;
  onEnable: () => void;
  onDisable: () => void;
  onTimeChange: (value: string) => void;
  className?: string;
}

const LATE_HOURS = LATE_WINDOW_MIN / 60;

const DELIVERY_TEXT: Record<Delivery, string> = {
  background:
    'This browser can check in the background, so the reminder can arrive while WeatherBoard is closed. The browser picks the exact moment, so it may come a little late.',
  'while-open': `This browser can't wake WeatherBoard in the background. You'll get the reminder if the app is open at your chosen time, or when you next open it (up to ${LATE_HOURS} hours late).`,
};

const PLATFORMS: readonly { name: string; support: string }[] = [
  { name: 'Chrome or Edge, installed app (Android, Windows, macOS)', support: 'In the background, around your chosen time' },
  { name: 'Chrome or Edge in a browser tab', support: 'Only while WeatherBoard is open' },
  { name: 'Safari on iPhone or iPad', support: 'Add to Home Screen first; then only while the app is open' },
  { name: 'Safari on Mac, Firefox', support: 'Only while WeatherBoard is open' },
];

function TimeField({ value, error, onChange }: { value: string; error: string | null; onChange: (value: string) => void }) {
  const id = useId();
  const errorId = useId();
  return (
    <div className="mt-4">
      <label htmlFor={id} className="block text-sm font-medium">
        Reminder time
      </label>
      <input
        id={id}
        type="time"
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`mt-1 min-h-touch w-full rounded-lg border bg-surface px-3 text-base tabular-nums ${error ? 'border-danger' : 'border-line'}`}
      />
      <p id={errorId} aria-live="polite" className="mt-1 text-xs text-danger empty:hidden">
        {error}
      </p>
    </div>
  );
}

export function ReminderCard({ view, canEnable, timeValue, timeError, saveError, onEnable, onDisable, onTimeChange, className = '' }: ReminderCardProps) {
  const hintId = useId();

  return (
    <section aria-labelledby="reminder-heading" className={`rounded-2xl border border-line bg-surface p-5 shadow-sm ${className}`}>
      <h2 id="reminder-heading" className="text-sm font-semibold uppercase tracking-wide text-muted">
        Daily reminder
      </h2>

      <div aria-live="polite">
        {view.kind === 'loading' && (
          <div aria-busy="true" className="mt-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="mt-2 h-11 w-full" />
          </div>
        )}

        {view.kind === 'unsupported' && (
          <p className="mt-2 text-sm text-muted">
            This browser can't show notifications. On iPhone or iPad, add WeatherBoard to your Home Screen and open it from there. Everything else works as
            normal.
          </p>
        )}

        {view.kind === 'denied' && (
          <p className="mt-2 text-sm text-muted">
            Notifications are blocked for this site. To get a daily reminder, allow notifications for WeatherBoard in your browser's site settings, then come
            back here.
          </p>
        )}

        {view.kind === 'off' && (
          <>
            <p className="mt-2 text-sm text-muted">Get today's forecast once a day, around your chosen time.</p>
            <TimeField value={timeValue} error={timeError} onChange={onTimeChange} />
            <button
              type="button"
              onClick={canEnable ? onEnable : undefined}
              aria-disabled={!canEnable || undefined}
              aria-describedby={canEnable ? undefined : hintId}
              className={`mt-3 min-h-touch w-full rounded-lg px-4 text-sm font-medium ${canEnable ? 'bg-ink text-surface hover:opacity-90' : 'cursor-not-allowed bg-line text-muted'}`}
            >
              Turn on reminder
            </button>
            {!canEnable && (
              <p id={hintId} className="mt-1 text-xs text-muted">
                Open a city first. The reminder uses the city you're viewing.
              </p>
            )}
          </>
        )}

        {view.kind === 'on' && (
          <>
            <p className="mt-2 text-sm">
              On: around <span className="font-semibold tabular-nums">{view.time}</span> each day for <span className="font-semibold">{view.cityName}</span>.
            </p>
            <TimeField value={timeValue} error={timeError} onChange={onTimeChange} />
            <p className="mt-3 text-xs text-muted">{DELIVERY_TEXT[view.delivery]}</p>
            <button type="button" onClick={onDisable} className="mt-3 min-h-touch w-full rounded-lg border border-line px-4 text-sm font-medium hover:bg-canvas">
              Turn off reminder
            </button>
          </>
        )}

        {saveError && (
          <p role="alert" className="mt-3 flex items-start gap-1.5 text-xs text-danger">
            <AlertIcon width={14} height={14} className="mt-px shrink-0" />
            {saveError}
          </p>
        )}
      </div>

      <details className="mt-4 text-xs text-muted">
        <summary className="flex min-h-touch cursor-pointer items-center font-medium text-ink">Where reminders work</summary>
        <dl className="space-y-2">
          {PLATFORMS.map((p) => (
            <div key={p.name}>
              <dt className="font-medium text-ink">{p.name}</dt>
              <dd>{p.support}</dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  );
}
