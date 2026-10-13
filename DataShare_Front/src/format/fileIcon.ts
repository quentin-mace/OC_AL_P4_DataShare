import { FileImage, FileMusic, FilePlay, FileText, type LucideIcon } from 'lucide-react'

/** Icône d'un fichier d'après son type MIME, comme sur les maquettes de l'historique. */
export function fileIcon(mimeType: string): LucideIcon {
  if (mimeType.startsWith('image/')) return FileImage
  if (mimeType.startsWith('audio/')) return FileMusic
  if (mimeType.startsWith('video/')) return FilePlay
  return FileText
}
