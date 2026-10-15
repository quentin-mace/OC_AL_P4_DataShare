import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, type AxiosAdapter } from 'axios'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../api/client'
import type { UploadedFile } from '../api/files'
import { useAuthStore } from '../auth/authStore'
import { paths } from '../routes/paths'
import { routes } from '../routes/routes'
import { fakeToken } from '../test/jwt'

const report = new File(['contenu du rapport'], 'rapport.pdf', { type: 'application/pdf' })

const uploaded: UploadedFile = {
  id: 12,
  name: 'rapport.pdf',
  size: report.size,
  mimeType: 'application/pdf',
  downloadToken: 'aB3dE5fG',
  expiresAt: '2026-10-09T08:00:00+00:00',
  hasPassword: false,
  tags: [],
}

const sent = vi.fn<(authorization: unknown, fields: [string, FormDataEntryValue][]) => void>()
let reply: { status: number; data: unknown }

// Remplace le réseau : chaque test choisit la réponse de POST /files.
const adapter: AxiosAdapter = async (config) => {
  sent(config.headers.Authorization, [...(config.data as FormData).entries()])
  const response = { ...reply, statusText: '', headers: {}, config }
  if (reply.status >= 400) {
    throw new AxiosError('Request failed', undefined, config, null, response)
  }
  return response
}

async function openUploadDialog() {
  const router = createMemoryRouter(routes, { initialEntries: [paths.home] })
  render(<RouterProvider router={router} />)
  await userEvent.click(screen.getByRole('button', { name: 'Partager un fichier' }))
  return { router, dialog: screen.getByRole('dialog', { name: 'Ajouter un fichier' }) }
}

const pickFile = (file = report) => userEvent.upload(screen.getByLabelText('Fichier'), file)
const submit = () => userEvent.click(screen.getByRole('button', { name: 'Téléverser' }))

describe('HomePage', () => {
  beforeEach(() => {
    apiClient.defaults.adapter = adapter
    reply = { status: 201, data: uploaded }
  })

  afterEach(() => {
    apiClient.defaults.adapter = undefined
    sent.mockReset()
    useAuthStore.setState({ token: null, sessionExpired: false })
    localStorage.clear()
  })

  it('lets a visitor share a file without an account', async () => {
    await openUploadDialog()
    expect(screen.queryByLabelText('Tags')).not.toBeInTheDocument()
    await pickFile()

    await submit()

    expect(sent).toHaveBeenCalledWith(undefined, [
      ['file', report],
      ['expiresInDays', '7'],
    ])
    const link = `${window.location.origin}${paths.download('aB3dE5fG')}`
    expect(await screen.findByRole('link', { name: link })).toHaveAttribute('href', link)
  })

  it('refuses a forbidden file type without calling the API', async () => {
    await openUploadDialog()
    await pickFile(new File(['MZ'], 'setup.exe'))

    await submit()

    expect(await screen.findByText('Les fichiers .exe ne sont pas acceptés.')).toBeInTheDocument()
    expect(sent).not.toHaveBeenCalled()
  })

  it('keeps the tags of a logged-in user, whose upload joins their account', async () => {
    const token = fakeToken(3600)
    useAuthStore.setState({ token })
    await openUploadDialog()
    await pickFile()
    await userEvent.type(screen.getByLabelText('Tags'), 'facture')

    await submit()

    expect(sent).toHaveBeenCalledWith(`Bearer ${token}`, [
      ['file', report],
      ['expiresInDays', '7'],
      ['tags[]', 'facture'],
    ])
  })

  it('stays on the page when the session expires, ready for an anonymous upload', async () => {
    reply = { status: 401, data: {} }
    useAuthStore.setState({ token: fakeToken(3600) })
    const { router } = await openUploadDialog()
    await pickFile()

    await submit()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Votre session a expiré, reconnectez-vous.',
    )
    expect(router.state.location.pathname).toBe(paths.home)
    expect(screen.queryByLabelText('Tags')).not.toBeInTheDocument()
  })
})
