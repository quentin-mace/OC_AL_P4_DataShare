import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { afterEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '../../auth/authStore'
import { paths } from '../../routes/paths'
import { routes } from '../../routes/routes'
import { fakeToken } from '../../test/jwt'

function renderPersonalSpace() {
  useAuthStore.setState({ token: fakeToken(3600) })
  const router = createMemoryRouter(routes, { initialEntries: [paths.files] })
  render(<RouterProvider router={router} />)
  return router
}

describe('DashboardLayout', () => {
  afterEach(() => {
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
})
