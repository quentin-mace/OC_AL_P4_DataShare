import { describe, expect, it } from 'vitest'
import { formatFileSize } from './fileSize'

describe('formatFileSize', () => {
  it.each([
    [0, '0 o'],
    [512, '512 o'],
    [1024, '1 Ko'],
    [2.6 * 1024 ** 2, '2,6 Mo'],
    [1023.96 * 1024 ** 2, '1024 Mo'],
    [1024 ** 3, '1 Go'],
  ])('formats %d bytes as "%s"', (bytes, expected) => {
    expect(formatFileSize(bytes)).toBe(expected)
  })
})
