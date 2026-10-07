import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../api/client'
import { paths } from '../routes/paths'
import { routes } from '../routes/routes'

const sent = vi.fn<(body: unknown) => void>()
let respond: (config: InternalAxiosRequestConfig) => Promise<{ status: number; data: unknown }>

// Remplace le réseau : chaque test choisit la réponse de POST /register.
const adapter: AxiosAdapter = async (config) => {
  sent(JSON.parse(config.data))
  const { status, data } = await respond(config)
  const response = { data, status, statusText: '', headers: {}, config }
  if (status >= 400) {
    throw new AxiosError('Request failed', undefined, config, null, response)
  }
  return response
}

function replyWith(status: number, data: unknown = {}) {
  respond = async () => ({ status, data })
}

function renderRegisterPage() {
  const router = createMemoryRouter(routes, { initialEntries: [paths.register] })
  render(<RouterProvider router={router} />)
  return router
}

async function fillForm(overrides: Partial<Record<string, string>> = {}) {
  const values = {
    Email: 'alice@example.com',
    Prénom: 'Alice',
    Nom: 'Martin',
    'Mot de passe': 'correct-cheval-batterie',
    'Vérification du mot de passe': 'correct-cheval-batterie',
    ...overrides,
  }
  for (const [label, value] of Object.entries(values)) {
    if (value) await userEvent.type(screen.getByLabelText(label), value)
  }
}

const submit = () => userEvent.click(screen.getByRole('button', { name: 'Créer mon compte' }))

describe('RegisterPage', () => {
  beforeEach(() => {
    apiClient.defaults.adapter = adapter
    replyWith(201, { id: 1, email: 'alice@example.com', firstName: 'Alice', lastName: 'Martin' })
  })

  afterEach(() => {
    apiClient.defaults.adapter = undefined
    sent.mockReset()
  })

  it('shows client-side errors without calling the API', async () => {
    renderRegisterPage()

    await submit()

    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Saisissez votre email.')
    expect(screen.getByLabelText('Prénom')).toHaveAccessibleDescription('Saisissez votre prénom.')
    expect(sent).not.toHaveBeenCalled()
  })

  it.each([
    [
      'a password shorter than sixteen characters',
      'aB3$dE6&gH9!jK2',
      'Le mot de passe doit contenir au moins 16 caractères.',
    ],
    [
      'a long but guessable password',
      'aaaaaaaaaaaaaaaa',
      'Mot de passe trop prévisible, variez davantage les caractères.',
    ],
  ])('rejects %s before sending', async (_case, password, message) => {
    renderRegisterPage()
    await fillForm({ 'Mot de passe': password, 'Vérification du mot de passe': password })

    await submit()

    expect(screen.getByLabelText('Mot de passe')).toHaveAccessibleDescription(message)
    expect(sent).not.toHaveBeenCalled()
  })

  it('rejects a confirmation that does not match', async () => {
    renderRegisterPage()
    await fillForm({ 'Vérification du mot de passe': 'correct-cheval-batteri' })

    await submit()

    expect(screen.getByLabelText('Vérification du mot de passe')).toHaveAccessibleDescription(
      'Les mots de passe ne correspondent pas.',
    )
    expect(sent).not.toHaveBeenCalled()
  })

  it('sends the four API fields and redirects to the login page', async () => {
    const router = renderRegisterPage()
    await fillForm({ Prénom: '  Alice  ' })

    await submit()

    expect(sent).toHaveBeenCalledWith({
      email: 'alice@example.com',
      firstName: 'Alice',
      lastName: 'Martin',
      plainPassword: 'correct-cheval-batterie',
    })
    expect(await screen.findByRole('heading', { level: 1, name: 'Connexion' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(paths.login)
    expect(screen.getByRole('status')).toHaveTextContent('Compte créé, vous pouvez vous connecter.')
  })

  it('places each server violation under its field', async () => {
    replyWith(422, {
      status: 422,
      violations: [
        {
          propertyPath: 'email',
          message: 'An account already exists with this email address.',
          code: '23bd9dbf-6b9b-41cd-a99e-4844bcf3077f',
        },
        { propertyPath: 'lastName', message: 'This value should not be blank.' },
      ],
    })
    renderRegisterPage()
    await fillForm()

    await submit()

    const email = await screen.findByLabelText('Email', { selector: '[aria-invalid="true"]' })
    expect(email).toHaveAccessibleDescription('Un compte existe déjà avec cette adresse email.')
    expect(email).toHaveFocus()
    expect(screen.getByLabelText('Nom')).toHaveAccessibleDescription('Nom refusé.')
  })

  it('reports an unexpected failure in an alert', async () => {
    replyWith(500)
    renderRegisterPage()
    await fillForm()

    await submit()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Inscription impossible pour le moment, réessayez plus tard.',
    )
  })

  it('links to the login page', () => {
    renderRegisterPage()

    expect(screen.getByRole('link', { name: "J'ai déjà un compte" })).toHaveAttribute(
      'href',
      paths.login,
    )
  })
})
