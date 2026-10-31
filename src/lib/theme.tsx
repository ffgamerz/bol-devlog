import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

export type ThemePref = 'light' | 'dark' | 'system'
export const THEME_KEY = 'grokbot-ai-log:theme'

const mq = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null)
export const resolveTheme = (p: ThemePref): 'light' | 'dark' => (p === 'light' ? 'light' : p === 'dark' ? 'dark' : mq()?.matches ? 'light' : 'dark')

function apply(resolved: 'light' | 'dark', animate: boolean) {
  const root = document.documentElement
  if (animate) root.classList.add('theme-switching')
  root.classList.remove('light', 'dark')
  root.classList.add(resolved)
  root.style.colorScheme = resolved
  // Browser chrome matches the theme the app resolved (not the OS preference).
  const bg = getComputedStyle(root).getPropertyValue('--c-bg').trim()
  if (bg) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg)
  if (animate) window.setTimeout(() => root.classList.remove('theme-switching'), 260)
}

type Ctx = { pref: ThemePref; resolved: 'light' | 'dark'; setPref: (p: ThemePref) => void }
const ThemeCtx = createContext<Ctx | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(() => {
    const v = (typeof localStorage !== 'undefined' && localStorage.getItem(THEME_KEY)) as ThemePref | null
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'dark'   // first visit: dark (System is still a choice)
  })
  const [resolved, setResolved] = useState(() => resolveTheme(pref))

  const setPref = useCallback((p: ThemePref) => {
    localStorage.setItem(THEME_KEY, p)
    setPrefState(p)
    const r = resolveTheme(p)
    setResolved(r)
    apply(r, true)
  }, [])

  useEffect(() => { apply(resolved, false) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (pref !== 'system') return
    const m = mq()
    if (!m) return
    const on = () => { const r = resolveTheme('system'); setResolved(r); apply(r, true) }
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [pref])

  return <ThemeCtx.Provider value={{ pref, resolved, setPref }}>{children}</ThemeCtx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const v = useContext(ThemeCtx)
  if (!v) throw new Error('useTheme outside ThemeProvider')
  return v
}
