import { apiClient } from './client'

/** Métadonnées d'un lien de téléchargement, telles que renvoyées par GET /downloads/{token}. */
export interface DownloadMetadata {
  name: string
  size: number
  mimeType: string
  expiresAt: string
  hasPassword: boolean
}

interface PresignedDownloadUrl {
  presignedUrl: string
  expiresIn: number
}

// Routes publiques : skipAuth, pour qu'un mauvais mot de passe (401) ne ferme
// pas la session d'un visiteur connecté. Voir api/client.ts.

/** Lit les métadonnées du fichier ; 410 si le lien est expiré ou inconnu. */
export async function getDownloadMetadata(
  downloadToken: string,
  { signal }: { signal?: AbortSignal } = {},
): Promise<DownloadMetadata> {
  const { data } = await apiClient.get<DownloadMetadata>(
    `/downloads/${encodeURIComponent(downloadToken)}`,
    { signal, skipAuth: true },
  )
  return data
}

/**
 * Demande l'URL présignée du fichier, après vérification du mot de passe s'il
 * en a un. Elle n'est valable que quelques dizaines de secondes.
 */
export async function requestDownloadUrl(
  downloadToken: string,
  password?: string,
): Promise<string> {
  const { data } = await apiClient.post<PresignedDownloadUrl>(
    `/downloads/${encodeURIComponent(downloadToken)}`,
    password ? { password } : {},
    { skipAuth: true },
  )
  return data.presignedUrl
}
