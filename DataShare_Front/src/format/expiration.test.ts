import { describe, expect, it } from 'vitest'
import { daysUntil, expirationLabel, expirationNotice } from './expiration'

describe('daysUntil', () => {
  const now = new Date(2026, 9, 13, 22, 0)

  it('counts calendar days, not 24-hour periods', () => {
    expect(daysUntil(new Date(2026, 9, 14, 1, 0), now)).toBe(1)
    expect(daysUntil(new Date(2026, 9, 16, 23, 59), now)).toBe(3)
  })

  it('returns 0 for a date later the same day', () => {
    expect(daysUntil(new Date(2026, 9, 13, 23, 30), now)).toBe(0)
  })

  it('accepts an ISO string', () => {
    expect(daysUntil(new Date(2026, 9, 20, 12, 0).toISOString(), now)).toBe(7)
  })

  it('ignores a daylight saving change in between', () => {
    // Passage à l'heure d'hiver dans la nuit du 24 au 25 octobre 2026.
    expect(daysUntil(new Date(2026, 9, 27, 0, 30), now)).toBe(14)
  })
})

describe('expirationNotice', () => {
  it.each([
    [0, 'warning', "Ce fichier expire aujourd'hui."],
    [1, 'warning', 'Ce fichier expirera demain.'],
    [2, 'info', 'Ce fichier expirera dans 2 jours.'],
    [7, 'info', 'Ce fichier expirera dans 7 jours.'],
  ])('describes %i day(s) left', (days, variant, text) => {
    expect(expirationNotice(days)).toEqual({ variant, text })
  })
})

describe('expirationLabel', () => {
  it.each([
    [0, "Expire aujourd'hui"],
    [1, 'Expire demain'],
    [2, 'Expire dans 2 jours'],
    [7, 'Expire dans 7 jours'],
  ])('labels %i day(s) left', (days, label) => {
    expect(expirationLabel(days)).toBe(label)
  })
})
