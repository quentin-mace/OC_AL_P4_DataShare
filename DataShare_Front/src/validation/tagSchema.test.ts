import { describe, expect, it } from 'vitest'
import { tagRuleMessage, tagSchema } from './tagSchema'

function messagesFor(tag: string, taken: string[] = []) {
  const result = tagSchema(taken).safeParse({ tag })
  return result.success ? [] : result.error.issues.map((issue) => issue.message)
}

describe('tagSchema', () => {
  it('trims the tag like the back does', () => {
    expect(tagSchema([]).parse({ tag: '  facture ' })).toEqual({ tag: 'facture' })
  })

  it.each(['', '   '])('requires a tag ("%s")', (tag) => {
    expect(messagesFor(tag)).toEqual(['Saisissez un tag.'])
  })

  it('accepts a tag of 30 characters but not 31', () => {
    expect(messagesFor('a'.repeat(30))).toEqual([])
    expect(messagesFor('a'.repeat(31))).toEqual([
      `Un tag ne peut pas dépasser 30 caractères ("${'a'.repeat(31)}").`,
    ])
  })

  it('rejects a comma, which separates the tags on upload', () => {
    expect(messagesFor('facture,client')).toEqual(['Un tag ne peut pas contenir de virgule.'])
  })

  it('rejects a slash, which the tag routes cannot address', () => {
    expect(messagesFor('2026/10')).toEqual(['Un tag ne peut pas contenir de "/" ("2026/10").'])
  })

  it('rejects a tag the file already has', () => {
    expect(messagesFor(' facture', ['facture'])).toEqual(['Ce fichier porte déjà ce tag.'])
  })

  it('tells tags apart by case, like the back', () => {
    expect(messagesFor('Facture', ['facture'])).toEqual([])
  })
})

describe('tagRuleMessage', () => {
  it('accepts an ordinary tag', () => {
    expect(tagRuleMessage('client-x')).toBeNull()
  })
})
