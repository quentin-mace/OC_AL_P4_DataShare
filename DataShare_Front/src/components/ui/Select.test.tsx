import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Select } from './Select'

const options = [
  { value: '1', label: 'Une journée' },
  { value: '7', label: 'Une semaine' },
]

describe('Select', () => {
  it('lets the user pick an option', async () => {
    render(<Select label="Expiration" options={options} defaultValue="1" />)

    const select = screen.getByLabelText('Expiration')
    await userEvent.selectOptions(select, 'Une semaine')

    expect(select).toHaveValue('7')
  })

  it('is valid without an error', () => {
    render(<Select label="Expiration" options={options} />)

    expect(screen.getByLabelText('Expiration')).not.toHaveAttribute('aria-invalid')
  })

  it('exposes its error to assistive technologies', () => {
    render(<Select label="Expiration" options={options} error="Durée invalide" />)

    const select = screen.getByLabelText('Expiration')

    expect(select).toHaveAttribute('aria-invalid', 'true')
    expect(select).toHaveAccessibleDescription('Durée invalide')
  })
})
