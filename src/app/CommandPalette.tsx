import { runNavGuard } from '@/lib/navGuard'
import { useEffect, useState } from 'react'
import { Command } from 'cmdk'
import * as D from '@radix-ui/react-dialog'
import { useNavigate } from 'react-router-dom'
import { Moon, Search, Sun, Monitor, ArrowRight } from 'lucide-react'
import { useAuth } from '@/data/auth'
import { useTheme } from '@/lib/theme'
import { visibleNav } from './nav'

/** ⌘K / Ctrl+K palette: jump to pages, run actions, find a video by title. */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const nav = useNavigate()
  const { isAdmin } = useAuth()
  const { setPref } = useTheme()
  const [q, setQ] = useState('')
  useEffect(() => { if (!open) setQ('') }, [open])

  const go = async (to: string) => { onOpenChange(false); if (await runNavGuard()) nav(to) }
  const pages = visibleNav(isAdmin).flatMap((a) => (a.children?.length ? a.children.map((c) => ({ to: c.to, label: c.label, area: a.label, kw: c.keywords })) : [{ to: a.to, label: a.label, area: '', kw: '' }]))
  const item = 'flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 text-sm aria-selected:bg-surface-3'

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
    <D.Portal>
    <D.Overlay className="fixed inset-0 z-40 bg-[var(--scrim)]" />
    <D.Content aria-describedby={undefined} className="fixed inset-x-3 top-[10dvh] z-50 mx-auto max-w-xl overflow-hidden rounded-xl border border-border bg-surface shadow-3 animate-[scale-in_200ms_var(--ease-out)]">
    <D.Title className="sr-only">Search and commands</D.Title>
    <Command label="Command palette" loop shouldFilter={true}>
      <div className="flex items-center gap-2 border-b border-border px-3">
        <Search className="size-4 text-muted" aria-hidden />
        <Command.Input value={q} onValueChange={setQ} enterKeyHint="search" placeholder="Jump to…" className="h-12 flex-1 bg-transparent outline-none placeholder:text-faint" />
        <kbd className="hidden rounded border border-border px-1.5 text-xs text-muted sm:inline">Esc</kbd>
      </div>
      <Command.List className="max-h-[60dvh] overflow-y-auto p-2">
        <Command.Empty className="px-3 py-6 text-center text-sm text-muted">No matches</Command.Empty>
        <Command.Group heading="Actions" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted">
          <Command.Item value="theme light" onSelect={() => { setPref('light'); onOpenChange(false) }} className={item}><Sun className="size-4 text-muted" />Light theme</Command.Item>
          <Command.Item value="theme dark" onSelect={() => { setPref('dark'); onOpenChange(false) }} className={item}><Moon className="size-4 text-muted" />Dark theme</Command.Item>
          <Command.Item value="theme system" onSelect={() => { setPref('system'); onOpenChange(false) }} className={item}><Monitor className="size-4 text-muted" />System theme</Command.Item>
        </Command.Group>
        <Command.Group heading="Go to" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted">
          {pages.map((p) => (
            <Command.Item key={p.to} value={`go ${p.label} ${p.area} ${p.kw}`} onSelect={() => go(p.to)} className={item}>
              <ArrowRight className="size-4 text-muted" />{p.label}{p.area && <span className="text-xs text-faint">{p.area}</span>}
            </Command.Item>
          ))}
        </Command.Group>
      </Command.List>
    </Command>
    </D.Content>
    </D.Portal>
    </D.Root>
  )
}
