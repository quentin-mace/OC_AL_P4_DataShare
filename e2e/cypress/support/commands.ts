import { apiUrl, type TestUser } from './data'

declare global {
  namespace Cypress {
    interface Chainable {
      /** Cree le compte directement par l'API, sans passer par le formulaire. */
      registerViaApi(user: TestUser): Chainable<void>
      /** Ouvre une session par l'API et la depose la ou le front la relit. */
      loginViaApi(user: TestUser): Chainable<string>
      /** Envoie un fichier depuis la modale d'upload deja ouverte, rend le lien de partage. */
      uploadFromDialog(options: {
        fixture: string
        password?: string
        tags?: string
      }): Chainable<string>
    }
  }
}

Cypress.Commands.add('registerViaApi', (user: TestUser) => {
  cy.request('POST', `${apiUrl()}/register`, {
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    plainPassword: user.password,
  })
})

Cypress.Commands.add('loginViaApi', (user: TestUser) => {
  return cy
    .request<{ token: string }>('POST', `${apiUrl()}/login`, {
      email: user.email,
      password: user.password,
    })
    .then(({ body }) => {
      // Format du middleware persist de zustand (src/auth/authStore.ts du front).
      window.localStorage.setItem(
        'datashare-auth',
        JSON.stringify({ state: { token: body.token }, version: 0 }),
      )
      return body.token
    })
})

Cypress.Commands.add('uploadFromDialog', ({ fixture, password, tags }) => {
  cy.findByRole('dialog', { name: 'Ajouter un fichier' }).within(() => {
    // Le vrai input est masque (sr-only) derriere le bouton "Choisir un fichier".
    cy.findByLabelText('Fichier').selectFile(`cypress/fixtures/${fixture}`, { force: true })
    if (password) cy.findByLabelText('Mot de passe').type(password)
    if (tags) cy.findByLabelText('Tags').type(tags)
    cy.findByRole('button', { name: 'Téléverser' }).click()
    cy.contains('output', 'Félicitations')
  })
  return cy
    .findByRole('dialog', { name: 'Ajouter un fichier' })
    .find('a[href*="/download/"]')
    .invoke('attr', 'href')
    .then((href) => href as string)
})

export {}
