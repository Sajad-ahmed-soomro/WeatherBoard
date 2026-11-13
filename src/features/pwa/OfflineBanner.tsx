import { InfoIcon } from '../../components/ui/icons';
import { formatUpdatedAgo } from '../../lib/time/relative';
import { useNow } from '../../lib/time/useNow';

interface OfflineBannerProps {
  online: boolean;
  /** What is on screen while offline, if anything. */
  showing: { cityName: string; fetchedAt: number } | null;
}

/** Always-mounted live region; it only has content while offline. */
export function OfflineBanner({ online, showing }: OfflineBannerProps) {
  const now = useNow();
  return (
    <div role="status" className={online ? '' : 'border-b border-warn/20 bg-warn/10'}>
      {!online && (
        <p className="mx-auto flex max-w-6xl items-start gap-2 px-4 py-2.5 text-sm text-warn sm:px-6">
          <InfoIcon width={16} height={16} className="mt-0.5 shrink-0" />
          <span>
            <span className="font-semibold">You're offline.</span>{' '}
            {showing
              ? `Showing saved weather for ${showing.cityName}, ${formatUpdatedAgo(showing.fetchedAt, now).toLowerCase()}.`
              : 'Your last viewed city is available offline; other cities need a connection.'}
          </span>
        </p>
      )}
    </div>
  );
}
