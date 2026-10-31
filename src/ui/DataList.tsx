import { useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { Check, ChevronRight, Rows2, Rows3, Rows4, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from './Button'
import { EmptyState, ErrorState, type EmptyVariant } from './States'
import { RowSkeleton } from './Skeleton'

const INTERACTIVE = 'button, a, input, textarea, select, label, [role="button"], [role="checkbox"], [data-no-row-open]'

/** Whole-row tap opens details; taps on inner controls keep their own action; text selection doesn't open. */
export function rowOpenProps(open: () => void) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    onClick: (e: MouseEvent<HTMLElement>) => {
      const hit = (e.target as HTMLElement).closest(INTERACTIVE)
      if (hit && hit !== e.currentTarget) return
      if (window.getSelection()?.toString()) return
      open()
    },
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.target !== e.currentTarget) return
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() }
    },
  }
}

export type Density = 'compact' | 'default' | 'comfortable'
const densityRow: Record<Density, string> = {
  compact: 'min-h-9 py-1.5 gap-2.5',
  default: 'min-h-12 py-2.5 gap-3',
  comfortable: 'min-h-15 py-3.5 gap-3',
}

export type DataListProps<T> = {
  items: T[] | undefined
  getKey: (item: T) => string
  renderRow: (item: T) => ReactNode
  onOpen?: (item: T) => void
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  empty: { variant?: EmptyVariant; title: string; message?: ReactNode; action?: { label: string; onClick: () => void } }
  hasMore?: boolean
  loadingMore?: boolean
  onLoadMore?: () => void
  /** Optional bulk selection. Checkboxes show only in select mode (or while ≥1 row is selected);
   *  desktop also reveals them on row hover. Long-press a row on touch to enter select mode. */
  selected?: Set<string>
  onToggleSelect?: (key: string) => void
  selectMode?: boolean
  /** Minimum row height: compact 36 / default 48 / comfortable 60 px (thumbs and tiles scale with it) */
  density?: Density
  onSelectModeChange?: (on: boolean) => void
  className?: string
  'aria-label'?: string
}

/**
 * Mobile-first list: rows are cards on phones and dense rows on desktop, never a sideways-scrolling table.
 * Handles loading (skeleton), error (retry), empty (4 variants), load-more and optional selection.
 */
export function DataList<T>(p: DataListProps<T>) {
  if (p.loading && !p.items?.length) return <div className="rounded-lg border border-border bg-surface"><RowSkeleton /></div>
  if (p.error) return <ErrorState message={p.error} onRetry={p.onRetry} />
  if (!p.items?.length) return <EmptyState {...p.empty} />
  return <Rows {...p} />
}

