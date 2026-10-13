import { z } from 'zod'

// Le mot de passe n'est que requis : les six caractères minimum valent au dépôt,
// et c'est le serveur qui juge de sa justesse (401).
export const downloadPasswordSchema = z.object({
  password: z.string().min(1, 'Saisissez le mot de passe.'),
})

export type DownloadPasswordValues = z.infer<typeof downloadPasswordSchema>
