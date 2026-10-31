import * as D from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useRef, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { useIsDesktop } from '@/lib/hooks'
import { IconButton } from './Button'

/** Last control pressed (pointer), for focus return where clicks don't focus buttons (Safari). */
let lastPressed: HTMLElement | null = null
if (typeof document !== 'undefined') document.addEventListener('pointerdown', (e) => { lastPressed = (e.target as Element | null)?.closest?.('button,a[href],[tabindex]') as HTMLElement | null }, true)

/**
 * Details/edit surface. Phone: bottom sheet (drag handle, 90dvh max, safe-area padding).
 * Desktop: right side sheet. `size="dialog"` = centred dialog on desktop for short forms/confirms.
 * Radix handles focus trap, Esc, scroll lock and aria wiring (no aria-hidden focus bugs).
 */
export function Sheet({
  open, onOpenChange, title, description, children, footer, size = 'side', wide, narrow, headerActions, tall, nativeScroll, onOpenAutoFocus,
}: {
  /** Override the first-focus rule (e.g. focus a field on desktop only). */
  onOpenAutoFocus?: (e: Event) => void
  /**
   * Long scroll lists on iPhone: skip Radix's Overlay, which wraps react-remove-scroll (non-passive document touchmove +
   * getComputedStyle up the ancestor chain on every move = main-thread-bound, janky momentum scroll). A plain scrim
   * (touch-action:none, so the page behind can't scroll) + overscroll-contain on the body keep the page locked.
   */
  nativeScroll?: boolean
  /** Phone: fixed ~85dvh height so the top edge doesn't jump as content changes (e.g. while searching). */
  tall?: boolean
  open: boolean
  onOpenChange: (o: boolean) => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  /** Sticky action row; put Cancel first, primary action last. */
  footer?: ReactNode
  size?: 'side' | 'dialog'
  wide?: boolean
  /** Desktop side sheet ~460px (forms like the rule profile editor). */
  narrow?: boolean
  /** Icon buttons next to Close (e.g. bookmark, focus) */
  headerActions?: ReactNode
}) {
  const desktop = useIsDesktop()
  const mode = !desktop ? 'bottom' : size === 'dialog' ? 'center' : 'right'
  // Sheets opened from state (not a Radix Trigger): remember what had focus when it opened and return there on close.
  const opener = useRef<HTMLElement | null>(null)
  const wasOpen = useRef(false)
  if (open && !wasOpen.current && typeof document !== 'undefined') {
    const a = document.activeElement as HTMLElement | null
    opener.current = a && a !== document.body ? a : lastPressed   // Safari doesn't focus a clicked button
  }
  wasOpen.current = open
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        {nativeScroll
          ? <div aria-hidden data-scrim onClick={() => onOpenChange(false)} className="pointer-events-auto fixed inset-0 z-40 touch-none bg-[var(--scrim)] animate-[fade-in_200ms_var(--ease-out)]" />
          : <D.Overlay className="fixed inset-0 z-40 bg-[var(--scrim)] data-[state=open]:animate-[fade-in_200ms_var(--ease-out)]" />}
        <D.Content
          onOpenAutoFocus={onOpenAutoFocus}
          onCloseAutoFocus={(e) => {
            const el = opener.current; opener.current = null
            if (el && el.isConnected && el !== document.body) { e.preventDefault(); el.focus({ preventScroll: true }) }
          }}
          className={cn(
            'fixed z-50 flex flex-col bg-surface text-fg shadow-3 outline-none border-border',
            mode === 'bottom' && tall && 'h-[85dvh]', mode === 'bottom' && 'inset-x-0 bottom-0 max-h-[90dvh] rounded-t-[var(--radius-xl)] border-t data-[state=open]:animate-[sheet-up_220ms_var(--ease-out-expo)] pb-[env(safe-area-inset-bottom)]',
            mode === 'right' && cn('inset-y-0 right-0 w-full border-l data-[state=open]:animate-[sheet-in-right_220ms_var(--ease-out-expo)]', wide ? 'max-w-3xl' : narrow ? 'max-w-[460px]' : 'max-w-[520px]'),
            mode === 'center' && 'left-1/2 top-1/2 w-[min(92vw,30rem)] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-xl)] border data-[state=open]:animate-[scale-in_200ms_var(--ease-out)]',
          )}
        >
          {mode === 'bottom' && <div aria-hidden className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-surface-3" />}
          <header className="flex items-start gap-3 px-5 pt-4 pb-3">
            <div className="min-w-0 flex-1">
              <D.Title className="line-clamp-2 text-lg font-semibold leading-snug tracking-[-0.015em] text-balance" title={typeof title === 'string' ? title : undefined}>{title}</D.Title>
              {description ? <D.Description className="mt-0.5 text-sm text-muted">{description}</D.Description> : <D.Description className="sr-only">Details</D.Description>}
            </div>
            <div className="-mr-2 -mt-1 flex shrink-0 items-center">
              {headerActions}
              <D.Close asChild><IconButton label="Close"><X className="size-5" /></IconButton></D.Close>
            </div>
          </header>
          <div data-sheet-body className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4 [-webkit-overflow-scrolling:touch]">{children}</div>
          {footer && (
            <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-surface px-5 py-3 [&>*]:max-sm:flex-1">
              {footer}
            </footer>
          )}
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}

/** Read-only details layout: label/value rows used before switching to Edit. */
export function DetailList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-border rounded-lg border border-border">
      {items.map((it) => (
        <div key={it.label} className="grid grid-cols-[minmax(7rem,35%)_1fr] gap-3 px-3 py-2.5 text-sm">
          <dt className="text-muted">{it.label}</dt>
          <dd className="min-w-0 break-words">{it.value ?? <span className="text-faint">-</span>}</dd>
        </div>
      ))}
    </dl>
  )
}
