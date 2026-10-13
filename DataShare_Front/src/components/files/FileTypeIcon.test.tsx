import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FileTypeIcon } from './FileTypeIcon'

describe('FileTypeIcon', () => {
  it.each([
    ['image/jpeg', 'lucide-file-image'],
    ['audio/mpeg', 'lucide-file-music'],
    ['video/mp4', 'lucide-file-play'],
    ['application/pdf', 'lucide-file-text'],
    ['', 'lucide-file-text'],
  ])('picks the icon of "%s"', (mimeType, iconClass) => {
    const { container } = render(<FileTypeIcon mimeType={mimeType} />)

    const icon = container.querySelector('svg')
    expect(icon).toHaveClass(iconClass)
    expect(icon).toHaveAttribute('aria-hidden', 'true')
  })
})
