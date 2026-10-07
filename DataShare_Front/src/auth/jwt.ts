/**
 * Lit la date d'expiration du JWT, sans en vérifier la signature : ce n'est
 * qu'un indicateur pour ne pas envoyer un token périmé, l'API reste seule à
 * faire foi. Un token illisible est traité comme expiré.
 */
export function isTokenExpired(token: string, now: number = Date.now()): boolean {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const { exp } = JSON.parse(atob(payload)) as { exp?: unknown }
    return typeof exp !== 'number' || exp * 1000 <= now
  } catch {
    return true
  }
}
