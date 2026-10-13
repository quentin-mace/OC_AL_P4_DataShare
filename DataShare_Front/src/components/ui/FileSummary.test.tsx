import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FileSummary } from './FileSummary'

describe('FileSummary', () => {
  it('shows the name and the readable size', () => {
    render(<FileSummary name="rapport.pdf" size={2_726_297} />)

    expect(screen.getByText('rapport.pdf')).toBeInTheDocument()
    expect(screen.getByText('2,6 Mo')).toBeInTheDocument()
  })

  it('keeps the full name in a tooltip, since a long one is truncated', () => {
    const name = 'IMG_9210_1231231313132132311231231313213231.jpg'
    render(<FileSummary name={name} size={10} />)

    expect(screen.getByText(name)).toHaveAttribute('title', name)
  })
})
