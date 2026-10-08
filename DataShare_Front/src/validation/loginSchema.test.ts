import { describe, expect, it } from 'vitest'
import { loginSchema, type LoginFormInput } from './loginSchema'

const valid: LoginFormInput = { email: 'alice@example.com', password: 'correct-cheval-batterie' }

function failingFields(input: LoginFormInput) {
  const result = loginSchema.safeParse(input)
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'))
}

describe('loginSchema', () => {
  it('accepts valid credentials', () => {
    expect(failingFields(valid)).toEqual([])
  })

  it('trims the email but not the password', () => {
    const result = loginSchema.parse({ email: ' alice@example.com ', password: ' secret ' })

    expect(result).toEqual({ email: 'alice@example.com', password: ' secret ' })
  })

  it('requires both fields', () => {
    expect(failingFields({ email: '', password: '' })).toEqual(['email', 'password'])
  })

  it('rejects a malformed email', () => {
    expect(failingFields({ ...valid, email: 'pas-un-email' })).toEqual(['email'])
  })

  it('does not judge the password strength', () => {
    expect(failingFields({ ...valid, password: 'court' })).toEqual([])
  })
})
