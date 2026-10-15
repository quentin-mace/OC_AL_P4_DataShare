import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FileHistoryItem } from '../../api/files'
import { paths } from '../../routes/paths'
import { FileRow } from './FileRow'

function file(overrides: Partial<FileHistoryItem> = {}): FileHistoryItem {
  return {
    id: 1,
    name: 'compo2.mp3',
    size: 1024,
    mimeType: 'audio/mpeg',
    sentAt: new Date(2026, 9, 12, 9, 0).toISOString(),
    expiresAt: new Date(2026, 9, 15, 9, 0).toISOString(),
    status: 'active',
    hasPassword: false,
    downloadToken: '0123456789abcdef',
    tags: [],
    ...overrides,
  }
}

function renderRow(
  item: FileHistoryItem,
  {
    onDelete = vi.fn<(file: FileHistoryItem) => void>(),
    onTagSelect = vi.fn<(tag: string) => void>(),
  } = {},
) {
  render(
    <MemoryRouter>
      <ul>
        <FileRow file={item} onDelete={onDelete} onTagSelect={onTagSelect} />
      </ul>
    </MemoryRouter>,
  )
}

describe('FileRow', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 13, 10, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the name and the days left', () => {
    renderRow(file())

    expect(screen.getByText('compo2.mp3')).toHaveAttribute('title', 'compo2.mp3')
    expect(screen.getByText('Expire dans 2 jours')).toBeInTheDocument()
  })

  it('links an active file to its download page', () => {
    renderRow(file())

    expect(screen.getByRole('link', { name: 'Accéder' })).toHaveAttribute(
      'href',
      paths.download('0123456789abcdef'),
    )
  })

  it('shows a lock on a password protected file only', () => {
    renderRow(file({ hasPassword: true }))

    expect(screen.getByText('Protégé par mot de passe')).toBeInTheDocument()
  })

  it('shows no lock without a password', () => {
    renderRow(file())

    expect(screen.queryByText('Protégé par mot de passe')).not.toBeInTheDocument()
  })

  it('marks an expired file and offers no link', () => {
    renderRow(file({ status: 'expired', expiresAt: new Date(2026, 9, 10).toISOString() }))

    expect(screen.getByText('Expiré')).toBeInTheDocument()
    expect(
      screen.getByText("Ce fichier a expiré, il n'est plus stocké chez nous"),
    ).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('asks to delete an active file', async () => {
    const onDelete = vi.fn<(file: FileHistoryItem) => void>()
    const item = file()
    renderRow(item, { onDelete })

    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }))

    expect(onDelete).toHaveBeenCalledExactlyOnceWith(item)
  })

  it('asks to delete an expired file too', async () => {
    const onDelete = vi.fn<(file: FileHistoryItem) => void>()
    const item = file({ status: 'expired', expiresAt: new Date(2026, 9, 10).toISOString() })
    renderRow(item, { onDelete })

    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }))

    expect(onDelete).toHaveBeenCalledExactlyOnceWith(item)
  })

  it('lists the tags of the file', () => {
    renderRow(file({ tags: ['facture', 'client-x'] }))

    const tags = screen.getByRole('list', { name: 'Tags' })
    expect(tags).toHaveTextContent('factureclient-x')
  })

  it('shows no tag list without tags', () => {
    renderRow(file())

    expect(screen.queryByRole('list', { name: 'Tags' })).not.toBeInTheDocument()
  })

  it('filters on a tag when it is clicked', async () => {
    const onTagSelect = vi.fn<(tag: string) => void>()
    renderRow(file({ tags: ['facture', 'client-x'] }), { onTagSelect })

    await userEvent.click(screen.getByRole('button', { name: 'Filtrer sur le tag client-x' }))

    expect(onTagSelect).toHaveBeenCalledExactlyOnceWith('client-x')
  })
})
