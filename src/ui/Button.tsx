import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Colour by meaning:
 *  save → green (Save / Submit / Confirm) · add → teal (New / Add)
 *  cancel → grey outline (Cancel / Back) · delete → red · edit → blue
 *  utility → calm grey (Print / Download / Search / Copy) · ghost → text only
 */
export const buttonStyles = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold select-none ' +
    'transition-[background-color,border-color,color,transform,box-shadow] duration-150 ease-out ' +
    'active:scale-[.97] active:duration-75 disabled:opacity-50 disabled:pointer-events-none ' +
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
  {
    variants: {
      intent: {
        save: 'bg-success text-success-fg hover:brightness-110',
        add: 'bg-accent text-accent-fg hover:brightness-110',
        cancel: 'border border-border-strong text-muted bg-transparent hover:bg-surface-2 hover:text-fg',
        delete: 'bg-danger text-danger-fg hover:brightness-110',
        edit: 'bg-info text-info-fg hover:brightness-110',
        utility: 'bg-surface-2 text-fg border border-border hover:bg-surface-3',
        ghost: 'bg-transparent text-muted hover:text-fg hover:bg-surface-2',
        'delete-ghost': 'bg-transparent text-danger hover:bg-danger-soft',
        'edit-ghost': 'bg-transparent text-info hover:bg-info-soft',
        /** AI actions: violet, so teal stays reserved for New/Add */
        ai: 'bg-ai-soft text-ai border border-ai/40 hover:bg-ai/15',
      },
      size: {
        sm: 'h-9 px-3 text-sm [@media(pointer:coarse)]:h-11 max-sm:!h-12',
        md: 'h-11 px-4 text-sm max-sm:h-12 lg:h-10',
        lg: 'h-12 px-5 text-base',
        icon: 'h-11 w-11 p-0 lg:h-10 lg:w-10 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11 max-sm:!size-12',
      },
      block: { true: 'w-full' },
    },
    defaultVariants: { intent: 'utility', size: 'md' },
  },
)

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonStyles> & { loading?: boolean; icon?: ReactNode; loadingText?: string }

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, intent, size, block, loading, icon, loadingText, children, disabled, type = 'button', ...rest }, ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonStyles({ intent, size, block }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {loading && loadingText ? loadingText : children}
    </button>
  )
})

/** Icon-only button: always has an accessible label and a 44px target on touch. */
export const IconButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, 'size' | 'children'> & { label: string; children: ReactNode }>(
  function IconButton({ label, intent = 'ghost', children, ...rest }, ref) {
    return (
      <Button ref={ref} size="icon" intent={intent} aria-label={label} title={label} {...rest}>
        {children}
      </Button>
    )
  },
)
