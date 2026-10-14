import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../api/client'
import type { FileHistoryItem, UploadedFile } from '../api/files'
import { useAuthStore } from '../auth/authStore'
import { paths } from '../routes/paths'
import { routes } from '../routes/routes'
import { fakeToken } from '../test/jwt'

interface Reply {
  status: number
  data?: unknown
}

const sent = vi.fn<(request: InternalAxiosRequestConfig) => void>()
let listReply: Reply

const uploaded: UploadedFile = {
  id: 99,
  name: 'nouveau.pdf',
  size: 10,
  mimeType: 'application/pdf',
  downloadToken: 'nouveau',
  expiresAt: new Date(2026, 9, 20).toISOString(),
  hasPassword: false,
  tags: [],
}

// Remplace le réseau : GET /files renvoie listReply, POST /files et DELETE
// /files/{id} réussissent toujours.
const replies: Record<string, Reply> = {
  post: { status: 201, data: uploaded },
  delete: { status: 204 },
}

const adapter: AxiosAdapter = async (config) => {
  sent(config)
  const reply = replies[config.method ?? ''] ?? listReply
  const response = { data: [], headers: {}, ...reply, statusText: '', config }
  if (reply.status >= 400) {
    throw new AxiosError('Request failed', undefined, config, null, response)
  }
  return response
}

let nextId = 1

function file(overrides: Partial<FileHistoryItem> = {}): FileHistoryItem {
  const id = nextId++
  return {
    id,
    name: `fichier-${id}.pdf`,
    size: 1024,
    mimeType: 'application/pdf',
    sentAt: new Date(2026, 9, 12, 9, 0).toISOString(),
    expiresAt: new Date(2026, 9, 15, 9, 0).toISOString(),
    status: 'active',
    hasPassword: false,
    downloadToken: `token-${id}`,
    tags: [],
    ...overrides,
  }
}

const expiredFile = (name: string) =>
  file({ name, status: 'expired', expiresAt: new Date(2026, 9, 10).toISOString() })

function renderFilesPage() {
  useAuthStore.setState({ token: fakeToken(3600) })
  const router = createMemoryRouter(routes, { initialEntries: [paths.files] })
  render(<RouterProvider router={router} />)
}

const rowNames = () =>
  within(screen.getByRole('list'))
    .getAllByRole('listitem')
    .map((row) => row.querySelector('[title]')?.getAttribute('title'))
const listCalls = () => sent.mock.calls.filter(([config]) => config.method === 'get').length
const chooseFilter = (name: string) => userEvent.click(screen.getByRole('radio', { name }))
const deleteCalls = () => sent.mock.calls.filter(([config]) => config.method === 'delete')
const askToDelete = (name: string) =>
  userEvent.click(
    within(screen.getByText(name).closest('li')!).getByRole('button', { name: 'Supprimer' }),
  )
const confirmDeletion = () =>
  userEvent.click(
    within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Supprimer' }),
  )

