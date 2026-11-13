import { InfoIcon } from '../../components/ui/icons';
import { Tooltip } from '../../components/ui/Tooltip';
import type { WeatherSource } from '../../lib/api/types';

export const BACKUP_SOURCE_TOOLTIP = 'Backup source, conditions may differ slightly.';

/** Renders nothing for the primary source; a quiet badge when Open-Meteo is serving the data. */
export function SourceBadge({ source }: { source: WeatherSource }) {
  if (source !== 'open-meteo') return null;
  return (
    <Tooltip content={BACKUP_SOURCE_TOOLTIP}>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-canvas px-2.5 py-1 text-xs font-medium text-muted">
        <InfoIcon width={14} height={14} />
        Using backup source
      </span>
    </Tooltip>
  );
}
