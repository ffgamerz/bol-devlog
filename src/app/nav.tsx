import { Bot, ScrollText } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type NavChild = { to: string; label: string; icon?: LucideIcon; adminOnly?: boolean; keywords?: string }
export type NavArea = { id: string; label: string; icon: LucideIcon; to: string; match: string[]; children?: NavChild[]; adminOnly?: boolean }

export const NAV: NavArea[] = [
  { id: 'devlog', label: 'Dev log', icon: ScrollText, to: '/', match: ['/'], adminOnly: true },
  { id: 'claude', label: 'Claude', icon: Bot, to: '/claude', match: ['/claude'], adminOnly: true },
]

export const visibleNav = (isAdmin: boolean) =>
  NAV.filter((a) => !a.adminOnly || isAdmin).map((a) => ({ ...a, children: a.children?.filter((c) => !c.adminOnly || isAdmin) }))

/** Exactly one active area for a path (longest match wins; '/' only matches itself). */
export function activeArea(path: string, areas: NavArea[]) {
  let best: NavArea | undefined; let len = -1
  for (const a of areas) for (const m of a.match) {
    const hit = m === '/' ? path === '/' : path === m || path.startsWith(m + '/')
    if (hit && m.length > len) { best = a; len = m.length }
  }
  return best
}