function Rows<T>(p: DataListProps<T>) {
  const selecting = !!p.onToggleSelect && (!!p.selectMode || (p.selected?.size ?? 0) > 0)
  const press = useRef<{ t?: number; fired?: boolean }>({})
  const startPress = (key: string) => {
    if (!p.onToggleSelect || selecting) return
    press.current.fired = false
    press.current.t = window.setTimeout(() => {
      press.current.fired = true
      p.onSelectModeChange?.(true); p.onToggleSelect!(key)
      navigator.vibrate?.(10)
    }, 500)
  }
  const endPress = () => window.clearTimeout(press.current.t)
  return (
    <div className={p.className}>
      <ul aria-label={p['aria-label']} data-density={p.density ?? 'default'} aria-multiselectable={p.onToggleSelect ? true : undefined}
        className="divide-y divide-border overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface">
        {p.items!.map((item) => {
          const key = p.getKey(item)
          const isSel = p.selected?.has(key) ?? false
          const open = () => {
            if (press.current.fired) { press.current.fired = false; return }
            if (selecting && p.onToggleSelect) p.onToggleSelect(key); else p.onOpen?.(item)
          }
          return (
            <li key={key}
              {...(p.onOpen || selecting ? rowOpenProps(open) : {})}
              onPointerDown={(e) => { if (e.pointerType === 'touch') startPress(key) }}
              onPointerUp={endPress} onPointerLeave={endPress} onPointerCancel={endPress}
              onContextMenu={(e) => { if (p.onToggleSelect && e.nativeEvent instanceof PointerEvent && e.nativeEvent.pointerType === 'touch') e.preventDefault() }}
              aria-selected={p.onToggleSelect ? isSel : undefined}
              className={cn(
                'group relative flex min-w-0 items-start px-4 outline-none', densityRow[p.density ?? 'default'], ' transition-[box-shadow,color,background-color] duration-150 ease-out',
                (p.onOpen || selecting) && 'cursor-pointer hover:shadow-[inset_0_0_0_1px_var(--c-border-strong)] focus-visible:shadow-[inset_0_0_0_2px_var(--c-accent)] active:bg-surface-2',
                isSel && 'bg-accent-soft',
              )}>
              {p.onToggleSelect && (
                <button type="button" role="checkbox" aria-checked={isSel} aria-label="Select row"
                  onClick={() => p.onToggleSelect!(key)}
                  className={cn('-m-2 grid size-11 shrink-0 place-items-center rounded-md lg:size-9',
                    !selecting && 'hidden lg:grid lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100')}>
                  <span className={cn('grid size-5 place-items-center rounded border-2 transition-colors', isSel ? 'border-accent bg-accent text-accent-fg' : 'border-border-strong')}>
                    {isSel && <Check className="size-3.5" strokeWidth={3} />}
                  </span>
                </button>
              )}
              <div className="min-w-0 flex-1">{p.renderRow(item)}</div>
              {p.onOpen && !selecting && <ChevronRight aria-hidden className="mt-1 hidden size-4 shrink-0 text-faint lg:block" />}
            </li>
          )
        })}
      </ul>
      {p.hasMore && (
        <div className="flex justify-center py-4">
          <Button intent="utility" loading={p.loadingMore} loadingText="Loading…" onClick={p.onLoadMore}>Load more</Button>
        </div>
      )}
    </div>
  )
}

/** Segmented density control for list headers. */
export function DensityToggle({ value, onChange }: { value: Density; onChange: (d: Density) => void }) {
  // Icon-only (label in aria-label + tooltip) so it fits next to the list count and actions.
  const opts: [Density, string, LucideIcon][] = [['compact', 'Compact', Rows4], ['default', 'Default', Rows3], ['comfortable', 'Comfortable', Rows2]]
  return (
    <div role="radiogroup" aria-label="Row density" className="inline-flex rounded-full border border-border bg-surface-2 p-0.5">
      {opts.map(([v, l, Icon]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} aria-label={l} title={`${l} rows`} onClick={() => onChange(v)}
          className={cn('grid size-8 place-items-center rounded-full transition-colors [@media(pointer:coarse)]:size-10',
            value === v ? 'bg-surface text-fg shadow-1' : 'text-muted hover:text-fg')}><Icon aria-hidden className="size-4" /></button>
      ))}
    </div>
  )
}

/** "Select" / "Done" toggle for list headers (the phone way into select mode besides long-press). */
export function SelectModeButton({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return <Button size="sm" intent={on ? 'cancel' : 'ghost'} aria-pressed={on} onClick={() => onChange(!on)}>{on ? "Exit select" : "Select"}</Button>
}

/** Sticky bar shown while rows are selected (bulk actions). */
export function BulkBar({ count, onClear, children }: { count: number; onClear: () => void; children: ReactNode }) {
  if (!count) return null
  return (
    <div role="toolbar" aria-label="Bulk actions"
      className="fixed inset-x-3 z-30 flex items-center gap-2 rounded-xl border border-border bg-surface-3 px-3 py-2 shadow-3 animate-fade-up bottom-[calc(var(--nav-h)+12px+env(safe-area-inset-bottom))] lg:inset-x-auto lg:bottom-6 lg:left-1/2 lg:-translate-x-1/2">
      <span className="tnum text-sm font-semibold">{count}</span><span className="text-sm text-muted">selected</span>
      <div className="ml-auto flex items-center gap-2">{children}<Button intent="cancel" size="sm" onClick={onClear}>Clear</Button></div>
    </div>
  )
}
