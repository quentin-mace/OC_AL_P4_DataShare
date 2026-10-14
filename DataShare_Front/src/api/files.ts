import type { AxiosProgressEvent } from 'axios'
import type { UploadFormValues } from '../validation/uploadSchema'
import { apiClient } from './client'
import { getStatus } from './problem'

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

/** Fichier de l'historique, tel que renvoyé par GET /files. */
export interface FileHistoryItem {
  id: number
  name: string
  size: number
  mimeType: string
  sentAt: string
  expiresAt: string
  /** Dérivé de expiresAt par l'API, au moment de la requête. */
  status: 'active' | 'expired'
  hasPassword: boolean
  downloadToken: string
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

/**
 * Historique complet du compte connecté, du plus récent au plus ancien, y
 * compris les fichiers expirés. Filtres et pagination sont appliqués côté
 * client : voir contrat-api.md.
 */
export async function listFiles({ signal }: { signal?: AbortSignal } = {}): Promise<
  FileHistoryItem[]
> {
  const { data } = await apiClient.get<FileHistoryItem[]>('/files', { signal })
  return data
}

/**
 * Supprime un fichier du compte connecté, objet stocké compris (US06). Un
 * fichier expiré se supprime aussi : il ne reste alors que sa ligne d'historique.
 * Un 404 vaut succès, le fichier n'existe déjà plus : c'est le résultat voulu.
 */
export async function deleteFile(id: number): Promise<void> {
  try {
    await apiClient.delete(`/files/${id}`)
  } catch (error) {
    if (getStatus(error) !== 404) throw error
  }
}
