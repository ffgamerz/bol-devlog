import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useSearchParams } from 'react-router-dom'

export function useMediaQuery(q: string) {
  return useSyncExternalStore(
    (cb) => { const m = window.matchMedia(q); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb) },
    () => window.matchMedia(q).matches,
    () => false,
  )
}
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)')

/**
 * Filters that live in the URL (?key=value), so they survive reload, back/forward
 * and can be shared. Empty values are removed from the URL.
 */
export function useUrlFilters<T extends Record<string, string>>(defaults: T) {
  const [params, setParams] = useSearchParams()
  const values = useMemo(() => {
    const out = { ...defaults }
    for (const k of Object.keys(defaults) as (keyof T)[]) {
      const v = params.get(k as string)
      if (v !== null) out[k] = v as T[keyof T]
    }
    return out
  }, [params, defaults])
  const set = useCallback((patch: Partial<T>, opts?: { push?: boolean }) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === '' || v === defaults[k]) next.delete(k)
        else next.set(k, String(v))
      }
      return next
    }, { replace: !opts?.push })
  }, [setParams, defaults])
  const clear = useCallback(() => set(Object.fromEntries(Object.keys(defaults).map((k) => [k, ''])) as Partial<T>), [set, defaults])
  const activeCount = Object.keys(defaults).filter((k) => values[k] !== defaults[k]).length
  return { values, set, clear, activeCount }
}

export function useDebounced<T>(value: T, ms = 200) {
  const [v, setV] = useState(value)
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t) }, [value, ms])
  return v
}
