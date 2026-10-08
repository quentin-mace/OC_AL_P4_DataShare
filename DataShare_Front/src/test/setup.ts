import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Without Vitest globals, RTL cannot unmount renders on its own.
afterEach(() => {
  cleanup()
})

// jsdom n'implémente pas la modale native : on en garde l'essentiel, l'attribut
// open qui rend le contenu visible (et donc trouvable par rôle).
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.open = true
}
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  this.open = false
}
