import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Without Vitest globals, RTL cannot unmount renders on its own.
afterEach(() => {
  cleanup()
})
