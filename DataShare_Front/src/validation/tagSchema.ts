import { z } from 'zod'

// Mêmes règles que TagInput côté back (#46) : le serveur reste seul à faire foi.

// Assert\Length(max: 30).
export const TAG_MAX_LENGTH = 30

/**
 * Règles d'un tag déjà débarrassé de ses espaces de bordure, communes à l'envoi
 * et à l'édition. Renvoie le message à afficher, ou null si le tag est valable.
 *
 * Le "/" est une restriction du front : le back l'accepte, mais un tag qui en
 * contient un n'est plus adressable par /files/{id}/tags/{tag}, donc ni
 * renommable ni retirable (voir architectureDecisions/tags.md).
 */
export function tagRuleMessage(tag: string): string | null {
  if (tag.length > TAG_MAX_LENGTH) {
    return `Un tag ne peut pas dépasser ${TAG_MAX_LENGTH} caractères ("${tag}").`
  }
  if (tag.includes('/')) {
    return `Un tag ne peut pas contenir de "/" ("${tag}").`
  }
  return null
}

/**
 * Schéma du champ de saisie d'un seul tag, pour l'ajout comme pour le
 * renommage. `taken` liste les tags que le fichier porte déjà.
 */
export function tagSchema(taken: string[]) {
  return z.object({
    tag: z
      .string()
      .trim()
      .min(1, 'Saisissez un tag.')
      .superRefine((tag, context) => {
        // La virgule sépare les tags à l'envoi : un nom ne peut pas en contenir.
        const message = tag.includes(',')
          ? 'Un tag ne peut pas contenir de virgule.'
          : (tagRuleMessage(tag) ?? (taken.includes(tag) ? 'Ce fichier porte déjà ce tag.' : null))
        if (message) context.addIssue({ code: 'custom', message })
      }),
  })
}

export type TagFormInput = z.input<ReturnType<typeof tagSchema>>
export type TagFormValues = z.output<ReturnType<typeof tagSchema>>
