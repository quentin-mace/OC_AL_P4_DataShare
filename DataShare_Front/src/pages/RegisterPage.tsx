import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { getViolations, type Violation } from '../api/problem'
import { registerUser } from '../api/register'
import { Button } from '../components/ui/Button'
import { Callout } from '../components/ui/Callout'
import { Input } from '../components/ui/Input'
import { paths } from '../routes/paths'
import {
  PASSWORD_MIN_LENGTH,
  registerSchema,
  type RegisterFormInput,
  type RegisterFormValues,
} from '../validation/registerSchema'

type ServerField = Exclude<keyof RegisterFormInput, 'confirmPassword'>

const serverFields: ServerField[] = ['email', 'firstName', 'lastName', 'plainPassword']

// Codes des contraintes Symfony qui ont un libellé plus précis que le repli par champ.
const messagesByCode: Record<string, string> = {
  '23bd9dbf-6b9b-41cd-a99e-4844bcf3077f': 'Un compte existe déjà avec cette adresse email.',
  '9ff3fdc4-b214-49db-8718-39c315e33d45': `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`,
  '4234df00-45dd-49a4-b303-a75dbf8b10d8':
    'Mot de passe trop prévisible, variez davantage les caractères.',
}

const fallbackMessages: Record<ServerField, string> = {
  email: 'Adresse email refusée.',
  firstName: 'Prénom refusé.',
  lastName: 'Nom refusé.',
  plainPassword: 'Mot de passe refusé.',
}

function isServerField(path: string): path is ServerField {
  return (serverFields as string[]).includes(path)
}

function messageFor(violation: Violation & { propertyPath: ServerField }): string {
  return (
    (violation.code ? messagesByCode[violation.code] : undefined) ??
    fallbackMessages[violation.propertyPath]
  )
}

export function RegisterPage() {
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormInput, unknown, RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onTouched',
  })

  async function onSubmit({ confirmPassword: _confirmation, ...payload }: RegisterFormValues) {
    setFormError(null)
    try {
      await registerUser(payload)
      navigate(paths.login, { state: { registered: true } })
    } catch (error) {
      const violations = getViolations(error)
      const fieldViolations = violations?.filter(
        (violation): violation is Violation & { propertyPath: ServerField } =>
          isServerField(violation.propertyPath),
      )
      if (!fieldViolations?.length) {
        setFormError('Inscription impossible pour le moment, réessayez plus tard.')
        return
      }
      fieldViolations.forEach((violation, index) =>
        setError(
          violation.propertyPath,
          { type: 'server', message: messageFor(violation) },
          { shouldFocus: index === 0 },
        ),
      )
    }
  }

  return (
    <section className="w-full max-w-md rounded-card bg-surface p-6 shadow-card">
      <h1 className="mb-4 text-center text-xl font-bold text-ink">Créer un compte</h1>
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="Saisissez votre email..."
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          label="Prénom"
          autoComplete="given-name"
          placeholder="Saisissez votre prénom..."
          error={errors.firstName?.message}
          {...register('firstName')}
        />
        <Input
          label="Nom"
          autoComplete="family-name"
          placeholder="Saisissez votre nom..."
          error={errors.lastName?.message}
          {...register('lastName')}
        />
        <Input
          label="Mot de passe"
          type="password"
          autoComplete="new-password"
          placeholder="Saisissez votre mot de passe..."
          error={errors.plainPassword?.message}
          {...register('plainPassword')}
        />
        <Input
          label="Vérification du mot de passe"
          type="password"
          autoComplete="new-password"
          placeholder="Saisissez-le à nouveau"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <Link to={paths.login} className="mt-2 self-center text-sm text-accent hover:underline">
          J'ai déjà un compte
        </Link>
        {formError && <Callout variant="error">{formError}</Callout>}
        <Button type="submit" fullWidth disabled={isSubmitting}>
          Créer mon compte
        </Button>
      </form>
    </section>
  )
}
