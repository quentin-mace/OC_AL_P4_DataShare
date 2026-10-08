import { useState } from 'react'
import type { UploadedFile } from '../../api/files'
import type { UploadFormValues } from '../../validation/uploadSchema'
import { Modal } from '../ui/Modal'
import { UploadForm } from './UploadForm'
import { UploadSuccess } from './UploadSuccess'

export interface UploadDialogProps {
  open: boolean
  onClose: () => void
}

interface Upload {
  file: UploadedFile
  expiresInDays: UploadFormValues['expiresInDays']
}

/** Formulaire d'envoi puis lien de partage, dans une même modale (US01). */
export function UploadDialog({ open, onClose }: UploadDialogProps) {
  const [upload, setUpload] = useState<Upload | null>(null)

  // Rouvrir la modale repart d'un formulaire vierge.
  function close() {
    setUpload(null)
    onClose()
  }

  return (
    <Modal open={open} title="Ajouter un fichier" onClose={close}>
      {upload ? (
        <UploadSuccess file={upload.file} expiresInDays={upload.expiresInDays} />
      ) : (
        <UploadForm onUploaded={(file, { expiresInDays }) => setUpload({ file, expiresInDays })} />
      )}
    </Modal>
  )
}
