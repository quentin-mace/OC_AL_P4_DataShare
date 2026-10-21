import { z } from 'zod'
import { tagRuleMessage } from './tagSchema'

// Mêmes règles que FileUploadInput côté back (#37). Elles n'évitent qu'un
// aller-retour, coûteux ici puisqu'il porte tout le fichier : le serveur
// reste seul à faire foi.

// Assert\File(maxSize: '1G') : unité décimale, 1 Go = 1000³ octets. Les
// suffixes de Symfony ne valent 1024 que doublés d'un i (Ki, Mi, Gi).
// Compté en 1024³ ici, le formulaire acceptait 73 Mo de plus que le back :
// l'envoi partait, durait une minute, puis échouait en 422.
export const MAX_FILE_SIZE = 1000 ** 3

// FORBIDDEN_FILE_EXTENSIONS du .env du back, comparées sans casse.
export const FORBIDDEN_EXTENSIONS = [
  'exe',
  'bat',
  'cmd',
  'sh',
  'ps1',
  'msi',
  'dll',
  'scr',
  'jar',
  'php',
  'js',
  'vbs',
]

// File::$name est une colonne varchar(255) côté back, et MAX_FILE_NAME_LENGTH
// de FileUploadInput la fait respecter. Sans ce garde-fou ici, l'envoi partait
// et n'échouait qu'au retour, comme le faisait la taille avant le #79.
export const MAX_FILE_NAME_LENGTH = 255

export const DOWNLOAD_PASSWORD_MIN_LENGTH = 6

// Même calcul que pathinfo(PATHINFO_EXTENSION) : ce qui suit le dernier point.
export function fileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot === -1 ? '' : fileName.slice(dot + 1).toLowerCase()
}

// Même normalisation que MultipartDecoder : bordures retirées, segments vides ignorés.
export function parseTags(value: string): string[] {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

export const expirationValues = ['1', '2', '3', '4', '5', '6', '7'] as const

export const uploadSchema = z.object({
  file: z
    .instanceof(File, { message: 'Choisissez un fichier.' })
    // Assert\File refuse aussi un fichier vide.
    .refine((file) => file.size > 0, 'Ce fichier est vide.')
    .refine((file) => file.size <= MAX_FILE_SIZE, 'Le fichier ne peut pas dépasser 1 Go.')
    .refine(
      (file) => file.name.length <= MAX_FILE_NAME_LENGTH,
      `Le nom du fichier ne peut pas dépasser ${MAX_FILE_NAME_LENGTH} caractères.`,
    )
    .superRefine((file, context) => {
      const extension = fileExtension(file.name)
      if (FORBIDDEN_EXTENSIONS.includes(extension)) {
        context.addIssue({
          code: 'custom',
          message: `Les fichiers .${extension} ne sont pas acceptés.`,
        })
      }
    }),
  // Facultatif : un champ laissé vide n'est pas envoyé, le back le traiterait
  // de toute façon comme absent.
  password: z
    .string()
    .refine(
      (password) => password === '' || password.length >= DOWNLOAD_PASSWORD_MIN_LENGTH,
      `Le mot de passe doit contenir au moins ${DOWNLOAD_PASSWORD_MIN_LENGTH} caractères.`,
    )
    .transform((password) => password || undefined),
  // Assert\Range(min: 1, max: 7) ; le back applique 7 jours par défaut.
  expiresInDays: z.enum(expirationValues, { message: 'Durée invalide.' }),
  tags: z
    .string()
    .transform(parseTags)
    .superRefine((tags, context) => {
      // Assert\All([Length(max: 30)]), le "/" refusé par le front (tagSchema.ts),
      // puis le callback validateTags.
      const message =
        tags.map(tagRuleMessage).find(Boolean) ??
        (new Set(tags).size !== tags.length
          ? 'Un même tag ne peut pas être saisi deux fois.'
          : null)
      if (message) context.addIssue({ code: 'custom', message })
    }),
})

export type UploadFormInput = z.input<typeof uploadSchema>
export type UploadFormValues = z.output<typeof uploadSchema>
