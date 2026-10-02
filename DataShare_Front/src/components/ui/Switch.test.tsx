import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Switch } from './Switch'

type Filter = 'all' | 'active' | 'expired'

const options: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'active', label: 'Actifs' },
  { value: 'expired', label: 'Expiré' },
]

function ControlledSwitch({ onChange }: { onChange?: (value: Filter) => void }) {
  const [value, setValue] = useState<Filter>('all')
  return (
    <Switch
      label="Filtrer les fichiers"
      options={options}
      value={value}
      onChange={(next) => {
        setValue(next)
        onChange?.(next)
      }}
    />
  )
}

describe('Switch', () => {
  it('groups its options under its label', () => {
    render(<ControlledSwitch />)

    expect(screen.getByRole('group', { name: 'Filtrer les fichiers' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(3)
    expect(screen.getByRole('radio', { name: 'Tous' })).toBeChecked()
  })

  it('selects an option on click', async () => {
    const onChange = vi.fn<(value: Filter) => void>()
    render(<ControlledSwitch onChange={onChange} />)

    await userEvent.click(screen.getByText('Actifs'))

    expect(onChange).toHaveBeenCalledWith('active')
    expect(screen.getByRole('radio', { name: 'Actifs' })).toBeChecked()
  })

  it('moves the selection with the arrow keys', async () => {
    render(<ControlledSwitch />)

    await userEvent.click(screen.getByText('Tous'))
    await userEvent.keyboard('{ArrowRight}')

    expect(screen.getByRole('radio', { name: 'Actifs' })).toBeChecked()
  })
})
