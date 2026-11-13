/** Placeholder block. Always decorative: pair it with an aria-busy region and a text status. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-lg bg-line/70 ${className}`} />;
}
