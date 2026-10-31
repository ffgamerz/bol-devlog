import { useEffect, useState } from 'react'

/** The hashed entry script of an index.html (Vite: /assets/index-<hash>.js). */
export function entryScript(html: string): string | null {
  return /<script[^>]+type="module"[^>]+src="([^"]*\/assets\/index-[^"]+\.js)"/.exec(html)?.[1]
    ?? /src="(\/assets\/index-[^"]+\.js)"/.exec(html)?.[1] ?? null
}
const current = () => (document.querySelector('script[type="module"][src*="/assets/index-"]') as HTMLScriptElement | null)?.getAttribute('src') ?? null

/**
 * True once a newer deploy is live than the one this tab is running (phones keep tabs open for days, so new
 * menu items and pages would otherwise never show). Checks when the tab becomes visible and every 5 min.
 */
export function useNewVersion(intervalMs = 5 * 60_000): boolean {
  const [stale, setStale] = useState(false)
  useEffect(() => {
    const mine = current()
    if (!mine || import.meta.env.DEV) return
    let last = 0
    const check = async () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < 30_000) return
      last = Date.now()
      try {
        const r = await fetch('/', { cache: 'no-store', headers: { Accept: 'text/html' } })
        const live = r.ok ? entryScript(await r.text()) : null
        if (live && live !== mine) setStale(true)
      } catch { /* offline: try later */ }
    }
    const id = window.setInterval(check, intervalMs)
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', check); window.removeEventListener('focus', check) }
  }, [intervalMs])
  return stale
}
