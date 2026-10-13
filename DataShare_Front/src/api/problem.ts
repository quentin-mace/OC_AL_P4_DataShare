import { isAxiosError } from 'axios'

/** Un champ refusé par la validation serveur (RFC 7807, format API Platform). */
export interface Violation {
  propertyPath: string
  message: string
  code?: string
}

/**
 * Renvoie les violations d'une réponse 422, ou null pour toute autre erreur
 * (réseau, 5xx...). Les messages de l'API sont en anglais : le front choisit
 * son libellé d'après propertyPath et code.
 */
export function getViolations(error: unknown): Violation[] | null {
  if (!isAxiosError(error) || error.response?.status !== 422) return null

  const violations: unknown = error.response.data?.violations
  return Array.isArray(violations) ? violations : null
}

/** Code HTTP d'une réponse en erreur, ou null sans réponse (réseau, CORS...). */
export function getStatus(error: unknown): number | null {
  return isAxiosError(error) ? (error.response?.status ?? null) : null
}

/**
 * Délai en secondes avant la prochaine tentative, lu dans l'en-tête Retry-After
 * d'un 429, ou null s'il est absent ou illisible.
 */
export function getRetryAfter(error: unknown): number | null {
  if (!isAxiosError(error)) return null

  const seconds = Number(error.response?.headers['retry-after'])
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null
}
