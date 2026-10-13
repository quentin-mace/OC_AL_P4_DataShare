import { act, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import type { AxiosAdapter } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../api/client'
import { useAuthStore } from '../auth/authStore'
import { fakeToken } from '../test/jwt'
import { paths } from './paths'
import { routes } from './routes'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

// Les pages qui chargent des données (téléchargement) restent en attente :
// seul l'aiguillage est testé ici, sans réseau.
const requestedUrl = vi.fn<(url: string | undefined) => void>()
const pendingAdapter: AxiosAdapter = (config) => {
  requestedUrl(config.url)
  return new Promise(() => {})
}

describe('routes', () => {
  beforeEach(() => {
    apiClient.defaults.adapter = pendingAdapter
  })

  afterEach(() => {
    apiClient.defaults.adapter = undefined
    requestedUrl.mockReset()
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

  it('passes the download token to the download page', async () => {
    renderAt(paths.download('0123456789abcdef0123456789abcdef'))

    await waitFor(() =>
      expect(requestedUrl).toHaveBeenCalledWith('/downloads/0123456789abcdef0123456789abcdef'),
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

  it('offers a logged-in user their space from the public pages', () => {
    useAuthStore.setState({ token: fakeToken(3600) })
    renderAt(paths.home)

    expect(screen.getByRole('link', { name: 'Mon espace' })).toHaveAttribute('href', paths.files)
  })
})
