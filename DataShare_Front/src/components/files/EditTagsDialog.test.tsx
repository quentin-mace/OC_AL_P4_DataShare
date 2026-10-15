import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  AxiosError,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../api/client'
import type { FileHistoryItem } from '../../api/files'
import { EditTagsDialog } from './EditTagsDialog'

interface Reply {
  status: number
  data?: unknown
}

const sent = vi.fn<(request: InternalAxiosRequestConfig) => void>()
let reply: (config: InternalAxiosRequestConfig) => Reply

// Remplace le réseau : chaque requête reçoit reply(config).
const adapter: AxiosAdapter = async (config) => {
  sent(config)
  const { status, data } = reply(config)
  const response = { data, headers: {}, status, statusText: '', config }
  if (status >= 400) {
    throw new AxiosError('Request failed', undefined, config, null, response)
  }
  return response
}

// Répond comme le back : l'état des tags du fichier après l'opération.
function replyLikeTheApi(tags: string[]) {
  return (config: InternalAxiosRequestConfig): Reply => {
    const body = config.data ? (JSON.parse(config.data as string) as { tag: string }) : null
    const urlTag = decodeURIComponent(config.url!.split('/tags/')[1] ?? '')
    if (config.method === 'post') tags = [...tags, body!.tag]
    if (config.method === 'put') tags = tags.map((tag) => (tag === urlTag ? body!.tag : tag))
    if (config.method === 'delete') tags = tags.filter((tag) => tag !== urlTag)
    return { status: config.method === 'post' ? 201 : 200, data: { id: 7, tags } }
  }
}

const file: FileHistoryItem = {
  id: 7,
  name: 'facture-octobre.pdf',
  size: 1024,
  mimeType: 'application/pdf',
  sentAt: new Date(2026, 9, 12).toISOString(),
  expiresAt: new Date(2026, 9, 15).toISOString(),
  status: 'active',
  hasPassword: false,
  downloadToken: 'token',
  tags: ['facture', 'client-x'],
}

// La page tient les tags à jour d'après onTagsChanged : le test fait de même.
function renderDialog(initial: FileHistoryItem = file) {
  const onClose = vi.fn<() => void>()
  const onTagsChanged = vi.fn<(id: number, tags: string[]) => void>()

  function Harness() {
    const [current, setCurrent] = useState(initial)
    return (
      <EditTagsDialog
        file={current}
        onClose={onClose}
        onTagsChanged={(id, tags) => {
          onTagsChanged(id, tags)
          setCurrent((previous) => ({ ...previous, tags }))
        }}
      />
    )
  }

  render(<Harness />)
  return { onClose, onTagsChanged }
}

const tagNames = () =>
  within(screen.getByRole('list', { name: 'Tags' }))
    .getAllByRole('listitem')
    .map((item) => item.textContent?.replace(/Renommer|Retirer/g, ''))
const addInput = () => screen.getByLabelText('Ajouter un tag')
const addTag = async (tag: string) => {
  await userEvent.type(addInput(), tag)
  await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }))
}

