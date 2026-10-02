import { CircleAlert, Info, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { joinClassNames } from './joinClassNames'

export type CalloutVariant = 'info' | 'warning' | 'error'

const variants: Record<CalloutVariant, { icon: LucideIcon; className: string }> = {
  info: { icon: Info, className: 'border-info-border bg-info-soft text-info-ink' },
  warning: {
    icon: TriangleAlert,
    className: 'border-warning-border bg-warning-soft text-warning-ink',
  },
  error: { icon: CircleAlert, className: 'border-error-border bg-error-soft text-error-ink' },
}

export interface CalloutProps {
  variant?: CalloutVariant
  children: ReactNode
  className?: string
}

export function Callout({ variant = 'info', children, className }: CalloutProps) {
  const { icon: Icon, className: variantClassName } = variants[variant]

  return (
    // Une erreur est annoncée immédiatement, une information à la prochaine pause.
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={joinClassNames(
        'flex items-center gap-2 rounded-control border px-2.5 py-1.5 text-xs',
        variantClassName,
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  )
}
