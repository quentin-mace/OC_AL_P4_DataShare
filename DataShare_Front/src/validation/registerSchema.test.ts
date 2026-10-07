import { describe, expect, it } from 'vitest'
import { registerSchema, type RegisterFormInput } from './registerSchema'

const valid: RegisterFormInput = {
  email: 'alice@example.com',
  firstName: 'Alice',
  lastName: 'Martin',
  plainPassword: 'correct-cheval-batterie',
  confirmPassword: 'correct-cheval-batterie',
}

function failingFields(input: RegisterFormInput) {
  const result = registerSchema.safeParse(input)
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'))
}

describe('registerSchema', () => {
  it('accepts the payload the API tests register with', () => {
    expect(failingFields(valid)).toEqual([])
  })

  it('trims the identity fields before sending them', () => {
    const result = registerSchema.parse({
      ...valid,
      email: ' alice@example.com ',
      firstName: ' Alice ',
    })

    expect(result.email).toBe('alice@example.com')
    expect(result.firstName).toBe('Alice')
  })

  it('requires every field', () => {
    expect(
      failingFields({
        email: '',
        firstName: ' ',
        lastName: '',
        plainPassword: '',
        confirmPassword: '',
      }),
    ).toEqual(['email', 'firstName', 'lastName', 'plainPassword', 'confirmPassword'])
  })

  it('rejects a malformed email', () => {
    expect(failingFields({ ...valid, email: 'pas-un-email' })).toEqual(['email'])
  })

  it('rejects a strong password shorter than sixteen characters', () => {
    const password = 'aB3$dE6&gH9!jK2'

    expect(failingFields({ ...valid, plainPassword: password, confirmPassword: password })).toEqual(
      ['plainPassword'],
    )
  })

  it('rejects a long but guessable password', () => {
    const password = 'aaaaaaaaaaaaaaaa'

    expect(failingFields({ ...valid, plainPassword: password, confirmPassword: password })).toEqual(
      ['plainPassword'],
    )
  })

  it('reports a confirmation mismatch on the confirmation field', () => {
    expect(failingFields({ ...valid, confirmPassword: 'correct-cheval-batteri' })).toEqual([
      'confirmPassword',
    ])
  })

  it('reports a confirmation mismatch even when another field is invalid', () => {
    expect(failingFields({ ...valid, email: '', confirmPassword: 'autre-chose' })).toEqual([
      'email',
      'confirmPassword',
    ])
  })
})
