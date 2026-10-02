import { useId, type InputHTMLAttributes, type Ref } from 'react'
import { cx } from './cx'
import { errorStyles, fieldStyles, labelStyles } from './fieldStyles'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  // En React 19, ref est une prop : register() de react-hook-form s'y branche directement.
  ref?: Ref<HTMLInputElement>
}

export function Input({ label, error, id, className, ...props }: InputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const errorId = `${inputId}-error`

  return (
    <div className={className}>
      <label htmlFor={inputId} className={labelStyles}>
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cx(fieldStyles, error ? 'border-danger' : 'border-line')}
        {...props}
      />
      {error && (
        <p id={errorId} className={errorStyles}>
          {error}
        </p>
      )}
    </div>
  )
}
