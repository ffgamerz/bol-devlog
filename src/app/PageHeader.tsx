import type { ReactNode } from 'react'

/** Page title row: title + optional subtitle on the left, actions on the right (wrap on phones). */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold max-sm:font-semibold tracking-[-0.025em] text-balance lg:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex min-w-0 flex-wrap items-center gap-2 max-sm:w-full">{actions}</div>}
    </div>
  )
}
