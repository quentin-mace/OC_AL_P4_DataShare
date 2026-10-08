import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, type AxiosAdapter, type AxiosProgressEvent } from 'axios'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../api/client'
import type { UploadedFile } from '../../api/files'
import { useAuthStore } from '../../auth/authStore'
import { paths } from '../../routes/paths'
import { routes } from '../../routes/routes'
import { fakeToken } from '../../test/jwt'

const report = new File(['contenu du rapport'], 'rapport.pdf', { type: 'application/pdf' })

const uploaded: UploadedFile = {
  id: 12,
  name: 'rapport.pdf',
  size: report.size,
  mimeType: 'application/pdf',
  downloadToken: 'aB3dE5fG',
  expiresAt: '2026-10-09T08:00:00+00:00',
  hasPassword: true,
  tags: ['facture', 'client-x'],
}

const sent = vi.fn<(fields: [string, FormDataEntryValue][]) => void>()
let reply: { status: number; data: unknown }
// Quand il est posé, l'envoi s'arrête à mi-chemin jusqu'à ce que le test le libère.
let pause: Promise<void> | null

// Remplace le réseau : chaque test choisit la réponse de POST /files.
const adapter: AxiosAdapter = async (config) => {
  sent([...(config.data as FormData).entries()])
  config.onUploadProgress?.({ loaded: 50, total: 100, progress: 0.5 } as AxiosProgressEvent)
  if (pause) await pause
  const response = { ...reply, statusText: '', headers: {}, config }
  if (reply.status >= 400) {
    throw new AxiosError('Request failed', undefined, config, null, response)
  }
  return response
}

async function openUploadDialog() {
  useAuthStore.setState({ token: fakeToken(3600) })
  const router = createMemoryRouter(routes, { initialEntries: [paths.files] })
  render(<RouterProvider router={router} />)
  await userEvent.click(screen.getByRole('button', { name: 'Ajouter des fichiers' }))
  return { router, dialog: screen.getByRole('dialog', { name: 'Ajouter un fichier' }) }
}

const pickFile = (file = report) => userEvent.upload(screen.getByLabelText('Fichier'), file)
const submit = () => userEvent.click(screen.getByRole('button', { name: 'Téléverser' }))

describe('UploadDialog', () => {
  beforeEach(() => {
    apiClient.defaults.adapter = adapter
    reply = { status: 201, data: uploaded }
    pause = null
  })

  afterEach(() => {
    apiClient.defaults.adapter = undefined
    sent.mockReset()
    useAuthStore.setState({ token: null, sessionExpired: false })
    localStorage.clear()
  })

  it('requires a file before calling the API', async () => {
    await openUploadDialog()

    await submit()

    expect(screen.getByRole('button', { name: 'Choisir un fichier' })).toHaveAccessibleDescription(
      'Choisissez un fichier.',
    )
    expect(sent).not.toHaveBeenCalled()
  })

  it('refuses a forbidden file type without calling the API', async () => {
    await openUploadDialog()
    await pickFile(new File(['MZ'], 'setup.exe'))

    await submit()

    expect(await screen.findByText('Les fichiers .exe ne sont pas acceptés.')).toBeInTheDocument()
    expect(sent).not.toHaveBeenCalled()
  })

  it('sends the file with its options, then shows the share link', async () => {
    await openUploadDialog()
    await pickFile()
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'secret')
    await userEvent.selectOptions(screen.getByLabelText('Expiration'), 'Une journée')
    await userEvent.type(screen.getByLabelText('Tags'), ' facture, client-x ,')

    await submit()

    expect(sent).toHaveBeenCalledWith([
      ['file', report],
      ['expiresInDays', '1'],
      ['password', 'secret'],
      ['tags[]', 'facture'],
      ['tags[]', 'client-x'],
    ])
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Félicitations, ton fichier sera conservé chez nous pendant une journée !',
    )
    const link = `${window.location.origin}${paths.download('aB3dE5fG')}`
    expect(screen.getByRole('link', { name: link })).toHaveAttribute('href', link)
  })

  it('leaves out the optional fields left empty', async () => {
    await openUploadDialog()
    await pickFile()

    await submit()

    expect(sent).toHaveBeenCalledWith([
      ['file', report],
      ['expiresInDays', '7'],
    ])
    expect(await screen.findByRole('status')).toHaveTextContent('pendant une semaine')
  })

  it('shows the upload progress and locks the form meanwhile', async () => {
    let resume = () => {}
    pause = new Promise((resolve) => (resume = resolve))
    await openUploadDialog()
    await pickFile()

    await submit()

    const bar = await screen.findByRole('progressbar', { name: 'Envoi en cours' })
    expect(bar).toHaveAttribute('value', '50')
    expect(screen.getByRole('button', { name: 'Téléverser' })).toBeDisabled()
    expect(screen.getByLabelText('Mot de passe')).toBeDisabled()

    resume()
    expect(await screen.findByRole('button', { name: 'Copier le lien' })).toBeInTheDocument()
  })

  it('copies the share link', async () => {
    const user = userEvent.setup()
    await openUploadDialog()
    await pickFile()
    await submit()

    await user.click(await screen.findByRole('button', { name: 'Copier le lien' }))

    expect(await navigator.clipboard.readText()).toBe(
      `${window.location.origin}${paths.download('aB3dE5fG')}`,
    )
    expect(screen.getByRole('button', { name: 'Lien copié' })).toBeInTheDocument()
  })

  it('shows the server violations on their fields, in French', async () => {
    reply = {
      status: 422,
      data: {
        violations: [
          {
            propertyPath: 'file',
            message: 'The file is too large.',
            code: 'df8637af-d466-48c6-a59d-e7126250a654',
          },
          { propertyPath: 'tags[1]', message: 'This value is too long.' },
        ],
      },
    }
    await openUploadDialog()
    await pickFile()
    await userEvent.type(screen.getByLabelText('Tags'), 'facture')

    await submit()

    expect(await screen.findByText('Le fichier ne peut pas dépasser 1 Go.')).toBeInTheDocument()
    expect(screen.getByLabelText('Tags')).toHaveAccessibleDescription(
      'Tags refusés, 30 caractères maximum et sans doublon.',
    )
    expect(screen.queryByText(/too/)).not.toBeInTheDocument()
  })

  it.each([
    [413, 'Le fichier est trop volumineux.'],
    [500, 'Envoi impossible pour le moment, réessayez plus tard.'],
  ])('reports a %i response in an alert', async (status, message) => {
    reply = { status, data: {} }
    const { dialog } = await openUploadDialog()
    await pickFile()

    await submit()

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(message)
  })

  it('sends the user back to the login page when the session has expired', async () => {
    reply = { status: 401, data: {} }
    const { router } = await openUploadDialog()
    await pickFile()

    await submit()

    await screen.findByRole('heading', { name: 'Connexion' })
    expect(router.state.location.pathname).toBe(paths.login)
    expect(useAuthStore.getState().sessionExpired).toBe(true)
  })

  it('starts over with an empty form once closed', async () => {
    await openUploadDialog()
    await pickFile()
    await submit()
    await screen.findByRole('button', { name: 'Copier le lien' })

    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter des fichiers' }))

    expect(screen.getByRole('button', { name: 'Choisir un fichier' })).toBeInTheDocument()
  })
})
