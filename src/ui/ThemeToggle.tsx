import { Monitor, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useTheme, type ThemePref } from '@/lib/theme'

const opts: { v: ThemePref; label: string; Icon: typeof Sun }[] = [
  { v: 'light', label: 'Light', Icon: Sun },
  { v: 'dark', label: 'Dark', Icon: Moon },
  { v: 'system', label: 'System', Icon: Monitor },
]

/** Segmented Light / Dark / System control. `compact` = icons only (top bar). */
export function ThemeToggle({ compact }: { compact?: boolean }) {
  const { pref, setPref } = useTheme()
  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5">
      {opts.map(({ v, label, Icon }) => (
        <button key={v} type="button" role="radio" aria-checked={pref === v} title={label} aria-label={label}
          onClick={() => setPref(v)}
          className={cn('inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors duration-150 [@media(pointer:coarse)]:h-11',
            pref === v ? 'bg-surface text-fg shadow-1' : 'text-muted hover:text-fg')}>
          <Icon className="size-4" />{!compact && label}
        </button>
      ))}
    </div>
  )
}
