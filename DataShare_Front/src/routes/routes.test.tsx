import { render, screen } from '@testing-library/react'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { describe, expect, it } from 'vitest'
import { paths } from './paths'
import { routes } from './routes'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

describe('routes', () => {
  it.each([
    [paths.home, 'Tu veux partager un fichier ?'],
    [paths.login, 'Connexion'],
    [paths.register, 'Créer un compte'],
    [paths.files, 'Mes fichiers'],
    [paths.download('0123456789abcdef0123456789abcdef'), 'Télécharger un fichier'],
    ['/unknown', 'Page introuvable'],
  ])('renders %s', (path, title) => {
    renderAt(path)

    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument()
  })

  it('passes the download token to the download page', () => {
    renderAt(paths.download('0123456789abcdef0123456789abcdef'))

    expect(screen.getByRole('heading', { level: 1 })).toHaveAttribute(
      'data-download-token',
      '0123456789abcdef0123456789abcdef',
    )
  })

  it('wraps the personal space in the dashboard layout', () => {
    renderAt(paths.files)

    expect(screen.getByRole('navigation', { name: 'Navigation principale' })).toBeInTheDocument()
  })
})
