import type { LoginCredentials } from '../validation/loginSchema'
import { apiClient } from './client'

/** Renvoie le JWT émis par l'API. */
export async function login(credentials: LoginCredentials): Promise<string> {
  const { data } = await apiClient.post<{ token: string }>('/login', credentials)
  return data.token
}
