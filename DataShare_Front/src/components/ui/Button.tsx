import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { buttonStyles, type ButtonStyleOptions } from './buttonStyles'
import { joinClassNames } from './joinClassNames'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonStyleOptions {
  leadingIcon?: ReactNode
  trailingIcon?: ReactNode
}

export function Button({
  variant,
  size,
  fullWidth,
  leadingIcon,
  trailingIcon,
  className,
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    // type="button" par défaut : dans un formulaire, un bouton sans type le soumet.
    <button
      type={type}
      className={joinClassNames(buttonStyles({ variant, size, fullWidth }), className)}
      {...props}
    >
      {leadingIcon && <span aria-hidden="true">{leadingIcon}</span>}
      {children}
      {trailingIcon && <span aria-hidden="true">{trailingIcon}</span>}
    </button>
  )
}
