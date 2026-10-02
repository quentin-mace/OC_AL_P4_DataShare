import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Callout } from './Callout'

describe('Callout', () => {
  it('announces information politely by default', () => {
    render(<Callout>Ce fichier expirera dans 3 jours.</Callout>)

    expect(screen.getByRole('status')).toHaveTextContent('Ce fichier expirera dans 3 jours.')
  })

  it('announces a warning politely', () => {
    render(<Callout variant="warning">Ce fichier expirera demain.</Callout>)

    expect(screen.getByRole('status')).toHaveClass('bg-warning-soft')
  })

  it('announces an error immediately', () => {
    render(<Callout variant="error">Ce fichier a expiré.</Callout>)

    expect(screen.getByRole('alert')).toHaveClass('bg-error-soft')
  })
})
