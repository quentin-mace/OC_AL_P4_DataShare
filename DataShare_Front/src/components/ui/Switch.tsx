import { useId } from 'react'

export interface SwitchOption<T extends string> {
  value: T
  label: string
}

export interface SwitchProps<T extends string> {
  label: string
  options: SwitchOption<T>[]
  value: T
  onChange: (value: T) => void
}

/**
 * Sélecteur segmenté (filtre Tous / Actifs / Expiré). Construit sur de vrais
 * boutons radio, masqués visuellement : les flèches du clavier et l'annonce
 * "1 sur 3, sélectionné" viennent du navigateur.
 */
export function Switch<T extends string>({ label, options, value, onChange }: SwitchProps<T>) {
  const name = useId()

  return (
    <fieldset className="inline-flex overflow-hidden rounded-full border border-accent-border/60 bg-accent-soft">
      <legend className="sr-only">{label}</legend>
      {options.map((option) => (
        <label
          key={option.value}
          className="cursor-pointer px-3.5 py-1 text-sm text-ink transition has-checked:bg-coral has-checked:text-white has-focus-visible:outline-2 has-focus-visible:-outline-offset-2 has-focus-visible:outline-accent-strong"
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
            className="sr-only"
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  )
}
