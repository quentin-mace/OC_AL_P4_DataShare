import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Modal } from './Modal'

describe('Modal', () => {
  it('renders nothing while closed', () => {
    render(
      <Modal open={false} title="Ajouter un fichier" onClose={() => {}}>
        Contenu
      </Modal>,
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('is named by its title', () => {
    render(
      <Modal open title="Ajouter un fichier" onClose={() => {}}>
        Contenu
      </Modal>,
    )

    expect(screen.getByRole('dialog', { name: 'Ajouter un fichier' })).toHaveTextContent('Contenu')
  })

  it('asks its parent to close from the close button', async () => {
    const onClose = vi.fn<() => void>()
    render(
      <Modal open title="Ajouter un fichier" onClose={onClose}>
        Contenu
      </Modal>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('asks its parent to close on Escape', () => {
    const onClose = vi.fn<() => void>()
    render(
      <Modal open title="Ajouter un fichier" onClose={onClose}>
        Contenu
      </Modal>,
    )

    // Le navigateur traduit Échap en événement cancel sur la modale.
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))

    expect(onClose).toHaveBeenCalledOnce()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('can ask for a confirmation as an alert dialog, described by its message', () => {
    render(
      <Modal
        open
        title="Supprimer ce fichier ?"
        role="alertdialog"
        descriptionId="message"
        onClose={() => {}}
      >
        <p id="message">Cette action est irréversible.</p>
      </Modal>,
    )

    expect(
      screen.getByRole('alertdialog', { name: 'Supprimer ce fichier ?' }),
    ).toHaveAccessibleDescription('Cette action est irréversible.')
  })

  it('focuses the requested element when it opens', () => {
    function WithInitialFocus() {
      const cancelRef = useRef<HTMLButtonElement>(null)
      return (
        <Modal open title="Supprimer ce fichier ?" initialFocus={cancelRef} onClose={() => {}}>
          <button ref={cancelRef}>Annuler</button>
        </Modal>
      )
    }
    render(<WithInitialFocus />)

    expect(screen.getByRole('button', { name: 'Annuler' })).toHaveFocus()
  })
})
