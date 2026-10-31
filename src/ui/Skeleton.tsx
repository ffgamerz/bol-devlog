import { cn } from '@/lib/cn'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('relative overflow-hidden rounded-md bg-surface-3', className)}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  )
}

/** Sized like a real video row: thumb + two text lines + chips. */
export function RowSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="divide-y divide-border">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex gap-3 px-4 py-3">
          <Skeleton className="h-16 w-12 shrink-0 rounded-md sm:h-14 sm:w-24" />
          <div className="min-w-0 flex-1 space-y-2 py-0.5">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-2/5" />
            <div className="flex gap-1.5"><Skeleton className="h-6 w-16" /><Skeleton className="h-6 w-16" /></div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function StatSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div aria-busy="true" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-lg border border-border bg-surface p-4">
          <Skeleton className="h-3 w-1/2" /><Skeleton className="mt-3 h-7 w-1/3" />
        </div>
      ))}
    </div>
  )
}
