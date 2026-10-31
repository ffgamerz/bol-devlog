import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useAuth } from '@/data/auth'
import { Button, IconButton } from '@/ui/Button'
import { Sheet } from '@/ui/Sheet'
import { ThemeToggle } from '@/ui/ThemeToggle'
import { ErrorBoundary, OfflineBanner } from '@/ui/States'
import { activeArea, visibleNav, type NavArea } from './nav'
import { MoreList } from './MoreList'
import { useNewVersion } from '@/lib/versionCheck'
import { beforeUnload, isGuarded, rememberLocation, runNavGuard } from '@/lib/navGuard'
import { CommandPalette } from './CommandPalette'

function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2 font-semibold tracking-tight">
      <span aria-hidden className="grid size-7 place-items-center rounded-lg bg-accent text-[13px] font-bold text-accent-fg">B</span>
      <span>BOL <span className="text-accent-text">Dev log</span></span>
    </span>
  )
}

const SIDE_KEY = 'grokbot:sidebar-hidden'
/** Desktop sidebar visibility, remembered per browser. */
function useSidebarHidden() {
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(SIDE_KEY) === '1' } catch { return false } })
  const toggle = () => setHidden((v) => { const n = !v; try { localStorage.setItem(SIDE_KEY, n ? '1' : '0') } catch { /* private mode */ } return n })
  return [hidden, toggle] as const
}

function useOnline() {
  const [on, setOn] = useState(() => navigator.onLine)
  useEffect(() => {
    const u = () => setOn(true), d = () => setOn(false)
    addEventListener('online', u); addEventListener('offline', d)
    return () => { removeEventListener('online', u); removeEventListener('offline', d) }
  }, [])
  return on
}

