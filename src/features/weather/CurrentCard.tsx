import { WeatherIcon } from '../../components/ui/WeatherIcon';
import type { City, WeatherData } from '../../lib/api/types';
import { formatHumidity, formatTemp, formatWind } from '../../lib/units/format';
import { formatCityContext } from '../search/formatCity';
import { SourceBadge } from './SourceBadge';
import { UpdatedAgo } from './UpdatedAgo';

interface CurrentCardProps {
  city: City;
  data: WeatherData;
}

export function CurrentCard({ city, data }: CurrentCardProps) {
  const { current } = data;
  const stats = [
    { label: 'Feels like', value: formatTemp(current.feelsLikeC) },
    { label: 'Humidity', value: formatHumidity(current.humidity) },
    { label: 'Wind', value: formatWind(current.windMs) },
  ];

  return (
    <section aria-labelledby="current-heading" className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <h2 id="current-heading" className="truncate text-xl font-semibold tracking-tight">
            {city.name}
          </h2>
          <p className="truncate text-sm text-muted">{formatCityContext(city)}</p>
        </div>
        <SourceBadge source={data.source} />
      </div>

      <div className="mt-6 flex items-center gap-4 sm:gap-6">
        <WeatherIcon condition={current.condition} size={72} className="shrink-0 sm:h-24 sm:w-24" />
        <div>
          <p className="text-6xl font-semibold tabular-nums leading-none tracking-tighter sm:text-7xl">
            {formatTemp(current.tempC)}
          </p>
          <p className="mt-2 text-base font-medium text-ink">{current.condition.label}</p>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-line pt-5">
        {stats.map((stat) => (
          <div key={stat.label} className="min-w-0">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">{stat.label}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <UpdatedAgo fetchedAt={data.fetchedAt} className="mt-5" />
    </section>
  );
}
