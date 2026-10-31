import { Search, X } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Prominent title search: 48px, teal border + glow, teal magnifier, 44px clear, optional "/" hint and spinner. Sticky by default. */
export function SearchBar({ id, label = 'Search video title', placeholder = 'Search video title…', value, onChange, onClear, busy, hint, sticky = true, stickyTop = 'top-0', surface = 'bg-bg', className, testId }: {
  id?: string; label?: string; placeholder?: string; value: string; onChange: (v: string) => void; onClear?: () => void
  busy?: boolean; hint?: string; sticky?: boolean; stickyTop?: string; /** wrapper background = the container's surface token, so no box shows */ surface?: string; className?: string; testId?: string
}) {
  return (
    <div data-testid={testId} className={cn(sticky && cn('sticky z-20 -mx-2 rounded-[var(--radius-lg)] px-2 py-2', surface, stickyTop), !sticky && 'relative', 'min-w-0 flex-1', className)}>
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-accent-text" />
        <input id={id} name="q" type="search" aria-label={label} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} enterKeyHint="search" onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
          className="h-12 w-full rounded-[var(--radius-lg)] border-2 border-accent/60 bg-surface pl-11 pr-11 text-[16px] font-medium shadow-[0_0_0_4px_color-mix(in_srgb,var(--c-accent)_14%,transparent)] placeholder:font-normal placeholder:text-muted hover:border-accent focus:border-accent focus:shadow-[0_0_0_5px_color-mix(in_srgb,var(--c-accent)_28%,transparent)] focus:outline-none [&::-webkit-search-cancel-button]:hidden" />
        {!value && hint && <kbd aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-border-strong bg-surface-2 px-1.5 text-xs font-semibold text-muted">{hint}</kbd>}
        {busy && <span role="status" aria-label="Searching" className="pointer-events-none absolute right-12 top-1/2 size-4 -translate-y-1/2 animate-spin rounded-full border-2 border-border-strong border-t-accent" />}
        {value && <button type="button" aria-label="Clear search" onClick={() => (onClear ? onClear() : onChange(''))} className="absolute right-1 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-md text-muted hover:text-fg"><X className="size-5" /></button>}
      </div>
    </div>
  )
}
