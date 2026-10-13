import type { CalloutVariant } from '../components/ui/Callout'

const DAY_IN_MS = 24 * 60 * 60 * 1000

/**
 * Nombre de jours calendaires, dans le fuseau du navigateur, entre aujourd'hui
 * et la date d'expiration : 0 le jour même, 1 la veille, quelle que soit l'heure.
 */
export function daysUntil(expiresAt: string | Date, now: Date = new Date()): number {
  const expiry = new Date(expiresAt)
  // Date.UTC neutralise les changements d'heure, qui font des jours de 23 ou 25 h.
  const day = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  return Math.round((day(expiry) - day(now)) / DAY_IN_MS)
}

export interface ExpirationNotice {
  variant: CalloutVariant
  text: string
}

/** Bandeau des maquettes : avertissement la veille et le jour même, information avant. */
export function expirationNotice(days: number): ExpirationNotice {
  if (days <= 0) return { variant: 'warning', text: "Ce fichier expire aujourd'hui." }
  if (days === 1) return { variant: 'warning', text: 'Ce fichier expirera demain.' }
  return { variant: 'info', text: `Ce fichier expirera dans ${days} jours.` }
}
