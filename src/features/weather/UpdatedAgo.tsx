import { formatTimestamp, formatUpdatedAgo } from '../../lib/time/relative';
import { useNow } from '../../lib/time/useNow';

export function UpdatedAgo({ fetchedAt, className = '' }: { fetchedAt: number; className?: string }) {
  const now = useNow();
  return (
    <p className={`text-xs text-muted ${className}`}>
      <time dateTime={new Date(fetchedAt).toISOString()} title={formatTimestamp(fetchedAt)}>
        {formatUpdatedAgo(fetchedAt, now)}
      </time>
    </p>
  );
}
