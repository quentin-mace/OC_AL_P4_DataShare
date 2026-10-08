import { Copy, FileText } from 'lucide-react'
import { useState } from 'react'
import type { UploadedFile } from '../../api/files'
import { formatFileSize } from '../../format/fileSize'
import { paths } from '../../routes/paths'
import type { UploadFormValues } from '../../validation/uploadSchema'
import { Button } from '../ui/Button'
import { expirationPhrase } from './expiration'

export interface UploadSuccessProps {
  file: UploadedFile
  expiresInDays: UploadFormValues['expiresInDays']
}

export function UploadSuccess({ file, expiresInDays }: UploadSuccessProps) {
  const [copied, setCopied] = useState(false)
  const link = `${window.location.origin}${paths.download(file.downloadToken)}`

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      // Presse-papiers refusé (contexte non sécurisé, permission) : le lien
      // reste affiché, l'utilisateur peut le copier à la main.
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <FileText aria-hidden="true" className="size-5 shrink-0 text-ink" />
        <div className="min-w-0">
          <p className="truncate text-sm text-ink" title={file.name}>
            {file.name}
          </p>
          <p className="text-xs text-ink-muted">{formatFileSize(file.size)}</p>
        </div>
      </div>
      <output className="block text-sm">
        Félicitations, ton fichier sera conservé chez nous pendant {expirationPhrase(expiresInDays)}{' '}
        !
      </output>
      <a
        href={link}
        className="block truncate rounded-control bg-row px-3 py-2 text-sm text-accent underline"
      >
        {link}
      </a>
      <Button
        className="self-center"
        leadingIcon={<Copy className="size-4" />}
        onClick={() => void copyLink()}
      >
        {copied ? 'Lien copié' : 'Copier le lien'}
      </Button>
    </div>
  )
}
