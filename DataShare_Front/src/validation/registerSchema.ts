import { z } from 'zod'
import { MIN_PASSWORD_SCORE, passwordStrength } from './passwordStrength'

// Mêmes règles que les contraintes de l'entité User côté back (#32). Elles
// n'évitent qu'un aller-retour : le serveur reste seul à faire foi.
export const PASSWORD_MIN_LENGTH = 16

const fields = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Saisissez votre email.')
    .max(180, "L'email ne peut pas dépasser 180 caractères.")
    // Même motif que la contrainte Email de Symfony, en mode html5 par défaut.
    .pipe(z.email({ pattern: z.regexes.html5Email, message: 'Adresse email invalide.' })),
  firstName: z
    .string()
    .trim()
    .min(1, 'Saisissez votre prénom.')
    .max(255, 'Le prénom ne peut pas dépasser 255 caractères.'),
  lastName: z
    .string()
    .trim()
    .min(1, 'Saisissez votre nom.')
    .max(255, 'Le nom ne peut pas dépasser 255 caractères.'),
  plainPassword: z
    .string()
    // abort : un seul message à la fois, la robustesse n'est jugée qu'une fois la longueur atteinte.
    .min(PASSWORD_MIN_LENGTH, {
      message: `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`,
      abort: true,
    })
    .max(4096, { message: 'Le mot de passe ne peut pas dépasser 4096 caractères.', abort: true })
    .refine(
      (password) => passwordStrength(password) >= MIN_PASSWORD_SCORE,
      'Mot de passe trop prévisible, variez davantage les caractères.',
    ),
  confirmPassword: z.string().min(1, 'Saisissez à nouveau votre mot de passe.'),
})

export const registerSchema = fields.refine(
  (values) => values.confirmPassword === values.plainPassword,
  {
    message: 'Les mots de passe ne correspondent pas.',
    path: ['confirmPassword'],
    // Par défaut zod saute ce contrôle tant qu'un autre champ est en erreur :
    // il ne dépend pourtant que des deux mots de passe.
    when: ({ value }) =>
      fields.pick({ plainPassword: true, confirmPassword: true }).safeParse(value).success,
  },
)

export type RegisterFormInput = z.input<typeof registerSchema>
export type RegisterFormValues = z.output<typeof registerSchema>
export type RegisterPayload = Omit<RegisterFormValues, 'confirmPassword'>
