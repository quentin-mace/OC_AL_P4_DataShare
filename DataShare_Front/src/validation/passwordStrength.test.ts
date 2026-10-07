import { describe, expect, it } from 'vitest'
import { MIN_PASSWORD_SCORE, passwordEntropy, passwordStrength } from './passwordStrength'

describe('passwordStrength', () => {
  // Scores relevés en appelant PasswordStrengthValidator::estimateStrength
  // de Symfony sur les mêmes chaînes : le portage doit les reproduire à l'identique.
  it.each([
    ['', 0],
    ['correct-cheval-batterie', 3],
    ['aaaaaaaaaaaaaaaa', 0],
    ['aB3$aB3$aB3$aB3$', 0],
    ['aB3$dE6&gH9!jK2', 2],
    ['motdepasselongue', 1],
    ['Tr0ub4dor&3-cheval', 3],
    ['éléphant-éléphant', 3],
  ])('scores %j like the server does', (password, score) => {
    expect(passwordStrength(password)).toBe(score)
  })

  it('accepts the password the API tests register with', () => {
    expect(passwordStrength('correct-cheval-batterie')).toBeGreaterThanOrEqual(MIN_PASSWORD_SCORE)
  })

  it('rejects a repeated pattern even when it mixes every character class', () => {
    expect(passwordStrength('aB3$aB3$aB3$aB3$')).toBeLessThan(MIN_PASSWORD_SCORE)
  })

  it('counts bytes, not characters, like PHP does', () => {
    // "é" pèse deux octets UTF-8, tous deux dans la classe "other".
    expect(passwordEntropy('é')).toBeCloseTo(2 * Math.log2(128))
  })
})
