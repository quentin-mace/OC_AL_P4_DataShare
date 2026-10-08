import { describe, expect, it } from 'vitest'
import { fakeToken } from '../test/jwt'
import { isTokenExpired } from './jwt'

describe('isTokenExpired', () => {
  it('accepts a token whose expiry is ahead', () => {
    expect(isTokenExpired(fakeToken(3600))).toBe(false)
  })

  it('rejects a token whose expiry has passed', () => {
    expect(isTokenExpired(fakeToken(-1))).toBe(true)
  })

  it.each([['not-a-jwt'], ['a.b.c'], [`x.${btoa('{"sub":1}')}.y`]])(
    'treats an unreadable token (%s) as expired',
    (token) => {
      expect(isTokenExpired(token)).toBe(true)
    },
  )
})
