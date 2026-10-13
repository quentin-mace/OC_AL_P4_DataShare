import { describe, expect, it } from 'vitest'
import { downloadPasswordSchema } from './downloadSchema'

describe('downloadPasswordSchema', () => {
  it('requires a password', () => {
    expect(downloadPasswordSchema.safeParse({ password: '' }).success).toBe(false)
  })

  it('accepts any non-empty password, untrimmed', () => {
    expect(downloadPasswordSchema.parse({ password: ' abc ' })).toEqual({ password: ' abc ' })
  })
})