describe('FilesPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 13, 10, 0))
    apiClient.defaults.adapter = adapter
    listReply = {
      status: 200,
      data: [file({ name: 'compo2.mp3' }), expiredFile('vacances.mp4')],
    }
  })

  afterEach(() => {
    vi.useRealTimers()
    apiClient.defaults.adapter = undefined
    sent.mockReset()
    useAuthStore.setState({ token: null, sessionExpired: false })
    localStorage.clear()
  })

  it('loads the history of the logged-in user', async () => {
    renderFilesPage()

    expect(screen.getByRole('status')).toHaveTextContent('Chargement...')
    expect(await screen.findByText('compo2.mp3')).toBeInTheDocument()
    expect(sent.mock.calls[0][0].url).toBe('/files')
    expect(sent.mock.calls[0][0].headers.Authorization).toMatch(/^Bearer /)
  })

  it('shows every file, active or expired, in the order of the API', async () => {
    renderFilesPage()

    await screen.findByText('compo2.mp3')
    expect(rowNames()).toEqual(['compo2.mp3', 'vacances.mp4'])
    expect(screen.getByRole('radio', { name: 'Tous' })).toBeChecked()
  })

  it('filters the loaded list without calling the API again', async () => {
    renderFilesPage()
    await screen.findByText('compo2.mp3')

    await chooseFilter('Actifs')
    expect(rowNames()).toEqual(['compo2.mp3'])

    await chooseFilter('Expiré')
    expect(rowNames()).toEqual(['vacances.mp4'])

    await chooseFilter('Tous')
    expect(rowNames()).toEqual(['compo2.mp3', 'vacances.mp4'])
    expect(listCalls()).toBe(1)
  })

  it('says when the user has no file yet', async () => {
    listReply = { status: 200, data: [] }
    renderFilesPage()

    expect(await screen.findByText("Vous n'avez encore envoyé aucun fichier.")).toBeInTheDocument()
  })

  it('says when no file matches the filter', async () => {
    listReply = { status: 200, data: [file({ name: 'compo2.mp3' })] }
    renderFilesPage()
    await screen.findByText('compo2.mp3')

    await chooseFilter('Expiré')

    expect(screen.getByText('Aucun fichier expiré.')).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('reports a failed load', async () => {
    listReply = { status: 500 }
    renderFilesPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Impossible de charger vos fichiers pour le moment, réessayez plus tard.',
    )
  })

  it('shows ten files at a time', async () => {
    listReply = {
      status: 200,
      data: [
        ...Array.from({ length: 11 }, (_, index) => file({ name: `actif-${index + 1}.pdf` })),
        expiredFile('expire-1.pdf'),
      ],
    }
    renderFilesPage()
    await screen.findByText('actif-1.pdf')

    expect(rowNames()).toHaveLength(10)

    await userEvent.click(screen.getByRole('button', { name: 'Afficher plus' }))

    expect(rowNames()).toHaveLength(12)
    expect(screen.queryByRole('button', { name: 'Afficher plus' })).not.toBeInTheDocument()
    expect(listCalls()).toBe(1)
  })

  it('starts again from ten files when the filter changes', async () => {
    listReply = {
      status: 200,
      data: Array.from({ length: 25 }, (_, index) => file({ name: `actif-${index + 1}.pdf` })),
    }
    renderFilesPage()
    await screen.findByText('actif-1.pdf')
    await userEvent.click(screen.getByRole('button', { name: 'Afficher plus' }))
    expect(rowNames()).toHaveLength(20)

    await chooseFilter('Actifs')

    expect(rowNames()).toHaveLength(10)
  })

  it('reloads the list after an upload', async () => {
    renderFilesPage()
    await screen.findByText('compo2.mp3')
    listReply = { status: 200, data: [file({ name: 'nouveau.pdf' }), file({ name: 'compo2.mp3' })] }

    await userEvent.click(screen.getByRole('button', { name: 'Ajouter des fichiers' }))
    await userEvent.upload(
      screen.getByLabelText('Fichier'),
      new File(['contenu'], 'nouveau.pdf', { type: 'application/pdf' }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Téléverser' }))

    await waitFor(() => expect(rowNames()).toEqual(['nouveau.pdf', 'compo2.mp3']))
    expect(listCalls()).toBe(2)
  })

  it('deletes a file once confirmed, without reloading the list', async () => {
    renderFilesPage()
    await screen.findByText('compo2.mp3')

    await askToDelete('compo2.mp3')
    expect(screen.getByRole('alertdialog')).toHaveAccessibleDescription(/^compo2\.mp3/)
    await confirmDeletion()

    await waitFor(() => expect(rowNames()).toEqual(['vacances.mp4']))
    const [deletedFile] = listReply.data as FileHistoryItem[]
    expect(deleteCalls().map(([config]) => config.url)).toEqual([`/files/${deletedFile.id}`])
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Le fichier compo2.mp3 a été supprimé.')
    expect(listCalls()).toBe(1)
  })

  it('moves the focus to the title once the row is gone', async () => {
    renderFilesPage()
    await screen.findByText('compo2.mp3')

    await askToDelete('compo2.mp3')
    await confirmDeletion()

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Mes fichiers' })).toHaveFocus())
  })

  it('deletes an expired file once confirmed', async () => {
    renderFilesPage()
    await screen.findByText('vacances.mp4')

    await askToDelete('vacances.mp4')
    expect(screen.getByRole('alertdialog')).toHaveAccessibleDescription(
      'vacances.mp4 a expiré et ne sera plus affiché dans votre historique.',
    )
    await confirmDeletion()

    await waitFor(() => expect(rowNames()).toEqual(['compo2.mp3']))
    expect(deleteCalls()).toHaveLength(1)
    expect(screen.getByRole('status')).toHaveTextContent('Le fichier vacances.mp4 a été supprimé.')
    expect(screen.getByRole('heading', { name: 'Mes fichiers' })).toHaveFocus()
  })

  it('keeps the file when the deletion is cancelled', async () => {
    renderFilesPage()
    await screen.findByText('compo2.mp3')

    await askToDelete('compo2.mp3')
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(rowNames()).toEqual(['compo2.mp3', 'vacances.mp4'])
    expect(deleteCalls()).toHaveLength(0)
  })
})
