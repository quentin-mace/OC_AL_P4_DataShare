import { FileImage, FileMusic, FilePlay, FileText } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { fileIcon } from './fileIcon'

describe('fileIcon', () => {
  it.each([
    ['image/jpeg', FileImage],
    ['audio/mpeg', FileMusic],
    ['video/mp4', FilePlay],
    ['application/pdf', FileText],
    ['', FileText],
  ])('picks the icon of "%s"', (mimeType, icon) => {
    expect(fileIcon(mimeType)).toBe(icon)
  })
})
