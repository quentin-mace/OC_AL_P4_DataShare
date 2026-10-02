import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button'

describe('Button', () => {
  it('does not submit a surrounding form by default', async () => {
    const onSubmit = vi.fn<(event: SubmitEvent) => void>((event) => event.preventDefault())
    render(
      <form onSubmit={(event) => onSubmit(event.nativeEvent as SubmitEvent)}>
        <Button>Téléverser</Button>
      </form>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Téléverser' }))

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('calls onClick when enabled', async () => {
    const onClick = vi.fn<() => void>()
    render(<Button onClick={onClick}>Téléverser</Button>)

    await userEvent.click(screen.getByRole('button', { name: 'Téléverser' }))

    expect(onClick).toHaveBeenCalledOnce()
  })

  it('ignores clicks when disabled', async () => {
    const onClick = vi.fn<() => void>()
    render(
      <Button onClick={onClick} disabled>
        Téléverser
      </Button>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Téléverser' }))

    expect(onClick).not.toHaveBeenCalled()
  })

  it('keeps icons out of the accessible name', () => {
    render(
      <Button leadingIcon={<svg data-testid="leading" />} trailingIcon={<svg />}>
        Téléverser
      </Button>,
    )

    expect(screen.getByRole('button', { name: 'Téléverser' })).toBeInTheDocument()
    expect(screen.getByTestId('leading').parentElement).toHaveAttribute('aria-hidden', 'true')
  })
})
