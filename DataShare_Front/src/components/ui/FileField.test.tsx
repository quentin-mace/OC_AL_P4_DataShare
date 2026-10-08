import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { FileField } from './FileField'

const photo = new File(['x'.repeat(2048)], 'photo.jpg', { type: 'image/jpeg' })

function ControlledFileField({ error }: { error?: string }) {
  const [file, setFile] = useState<File>()
  return <FileField label="Fichier" file={file} onChange={setFile} error={error} />
}

describe('FileField', () => {
  it('invites to pick a file while empty', () => {
    render(<ControlledFileField />)

    expect(screen.getByRole('button', { name: 'Choisir un fichier' })).toBeInTheDocument()
  })

  it('shows the name and size of the picked file', async () => {
    render(<ControlledFileField />)

    await userEvent.upload(screen.getByLabelText('Fichier'), photo)

    expect(screen.getByText('photo.jpg')).toBeInTheDocument()
    expect(screen.getByText('2 Ko')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Changer' })).toBeInTheDocument()
  })

  it('opens the system picker from the visible button', async () => {
    render(<ControlledFileField />)
    const click = vi.spyOn(screen.getByLabelText('Fichier'), 'click')

    await userEvent.click(screen.getByRole('button', { name: 'Choisir un fichier' }))

    expect(click).toHaveBeenCalled()
  })

  it('keeps the current file when the picker is cancelled', () => {
    const onChange = vi.fn<(file: File | undefined) => void>()
    render(<FileField label="Fichier" file={photo} onChange={onChange} />)

    screen.getByLabelText('Fichier').dispatchEvent(new Event('change', { bubbles: true }))

    expect(onChange).not.toHaveBeenCalled()
  })

  it('exposes its error to assistive technologies', () => {
    render(<ControlledFileField error="Choisissez un fichier." />)

    expect(screen.getByLabelText('Fichier')).toHaveAccessibleDescription('Choisissez un fichier.')
    expect(screen.getByRole('button', { name: 'Choisir un fichier' })).toHaveAccessibleDescription(
      'Choisissez un fichier.',
    )
  })
})
