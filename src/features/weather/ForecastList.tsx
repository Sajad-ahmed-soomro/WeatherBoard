import { WeatherIcon } from '../../components/ui/WeatherIcon';
import type { WeatherData } from '../../lib/api/types';
import { cityLocalDate } from '../../lib/time/cityTime';
import { formatDay, formatTemp } from '../../lib/units/format';

/** Position of a day's min–max inside the whole week's range, as percentages. */
function rangeBar(min: number, max: number, weekMin: number, weekMax: number) {
  const span = Math.max(weekMax - weekMin, 1);
  return { left: `${((min - weekMin) / span) * 100}%`, width: `${Math.max(((max - min) / span) * 100, 4)}%` };
}

export function ForecastList({ data }: { data: WeatherData }) {
  const today = cityLocalDate(Math.floor(data.current.observedAt / 1000), data.utcOffsetSec);
  const weekMin = Math.min(...data.daily.map((d) => d.minC));
  const weekMax = Math.max(...data.daily.map((d) => d.maxC));

  return (
    <section aria-labelledby="forecast-heading" className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-7">
      <h2 id="forecast-heading" className="text-sm font-semibold uppercase tracking-wide text-muted">
        {data.daily.length}-day forecast
      </h2>
      <ol className="mt-3 divide-y divide-line">
        {data.daily.map((day) => {
          const label = formatDay(day.date, today);
          const bar = rangeBar(day.minC, day.maxC, weekMin, weekMax);
          return (
            <li key={day.date} className="grid min-h-[56px] grid-cols-[3.5rem_2.25rem_1fr] items-center gap-3 py-2 sm:grid-cols-[4rem_2.5rem_minmax(0,9rem)_1fr]">
              <span className="text-sm font-medium">
                <abbr title={label.long} className="no-underline">
                  {label.short}
                </abbr>
              </span>
              <WeatherIcon condition={day.condition} size={32} />
              <span className="hidden truncate text-sm text-muted sm:block">{day.condition.label}</span>
              <span className="flex items-center gap-3 text-sm tabular-nums">
                <span className="sr-only">
                  {day.condition.label}. Low {formatTemp(day.minC)}, high {formatTemp(day.maxC)}.
                </span>
                <span aria-hidden="true" className="w-9 text-right text-muted">
                  {formatTemp(day.minC)}
                </span>
                <span aria-hidden="true" className="relative h-1.5 flex-1 rounded-full bg-line">
                  <span
                    className="absolute inset-y-0 rounded-full bg-gradient-to-r from-sky-400 to-amber-400"
                    style={{ left: bar.left, width: bar.width }}
                  />
                </span>
                <span aria-hidden="true" className="w-9 font-semibold">
                  {formatTemp(day.maxC)}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
