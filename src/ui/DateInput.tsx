import { useId, useRef } from 'react'
import { useMediaQuery } from '@/lib/hooks'
import { CalendarDays, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { APP_TZ, formatDate } from '@/lib/date'

const todayMY = () => new Intl.DateTimeFormat('en-CA', { timeZone: APP_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

/**
 * Date field that always shows "23 Oct 2026" (never the browser's US mm/dd/yyyy).
 * Value is ISO YYYY-MM-DD. Tapping opens the native picker (good on phones); optional Clear and Today.
 */
export function DateInput({ label, value, onChange, placeholder = 'Pick a date', clearable, showToday, hint, min, max, id, disabled }: {
  label?: string; value: string | null | undefined; onChange: (v: string) => void
  placeholder?: string; clearable?: boolean; showToday?: boolean; hint?: string; min?: string; max?: string; id?: string; disabled?: boolean
}) {
  const auto = useId(); const fid = id ?? auto
  const ref = useRef<HTMLInputElement>(null)
  // Touch: the real <input type=date> sits on top of the field (opacity 0, 16px) so the tap itself opens the
  // phone's native picker. No showPicker() and no <button> around it (an input inside a button is invalid on iOS).
  // Mouse: the input is visually hidden and the field calls showPicker().
  const touch = useMediaQuery('(pointer: coarse), (max-width: 639.98px)')
  const open = () => { const el = ref.current; if (!el || disabled) return; try { el.showPicker() } catch { el.focus() } }
  return (
    <div className="space-y-1.5">
      {/* Mouse: the field is a div (not labelable), so the label names it via aria-labelledby and opens the picker on click. */}
      {label && (touch ? <label htmlFor={`${fid}-native`} className="block text-sm font-medium">{label}</label>
        : <span id={`${fid}-label`} onClick={open} className="block text-sm font-medium">{label}</span>)}
      {/* One row: [calendar + date (never wraps)] [Today] [×]. Actions sit inside the field, never over the text. */}
      <div className="relative flex h-11 w-full min-w-0 items-center rounded-md border border-border bg-surface-2 transition-[border-color] duration-150 focus-within:border-accent hover:border-border-strong lg:h-9">
        <div className="relative flex h-full min-w-0 flex-1">
          <div id={fid} role={touch ? undefined : 'button'} aria-labelledby={!touch && label ? `${fid}-label` : undefined} tabIndex={touch || disabled ? undefined : 0} aria-disabled={disabled || undefined} aria-hidden={touch || undefined}
            onClick={touch ? undefined : open} onKeyDown={touch ? undefined : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } }} aria-describedby={hint ? `${fid}-hint` : undefined}
            className={cn('flex h-full min-w-0 flex-1 items-center gap-2 rounded-md pl-3 pr-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent', !touch && !disabled && 'cursor-pointer', disabled && 'opacity-60')}>
            <CalendarDays className="size-4 shrink-0 text-muted" aria-hidden />
            <span className={cn('tnum truncate whitespace-nowrap text-[16px] lg:text-sm', !value && 'text-faint')}>{value ? formatDate(value) : placeholder}</span>
          </div>
          <input ref={ref} type="date" id={`${fid}-native`} name={id ?? 'date'} value={value ?? ''} min={min} max={max} disabled={disabled}
            tabIndex={touch ? undefined : -1} aria-hidden={touch ? undefined : true} aria-label={touch ? (label ?? placeholder) : undefined}
            onChange={(e) => onChange(e.target.value)}
            style={touch ? { position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, zIndex: 10, fontSize: 16, margin: 0, padding: 0, border: 0, background: 'transparent', color: 'transparent', display: 'block', cursor: 'pointer' } : undefined}
            className={touch ? undefined : 'pointer-events-none absolute bottom-0 left-3 h-px w-px opacity-0'} />
        </div>
        <div className="flex shrink-0 items-center gap-0.5 pr-1">
          {showToday && !disabled && <button type="button" onClick={() => onChange(todayMY())} className="h-11 rounded-[6px] px-2 text-xs font-semibold text-accent-text hover:bg-surface-3 lg:h-7">Today</button>}
          {clearable && value && !disabled && (
            <button type="button" aria-label="Clear date" onClick={() => onChange('')} className="grid size-11 place-items-center rounded-[6px] text-muted hover:bg-surface-3 hover:text-fg lg:size-7">
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>
      {hint && <p id={`${fid}-hint`} className="text-xs text-muted">{hint}</p>}
    </div>
  )
}
