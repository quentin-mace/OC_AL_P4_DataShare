import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import type { AxiosAdapter } from 'axios'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { apiClient } from '../../api/client'
import { useAuthStore } from '../../auth/authStore'
import { paths } from '../../routes/paths'
import { routes } from '../../routes/routes'
import { fakeToken } from '../../test/jwt'

// La page Mes fichiers, rendue dans le gabarit, reçoit un historique vide.
const adapter: AxiosAdapter = async (config) => ({
  data: [],
  status: 200,
  statusText: '',
  headers: {},
  config,
})

function renderPersonalSpace() {
  useAuthStore.setState({ token: fakeToken(3600) })
  const router = createMemoryRouter(routes, { initialEntries: [paths.files] })
  render(<RouterProvider router={router} />)
  return router
}

describe('DashboardLayout', () => {
  beforeEach(() => {
    apiClient.defaults.adapter = adapter
  })

  afterEach(() => {
    apiClient.defaults.adapter = undefined
    useAuthStore.setState({ token: null, sessionExpired: false })
    localStorage.clear()
  })

  it('logs the user out and returns to the home page', async () => {
    const router = renderPersonalSpace()

    await userEvent.click(screen.getByRole('button', { name: 'Déconnexion' }))

    expect(router.state.location.pathname).toBe(paths.home)
    expect(useAuthStore.getState()).toMatchObject({ token: null, sessionExpired: false })
    expect(screen.getByRole('link', { name: 'Se connecter' })).toBeInTheDocument()
  })

  it('opens the mobile menu from the burger button', async () => {
    renderPersonalSpace()
    const burger = screen.getByRole('button', { name: 'Ouvrir le menu' })
    expect(burger).toHaveAttribute('aria-expanded', 'false')

    await userEvent.click(burger)

    expect(screen.getByRole('dialog', { name: 'Menu' })).toBeInTheDocument()
    expect(burger).toHaveAttribute('aria-expanded', 'true')

    await userEvent.click(screen.getByRole('button', { name: 'Fermer le menu' }))

    expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument()
    expect(burger).toHaveAttribute('aria-expanded', 'false')
  })
})
