import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Toggle chip for filters. 36px on pointer devices, a full 44px tall on touch screens. */
export function FilterChip({ active, onClick, children, onRemove, count, removeLabel, tone, title, className }: {
  active?: boolean; onClick?: () => void; children: ReactNode; onRemove?: () => void; count?: number; removeLabel?: string
  /** 'info' = the status token for Scheduled (blue) instead of the teal accent. */ tone?: 'info' | 'reupload' | 'planned'; title?: string
  /** Extra classes for the chip (e.g. a taller row on phones). */ className?: string
}) {
  return (
    <span className={cn('relative inline-flex h-9 shrink-0 items-center rounded-full border text-sm [@media(pointer:coarse)]:h-11 font-medium transition-colors duration-150',
      active ? (tone === 'info' ? 'border-info bg-info-soft text-info' : tone === 'planned' ? 'border-planned bg-planned-soft text-planned-text' : tone === 'reupload' ? 'border-reupload bg-reupload-soft text-reupload' : 'border-accent bg-accent-soft text-accent-text') : tone === 'reupload' ? 'border-dashed border-reupload/60 bg-surface text-reupload hover:border-reupload' : 'border-border bg-surface text-fg hover:border-border-strong', className)}>
      <button type="button" aria-pressed={active} onClick={onClick} title={title}
        className="inline-flex h-full items-center gap-1.5 rounded-full px-3.5 [@media(pointer:coarse)]:-my-px [@media(pointer:coarse)]:h-[calc(100%+2px)] max-sm:-my-px max-sm:h-[calc(100%+2px)]">
        {children}
        {count !== undefined && <span className="num text-xs text-muted">{count}</span>}
      </button>
      {onRemove && (
        <button type="button" aria-label={removeLabel ?? 'Remove filter'} onClick={onRemove} className="relative z-10 -ml-1 mr-1 grid size-7 place-items-center max-sm:-my-1 max-sm:mr-0 max-sm:size-11 rounded-full hover:bg-surface-3 before:absolute before:-inset-2 before:rounded-full [@media(pointer:coarse)]:before:content-['']">
          <X className="size-3.5" />
        </button>
      )}
    </span>
  )
}

/** Horizontal chip row that wraps on phones (no sideways overflow). */
export const ChipRow = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>
)

type Tone = 'neutral' | 'accent' | 'success' | 'danger' | 'info' | 'warning' | 'planned'
const tones: Record<Tone, string> = {
  neutral: 'bg-surface-3 text-muted',
  accent: 'bg-accent-soft text-accent-text',
  success: 'bg-success-soft text-success',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  warning: 'bg-warning-soft text-warning',
  planned: 'bg-planned-soft text-planned-text',
}
export const Badge = ({ tone = 'neutral', children, className, title }: { tone?: Tone; children: ReactNode; className?: string; title?: string }) => (
  <span title={title} className={cn('inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-semibold', tones[tone], className)}>{children}</span>
)
