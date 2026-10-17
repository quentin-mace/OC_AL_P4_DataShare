export interface TestUser {
  email: string
  firstName: string
  lastName: string
  password: string
}

function randomSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Un compte neuf par test : la base de dev n'est jamais remise a zero, et le
 * throttling de connexion (5 essais par compte) ne deborde pas d'un test a
 * l'autre. Le mot de passe melange les classes de caracteres pour atteindre
 * la force exigee par l'inscription (16 caracteres, score "medium").
 */
export function uniqueUser(): TestUser {
  const suffix = randomSuffix()
  return {
    email: `e2e-${suffix}@example.test`,
    firstName: 'Camille',
    lastName: 'Testeur',
    password: `E2e!${suffix}#Zq7vLm`,
  }
}

/** Le jeton de telechargement d'un lien de partage (32 caracteres hexadecimaux). */
export const DOWNLOAD_LINK = /\/download\/([0-9a-f]{32})$/

/** Racine de l'API, pour preparer ou verifier un etat sans passer par l'UI. */
export const apiUrl = (): string => Cypress.expose('apiUrl') as string
