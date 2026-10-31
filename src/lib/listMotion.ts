import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'

export type RowMotion = { className?: string; style?: CSSProperties; exiting?: boolean }
const STAGGER = 30, CAP = 8, EXIT_MS = 150, EXIT_CAP = 40
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Search/filter list motion. When `items` change (not on first load):
 * - rows that left stay mounted ~150ms and collapse (max 40, else they just go),
 * - new rows slide up 250ms, 30ms stagger, only the first 8 that are on screen; the rest just appear.
 * Reduced motion: no exit ghosts, no slide (CSS falls back to a short fade).
 */
export function useListMotion<T>(items: T[] | null | undefined, key: (t: T) => string, root?: () => HTMLElement | null) {
  const prev = useRef<Map<string, { item: T; i: number }> | null>(null)
  const [exiting, setExiting] = useState<{ item: T; i: number }[]>([])
  const [enter, setEnter] = useState<Map<string, number>>(new Map())
  const list = items ?? []
  const sig = list.map(key).join('|')
  useLayoutEffect(() => {
    if (!items) return   // loading: keep diffing against the last real list (never via empty)
    const now = new Map(list.map((t, i) => [key(t), { item: t, i }]))
    const old = prev.current; prev.current = now
    if (!old) { setEnter(new Map()); setExiting([]); return }
    const added = list.map(key).filter((k) => !old.has(k))
    const gone = [...old.entries()].filter(([k]) => !now.has(k)).map(([, v]) => v)
    const vh = typeof window !== 'undefined' ? window.innerHeight : 1000
    const top = root?.()?.getBoundingClientRect().top ?? 0
    const est = (i: number) => top + i * 64 < vh   // rough row height; only rows likely on screen animate
    const m = new Map<string, number>(); let n = 0
    for (const k of added) { const i = now.get(k)!.i; if (n < CAP && est(i)) m.set(k, n++) }
    setEnter(reduced() ? new Map() : m)
    setExiting(reduced() || gone.length > EXIT_CAP ? [] : gone)
  }, [sig]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!exiting.length) return; const t = window.setTimeout(() => setExiting([]), EXIT_MS + 20); return () => clearTimeout(t) }, [exiting])
  useEffect(() => { if (!enter.size) return; const t = window.setTimeout(() => setEnter(new Map()), 300 + CAP * STAGGER + 50); return () => clearTimeout(t) }, [enter])

  // Merge exiting ghosts back at their old positions
  const out: { item: T; key: string; mx: RowMotion }[] = list.map((t) => { const k = key(t), d = enter.get(k); return { item: t, key: k, mx: d === undefined ? {} : { className: 'm-search', style: { animationDelay: `${d * STAGGER}ms` } } } })
  for (const g of [...exiting].sort((a, b) => a.i - b.i)) { const k = key(g.item); if (!out.some((o) => o.key === k)) out.splice(Math.min(g.i, out.length), 0, { item: g.item, key: k, mx: { className: 'm-exit', exiting: true } }) }
  return out
}
