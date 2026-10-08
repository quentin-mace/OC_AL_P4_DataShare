import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation } from 'react-router'
import { login } from '../api/login'
import { getStatus } from '../api/problem'
import { useAuthStore, useIsAuthenticated } from '../auth/authStore'
import { Button } from '../components/ui/Button'
import { Callout } from '../components/ui/Callout'
import { Input } from '../components/ui/Input'
import { paths } from '../routes/paths'
import { loginSchema, type LoginCredentials, type LoginFormInput } from '../validation/loginSchema'

// registered est posé par la page d'inscription après un 201, from par la
// garde de l'espace personnel quand elle renvoie ici.
export interface LoginLocationState {
  registered?: boolean
  from?: string
}

// L'API répond le même 401 pour un email inconnu et un mot de passe faux :
// le message ne dit pas lequel des deux est en cause.
function messageFor(status: number | null): string {
  switch (status) {
    case 401:
      return 'Email ou mot de passe incorrect.'
    case 429:
      return 'Trop de tentatives de connexion, réessayez dans quelques minutes.'
    default:
      return 'Connexion impossible pour le moment, réessayez plus tard.'
  }
}

export function LoginPage() {
  const state = useLocation().state as LoginLocationState | null
  const isAuthenticated = useIsAuthenticated()
  const sessionExpired = useAuthStore((auth) => auth.sessionExpired)
  const storeToken = useAuthStore((auth) => auth.login)
  const [formError, setFormError] = useState<string | null>(null)
  // Les messages d'accueil (compte créé, session expirée) n'ont plus lieu
  // d'être une fois une tentative échouée : seule l'erreur reste affichée.
  const [attemptFailed, setAttemptFailed] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormInput, unknown, LoginCredentials>({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',
  })

  // Couvre aussi l'après-connexion : le token enregistré, la page se redirige
  // d'elle-même vers la page demandée avant la garde, ou vers l'espace personnel.
  if (isAuthenticated) {
    return <Navigate to={state?.from ?? paths.files} replace />
  }

  async function onSubmit(credentials: LoginCredentials) {
    setFormError(null)
    try {
      storeToken(await login(credentials))
    } catch (error) {
      setAttemptFailed(true)
      setFormError(messageFor(getStatus(error)))
    }
  }

  return (
    <section className="w-full max-w-md rounded-card bg-surface p-6 shadow-card">
      <h1 className="mb-4 text-center text-xl font-bold text-ink">Connexion</h1>
      {state?.registered && !attemptFailed && (
        <Callout className="mb-4">Compte créé, vous pouvez vous connecter.</Callout>
      )}
      {sessionExpired && !attemptFailed && (
        <Callout className="mb-4">Votre session a expiré, reconnectez-vous.</Callout>
      )}
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
          label="Mot de passe"
          type="password"
          autoComplete="current-password"
          placeholder="Saisissez votre mot de passe..."
          error={errors.password?.message}
          {...register('password')}
        />
        <Link to={paths.register} className="mt-2 self-center text-sm text-accent hover:underline">
          Créer un compte
        </Link>
        {formError && <Callout variant="error">{formError}</Callout>}
        <Button type="submit" fullWidth disabled={isSubmitting}>
          Connexion
        </Button>
      </form>
    </section>
  )
}
