import { Skeleton } from '../../components/ui/Skeleton';

/** Mirrors the loaded layout so nothing jumps when data arrives. */
export function WeatherSkeleton() {
  return (
    <div aria-hidden="true" className="grid gap-4 lg:grid-cols-2 lg:gap-6">
      <div className="rounded-2xl border border-line bg-surface p-5 sm:p-7">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-2 h-4 w-28" />
        <div className="mt-6 flex items-center gap-4 sm:gap-6">
          <Skeleton className="h-[72px] w-[72px] rounded-full sm:h-24 sm:w-24" />
          <div>
            <Skeleton className="h-14 w-28 sm:h-16" />
            <Skeleton className="mt-3 h-4 w-24" />
          </div>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-3 border-t border-line pt-5">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-2 h-5 w-12" />
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-line bg-surface p-5 sm:p-7">
        <Skeleton className="h-4 w-32" />
        <div className="mt-3 divide-y divide-line">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex min-h-[56px] items-center gap-3 py-2">
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-1.5 flex-1 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
