import { FileText } from 'lucide-react'
import { useId, useRef } from 'react'
import { formatFileSize } from '../../format/fileSize'
import { Button } from './Button'
import { errorStyles } from './fieldStyles'

export interface FileFieldProps {
  /** Nom accessible du sélecteur, non affiché (la maquette n'en dessine pas). */
  label: string
  file?: File
  onChange: (file: File | undefined) => void
  onBlur?: () => void
  error?: string
  disabled?: boolean
}

/**
 * Choix d'un fichier, dessiné comme la maquette : nom, taille et "Changer".
 * L'<input type="file"> natif reste dans la page, masqué, pour le sélecteur du
 * système ; les boutons visibles ne font que l'ouvrir.
 */
export function FileField({ label, file, onChange, onBlur, error, disabled }: FileFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const errorId = `${inputId}-error`
  const describedBy = error ? errorId : undefined

  const openPicker = () => inputRef.current?.click()

  return (
    <div>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        aria-label={label}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        tabIndex={-1}
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          // Annuler le sélecteur ne retire pas le fichier déjà choisi.
          const picked = event.target.files?.[0]
          if (picked) onChange(picked)
          // Permet de choisir à nouveau le même fichier après une erreur.
          event.target.value = ''
          onBlur?.()
        }}
      />
      {file ? (
        <div className="flex items-center gap-3">
          <FileText aria-hidden="true" className="size-5 shrink-0 text-ink" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-ink" title={file.name}>
              {file.name}
            </p>
            <p className="text-xs text-ink-muted">{formatFileSize(file.size)}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            aria-describedby={describedBy}
            onClick={openPicker}
          >
            Changer
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          fullWidth
          disabled={disabled}
          aria-describedby={describedBy}
          onClick={openPicker}
        >
          Choisir un fichier
        </Button>
      )}
      {error && (
        <p id={errorId} className={errorStyles}>
          {error}
        </p>
      )}
    </div>
  )
}
