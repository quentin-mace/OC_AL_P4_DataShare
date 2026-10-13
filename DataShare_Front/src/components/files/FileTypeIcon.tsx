import { FileImage, FileMusic, FilePlay, FileText } from 'lucide-react'

export interface FileTypeIconProps {
  mimeType: string
  className?: string
}

/** Icône décorative d'un fichier d'après son type MIME, comme sur les maquettes de l'historique. */
export function FileTypeIcon({ mimeType, className }: FileTypeIconProps) {
  if (mimeType.startsWith('image/')) return <FileImage aria-hidden="true" className={className} />
  if (mimeType.startsWith('audio/')) return <FileMusic aria-hidden="true" className={className} />
  if (mimeType.startsWith('video/')) return <FilePlay aria-hidden="true" className={className} />
  return <FileText aria-hidden="true" className={className} />
}
