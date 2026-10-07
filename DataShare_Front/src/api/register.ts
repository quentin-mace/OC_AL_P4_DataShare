import type { RegisterPayload } from '../validation/registerSchema'
import { apiClient } from './client'

export interface RegisteredUser {
  id: number
  email: string
  firstName: string
  lastName: string
}

export async function registerUser(payload: RegisterPayload): Promise<RegisteredUser> {
  const { data } = await apiClient.post<RegisteredUser>('/register', payload)
  return data
}
