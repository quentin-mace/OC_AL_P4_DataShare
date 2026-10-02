import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { paths } from '../../routes/paths'
import { Header } from './Header'

function renderHeader(isAuthenticated?: boolean) {
  render(
    <MemoryRouter>
      <Header isAuthenticated={isAuthenticated} />
    </MemoryRouter>,
  )
}

describe('Header', () => {
  it('links the logo to the home page', () => {
    renderHeader()

    expect(screen.getByRole('link', { name: 'DataShare' })).toHaveAttribute('href', paths.home)
  })

  it('invites a visitor to log in', () => {
    renderHeader()

    expect(screen.getByRole('link', { name: 'Se connecter' })).toHaveAttribute('href', paths.login)
    expect(screen.queryByRole('link', { name: 'Mon espace' })).not.toBeInTheDocument()
  })

  it('leads a logged-in user to their space', () => {
    renderHeader(true)

    expect(screen.getByRole('link', { name: 'Mon espace' })).toHaveAttribute('href', paths.files)
    expect(screen.queryByRole('link', { name: 'Se connecter' })).not.toBeInTheDocument()
  })
})
