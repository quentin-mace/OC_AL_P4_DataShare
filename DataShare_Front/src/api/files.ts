import type { AxiosProgressEvent } from 'axios'
import type { UploadFormValues } from '../validation/uploadSchema'
import { apiClient } from './client'

/** Fichier tel que renvoyé par POST /files (201). */
export interface UploadedFile {
  id: number
  name: string
  size: number
  mimeType: string
  downloadToken: string
  expiresAt: string
  hasPassword: boolean
  tags: string[]
}

export interface UploadOptions {
  /** Avancement de l'envoi, de 0 à 100 ; le stockage côté serveur suit les 100 %. */
  onProgress?: (percent: number) => void
  /** Interrompt l'envoi, par exemple quand l'utilisateur ferme le formulaire. */
  signal?: AbortSignal
}

/** Envoie le fichier en multipart. */
export async function uploadFile(
  { file, password, expiresInDays, tags }: UploadFormValues,
  { onProgress, signal }: UploadOptions = {},
): Promise<UploadedFile> {
  const body = new FormData()
  body.append('file', file)
  body.append('expiresInDays', expiresInDays)
  if (password) {
    body.append('password', password)
  }
  // Forme "tags[]" répétée plutôt qu'une liste à virgules : voir contrat-api.md.
  tags.forEach((tag) => body.append('tags[]', tag))

  const { data } = await apiClient.post<UploadedFile>('/files', body, {
    signal,
    onUploadProgress: ({ progress }: AxiosProgressEvent) =>
      onProgress?.(Math.round((progress ?? 0) * 100)),
  })
  return data
}
