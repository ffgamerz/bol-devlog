import { useEffect, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Keeps children mounted while they collapse (grid-rows 1fr→0fr + fade, ~150ms), then unmounts.
 * Reduced motion: instant. Hidden content is inert (no focus, no screen reader).
 */
export function Collapse({ show, children, className, ms = 150 }: { show: boolean; children: ReactNode; className?: string; ms?: number }) {
  const [mounted, setMounted] = useState(show)
  const [open, setOpen] = useState(show)
  const [settled, setSettled] = useState(show)
  useEffect(() => {
    if (show) { setMounted(true); setSettled(false); const r = requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true))); const t = window.setTimeout(() => setSettled(true), reduced() ? 0 : ms + 30); return () => { cancelAnimationFrame(r); clearTimeout(t) } }
    setOpen(false); setSettled(false)
    const t = window.setTimeout(() => setMounted(false), reduced() ? 0 : ms + 30)
    return () => clearTimeout(t)
  }, [show, ms])
  if (!mounted) return null
  return (
    <div data-collapse={open ? 'open' : 'closed'} inert={!open || undefined} aria-hidden={!open || undefined}
      style={{ transitionDuration: `${ms}ms` }}
      className={cn('grid transition-[grid-template-rows,opacity] ease-out motion-reduce:transition-none', open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0', className)}>
      <div className={cn('min-h-0', !(open && settled) && 'overflow-hidden')}>{children}</div>
    </div>
  )
}
