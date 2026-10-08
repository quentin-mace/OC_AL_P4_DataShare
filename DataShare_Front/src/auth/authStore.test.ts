import { afterEach, describe, expect, it } from 'vitest'
import { apiClient } from '../api/client'
import { fakeToken } from '../test/jwt'
import { useAuthStore } from './authStore'

async function sentAuthorization() {
  const { data } = await apiClient.get('/files', {
    adapter: async (config) => ({ data: config, status: 200, statusText: '', headers: {}, config }),
  })
  return data.headers.Authorization
}

describe('authStore', () => {
  afterEach(() => {
    useAuthStore.setState({ token: null, sessionExpired: false })
    localStorage.clear()
  })

  it('keeps the token across page loads', () => {
    const token = fakeToken(3600)

    useAuthStore.getState().login(token)

    expect(JSON.parse(localStorage.getItem('datashare-auth')!).state).toEqual({ token })
  })

  it('lends the token to the API client', async () => {
    const token = fakeToken(3600)
    useAuthStore.getState().login(token)

    expect(await sentAuthorization()).toBe(`Bearer ${token}`)
  })

  it('ends the session instead of sending an expired token', async () => {
    useAuthStore.getState().login(fakeToken(-1))

    expect(await sentAuthorization()).toBeUndefined()
    expect(useAuthStore.getState()).toMatchObject({ token: null, sessionExpired: true })
  })

  it('distinguishes a deliberate logout from an expired session', () => {
    useAuthStore.getState().login(fakeToken(3600))

    useAuthStore.getState().logout()

    expect(useAuthStore.getState()).toMatchObject({ token: null, sessionExpired: false })
  })
})
