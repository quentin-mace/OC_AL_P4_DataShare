import { zodResolver } from '@hookform/resolvers/zod'
import { CloudUpload } from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useParams } from 'react-router'
import { getDownloadMetadata, requestDownloadUrl, type DownloadMetadata } from '../api/downloads'
import { getRetryAfter, getStatus } from '../api/problem'
import { startDownload } from '../browser/startDownload'
import { Button } from '../components/ui/Button'
import { Callout } from '../components/ui/Callout'
import { FileSummary } from '../components/ui/FileSummary'
import { Input } from '../components/ui/Input'
import { daysUntil, expirationNotice } from '../format/expiration'
import { downloadPasswordSchema, type DownloadPasswordValues } from '../validation/downloadSchema'

type PageState =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'loadError' }
  | { kind: 'ready'; file: DownloadMetadata }

// Chaque état retient le lien qu'il décrit : quand le token de l'URL change,
// l'état du précédent ne s'affiche pas, la page repasse en chargement.
type LoadedState = PageState & { downloadToken: string }

// L'API répond le même 410 pour un lien expiré et un lien inconnu : le message
// de la maquette vaut pour les deux, sans révéler lequel des cas s'applique.
const UNAVAILABLE = "Ce fichier n'est plus disponible en téléchargement car il a expiré."

function isUnavailable(status: number | null): boolean {
  return status === 404 || status === 410
}

function tooManyAttempts(retryAfter: number | null): string {
  if (retryAfter === null) {
    return 'Trop de tentatives, réessayez dans quelques minutes.'
  }
  const minutes = Math.ceil(retryAfter / 60)
  return `Trop de tentatives, réessayez dans ${minutes} minute${minutes > 1 ? 's' : ''}.`
}

function downloadErrorMessage(error: unknown): string {
  switch (getStatus(error)) {
    case 401:
      return 'Mot de passe incorrect.'
    case 429:
      return tooManyAttempts(getRetryAfter(error))
    default:
      return 'Téléchargement impossible pour le moment, réessayez plus tard.'
  }
}

function Card({ children }: { children: ReactNode }) {
  return (
    <section className="flex w-full max-w-md flex-col gap-4 rounded-card bg-surface p-6 shadow-card">
      <h1 className="text-center text-xl font-bold text-ink">Télécharger un fichier</h1>
      {children}
    </section>
  )
}

export function DownloadPage() {
  const { downloadToken = '' } = useParams()
  const [loaded, setLoaded] = useState<LoadedState | null>(null)
  const state: PageState = loaded?.downloadToken === downloadToken ? loaded : { kind: 'loading' }

  useEffect(() => {
    const controller = new AbortController()

    getDownloadMetadata(downloadToken, { signal: controller.signal })
      .then((file) => setLoaded({ downloadToken, kind: 'ready', file }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setLoaded({
          downloadToken,
          kind: isUnavailable(getStatus(error)) ? 'unavailable' : 'loadError',
        })
      })

    return () => controller.abort()
  }, [downloadToken])

  switch (state.kind) {
    case 'loading':
      return (
        <Card>
          <output className="text-center text-sm text-ink-muted">Chargement...</output>
        </Card>
      )
    case 'unavailable':
      return (
        <Card>
          <Callout variant="error">{UNAVAILABLE}</Callout>
        </Card>
      )
    case 'loadError':
      return (
        <Card>
          <Callout variant="error">
            Impossible de charger ce fichier pour le moment, réessayez plus tard.
          </Callout>
        </Card>
      )
    case 'ready':
      return (
        <Card>
          <DownloadForm
            downloadToken={downloadToken}
            file={state.file}
            onUnavailable={() => setLoaded({ downloadToken, kind: 'unavailable' })}
          />
        </Card>
      )
  }
}

interface DownloadFormProps {
  downloadToken: string
  file: DownloadMetadata
  /** Le lien a expiré entre l'affichage et la demande de téléchargement. */
  onUnavailable: () => void
}

function DownloadForm({ downloadToken, file, onUnavailable }: DownloadFormProps) {
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const notice = expirationNotice(daysUntil(file.expiresAt))
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<DownloadPasswordValues>({
    resolver: zodResolver(downloadPasswordSchema),
    mode: 'onTouched',
    defaultValues: { password: '' },
  })

  async function download(password?: string) {
    setFormError(null)
    setPending(true)
    try {
      startDownload(await requestDownloadUrl(downloadToken, password))
    } catch (error) {
      if (isUnavailable(getStatus(error))) {
        onUnavailable()
        return
      }
      setFormError(downloadErrorMessage(error))
    }
    setPending(false)
  }

  // Sans mot de passe, rien à valider : le bouton envoie directement la demande.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (file.hasPassword) {
      return handleSubmit(({ password }) => download(password))(event)
    }
    event.preventDefault()
    return download()
  }

  // Comme sur la maquette, le bouton reste grisé tant qu'aucun mot de passe n'est saisi.
  const password = useWatch({ control, name: 'password' })
  const passwordMissing = file.hasPassword && password === ''

  return (
    <form noValidate onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4">
      <FileSummary name={file.name} size={file.size} />
      <Callout variant={notice.variant}>{notice.text}</Callout>
      {file.hasPassword && (
        <Input
          label="Mot de passe"
          type="password"
          autoComplete="off"
          placeholder="Saisissez le mot de passe..."
          error={errors.password?.message}
          {...register('password')}
        />
      )}
      {formError && <Callout variant="error">{formError}</Callout>}
      <Button
        type="submit"
        fullWidth
        disabled={passwordMissing || pending}
        leadingIcon={<CloudUpload className="size-4" />}
      >
        Télécharger
      </Button>
    </form>
  )
}
