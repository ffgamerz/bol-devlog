import { useState, type ReactElement } from 'react'
import * as T from '@radix-ui/react-tooltip'

/**
 * Explains why a control is unavailable. Disabled buttons get no hover/focus, so when `reason`
 * is set the child is wrapped in a focusable span: the tip shows on hover, keyboard focus and tap.
 * With no reason the child renders as-is.
 */
export function DisabledTip({ reason, children }: { reason?: string | null | false; children: ReactElement }) {
  const [open, setOpen] = useState(false)
  if (!reason) return children
  return (
    <T.Provider delayDuration={150}>
      <T.Root open={open} onOpenChange={setOpen}>
        <T.Trigger asChild>
          <span tabIndex={0}
            className="inline-flex rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&>*]:pointer-events-none"
            onPointerDown={(e) => { if (e.pointerType === 'touch') setOpen((o) => !o) }}
            onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}>
            {children}
          </span>
        </T.Trigger>
        <T.Portal>
          <T.Content side="top" sideOffset={6} collisionPadding={8}
            className="z-[70] max-w-64 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-fg shadow-3 data-[state=delayed-open]:animate-in">
            {reason}<T.Arrow className="fill-surface" />
          </T.Content>
        </T.Portal>
      </T.Root>
    </T.Provider>
  )
}
