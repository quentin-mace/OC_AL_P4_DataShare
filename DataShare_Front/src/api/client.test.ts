import { AxiosError, type AxiosAdapter } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient, setTokenProvider, setUnauthorizedHandler } from './client'

// Renvoie la requête telle qu'axios l'aurait émise, sans réseau.
const echo: AxiosAdapter = async (config) => ({
  data: config,
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
})

// Refuse la requête comme le ferait l'API.
const reject401: AxiosAdapter = async (config) => {
  const response = { data: {}, status: 401, statusText: '', headers: {}, config }
  throw new AxiosError('Request failed', undefined, config, null, response)
}

async function sentRequest() {
  const { data } = await apiClient.get('/files', { adapter: echo })
  return data
}

describe('apiClient', () => {
  afterEach(() => {
    setTokenProvider(() => null)
    setUnauthorizedHandler(() => {})
  })

  it('targets the API base URL from the environment', async () => {
    const request = await sentRequest()

    expect(request.baseURL).toBe(import.meta.env.VITE_API_URL)
    expect(request.headers.Accept).toBe('application/json')
  })

  it('sends the JWT as a bearer token when one is available', async () => {
    setTokenProvider(() => 'jwt-token')

    const request = await sentRequest()

    expect(request.headers.Authorization).toBe('Bearer jwt-token')
  })

  it('sends no Authorization header without a token', async () => {
    const request = await sentRequest()

    expect(request.headers.Authorization).toBeUndefined()
  })

  it('ends the session when the API refuses the token', async () => {
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)
    setTokenProvider(() => 'expired-token')

    await expect(apiClient.get('/files', { adapter: reject401 })).rejects.toBeInstanceOf(AxiosError)
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  it('keeps the session on a 401 that does not concern the token', async () => {
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)

    await expect(apiClient.post('/login', {}, { adapter: reject401 })).rejects.toBeInstanceOf(
      AxiosError,
    )
    expect(onUnauthorized).not.toHaveBeenCalled()
  })
})
