import { zodResolver } from '@hookform/resolvers/zod'
import { CloudUpload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { uploadFile, type UploadedFile } from '../../api/files'
import { getStatus, getViolations, type Violation } from '../../api/problem'
import {
  DOWNLOAD_PASSWORD_MIN_LENGTH,
  TAG_MAX_LENGTH,
  uploadSchema,
  type UploadFormInput,
  type UploadFormValues,
} from '../../validation/uploadSchema'
import { Button } from '../ui/Button'
import { Callout } from '../ui/Callout'
import { FileField } from '../ui/FileField'
import { Input } from '../ui/Input'
import { ProgressBar } from '../ui/ProgressBar'
import { Select } from '../ui/Select'
import { expirationOptions } from './expiration'

type FormField = keyof UploadFormInput

// Code de la contrainte Symfony qui a un libellé plus précis que le repli par champ.
const messagesByCode: Record<string, string> = {
  'df8637af-d466-48c6-a59d-e7126250a654': 'Le fichier ne peut pas dépasser 1 Go.',
}

const fallbackMessages: Record<FormField, string> = {
  file: "Ce fichier n'est pas accepté.",
  password: `Le mot de passe doit contenir au moins ${DOWNLOAD_PASSWORD_MIN_LENGTH} caractères.`,
  expiresInDays: 'Durée invalide.',
  tags: `Tags refusés, ${TAG_MAX_LENGTH} caractères maximum et sans doublon.`,
}

// Assert\All rattache un tag fautif à "tags[0]", "tags[1]"... : un seul champ ici.
function fieldOf(propertyPath: string): FormField | null {
  if (propertyPath.startsWith('tags')) return 'tags'
  return propertyPath in fallbackMessages ? (propertyPath as FormField) : null
}

function messageFor(violation: Violation, field: FormField): string {
  return (violation.code ? messagesByCode[violation.code] : undefined) ?? fallbackMessages[field]
}

function messageForStatus(status: number | null): string {
  if (status === 413) return 'Le fichier est trop volumineux.'
  return 'Envoi impossible pour le moment, réessayez plus tard.'
}

export interface UploadFormProps {
  onUploaded: (file: UploadedFile, values: UploadFormValues) => void
}

export function UploadForm({ onUploaded }: UploadFormProps) {
  const [formError, setFormError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const abortRef = useRef<AbortController>(null)
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<UploadFormInput, unknown, UploadFormValues>({
    resolver: zodResolver(uploadSchema),
    mode: 'onTouched',
    defaultValues: { password: '', expiresInDays: '7', tags: '' },
  })

  // Fermer le formulaire en plein envoi l'interrompt, plutôt que de laisser
  // le fichier partir sans que personne n'en reçoive le lien.
  useEffect(() => () => abortRef.current?.abort(), [])

  async function onSubmit(values: UploadFormValues) {
    setFormError(null)
    setProgress(0)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const uploaded = await uploadFile(values, {
        onProgress: setProgress,
        signal: controller.signal,
      })
      onUploaded(uploaded, values)
    } catch (error) {
      if (controller.signal.aborted) return
      const violations = getViolations(error)
        ?.map((violation) => ({ violation, field: fieldOf(violation.propertyPath) }))
        .filter((entry): entry is { violation: Violation; field: FormField } => !!entry.field)
      if (!violations?.length) {
        // Un 401 ferme la session (intercepteur) : la garde renvoie vers la connexion.
        setFormError(messageForStatus(getStatus(error)))
        return
      }
      violations.forEach(({ violation, field }, index) =>
        setError(
          field,
          { type: 'server', message: messageFor(violation, field) },
          { shouldFocus: index === 0 },
        ),
      )
    }
  }

  return (
    <form
      noValidate
      // handleSubmit appelé à la soumission et non au rendu : onSubmit lit abortRef.
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
      className="flex flex-col gap-3"
    >
      <Controller
        control={control}
        name="file"
        render={({ field }) => (
          <FileField
            label="Fichier"
            file={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={errors.file?.message}
            disabled={isSubmitting}
          />
        )}
      />
      <Input
        label="Mot de passe"
        type="password"
        autoComplete="new-password"
        placeholder="Optionnel"
        disabled={isSubmitting}
        error={errors.password?.message}
        {...register('password')}
      />
      <Select
        label="Expiration"
        options={expirationOptions}
        disabled={isSubmitting}
        error={errors.expiresInDays?.message}
        {...register('expiresInDays')}
      />
      <Input
        label="Tags"
        autoComplete="off"
        placeholder="Optionnel, séparés par des virgules"
        disabled={isSubmitting}
        error={errors.tags?.message}
        {...register('tags')}
      />
      {isSubmitting && <ProgressBar label="Envoi en cours" value={progress} />}
      {formError && <Callout variant="error">{formError}</Callout>}
      <Button
        type="submit"
        fullWidth
        disabled={isSubmitting}
        leadingIcon={<CloudUpload className="size-4" />}
      >
        Téléverser
      </Button>
    </form>
  )
}
