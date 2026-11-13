const MINUTE = 60_000;

/** "Updated just now" / "Updated 5 min ago" / "Updated 2 hr ago" / "Updated on 12 Nov". */
export function formatUpdatedAgo(fetchedAt: number, now: number): string {
  const minutes = Math.floor(Math.max(0, now - fetchedAt) / MINUTE);
  if (minutes < 1) return 'Updated just now';
  if (minutes < 60) return `Updated ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours} hr ago`;
  return `Updated on ${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(fetchedAt)}`;
}

/** Full timestamp for a tooltip / <time> title, in the viewer's own timezone. */
export function formatTimestamp(epochMs: number): string {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(epochMs);
}
