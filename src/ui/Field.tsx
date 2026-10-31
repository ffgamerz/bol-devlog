import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

const control = 'w-full rounded-md border border-border bg-surface-2 px-3 text-fg placeholder:text-faint ' +
  'transition-[border-color,box-shadow] duration-150 hover:border-border-strong ' +
  'focus:border-accent aria-[invalid=true]:border-danger disabled:opacity-60'

function Wrap({ id, label, hint, error, children, className }: { id: string; label?: ReactNode; hint?: ReactNode; error?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && <label htmlFor={id} className="block text-sm font-medium">{label}</label>}
      {children}
      {error ? <p id={`${id}-msg`} className="text-xs text-danger">{error}</p> : hint ? <p id={`${id}-msg`} className="text-xs text-muted">{hint}</p> : null}
    </div>
  )
}
type Extra = { label?: ReactNode; hint?: ReactNode; error?: ReactNode; wrapClassName?: string; trailing?: ReactNode }

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & Extra>(function Input({ label, hint, error, wrapClassName, trailing, className, id, ...rest }, ref) {
  const auto = useId(); const fid = id ?? auto
  return (
    <Wrap id={fid} label={label} hint={hint} error={error} className={wrapClassName}>
      <div className="relative">
        <input ref={ref} id={fid} name={fid} aria-invalid={!!error || undefined} aria-describedby={hint || error ? `${fid}-msg` : undefined}
          className={cn(control, 'h-11 lg:h-10', trailing && 'pr-11', className)} {...rest} />
        {trailing && <div className="absolute inset-y-0 right-0 flex items-center">{trailing}</div>}
      </div>
    </Wrap>
  )
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & Extra>(function Textarea({ label, hint, error, wrapClassName, className, id, ...rest }, ref) {
  const auto = useId(); const fid = id ?? auto
  return (
    <Wrap id={fid} label={label} hint={hint} error={error} className={wrapClassName}>
      <textarea ref={ref} id={fid} name={fid} aria-invalid={!!error || undefined} className={cn(control, 'min-h-24 py-2.5 leading-relaxed', className)} {...rest} />
    </Wrap>
  )
})

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & Extra>(function Select({ label, hint, error, wrapClassName, className, id, children, ...rest }, ref) {
  const auto = useId(); const fid = id ?? auto
  return (
    <Wrap id={fid} label={label} hint={hint} error={error} className={wrapClassName}>
      <div className="relative">
        <select ref={ref} id={fid} name={fid} className={cn(control, 'h-11 appearance-none pr-8 leading-tight lg:h-9 lg:text-sm', className)} {...rest}>{children}</select>
        <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 size-3 -translate-y-1/2 text-muted" strokeWidth={2.5} />
      </div>
    </Wrap>
  )
})
