import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, type AxiosAdapter } from 'axios'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../api/client'
import { useAuthStore } from '../auth/authStore'
import { paths } from '../routes/paths'
import { routes } from '../routes/routes'
import { fakeToken } from '../test/jwt'
import type { LoginLocationState } from './LoginPage'

const token = fakeToken(3600)
const sent = vi.fn<(body: unknown) => void>()
let reply: { status: number; data: unknown }

// Remplace le réseau : chaque test choisit la réponse de POST /login.
const adapter: AxiosAdapter = async (config) => {
  sent(JSON.parse(config.data))
  const response = { ...reply, statusText: '', headers: {}, config }
  if (reply.status >= 400) {
    throw new AxiosError('Request failed', undefined, config, null, response)
  }
  return response
}

function renderLoginPage(state?: LoginLocationState) {
  const router = createMemoryRouter(routes, {
    initialEntries: [{ pathname: paths.login, state }],
  })
  render(<RouterProvider router={router} />)
  return router
}

async function fillForm(email = 'alice@example.com', password = 'correct-cheval-batterie') {
  await userEvent.type(screen.getByLabelText('Email'), email)
  await userEvent.type(screen.getByLabelText('Mot de passe'), password)
}

const submit = () => userEvent.click(screen.getByRole('button', { name: 'Connexion' }))

describe('LoginPage', () => {
  beforeEach(() => {
    apiClient.defaults.adapter = adapter
    reply = { status: 200, data: { token } }
  })

  afterEach(() => {
    apiClient.defaults.adapter = undefined
    sent.mockReset()
    useAuthStore.setState({ token: null, sessionExpired: false })
    localStorage.clear()
  })

  it('shows client-side errors without calling the API', async () => {
    renderLoginPage()

    await submit()

    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Saisissez votre email.')
    expect(screen.getByLabelText('Mot de passe')).toHaveAccessibleDescription(
      'Saisissez votre mot de passe.',
    )
    expect(sent).not.toHaveBeenCalled()
  })

  it('stores the token and opens the personal space', async () => {
    const router = renderLoginPage()
    await fillForm(' alice@example.com ')

    await submit()

    expect(sent).toHaveBeenCalledWith({
      email: 'alice@example.com',
      password: 'correct-cheval-batterie',
    })
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Mes fichiers' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(paths.files)
    expect(useAuthStore.getState().token).toBe(token)
  })

  it('returns to the page requested before logging in', async () => {
    const router = renderLoginPage({ from: paths.home })
    await fillForm()

    await submit()

    await screen.findByRole('heading', { level: 1, name: 'Tu veux partager un fichier ?' })
    expect(router.state.location.pathname).toBe(paths.home)
  })

  it.each([
    [401, 'Email ou mot de passe incorrect.'],
    [429, 'Trop de tentatives de connexion, réessayez dans quelques minutes.'],
    [500, 'Connexion impossible pour le moment, réessayez plus tard.'],
  ])('reports a %i response in an alert', async (status, message) => {
    reply = { status, data: {} }
    renderLoginPage()
    await fillForm()

    await submit()

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(useAuthStore.getState().token).toBeNull()
  })

  it('confirms a freshly created account', () => {
    renderLoginPage({ registered: true })

    expect(screen.getByRole('status')).toHaveTextContent('Compte créé, vous pouvez vous connecter.')
  })

  it('drops the account creation notice once an attempt fails', async () => {
    reply = { status: 401, data: {} }
    renderLoginPage({ registered: true })
    await fillForm()

    await submit()

    await screen.findByRole('alert')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('explains why the user has to log in again', () => {
    useAuthStore.setState({ sessionExpired: true })
    renderLoginPage()

    expect(screen.getByRole('status')).toHaveTextContent(
      'Votre session a expiré, reconnectez-vous.',
    )
  })

  it('sends a logged-in user straight to their space', () => {
    useAuthStore.setState({ token })
    const router = renderLoginPage()

    expect(router.state.location.pathname).toBe(paths.files)
  })

  it('links to the registration page', () => {
    renderLoginPage()

    expect(screen.getByRole('link', { name: 'Créer un compte' })).toHaveAttribute(
      'href',
      paths.register,
    )
  })
})
