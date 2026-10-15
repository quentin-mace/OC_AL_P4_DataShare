import { X } from 'lucide-react'
import { joinClassNames } from './joinClassNames'

export interface TagProps {
  name: string
  /** Rend la pastille cliquable, par exemple pour filtrer sur ce tag. */
  onClick?: () => void
  /** Nom accessible du bouton, qui doit contenir le nom du tag. */
  clickLabel?: string
  /** Désactive la pastille cliquable, par exemple pendant une requête. */
  disabled?: boolean
  /** Ajoute une croix pour retirer le tag, ou le filtre qu'il représente. */
  onRemove?: () => void
  removeLabel?: string
}

const pillStyles =
  'inline-flex h-5 max-w-full items-center gap-0.5 rounded-full border border-accent-border bg-accent-soft text-xs text-accent-strong'

const focusStyles =
  'enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

/**
 * Pastille d'un tag (US08) : simple texte, bouton si onClick est fourni, et
 * croix de retrait si onRemove l'est. Un nom trop long est tronqué, et reste
 * lisible en entier au survol.
 */
export function Tag({ name, onClick, clickLabel, disabled, onRemove, removeLabel }: TagProps) {
  const label = (
    <span className="truncate" title={name}>
      {name}
    </span>
  )

  return (
    <span className={joinClassNames(pillStyles, onRemove ? 'pr-0.5 pl-2' : 'px-2')}>
      {onClick ? (
        <button
          type="button"
          aria-label={clickLabel}
          disabled={disabled}
          onClick={onClick}
          className={joinClassNames('min-w-0 rounded-full enabled:hover:underline', focusStyles)}
        >
          {label}
        </button>
      ) : (
        label
      )}
      {onRemove && (
        <button
          type="button"
          aria-label={removeLabel ?? `Retirer ${name}`}
          onClick={onRemove}
          className={joinClassNames('rounded-full p-0.5 hover:bg-accent/15', focusStyles)}
        >
          <X aria-hidden="true" className="size-3" />
        </button>
      )}
    </span>
  )
}