describe('EditTagsDialog', () => {
  beforeEach(() => {
    apiClient.defaults.adapter = adapter
    reply = replyLikeTheApi([...file.tags])
  })

  afterEach(() => {
    apiClient.defaults.adapter = undefined
    sent.mockReset()
  })

  it('renders nothing without a file', () => {
    render(<EditTagsDialog file={null} onClose={() => {}} onTagsChanged={() => {}} />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('lists the tags of the file and focuses the add field', () => {
    renderDialog()

    const dialog = screen.getByRole('dialog', { name: 'Tags du fichier' })
    expect(dialog).toHaveAccessibleDescription('facture-octobre.pdf')
    expect(tagNames()).toEqual(['facture', 'client-x'])
    expect(addInput()).toHaveFocus()
  })

  it('says when the file has no tag', () => {
    renderDialog({ ...file, tags: [] })

    expect(screen.getByText('Aucun tag sur ce fichier.')).toBeInTheDocument()
  })

  describe('adding', () => {
    it('adds a trimmed tag and keeps the field ready for the next one', async () => {
      const { onTagsChanged } = renderDialog()

      await addTag('  urgent ')

      expect(sent).toHaveBeenCalledOnce()
      const [config] = sent.mock.calls[0]
      expect(config.method).toBe('post')
      expect(config.url).toBe('/files/7/tags')
      expect(JSON.parse(config.data as string)).toEqual({ tag: 'urgent' })
      expect(onTagsChanged).toHaveBeenCalledExactlyOnceWith(7, ['facture', 'client-x', 'urgent'])
      expect(tagNames()).toEqual(['facture', 'client-x', 'urgent'])
      // Le champ est vidé et refocalisé une fois la réponse traitée.
      await waitFor(() => expect(addInput()).toHaveFocus())
      expect(addInput()).toHaveValue('')
    })

    it('adds with the Enter key', async () => {
      renderDialog()

      await userEvent.type(addInput(), 'urgent{Enter}')

      expect(sent).toHaveBeenCalledOnce()
    })

    it('refuses a tag the file already has, without calling the API', async () => {
      renderDialog()

      await addTag('facture')

      expect(addInput()).toHaveAccessibleDescription('Ce fichier porte déjà ce tag.')
      expect(sent).not.toHaveBeenCalled()
    })

    it('refuses an empty tag', async () => {
      renderDialog()

      await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }))

      expect(addInput()).toHaveAccessibleDescription('Saisissez un tag.')
      expect(sent).not.toHaveBeenCalled()
    })

    it('shows a refusal of the server on the field', async () => {
      reply = () => ({
        status: 422,
        data: { violations: [{ propertyPath: 'tag', message: 'This tag is already set.' }] },
      })
      const { onTagsChanged } = renderDialog()

      await addTag('urgent')

      expect(addInput()).toHaveAccessibleDescription(
        'Tag refusé, 30 caractères maximum et sans doublon sur ce fichier.',
      )
      expect(addInput()).toHaveFocus()
      expect(onTagsChanged).not.toHaveBeenCalled()
    })

    it('reports a file deleted in the meantime', async () => {
      reply = () => ({ status: 404 })
      renderDialog()

      await addTag('urgent')

      expect(await screen.findByRole('alert')).toHaveTextContent(
        "Ce fichier ou ce tag n'existe plus, rechargez la page.",
      )
      expect(addInput()).toHaveValue('urgent')
    })

    it('reports any other failure', async () => {
      reply = () => ({ status: 500 })
      renderDialog()

      await addTag('urgent')

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Modification impossible pour le moment, réessayez plus tard.',
      )
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(addInput()).toHaveFocus()
    })
  })

  describe('renaming', () => {
    const startRenaming = (tag: string) =>
      userEvent.click(screen.getByRole('button', { name: `Renommer le tag ${tag}` }))
    const renameInput = (tag: string) => screen.getByLabelText(`Nouveau nom du tag ${tag}`)

    it('opens on the current name, selected', async () => {
      renderDialog()

      await startRenaming('facture')

      const input = renameInput('facture') as HTMLInputElement
      expect(input).toHaveValue('facture')
      expect(input).toHaveFocus()
      expect([input.selectionStart, input.selectionEnd]).toEqual([0, 'facture'.length])
    })

    it('renames the tag on this file, with the name encoded in the URL', async () => {
      reply = replyLikeTheApi(['2026 T4', 'client-x'])
      const { onTagsChanged } = renderDialog({ ...file, tags: ['2026 T4', 'client-x'] })

      await startRenaming('2026 T4')
      await userEvent.clear(renameInput('2026 T4'))
      await userEvent.type(renameInput('2026 T4'), 'T4 2026{Enter}')

      const [config] = sent.mock.calls[0]
      expect(config.method).toBe('put')
      expect(config.url).toBe('/files/7/tags/2026%20T4')
      expect(JSON.parse(config.data as string)).toEqual({ tag: 'T4 2026' })
      expect(onTagsChanged).toHaveBeenCalledExactlyOnceWith(7, ['T4 2026', 'client-x'])
      expect(tagNames()).toEqual(['T4 2026', 'client-x'])
      expect(screen.getByRole('button', { name: 'Renommer le tag T4 2026' })).toHaveFocus()
    })

    it('does not call the API when the name is unchanged', async () => {
      renderDialog()

      await startRenaming('facture')
      await userEvent.click(screen.getByRole('button', { name: 'Valider' }))

      expect(sent).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: 'Renommer le tag facture' })).toHaveFocus()
    })

    it('refuses the name of another tag of the file', async () => {
      renderDialog()

      await startRenaming('facture')
      await userEvent.clear(renameInput('facture'))
      await userEvent.type(renameInput('facture'), 'client-x{Enter}')

      expect(renameInput('facture')).toHaveAccessibleDescription('Ce fichier porte déjà ce tag.')
      expect(sent).not.toHaveBeenCalled()
    })

    it('cancels with the button', async () => {
      renderDialog()

      await startRenaming('facture')
      await userEvent.click(screen.getByRole('button', { name: 'Annuler' }))

      expect(screen.queryByLabelText('Nouveau nom du tag facture')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Renommer le tag facture' })).toHaveFocus()
    })

    it('cancels with Escape without closing the dialog', async () => {
      const { onClose } = renderDialog()

      await startRenaming('facture')
      await userEvent.keyboard('{Escape}')

      expect(screen.queryByLabelText('Nouveau nom du tag facture')).not.toBeInTheDocument()
      expect(onClose).not.toHaveBeenCalled()
      expect(sent).not.toHaveBeenCalled()
    })
  })

  describe('removing', () => {
    const removeButton = (tag: string) =>
      screen.getByRole('button', { name: `Retirer le tag ${tag}` })

    it('removes the tag and moves the focus to the add field', async () => {
      const { onTagsChanged } = renderDialog()

      await userEvent.click(removeButton('facture'))

      const [config] = sent.mock.calls[0]
      expect(config.method).toBe('delete')
      expect(config.url).toBe('/files/7/tags/facture')
      expect(onTagsChanged).toHaveBeenCalledExactlyOnceWith(7, ['client-x'])
      expect(tagNames()).toEqual(['client-x'])
      expect(addInput()).toHaveFocus()
    })

    it('reports a failure and gives the focus back to the button', async () => {
      reply = () => ({ status: 500 })
      renderDialog()

      await userEvent.click(removeButton('facture'))

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Modification impossible pour le moment, réessayez plus tard.',
      )
      expect(tagNames()).toEqual(['facture', 'client-x'])
      expect(removeButton('facture')).toHaveFocus()
    })
  })

  it('closes, clearing any error', async () => {
    reply = () => ({ status: 500 })
    const { onClose } = renderDialog()
    await addTag('urgent')
    await screen.findByRole('alert')

    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('cannot be closed while a change is under way', async () => {
    let respond: (response: AxiosResponse) => void = () => {}
    apiClient.defaults.adapter = (config) =>
      new Promise((resolve) => {
        respond = resolve
        sent(config)
      })
    const { onClose, onTagsChanged } = renderDialog()

    await userEvent.click(screen.getByRole('button', { name: 'Retirer le tag facture' }))

    expect(screen.getByRole('button', { name: 'Retirer le tag client-x' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Ajouter' })).toBeDisabled()
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
    expect(onClose).not.toHaveBeenCalled()

    respond({
      data: { id: 7, tags: ['client-x'] },
      headers: {},
      status: 200,
      statusText: '',
      config: sent.mock.calls[0][0],
    })
    await vi.waitFor(() => expect(onTagsChanged).toHaveBeenCalledOnce())
  })
})
