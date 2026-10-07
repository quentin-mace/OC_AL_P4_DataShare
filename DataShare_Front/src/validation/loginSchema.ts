import { z } from 'zod'
import { emailField } from './registerSchema'

// Le mot de passe n'est que requis : les règles de robustesse valent pour
// l'inscription, et un refus anticipé ici n'apprendrait rien de plus que le 401.
export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Saisissez votre mot de passe.'),
})

export type LoginFormInput = z.input<typeof loginSchema>
export type LoginCredentials = z.output<typeof loginSchema>
