import { NavLink } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { visibleNav } from './nav'

/** The More area's pages, straight from NAV (same source as the desktop sidebar), for the phone sheet and /more. */
export function MoreList({ isAdmin }: { isAdmin: boolean }) {
  const items = visibleNav(isAdmin).find((a) => a.id === 'more')?.children ?? []
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
      {items.map((c) => (
        <li key={c.to}>
          <NavLink to={c.to} className="flex min-h-12 items-center gap-3 px-4 text-sm font-medium hover:text-fg">
            {c.icon && <c.icon className="size-[18px] text-muted" />}<span className="flex-1">{c.label}</span><ChevronRight className="size-4 text-faint" />
          </NavLink>
        </li>
      ))}
    </ul>
  )
}
