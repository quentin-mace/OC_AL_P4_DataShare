import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Input } from './Input'

describe('Input', () => {
  it('is labelled by its label', async () => {
    render(<Input label="Mot de passe" placeholder="Optionnel" />)

    const input = screen.getByLabelText('Mot de passe')
    await userEvent.type(input, 'secret')

    expect(input).toHaveValue('secret')
    expect(input).toHaveAttribute('placeholder', 'Optionnel')
  })

  it('is valid without an error', () => {
    render(<Input label="Email" />)

    const input = screen.getByLabelText('Email')

    expect(input).not.toHaveAttribute('aria-invalid')
    expect(input).not.toHaveAccessibleDescription()
  })

  it('exposes its error to assistive technologies', () => {
    render(<Input label="Email" error="Adresse email invalide" />)

    const input = screen.getByLabelText('Email')

    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Adresse email invalide')
  })

  it('keeps an id given by the caller', () => {
    render(<Input label="Email" id="email" />)

    expect(screen.getByLabelText('Email')).toHaveAttribute('id', 'email')
  })
})
