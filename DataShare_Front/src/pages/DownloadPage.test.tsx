import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../api/client'
import type { DownloadMetadata } from '../api/downloads'
import { useAuthStore } from '../auth/authStore'
import { startDownload } from '../browser/startDownload'
import { paths } from '../routes/paths'
import { routes } from '../routes/routes'
import { fakeToken } from '../test/jwt'

vi.mock('../browser/startDownload', () => ({ startDownload: vi.fn<(url: string) => void>() }))

const downloadToken = '0123456789abcdef0123456789abcdef'
const presignedUrl = 'http://localhost:8333/datashare/abc?X-Amz-Signature=sig'

interface Reply {
  status: number
  data?: unknown
  headers?: Record<string, string>
}

const sent = vi.fn<(request: InternalAxiosRequestConfig) => void>()
let metadataReply: Reply
let downloadReply: Reply

// Remplace le réseau : chaque test choisit la réponse du GET et du POST.
const adapter: AxiosAdapter = async (config) => {
  sent(config)
  const reply = config.method === 'post' ? downloadReply : metadataReply
  const response = { data: {}, headers: {}, ...reply, statusText: '', config }
  if (reply.status >= 400) {
    throw new AxiosError('Request failed', undefined, config, null, response)
  }
  return response
}

function metadata(overrides: Partial<DownloadMetadata> = {}): DownloadMetadata {
  return {
    name: 'IMG_9210.jpg',
    size: 2_726_297,
    mimeType: 'image/jpeg',
    expiresAt: new Date(2026, 9, 16, 12, 0).toISOString(),
    hasPassword: false,
    ...overrides,
  }
}

function renderDownloadPage() {
  const router = createMemoryRouter(routes, {
    initialEntries: [paths.download(downloadToken)],
  })
  render(<RouterProvider router={router} />)
}

const downloadButton = () => screen.findByRole('button', { name: 'Télécharger' })
const postedBodies = () =>
  sent.mock.calls.filter(([config]) => config.method === 'post').map(([config]) => config.data)

describe('DownloadPage', () => {
  beforeEach(() => {
    // Seule l'horloge est simulée : userEvent garde ses vrais délais.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 13, 10, 0))
    apiClient.defaults.adapter = adapter
    metadataReply = { status: 200, data: metadata() }
    downloadReply = { status: 200, data: { presignedUrl, expiresIn: 60 } }
  })

  afterEach(() => {
    vi.useRealTimers()
    apiClient.defaults.adapter = undefined
    sent.mockReset()
    vi.mocked(startDownload).mockReset()
    useAuthStore.setState({ token: null, sessionExpired: false })
    localStorage.clear()
  })

  it('asks the API for the metadata of the link', async () => {
    renderDownloadPage()

    expect(screen.getByRole('status')).toHaveTextContent('Chargement...')
    expect(await screen.findByText('IMG_9210.jpg')).toBeInTheDocument()
    expect(sent.mock.calls[0][0].url).toBe(`/downloads/${downloadToken}`)
  })

  it('shows the file and downloads it straight away when it has no password', async () => {
    renderDownloadPage()

    expect(await screen.findByText('2,6 Mo')).toBeInTheDocument()
    expect(screen.getByText('Ce fichier expirera dans 3 jours.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Mot de passe')).not.toBeInTheDocument()

    await userEvent.click(await downloadButton())

    expect(postedBodies()).toEqual([JSON.stringify({})])
    expect(startDownload).toHaveBeenCalledWith(presignedUrl)
  })

  it('warns when the file expires tomorrow', async () => {
    metadataReply = {
      status: 200,
      data: metadata({ expiresAt: new Date(2026, 9, 14, 8, 0).toISOString() }),
    }
    renderDownloadPage()

    expect(await screen.findByText('Ce fichier expirera demain.')).toBeInTheDocument()
  })

  it('requires the password before enabling the download', async () => {
    metadataReply = { status: 200, data: metadata({ hasPassword: true }) }
    renderDownloadPage()

    expect(await downloadButton()).toBeDisabled()

    await userEvent.type(screen.getByLabelText('Mot de passe'), 'secret1')
    await userEvent.click(await downloadButton())

    expect(postedBodies()).toEqual([JSON.stringify({ password: 'secret1' })])
    expect(startDownload).toHaveBeenCalledWith(presignedUrl)
  })

  it('reports a wrong password and lets the user try again', async () => {
    metadataReply = { status: 200, data: metadata({ hasPassword: true }) }
    downloadReply = { status: 401 }
    renderDownloadPage()

    await userEvent.type(await screen.findByLabelText('Mot de passe'), 'wrong1')
    await userEvent.click(await downloadButton())

    expect(await screen.findByRole('alert')).toHaveTextContent('Mot de passe incorrect.')
    expect(await downloadButton()).toBeEnabled()
    expect(startDownload).not.toHaveBeenCalled()
  })

  it('keeps a logged-in user logged in after a wrong password', async () => {
    useAuthStore.setState({ token: fakeToken(3600) })
    metadataReply = { status: 200, data: metadata({ hasPassword: true }) }
    downloadReply = { status: 401 }
    renderDownloadPage()

    await userEvent.type(await screen.findByLabelText('Mot de passe'), 'wrong1')
    await userEvent.click(await downloadButton())

    expect(await screen.findByRole('alert')).toHaveTextContent('Mot de passe incorrect.')
    expect(useAuthStore.getState().token).not.toBeNull()
    expect(useAuthStore.getState().sessionExpired).toBe(false)
    expect(sent.mock.calls.every(([config]) => !config.headers.Authorization)).toBe(true)
  })

  it('tells how long to wait after too many attempts', async () => {
    metadataReply = { status: 200, data: metadata({ hasPassword: true }) }
    downloadReply = { status: 429, headers: { 'retry-after': '540' } }
    renderDownloadPage()

    await userEvent.type(await screen.findByLabelText('Mot de passe'), 'secret1')
    await userEvent.click(await downloadButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Trop de tentatives, réessayez dans 9 minutes.',
    )
  })

  it('falls back to a vague delay without Retry-After', async () => {
    metadataReply = { status: 200, data: metadata({ hasPassword: true }) }
    downloadReply = { status: 429 }
    renderDownloadPage()

    await userEvent.type(await screen.findByLabelText('Mot de passe'), 'secret1')
    await userEvent.click(await downloadButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Trop de tentatives, réessayez dans quelques minutes.',
    )
  })

  it('reports an expired or unknown link', async () => {
    metadataReply = { status: 410 }
    renderDownloadPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Ce fichier n'est plus disponible en téléchargement car il a expiré.",
    )
    expect(screen.queryByRole('button', { name: 'Télécharger' })).not.toBeInTheDocument()
  })

  it('switches to the expired message when the link expires before the download', async () => {
    downloadReply = { status: 410 }
    renderDownloadPage()

    await userEvent.click(await downloadButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Ce fichier n'est plus disponible en téléchargement car il a expiré.",
    )
    expect(screen.queryByRole('button', { name: 'Télécharger' })).not.toBeInTheDocument()
  })

  it('reports a failure to load the metadata', async () => {
    metadataReply = { status: 500 }
    renderDownloadPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Impossible de charger ce fichier pour le moment, réessayez plus tard.',
    )
  })

  it('reports a failure to issue the download link', async () => {
    downloadReply = { status: 500 }
    renderDownloadPage()

    await userEvent.click(await downloadButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Téléchargement impossible pour le moment, réessayez plus tard.',
    )
  })
})
