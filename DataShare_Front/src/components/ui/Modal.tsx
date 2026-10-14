import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react'
import { Button } from './Button'

export interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  /**
   * "alertdialog" pour une demande de confirmation, qui interrompt l'utilisateur
   * et attend sa réponse ; "dialog" (défaut) pour tout le reste.
   */
  role?: 'dialog' | 'alertdialog'
  /** Élément du contenu qui décrit la modale, annoncé après son titre. */
  descriptionId?: string
  /**
   * Élément à focaliser à l'ouverture. Sans lui, showModal() focalise le premier
   * élément focalisable, le bouton "Fermer". L'autoFocus de React ne convient
   * pas : il agit au montage, avant showModal(), qui le remplace.
   */
  initialFocus?: RefObject<HTMLElement | null>
}

/**
 * Fenêtre modale sur <dialog> natif : showModal() apporte le piège du focus,
 * l'arrière-plan inerte, la touche Échap et le retour du focus à la fermeture.
 * Composant contrôlé : Échap passe par onClose, c'est le parent qui ferme.
 */
export function Modal({
  open,
  title,
  onClose,
  children,
  role = 'dialog',
  descriptionId,
  initialFocus,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!open || !dialog) return
    dialog.showModal()
    initialFocus?.current?.focus()
    return () => dialog.close()
  }, [open, initialFocus])

  if (!open) return null

  return (
    <dialog
      ref={dialogRef}
      role={role}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
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
