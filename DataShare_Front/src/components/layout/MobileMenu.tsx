import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Copyright } from './Copyright'
import { SidebarNav } from './SidebarNav'

export interface MobileMenuProps {
  open: boolean
  onClose: () => void
}

/**
 * Sidebar repliable de l'espace personnel sur mobile. Même mécanique que Modal
 * (<dialog> natif ouvert par showModal()) : focus piégé, Échap, arrière-plan
 * inerte. Un clic sur le voile ou sur un lien la referme aussi.
 */
export function MobileMenu({ open, onClose }: MobileMenuProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!open || !dialog) return
    dialog.showModal()
    return () => dialog.close()
  }, [open])

  if (!open) return null

  return (
    // Le voile (::backdrop) appartient au <dialog> : un clic dessus a le
    // dialog lui-même pour cible, un clic dans le panneau l'un de ses enfants.
    // Le clavier n'en a pas besoin, Échap et le bouton Fermer y pourvoient.
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={dialogRef}
      aria-label="Menu"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      className="m-0 h-full max-h-none w-72 max-w-[85%] bg-transparent p-0 backdrop:bg-ink/40"
    >
      <div className="flex h-full flex-col bg-linear-to-b from-brand-from to-brand-to p-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={onClose}
            className="cursor-pointer rounded-control p-1 text-white focus-visible:outline-2 focus-visible:outline-white"
          >
            <X aria-hidden="true" className="size-6" />
          </button>
          <span className="text-2xl font-bold text-white">DataShare</span>
        </div>
        <SidebarNav onNavigate={onClose} />
        <Copyright className="text-sm text-white" />
      </div>
    </dialog>
  )
}
