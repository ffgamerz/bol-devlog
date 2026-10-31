import { useState, type ReactNode } from 'react'

const KEY = 'grokbot-ai-log:revealed'

/** Staggered reveal of children, once per browser session (Home first load only). */
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const [first] = useState(() => {
    try { if (sessionStorage.getItem(KEY)) return false; sessionStorage.setItem(KEY, '1'); return true } catch { return false }
  })
  return <div className={className} data-reveal={first ? '' : undefined}>{children}</div>
}
