import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Tag } from './Tag'

describe('Tag', () => {
  it('shows the name as plain text by default', () => {
    render(<Tag name="facture" />)

    expect(screen.getByText('facture')).toHaveAttribute('title', 'facture')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('becomes a button when it can be clicked', async () => {
    const onClick = vi.fn<() => void>()
    render(<Tag name="facture" onClick={onClick} clickLabel="Filtrer sur le tag facture" />)

    await userEvent.click(screen.getByRole('button', { name: 'Filtrer sur le tag facture' }))

    expect(onClick).toHaveBeenCalledOnce()
  })

  it('offers to remove it', async () => {
    const onRemove = vi.fn<() => void>()
    render(<Tag name="facture" onRemove={onRemove} removeLabel="Retirer le filtre facture" />)

    await userEvent.click(screen.getByRole('button', { name: 'Retirer le filtre facture' }))

    expect(onRemove).toHaveBeenCalledOnce()
  })

  it('names the remove button after the tag by default', () => {
    render(<Tag name="facture" onRemove={() => {}} />)

    expect(screen.getByRole('button', { name: 'Retirer facture' })).toBeInTheDocument()
  })
})