export function AppShell() {
  // Measured sticky header height (top bar + section tabs) -> --header-h, for full-viewport layouts (desktop planner).
  const headerRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = headerRef.current; if (!el) return
    const set = () => document.documentElement.style.setProperty('--header-h', `${Math.round(el.getBoundingClientRect().height)}px`)
    set(); const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(set) : null; ro?.observe(el)
    return () => ro?.disconnect()
  }, [])

  const { isAdmin, signOut, user } = useAuth()
  const loc = useLocation()
  useEffect(() => { rememberLocation() }, [loc])
  const nav = useNavigate()
  // Work pages use the full width next to the sidebar (no 72rem cap); videos also has its own Add button, so no FAB there.
  const wide = /^\/(videos|schedule\/planner)/.test(loc.pathname)
  const areas = visibleNav(isAdmin)
  const current = activeArea(loc.pathname, areas)
  const [palette, setPalette] = useState(false)
  const [more, setMore] = useState(false)
  const [sideHidden, toggleSide] = useSidebarHidden()
  const online = useOnline()
  const newVersion = useNewVersion()

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((v) => !v) }
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); toggleSide() }
      else if (e.key === '/' && !(e.target as HTMLElement).closest('input,textarea,select,[contenteditable]')) { e.preventDefault(); focusPageSearch() }
    }
    addEventListener('keydown', on); return () => removeEventListener('keydown', on)
  }, [])
  useEffect(() => { setMore(false) }, [loc.pathname])

  // "/" focuses this page's own search bar (Videos, Planner list, Settings…); pages without one ignore it. ⌘K is the general search.
  const focusPageSearch = () => {
    const els = [...document.querySelectorAll<HTMLInputElement>('main input[type="search"]')].filter((el) => el.offsetParent !== null && !el.disabled)
    const el = els.find((x) => x.id === 'video-search') ?? els[0]
    if (el) { el.focus(); el.select() }
  }
  // Route changes from any in-app link go through the unsaved-changes guard.
  useEffect(() => {
    const onClick = async (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null
      if (!a || a.target === '_blank' || a.origin !== location.origin || !isGuarded()) return
      const to = a.pathname + a.search
      if (to === location.pathname + location.search) return
      e.preventDefault(); e.stopPropagation()
      if (await runNavGuard()) nav(to)
    }
    document.addEventListener('click', onClick, true)
    window.addEventListener('beforeunload', beforeUnload)
    return () => { document.removeEventListener('click', onClick, true); window.removeEventListener('beforeunload', beforeUnload) }
  }, [nav])
  const subNav = current?.children && current.id !== 'more' ? current.children : null

  return (
    <div className={cn('min-h-dvh lg:grid', sideHidden ? 'lg:grid-cols-[minmax(0,1fr)]' : 'lg:grid-cols-[15rem_minmax(0,1fr)] lg:bg-[linear-gradient(to_right,var(--c-surface)_calc(15rem-1px),var(--c-border)_calc(15rem-1px),var(--c-border)_15rem,transparent_15rem)]')}>
      {/* Desktop sidebar */}
      <aside className={cn('sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface', !sideHidden && 'lg:flex')}>
        <div className="flex h-[var(--topbar-h)] items-center justify-between pl-5 pr-3">
          <Wordmark />
          <IconButton label="Hide sidebar (⌘B)" onClick={toggleSide}><PanelLeftClose className="size-4" /></IconButton>
        </div>
        <nav aria-label="Main" className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
          {areas.map((a) => <SideItem key={a.id} area={a} active={current?.id === a.id} path={loc.pathname} />)}
        </nav>
        <div className="space-y-3 border-t border-border p-3">
          <ThemeToggle compact />
          <div className="flex items-center gap-2 px-1">
            <span className="min-w-0 flex-1 truncate text-xs text-muted" title={user?.email ?? ''}>{user?.email}</span>
            <IconButton label="Sign out" onClick={() => signOut()}><LogOut className="size-4" /></IconButton>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Top bar */}
        <header ref={headerRef} className="sticky top-0 z-20 border-b border-border bg-bg/80 backdrop-blur-md">
          <div className="flex h-[var(--topbar-h)] items-center gap-2 px-4 lg:px-6">
            <div className="lg:hidden"><Wordmark /></div>
            {sideHidden && (
              <div className="hidden lg:flex lg:items-center lg:gap-3">
                <IconButton label="Show sidebar (⌘B)" onClick={toggleSide}><PanelLeftOpen className="size-4" /></IconButton>
                <Wordmark />
              </div>
            )}
            <button type="button" onClick={() => setPalette(true)}
              className="ml-auto flex h-11 min-w-11 items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 text-sm text-muted transition-colors hover:border-border-strong lg:ml-0 lg:h-10 lg:w-80">
              <Search className="size-4" /><span className="hidden sm:inline">Jump to…</span>
              <kbd className="ml-auto hidden rounded border border-border px-1.5 text-xs lg:inline">⌘K</kbd>
            </button>
          </div>
          {subNav && (
            <nav aria-label={`${current!.label} sections`} className="flex gap-1 overflow-x-auto px-4 pb-2 lg:px-6">
              {subNav.map((c) => (
                <NavLink key={c.to} to={c.to} className={({ isActive }) => cn('inline-flex h-9 items-center rounded-full px-3.5 text-sm font-medium transition-colors',
                  isActive ? 'bg-accent-soft text-accent-text' : 'text-muted hover:bg-surface-2 hover:text-fg')}>{c.label}</NavLink>
              ))}
            </nav>
          )}
        </header>
        {!online && <OfflineBanner />}
        {newVersion && (
          <div role="status" className="flex items-center gap-3 border-b border-info/30 bg-info-soft px-4 py-2 text-sm text-info lg:px-6">
            <span className="flex-1">BOL Dev log was updated. Reload to get the new pages and menu.</span>
            <button type="button" onClick={() => window.location.reload()} className="min-h-9 rounded-md px-3 font-semibold underline underline-offset-2">Reload</button>
          </div>
        )}

        <main id="main" className={cn('mx-auto w-full min-w-0 flex-1 px-4 pt-4 lg:px-6 lg:pt-6 lg:pb-10', 'max-w-[var(--page-max)]', wide ? 'pb-[calc(var(--nav-h)+24px+env(safe-area-inset-bottom))]' : 'pb-[calc(var(--nav-h)+56px+32px+env(safe-area-inset-bottom))]')}>
          <div key={loc.pathname} className="animate-[fade-in_180ms_var(--ease-out)]">
            <ErrorBoundary><Outlet /></ErrorBoundary>
          </div>
        </main>
      </div>

      {/* Phone bottom nav: same 5 areas, labels never truncated */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
        <ul className="grid h-[var(--nav-h)]" style={{ gridTemplateColumns: `repeat(${areas.length}, minmax(0, 1fr))` }}>
          {areas.map((a) => {
            const active = current?.id === a.id
            const Icon = a.icon
            const cls = cn('relative flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] font-medium leading-none transition-colors',
              active ? 'text-accent-text' : 'text-muted')
            const inner = (<>
              <span className={cn('grid h-7 w-12 place-items-center rounded-full transition-colors duration-200', active && 'bg-accent-soft')}><Icon className="size-5" /></span>
              <span className="whitespace-nowrap">{a.label}</span>
            </>)
            return (
              <li key={a.id} className="min-w-0">
                {a.id === 'more'
                  ? <button type="button" className={cls} aria-current={active ? 'page' : undefined} onClick={() => setMore(true)}>{inner}</button>
                  : <NavLink to={a.to} end={a.to === '/'} className={cls} aria-current={active ? 'page' : undefined}>{inner}</NavLink>}
              </li>
            )
          })}
        </ul>
      </nav>

      <Sheet open={more} onOpenChange={setMore} title="More">
        <MoreList isAdmin={isAdmin} />
        <div className="mt-5 space-y-2">
          <p className="text-sm font-medium">Theme</p>
          <ThemeToggle />
        </div>
        <Button intent="cancel" block className="mt-6" icon={<LogOut className="size-4" />} onClick={() => signOut()}>Sign out</Button>
      </Sheet>

      <CommandPalette open={palette} onOpenChange={setPalette} />
    </div>
  )
}

function SideItem({ area, active, path }: { area: NavArea; active: boolean; path: string }) {
  const Icon = area.icon
  const base = 'flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors duration-150'
  return (
    <div>
      {area.id === 'more' ? (
        <p className="px-3 pb-1 pt-4 text-xs font-semibold text-faint">{area.label}</p>
      ) : (
        <NavLink to={area.to} end={area.to === '/'} aria-current={active ? 'page' : undefined}
          className={cn(base, active ? 'bg-accent-soft text-accent-text' : 'text-muted hover:text-fg')}>
          <Icon className="size-[18px]" />{area.label}
        </NavLink>
      )}
      {area.children && (area.id === 'more' || active) && (
        <div className={cn('space-y-0.5', area.id !== 'more' && 'ml-6 mt-0.5 border-l border-border pl-3')}>
          {area.children.map((c) => {
            const CIcon = c.icon
            const on = path.startsWith(c.to)
            return (
              <NavLink key={c.to} to={c.to} aria-current={on ? 'page' : undefined}
                className={cn(base, area.id !== 'more' && 'h-9', on ? 'bg-accent-soft text-accent-text' : 'text-muted hover:text-fg')}>
                {CIcon && area.id === 'more' && <CIcon className="size-[18px]" />}{c.label}
              </NavLink>
            )
          })}
        </div>
      )}
    </div>
  )
}
