import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { MobileMenu } from './MobileMenu'

function renderMenu(open: boolean) {
  const onClose = vi.fn<() => void>()
  render(
    <MemoryRouter>
      <MobileMenu open={open} onClose={onClose} />
    </MemoryRouter>,
  )
  return onClose
}

describe('MobileMenu', () => {
  it('renders nothing while closed', () => {
    renderMenu(false)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the navigation of the personal space', () => {
    renderMenu(true)

    const menu = screen.getByRole('dialog', { name: 'Menu' })
    expect(menu).toHaveTextContent('DataShare')
    expect(screen.getByRole('link', { name: 'Mes fichiers' })).toBeInTheDocument()
  })

  it('closes from its close button', async () => {
    const onClose = renderMenu(true)

    await userEvent.click(screen.getByRole('button', { name: 'Fermer le menu' }))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('closes on Escape', () => {
    const onClose = renderMenu(true)

    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('closes on a click on the backdrop, not inside the panel', async () => {
    const onClose = renderMenu(true)

    await userEvent.click(screen.getByText('DataShare'))
    expect(onClose).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('dialog'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('closes once a link is followed', async () => {
    const onClose = renderMenu(true)

    await userEvent.click(screen.getByRole('link', { name: 'Mes fichiers' }))

    expect(onClose).toHaveBeenCalledOnce()
  })
})
