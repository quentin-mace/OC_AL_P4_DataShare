import type { SelectOption } from '../ui/Select'
import { expirationValues } from '../../validation/uploadSchema'

type ExpiresInDays = (typeof expirationValues)[number]

// Durée telle qu'elle se lit dans une phrase : "conservé pendant une semaine".
export function expirationPhrase(expiresInDays: ExpiresInDays): string {
  if (expiresInDays === '1') return 'une journée'
  if (expiresInDays === '7') return 'une semaine'
  return `${expiresInDays} jours`
}

export const expirationOptions: SelectOption[] = expirationValues.map((value) => {
  const phrase = expirationPhrase(value)
  return { value, label: phrase.charAt(0).toUpperCase() + phrase.slice(1) }
})
