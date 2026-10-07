import { act, render, screen } from '@testing-library/react'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { afterEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '../auth/authStore'
import { fakeToken } from '../test/jwt'
import { paths } from './paths'
import { routes } from './routes'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

describe('routes', () => {
  afterEach(() => {
    useAuthStore.setState({ token: null, sessionExpired: false })
    localStorage.clear()
  })

  it.each([
    [paths.home, 'Tu veux partager un fichier ?'],
    [paths.login, 'Connexion'],
    [paths.register, 'Créer un compte'],
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
    useAuthStore.setState({ token: fakeToken(3600) })
    renderAt(paths.files)

    expect(screen.getByRole('navigation', { name: 'Navigation principale' })).toBeInTheDocument()
  })

  it('renders the personal space to a logged-in user', () => {
    useAuthStore.setState({ token: fakeToken(3600) })
    renderAt(paths.files)

    expect(screen.getByRole('heading', { level: 1, name: 'Mes fichiers' })).toBeInTheDocument()
  })

  it('sends a visitor of the personal space to the login page', () => {
    const router = renderAt(paths.files)

    expect(router.state.location.pathname).toBe(paths.login)
    expect(router.state.location.state).toEqual({ from: paths.files })
  })

  it('leaves the personal space as soon as the session ends', () => {
    useAuthStore.setState({ token: fakeToken(3600) })
    const router = renderAt(paths.files)

    act(() => useAuthStore.getState().logout({ expired: true }))

    expect(router.state.location.pathname).toBe(paths.login)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Votre session a expiré, reconnectez-vous.',
    )
  })
})
