// Portage de l'estimateur par défaut de la contrainte PasswordStrength de
// Symfony (PasswordStrengthValidator::estimateStrength). Le serveur reste seul
// à faire foi : ce calcul ne sert qu'à afficher l'erreur avant l'envoi.

export const PASSWORD_STRENGTH = {
  veryWeak: 0,
  weak: 1,
  medium: 2,
  strong: 3,
  veryStrong: 4,
} as const

export type PasswordStrengthScore = (typeof PASSWORD_STRENGTH)[keyof typeof PASSWORD_STRENGTH]

// Valeur par défaut de minScore côté back, aucune option n'étant passée à la contrainte.
export const MIN_PASSWORD_SCORE: PasswordStrengthScore = PASSWORD_STRENGTH.medium

// Taille de l'alphabet que chaque classe d'octets ajoute au calcul.
function poolOf(byte: number): { key: string; size: number } {
  if (byte < 32 || byte === 127) return { key: 'control', size: 33 }
  if (byte >= 48 && byte <= 57) return { key: 'digit', size: 10 }
  if (byte >= 65 && byte <= 90) return { key: 'upper', size: 26 }
  if (byte >= 97 && byte <= 122) return { key: 'lower', size: 26 }
  if (byte >= 128) return { key: 'other', size: 128 }
  return { key: 'symbol', size: 33 }
}

/**
 * Entropie estimée en bits. PHP raisonne en octets (strlen, count_chars) :
 * le calcul se fait donc sur l'encodage UTF-8, et un caractère accentué
 * compte pour plusieurs octets de la classe "other", comme côté serveur.
 */
export function passwordEntropy(password: string): number {
  const bytes = new TextEncoder().encode(password)
  if (bytes.length === 0) return 0

  const distinct = new Set(bytes)
  const pools = new Map<string, number>()
  for (const byte of distinct) {
    const { key, size } = poolOf(byte)
    pools.set(key, size)
  }
  const pool = [...pools.values()].reduce((sum, size) => sum + size, 0)

  // Seuls les octets distincts apportent l'entropie de l'alphabet, les
  // répétitions ne valent que le choix parmi les octets déjà présents.
  return distinct.size * Math.log2(pool) + (bytes.length - distinct.size) * Math.log2(distinct.size)
}

export function passwordStrength(password: string): PasswordStrengthScore {
  const entropy = passwordEntropy(password)

  if (entropy >= 120) return PASSWORD_STRENGTH.veryStrong
  if (entropy >= 100) return PASSWORD_STRENGTH.strong
  if (entropy >= 80) return PASSWORD_STRENGTH.medium
  if (entropy >= 60) return PASSWORD_STRENGTH.weak
  return PASSWORD_STRENGTH.veryWeak
}
