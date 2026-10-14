import { Trash2 } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { deleteFile, type FileHistoryItem } from '../../api/files'
import { Button } from '../ui/Button'
import { Callout } from '../ui/Callout'
import { Modal } from '../ui/Modal'

export interface DeleteFileDialogProps {
  /** Fichier à supprimer : la modale est ouverte tant qu'il y en a un. */
  file: FileHistoryItem | null
  onClose: () => void
  /** Le fichier n'existe plus côté serveur ; la modale reste au parent à fermer. */
  onDeleted: (file: FileHistoryItem) => void
}

/** Confirmation avant la suppression définitive d'un fichier (US06). */
export function DeleteFileDialog({ file, onClose, onDeleted }: DeleteFileDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const messageId = useId()
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  // Les boutons désactivés pendant la requête perdent le focus : après un échec,
  // il revient sur "Annuler" plutôt que de rester perdu sur la page.
  useEffect(() => {
    if (failed) cancelRef.current?.focus()
  }, [failed])

  // Pendant la requête, la modale reste ouverte : la fermer laisserait croire
  // à une annulation alors que la suppression peut encore aboutir.
  function close() {
    if (pending) return
    setFailed(false)
    onClose()
  }

  async function confirm(target: FileHistoryItem) {
    setPending(true)
    setFailed(false)
    try {
      await deleteFile(target.id)
    } catch {
      setFailed(true)
      return
    } finally {
      setPending(false)
    }
    onDeleted(target)
  }

  return (
    <Modal
      open={file !== null}
      title="Supprimer ce fichier ?"
      role="alertdialog"
      descriptionId={messageId}
      initialFocus={cancelRef}
      onClose={close}
    >
      {file && (
        <div className="flex flex-col gap-4">
          <p id={messageId} className="text-sm">
            <span className="font-semibold break-all text-ink">{file.name}</span> sera supprimé
            définitivement, et son lien de partage ne fonctionnera plus. Cette action est
            irréversible.
          </p>
          {failed && (
            <Callout variant="error">
              Impossible de supprimer ce fichier pour le moment, réessayez plus tard.
            </Callout>
          )}
          <div className="flex justify-end gap-2">
            <Button ref={cancelRef} variant="outline" disabled={pending} onClick={close}>
              Annuler
            </Button>
            <Button
              disabled={pending}
              leadingIcon={<Trash2 className="size-4" />}
              onClick={() => void confirm(file)}
            >
              {pending ? 'Suppression...' : 'Supprimer'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
