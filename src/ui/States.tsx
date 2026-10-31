import { Component, type ReactNode } from 'react'
import { Inbox, SearchX, Filter, AlertOctagon, WifiOff } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from './Button'

export type EmptyVariant = 'first-run' | 'no-results' | 'filtered' | 'error'
const icons: Record<EmptyVariant, ReactNode> = {
  'first-run': <Inbox />, 'no-results': <SearchX />, filtered: <Filter />, error: <AlertOctagon />,
}

/** One empty state for all four cases; each offers a way forward. */
export function EmptyState({ variant = 'first-run', title, message, action, className }: {
  variant?: EmptyVariant; title: string; message?: ReactNode
  action?: { label: string; onClick: () => void; intent?: 'add' | 'utility' | 'cancel' }; className?: string
}) {
  const err = variant === 'error'
  return (
    <div role={err ? 'alert' : 'status'} className={cn('mx-auto flex max-w-sm flex-col items-center px-4 py-12 text-center animate-fade-up', className)}>
      <div className={cn('mb-4 grid size-14 place-items-center rounded-2xl [&>svg]:size-7', err ? 'bg-danger-soft text-danger' : 'bg-accent-soft text-accent-text')}>
        {icons[variant]}
      </div>
      <h3 className="font-semibold">{title}</h3>
      {message && <p className="mt-1 text-sm text-muted">{message}</p>}
      {action && (
        <Button className="mt-5" intent={action.intent ?? (err ? 'utility' : variant === 'first-run' ? 'add' : 'cancel')} onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}

export const ErrorState = ({ message = 'Something went wrong while loading.', onRetry }: { message?: string; onRetry?: () => void }) => (
  <EmptyState variant="error" title="Couldn't load this" message={message} action={onRetry ? { label: 'Retry', onClick: onRetry } : undefined} />
)

export const OfflineBanner = () => (
  <div role="status" className="flex items-center gap-2 border-b border-warning/30 bg-warning-soft px-4 py-2 text-sm text-warning">
    <WifiOff className="size-4" /> You're offline. Changes won't save until you reconnect.
  </div>
)

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed
      ? <ErrorState message="This page hit an unexpected error." onRetry={() => window.location.reload()} />
      : this.props.children
  }
}
