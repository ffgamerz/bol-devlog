import { cn } from '@/lib/cn'

/** Small teal ring "4/6". Full = success colour. */
export function ProgressRing({ value, max, size = 32, className }: { value: number; max: number; size?: number; className?: string }) {
  const r = (size - 4) / 2, c = 2 * Math.PI * r, pct = max ? value / max : 0
  const full = value >= max
  return (
    <span role="img" aria-label={`${value} of ${max} platforms uploaded`} className={cn('relative inline-grid shrink-0 place-items-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={3} className="stroke-surface-3" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={3} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          className={cn('transition-[stroke-dashoffset] duration-250 ease-out', full ? 'stroke-success' : 'stroke-accent')} />
      </svg>
      <span className="tnum absolute text-[10px] font-semibold">{value}/{max}</span>
    </span>
  )
}
