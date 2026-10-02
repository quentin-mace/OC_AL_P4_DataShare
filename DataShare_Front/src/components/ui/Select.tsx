import { ChevronDown } from 'lucide-react'
import { useId, type Ref, type SelectHTMLAttributes } from 'react'
import { joinClassNames } from './joinClassNames'
import { errorStyles, fieldStyles, labelStyles } from './fieldStyles'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  options: SelectOption[]
  error?: string
  ref?: Ref<HTMLSelectElement>
}

// <select> natif : clavier, lecteurs d'écran et sélecteur mobile sans code à écrire.
export function Select({ label, options, error, id, className, ...props }: SelectProps) {
  const generatedId = useId()
  const selectId = id ?? generatedId
  const errorId = `${selectId}-error`

  return (
    <div className={className}>
      <label htmlFor={selectId} className={labelStyles}>
        {label}
      </label>
      <div className="relative">
        <select
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={joinClassNames(
            fieldStyles,
            'appearance-none pr-8',
            error ? 'border-danger' : 'border-line',
          )}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-ink"
        />
      </div>
      {error && (
        <p id={errorId} className={errorStyles}>
          {error}
        </p>
      )}
    </div>
  )
}
