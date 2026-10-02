import { describe, expect, it } from 'vitest'
import { buttonStyles } from './buttonStyles'

describe('buttonStyles', () => {
  it('defaults to a medium tinted button', () => {
    const classes = buttonStyles()

    expect(classes).toContain('bg-accent-soft')
    expect(classes).toContain('h-9')
    expect(classes).not.toContain('w-full')
  })

  it.each([
    ['outline', 'border-accent-border'],
    ['ghost', 'border-transparent'],
    ['dark', 'bg-dark'],
  ] as const)('applies the %s variant', (variant, expected) => {
    expect(buttonStyles({ variant })).toContain(expected)
  })

  it('applies the small size and full width', () => {
    const classes = buttonStyles({ size: 'sm', fullWidth: true })

    expect(classes).toContain('h-7')
    expect(classes).toContain('w-full')
  })
})
