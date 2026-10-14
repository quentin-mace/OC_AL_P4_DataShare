import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  AxiosError,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../api/client'
import type { FileHistoryItem } from '../../api/files'
import { DeleteFileDialog } from './DeleteFileDialog'

const sent = vi.fn<(request: InternalAxiosRequestConfig) => void>()
let replyStatus: number

// Remplace le réseau : chaque requête reçoit replyStatus.
const adapter: AxiosAdapter = async (config) => {
  sent(config)
  const response = { data: '', headers: {}, status: replyStatus, statusText: '', config }
  if (replyStatus >= 400) {
    throw new AxiosError('Request failed', undefined, config, null, response)
  }
  return response
}

const file: FileHistoryItem = {
  id: 7,
  name: 'compo2.mp3',
  size: 1024,
  mimeType: 'audio/mpeg',
  sentAt: new Date(2026, 9, 12).toISOString(),
  expiresAt: new Date(2026, 9, 15).toISOString(),
  status: 'active',
  hasPassword: false,
  downloadToken: 'token',
  tags: [],
}

function renderDialog() {
  const onClose = vi.fn<() => void>()
  const onDeleted = vi.fn<(deleted: FileHistoryItem) => void>()
  render(<DeleteFileDialog file={file} onClose={onClose} onDeleted={onDeleted} />)
  return { onClose, onDeleted }
}

const confirmButton = () => screen.getByRole('button', { name: 'Supprimer' })

describe('DeleteFileDialog', () => {
  beforeEach(() => {
    apiClient.defaults.adapter = adapter
    replyStatus = 204
  })

  afterEach(() => {
    apiClient.defaults.adapter = undefined
    sent.mockReset()
  })

  it('renders nothing without a file', () => {
    render(<DeleteFileDialog file={null} onClose={() => {}} onDeleted={() => {}} />)

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('asks for a confirmation that names the file', () => {
    renderDialog()

    const dialog = screen.getByRole('alertdialog', { name: 'Supprimer ce fichier ?' })
    expect(dialog).toHaveAccessibleDescription(/^compo2\.mp3 sera supprimé définitivement/)
    expect(dialog).toHaveAccessibleDescription(/Cette action est irréversible\.$/)
  })

  it('focuses the harmless choice first', () => {
    renderDialog()

    expect(screen.getByRole('button', { name: 'Annuler' })).toHaveFocus()
  })

  it('deletes the file once confirmed', async () => {
    const { onDeleted, onClose } = renderDialog()

    await userEvent.click(confirmButton())

    expect(sent).toHaveBeenCalledOnce()
    expect(sent.mock.calls[0][0].method).toBe('delete')
    expect(sent.mock.calls[0][0].url).toBe('/files/7')
    expect(onDeleted).toHaveBeenCalledExactlyOnceWith(file)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('treats a file already gone as deleted', async () => {
    replyStatus = 404
    const { onDeleted } = renderDialog()

    await userEvent.click(confirmButton())

    expect(onDeleted).toHaveBeenCalledExactlyOnceWith(file)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('reports a failure and stays open', async () => {
    replyStatus = 500
    const { onDeleted } = renderDialog()

    await userEvent.click(confirmButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Impossible de supprimer ce fichier pour le moment, réessayez plus tard.',
    )
    expect(onDeleted).not.toHaveBeenCalled()
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Annuler' })).toHaveFocus()
  })

  it('cancels without calling the API', async () => {
    const { onClose } = renderDialog()

    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(onClose).toHaveBeenCalledOnce()
    expect(sent).not.toHaveBeenCalled()
  })

  it('cannot be closed while the deletion is under way', async () => {
    let respond: (response: AxiosResponse) => void = () => {}
    apiClient.defaults.adapter = (config) =>
      new Promise((resolve) => {
        respond = resolve
        sent(config)
      })
    const { onClose, onDeleted } = renderDialog()

    await userEvent.click(confirmButton())

    expect(screen.getByRole('button', { name: 'Suppression...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeDisabled()
    fireEvent(screen.getByRole('alertdialog'), new Event('cancel', { cancelable: true }))
    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(onClose).not.toHaveBeenCalled()

    respond({
      data: '',
      headers: {},
      status: 204,
      statusText: '',
      config: sent.mock.calls[0][0],
    })
    await vi.waitFor(() => expect(onDeleted).toHaveBeenCalledOnce())
  })
})
