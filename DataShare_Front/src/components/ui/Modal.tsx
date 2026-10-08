import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Button } from './Button'

export interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

/**
 * Fenêtre modale sur <dialog> natif : showModal() apporte le piège du focus,
 * l'arrière-plan inerte, la touche Échap et le retour du focus à la fermeture.
 * Composant contrôlé : Échap passe par onClose, c'est le parent qui ferme.
 */
export function Modal({ open, title, onClose, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!open || !dialog) return
    dialog.showModal()
    return () => dialog.close()
  }, [open])

  if (!open) return null

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-card bg-surface p-6 text-ink-muted shadow-card backdrop:bg-ink/40"
    >
      <div className="mb-4 flex items-start justify-between gap-2">
        <h2 id={titleId} className="text-xl font-bold text-ink">
          {title}
        </h2>
        <Button variant="ghost" size="sm" aria-label="Fermer" onClick={onClose}>
          <X aria-hidden="true" className="size-4" />
        </Button>
      </div>
      {children}
    </dialog>
  )
}
