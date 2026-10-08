import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProgressBar } from './ProgressBar'

describe('ProgressBar', () => {
  it('exposes its progress to assistive technologies', () => {
    render(<ProgressBar label="Envoi en cours" value={42.4} />)

    const bar = screen.getByRole('progressbar', { name: 'Envoi en cours' })

    expect(bar).toHaveAttribute('value', '42')
    expect(screen.getByText('42 %')).toBeInTheDocument()
  })

  it('keeps its value between 0 and 100', () => {
    render(<ProgressBar label="Envoi en cours" value={130} />)

    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '100')
  })
})
