import type { AxiosAdapter } from 'axios'
import { afterEach, describe, expect, it } from 'vitest'
import { apiClient, setTokenProvider } from './client'

// Renvoie la requête telle qu'axios l'aurait émise, sans réseau.
const echo: AxiosAdapter = async (config) => ({
  data: config,
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
})

async function sentRequest() {
  const { data } = await apiClient.get('/files', { adapter: echo })
  return data
}

describe('apiClient', () => {
  afterEach(() => {
    setTokenProvider(() => null)
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
})
