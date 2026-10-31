import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button, IconButton } from './Button'
import { Sheet } from './Sheet'

type Tone = 'success' | 'error' | 'info' | 'warning'
type Toast = { id: number; message: string; tone: Tone; action?: { label: string; run: () => void }; count?: number }
type ConfirmOpts = { title?: string; message: ReactNode; confirmLabel?: string; tone?: 'delete' | 'save' }
export type GuardChoice = 'save' | 'discard' | 'keep'
type Ctx = {
  toast: (message: string, tone?: Tone, action?: Toast['action']) => void
  confirm: (o: ConfirmOpts | string) => Promise<boolean>
  /** Unsaved-changes guard: green Save (then continue), red Discard, grey Keep editing. */
  guard: (o: { title?: string; message?: ReactNode }) => Promise<GuardChoice>
}
/** Non-error toasts stay this long (paused while hovered or focused). Errors stay until closed. */
export const TOAST_MS = 6000
const FeedbackCtx = createContext<Ctx | null>(null)

const icon: Record<Tone, ReactNode> = {
  success: <CheckCircle2 className="size-5 text-success" />,
  error: <XCircle className="size-5 text-danger" />,
  info: <Info className="size-5 text-info" />,
  warning: <AlertTriangle className="size-5 text-warning" />,
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [confirmState, setConfirmState] = useState<(ConfirmOpts & { open: boolean }) | null>(null)
  const resolver = useRef<((v: boolean) => void) | null>(null)
  const seq = useRef(0)

  const dismiss = (id: number) => setToasts((t) => t.filter((x) => x.id !== id))
  const [showAllErr, setShowAllErr] = useState(false)
  const toast = useCallback<Ctx['toast']>((message, tone = 'success', action) => {
    const id = ++seq.current
    // Errors are never dropped: a repeat of the same error bumps its count; older ones collapse
    // behind a "N more errors" chip. Other toasts auto-dismiss in ToastItem (max 3 shown).
    setToasts((t) => {
      if (tone === 'error') {
        const same = t.find((x) => x.tone === 'error' && x.message === message)
        if (same) return [...t.filter((x) => x !== same), { ...same, id, action: action ?? same.action, count: (same.count ?? 1) + 1 }]
      }
      return [...t.filter((x) => x.tone === 'error'), ...t.filter((x) => x.tone !== 'error').slice(-2), { id, message, tone, action }]
    })
  }, [])
  const [guardState, setGuardState] = useState<{ title: string; message?: ReactNode; open: boolean } | null>(null)
  const guardResolver = useRef<((v: GuardChoice) => void) | null>(null)
  const guard = useCallback<Ctx['guard']>((o) => {
    setGuardState({ title: o.title ?? 'Save your changes?', message: o.message, open: true })
    return new Promise<GuardChoice>((res) => { guardResolver.current = res })
  }, [])
  const settleGuard = (v: GuardChoice) => {
    guardResolver.current?.(v); guardResolver.current = null
    setGuardState((p) => (p ? { ...p, open: false } : p))
  }
  const confirm = useCallback<Ctx['confirm']>((o) => {
    const opts = typeof o === 'string' ? { message: o } : o
    setConfirmState({ tone: 'delete', ...opts, open: true })
    return new Promise<boolean>((res) => { resolver.current = res })
  }, [])
  const settle = (v: boolean) => {
    resolver.current?.(v); resolver.current = null
    setConfirmState((p) => (p ? { ...p, open: false } : p))
  }

  return (
    <FeedbackCtx.Provider value={{ toast, confirm, guard }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-3 bottom-[calc(var(--nav-h)+12px+env(safe-area-inset-bottom))] lg:bottom-6 lg:items-end lg:pr-6 [body:has([data-savebar])_&]:!bottom-[calc(var(--nav-h)+104px+env(safe-area-inset-bottom))] lg:[body:has([data-savebar])_&]:!bottom-[76px]"
      >
        {(() => {
          const errs = toasts.filter((t) => t.tone === 'error')
          const hidden = showAllErr ? 0 : Math.max(0, errs.length - 3)
          const hiddenIds = new Set(errs.slice(0, hidden).map((t) => t.id))
          return <>
            {hidden > 0 && (
              <div role="status" className="pointer-events-auto flex items-center gap-2 rounded-full border border-danger/40 bg-surface px-3 py-1.5 text-xs font-semibold text-danger shadow-2">
                <span className="tnum">{hidden} more {hidden === 1 ? 'error' : 'errors'}</span>
                <button type="button" className="h-7 rounded px-1.5 text-fg underline-offset-2 hover:underline" onClick={() => setShowAllErr(true)}>Show</button>
                <button type="button" className="h-7 rounded px-1.5 text-muted hover:text-fg" onClick={() => setToasts((t) => t.filter((x) => !hiddenIds.has(x.id)))}>Clear</button>
              </div>
            )}
            {showAllErr && errs.length > 3 && <button type="button" className="pointer-events-auto rounded-full bg-surface px-3 py-1 text-xs font-semibold shadow-2" onClick={() => setShowAllErr(false)}>Collapse errors</button>}
            {toasts.filter((t) => !hiddenIds.has(t.id)).map((t) => <ToastItem key={t.id} t={t} onDismiss={() => dismiss(t.id)} />)}
          </>
        })()}
      </div>
      <Sheet
        size="dialog"
        open={!!confirmState?.open}
        onOpenChange={(o) => { if (!o) settle(false) }}
        title={confirmState?.title ?? 'Are you sure?'}
        footer={<>
          {/* Destructive confirms start on Cancel (safe default); save-tone confirms start on the action. */}
          <Button intent="cancel" onClick={() => settle(false)} autoFocus={confirmState?.tone !== 'save'}>Cancel</Button>
          <Button intent={confirmState?.tone === 'save' ? 'save' : 'delete'} onClick={() => settle(true)} autoFocus={confirmState?.tone === 'save'}>
            {confirmState?.confirmLabel ?? (confirmState?.tone === 'save' ? 'Confirm' : 'Delete')}
          </Button>
        </>}
      >
        <p className={cn('text-sm text-muted')}>{confirmState?.message}</p>
      </Sheet>
      <Sheet size="dialog" open={!!guardState?.open} onOpenChange={(o) => { if (!o) settleGuard('keep') }} title={guardState?.title ?? ''}
        footer={<>
          <Button intent="cancel" onClick={() => settleGuard('keep')} autoFocus>Keep editing</Button>
          <Button intent="delete" onClick={() => settleGuard('discard')}>Discard</Button>
          <Button intent="save" onClick={() => settleGuard('save')}>Save</Button>
        </>}>
        <p className="text-sm text-muted">{guardState?.message ?? 'You have unsaved changes. Save them before leaving, or discard them.'}</p>
      </Sheet>
    </FeedbackCtx.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFeedback() {
  const v = useContext(FeedbackCtx)
  if (!v) throw new Error('useFeedback outside FeedbackProvider')
  return v
}

function ToastItem({ t, onDismiss }: { t: Toast; onDismiss: () => void }) {
  const [paused, setPaused] = useState(false)
  const left = useRef(TOAST_MS)
  useEffect(() => {
    if (t.tone === 'error' || paused) return
    const start = Date.now()
    const timer = window.setTimeout(onDismiss, left.current)
    return () => { window.clearTimeout(timer); left.current -= Date.now() - start }
  }, [paused, t.tone, onDismiss])
  return (
    <div role={t.tone === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setPaused(false) }}
      className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-lg border border-border bg-surface-3 px-3 py-2.5 text-sm shadow-3 animate-fade-up">
      {icon[t.tone]}
      <span className="min-w-0 flex-1">{t.message}{(t.count ?? 1) > 1 && <span className="tnum ml-1.5 rounded-full bg-danger-soft px-1.5 text-xs font-semibold text-danger" aria-label={`${t.count} times`}>×{t.count}</span>}</span>
      {t.action && <Button size="sm" intent="edit-ghost" onClick={() => { t.action!.run(); onDismiss() }}>{t.action.label}</Button>}
      <IconButton label="Dismiss" className="-mr-1 h-9 w-9" onClick={onDismiss}><X className="size-4" /></IconButton>
    </div>
  )
}
